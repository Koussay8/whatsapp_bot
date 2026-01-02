/**
 * BotInstance - Classe représentant un bot WhatsApp individuel
 * Chaque bot a sa propre session Baileys et configuration
 */

import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { transcribeAudio } from './services/transcription.js';
import { analyzeMessage } from './services/ai-analyzer.js';
import { generateInvoicePDF } from './services/invoice.js';
import { sendEmails } from './services/email.js';

export class BotInstance {
    constructor(botId, config, dataPath) {
        this.botId = botId;
        this.config = config;
        this.dataPath = dataPath;
        this.socket = null;
        this.qrCode = null;
        this.status = 'disconnected';
        this.phoneNumber = null;
        this.enabled = config.enabled ?? false;
        this.processedMessages = new Set();
        this.pendingOrders = new Map();

        // Paths
        this.authPath = path.join(dataPath, 'auth');
        this.tempPath = path.join(dataPath, 'temp');
        this.invoicesPath = path.join(dataPath, 'invoices');

        // Create directories
        [this.authPath, this.tempPath, this.invoicesPath].forEach(dir => {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        });
    }

    /**
     * Démarrer le bot
     */
    async start() {
        if (this.status === 'connecting' || this.status === 'connected') {
            console.log(`[${this.botId}] Already running`);
            return;
        }

        console.log(`[${this.botId}] Starting...`);
        this.status = 'connecting';

        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
            const { version } = await fetchLatestBaileysVersion();

            const logger = pino({ level: 'silent' });

            this.socket = makeWASocket({
                auth: state,
                logger,
                browser: [`Bot ${this.botId}`, 'Chrome', '120.0.0'],
                version,
                syncFullHistory: false,
                markOnlineOnConnect: false,
            });

            // Connection events
            this.socket.ev.on('connection.update', async (update) => {
                await this.handleConnectionUpdate(update);
            });

            this.socket.ev.on('creds.update', saveCreds);

            // Message events - always process (admin commands work even when disabled)
            this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
                if (type !== 'notify') return;

                for (const msg of messages) {
                    await this.handleMessage(msg);
                }
            });

        } catch (error) {
            console.error(`[${this.botId}] Start error:`, error.message);
            this.status = 'error';
            throw error;
        }
    }

    /**
     * Arrêter le bot (sans déconnexion de WhatsApp)
     */
    async stop() {
        if (this.socket) {
            try {
                // Ferme la connexion sans logout (garde la session)
                this.socket.end(new Error('Manual stop'));
            } catch (e) { }
            this.socket = null;
        }
        this.status = 'disconnected';
        this.qrCode = null;
        console.log(`[${this.botId}] Stopped (session preserved)`);
    }

    /**
     * Déconnexion complète (efface la session)
     */
    async logout() {
        if (this.socket) {
            try {
                await this.socket.logout();
            } catch (e) { }
            this.socket = null;
        }
        // Clear session files
        if (fs.existsSync(this.authPath)) {
            fs.rmSync(this.authPath, { recursive: true, force: true });
            fs.mkdirSync(this.authPath, { recursive: true });
        }
        this.status = 'logged_out';
        this.qrCode = null;
        this.phoneNumber = null;
        console.log(`[${this.botId}] Logged out (session cleared)`);
    }

    /**
     * Activer/Désactiver le traitement des messages
     */
    setEnabled(enabled, notifySender = null) {
        this.enabled = enabled;
        this.config.enabled = enabled;
        this.saveConfig();
        console.log(`[${this.botId}] ${enabled ? 'Enabled' : 'Disabled'}`);

        // Envoyer confirmation si demandé
        if (notifySender && this.socket) {
            const msg = enabled
                ? '✅ *Bot activé!* Je répondrai maintenant aux messages.'
                : '⛔ *Bot désactivé!* Je ne répondrai plus aux messages (sauf commandes admin).';
            this.sendMessage(notifySender, msg);
        }
    }

    /**
     * Gestion des événements de connexion
     */
    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Generate QR code as data URL
            this.qrCode = await QRCode.toDataURL(qr);
            this.status = 'waiting_qr';
            console.log(`[${this.botId}] QR code generated`);
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(`[${this.botId}] Disconnected (${statusCode})`);

            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                // Clear session
                if (fs.existsSync(this.authPath)) {
                    fs.rmSync(this.authPath, { recursive: true, force: true });
                    fs.mkdirSync(this.authPath, { recursive: true });
                }
                this.status = 'logged_out';
                this.qrCode = null;
            } else {
                this.status = 'disconnected';
                // Auto-reconnect after delay
                setTimeout(() => this.start(), 5000);
            }
        } else if (connection === 'open') {
            this.status = 'connected';
            this.qrCode = null;
            this.phoneNumber = this.socket.user?.id?.split(':')[0];
            console.log(`[${this.botId}] Connected (${this.phoneNumber})`);
        }
    }

    /**
     * Traitement des messages
     * Supports activation modes: onReceive and onSend
     */
    async handleMessage(msg) {
        const msgId = msg.key.id;
        if (this.processedMessages.has(msgId)) return;
        this.processedMessages.add(msgId);

        // Cleanup cache
        if (this.processedMessages.size > 500) {
            const oldest = Array.from(this.processedMessages).slice(0, 250);
            oldest.forEach(id => this.processedMessages.delete(id));
        }

        const remoteJid = msg.key.remoteJid;
        const isGroup = remoteJid.endsWith('@g.us');

        // ❌ NEVER process groups
        if (isGroup) return;

        const message = msg.message;
        if (!message) return;

        // Direction detection
        const isFromMe = msg.key.fromMe === true;
        const isIncoming = !isFromMe;
        const isOutgoing = isFromMe;

        // Number extraction
        const remoteNumber = remoteJid.split('@')[0];
        const myNumber = this.phoneNumber;

        // Self-message detection (message to oneself)
        const isSelfMessage = isFromMe && myNumber && remoteNumber === myNumber;

        // Get text for command checking
        const text = message.conversation || message.extendedTextMessage?.text || '';
        const lower = text.toLowerCase().trim();

        // ============================================================
        // BOT COMMANDS - ONLY via self-message
        // ============================================================
        if (isSelfMessage) {
            if (lower === 'bot on') {
                this.setEnabled(true, remoteJid);
                return;
            }
            if (lower === 'bot off') {
                this.setEnabled(false, remoteJid);
                return;
            }
            if (lower === 'bot status') {
                const statusMsg = this.enabled ? '✅ Actif' : '⛔ Désactivé';
                const modes = [];
                if (this.config.activateOnReceive) modes.push('📥 Réception');
                if (this.config.activateOnSend) modes.push('📤 Envoi');
                await this.sendMessage(remoteJid,
                    `🤖 *Statut:* ${statusMsg}\n` +
                    `📋 *Modes:* ${modes.length > 0 ? modes.join(', ') : 'Aucun'}`
                );
                return;
            }
        }

        // If disabled, don't process anything else
        if (!this.enabled) return;

        // ============================================================
        // AUDIO PROCESSING
        // ============================================================
        if (message.audioMessage) {
            // Get activation config (with defaults for backwards compatibility)
            const activateOnReceive = this.config.activateOnReceive ?? true;
            const activateOnSend = this.config.activateOnSend ?? false;
            const receiveFromNumbers = this.config.receiveFromNumbers || [];
            const sendToNumbers = this.config.sendToNumbers || [];

            let shouldProcess = false;

            // Check INCOMING audio (received from someone)
            if (isIncoming && activateOnReceive) {
                if (receiveFromNumbers.length === 0) {
                    // Accept from anyone
                    shouldProcess = true;
                } else {
                    // Accept only from specific numbers
                    const normalizedRemote = this.normalizeNumber(remoteNumber);
                    shouldProcess = receiveFromNumbers.some(n =>
                        this.normalizeNumber(n) === normalizedRemote
                    );
                }
            }

            // Check OUTGOING audio (sent by me)
            if (isOutgoing && activateOnSend && !isSelfMessage) {
                if (sendToNumbers.length === 0) {
                    // Process for any recipient
                    shouldProcess = true;
                } else {
                    // Process only for specific recipients
                    const normalizedRemote = this.normalizeNumber(remoteNumber);
                    shouldProcess = sendToNumbers.some(n =>
                        this.normalizeNumber(n) === normalizedRemote
                    );
                }
            }

            if (shouldProcess) {
                try {
                    await this.handleAudioMessage(msg, remoteJid, isOutgoing);
                } catch (error) {
                    console.error(`[${this.botId}] Audio error:`, error.message);
                    if (!isOutgoing) {
                        await this.sendMessage(remoteJid, '❌ Erreur de traitement audio.');
                    }
                }
            }
            return;
        }

        // ============================================================
        // TEXT MESSAGES (only for incoming, response logic)
        // ============================================================
        if (isIncoming && (message.conversation || message.extendedTextMessage)) {
            try {
                await this.handleTextMessage(msg, remoteJid, text);
            } catch (error) {
                console.error(`[${this.botId}] Text error:`, error.message);
                await this.sendMessage(remoteJid, '❌ Une erreur s\'est produite.');
            }
        }
    }

    /**
     * Normalize phone number (remove +, spaces, etc.)
     */
    normalizeNumber(num) {
        return String(num).replace(/[^0-9]/g, '');
    }

    /**
     * Traitement message audio
     * @param {object} msg - Message object
     * @param {string} remoteJid - Remote JID (sender or recipient)
     * @param {boolean} isOutgoing - True if this is a message sent by us
     */
    async handleAudioMessage(msg, remoteJid, isOutgoing = false) {
        const direction = isOutgoing ? 'TO' : 'FROM';
        const number = remoteJid.split('@')[0];
        console.log(`[${this.botId}] Audio ${direction} ${number}`);

        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        const audioPath = path.join(this.tempPath, `audio_${Date.now()}.ogg`);
        fs.writeFileSync(audioPath, buffer);

        try {
            // Transcribe
            const transcription = await transcribeAudio(audioPath, this.config.settings?.groqApiKey);

            if (!transcription || transcription.trim().length < 3) {
                // For outgoing, send to self. For incoming, reply to sender.
                const replyTo = isOutgoing ? `${this.phoneNumber}@s.whatsapp.net` : remoteJid;
                await this.sendMessage(replyTo, '⚠️ Message non compris. Réessayez.');
                return;
            }

            // Analyze with AI
            const contextNumber = number;
            const result = await analyzeMessage(
                transcription,
                this.pendingOrders.get(contextNumber),
                this.config
            );

            // Build response
            const prefix = isOutgoing ? `📤 *Envoyé à ${number}*\n` : '';
            let response = `${prefix}📝 *Transcription:*\n"${transcription.trim()}"`;
            if (result.aiMessage) {
                response += `\n\n${result.aiMessage}`;
            }

            // For outgoing messages, send response to self
            const replyTo = isOutgoing ? `${this.phoneNumber}@s.whatsapp.net` : remoteJid;
            await this.sendMessage(replyTo, response);

            // Handle result
            if (result.status === 'pending_confirmation') {
                this.pendingOrders.set(contextNumber, result.data);
            } else if (result.status === 'confirmed') {
                await this.generateInvoice(replyTo, result.data, transcription);
                this.pendingOrders.delete(contextNumber);
            } else if (result.status === 'cancelled') {
                this.pendingOrders.delete(contextNumber);
            }

        } finally {
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        }
    }

    /**
     * Traitement message texte
     */
    async handleTextMessage(msg, sender, text) {
        const senderNumber = sender.split('@')[0];
        const lower = text.toLowerCase().trim();

        // Help command
        if (lower === 'aide' || lower === 'help') {
            await this.sendMessage(sender,
                `🤖 *Bot Facture*\n\nEnvoyez un message vocal avec:\n"Facture pour [client], [service], [montant] euros"`
            );
            return;
        }

        // Cancel command
        if (lower === 'annuler') {
            if (this.pendingOrders.has(senderNumber)) {
                this.pendingOrders.delete(senderNumber);
                await this.sendMessage(sender, '❌ Commande annulée.');
            }
            return;
        }

        // If pending order, analyze response
        if (this.pendingOrders.has(senderNumber)) {
            const result = await analyzeMessage(text, this.pendingOrders.get(senderNumber), this.config);

            if (result.aiMessage) {
                await this.sendMessage(sender, result.aiMessage);
            }

            if (result.status === 'confirmed') {
                await this.generateInvoice(sender, result.data, text);
                this.pendingOrders.delete(senderNumber);
            } else if (result.status === 'pending_confirmation') {
                this.pendingOrders.set(senderNumber, result.data);
            } else if (result.status === 'cancelled') {
                this.pendingOrders.delete(senderNumber);
            }
        }
    }

    /**
     * Générer et envoyer facture
     */
    async generateInvoice(sender, data, transcription) {
        await this.sendMessage(sender, '📄 Génération de la facture...');

        const { filepath, invoiceNumber, totalTTC } = await generateInvoicePDF(data, this.invoicesPath, this.config);

        // Send emails
        const emailResult = await sendEmails({
            invoiceNumber,
            pdfPath: filepath,
            data,
            transcription,
            config: this.config,
        });

        // Format response
        const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalTTC);
        let response = `🎉 *Facture créée!*\n\n📄 N°: *${invoiceNumber}*\n👤 ${data.clientName}\n💰 *${amount}*`;

        if (emailResult.invoiceSent) {
            response += `\n📧 Envoyée!`;
        }

        await this.sendMessage(sender, response);
    }

    /**
     * Envoyer un message
     */
    async sendMessage(to, text) {
        if (this.socket) {
            await this.socket.sendMessage(to, { text });
        }
    }

    /**
     * Sauvegarder la config
     */
    saveConfig() {
        const configPath = path.join(this.dataPath, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    }

    /**
     * Obtenir le statut du bot
     */
    getStatus() {
        return {
            id: this.botId,
            name: this.config.name,
            status: this.status,
            enabled: this.enabled,
            phoneNumber: this.phoneNumber,
            hasQR: !!this.qrCode,
        };
    }

    /**
     * Obtenir le QR code
     */
    getQRCode() {
        return this.qrCode;
    }
}

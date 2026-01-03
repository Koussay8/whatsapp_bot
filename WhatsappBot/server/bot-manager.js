/**
 * BotManager - Gère toutes les instances de bots WhatsApp
 * Permet de créer, démarrer, arrêter des bots individuellement
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BotInstance } from './bot-instance.js';

const DATA_PATH = path.join(process.cwd(), 'data', 'bots');

// Ensure data directory exists
if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH, { recursive: true });
}

class BotManager {
    constructor() {
        this.bots = new Map(); // botId -> BotInstance
        this.initialized = false;
    }

    /**
     * Initialiser le manager et charger les bots existants
     */
    async initialize() {
        if (this.initialized) return;

        console.log('🤖 Bot Manager initializing...');

        // Load existing bots from disk
        const botDirs = fs.readdirSync(DATA_PATH).filter(dir => {
            const configPath = path.join(DATA_PATH, dir, 'config.json');
            return fs.existsSync(configPath);
        });

        for (const botDir of botDirs) {
            const botPath = path.join(DATA_PATH, botDir);
            const config = JSON.parse(fs.readFileSync(path.join(botPath, 'config.json'), 'utf8'));

            const bot = new BotInstance(config.id, config, botPath);
            this.bots.set(config.id, bot);

            // Auto-start if was enabled
            if (config.autoStart) {
                try {
                    await bot.start();
                } catch (e) {
                    console.error(`Failed to auto-start ${config.id}:`, e.message);
                }
            }
        }

        this.initialized = true;
        console.log(`✅ Loaded ${this.bots.size} bots`);
    }

    /**
     * Types de bots prédéfinis avec prompts par défaut
     */
    static BOT_TYPES = {
        invoice: {
            name: 'Facturation',
            prompt: `Tu es un assistant de facturation intelligent.
Tu analyses les messages vocaux pour extraire:
- Nom du client
- Email du client (si mentionné)
- Description du service/produit
- Montant en euros

Si des informations manquent, demande-les poliment.
Quand tout est complet, demande confirmation avant de générer la facture.
Réponds en français.`,
        },
        support: {
            name: 'Support Client',
            prompt: `Tu es un assistant de support client professionnel et amical.
Tu réponds aux questions des clients en utilisant ta base de connaissances.
Si tu ne connais pas la réponse, propose de transmettre à un humain.
Sois empathique et orienté solution.
Réponds en français.`,
        },
        appointment: {
            name: 'Prise de RDV',
            prompt: `Tu es un assistant de prise de rendez-vous.
Tu aides les clients à réserver un créneau.
Collecte: nom, email/téléphone, date souhaitée, motif du RDV.
Confirme toujours les informations avant de valider.
Réponds en français.`,
        },
        custom: {
            name: 'Personnalisé',
            prompt: `Tu es un assistant WhatsApp intelligent.
Tu aides les utilisateurs avec leurs demandes.
Sois professionnel et amical.`,
        },
    };

    /**
     * Créer un nouveau bot avec options étendues
     */
    async createBot(name, settings = {}, options = {}) {
        const botId = `bot-${uuidv4().split('-')[0]}`;
        const botPath = path.join(DATA_PATH, botId);

        // Extract options
        const {
            botType = 'invoice',
            customPrompt = null,
            knowledge = [],
            welcomeMessage = '',
            language = 'fr',
            ownerEmail = null,
            // Activation modes
            activateOnReceive = true,
            activateOnSend = false,
            receiveFromNumbers = [],
            sendToNumbers = [],
        } = options;

        // Create directories
        fs.mkdirSync(botPath, { recursive: true });
        fs.mkdirSync(path.join(botPath, 'auth'), { recursive: true });
        fs.mkdirSync(path.join(botPath, 'temp'), { recursive: true });
        fs.mkdirSync(path.join(botPath, 'invoices'), { recursive: true });

        // Get default prompt based on bot type
        const typeConfig = BotManager.BOT_TYPES[botType] || BotManager.BOT_TYPES.custom;

        // Config
        const config = {
            id: botId,
            name: name || `Bot ${this.bots.size + 1}`,
            botType: botType,
            ownerEmail: ownerEmail,
            status: 'created',
            enabled: false,
            autoStart: false,
            language: language,
            welcomeMessage: welcomeMessage,
            // Activation modes
            activateOnReceive: activateOnReceive,
            activateOnSend: activateOnSend,
            receiveFromNumbers: Array.isArray(receiveFromNumbers) ? receiveFromNumbers : [],
            sendToNumbers: Array.isArray(sendToNumbers) ? sendToNumbers : [],
            createdAt: new Date().toISOString(),
            settings: {
                groqApiKey: settings.groqApiKey || process.env.GROQ_API_KEY_DEFAULT || '',
                companyName: settings.companyName || process.env.COMPANY_NAME_DEFAULT || 'Entreprise',
                companyEmail: settings.companyEmail || process.env.COMPANY_EMAIL_DEFAULT || '',
                invoicePrefix: settings.invoicePrefix || 'FAC-',
                emailUser: settings.emailUser || process.env.EMAIL_USER_DEFAULT || '',
                emailPassword: settings.emailPassword || process.env.EMAIL_APP_PASSWORD_DEFAULT || '',
                emailRecipients: settings.emailRecipients || [],
                ...settings,
            },
        };

        // Prompt (custom or type default)
        const prompt = {
            system: customPrompt || typeConfig.prompt,
            botType: botType,
            language: language,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
        };

        // Knowledge base (with initial entries if provided)
        const knowledgeBase = {
            entries: Array.isArray(knowledge) ? knowledge.map((item, idx) => ({
                id: `kb-${idx}`,
                question: typeof item === 'string' ? item : item.question || '',
                answer: typeof item === 'string' ? '' : item.answer || '',
                category: typeof item === 'object' ? item.category || 'general' : 'general',
                createdAt: new Date().toISOString(),
            })) : [],
            lastUpdated: knowledge.length > 0 ? new Date().toISOString() : null,
        };

        // Email templates
        const emails = {
            invoice: {
                subject: 'Facture {invoiceNumber} - {clientName}',
                html: `<h1>Facture {invoiceNumber}</h1>
<p>Client: {clientName}</p>
<p>Montant: {amount}</p>
<p>La facture est en pièce jointe.</p>`,
            },
            confirmation: {
                subject: '✅ Facture {invoiceNumber} créée',
                html: `<h1>Confirmation</h1>
<p>La facture {invoiceNumber} a été créée et envoyée.</p>
<p>Client: {clientName}</p>
<p>Montant: {amount}</p>`,
            },
        };

        // Save files
        fs.writeFileSync(path.join(botPath, 'config.json'), JSON.stringify(config, null, 2));
        fs.writeFileSync(path.join(botPath, 'prompt.json'), JSON.stringify(prompt, null, 2));
        fs.writeFileSync(path.join(botPath, 'knowledge.json'), JSON.stringify(knowledgeBase, null, 2));
        fs.writeFileSync(path.join(botPath, 'emails.json'), JSON.stringify(emails, null, 2));

        // Create instance
        const bot = new BotInstance(botId, config, botPath);
        this.bots.set(botId, bot);

        console.log(`✅ Created bot: ${botId} (type: ${botType})`);
        return bot.getStatus();
    }

    /**
     * Démarrer un bot
     */
    async startBot(botId) {
        const bot = this.bots.get(botId);
        if (!bot) throw new Error(`Bot ${botId} not found`);

        await bot.start();
        return bot.getStatus();
    }

    /**
     * Arrêter un bot (préserve la session)
     */
    async stopBot(botId) {
        const bot = this.bots.get(botId);
        if (!bot) throw new Error(`Bot ${botId} not found`);

        await bot.stop();
        return bot.getStatus();
    }

    /**
     * Déconnecter complètement un bot (efface la session)
     */
    async logoutBot(botId) {
        const bot = this.bots.get(botId);
        if (!bot) throw new Error(`Bot ${botId} not found`);

        await bot.logout();
        return bot.getStatus();
    }

    /**
     * Activer/Désactiver un bot
     */
    setEnabled(botId, enabled) {
        const bot = this.bots.get(botId);
        if (!bot) throw new Error(`Bot ${botId} not found`);

        bot.setEnabled(enabled);
        return bot.getStatus();
    }

    /**
     * Supprimer un bot
     */
    async deleteBot(botId) {
        const bot = this.bots.get(botId);
        if (bot) {
            await bot.stop();
            this.bots.delete(botId);
        }

        const botPath = path.join(DATA_PATH, botId);
        if (fs.existsSync(botPath)) {
            fs.rmSync(botPath, { recursive: true, force: true });
        }

        console.log(`🗑️ Deleted bot: ${botId}`);
        return { success: true };
    }

    /**
     * Obtenir un bot
     */
    getBot(botId) {
        return this.bots.get(botId);
    }

    /**
     * Obtenir le QR code d'un bot
     */
    getQRCode(botId) {
        const bot = this.bots.get(botId);
        if (!bot) throw new Error(`Bot ${botId} not found`);
        return bot.getQRCode();
    }

    /**
     * Liste tous les bots (avec option de filtrer par owner)
     */
    listBots(ownerEmail = null) {
        let bots = Array.from(this.bots.values());

        if (ownerEmail) {
            bots = bots.filter(bot => bot.config.ownerEmail === ownerEmail);
        }

        return bots.map(bot => ({
            ...bot.getStatus(),
            ownerEmail: bot.config.ownerEmail || null,
            botType: bot.config.botType || 'invoice',
            // Activation modes
            activateOnReceive: bot.config.activateOnReceive ?? true,
            activateOnSend: bot.config.activateOnSend ?? false,
            receiveFromNumbers: bot.config.receiveFromNumbers || [],
            sendToNumbers: bot.config.sendToNumbers || [],
            // Custom prompt
            customPrompt: bot.config.customPrompt || null,
        }));
    }

    /**
     * Compter les bots d'un owner
     */
    countBotsByOwner(ownerEmail) {
        return Array.from(this.bots.values())
            .filter(bot => bot.config.ownerEmail === ownerEmail)
            .length;
    }

    /**
     * Obtenir la config d'un bot
     */
    getBotConfig(botId) {
        const botPath = path.join(DATA_PATH, botId);
        if (!fs.existsSync(botPath)) throw new Error(`Bot ${botId} not found`);

        return {
            config: JSON.parse(fs.readFileSync(path.join(botPath, 'config.json'), 'utf8')),
            prompt: JSON.parse(fs.readFileSync(path.join(botPath, 'prompt.json'), 'utf8')),
            knowledge: JSON.parse(fs.readFileSync(path.join(botPath, 'knowledge.json'), 'utf8')),
            emails: JSON.parse(fs.readFileSync(path.join(botPath, 'emails.json'), 'utf8')),
        };
    }

    /**
     * Mettre à jour la config d'un bot
     */
    updateBotConfig(botId, updates) {
        const botPath = path.join(DATA_PATH, botId);
        if (!fs.existsSync(botPath)) throw new Error(`Bot ${botId} not found`);

        if (updates.config) {
            const current = JSON.parse(fs.readFileSync(path.join(botPath, 'config.json'), 'utf8'));
            const updated = { ...current, ...updates.config, settings: { ...current.settings, ...updates.config.settings } };
            fs.writeFileSync(path.join(botPath, 'config.json'), JSON.stringify(updated, null, 2));

            // Update running instance
            const bot = this.bots.get(botId);
            if (bot) bot.config = updated;
        }

        if (updates.prompt) {
            fs.writeFileSync(path.join(botPath, 'prompt.json'), JSON.stringify(updates.prompt, null, 2));
        }

        if (updates.knowledge) {
            fs.writeFileSync(path.join(botPath, 'knowledge.json'), JSON.stringify(updates.knowledge, null, 2));
        }

        if (updates.emails) {
            fs.writeFileSync(path.join(botPath, 'emails.json'), JSON.stringify(updates.emails, null, 2));
        }

        return this.getBotConfig(botId);
    }
}

// Singleton
export const botManager = new BotManager();

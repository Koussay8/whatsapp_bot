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
     * Créer un nouveau bot
     */
    async createBot(name, settings = {}) {
        const botId = `bot-${uuidv4().split('-')[0]}`;
        const botPath = path.join(DATA_PATH, botId);

        // Create directories
        fs.mkdirSync(botPath, { recursive: true });
        fs.mkdirSync(path.join(botPath, 'auth'), { recursive: true });
        fs.mkdirSync(path.join(botPath, 'temp'), { recursive: true });
        fs.mkdirSync(path.join(botPath, 'invoices'), { recursive: true });

        // Default config
        const config = {
            id: botId,
            name: name || `Bot ${this.bots.size + 1}`,
            status: 'created',
            enabled: false,
            autoStart: false,
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

        // Default prompt
        const prompt = {
            system: `Tu es un assistant qui aide à créer des factures. 
Tu analyses les messages vocaux pour extraire:
- Nom du client
- Description du service
- Montant en euros

Sois poli et demande les informations manquantes.`,
            createdAt: new Date().toISOString(),
        };

        // Empty knowledge base
        const knowledge = {
            entries: [],
            lastUpdated: null,
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
        fs.writeFileSync(path.join(botPath, 'knowledge.json'), JSON.stringify(knowledge, null, 2));
        fs.writeFileSync(path.join(botPath, 'emails.json'), JSON.stringify(emails, null, 2));

        // Create instance
        const bot = new BotInstance(botId, config, botPath);
        this.bots.set(botId, bot);

        console.log(`✅ Created bot: ${botId}`);
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
     * Arrêter un bot
     */
    async stopBot(botId) {
        const bot = this.bots.get(botId);
        if (!bot) throw new Error(`Bot ${botId} not found`);

        await bot.stop();
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
     * Liste tous les bots
     */
    listBots() {
        return Array.from(this.bots.values()).map(bot => bot.getStatus());
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

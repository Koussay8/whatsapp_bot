/**
 * API Express pour gérer les bots
 */

import express from 'express';
import cors from 'cors';
import { botManager } from '../bot-manager.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Simple auth middleware
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const expectedSecret = process.env.ADMIN_SECRET || 'admin';

    if (authHeader !== `Bearer ${expectedSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// ============================================================
// PUBLIC ROUTES (QR Code scanning)
// ============================================================

/**
 * GET /api/bots/:id/qr - Get QR code for a bot
 */
app.get('/api/bots/:id/qr', async (req, res) => {
    try {
        const qr = botManager.getQRCode(req.params.id);
        if (qr) {
            res.json({ qrCode: qr });
        } else {
            const bot = botManager.getBot(req.params.id);
            if (bot) {
                res.json({ status: bot.status, message: 'No QR code available' });
            } else {
                res.status(404).json({ error: 'Bot not found' });
            }
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/bots/:id/status - Get bot status (public)
 */
app.get('/api/bots/:id/status', async (req, res) => {
    try {
        const bot = botManager.getBot(req.params.id);
        if (bot) {
            res.json(bot.getStatus());
        } else {
            res.status(404).json({ error: 'Bot not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ADMIN ROUTES (Protected)
// ============================================================

/**
 * GET /api/admin/bots - List all bots
 */
app.get('/api/admin/bots', adminAuth, async (req, res) => {
    try {
        const bots = botManager.listBots();
        res.json({ bots });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/bots - Create new bot with options
 */
app.post('/api/admin/bots', adminAuth, async (req, res) => {
    try {
        const { name, settings, options } = req.body;
        // options can include: botType, customPrompt, knowledge, welcomeMessage, language
        const bot = await botManager.createBot(name, settings, options || {});
        res.json(bot);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/bots/:id - Get bot details
 */
app.get('/api/admin/bots/:id', adminAuth, async (req, res) => {
    try {
        const config = botManager.getBotConfig(req.params.id);
        const bot = botManager.getBot(req.params.id);
        res.json({ ...config, status: bot?.getStatus() });
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

/**
 * PUT /api/admin/bots/:id - Update bot config
 */
app.put('/api/admin/bots/:id', adminAuth, async (req, res) => {
    try {
        const updated = botManager.updateBotConfig(req.params.id, req.body);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/admin/bots/:id - Delete bot
 */
app.delete('/api/admin/bots/:id', adminAuth, async (req, res) => {
    try {
        await botManager.deleteBot(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/bots/:id/start - Start bot
 */
app.post('/api/admin/bots/:id/start', adminAuth, async (req, res) => {
    try {
        const status = await botManager.startBot(req.params.id);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/bots/:id/stop - Stop bot
 */
app.post('/api/admin/bots/:id/stop', adminAuth, async (req, res) => {
    try {
        const status = await botManager.stopBot(req.params.id);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/bots/:id/enable - Enable bot
 */
app.post('/api/admin/bots/:id/enable', adminAuth, async (req, res) => {
    try {
        const { enabled } = req.body;
        const status = botManager.setEnabled(req.params.id, enabled);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', bots: botManager.listBots().length });
});

export { app };

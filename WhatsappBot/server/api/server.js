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
 * GET /api/admin/bots - List all bots (or filtered by owner)
 * Headers: X-User-Email = email of current user, X-Is-Admin = true if admin
 */
app.get('/api/admin/bots', adminAuth, async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        const isAdmin = req.headers['x-is-admin'] === 'true';

        // Admin sees all bots, users see only their own
        const bots = isAdmin
            ? botManager.listBots()
            : botManager.listBots(userEmail);

        res.json({ bots });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/bots - Create new bot with options
 * Headers: X-User-Email, X-Is-Admin, X-Bot-Limit (max bots for this user)
 */
app.post('/api/admin/bots', adminAuth, async (req, res) => {
    try {
        const { name, settings, options } = req.body;
        const userEmail = req.headers['x-user-email'];
        const isAdmin = req.headers['x-is-admin'] === 'true';
        const botLimit = parseInt(req.headers['x-bot-limit']) || 1;

        // Check bot limit (admin has no limit)
        if (!isAdmin && userEmail) {
            const currentCount = botManager.countBotsByOwner(userEmail);
            if (currentCount >= botLimit) {
                return res.status(403).json({
                    error: `Limite atteinte: ${botLimit} bot(s) maximum`,
                    code: 'BOT_LIMIT_REACHED'
                });
            }
        }

        // Add ownerEmail to options
        const enrichedOptions = {
            ...(options || {}),
            ownerEmail: userEmail,
        };

        const bot = await botManager.createBot(name, settings, enrichedOptions);
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
 * POST /api/admin/bots/:id/stop - Stop bot (preserves session)
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
 * POST /api/admin/bots/:id/logout - Logout bot (clears session)
 */
app.post('/api/admin/bots/:id/logout', adminAuth, async (req, res) => {
    try {
        const status = await botManager.logoutBot(req.params.id);
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

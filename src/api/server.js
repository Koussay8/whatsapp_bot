/**
 * API Server for WhatsApp Bot
 * Exposes endpoints for the Vercel frontend to get QR codes and status
 */

import express from 'express';
import cors from 'cors';
import { getBotState, setBotEnabled } from '../whatsapp/client.js';

const app = express();
const PORT = process.env.API_PORT || 3001;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin';

// Middleware
app.use(cors());
app.use(express.json());

// Simple auth middleware
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${ADMIN_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// ============================================================
// PUBLIC ROUTES
// ============================================================

/**
 * GET /api/qr - Get current QR code
 */
app.get('/api/qr', (req, res) => {
    const state = getBotState();
    if (state.qrCode) {
        res.json({ qrCode: state.qrCode });
    } else {
        res.json({
            status: state.status,
            message: state.status === 'connected' ? 'Already connected' : 'No QR code available'
        });
    }
});

/**
 * GET /api/status - Get bot status
 */
app.get('/api/status', (req, res) => {
    const state = getBotState();
    res.json({
        id: 'main-bot',
        name: process.env.BOT_NAME || 'WhatsApp Bot',
        status: state.status,
        enabled: state.enabled,
        phoneNumber: state.phoneNumber,
        hasQR: !!state.qrCode,
    });
});

/**
 * GET /health - Health check
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// ============================================================
// ADMIN ROUTES (Protected)
// ============================================================

/**
 * GET /api/admin/bots - List bots (single bot for now)
 */
app.get('/api/admin/bots', adminAuth, (req, res) => {
    const state = getBotState();
    res.json({
        bots: [{
            id: 'main-bot',
            name: process.env.BOT_NAME || 'WhatsApp Bot',
            status: state.status,
            enabled: state.enabled,
            phoneNumber: state.phoneNumber,
            hasQR: !!state.qrCode,
        }]
    });
});

/**
 * GET /api/bots/:id/qr - Get QR code (compatibility with multi-bot API)
 */
app.get('/api/bots/:id/qr', (req, res) => {
    const state = getBotState();
    if (state.qrCode) {
        res.json({ qrCode: state.qrCode });
    } else {
        res.json({
            status: state.status,
            message: 'No QR code available'
        });
    }
});

/**
 * POST /api/admin/bots/:id/enable - Enable/Disable bot
 */
app.post('/api/admin/bots/:id/enable', adminAuth, (req, res) => {
    const { enabled } = req.body;
    setBotEnabled(enabled);
    const state = getBotState();
    res.json({
        id: 'main-bot',
        enabled: state.enabled,
        status: state.status,
    });
});

// Start API server
export function startAPIServer() {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🌐 API Server running on port ${PORT}`);
        console.log(`   GET  /api/qr           - Get QR code`);
        console.log(`   GET  /api/status       - Get bot status`);
        console.log(`   GET  /api/admin/bots   - List bots (auth required)`);
        console.log(`   POST /api/admin/bots/:id/enable - Enable/Disable (auth required)`);
        console.log(`\n🔐 Admin secret: ${ADMIN_SECRET}`);
    });
}

export { app };

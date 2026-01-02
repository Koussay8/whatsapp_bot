/**
 * API Server for WhatsApp Bot (SECURED)
 * - Rate limiting
 * - HMAC signature verification
 * - Request logging
 */

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { getBotState, setBotEnabled } from '../whatsapp/client.js';

const app = express();
const PORT = process.env.API_PORT || 3001;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-me-in-production';

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// Rate limiting (simple in-memory)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute

function rateLimit(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();

    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    } else {
        const data = rateLimitMap.get(ip);
        if (now > data.resetTime) {
            data.count = 1;
            data.resetTime = now + RATE_LIMIT_WINDOW;
        } else {
            data.count++;
            if (data.count > RATE_LIMIT_MAX) {
                console.log(`🚫 Rate limit exceeded: ${ip}`);
                return res.status(429).json({ error: 'Too many requests' });
            }
        }
    }
    next();
}

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of rateLimitMap) {
        if (now > data.resetTime + RATE_LIMIT_WINDOW) {
            rateLimitMap.delete(ip);
        }
    }
}, 5 * 60 * 1000);

// HMAC signature verification
// Header: X-Signature: timestamp:hmac
// HMAC = SHA256(timestamp + path + body, secret)
function verifySignature(req, res, next) {
    const signature = req.headers['x-signature'];

    // Fallback to Bearer token for compatibility
    const authHeader = req.headers.authorization;
    if (authHeader === `Bearer ${ADMIN_SECRET}`) {
        return next();
    }

    if (!signature) {
        return res.status(401).json({ error: 'Missing signature' });
    }

    const [timestamp, hash] = signature.split(':');
    if (!timestamp || !hash) {
        return res.status(401).json({ error: 'Invalid signature format' });
    }

    // Check timestamp (max 5 minutes old)
    const now = Date.now();
    const reqTime = parseInt(timestamp);
    if (isNaN(reqTime) || Math.abs(now - reqTime) > 5 * 60 * 1000) {
        return res.status(401).json({ error: 'Signature expired' });
    }

    // Verify HMAC
    const body = JSON.stringify(req.body) || '';
    const payload = `${timestamp}${req.path}${body}`;
    const expectedHash = crypto
        .createHmac('sha256', ADMIN_SECRET)
        .update(payload)
        .digest('hex');

    if (hash !== expectedHash) {
        return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
}

// Request logging
function logRequest(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} from ${ip}`);
    next();
}

// Middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST'],
}));
app.use(express.json());
app.use(rateLimit);
app.use(logRequest);

// ============================================================
// PUBLIC ROUTES (Rate limited only)
// ============================================================

app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

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

app.get('/api/bots/:id/qr', (req, res) => {
    const state = getBotState();
    if (state.qrCode) {
        res.json({ qrCode: state.qrCode });
    } else {
        res.json({ status: state.status, message: 'No QR code available' });
    }
});

// ============================================================
// ADMIN ROUTES (Signature verified)
// ============================================================

app.get('/api/admin/bots', verifySignature, (req, res) => {
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

app.post('/api/admin/bots/:id/enable', verifySignature, (req, res) => {
    const { enabled } = req.body;
    setBotEnabled(enabled);
    const state = getBotState();
    console.log(`🤖 Bot ${enabled ? 'ENABLED' : 'DISABLED'}`);
    res.json({
        id: 'main-bot',
        enabled: state.enabled,
        status: state.status,
    });
});

// ============================================================
// START SERVER
// ============================================================

export function startAPIServer() {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🌐 API Server (SECURED) on port ${PORT}`);
        console.log(`   Rate limit: ${RATE_LIMIT_MAX} req/min`);
        console.log(`   Auth: HMAC-SHA256 or Bearer token`);
        if (ADMIN_SECRET === 'change-me-in-production') {
            console.log(`\n⚠️  WARNING: Using default ADMIN_SECRET!`);
            console.log(`   Set ADMIN_SECRET in .env for production`);
        }
    });
}

export { app };

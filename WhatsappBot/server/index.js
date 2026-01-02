/**
 * Point d'entrée principal - Multi-Bot WhatsApp Platform
 * 
 * Démarre le bot manager et l'API HTTP
 */

import 'dotenv/config';
import { botManager } from './bot-manager.js';
import { app } from './api/server.js';

const PORT = process.env.PORT || 3001;

console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🤖 MULTI-BOT WHATSAPP PLATFORM                          ║
║                                                            ║
║   Gérez plusieurs bots WhatsApp depuis une seule API      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

async function main() {
    try {
        // Initialize bot manager (loads existing bots)
        await botManager.initialize();

        // Start API server
        app.listen(PORT, () => {
            console.log(`\n🚀 API server running on port ${PORT}`);
            console.log(`\n📋 Endpoints:`);
            console.log(`   GET  /health                    - Health check`);
            console.log(`   GET  /api/bots/:id/qr           - Get QR code (public)`);
            console.log(`   GET  /api/bots/:id/status       - Get status (public)`);
            console.log(`   GET  /api/admin/bots            - List all bots`);
            console.log(`   POST /api/admin/bots            - Create bot`);
            console.log(`   POST /api/admin/bots/:id/start  - Start bot`);
            console.log(`   POST /api/admin/bots/:id/stop   - Stop bot`);
            console.log(`   POST /api/admin/bots/:id/enable - Enable/Disable`);
            console.log(`\n🔐 Admin routes require: Authorization: Bearer ${process.env.ADMIN_SECRET || 'admin'}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Failed to start:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down...');
    // Stop all bots
    for (const bot of botManager.listBots()) {
        try { await botManager.stopBot(bot.id); } catch (e) { }
    }
    process.exit(0);
});

main();

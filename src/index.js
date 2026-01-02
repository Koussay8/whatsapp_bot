/**
 * Bot WhatsApp - Factures Vocales avec Analyse IA Intelligente
 * 
 * Flow:
 * 1. Reçoit message vocal
 * 2. Transcrit (Whisper)
 * 3. IA analyse: cohérence + intention + données
 * 4. Si incomplet: demande infos manquantes
 * 5. Si complet: demande confirmation
 * 6. Si confirmé: génère facture + envoie email
 */

import 'dotenv/config';
import fs from 'fs';
import { createWhatsAppClient, sendWhatsAppMessage, isBotEnabled } from './whatsapp/client.js';
import { transcribeAudio } from './transcription/whisper.js';
import { analyzeTranscription, hasPendingOrder, cancelPendingOrder } from './invoice/parser.js';
import { generateInvoicePDF } from './invoice/generator.js';
import { sendInvoiceEmail, sendConfirmationEmail, verifyEmailConfig, isEmailConfigured } from './email/sender.js';
import { startAPIServer } from './api/server.js';

if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY manquante');
    process.exit(1);
}

console.log(`
╔════════════════════════════════════════════════════════════╗
║   🤖 BOT WHATSAPP FACTURE VOCALE                          ║
║   🎤 Audio → Transcription → Analyse IA → Facture         ║
╚════════════════════════════════════════════════════════════╝
`);

console.log('📋 Configuration:');
console.log(`   Groq: ${process.env.GROQ_API_KEY ? '✅' : '❌'}`);
console.log(`   Email: ${isEmailConfigured() ? '✅' : '❌'}`);

const toEmails = (process.env.EMAIL_TO_DEFAULT || '').split(',').filter(e => e.includes('@'));
console.log(`   Factures → ${toEmails.length > 0 ? toEmails.join(', ') : '(aucun)'}`);
console.log('');

// ============================================================
// HANDLER AUDIO (MESSAGE VOCAL)
// ============================================================

async function handleAudio({ sender, senderNumber, audioPath, socket }) {
    console.log('\n' + '═'.repeat(60));
    console.log(`🎤 MESSAGE VOCAL de: ${senderNumber}`);
    console.log('═'.repeat(60));

    try {
        // 1. Transcription
        console.log('📝 Transcription...');
        const transcription = await transcribeAudio(audioPath);

        if (!transcription || transcription.trim().length < 2) {
            await sendWhatsAppMessage(socket, sender,
                '⚠️ Je n\'ai pas compris. Parlez plus clairement.');
            return;
        }

        const cleanTranscription = transcription.trim();
        console.log(`✅ Transcription: "${cleanTranscription}"`);

        // 2. Analyse IA
        const result = await analyzeTranscription(senderNumber, cleanTranscription);

        // 3. Envoyer réponse avec transcription + message IA
        let response = `📝 *Transcription:*\n"${cleanTranscription}"`;

        if (result.aiMessage) {
            response += `\n\n${result.aiMessage}`;
        }

        await sendWhatsAppMessage(socket, sender, response);

        // 4. Si confirmé, générer la facture
        if (result.status === 'confirmed') {
            await generateAndSendInvoice(socket, sender, senderNumber, result.data, cleanTranscription);
        }

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        await sendWhatsAppMessage(socket, sender, `❌ Erreur: ${error.message}`);
    } finally {
        try { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch (e) { }
    }
}

// ============================================================
// HANDLER TEXTE
// ============================================================

async function handleText({ sender, senderNumber, text, socket, isFromMe }) {
    console.log(`\n💬 TEXTE de: ${senderNumber}: "${text}"`);

    const lower = text.toLowerCase().trim();

    // Commandes
    if (lower === 'aide' || lower === 'help' || lower === '?') {
        await sendWhatsAppMessage(socket, sender,
            `🤖 *Bot Facture - Aide*\n\n` +
            `Envoyez un *message vocal* avec:\n` +
            `"Facture pour [client], [service], [montant] euros"\n\n` +
            `Je vous demanderai les infos manquantes.\n\n` +
            `• "annuler" - Annuler en cours\n` +
            `• "bot on/off" - Activer/Désactiver`
        );
        return;
    }

    if (lower === 'annuler' || lower === 'cancel') {
        if (hasPendingOrder(senderNumber)) {
            cancelPendingOrder(senderNumber);
            await sendWhatsAppMessage(socket, sender, '❌ Commande annulée.');
        } else {
            await sendWhatsAppMessage(socket, sender, 'ℹ️ Aucune commande en cours.');
        }
        return;
    }

    // Si commande en cours, analyser comme réponse
    if (hasPendingOrder(senderNumber)) {
        const result = await analyzeTranscription(senderNumber, text);

        if (result.aiMessage) {
            await sendWhatsAppMessage(socket, sender, result.aiMessage);
        }

        if (result.status === 'confirmed') {
            await generateAndSendInvoice(socket, sender, senderNumber, result.data, text);
        }
        return;
    }

    // Message normal
    await sendWhatsAppMessage(socket, sender,
        `💬 Message reçu.\n\n💡 Envoyez un *message vocal* pour créer une facture.`
    );
}

// ============================================================
// GÉNÉRATION FACTURE
// ============================================================

async function generateAndSendInvoice(socket, sender, senderNumber, data, transcription) {
    console.log('\n📄 GÉNÉRATION FACTURE...');

    await sendWhatsAppMessage(socket, sender, '📄 Génération de la facture...');

    try {
        const { filepath, invoiceNumber, totalTTC } = await generateInvoicePDF(data);

        const formattedAmount = new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
        }).format(totalTTC);

        // Envoyer par email
        let emailStatus = '';

        if (isEmailConfigured()) {
            try {
                const invoiceResult = await sendInvoiceEmail({
                    invoiceNumber,
                    pdfPath: filepath,
                    clientName: data.clientName,
                    totalTTC,
                    description: data.description,
                });

                if (invoiceResult.success) {
                    emailStatus = `\n📧 Envoyée à: ${invoiceResult.recipients.join(', ')}`;
                } else {
                    emailStatus = '\n📧 Aucun destinataire configuré';
                }
            } catch (error) {
                emailStatus = `\n❌ Erreur email: ${error.message}`;
            }

            // Confirmation
            try {
                await sendConfirmationEmail({
                    invoiceNumber,
                    pdfPath: filepath,
                    clientName: data.clientName,
                    totalTTC,
                    description: data.description,
                    transcription,
                });
            } catch (e) { }
        }

        await sendWhatsAppMessage(socket, sender,
            `🎉 *Facture créée!*\n\n` +
            `📄 N°: *${invoiceNumber}*\n` +
            `👤 ${data.clientName}\n` +
            `📝 ${data.description}\n` +
            `💰 *${formattedAmount}*` +
            emailStatus
        );

        console.log('✅ Facture envoyée!');

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        await sendWhatsAppMessage(socket, sender, `❌ Erreur: ${error.message}`);
    }
}

// ============================================================
// AUTRES HANDLERS
// ============================================================

async function handleUnsupported({ sender, type, socket }) {
    await sendWhatsAppMessage(socket, sender,
        `📨 Message reçu (${type}).\n\n💡 Envoyez un *message vocal* pour une facture.`
    );
}

async function handleError({ sender, socket }) {
    try { await sendWhatsAppMessage(socket, sender, '❌ Erreur.'); } catch (e) { }
}

// ============================================================
// DÉMARRAGE
// ============================================================

async function main() {
    if (isEmailConfigured()) await verifyEmailConfig();

    // Start API server for external access (Vercel)
    startAPIServer();

    console.log('📱 Démarrage WhatsApp...\n');

    try {
        await createWhatsAppClient({
            onAudio: handleAudio,
            onText: handleText,
            onUnsupported: handleUnsupported,
            onError: handleError,
        });
    } catch (error) {
        console.error('❌ Erreur fatale:', error.message);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    console.log('\n👋 Arrêt...');
    process.exit(0);
});

main();

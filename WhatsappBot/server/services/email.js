/**
 * Service d'envoi d'emails avec Nodemailer
 */

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

/**
 * Envoie les emails (facture + confirmation)
 */
export async function sendEmails({ invoiceNumber, pdfPath, data, transcription, config }) {
    const settings = config.settings || {};

    if (!settings.emailUser || !settings.emailPassword) {
        console.log('📧 Email not configured');
        return { invoiceSent: false, confirmationSent: false };
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: settings.emailUser,
            pass: settings.emailPassword,
        },
    });

    const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
        .format(data.amount * 1.2);

    // Load email templates
    const botPath = path.dirname(path.dirname(pdfPath));
    let templates = { invoice: {}, confirmation: {} };
    try {
        templates = JSON.parse(fs.readFileSync(path.join(botPath, 'emails.json'), 'utf8'));
    } catch (e) { }

    const replacePlaceholders = (text) => {
        return text
            .replace(/{invoiceNumber}/g, invoiceNumber)
            .replace(/{clientName}/g, data.clientName)
            .replace(/{amount}/g, amount)
            .replace(/{description}/g, data.description || '');
    };

    let invoiceSent = false;
    let confirmationSent = false;

    // Send invoice email
    const recipients = settings.emailRecipients || [];
    if (recipients.length > 0) {
        try {
            await transporter.sendMail({
                from: `"${settings.companyName}" <${settings.emailUser}>`,
                to: recipients.join(', '),
                subject: replacePlaceholders(templates.invoice?.subject || `Facture ${invoiceNumber}`),
                html: replacePlaceholders(templates.invoice?.html || `<p>Facture ${invoiceNumber} ci-jointe.</p>`),
                attachments: [{ filename: `${invoiceNumber}.pdf`, path: pdfPath }],
            });
            invoiceSent = true;
            console.log(`📧 Invoice sent to ${recipients.join(', ')}`);
        } catch (e) {
            console.error('❌ Invoice email error:', e.message);
        }
    }

    // Send confirmation email
    const confirmRecipients = settings.confirmationRecipients || [];
    if (confirmRecipients.length > 0) {
        try {
            await transporter.sendMail({
                from: `"${settings.companyName} Bot" <${settings.emailUser}>`,
                to: confirmRecipients.join(', '),
                subject: replacePlaceholders(templates.confirmation?.subject || `Confirmation ${invoiceNumber}`),
                html: replacePlaceholders(templates.confirmation?.html || `<p>Facture ${invoiceNumber} créée.</p>`),
                attachments: [{ filename: `${invoiceNumber}.pdf`, path: pdfPath }],
            });
            confirmationSent = true;
            console.log(`📧 Confirmation sent to ${confirmRecipients.join(', ')}`);
        } catch (e) {
            console.error('❌ Confirmation email error:', e.message);
        }
    }

    return { invoiceSent, confirmationSent };
}

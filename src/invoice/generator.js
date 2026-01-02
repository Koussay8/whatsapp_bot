/**
 * Générateur de factures PDF
 * Utilise pdfkit pour créer des factures professionnelles
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const INVOICES_FOLDER = './invoices';

// Créer le dossier des factures
if (!fs.existsSync(INVOICES_FOLDER)) {
    fs.mkdirSync(INVOICES_FOLDER, { recursive: true });
}

/**
 * Génère un numéro de facture unique
 */
function generateInvoiceNumber() {
    const prefix = process.env.INVOICE_PREFIX || 'FAC-';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}${year}${month}-${random}`;
}

/**
 * Formate un montant en euros
 */
function formatMoney(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
    }).format(amount);
}

/**
 * Formate une date en français
 */
function formatDate(date) {
    return new Intl.DateTimeFormat('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(date);
}

/**
 * Génère une facture PDF
 * @param {Object} invoiceData - Données de la facture
 * @returns {Promise<{filepath: string, invoiceNumber: string}>}
 */
export async function generateInvoicePDF(invoiceData) {
    return new Promise((resolve, reject) => {
        try {
            const invoiceNumber = generateInvoiceNumber();
            const filename = `${invoiceNumber}.pdf`;
            const filepath = path.join(INVOICES_FOLDER, filename);

            console.log(`📄 Génération de la facture ${invoiceNumber}...`);

            const doc = new PDFDocument({ margin: 50 });
            const stream = fs.createWriteStream(filepath);
            doc.pipe(stream);

            // === EN-TÊTE ===
            doc
                .fontSize(24)
                .fillColor('#2563eb')
                .text(process.env.COMPANY_NAME || 'Entreprise', 50, 50);

            doc
                .fontSize(10)
                .fillColor('#666')
                .text(process.env.COMPANY_ADDRESS || '', 50, 80)
                .text(`Email: ${process.env.COMPANY_EMAIL || ''}`, 50, 95)
                .text(`Tél: ${process.env.COMPANY_PHONE || ''}`, 50, 110)
                .text(`SIRET: ${process.env.COMPANY_SIRET || ''}`, 50, 125)
                .text(`TVA: ${process.env.COMPANY_TVA || ''}`, 50, 140);

            // === TITRE FACTURE ===
            doc
                .fontSize(28)
                .fillColor('#1f2937')
                .text('FACTURE', 400, 50, { align: 'right' });

            doc
                .fontSize(12)
                .fillColor('#666')
                .text(`N° ${invoiceNumber}`, 400, 85, { align: 'right' })
                .text(`Date: ${formatDate(new Date())}`, 400, 102, { align: 'right' });

            // === CLIENT ===
            doc
                .fontSize(12)
                .fillColor('#1f2937')
                .text('FACTURÉ À:', 50, 180);

            doc
                .fontSize(11)
                .fillColor('#374151')
                .text(invoiceData.clientName || 'Client', 50, 200);

            if (invoiceData.clientAddress) {
                doc.text(invoiceData.clientAddress, 50, 215);
            }
            if (invoiceData.clientEmail) {
                doc.text(invoiceData.clientEmail, 50, invoiceData.clientAddress ? 230 : 215);
            }

            // === TABLEAU DES PRESTATIONS ===
            const tableTop = 280;
            const tableLeft = 50;
            const colWidths = [280, 60, 90, 90];

            // En-tête du tableau
            doc
                .fillColor('#2563eb')
                .rect(tableLeft, tableTop, 520, 25)
                .fill();

            doc
                .fontSize(10)
                .fillColor('#fff')
                .text('DESCRIPTION', tableLeft + 10, tableTop + 8)
                .text('QTÉ', tableLeft + colWidths[0] + 10, tableTop + 8)
                .text('PRIX UNIT. HT', tableLeft + colWidths[0] + colWidths[1] + 5, tableTop + 8)
                .text('TOTAL HT', tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5, tableTop + 8);

            // Ligne de prestation
            const rowTop = tableTop + 30;
            const unitPrice = invoiceData.amount;
            const quantity = invoiceData.quantity || 1;
            const totalHT = unitPrice * quantity;
            const tvaRate = invoiceData.tva || 20;
            const tvaAmount = totalHT * (tvaRate / 100);
            const totalTTC = totalHT + tvaAmount;

            doc
                .fillColor('#f9fafb')
                .rect(tableLeft, rowTop, 520, 30)
                .fill();

            doc
                .fontSize(10)
                .fillColor('#374151')
                .text(invoiceData.description || 'Prestation', tableLeft + 10, rowTop + 10, { width: colWidths[0] - 20 })
                .text(quantity.toString(), tableLeft + colWidths[0] + 10, rowTop + 10)
                .text(formatMoney(unitPrice), tableLeft + colWidths[0] + colWidths[1] + 5, rowTop + 10)
                .text(formatMoney(totalHT), tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5, rowTop + 10);

            // === TOTAUX ===
            const totalsTop = rowTop + 60;
            const totalsLeft = 380;

            doc
                .fontSize(11)
                .fillColor('#374151')
                .text('Total HT:', totalsLeft, totalsTop)
                .text(formatMoney(totalHT), totalsLeft + 100, totalsTop, { align: 'right' });

            doc
                .text(`TVA (${tvaRate}%):`, totalsLeft, totalsTop + 20)
                .text(formatMoney(tvaAmount), totalsLeft + 100, totalsTop + 20, { align: 'right' });

            doc
                .fontSize(14)
                .fillColor('#2563eb')
                .text('TOTAL TTC:', totalsLeft, totalsTop + 45)
                .text(formatMoney(totalTTC), totalsLeft + 100, totalsTop + 45, { align: 'right' });

            // === NOTES ===
            if (invoiceData.notes) {
                doc
                    .fontSize(10)
                    .fillColor('#666')
                    .text('Notes:', 50, totalsTop + 100)
                    .text(invoiceData.notes, 50, totalsTop + 115, { width: 300 });
            }

            // === PIED DE PAGE ===
            doc
                .fontSize(9)
                .fillColor('#9ca3af')
                .text(
                    'Facture générée automatiquement - Merci pour votre confiance!',
                    50,
                    750,
                    { align: 'center', width: 520 }
                );

            // Finaliser
            doc.end();

            stream.on('finish', () => {
                console.log(`✅ Facture générée: ${filepath}`);
                resolve({ filepath, invoiceNumber, totalTTC });
            });

            stream.on('error', reject);

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Service de génération de factures PDF
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Génère une facture PDF
 */
export async function generateInvoicePDF(data, outputDir, config) {
    const settings = config.settings || {};
    const prefix = settings.invoicePrefix || 'FAC-';
    const invoiceNumber = `${prefix}${Date.now().toString().slice(-8)}`;

    const filepath = path.join(outputDir, `${invoiceNumber}.pdf`);

    const tva = data.tva || 20;
    const totalHT = data.amount * (data.quantity || 1);
    const totalTVA = totalHT * (tva / 100);
    const totalTTC = totalHT + totalTVA;

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // Header
    doc.fontSize(24).fillColor('#2563eb').text(settings.companyName || 'Entreprise', 50, 50);
    doc.fontSize(10).fillColor('#666').text(settings.companyEmail || '', 50, 80);

    // Invoice title
    doc.fontSize(28).fillColor('#000').text('FACTURE', 400, 50, { align: 'right' });
    doc.fontSize(12).fillColor('#666').text(invoiceNumber, 400, 85, { align: 'right' });
    doc.text(new Date().toLocaleDateString('fr-FR'), 400, 100, { align: 'right' });

    // Client
    doc.fontSize(12).fillColor('#000');
    doc.text('Facturé à:', 50, 150);
    doc.fontSize(14).text(data.clientName || 'Client', 50, 170);
    if (data.clientEmail) {
        doc.fontSize(10).fillColor('#666').text(data.clientEmail, 50, 190);
    }

    // Table header
    const tableTop = 250;
    doc.fillColor('#f3f4f6').rect(50, tableTop, 500, 25).fill();
    doc.fillColor('#000').fontSize(10);
    doc.text('Description', 60, tableTop + 8);
    doc.text('Qté', 350, tableTop + 8);
    doc.text('Prix HT', 400, tableTop + 8);
    doc.text('Total', 480, tableTop + 8);

    // Table row
    doc.text(data.description || 'Service', 60, tableTop + 35);
    doc.text(String(data.quantity || 1), 350, tableTop + 35);
    doc.text(formatCurrency(data.amount), 400, tableTop + 35);
    doc.text(formatCurrency(totalHT), 480, tableTop + 35);

    // Totals
    const totalsY = tableTop + 80;
    doc.text('Sous-total HT:', 380, totalsY);
    doc.text(formatCurrency(totalHT), 480, totalsY);
    doc.text(`TVA (${tva}%):`, 380, totalsY + 20);
    doc.text(formatCurrency(totalTVA), 480, totalsY + 20);

    doc.fontSize(14).fillColor('#2563eb');
    doc.text('Total TTC:', 380, totalsY + 45);
    doc.text(formatCurrency(totalTTC), 480, totalsY + 45);

    // Footer
    doc.fontSize(8).fillColor('#999');
    doc.text('Facture générée automatiquement par Bot WhatsApp', 50, 750, { align: 'center' });

    doc.end();

    await new Promise(resolve => stream.on('finish', resolve));

    console.log(`📄 Invoice generated: ${invoiceNumber}`);

    return { filepath, invoiceNumber, totalHT, totalTVA, totalTTC };
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

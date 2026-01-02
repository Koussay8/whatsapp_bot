/**
 * Envoi d'emails avec Nodemailer
 * Supporte les listes d'emails
 */

import nodemailer from 'nodemailer';

// Configuration du transporteur Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

/**
 * Parse une liste d'emails depuis une string
 * @param {string} emailString - Emails séparés par des virgules
 * @returns {string[]} - Liste d'emails valides
 */
function parseEmailList(emailString) {
  if (!emailString || emailString.trim() === '') return [];

  return emailString
    .split(',')
    .map(email => email.trim())
    .filter(email => email && email.includes('@'));
}

/**
 * Envoie une facture par email à plusieurs destinataires
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export async function sendInvoiceEmail({ invoiceNumber, pdfPath, clientName, totalTTC, description }) {
  const recipients = parseEmailList(process.env.EMAIL_TO_DEFAULT);

  if (recipients.length === 0) {
    console.log('📧 Aucun destinataire configuré pour les factures (EMAIL_TO_DEFAULT vide)');
    return { success: false, reason: 'no_recipients' };
  }

  console.log(`📧 Envoi de la facture ${invoiceNumber} à: ${recipients.join(', ')}`);

  const companyName = process.env.COMPANY_NAME || 'Entreprise';
  const companyEmail = process.env.COMPANY_EMAIL || process.env.EMAIL_USER;

  const formattedAmount = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(totalTTC);

  const mailOptions = {
    from: `"${companyName}" <${process.env.EMAIL_USER}>`,
    to: recipients.join(', '),
    subject: `Facture ${invoiceNumber} - ${clientName}`,
    text: `
Nouvelle facture générée

Facture N°: ${invoiceNumber}
Client: ${clientName}
Description: ${description}
Montant TTC: ${formattedAmount}

Veuillez trouver la facture en pièce jointe.

Cordialement,
${companyName}
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .invoice-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
    .amount { font-size: 24px; color: #2563eb; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">${companyName}</h1>
      <p style="margin: 10px 0 0 0;">Nouvelle Facture</p>
    </div>
    <div class="content">
      <div class="invoice-box">
        <p><strong>Facture N°:</strong> ${invoiceNumber}</p>
        <p><strong>Client:</strong> ${clientName}</p>
        <p><strong>Description:</strong> ${description}</p>
        <p class="amount">Montant TTC: ${formattedAmount}</p>
      </div>
      <p>La facture est en pièce jointe.</p>
      <p>Cordialement,<br><strong>${companyName}</strong></p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    attachments: [
      {
        filename: `${invoiceNumber}.pdf`,
        path: pdfPath,
        contentType: 'application/pdf',
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Facture envoyée! Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId, recipients };
  } catch (error) {
    console.error('❌ Erreur envoi facture:', error.message);
    throw error;
  }
}

/**
 * Envoie un email de confirmation au demandeur
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export async function sendConfirmationEmail({ invoiceNumber, pdfPath, clientName, totalTTC, description, transcription }) {
  const recipients = parseEmailList(process.env.EMAIL_CONFIRMATION_DEFAULT);

  if (recipients.length === 0) {
    console.log('📧 Aucun destinataire configuré pour les confirmations (EMAIL_CONFIRMATION_DEFAULT vide)');
    return { success: false, reason: 'no_recipients' };
  }

  console.log(`📧 Envoi de confirmation à: ${recipients.join(', ')}`);

  const companyName = process.env.COMPANY_NAME || 'Entreprise';

  const formattedAmount = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(totalTTC);

  const invoiceRecipients = parseEmailList(process.env.EMAIL_TO_DEFAULT);
  const recipientsList = invoiceRecipients.length > 0
    ? invoiceRecipients.join(', ')
    : 'Aucun destinataire configuré';

  const mailOptions = {
    from: `"${companyName} Bot" <${process.env.EMAIL_USER}>`,
    to: recipients.join(', '),
    subject: `✅ Confirmation - Facture ${invoiceNumber} créée`,
    text: `
Votre demande de facture a été traitée avec succès!

=== DÉTAILS DE LA FACTURE ===
Numéro: ${invoiceNumber}
Client: ${clientName}
Description: ${description}
Montant TTC: ${formattedAmount}

=== MESSAGE VOCAL TRANSCRIT ===
"${transcription}"

=== ENVOYÉE À ===
${recipientsList}

La facture est également en pièce jointe de cet email.

---
Bot WhatsApp ${companyName}
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; }
    .success { border-left: 4px solid #10b981; }
    .transcription { border-left: 4px solid #6366f1; font-style: italic; }
    .amount { font-size: 20px; color: #10b981; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">✅ Facture Créée</h1>
      <p style="margin: 10px 0 0 0;">Votre demande a été traitée</p>
    </div>
    <div class="content">
      <div class="box success">
        <h3 style="margin-top: 0;">Détails de la facture</h3>
        <p><strong>N°:</strong> ${invoiceNumber}</p>
        <p><strong>Client:</strong> ${clientName}</p>
        <p><strong>Description:</strong> ${description}</p>
        <p class="amount">Montant TTC: ${formattedAmount}</p>
      </div>
      
      <div class="box transcription">
        <h3 style="margin-top: 0;">📝 Message vocal transcrit</h3>
        <p>"${transcription}"</p>
      </div>
      
      <div class="box">
        <h3 style="margin-top: 0;">📧 Envoyée à</h3>
        <p>${recipientsList}</p>
      </div>
      
      <p style="color: #666; font-size: 12px;">
        La facture PDF est en pièce jointe.<br>
        Bot WhatsApp ${companyName}
      </p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    attachments: [
      {
        filename: `${invoiceNumber}.pdf`,
        path: pdfPath,
        contentType: 'application/pdf',
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Confirmation envoyée! Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId, recipients };
  } catch (error) {
    console.error('❌ Erreur envoi confirmation:', error.message);
    throw error;
  }
}

/**
 * Vérifie la configuration email
 */
export async function verifyEmailConfig() {
  try {
    await transporter.verify();
    console.log('✅ Configuration email valide');
    return true;
  } catch (error) {
    console.error('❌ Configuration email invalide:', error.message);
    return false;
  }
}

/**
 * Vérifie si l'envoi d'emails est configuré
 */
export function isEmailConfigured() {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD);
}

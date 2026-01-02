/**
 * Analyseur Intelligent de Commandes de Facture
 * - Détecte les transcriptions incohérentes ou mal comprises
 * - Collecte progressivement les informations manquantes
 * - Demande confirmation avant génération
 */

import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// Stockage des conversations en cours
const pendingOrders = new Map();

/**
 * Analyse la qualité et cohérence d'une transcription
 * Retourne: { isValid, isComplete, data, aiMessage }
 */
export async function analyzeTranscription(senderNumber, transcription) {
    console.log('🧠 Analyse IA de la transcription...');

    const existingOrder = pendingOrders.get(senderNumber);

    // Vérifier si c'est une confirmation
    if (existingOrder?.status === 'pending_confirmation') {
        const lower = transcription.toLowerCase().trim();
        if (['oui', 'ok', 'yes', 'confirmer', 'valider', "c'est bon", 'parfait'].some(w => lower.includes(w))) {
            pendingOrders.delete(senderNumber);
            return { status: 'confirmed', data: existingOrder.data, aiMessage: null };
        }
        if (['non', 'no', 'annuler', 'cancel', 'stop'].some(w => lower.includes(w))) {
            pendingOrders.delete(senderNumber);
            return { status: 'cancelled', data: null, aiMessage: '❌ Commande annulée. Vous pouvez recommencer.' };
        }
        // Sinon c'est une correction, on continue l'analyse
    }

    const existingContext = existingOrder?.data ? `
Informations déjà collectées:
- Client: ${existingOrder.data.clientName || 'Non spécifié'}
- Description: ${existingOrder.data.description || 'Non spécifié'}  
- Montant: ${existingOrder.data.amount || 'Non spécifié'}
` : '';

    const prompt = `Tu es un assistant intelligent qui analyse des transcriptions de messages vocaux pour créer des factures.

TRANSCRIPTION À ANALYSER:
"${transcription}"

${existingContext}

ANALYSE EN 3 ÉTAPES:

1. QUALITÉ DE LA TRANSCRIPTION
- Est-ce que le texte est cohérent linguistiquement ?
- Est-ce qu'il y a un sens logique ou c'est du charabia (mots aléatoires, sons mal transcrits) ?
- Score de cohérence: 0-100

2. INTENTION DE COMMANDE
- Est-ce que la personne essaie de commander une facture/devis ?
- Ou c'est un message sans rapport (salutation, question, test) ?

3. EXTRACTION DES DONNÉES (si pertinent)
- clientName: Nom du client (null si absent)
- description: Description du service (null si absent)
- amount: Montant en euros (0 si absent)
- clientEmail: Email si mentionné (null sinon)

RÉPONDS EN JSON STRICT:
{
  "coherenceScore": <0-100>,
  "isGibberish": <true si mots incohérents/mal transcrits>,
  "isInvoiceIntent": <true si c'est une demande de facture>,
  "missingFields": ["liste des champs manquants si invoice"],
  "data": {
    "clientName": <string ou null>,
    "description": <string ou null>,
    "amount": <number ou 0>,
    "clientEmail": <string ou null>
  },
  "aiQuestion": "<question à poser à l'utilisateur si infos manquantes ou problème>"
}`;

    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 800,
        });

        const response = completion.choices[0]?.message?.content || '{}';
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const analysis = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

        console.log('📊 Analyse:', JSON.stringify(analysis, null, 2));

        // Cas 1: Transcription incohérente (charabia)
        if (analysis.isGibberish || analysis.coherenceScore < 40) {
            return {
                status: 'invalid',
                data: null,
                aiMessage:
                    `⚠️ *Message mal compris*\n\n` +
                    `Je n'ai pas bien compris votre message. ` +
                    `Pouvez-vous répéter plus clairement ?\n\n` +
                    `💡 Exemple: "Facture pour Jean Dupont, création site web, 1500 euros"`
            };
        }

        // Cas 2: Pas une demande de facture
        if (!analysis.isInvoiceIntent && !existingOrder) {
            return {
                status: 'not_invoice',
                data: null,
                aiMessage:
                    `💬 J'ai bien reçu votre message.\n\n` +
                    `Pour créer une facture, dites-moi:\n` +
                    `• Le nom du client\n` +
                    `• La description du service\n` +
                    `• Le montant en euros`
            };
        }

        // Merger avec données existantes
        const mergedData = {
            clientName: analysis.data?.clientName || existingOrder?.data?.clientName || null,
            description: analysis.data?.description || existingOrder?.data?.description || null,
            amount: (analysis.data?.amount > 0 ? analysis.data.amount : null) || existingOrder?.data?.amount || null,
            clientEmail: analysis.data?.clientEmail || existingOrder?.data?.clientEmail || null,
            quantity: 1,
            tva: 20,
        };

        // Vérifier si complet
        const missing = [];
        if (!mergedData.clientName) missing.push('👤 Nom du client');
        if (!mergedData.description) missing.push('📝 Description du service');
        if (!mergedData.amount) missing.push('💰 Montant en euros');

        // Cas 3: Informations manquantes
        if (missing.length > 0) {
            pendingOrders.set(senderNumber, { status: 'incomplete', data: mergedData });

            return {
                status: 'incomplete',
                data: mergedData,
                aiMessage:
                    `📝 *Informations reçues, mais incomplètes.*\n\n` +
                    `Il me manque:\n${missing.join('\n')}\n\n` +
                    `💡 Envoyez un autre message vocal avec les informations manquantes.`
            };
        }

        // Cas 4: Complet - demander confirmation
        const formattedAmount = new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
        }).format(mergedData.amount * (1 + mergedData.tva / 100));

        pendingOrders.set(senderNumber, { status: 'pending_confirmation', data: mergedData });

        return {
            status: 'pending_confirmation',
            data: mergedData,
            aiMessage:
                `✅ *Récapitulatif de la facture:*\n\n` +
                `👤 Client: *${mergedData.clientName}*\n` +
                `📝 Service: ${mergedData.description}\n` +
                `💰 Total TTC: *${formattedAmount}*\n` +
                (mergedData.clientEmail ? `📧 Email: ${mergedData.clientEmail}\n` : '') +
                `\n✅ Répondez *"oui"* pour générer la facture\n` +
                `❌ Répondez *"non"* pour annuler`
        };

    } catch (error) {
        console.error('❌ Erreur analyse:', error.message);
        return {
            status: 'error',
            data: null,
            aiMessage: `❌ Erreur d'analyse. Réessayez.`
        };
    }
}

/**
 * Vérifie si une commande est en cours
 */
export function hasPendingOrder(senderNumber) {
    return pendingOrders.has(senderNumber);
}

/**
 * Annule une commande en cours
 */
export function cancelPendingOrder(senderNumber) {
    pendingOrders.delete(senderNumber);
}

// Export legacy pour compatibilité
export { analyzeTranscription as processInvoiceRequest };

/**
 * Service d'analyse IA des messages pour extraction de factures
 */

import Groq from 'groq-sdk';

/**
 * Analyse un message pour extraire les données de facture
 */
export async function analyzeMessage(text, existingData, config) {
    const groq = new Groq({ apiKey: config.settings?.groqApiKey || process.env.GROQ_API_KEY_DEFAULT });

    // Check for confirmation/cancellation
    const lower = text.toLowerCase().trim();
    if (existingData) {
        if (['oui', 'ok', 'yes', 'confirmer', 'valider'].some(w => lower.includes(w))) {
            return { status: 'confirmed', data: existingData, aiMessage: null };
        }
        if (['non', 'annuler', 'cancel'].some(w => lower.includes(w))) {
            return { status: 'cancelled', data: null, aiMessage: '❌ Commande annulée.' };
        }
    }

    const existingContext = existingData ? `
Données existantes:
- Client: ${existingData.clientName || 'Non spécifié'}
- Description: ${existingData.description || 'Non spécifié'}
- Montant: ${existingData.amount || 'Non spécifié'}
` : '';

    const prompt = `Analyse ce message pour créer une facture.

${existingContext}

Message: "${text}"

Réponds en JSON:
{
  "coherenceScore": 0-100,
  "isInvoiceIntent": true/false,
  "data": {
    "clientName": string ou null,
    "description": string ou null,
    "amount": number ou 0,
    "clientEmail": string ou null
  },
  "aiQuestion": "question si infos manquantes"
}`;

    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 500,
        });

        const response = completion.choices[0]?.message?.content || '{}';
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const analysis = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

        // Low coherence
        if (analysis.coherenceScore < 40) {
            return {
                status: 'invalid',
                data: null,
                aiMessage: '⚠️ Message mal compris. Parlez plus clairement.',
            };
        }

        // Not invoice intent and no existing data
        if (!analysis.isInvoiceIntent && !existingData) {
            return {
                status: 'not_invoice',
                data: null,
                aiMessage: '💬 Message reçu. Envoyez un message vocal avec client, service et montant.',
            };
        }

        // Merge data
        const mergedData = {
            clientName: analysis.data?.clientName || existingData?.clientName || null,
            description: analysis.data?.description || existingData?.description || null,
            amount: (analysis.data?.amount > 0 ? analysis.data.amount : null) || existingData?.amount || null,
            clientEmail: analysis.data?.clientEmail || existingData?.clientEmail || null,
            quantity: 1,
            tva: 20,
        };

        // Check completeness
        const missing = [];
        if (!mergedData.clientName) missing.push('👤 Nom du client');
        if (!mergedData.description) missing.push('📝 Description');
        if (!mergedData.amount) missing.push('💰 Montant');

        if (missing.length > 0) {
            return {
                status: 'incomplete',
                data: mergedData,
                aiMessage: `📝 *Il me manque:*\n${missing.join('\n')}\n\n💡 Envoyez les infos manquantes.`,
            };
        }

        // Complete - ask confirmation
        const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
            .format(mergedData.amount * 1.2);

        return {
            status: 'pending_confirmation',
            data: mergedData,
            aiMessage: `✅ *Récapitulatif:*\n👤 ${mergedData.clientName}\n📝 ${mergedData.description}\n💰 *${amount}*\n\nRépondez *"oui"* pour confirmer.`,
        };

    } catch (error) {
        console.error('AI analysis error:', error.message);
        return {
            status: 'error',
            data: null,
            aiMessage: '❌ Erreur d\'analyse. Réessayez.',
        };
    }
}

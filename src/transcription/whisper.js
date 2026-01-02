/**
 * Transcription audio avec Groq Whisper API
 * Utilise le modèle whisper-large-v3-turbo (gratuit)
 */

import Groq from 'groq-sdk';
import fs from 'fs';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

/**
 * Transcrit un fichier audio en texte
 * @param {string} audioPath - Chemin vers le fichier audio
 * @returns {Promise<string>} - Texte transcrit
 */
export async function transcribeAudio(audioPath) {
    try {
        console.log('🔄 Transcription en cours...');

        const audioFile = fs.createReadStream(audioPath);

        const transcription = await groq.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-large-v3-turbo', // Modèle gratuit et rapide
            language: 'fr', // Français
            response_format: 'text',
        });

        console.log('✅ Transcription terminée');
        console.log(`📝 Texte: "${transcription}"`);

        return transcription;
    } catch (error) {
        console.error('❌ Erreur transcription:', error.message);
        throw new Error(`Erreur de transcription: ${error.message}`);
    }
}

/**
 * Transcrit un buffer audio directement
 * @param {Buffer} audioBuffer - Buffer audio
 * @param {string} filename - Nom du fichier (pour l'extension)
 * @returns {Promise<string>} - Texte transcrit
 */
export async function transcribeBuffer(audioBuffer, filename = 'audio.ogg') {
    try {
        console.log('🔄 Transcription du buffer...');

        // Créer un "file-like" object pour l'API
        const file = new File([audioBuffer], filename, { type: 'audio/ogg' });

        const transcription = await groq.audio.transcriptions.create({
            file,
            model: 'whisper-large-v3-turbo',
            language: 'fr',
            response_format: 'text',
        });

        console.log('✅ Transcription terminée');
        return transcription;
    } catch (error) {
        console.error('❌ Erreur transcription buffer:', error.message);
        throw error;
    }
}

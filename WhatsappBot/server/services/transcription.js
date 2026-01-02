/**
 * Service de transcription audio avec Groq Whisper
 */

import Groq from 'groq-sdk';
import fs from 'fs';

/**
 * Transcrit un fichier audio en texte
 */
export async function transcribeAudio(audioPath, apiKey) {
    const groq = new Groq({ apiKey: apiKey || process.env.GROQ_API_KEY_DEFAULT });

    console.log('🔄 Transcription...');

    const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-large-v3-turbo',
        language: 'fr',
        response_format: 'text',
    });

    console.log('✅ Transcription done');
    return transcription;
}

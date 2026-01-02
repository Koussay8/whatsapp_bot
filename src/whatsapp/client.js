/**
 * Client WhatsApp avec Baileys
 * - Bot OFF par défaut pour nouveau déploiement
 * - Pas de reconnexion en boucle sur erreur 440
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';

const AUTH_FOLDER = './auth';
const TEMP_FOLDER = './temp';
const CONFIG_FILE = './bot-config.json';

// Créer les dossiers
[AUTH_FOLDER, TEMP_FOLDER].forEach(folder => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
});

/**
 * Configuration du bot avec persistance par numéro
 */
function loadBotConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) { }
  // Par défaut: bot OFF pour nouveau déploiement
  return { enabled: false, initialized: false };
}

function saveBotConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

let botConfig = loadBotConfig();

export function isBotEnabled() {
  return botConfig.enabled;
}

export function setBotEnabled(enabled) {
  botConfig.enabled = enabled;
  botConfig.initialized = true; // Marquer comme initialisé
  saveBotConfig(botConfig);
}

function clearSession() {
  if (fs.existsSync(AUTH_FOLDER)) {
    fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    console.log('🗑️  Session supprimée');
  }
  // Reset config pour nouveau numéro
  botConfig = { enabled: false, initialized: false };
  saveBotConfig(botConfig);
}

function isIndividualChat(remoteJid) {
  return remoteJid && remoteJid.endsWith('@s.whatsapp.net');
}

function detectMessageType(message) {
  if (!message) return { type: 'unknown', data: null };

  if (message.audioMessage) {
    return {
      type: 'audio',
      data: message.audioMessage,
      isVoiceNote: message.audioMessage.ptt === true
    };
  }
  if (message.conversation) {
    return { type: 'text', data: message.conversation };
  }
  if (message.extendedTextMessage) {
    return { type: 'text', data: message.extendedTextMessage.text };
  }
  if (message.imageMessage) {
    return { type: 'image', data: message.imageMessage };
  }
  if (message.videoMessage) {
    return { type: 'video', data: message.videoMessage };
  }
  if (message.documentMessage) {
    return { type: 'document', data: message.documentMessage };
  }
  if (message.stickerMessage) {
    return { type: 'sticker', data: message.stickerMessage };
  }

  return { type: 'unknown', data: message };
}

// Compteur pour éviter boucle infinie
let reconnectCount = 0;
const MAX_RECONNECTS = 3;

export async function createWhatsAppClient(handlers) {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

  const { version } = await fetchLatestBaileysVersion();
  console.log(`📦 Baileys version: ${version.join('.')}`);

  const logger = pino({ level: 'silent' });

  const sock = makeWASocket({
    auth: state,
    logger,
    browser: ['WhatsApp Invoice Bot', 'Chrome', '120.0.0'],
    version,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  let ownerNumber = null;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      reconnectCount = 0; // Reset sur nouveau QR
      console.log('\n' + '='.repeat(50));
      console.log('📱 SCANNEZ CE QR CODE AVEC WHATSAPP:');
      console.log('='.repeat(50));
      qrcode.generate(qr, { small: true });
      console.log('WhatsApp > Paramètres > Appareils connectés');
      console.log('='.repeat(50) + '\n');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log(`⚠️ Déconnexion (code: ${statusCode})`);

      if (statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403) {
        console.log('🔄 Session expirée - Nouveau QR code...\n');
        clearSession();
        reconnectCount = 0;
        setTimeout(() => createWhatsAppClient(handlers), 2000);
      } else if (statusCode === 440) {
        // Conflit - NE PAS reconnecter en boucle
        reconnectCount++;
        if (reconnectCount >= MAX_RECONNECTS) {
          console.log('❌ Trop de conflits de session. Arrêt.');
          console.log('💡 Fermez les autres sessions WhatsApp Web ou attendez quelques minutes.');
          process.exit(1);
        }
        console.log(`🔄 Conflit (${reconnectCount}/${MAX_RECONNECTS}), attente 10s...`);
        setTimeout(() => createWhatsAppClient(handlers), 10000);
      } else {
        reconnectCount++;
        if (reconnectCount >= MAX_RECONNECTS) {
          console.log('❌ Trop de tentatives. Arrêt.');
          process.exit(1);
        }
        console.log(`🔄 Reconnexion (${reconnectCount}/${MAX_RECONNECTS})...`);
        setTimeout(() => createWhatsAppClient(handlers), 5000);
      }
    } else if (connection === 'open') {
      reconnectCount = 0; // Reset sur connexion réussie
      ownerNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0];

      // Afficher statut
      const status = isBotEnabled() ? '✅ ACTIVÉ' : '❌ DÉSACTIVÉ';
      console.log('\n✅ CONNECTÉ À WHATSAPP!');
      console.log(`📱 Numéro: ${ownerNumber}`);
      console.log(`🤖 Bot: ${status}`);
      if (!isBotEnabled()) {
        console.log('💡 Envoyez "bot on" pour activer le bot');
      }
      console.log('='.repeat(50) + '\n');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  const processedMessages = new Set();

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      const msgId = msg.key.id;
      if (processedMessages.has(msgId)) continue;
      processedMessages.add(msgId);

      if (processedMessages.size > 1000) {
        const oldest = Array.from(processedMessages).slice(0, 500);
        oldest.forEach(id => processedMessages.delete(id));
      }

      const sender = msg.key.remoteJid;
      const isFromMe = msg.key.fromMe;
      const senderNumber = sender.replace('@s.whatsapp.net', '').replace('@g.us', '');

      // Ignorer groupes
      if (!isIndividualChat(sender)) continue;

      const { type: msgType, data, isVoiceNote } = detectMessageType(msg.message);

      // Commandes bot (toujours actives pour le propriétaire)
      if (msgType === 'text' && isFromMe) {
        const text = data.toLowerCase().trim();

        if (text === 'bot on') {
          if (isBotEnabled()) {
            await sock.sendMessage(sender, { text: 'ℹ️ Le bot est *déjà activé*.' });
          } else {
            setBotEnabled(true);
            console.log('🤖 Bot ACTIVÉ');
            await sock.sendMessage(sender, {
              text: '✅ *Bot ACTIVÉ*\n\nJe traite maintenant les messages vocaux.\nEnvoyez un vocal pour créer une facture!'
            });
          }
          continue;
        }

        if (text === 'bot off') {
          if (!isBotEnabled()) {
            await sock.sendMessage(sender, { text: 'ℹ️ Le bot est *déjà désactivé*.' });
          } else {
            setBotEnabled(false);
            console.log('🤖 Bot DÉSACTIVÉ');
            await sock.sendMessage(sender, { text: '🔇 *Bot DÉSACTIVÉ*\n\nEnvoyez "bot on" pour réactiver.' });
          }
          continue;
        }

        if (text === 'bot status' || text === 'bot') {
          const status = isBotEnabled() ? '✅ ACTIVÉ' : '❌ DÉSACTIVÉ';
          await sock.sendMessage(sender, {
            text: `🤖 *Statut:* ${status}\n\n• "bot on" - Activer\n• "bot off" - Désactiver`
          });
          continue;
        }
      }

      // Si bot désactivé, ignorer
      if (!isBotEnabled()) continue;

      console.log(`\n📨 De: ${senderNumber} | Type: ${msgType}`);

      const context = {
        sender,
        senderNumber,
        isFromMe,
        socket: sock,
        messageId: msgId,
        rawMessage: msg,
        ownerNumber,
      };

      try {
        switch (msgType) {
          case 'audio':
            if (handlers.onAudio) {
              const buffer = await downloadMediaMessage(msg, 'buffer', {});
              const filename = `voice_${Date.now()}.ogg`;
              const filepath = path.join(TEMP_FOLDER, filename);
              fs.writeFileSync(filepath, buffer);
              await handlers.onAudio({ ...context, audioPath: filepath, audioBuffer: buffer, isVoiceNote });
            }
            break;

          case 'text':
            if (handlers.onText) {
              await handlers.onText({ ...context, text: data });
            }
            break;

          default:
            if (handlers.onUnsupported) {
              await handlers.onUnsupported({ ...context, type: msgType });
            }
            break;
        }
      } catch (error) {
        console.error(`❌ Erreur:`, error.message);
        if (handlers.onError) await handlers.onError({ ...context, error });
      }
    }
  });

  return sock;
}

export async function sendWhatsAppMessage(socket, to, text) {
  await socket.sendMessage(to, { text });
}

# 📋 CONTRAT DE DÉVELOPPEMENT - Multi-Bot WhatsApp Platform

> **Version:** 1.0.0  
> **Date:** 2 Janvier 2026  
> **Objectif:** Plateforme SaaS permettant de créer et gérer plusieurs bots WhatsApp simultanément  
> **Déploiement:** Railway (24/7) + Vercel (interface)

---

## 🎯 OBJECTIF DU PROJET

Créer une plateforme **100% gratuite** permettant de :

1. Déployer **N bots WhatsApp** indépendants (un par client/entreprise)
2. Chaque bot peut recevoir des **messages vocaux** → les **transcrire** → générer des **factures PDF** → les **envoyer par email**
3. Interface d'administration pour créer, démarrer, arrêter, activer/désactiver chaque bot
4. Scanner les QR codes WhatsApp depuis l'interface web
5. Fonctionner **24h/24, 7j/7** sur Railway
6. Être **intégrable** dans un site existant sur Vercel

---

## 🏗️ ARCHITECTURE GLOBALE

```
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL (Interface Web)                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Site existant + Pages Admin Bot intégrées              │   │
│  │  - /admin/bots → Liste des bots                         │   │
│  │  - /admin/bots/[id]/qr → Scanner QR                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ API Calls (fetch)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RAILWAY (Serveur 24/7)                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    EXPRESS API                          │   │
│  │  Port 3001 (ou $PORT Railway)                           │   │
│  │  Endpoints:                                              │   │
│  │  - GET  /api/bots/:id/qr      (public)                  │   │
│  │  - GET  /api/bots/:id/status  (public)                  │   │
│  │  - GET  /api/admin/bots       (auth required)           │   │
│  │  - POST /api/admin/bots       (auth required)           │   │
│  │  - POST /api/admin/bots/:id/start                       │   │
│  │  - POST /api/admin/bots/:id/stop                        │   │
│  │  - POST /api/admin/bots/:id/enable                      │   │
│  │  - DELETE /api/admin/bots/:id                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   BOT MANAGER                           │   │
│  │  - Charge les bots existants au démarrage               │   │
│  │  - Crée/détruit des instances BotInstance               │   │
│  │  - Stocke les configs dans data/bots/                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│           ┌───────────────┼───────────────┐                    │
│           ▼               ▼               ▼                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │   Bot #1     │ │   Bot #2     │ │   Bot #N     │            │
│  │  (Baileys)   │ │  (Baileys)   │ │  (Baileys)   │            │
│  │  Session A   │ │  Session B   │ │  Session N   │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 STRUCTURE DES FICHIERS

```
WhatsappBot/
├── package.json              # Dépendances Node.js
├── .env.example              # Template variables d'environnement
├── .gitignore                # Fichiers à ignorer (sessions, .env)
├── README.md                 # Documentation rapide
├── CONTRAT_DEV.md            # CE FICHIER
├── admin.html                # Interface admin standalone (dev)
│
├── server/                   # BACKEND (Railway)
│   ├── index.js              # Point d'entrée - lance API + BotManager
│   ├── bot-manager.js        # Gère toutes les instances de bots
│   ├── bot-instance.js       # Classe d'un bot individuel
│   │
│   ├── api/
│   │   └── server.js         # Routes Express (API REST)
│   │
│   └── services/
│       ├── transcription.js  # Groq Whisper API
│       ├── ai-analyzer.js    # Groq LLaMA - analyse messages
│       ├── invoice.js        # PDFKit - génération factures
│       └── email.js          # Nodemailer - envoi emails
│
├── admin/                    # FRONTEND Next.js (optionnel)
│   ├── package.json
│   └── app/
│       ├── layout.jsx
│       ├── page.jsx
│       ├── globals.css
│       ├── admin/page.jsx    # Dashboard
│       └── qr/[id]/page.jsx  # Page QR
│
└── data/                     # PERSISTANCE (Railway Volume)
    └── bots/
        └── bot-xxx/
            ├── config.json   # Configuration du bot
            ├── prompt.json   # Prompt IA personnalisé
            ├── knowledge.json# Knowledge base
            ├── emails.json   # Templates emails
            ├── auth/         # Session WhatsApp (Baileys)
            ├── temp/         # Fichiers temporaires
            └── invoices/     # Factures générées
```

---

## 🔧 FICHIERS DÉTAILLÉS

### 1. `package.json`

```json
{
  "name": "whatsapp-multi-bot-platform",
  "version": "1.0.0",
  "type": "module",
  "main": "server/index.js",
  "scripts": {
    "start": "node server/index.js",
    "dev": "node --watch server/index.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.16",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "cors": "^2.8.5",
    "groq-sdk": "^0.12.0",
    "nodemailer": "^6.9.16",
    "pdfkit": "^0.16.0",
    "pino": "^9.6.0",
    "qrcode": "^1.5.4",
    "uuid": "^11.0.5"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 2. `.env.example`

```env
# Variables globales partagées par tous les bots
GROQ_API_KEY_DEFAULT=gsk_votre_cle_ici
ADMIN_SECRET=votre-secret-admin-securise
PORT=3001

# Email par défaut (override possible par bot)
EMAIL_USER_DEFAULT=votre.email@gmail.com
EMAIL_APP_PASSWORD_DEFAULT=xxxx xxxx xxxx xxxx

# Infos entreprise par défaut
COMPANY_NAME_DEFAULT=VotreEntreprise
COMPANY_EMAIL_DEFAULT=contact@votre-entreprise.fr
```

### 3. `.gitignore`

```
node_modules/
.env
.env.local
data/bots/*/auth/
*.log
logs/
data/bots/*/invoices/
temp/
.DS_Store
```

---

## 🔑 FONCTIONNEMENT DÉTAILLÉ

### Comment un bot est créé

1. **Appel API** : `POST /api/admin/bots` avec `{ name: "Mon Bot" }`
2. **BotManager** crée un dossier `data/bots/bot-{uuid}/`
3. **Fichiers créés** :
   - `config.json` : ID, nom, status, settings (clés API, email)
   - `prompt.json` : Prompt système par défaut
   - `knowledge.json` : Base de connaissances vide `{ entries: [] }`
   - `emails.json` : Templates email (facture + confirmation)
4. **Instance créée** mais pas démarrée

### Comment un bot démarre

1. **Appel API** : `POST /api/admin/bots/:id/start`
2. **BotInstance.start()** :
   - Charge la session Baileys depuis `auth/`
   - Se connecte à WhatsApp
   - Si pas de session → génère un QR code
3. **Événement QR** : QR encodé en base64 et stocké
4. **Événement connected** : Bot prêt

### Comment un message vocal est traité

1. **Message reçu** via `messages.upsert` de Baileys
2. **Vérifications** :
   - Pas un groupe (ignorer `@g.us`)
   - Bot enabled
   - Message audio
3. **Téléchargement** du fichier audio en buffer
4. **Transcription** via Groq Whisper (`whisper-large-v3-turbo`)
5. **Analyse IA** via Groq LLaMA (`llama-3.3-70b-versatile`) :
   - Score de cohérence
   - Détection intention facture
   - Extraction : client, description, montant
6. **Si complet** → Demande confirmation
7. **Si confirmé** → Génère PDF → Envoie emails → Confirme sur WhatsApp

---

## ⚠️ PROBLÈMES RENCONTRÉS ET SOLUTIONS

### Problème 1 : Boucle de reconnexion infinie (erreur 440)

**Symptôme** : Le bot se déconnecte et reconnecte en boucle sans arrêt.

**Cause** : Plusieurs instances essayaient de se connecter avec la même session.

**Solution** :

```javascript
// Dans bot-instance.js
let reconnectCount = 0;
const MAX_RECONNECTS = 3;

if (statusCode === 440) {
  reconnectCount++;
  if (reconnectCount >= MAX_RECONNECTS) {
    console.log('❌ Trop de conflits. Arrêt.');
    this.status = 'error';
    return; // Ne pas reconnecter
  }
  setTimeout(() => this.start(), 10000); // Attendre 10s
}
```

### Problème 2 : Messages à soi-même ignorés

**Symptôme** : Les messages vocaux envoyés à soi-même n'étaient pas traités.

**Cause** : Le code ignorait `msg.key.fromMe === true`.

**Solution** : Retirer cette vérification pour permettre les tests.

### Problème 3 : Bot on/off ne disait pas "déjà activé"

**Symptôme** : Taper "bot on" quand déjà activé disait juste "activé".

**Solution** :

```javascript
if (text === 'bot on') {
  if (isBotEnabled()) {
    await send('ℹ️ Le bot est *déjà activé*.');
  } else {
    setBotEnabled(true);
    await send('✅ Bot ACTIVÉ');
  }
}
```

### Problème 4 : Port déjà utilisé (EADDRINUSE)

**Symptôme** : Le serveur ne démarre pas car le port 3001 est pris.

**Solution** : Tuer les processus existants avant de relancer :

```bash
pkill -f "node server/index.js"
npm run dev
```

### Problème 5 : Encodage caractères (accents, emojis)

**Symptôme** : "Créer" affiché comme "CrÃ©er"

**Solution** : Ajouter `<meta charset="UTF-8">` dans le HTML.

### Problème 6 : Page qui scroll vers le haut automatiquement

**Symptôme** : Impossible de scanner le QR car la page remonte.

**Solution** : Sauvegarder et restaurer la position du scroll :

```javascript
const scrollPos = window.scrollY;
// ... render ...
window.scrollTo(0, scrollPos);
```

### Problème 7 : Page qui scintille à chaque refresh

**Symptôme** : Le contenu clignote toutes les 3 secondes.

**Solution** : Ne re-render que si les données ont changé :

```javascript
const newData = JSON.stringify(bots);
if (newData !== lastBotsData) {
  lastBotsData = newData;
  await renderBots(bots);
}
```

---

## 🚀 DÉPLOIEMENT RAILWAY (24/7)

### Étape 1 : Préparer le repo Git

```bash
cd WhatsappBot
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/votre-user/whatsapp-bot.git
git push -u origin main
```

### Étape 2 : Créer le projet Railway

1. Aller sur [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub repo"
3. Sélectionner le repo
4. Railway détecte automatiquement Node.js

### Étape 3 : Variables d'environnement Railway

Dans Settings → Variables :

```
GROQ_API_KEY_DEFAULT=gsk_votre_cle
ADMIN_SECRET=secret-tres-securise
PORT=3001
EMAIL_USER_DEFAULT=votre.email@gmail.com
EMAIL_APP_PASSWORD_DEFAULT=xxxx xxxx xxxx xxxx
COMPANY_NAME_DEFAULT=VotreEntreprise
```

### Étape 4 : Volume persistant (IMPORTANT)

Pour que les sessions WhatsApp survivent aux redémarrages :

1. Settings → Volumes
2. Add Volume
3. Mount Path: `/app/data`
4. Redéployer

### Étape 5 : Domaine public

1. Settings → Networking → Generate Domain
2. Vous obtenez : `https://votre-app.railway.app`
3. L'API est maintenant accessible publiquement

---

## 🌐 INTÉGRATION VERCEL (Site existant)

### Option A : Page admin.html intégrée

Copier `admin.html` dans votre projet Next.js sous `public/admin.html`.

Modifier l'URL de l'API :

```javascript
const API = 'https://votre-app.railway.app';
```

### Option B : Pages Next.js natives

Créer des pages dans votre app Next.js qui appellent l'API Railway :

```typescript
// app/admin/bots/page.tsx
'use client';
import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_BOT_API_URL;
const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET;

export default function BotsPage() {
  const [bots, setBots] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/admin/bots`, {
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` }
    })
      .then(res => res.json())
      .then(data => setBots(data.bots));
  }, []);

  // ... render bots
}
```

### Variables Vercel

```
NEXT_PUBLIC_BOT_API_URL=https://votre-app.railway.app
NEXT_PUBLIC_ADMIN_SECRET=votre-secret
```

---

## 🔐 SÉCURITÉ

### 1. Protection Admin

Toutes les routes `/api/admin/*` nécessitent :

```
Authorization: Bearer ADMIN_SECRET
```

### 2. Fichiers sensibles

Ne JAMAIS commit :

- `.env`
- `data/bots/*/auth/` (sessions WhatsApp)

### 3. Clés API

Chaque bot peut avoir sa propre clé Groq dans `config.json` → `settings.groqApiKey`.

### 4. HTTPS

Railway fournit HTTPS automatiquement. Ne jamais exposer l'API en HTTP en production.

---

## 📊 LIMITES ET QUOTAS

| Service | Limite Gratuite |
|---------|-----------------|
| Railway | 500h/mois (~21 jours continus) |
| Groq Whisper | 14,400 requêtes/jour |
| Groq LLaMA | 14,400 requêtes/jour |
| Supabase | 500MB (si utilisé) |
| WhatsApp (Baileys) | Risque de ban si spam |

### ⚠️ Risques WhatsApp

| Action | Risque |
|--------|--------|
| Répondre aux messages reçus | ✅ Faible |
| Messages identiques en masse | ❌ Élevé |
| Spam vers inconnus | ❌ Très élevé |
| Usage dans groupes | ⚠️ Moyen |

**Recommandation** : Utiliser un numéro dédié par bot.

---

## 🔄 MISE À JOUR ET MAINTENANCE

### Ajouter un nouveau service

1. Créer `server/services/nouveau-service.js`
2. L'importer dans `bot-instance.js`
3. L'appeler dans le handler approprié

### Modifier le prompt par défaut

Modifier dans `bot-manager.js` → `createBot()` → objet `prompt`.

### Ajouter un endpoint API

Dans `server/api/server.js`, ajouter la route avec le middleware `adminAuth` si nécessaire.

---

## ✅ CHECKLIST DE DÉPLOIEMENT

- [ ] Repo Git créé et poussé
- [ ] Projet Railway créé
- [ ] Variables d'environnement configurées
- [ ] Volume `/app/data` monté
- [ ] Domaine public généré
- [ ] Test : créer un bot via API
- [ ] Test : démarrer et scanner QR
- [ ] Test : envoyer un vocal
- [ ] Interface admin intégrée à Vercel
- [ ] Tester depuis Vercel

---

## 📞 SUPPORT

Ce document sert de référence complète. Avec ces informations, une IA ou un développeur peut :

1. Recréer l'application de zéro
2. Comprendre chaque décision technique
3. Débugger les problèmes connus
4. Déployer en production

**Fin du contrat de développement.**

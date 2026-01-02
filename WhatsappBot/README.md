# 🤖 Multi-Bot WhatsApp Platform

Plateforme permettant de déployer et gérer **plusieurs bots WhatsApp** simultanément.

## 🚀 Démarrage Rapide

### 1. Configuration

```bash
# Copier et éditer le .env
cp .env.example .env
```

Modifier `.env` avec vos clés:

```env
GROQ_API_KEY_DEFAULT=gsk_votre_cle
ADMIN_SECRET=votre-secret-admin
```

### 2. Installation

```bash
npm install
```

### 3. Lancement

```bash
npm start
```

L'API démarre sur `http://localhost:3001`

---

## 📋 API Endpoints

### Routes Publiques

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/bots/:id/qr` | Obtenir le QR code |
| GET | `/api/bots/:id/status` | Statut du bot |
| GET | `/health` | Health check |

### Routes Admin (Auth requise)

Header: `Authorization: Bearer VOTRE_ADMIN_SECRET`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/admin/bots` | Lister tous les bots |
| POST | `/api/admin/bots` | Créer un bot |
| GET | `/api/admin/bots/:id` | Détails d'un bot |
| PUT | `/api/admin/bots/:id` | Modifier config |
| DELETE | `/api/admin/bots/:id` | Supprimer |
| POST | `/api/admin/bots/:id/start` | Démarrer |
| POST | `/api/admin/bots/:id/stop` | Arrêter |
| POST | `/api/admin/bots/:id/enable` | Activer/Désactiver |

---

## 🔧 Créer un Bot

```bash
curl -X POST http://localhost:3001/api/admin/bots \
  -H "Authorization: Bearer VOTRE_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"name": "Bot Entreprise A"}'
```

Réponse:

```json
{
  "id": "bot-abc123",
  "name": "Bot Entreprise A",
  "status": "created"
}
```

## 🔗 Scanner le QR Code

```bash
# Démarrer le bot
curl -X POST http://localhost:3001/api/admin/bots/bot-abc123/start \
  -H "Authorization: Bearer VOTRE_ADMIN_SECRET"

# Récupérer le QR (data URL base64)
curl http://localhost:3001/api/bots/bot-abc123/qr
```

---

## 🚀 Déploiement Railway

1. Push sur GitHub
2. Créer projet sur [railway.app](https://railway.app)
3. Connecter le repo
4. Ajouter variables d'environnement
5. Déployer!

---

## 📁 Structure

```
WhatsappBot/
├── server/
│   ├── index.js           # Point d'entrée
│   ├── bot-manager.js     # Gestion multi-bots
│   ├── bot-instance.js    # Classe bot
│   ├── api/
│   │   └── server.js      # API Express
│   └── services/
│       ├── transcription.js
│       ├── ai-analyzer.js
│       ├── invoice.js
│       └── email.js
└── data/
    └── bots/              # Données par bot
        └── bot-xxx/
            ├── config.json
            ├── prompt.json
            ├── knowledge.json
            ├── emails.json
            └── auth/
# whatsapp-bot

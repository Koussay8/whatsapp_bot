# 🤖 Bot WhatsApp Facture Vocale

Bot WhatsApp **100% gratuit** qui transforme vos messages vocaux en factures PDF et les envoie par email.

## 🎯 Fonctionnalités

- 🎤 Réception de messages vocaux WhatsApp
- 📝 Transcription automatique (Whisper via Groq)
- 🧠 Extraction intelligente des données (client, montant, description)
- 📄 Génération de factures PDF professionnelles
- 📧 Envoi automatique par email
- 💬 Confirmation sur WhatsApp avec copie PDF

## 📦 Stack Technique (Gratuit)

| Composant | Technologie | Limite gratuite |
| :--- | :--- | :--- |
| WhatsApp | Baileys (open source) | Illimité |
| Transcription | Groq Whisper API | ~14,400/jour |
| IA Parsing | Groq LLaMA 3 | ~14,400/jour |
| PDF | pdfkit | Illimité |
| Email | Gmail + App Password | 500/jour |

## 🚀 Installation

### 1. Prérequis

- Node.js 18+ installé
- Compte Gmail avec 2FA activé
- Compte Groq (gratuit)

### 2. Installation des dépendances

```bash
cd /Users/koussay/Desktop/bot
npm install
```

### 3. Configuration

Modifiez le fichier `.env` avec vos informations :

```env
# Groq API (https://console.groq.com/keys)
GROQ_API_KEY=gsk_votre_cle

# Gmail (https://myaccount.google.com/apppasswords)
EMAIL_USER=votre.email@gmail.com
EMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
EMAIL_TO_DEFAULT=destinataire@example.com

# Infos entreprise
COMPANY_NAME=VotreEntreprise
COMPANY_ADDRESS=123 Rue Example
COMPANY_SIRET=123 456 789 00012
```

### 4. Lancement

```bash
npm start
```

Un QR code s'affichera. Scannez-le avec WhatsApp (Appareils connectés > Connecter un appareil).

## ☁️ Déploiement sur Google Cloud (Gratuit & 24/7)

Idéal pour que le bot fonctionne tout le temps, sans garder votre ordinateur allumé.

### 1. Créer une machine virtuelle (VM)

1. Allez sur **Google Cloud Console > Compute Engine > Instances de VM**.
2. Cliquez sur **Créer une instance**.
3. **Configuration recommandée** :
   - Nom : `whatsapp-bot`
   - Région : **`us-central1`** (Iowa) ou **`us-east1`** (South Carolina).
     > ⚠️ **IMPORTANT** : Vous devez choisir une région **US** (comme `us-central1`) pour que la machine soit **GRATUITE**. Si vous choisissez "Europe", vous paierez environ 7€/mois.
     > Ne vous inquiétez pas, le bot fonctionnera parfaitement pour vous en Europe (la vitesse est la même pour WhatsApp).
   - Type de machine : `e2-micro` (2 vCPU, 1 Go mémoire) - *Cherchez l'étiquette "Mensuel gratuit" ou "Free tier"*.
   - Disque de démarrage : **Debian** ou **Ubuntu**.
   - Pare-feu : Cochez "Autoriser le trafic HTTP/HTTPS".
4. Cliquez sur **Créer**.

### 2. Installation automatique

1. Une fois la VM créée, cliquez sur le bouton **SSH** pour ouvrir le terminal.
2. Copiez-collez ces commandes (l'une après l'autre) :

```bash
# 1. Télécharger le script d'installation
wget https://raw.githubusercontent.com/Koussay8/whatsapp_bot/main/gcp-setup.sh

# 2. Lancer l'installation (dure ~2 minutes)
sudo chmod +x gcp-setup.sh
sudo ./gcp-setup.sh

# 3. Cloner votre code (si pas fait via git)
git clone https://github.com/Koussay8/whatsapp_bot.git bot
cd bot

# 4. Installer les dépendances du projet
npm install

# 5. Configurer les variables d'environnement
nano .env
# (Collez vos clés API ici, puis Ctrl+X, Y, Entrée pour sauvegarder)

# 6. Démarrer le bot avec PM2 (reboot automatique)
pm2 start src/index.js --name "whatsapp-bot"
pm2 save
pm2 startup
```

### 3. Connexion

1. Une fois lancé, affichez les logs pour voir le QR Code :

   ```bash
   pm2 logs whatsapp-bot
   ```

2. Scannez le QR Code avec votre téléphone.
3. Pour quitter les logs sans arrêter le bot : `Ctrl + C`.

### 4. Configurer l'IP externe (pour le site web)

Pour que votre site Vercel puisse accéder au bot, vous devez configurer une IP externe statique.

**4.1. Réserver une IP statique :**

1. Google Cloud Console → **VPC Network** → **IP addresses**
2. Cliquez **Reserve External Static Address**
3. Nom : `whatsapp-bot-ip`
4. Region : même que votre VM (ex: `us-central1`)
5. Attached to : sélectionnez votre VM `whatsapp-bot`
6. Cliquez **Reserve**

> 💰 Coût : ~$3/mois (couvert par les crédits GCP)

**4.2. Ouvrir le port 3001 dans le firewall :**

1. Google Cloud Console → **VPC Network** → **Firewall**
2. Cliquez **Create Firewall Rule**
3. Configuration :
   - Nom : `allow-bot-api`
   - Network : default
   - Direction : Ingress
   - Targets : All instances
   - Source IP ranges : `0.0.0.0/0`
   - Protocols and ports : TCP → `3001`
4. Cliquez **Create**

**4.3. Ajouter ADMIN_SECRET au .env :**

```bash
# Sur la VM GCP
nano .env

# Ajoutez cette ligne :
ADMIN_SECRET=votre-secret-admin-securise
```

**4.4. Redémarrer le bot :**

```bash
pm2 restart whatsapp-bot
```

### 5. Configurer Vercel

1. Allez sur [vercel.com](https://vercel.com) → votre projet → Settings → Environment Variables
2. Ajoutez :
   - `WHATSAPP_BOT_API_URL` = `http://VOTRE_IP_EXTERNE:3001`
   - `WHATSAPP_BOT_ADMIN_SECRET` = `votre-secret-admin-securise`
3. Redéployez le site

### 6. Tester

1. Accédez à `https://votre-site.vercel.app/admin/whatsapp-bots`
2. Le QR code devrait s'afficher
3. Scannez-le avec WhatsApp
4. Le statut passe à "Connecté"

## 📱 Utilisation

1. Envoyez un message vocal au numéro WhatsApp connecté
2. Dictez les informations de facturation, par exemple :
   > "Facture pour Jean Dupont, création de site web, 1500 euros"
3. Le bot :
   - Transcrit le message
   - Extrait les données
   - Génère le PDF
   - Envoie l'email
   - Vous confirme avec une copie

## 🎤 Exemples de messages vocaux

```text
"Facture pour Marie Martin, formation IA, deux mille euros"

"Facture client Entreprise ABC, email contact@abc.com, 
développement application mobile, 5000 euros HT"

"Jean-Pierre Dubois, maintenance informatique mensuelle, 
trois cent cinquante euros"
```

## 📁 Structure du projet

```bash
bot/
├── .env                    # Configuration (secrets)
├── package.json            # Dépendances
├── src/
│   ├── index.js            # Point d'entrée
│   ├── whatsapp/
│   │   └── client.js       # Connexion WhatsApp
│   ├── transcription/
│   │   └── whisper.js      # API Groq Whisper
│   ├── invoice/
│   │   ├── parser.js       # Extraction données
│   │   └── generator.js    # Génération PDF
│   └── email/
│       └── sender.js       # Envoi emails
├── auth/                   # Session WhatsApp (auto-généré)
├── invoices/               # PDFs générés (auto-généré)
└── temp/                   # Fichiers temporaires (auto-généré)
```

## 🔐 Sécurité

- **Ne commitez jamais `.env`** sur Git
- Utilisez un **numéro WhatsApp dédié** pour le bot
- Configurez `ALLOWED_NUMBER` pour restreindre l'accès

## ⚠️ Limitations

- WhatsApp peut bloquer les numéros avec usage abusif
- Limite Groq : ~14,400 requêtes audio/jour
- Limite Gmail : 500 emails/jour

## 🛠️ Dépannage

### "Configuration email invalide"

1. Vérifiez que 2FA est activé sur Gmail
2. Créez un App Password : <https://myaccount.google.com/apppasswords>
3. Utilisez ce mot de passe (pas votre mot de passe Gmail normal)

### QR code ne s'affiche pas

Supprimez le dossier `auth/` et relancez le bot.

### Transcription incorrecte

Parlez clairement et mentionnez explicitement les montants en chiffres ou en lettres.

## 📄 Licence

MIT - Libre d'utilisation

---

Créé avec ❤️ par NovaSolutions

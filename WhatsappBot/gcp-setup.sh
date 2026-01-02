#!/bin/bash

# Script d'installation automatique pour Google Cloud (Debian/Ubuntu)
# Usage: sudo ./gcp-setup.sh

echo "🚀 Démarrage de l'installation..."

# 1. Mise à jour du système
echo "📦 Mise à jour du système..."
sudo apt-get update && sudo apt-get upgradable -y

# 2. Installation des outils de base et librairies pour Puppeteer/Chrome
echo "🛠️ Installation des dépendances système..."
sudo apt-get install -y curl git unzip build-essential \
    gconf-service libasound2 libatk1.0-0 libc6 libc6-dev libcairo2 libcups2 \
    libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 \
    libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
    libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
    libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates \
    fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

# 3. Installation de Node.js 20 (LTS)
echo "🟢 Installation de Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Vérification
node -v
npm -v

# 4. Installation de PM2 (Gestionnaire de processus)
echo "⚡ Installation de PM2..."
sudo npm install -g pm2

# 5. Configuration du pare-feu (optionnel mais recommandé)
# echo "🛡️ Configuration du pare-feu..."
# sudo ufw allow ssh
# sudo ufw allow http
# sudo ufw allow https
# sudo ufw enable

echo ""
echo "✅ Installation système terminée !"
echo ""
echo "👉 PROCHAINE ÉTAPE :"
echo "   Placez-vous dans le dossier du projet et lancez :"
echo "   npm install"
echo "   npm start"

#!/bin/bash
# =============================================================
# Installation sécurisée WhatsApp Bot avec HTTPS (Caddy)
# =============================================================

set -e

echo "🔐 Installation sécurisée WhatsApp Bot..."

# 1. Install Caddy (reverse proxy HTTPS automatique)
echo "📦 Installation de Caddy..."
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

# 2. Create Caddyfile for HTTPS
echo "📝 Configuration Caddy..."

# Get domain from user or use IP
read -p "Entrez votre domaine (ou laissez vide pour IP externe): " DOMAIN
if [ -z "$DOMAIN" ]; then
    EXTERNAL_IP=$(curl -s ifconfig.me)
    echo "⚠️  Sans domaine, HTTPS n'est pas possible."
    echo "   Utilisation de HTTP sur $EXTERNAL_IP:3001"
    exit 0
fi

cat << EOF | sudo tee /etc/caddy/Caddyfile
$DOMAIN {
    reverse_proxy localhost:3001
    
    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }
    
    # Rate limiting (10 requests per second per IP)
    rate_limit {
        zone api {
            key {remote_host}
            events 10
            window 1s
        }
    }
    
    # Logs
    log {
        output file /var/log/caddy/whatsapp-bot.log
    }
}
EOF

# 3. Start Caddy
echo "🚀 Démarrage de Caddy..."
sudo systemctl restart caddy
sudo systemctl enable caddy

# 4. Configure firewall
echo "🔥 Configuration firewall..."
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 80/tcp   # HTTP (pour Let's Encrypt)
# Ne pas ouvrir 3001 au public !

echo ""
echo "✅ Installation terminée!"
echo ""
echo "🌐 Votre API est accessible sur: https://$DOMAIN"
echo ""
echo "📋 Variables Vercel à configurer:"
echo "   WHATSAPP_BOT_API_URL = https://$DOMAIN"
echo "   WHATSAPP_BOT_ADMIN_SECRET = (votre secret)"
echo ""

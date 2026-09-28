#!/usr/bin/env bash
# ============================================================================
# Voltflow — one-time server provisioning for an InterServer Ubuntu VPS
# Installs Node.js LTS, Nginx, PM2, Certbot and configures the UFW firewall.
# Idempotent-ish: safe to re-run. Does NOT deploy the app (see deploy.sh).
#
# Usage (on the server, as a sudo-capable user):
#   chmod +x deploy/interserver/setup-ubuntu.sh
#   ./deploy/interserver/setup-ubuntu.sh
#
# Tested target: Ubuntu 24.04 LTS (no cPanel / no control panel).
# ============================================================================
set -euo pipefail

NODE_MAJOR="${NODE_MAJOR:-20}"   # Node.js LTS major version
APP_DIR="/opt/voltflow"          # where the repo lives on the server
WEB_ROOT="/var/www/voltflow/dist"

echo "==> Updating apt and installing base packages"
sudo apt-get update -y
sudo apt-get install -y curl ca-certificates gnupg git ufw

echo "==> Installing Node.js LTS (v${NODE_MAJOR}) via NodeSource"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt "${NODE_MAJOR}" ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "    node: $(node -v)   npm: $(npm -v)"

echo "==> Installing Nginx"
sudo apt-get install -y nginx

echo "==> Installing PM2 globally"
sudo npm install -g pm2

echo "==> Installing Certbot (Let's Encrypt) for Nginx"
sudo apt-get install -y certbot python3-certbot-nginx

echo "==> Creating directories"
sudo mkdir -p "${APP_DIR}" "${WEB_ROOT}" /etc/voltflow
sudo chown -R "$USER":"$USER" "${APP_DIR}"

echo "==> Configuring UFW firewall (OpenSSH + HTTP + HTTPS)"
sudo ufw allow OpenSSH || true
sudo ufw allow 'Nginx Full' || true   # opens 80 + 443
# NOTE: do NOT open 3001 — the Node API is localhost-only behind Nginx.
sudo ufw --force enable
sudo ufw status verbose || true

cat <<'NEXT'

==> Base provisioning done.

NEXT STEPS (manual, in order):
  1. Harden SSH (recommended):
       - add your SSH public key to ~/.ssh/authorized_keys
       - set 'PasswordAuthentication no' and 'PermitRootLogin prohibit-password'
         in /etc/ssh/sshd_config, then: sudo systemctl restart ssh
  2. Put the server secret OUTSIDE the repo (only if enabling the AI Assistant):
       sudo install -m 600 /dev/null /etc/voltflow/voltflow.env
       sudo nano /etc/voltflow/voltflow.env      # add ANTHROPIC_API_KEY=... PORT=3001 NODE_ENV=production
  3. Get the code onto the server at /opt/voltflow (git clone or rsync).
  4. Deploy:   ./deploy/interserver/deploy.sh
  5. Nginx:    copy deploy/interserver/nginx-voltflow.conf to sites-available,
               symlink into sites-enabled, edit the domain, then: sudo nginx -t && sudo systemctl reload nginx
  6. HTTPS:    sudo certbot --nginx -d your-domain.com -d www.your-domain.com
NEXT

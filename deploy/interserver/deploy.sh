#!/usr/bin/env bash
# ============================================================================
# Voltflow — build & release to the InterServer VPS
# Builds the Vite frontend, publishes dist to the Nginx web root, and (if the
# assistant is enabled) (re)starts the Node API under PM2.
#
# Run from the repo root ON THE SERVER (e.g. /opt/voltflow):
#   ./deploy/interserver/deploy.sh              # frontend + API
#   ENABLE_API=0 ./deploy/interserver/deploy.sh # static-only (no Node API)
#
# It does NOT touch Vercel, does NOT print secrets, and keeps a timestamped
# backup of the previous dist for rollback (see rollback.md).
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/voltflow}"
WEB_ROOT="${WEB_ROOT:-/var/www/voltflow/dist}"
ENABLE_API="${ENABLE_API:-1}"           # 1 = run Node assistant API, 0 = static-only
PM2_CONFIG="deploy/interserver/pm2.ecosystem.config.cjs"

cd "${APP_DIR}"

echo "==> Installing dependencies (clean, reproducible)"
if [ -f package-lock.json ]; then npm ci; else npm install; fi

echo "==> Building the frontend"
npm run build

echo "==> Publishing dist to ${WEB_ROOT} (with backup)"
sudo mkdir -p "${WEB_ROOT}"
if [ -d "${WEB_ROOT}" ] && [ -n "$(ls -A "${WEB_ROOT}" 2>/dev/null || true)" ]; then
  BACKUP="${WEB_ROOT}.bak.$(date +%Y%m%d-%H%M%S)"
  echo "    backing up current release to ${BACKUP}"
  sudo cp -a "${WEB_ROOT}" "${BACKUP}"
fi
sudo rsync -a --delete "${APP_DIR}/dist/" "${WEB_ROOT}/"
sudo chown -R www-data:www-data "${WEB_ROOT}" || true

echo "==> Reloading Nginx"
sudo nginx -t && sudo systemctl reload nginx

if [ "${ENABLE_API}" = "1" ]; then
  echo "==> (Re)starting the Node assistant API under PM2"
  # PM2 reads env from /etc/voltflow/voltflow.env via server/index.js.
  pm2 startOrReload "${PM2_CONFIG}" --update-env
  pm2 save
  echo "    health: curl -s http://127.0.0.1:3001/api/health"
else
  echo "==> STATIC-ONLY mode: skipping Node API. Ensure the /api/ block is removed"
  echo "    from the Nginx config so the frontend uses the Project Advisor fallback."
fi

echo ""
echo "==> Deploy complete."
echo "    Frontend: served by Nginx from ${WEB_ROOT}"
echo "    Verify:   open the site, then run deploy/interserver/smoke-test-checklist.md"
[ "${ENABLE_API}" = "1" ] && echo "    API:      pm2 status  /  pm2 logs voltflow-api"

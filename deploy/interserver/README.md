# Voltflow on InterServer (Ubuntu VPS) — Deployment Guide

**Status:** deployment *support files only*. Nothing here has been deployed. Vercel
production (https://voltflow-alpha.vercel.app) is untouched and remains the source
of truth. Classification: **Voltflow Internal Alpha / Market-Testing Build.**

## What Voltflow is, deployment-wise
- A **static Vite SPA** (`npm run build` → `dist/`) — no server needed to view it.
- Plus **one optional API route** (`api/assistant.js`) for the Claude assistant.
  The frontend calls it at the **relative** path `/api/assistant`, so it works on
  any host that serves `dist` and proxies `/api/`. If the API is absent or the key
  is missing, the app shows a safe fallback and **Project Advisor still works**.
- **No Vercel-specific code.** Only `vercel.json` (config) and the serverless
  handler convention are Vercel-shaped; both are preserved.

## Recommended path (safest for a $3 VPS)
**Keep Vercel as production. Use InterServer as staging/backup first.** Deploy
**static-only** to start (no Node process to babysit), then optionally enable the
Node assistant API once the static site is proven. Only consider moving production
after a successful **3–7 day** test. See `../../docs/VOLTFLOW_INTERSERVER_DEPLOYMENT_PLAN.md`
for the full option comparison.

## Files in this folder
| File | Purpose |
|---|---|
| `setup-ubuntu.sh` | One-time: install Node LTS, Nginx, PM2, Certbot, UFW |
| `deploy.sh` | Build + publish `dist` to Nginx web root, (re)start PM2 API |
| `nginx-voltflow.conf` | Nginx site: static + SPA fallback + `/api/` proxy |
| `pm2.ecosystem.config.cjs` | PM2 config for `server/index.js` (no secrets) |
| `env.example` | Server env placeholders → copy to `/etc/voltflow/voltflow.env` |
| `rollback.md` | How to roll back a release |
| `smoke-test-checklist.md` | 20-point post-deploy verification |
| `static-only.md` | Static-only mode (no Node API) |
| `../../server/index.js` | Zero-dep Node server that **reuses** `api/assistant.js` |

## Architecture
```
            ┌─────────────── InterServer Ubuntu VPS ───────────────┐
Internet ──▶│  Nginx :80/:443                                      │
  (HTTPS)   │   ├─ /            → /var/www/voltflow/dist (SPA)      │
            │   │                 try_files … /index.html          │
            │   └─ /api/         → 127.0.0.1:3001  (optional)      │
            │                        │                             │
            │                     PM2 → node server/index.js       │
            │                        └─ reuses api/assistant.js    │
            │                        └─ ANTHROPIC_API_KEY from      │
            │                           /etc/voltflow/voltflow.env  │
            └──────────────────────────────────────────────────────┘
```
The Node API binds to **127.0.0.1 only** (never exposed); UFW opens **22/80/443** only.

## Step-by-step (with the AI assistant enabled)
```bash
# 0) DNS: point your domain's A record at the VPS IP (or test by IP first).

# 1) Provision the box (once)
ssh you@your-vps
git clone <your-voltflow-remote> /opt/voltflow    # or rsync the repo up
cd /opt/voltflow
chmod +x deploy/interserver/*.sh
./deploy/interserver/setup-ubuntu.sh

# 2) Server secret (ONLY if enabling the assistant) — outside the repo
sudo install -m 600 /dev/null /etc/voltflow/voltflow.env
sudo nano /etc/voltflow/voltflow.env        # ANTHROPIC_API_KEY=...  PORT=3001  NODE_ENV=production

# 3) Deploy the app (build + publish dist + start PM2 API)
./deploy/interserver/deploy.sh

# 4) Nginx site
sudo cp deploy/interserver/nginx-voltflow.conf /etc/nginx/sites-available/voltflow
sudo ln -s /etc/nginx/sites-available/voltflow /etc/nginx/sites-enabled/voltflow
sudo nano /etc/nginx/sites-available/voltflow   # replace your-domain.com
sudo nginx -t && sudo systemctl reload nginx

# 5) HTTPS
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 6) Make PM2 survive reboots
pm2 startup    # run the command it prints
pm2 save

# 7) Verify → deploy/interserver/smoke-test-checklist.md
```

## Static-only (no Node API)
```bash
ENABLE_API=0 ./deploy/interserver/deploy.sh
# then delete the `location /api/ { … }` block from the Nginx config and reload.
```
See `static-only.md`. Project Advisor works; the AI Assistant shows its safe
"not enabled in this environment" fallback.

## Security notes
- `ANTHROPIC_API_KEY` lives only in `/etc/voltflow/voltflow.env` (root-owned, 600)
  and is read server-side by `server/index.js`. It is **never** in the client
  bundle (no `VITE_` secret) and **never** logged.
- The Node API is **localhost-only**; only Nginx can reach it.
- `.env.local` / real env files are git-ignored and never committed.
- Update the client fallback text is host-neutral ("AI Assistant is not enabled in
  this environment") — the server's internal fallback JSON is not shown to users.

## Redeploying a new build
```bash
cd /opt/voltflow && git pull   # (or rsync)
./deploy/interserver/deploy.sh
```

## Important
- **This does not replace Vercel.** Keep the Vercel deploy live.
- **This repo currently builds Voltflow 11.7** (production alias still serves 11.6).
  A fresh InterServer build will therefore show **11.7** unless you check out the
  11.6 release. Decide which version you want on the VPS before deploying.
- Do not run these scripts from CI or from Claude — they are for you to run on the
  server, reviewing each step.

# Voltflow — Deployment Package (for Vincent)

**Version:** Voltflow 11.7.2b (schema 11.7) · **Classification:** Internal Alpha / Controlled Bank Pilot Build.
Sanitized for security review + deployment planning. **No secrets included** (see below).

There are three zips:
1. `voltflow-11.7.2b-frontend-sanitized.zip` — React/Vite frontend source (rebuild the UI).
2. `voltflow-11.7.2b-backend-deploy-sanitized.zip` — API/assistant proxy, Node server, deploy scripts, tests, docs.
3. `voltflow-11.7.2b-full-repo-sanitized-for-vincent.zip` — everything non-secret (full review).

## Frontend — build & run
```bash
npm install       # install dependencies
npm run build     # production build → dist/
npm run dev        # local dev server (http://localhost:5173)
```
**Build output:** `dist/` (static files). **Deploy:** upload the *contents* of `dist/` to the
web root, or serve with Nginx (SPA fallback to `index.html`).

## Backend / architecture (important)
- The app is a **static SPA** plus **one optional serverless function**: `api/assistant.js`
  (the Claude AI assistant proxy). The app is fully usable **without** it (it falls back to the
  rule-based "Project Advisor").
- `server/index.js` is a **zero-extra-dependency Node HTTP server** that *reuses* `api/assistant.js`
  so the same assistant logic runs on a normal VPS (not just Vercel serverless). It binds to
  `127.0.0.1` and expects Nginx to reverse-proxy `/api/` to it.
- **There is NO database, NO authentication, and NO cloud storage.** All project data is stored
  in the browser (localStorage). Cloud storage functions are stubs (`CLOUD_STORAGE_CONFIGURED = false`).
- Ready-made VPS deployment files are in `deploy/interserver/` (Nginx config, `setup-ubuntu.sh`,
  `deploy.sh`, PM2 ecosystem, `env.example`, rollback + smoke-test docs, static-only guide).

## Recommended deployment on your server (Nginx + Node + PM2)
```bash
# 1) Provision (Ubuntu): Node LTS + Nginx + PM2 + Certbot + UFW
./deploy/interserver/setup-ubuntu.sh
# 2) (Only if enabling the AI assistant) put the key OUTSIDE the repo:
sudo install -m 600 /dev/null /etc/voltflow/voltflow.env   # ANTHROPIC_API_KEY=...  PORT=3001
# 3) Build + publish dist + start the Node API under PM2:
./deploy/interserver/deploy.sh          # or: ENABLE_API=0 ./deploy/interserver/deploy.sh  (static-only)
# 4) Nginx site + HTTPS:
sudo cp deploy/interserver/nginx-voltflow.conf /etc/nginx/sites-available/voltflow  # edit domain
sudo certbot --nginx -d your-domain.com
```
Nginx serves `dist/` with SPA fallback and proxies `/api/` → `127.0.0.1:3001`. See
`deploy/interserver/README.md` for the full walkthrough and `smoke-test-checklist.md` to verify.

## Security notes (please review)
- **No secrets in any zip.** The real `ANTHROPIC_API_KEY` lives only in `.env.local`, which is
  **excluded**. `.env.local.example` and `deploy/interserver/env.example` are **placeholders**.
- The key is read **server-side only** (`process.env.ANTHROPIC_API_KEY`); it is never bundled
  into the frontend (no `VITE_`-prefixed secret) and never logged. Missing key → safe fallback.
- **Open items for real production** (not solved yet): authentication, role-based access,
  per-tenant data isolation, a database, automated backups, monitoring. See
  `docs/VOLTFLOW_SECURITY_ARCHITECTURE_FOR_VINCENT.md` (written for you) and the
  data-protection + go-live-checklist docs.

## Where to look in the repo
- `docs/VOLTFLOW_SECURITY_ARCHITECTURE_FOR_VINCENT.md` — architecture + your checklist.
- `docs/VOLTFLOW_INTERSERVER_DEPLOYMENT_PLAN.md` — hosting options + cost.
- `docs/VOLTFLOW_DATA_PROTECTION_AND_CONFIDENTIALITY_NOTE.md` — data risk.
- `docs/VOLTFLOW_PHASE_1_GO_LIVE_READINESS_CHECKLIST.md` — go/no-go items.
- `scripts/*.mjs` — regression tests (`npm run test:all`).

Not certified engineering approval; not production-secure until auth + data isolation are added.

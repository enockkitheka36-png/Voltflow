# Voltflow — InterServer Deployment Plan ($3/mo Linux KVM VPS)

**Prepared:** 2026-08-03 · **Repo:** Voltflow 11.7 · **Production (Vercel):** 11.6 at
https://voltflow-alpha.vercel.app · **Classification:** Internal Alpha / Market-Testing.
Analysis + files only — **nothing deployed**, Vercel untouched.

## Phase 1 — Current deployment audit

| # | Finding |
|---|---------|
| 1 | `APP_VERSION` = **Voltflow 11.7** (repo). Vercel production alias serves **11.6** (11.7 was preview-only, held for approval). |
| 2 | `SCHEMA_VERSION` = **11.7**. |
| 3 | Scripts: `dev`, `build`, `preview`, and 17 `test:*` (aggregated by `test:all`). |
| 4 | Vite build → static `dist/`. `vite.config.js` is stock (React plugin; honors `PORT`). No Vercel-only config. |
| 5 | `vercel.json`: framework vite, build `npm run build`, output `dist`, SPA rewrite `"/((?!api/).*)" → /index.html`. |
| 6 | One API route: `api/assistant.js` (serverless handler, `@anthropic-ai/sdk`, key server-side, safe `{configured:false}` fallback). |
| 7 | **Yes — runs as a static frontend only.** The whole app works from `dist/`; only live AI chat needs the API. |
| 8 | The assistant needs a Node/serverless runtime. It's **optional** — absent key ⇒ graceful fallback. |
| 9 | **No code depends on Vercel.** `grep` for `@vercel` / `process.env.VERCEL` in `src/` + `api/` → none. Client calls the **relative** `/api/assistant`, so any host that proxies `/api/` works. |
| 10 | Env is safe: only `ANTHROPIC_API_KEY` (server-only, not `VITE_`-prefixed ⇒ never bundled). `.env*` git-ignored; `.env.local.example` is placeholders. |

**Build:** clean (~14 s, 416 modules). **Tests:** `npm run test:all` → **16 suites, 213 tests, 0 failures.**
**Deployment assumptions today:** Vercel builds `dist`, serves the SPA on its edge/CDN, and runs `api/assistant.js` as a serverless function; env set in Vercel project settings.
**Works on Vercel:** everything. **Needs adaptation for InterServer:** the serverless function must run as a normal Node process behind Nginx (done — `server/index.js` reuses the same handler), and Nginx must provide the SPA fallback + `/api/` proxy that Vercel's rewrite/functions give for free.

## Phase 2 — Hosting options

| Option | Cost | Difficulty | Risk | What works | What breaks | Security | Best use case |
|---|---|---|---|---|---|---|---|
| **A. Vercel prod + InterServer staging/backup** | $3/mo (+$0 Vercel) | Low–Med | **Low** | Full app on VPS; Vercel stays the safety net | Nothing critical (Vercel always live) | Key stays server-side both places | **Recommended** — learn ops with no production risk |
| **B. InterServer static-only** | $3/mo | **Low** | Low | Whole app incl. Project Advisor; no Node to babysit | Live AI chat (graceful fallback) | No server secret at all | Cheapest, simplest first bring-up |
| **C. InterServer full (Nginx+Node+PM2)** | $3/mo | Med | Med | Full app **and** AI assistant | Single box = single point of failure; you own uptime/patching | Key in `/etc/voltflow`, localhost-only API, UFW | Once static is proven and you want AI on the VPS |
| **D. InterServer now, Supabase/cloud later** | $3/mo now | Med–High | Med | Same as C today | Adds a migration project; cloud not in scope yet | As C + future DB auth | When browser-only storage becomes the blocker |
| **E. Stay on Vercel until cloud is ready** | $0 | None | **Lowest** | Everything, today | — | Managed | If you don't need a VPS yet |

**Recommendation for a $3 VPS:** **A + B first** — stand InterServer up **static-only** as
staging/backup while Vercel stays production, then **graduate to C** (enable the Node
API) after it's stable. Only consider moving production after a **3–7 day** clean test.
This gives you a real second host and ops experience with **zero** risk to the live app.

## Phase 3 — Architecture (recommended)
Ubuntu 24.04 LTS, no control panel. **Nginx** serves `dist` with SPA fallback and
proxies `/api/` → **Node** (`server/index.js`, reusing `api/assistant.js`) on
**127.0.0.1:3001**, kept alive by **PM2**. **Certbot** for TLS. **UFW** opens only
22/80/443 (the Node API is never public). Secret in `/etc/voltflow/voltflow.env`
(root-owned, 600). Full diagram + steps: `deploy/interserver/README.md`.

## Phase 9 — Risks & limitations
- **$3 VPS is unmanaged** — you own OS updates/patching (`unattended-upgrades` helps).
- **No Vercel-style auto-deploys** — releases are `git pull && ./deploy.sh` by hand.
- **No global edge/CDN** — single region; add **Cloudflare** (free) in front of the
  domain later for CDN + TLS + DDoS buffer.
- **No Supabase/cloud** — **browser-only storage remains** (unchanged from today).
- **Single point of failure** — VPS down = site down (unless DNS still points to Vercel).
- **SSL renewal** — Certbot auto-renews via systemd timer; verify with `certbot renew --dry-run`.
- **Backups** — snapshot the VPS and/or keep `dist.bak.*` (deploy.sh already does the latter); set up real backups before trusting it with production.
- **Resource limits** — 1 vCPU / ~1 GB RAM is fine to *serve* a static SPA + a light
  Node proxy; do **not** run `npm run build` on a tiny box under load — build in CI or
  locally and rsync `dist` if the VPS struggles.

**Mitigations:** keep Vercel live; InterServer as staging first; Cloudflare later;
promote production only after a successful multi-day test.

## Cost & sizing
- **InterServer VPS:** ~**$3/mo** (their advertised 1 vCPU / ~1 GB slice). Domain
  ~$10–15/yr (optional; can test by IP). Cloudflare free tier optional. **Vercel:** $0.
- **Is $3 enough?** **Yes** to *serve* Voltflow (static SPA + a lightweight Node proxy
  that only forwards to Anthropic). The heavy lifting (Claude inference) is Anthropic's
  API, not the VPS. Caveat: run the **build** locally/CI if 1 GB RAM makes `vite build`
  sluggish, and add swap. It is **not** a substitute for Vercel's global CDN — expect
  higher latency for far-away users until Cloudflare is added.

## What you must do manually
Provide SSH access and run, reviewing each step: `setup-ubuntu.sh` → put the key in
`/etc/voltflow/voltflow.env` (only if enabling AI) → `deploy.sh` → install the Nginx
site + edit the domain → `certbot` → `pm2 startup && pm2 save` → run the smoke-test
checklist. **Claude will not deploy to InterServer** without explicit per-step approval
and server access.

## Next recommendation
1. Bring up InterServer **static-only** as staging (Option B) — prove steps 1–13, 16–19.
2. Enable the Node API (Option C), set the key, verify steps 14–15, 20.
3. Add **Cloudflare** in front of the domain for CDN/TLS.
4. Run it **3–7 days** alongside Vercel; compare uptime/latency.
5. Only then decide whether to move production — and revisit **Supabase** to remove the
   browser-only storage limitation (separate, approved sprint).

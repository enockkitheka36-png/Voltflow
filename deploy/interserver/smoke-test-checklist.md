# Voltflow InterServer — Smoke-Test Checklist

Run after every deploy, in a fresh/incognito browser against the VPS URL
(`http://VPS_IP` first, then `https://your-domain.com` once TLS is up).

> Version note: this repo builds **Voltflow 11.7**. If you intentionally deployed
> the 11.6 release, expect 11.6 in step 2. Match the check to what you deployed.

| # | Check | Pass? |
|---|-------|:-----:|
| 1 | Site loads (no blank page, no Nginx default page) | ☐ |
| 2 | Footer/sidebar shows the expected **Voltflow** version | ☐ |
| 3 | Clean startup — "Welcome to Voltflow" start screen | ☐ |
| 4 | No old demo auto-loaded (no "Karen Homeowner") | ☐ |
| 5 | Dashboard loads after picking a demo | ☐ |
| 6 | Inverter + Safety shows the DC:AC / Technical Basis explanation | ☐ |
| 7 | Solar Borehole tab opens | ☐ |
| 8 | Borehole calculation produces results (TDH, pump, PV, tank) | ☐ |
| 9 | BoQ includes `Borehole:` rows when the module is enabled | ☐ |
| 10 | Proposal includes the Solar Borehole section when enabled | ☐ |
| 11 | Save / Load works (browser localStorage) | ☐ |
| 12 | Export JSON downloads; Import review + Apply works | ☐ |
| 13 | Client / Engineer / Technician views switch correctly | ☐ |
| 14 | Assistant shows safe fallback when the API key is **absent** | ☐ |
| 15 | Assistant returns a reply when the API key **is present** | ☐ |
| 16 | Hard-refresh on a deep route (e.g. `/`, then navigate) does **not** 404 | ☐ |
| 17 | HTTPS works (padlock; `http://` redirects to `https://`) | ☐ |
| 18 | Browser console shows **no errors** during the flow | ☐ |
| 19 | Nginx logs clean: `sudo tail -n 50 /var/log/nginx/error.log` | ☐ |
| 20 | (API mode) PM2 process **online**: `pm2 status` → voltflow-api `online` | ☐ |

## Handy server-side checks
```bash
# API health (localhost, never public):
curl -s http://127.0.0.1:3001/api/health          # {"ok":true,...,"configured":true|false}

# API through Nginx (public path):
curl -s https://your-domain.com/api/health

# Assistant round-trip through Nginx (only meaningful with a key set):
curl -s -X POST https://your-domain.com/api/assistant \
  -H 'Content-Type: application/json' -d '{"message":"hello"}'

# Nginx + PM2 status:
sudo nginx -t && sudo systemctl status nginx --no-pager | head
pm2 status && pm2 logs voltflow-api --lines 40
```

## If a check fails
- Blank page / 404 on refresh → SPA `try_files … /index.html` block missing or web
  root wrong. Re-check `nginx-voltflow.conf` root path and reload.
- `/api/*` 502 → Node API not running (`pm2 status`) or wrong proxy port.
- Assistant always "not enabled" → key not in `/etc/voltflow/voltflow.env`, or PM2
  started before the file existed → `pm2 restart voltflow-api --update-env`.
- Never see the raw key or env var name in the browser — if you do, **stop** and
  report it; that must never happen.

# Voltflow InterServer — Static-Only Mode

The simplest, lowest-risk deployment: serve the built `dist/` with Nginx and run
**no Node process at all**. Recommended for the first InterServer bring-up.

## How to deploy static-only
```bash
cd /opt/voltflow
ENABLE_API=0 ./deploy/interserver/deploy.sh
```
Then edit the Nginx site and **delete the `location /api/ { … }` block** (or leave
it — a 502 from a missing backend is treated by the frontend as "assistant not
enabled"; removing it is just cleaner). Reload:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

## What works (everything except live AI chat)
- Full app: onboarding, dashboards, load assessment, PV/battery/inverter sizing,
  **inverter/PV coherence + DC:AC explanation**, **Solar Borehole** module, BoQ,
  Proposal, formal reports/PDF, Delivery, Compliance, Evidence/Audit.
- **Project Advisor** — the rule-based guidance — works fully (no key needed).
- Save/Load, Export/Import (all browser localStorage).
- Client / Engineer / Technician views.

## What does NOT work
- The **Claude AI Assistant** chat. It shows the safe fallback:
  *"AI Assistant is not enabled in this environment. Project Advisor is still
  available."* No error, no secret, no env-var name is shown.

## Enabling the API later (no rebuild of the frontend needed)
1. Put the key outside the repo:
   ```bash
   sudo install -m 600 /dev/null /etc/voltflow/voltflow.env
   sudo nano /etc/voltflow/voltflow.env     # ANTHROPIC_API_KEY=...  PORT=3001  NODE_ENV=production
   ```
2. Start the Node API:
   ```bash
   pm2 start deploy/interserver/pm2.ecosystem.config.cjs && pm2 save
   curl -s http://127.0.0.1:3001/api/health   # configured: true
   ```
3. Ensure the `location /api/ { … }` proxy block is present in the Nginx config,
   then `sudo systemctl reload nginx`.
4. Re-run smoke-test steps 14–15 and 20.

The frontend is identical in both modes — enabling the API is purely a server-side
change, so you can flip it on/off without touching `dist/`.

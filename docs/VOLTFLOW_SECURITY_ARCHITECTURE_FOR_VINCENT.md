# Voltflow — Security & Architecture Pack (for Vincent)

**Purpose:** basis for a technical call with Vincent on hosting, auth, data and go/no-go for the bank pilot.
**Build:** 11.7 preview / 11.6 production · **Classification:** Internal Alpha / Bank Pilot Readiness.
This is an engineering discussion pack, **not** a security certification.

## 1. Current architecture (as-built)
- **Frontend:** React 18 + Vite single-page app (`src/App.jsx` monolith + `src/utils/*` pure engines). Build → static `dist/`.
- **Backend/API:** one optional serverless function `api/assistant.js` (Claude assistant). The app is fully usable **without** it (Project Advisor fallback).
- **Hosting:** Vercel (project `voltflow-alpha`). Production alias public; per-deploy preview URLs are login-walled by Vercel.
- **Storage:** **browser localStorage only.** No database. Projects, feedback and the audit log live in the user's browser. Export/Import = JSON files.
- **Environment variables:** `ANTHROPIC_API_KEY` server-side only (not `VITE_`-prefixed → never bundled). `.env.local` git-ignored; `.env.local.example` has placeholders.
- **Assistant fallback:** if the key is missing/misconfigured, the API returns a safe `{configured:false}` and the UI shows a generic "not enabled in this environment" message — no key, no env-var name, no stack trace.
- **Export/Import:** deterministic JSON; contains project data only (no secrets). Import is staged (review → apply) with version warnings.
- **Access model today:** **none.** "View modes" (engineer/technician/client/bank) are **presentation only** — they hide UI, they are **not** access control. Anyone with the URL and the same browser sees the same data.

## 2. Recommended early-SaaS architecture (target)
- **Frontend hosting:** keep Vercel (managed TLS, CDN, instant rollback).
- **Backend API:** small Node/serverless API for auth + data (already have a portable Node wrapper for the assistant).
- **Database:** managed Postgres (e.g. **Supabase**) with row-level security.
- **Authentication:** email/password or SSO via the DB provider; sessions via secure, http-only cookies or short-lived tokens.
- **Role-based access:** roles (admin / engineer / sales / bank / client) enforced **server-side**, not just in the UI.
- **Tenant/client data separation:** every record carries a `tenant_id`; row-level security so Solarize, the bank and future EPCs never see each other's data.
- **Audit logging:** move the existing local audit log server-side, per tenant.
- **Backups:** automated DB backups + point-in-time recovery.
- **Monitoring:** uptime + error monitoring + alerting.
- **Deployment pipeline:** Vercel (frontend) + managed DB; staged preview → production with rollback.

## 3. Deployment options
| Option | Fit for bank pilot |
|---|---|
| **Keep Vercel (now)** | ✅ Best today: managed TLS/CDN/rollback. Still browser-only storage → controlled pilot only. |
| **InterServer VPS — staging only** | ✅ Good for learning/ops + Vincent hardening; not bank production. |
| **InterServer VPS — production (Nginx+Node+PM2)** | ⚠️ Possible but **you own** patching/backups/TLS/monitoring; risky for bank data on a $3 box unless Vincent hardens it. |
| **Supabase + Vercel** | ✅ **Recommended target** for real multi-user, access-controlled, backed-up data. |
| **Future managed cloud** | Defer until scale/compliance demands it. |

## 4. Recommendation
For the bank pilot, **prioritise security and stability over cheapest hosting.** Keep **Vercel**
for the frontend now. A **$3 InterServer VPS is fine for staging/learning** but **not** as bank
production unless Vincent hardens it (firewall, SSH keys, TLS auto-renew, backups, logs,
recovery). **Real bank production requires HTTPS + access control + per-user/tenant data
separation + backups + logs + a recovery plan** — which means adding **Supabase (or equivalent)
auth + DB**. Until that exists, run only a **controlled pilot** with limited users and
non-sensitive/test data.

## 5. Concrete security measures (status)
| Measure | Status |
|---|---|
| Authentication | ⛔ none (needs Supabase/auth) |
| Authorization (server-enforced roles) | ⛔ none (UI-only view modes) |
| Tenant/client data separation | ⛔ none (browser-only) |
| HTTPS / encryption in transit | ✅ Vercel managed TLS |
| Secure cookies/session strategy | n/a until auth exists → use http-only, secure, SameSite |
| Database security | n/a until DB exists → row-level security + least privilege |
| Audit logs | ✅ local; ⬜ server-side per tenant |
| No secrets in frontend | ✅ verified |
| Safe error messages | ✅ verified |
| Backup & restore | 🔎 manual Export JSON; ⬜ automated |
| Incident response owner | ⬜ name Vincent or founder for the pilot |
| Export / delete data process | ✅ export; 🔎 delete = clear local data |

## 6. Vincent checklist (please confirm)
- [ ] Hosting model for the pilot (Vercel now? VPS staging? Supabase target?)
- [ ] Auth model (provider, session strategy, MFA?)
- [ ] Data storage model (browser-only pilot vs move to DB before bank data)
- [ ] Backup strategy (frequency, retention, restore test)
- [ ] SSL/TLS (managed vs Certbot on VPS; auto-renew verified)
- [ ] Logging/monitoring (what, where, who watches)
- [ ] Environment-variable handling (server-only; rotation)
- [ ] Deployment rollback (Vercel instant / VPS `dist.bak`)
- [ ] Bank data-protection risks (what data may be entered in the pilot; ODPC/DPA)
- [ ] **Technical go/no-go recommendation for the bank pilot**

## Honest security posture summary
Voltflow is **secure at the secret-handling and error level** (no key/stack-trace leakage) but
has **no authentication and no data isolation** — storage is per-browser. That is acceptable for
a **supervised, non-sensitive pilot**, and **not** acceptable for storing confidential bank
customer data at volume. The single biggest pre-bank-production task is **auth + tenant-isolated
storage** (Supabase), which is Vincent's call to scope.

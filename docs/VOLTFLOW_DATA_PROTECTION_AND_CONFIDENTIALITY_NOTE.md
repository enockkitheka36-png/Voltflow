# Voltflow — Data Protection & Confidentiality Note

**For:** Mary + Vincent · **Build:** 11.7 · **Classification:** Internal Alpha / Bank Pilot Readiness.
Business/technical planning note — **not legal advice** and **not** a compliance certification.

## 1. What Voltflow collects
Lead/client details (name, location, contact where entered), site/survey inputs, load lists,
system-design inputs/outputs, quotes/BoQ/proposal content, project tasks/stages, an activity
(audit) log, and optional tester feedback. Optionally, a limited project **summary** is sent to
the Claude assistant **only if** the AI is enabled and the user asks it a question.

## 2. Where the data is stored
**In the user's browser (localStorage) only.** There is **no database and no cloud storage.**
Keys include the saved-projects store, feedback store and audit log. Export/Import moves data as
JSON files the user controls.

## 3. Who can access it
Anyone using **that browser profile** on that device. There is **no login and no access
control** — "view modes" hide UI but do not restrict data. Data does not sync between devices or
users.

## 4. Browser-only or cloud?
**Browser-only.** Clearing site data, using another browser/device, or a different profile means
the data is not there. This is the central data-risk fact for the bank conversation.

## 5. Can data be exported?
Yes — **Export Project JSON** (per project) and an "export all local data" backup. Exports
contain project data only; **no secrets/keys** are included.

## 6. Can data be deleted?
Yes — delete a saved project, or use "Reset local data" (which can preserve feedback separately).
Because storage is local, deletion is per-browser; there is no server copy to purge.

## 7. Bank vs Solarize data separation
**Not separated today.** All projects share one local store per browser. True separation
requires accounts + a database with tenant isolation (not yet built). For the pilot, separation
must be **operational** (different browsers/devices/profiles per party) — not enforced by the app.

## 8. Future EPC vs Solarize separation
Same answer: requires **multi-tenant cloud** (a `tenant_id` + row-level security). Until then,
each company must be kept on its own instance/browser by process, not by software.

## 9. Audit logs
Yes — a **local, per-browser** activity log (project created, loads applied, sizing changed,
import/export, report generated, warning overridden, etc.). Not tamper-proof and not
centralized. A server-side per-tenant audit log is a Phase-2 item.

## 10. Sensitive data in URLs / console / exports / errors
- **URLs:** no personal data in URLs/query strings (SPA routing is internal state). ✅
- **Console:** no secrets or personal data logged; errors log a safe message only. ✅
- **Exports:** project data only, no secrets. ✅
- **Errors:** generic, user-safe; no stack traces / env-var names to users. ✅

## Data-risk position (plain English)
Voltflow **handles secrets and errors safely**, but it is a **single-browser tool with no login
and no data isolation.** That is fine for a **supervised pilot using test or non-sensitive
data**, and **not** appropriate for storing confidential bank customer records at volume. Before
sensitive bank data is entered, add **auth + tenant-isolated cloud storage** and agree a **DPA**.

## UI warnings added (this sprint)
- A persistent banner: **"Voltflow Internal Alpha / Controlled Bank Pilot Build."**
- A data notice on Save/Load and Bank Pilot Mode: **"Projects are stored locally in this browser
  unless cloud storage is enabled. Do not enter highly sensitive customer data until cloud access
  control is enabled."**

## Recommended pilot data rules (for Mary/Vincent to accept)
1. Use **test or non-sensitive** customer data during the pilot.
2. One agreed **browser/device per party**; back up via Export JSON.
3. No storing of IDs, financial account numbers or confidential bank records until cloud auth exists.
4. Agree an **NDA/DPA** and name a data owner before any real customer data is entered.

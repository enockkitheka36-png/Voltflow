# Voltflow — Bank Pilot Product Definition

**For:** Mary (Solarize) + bank pilot stakeholders · **Build:** Voltflow 11.7 (preview) / 11.6 (production)
**Classification:** Internal Alpha / Bank Pilot Readiness Build. Not full production SaaS; not certified engineering approval.

## What Voltflow is, in one line
A guided solar-project builder that turns a lead + basic site/bill info into standardized,
explainable solar quotations and proposals — and tracks each job's status — without needing a
solar engineer for every quote.

## 1. Problem statement

**Solarize internal users.** Today the quoting/tracking process is half-manual, half-Zoho; not
integrated. Producing consistent quotes and variants is slow and person-dependent. Voltflow
standardizes sizing, quotes and workflow so sales/ops move faster with fewer errors.

**Bank pilot.** Bank staff run a high-volume, standardized process. They are not solar
engineers and should not see the engineering workspace. They need a **simple guided flow** to
capture a lead, pick a standard package, get 2–3 quote variants and a clean proposal, then
submit to Solarize — with strong data confidentiality.

**Future EPC SaaS clients (e.g. Sytech).** Other EPCs face the same quoting/tracking pain.
Voltflow can become a configurable, multi-client SaaS — provided each client's data is isolated
and the product is properly licensed.

## 2. Value proposition

| Audience | Value |
|---|---|
| **Sales team** | Fast, consistent quotes + variants; a clean client-facing proposal; less rework. |
| **Operations team** | Standardized data, task/stage tracking, an activity/audit log, export/reporting. |
| **Management** | Readiness score, pipeline visibility, evidence/audit record, consistent output quality. |
| **Bank RMs / employees** | A simple guided lead→quote flow, standard packages, clear next action — no engineering knowledge required. |
| **Future EPCs** | A configurable quoting/workflow platform they can subscribe to. |

## 3. MVP+ features required for the bank pilot
- **Guided lead capture** (Bank Pilot Mode) — simple, standardized steps.
- **Client/site information** — basic fields, required-field validation.
- **Standard package / quote variants** — Good/Better/Best (2–3 per customer) via existing scenario cards.
- **Load/project assumptions** — sensible defaults from templates; editable by Solarize.
- **Quote generation** — deterministic sizing + indicative cost.
- **Proposal summary** — clean client-facing report (existing Proposal + Client report).
- **Task/stage & approval status** — existing Delivery stages + "submit for Solarize review".
- **Export/report** — PDF + JSON export (existing).
- **User roles (simulation)** — view modes today (engineer/technician/client + new **bank**); real auth is a Phase-2/Vincent item.
- **Audit trail / activity log** — existing local audit log (project created, applied, exported, etc.).
- **Secure data handling** — no secrets in the client; safe errors; **but** browser-only storage today (see data-protection note).
- **Simple dashboard** — readiness + next best action.

Status: most of the above **already exists in 11.7**; the pilot work is a **simplified Bank
Pilot Mode**, a **data-risk banner**, and the governance around access/hosting.

## 4. Explicitly excluded from the bank pilot
- Full public SaaS self-serve onboarding.
- Custom engineering for every bank user.
- Autonomous AI design approval (AI only explains/drafts).
- Live Zoho integration.
- Live payment / M-PESA integration.
- Full supplier API (asset library is a catalogue only, no live feed).
- Real multi-tenant cloud auth/isolation — **required before wider or truly sensitive bank use** (see security + data docs); the pilot runs under controlled, limited conditions.

## Acceptance
Mary can read this and understand what Voltflow is, what it does today, and what the bank pilot
scope is. The remaining pilot work is **readiness + governance**, not new features.

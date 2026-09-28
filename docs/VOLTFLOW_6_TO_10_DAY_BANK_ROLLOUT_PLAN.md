# Voltflow — 6-to-10-Day Bank Pilot Rollout Plan

**Build:** 11.7 · **Classification:** Internal Alpha / Bank Pilot Readiness. A practical timeline, not a wish list.
Assumes a **controlled pilot** (limited users, test/non-sensitive data), not full bank production.

## Day 1 — Align & freeze
- Confirm repo/version (done: 11.7 preview, 11.6 prod).
- **Decision:** hosting + security posture with Vincent (Vercel now; Supabase later).
- **Freeze scope** to the bank-pilot flow — no new modules.
- Agree the **Bank Pilot Mode** flow (lead → package → site/bill → variant → proposal → submit → track).
- *Deliverable:* signed scope note.

## Day 2–3 — Build the pilot surface
- Land **Bank Pilot Mode** (simplified guided flow) + **pilot banner** + **data-risk warning** (this sprint).
- Fix any **P0 security/UI** items surfaced (safe errors already in; verify no leaks).
- Prepare **standard packages / quote variants** (Good/Better/Best presets + templates).
- Write **UAT scripts** (see UAT plan).
- *Deliverable:* preview build + UAT scripts ready.

## Day 4–5 — Internal Solarize testing
- **Sales user** runs the quote flow end-to-end; **Ops user** runs task/stage tracking + export.
- **Mary review** of the client proposal + Bank Pilot Mode.
- **Vincent security review** using the security pack + checklist.
- Log issues by severity; fix P0/P1.
- *Deliverable:* UAT results v1 + Vincent's initial posture.

## Day 6–7 — Bank-like simulation
- Run a **controlled bank demo** or an internal "bank user" simulation (someone non-technical).
- Fix urgent issues only; keep scope frozen.
- Prepare the **fallback plan** (revert to existing Zoho/manual tools) and write it down.
- *Deliverable:* simulation results + fallback plan.

## Day 8–10 — Go/No-Go
- Collect: UAT sign-off (Mary), security sign-off (Vincent), banner visible, fallback ready.
- **Record a written go/no-go.**
- If **GREEN:** run a **limited** pilot (few users, test data), keep Vercel, monitor daily.
- If **RED:** fall back to existing tools; schedule the fixes (auth + cloud).
- *Deliverable:* recorded decision.

## What's realistic in 6–10 days
✅ Bank Pilot Mode, banner, data warnings, standard packages/variants, UAT, Vincent review,
controlled pilot on Vercel, fallback plan.

## What must be deferred
⛔ Real authentication + multi-tenant cloud (Supabase), automated backups/monitoring, live Zoho,
payments/M-PESA, supplier API. These are **required before sensitive/at-scale bank production**
but are **not** achievable safely in this window.

## Who tests first (order)
1. You (founder) — smoke every path. 2. Solarize sales + ops — real workflow. 3. Mary — review.
4. Vincent — security. 5. Bank-like tester. 6. (Only if green) a real bank user, supervised.

## Test scenarios
See `VOLTFLOW_BANK_PILOT_UAT_TEST_PLAN.md` (15 scenarios).

## Ready criteria (all must hold)
- No critical bugs; no raw security/error leaks.
- Standard quote flow works end-to-end; export/report works.
- Users understand the next action at each step.
- **Data-storage risk explicitly accepted or mitigated** (test data only, agreed browser).
- Vincent signs off the security posture for a controlled pilot.
- Mary signs off pilot use; fallback plan exists.

## Fallback criteria (any one → NO-GO)
- Broken quote flow; unreliable proposal/report.
- Unclear data protection or unaccepted data-storage risk.
- No access control where the bank needs it (for sensitive data).
- Unstable deployment or raw errors visible.
- Bank users would be confused.
- Vincent advises against it.

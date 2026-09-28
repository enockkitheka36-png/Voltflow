# Voltflow 11.6 — Market-Ready Alpha Audit (Phase 2)

Audited against the real repo (11.5.2 baseline). Findings classified; ✅ = fixed in 11.6, ▶ = deferred/next.

## Personas covered
EPC owner, sales manager, field technician, design engineer, procurement officer, homeowner/client, C&I client, investor/partner.

## Findings

| # | Area | Class | Finding | Status |
|---|---|---|---|---|
| 1 | Assistant | security/env, P0 | Client fallback named `ANTHROPIC_API_KEY` / Vercel setup in the UI | ✅ generic "not enabled in this environment" wording; server never leaks the key |
| 2 | Floating buttons | UI/UX, P0 | AI + Feedback buttons used magic offsets; long labels could cover inputs on mobile | ✅ single `.vf-help-dock`, icon-collapse < 640 px |
| 3 | Inverter/PV | calculation clarity, P1 | 12 kW / 4.2 kWp / 0.35 DC:AC shown only as a red metric | ✅ coherence engine + explanation + corrective options |
| 4 | String sizing | calculation clarity, P1 | "Panels/string = 12" but design uses 7 — confusing | ✅ requested/effective/max-by-voltage + note |
| 5 | Inverter sizing | technical trust, P1 | No load-diversity control; peak assumed all loads run at once | ✅ running/surge diversity factors + basis selector |
| 6 | Water pumping | product gap, P1 | No water-first borehole design; pump only enterable as a load | ✅ Solar Borehole module (engine + tab + integration) |
| 7 | Data persistence | workflow, P1 | Browser-only storage not obvious enough to new users | ▶ notice present on Save/Load + start screen; prominence can improve |
| 8 | PDF | workflow, P2 | Single proposal/full report; no client/engineer/technician split | ▶ next sprint (avoid destabilising pdfGenerator.js) |
| 9 | Sidebar | UI/UX, P2 | Groups usable but not the exact Track-A taxonomy | ▶ partial (added Specialist Modules); full relabel cosmetic |
| 10 | Dashboard | UI/UX, P1 | Already a readiness command centre (11.5.2) | ✅ retained; borehole/coherence surface through it |
| 11 | Console/build | technical trust, P0 | — | ✅ zero console errors; clean build; 189 tests green |
| 12 | Env hygiene | security/env, P1 | Unrelated `gaseasy-*` npm scripts; `.env.local` must stay uncommitted | ✅ gaseasy scripts removed; `.env.local.example` placeholders only; not a git repo |

## Verdict
The live app is **safe to show to selected internal testers and trusted external reviewers**. It remains **Internal Alpha preparing for market validation — not full production SaaS.** No certified engineering or hydraulic approval is claimed.

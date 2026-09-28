# Voltflow 11.7 — Evidence Reports + Cloud-Ready Project Record

**Build:** Voltflow 11.7 · **Schema:** 11.7 · **Live (11.6):** https://voltflow-alpha.vercel.app
**Classification:** Voltflow Internal Alpha / Market-Testing Build. **Not full production SaaS.** No certified engineering approval; borehole pump selection is not final without the pump curve and borehole test report.

Moves Voltflow toward a trusted market-testing platform: audience-specific reports, an auditable evidence record, an activity trail, a borehole test-report/pump-curve shell, a Kenya-first compliance workspace and pilot KPIs. **No new app, sizing engine unchanged, no Atlas / M-PESA / monitoring, no cloud yet** (structure is cloud-ready).

## P1 — Three-mode PDF/report system
`src/utils/reportBuilder.js` (pure) builds structured content for four audiences; `src/utils/reportPdf.js` renders it to A4 via jsPDF (separate from the legacy `pdfGenerator.js`, which is untouched). Buttons live on the **Proposal** tab.
- **Client Proposal** — recommended system, benefits, borehole water solution, investment, next steps. **Internal technical detail hidden** (no cold Voc / DC:AC / cable / string internals).
- **Engineer Review** — technical basis (PV/inverter reason + DC:AC, string, cold Voc, drops, battery/night), readiness, assumptions, design limitations.
- **Technician Handover** — site / commissioning (+ borehole) checklists, safety warnings.
- **Lender / Grant Readiness** — summary, financials (payback, DSCR, LCOE), **assumptions AND unresolved risks**, evidence/approval block.
Every report carries the feasibility + no-certification disclaimer (and the borehole pump-selection caveat when enabled).

## P2 — Canonical project evidence record (`src/utils/projectEvidence.js`)
`project.evidence`: inputSource, created/updatedAt, responsibleUser, confidenceLevel, version, approvalStatus, changedFields, reportFromVersion, history[]. `recordEvidenceChange` bumps the version and appends history; `markReportGenerated` stamps the version a report came from (set when a report is generated). Cloud-ready shape; edited on the **Evidence & Audit** tab.

## P3 — Audit trail (`src/utils/auditLog.js`)
Per-browser activity log (newest-first, capped 500). Events wired: **project created, load inventory applied, sizing changed, import performed, export performed, proposal generated, PDF exported, warning overridden**. Viewer + clear/refresh on the **Evidence & Audit** tab. (Borehole-changed and stage-changed are available event types for future wiring.)

## P4 — Borehole pump-curve / test-report shell
Borehole model gains `testReportRef, testDurationHours, pumpModel, pumpCurvePoints[], selectedOperatingPoint, validationStatus`. The Solar Borehole tab adds a **Pump curve & borehole test report** card; `validateBoreholeOperatingPoint` compares the selected point to the design duty and **never claims final selection** — it always shows *"Final pump selection requires pump curve and borehole test confirmation."*

## P5 — Compliance workspace (`src/utils/complianceEngine.js`)
Kenya-first checklist on `project.compliance`, new **Compliance** tab: EPRA licensing/signatory, net-metering applicability, NEMA screening, county/building/fire, data consent/ODPC, procurement documentation, battery/e-waste handling, borehole/water permits (WRA) placeholder. Per-item status + notes + a readiness score. A workflow aid — it does not grant approvals or certify compliance.

## P6 — Pilot evidence
`project.pilotEvidence` + a KPI card on the Evidence tab: survey→design time, proposal-prep time, errors prevented, savings, avoided fuel, outcome notes; actual-vs-modelled / uptime / maintenance-response are shown as **"monitoring required"** placeholders.

## P7 — Tests
Two new pure suites — `reports-regression.mjs` (9) and `evidence-audit-regression.mjs` (15) — plus source-checks for the UI/audit wiring. `npm run build` clean; **`npm run test:all` → 16 suites, 213 tests, 0 failures.** Old projects migrate safely via `normalizeEvidence` / `normalizeCompliance` / `normalizePilotEvidence` / `normalizeBorehole` (schema 11.7). Browser-verified: reports generate + log, Compliance/Evidence tabs render, borehole test-report card, zero console errors.

## Files changed
**New:** `reportBuilder.js`, `reportPdf.js`, `auditLog.js`, `projectEvidence.js`, `complianceEngine.js`, `reports-regression.mjs`, `evidence-audit-regression.mjs`, this doc.
**Extended:** `App.jsx` (report buttons, Compliance + Evidence tabs, borehole test-report card, audit wiring, defaults + migration), `boreholeEngine.js` (test-report fields + `validateBoreholeOperatingPoint`), `navigation.js` (compliance/evidence tabs), `schemaMigration.js` (11.7), `package.json`, `market-ready-alpha-regression.mjs` (version-agnostic).

## Remaining limitations
- **Cloud not enabled** — evidence/audit/compliance persist in the browser only; the shapes are cloud-ready for a future Supabase sprint.
- Audit trail is **per browser** (not cross-device) and covers the wired events above.
- Borehole pump-curve is a **feasibility shell** — final selection still needs the pump curve + borehole test report.
- Report PDFs are functional/structured (not brand-designed layouts).
- **Not certified engineering approval.** Compliance workspace tracks readiness; it does not confer regulatory approval.

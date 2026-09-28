# Voltflow 11.7.1 — Bank Pilot Baseline Verification (Phase 0)

**Date:** 2026-08-04 · **Repo:** `…\Documents\APPS\solis\solar_calc`
**Classification:** Voltflow Internal Alpha / Bank Pilot Readiness Build.
Gate: baseline reported **before** any code changes.

## Verification

| # | Check | Result |
|---|-------|--------|
| 1 | Current branch | **Not a git repo** (no VCS; deploys via `npx vercel`) |
| 2 | `APP_VERSION` | `Voltflow 11.7` |
| 3 | `SCHEMA_VERSION` | `11.7` |
| 4 | Production still 11.6? | **Yes** — production alias `voltflow-alpha.vercel.app` serves 11.6; 11.7 has only ever been deployed to **preview** (login-walled) and was held for approval |
| 5 | Preview has 11.7 work? | **Yes** (Evidence Reports + Studio preview builds) |
| 6 | 11.7 Evidence Reports exist? | ✅ `reportBuilder.js`, `reportPdf.js`, `auditLog.js`, `projectEvidence.js`, `complianceEngine.js` |
| 7 | Voltflow Studio exists? | ✅ `projectTemplates.js`, `scenarios.js`, `explainers.js`, `assetLibrary.js`, `studioBlocks.js`, `proposalStudio.js`, `ExplainDrawer.jsx`; `VoltflowStudio` + `ProposalStudioPanel` in `App.jsx` |
| 8 | package.json scripts clean? | ✅ 0 `gaseasy` refs (removed in 11.6); 22 `test:*` scripts |
| 9 | `.env.local` ignored? | ✅ `.gitignore`: `.env*` + `!.env.local.example` |
| 10 | No secrets in frontend? | ✅ only `ANTHROPIC_API_KEY`, server-side (`api/assistant.js`), **not** `VITE_`-prefixed → never bundled. The two `ANTHROPIC_API_KEY` occurrences in `src/` are code comments, not client UI |
| 11 | Tests pass? | ✅ see below |

## Build & tests
```
npm run build   → ✓ built (~36s, 0 errors)
npm run test:all → 21 suites, 241 tests, 0 failures
```
Suites: workflow 24, energy 13, ui 13, startup 16, delivery 15, input 12, readiness 17,
night 9, navigation 12, coherence 15, borehole 13, borehole-ui 12, market 11, proposal 7,
reports 9, evidence 15, studio 6, templates 7, proposal-studio 5, assets 4, explainers 6.

## Current deployment status
- **Production:** Voltflow **11.6** (live, stable, public).
- **Preview:** Voltflow **11.7** (Evidence Reports + Studio), login-walled, **not promoted**.

## Is production promotion safe, or should it wait?
**Technically safe** (green build + tests, browser-verified), **but this sprint recommends
waiting.** The 11.7.1 goal is *bank-pilot governance*, and promotion should be a deliberate
go/no-go decision made **with** Mary and Vincent after: (a) the Bank Pilot Mode + data-risk
banner land, (b) the security/data-protection docs are reviewed, and (c) Vincent signs off the
hosting/access posture. Promoting purely on green tests would skip the governance the bank
requires. **Recommendation: hold production; proceed with the pilot-readiness pack and code,
then decide.**

## Note on versioning
11.7 currently bundles **both** the Evidence-Reports work and Voltflow Studio (neither shipped
to production). 11.7.1 adds bank-pilot readiness on top. No downgrade; all prior 11.7 features
are preserved.

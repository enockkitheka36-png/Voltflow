# Voltflow 11.6 — Repo Baseline Verification (Phase 0)

**Date:** 2026-08-03
**Verified by:** direct inspection of the actual repository (not the Solarise documents workspace, not any `.txt` backup).
**Repo path:** `C:\Users\Administrator\OneDrive\Documents\APPS\solis\solar_calc`
> Note: the project folder was relocated from `…\Documents\solis\solar_calc` into `…\Documents\APPS\solis\solar_calc` (OneDrive reorganisation). Same repo, all history/state intact.

## This IS the real latest Voltflow repo
- `APP_VERSION = "Voltflow 11.5.2"` (in `src/utils/schemaMigration.js`) — matches the live production observation.
- Modern numeric input handling is present: **`SmartNumberField`** exists in `src/components/ui.jsx` (type=text/inputMode=decimal, blank-tolerant) — i.e. NOT the old `onChange(Number(e.target.value))` pattern.
- **No** `Karen Homeowner` startup default; clean-startup gate is present (verified previously, startup suite green).
- The old `.txt` exports in the parent folder (`Solarise Pro V2.1.txt`, `Solar calc tool…`, etc.) are **stale v2/v5 backups** and were **not** used as a source of truth.

## Baseline facts

| Check | Result |
|---|---|
| 1. Current branch | **Not a git repo** (no `.git`); deploys go via `npx vercel` from the folder (`.vercel/` linked) |
| 2. APP_VERSION | `Voltflow 11.5.2` |
| 3. SCHEMA_VERSION | `11.5` |
| 4. `package.json` | ✅ exists |
| 5. `src/` | ✅ exists |
| 6. `api/` | ✅ exists (`api/assistant.js` serverless fn) |
| 7. `scripts/` | ✅ exists |
| 8. `docs/` | ✅ exists |

### 9. 11.5.2 files
| File | Status |
|---|---|
| `src/utils/readinessEngine.js` | ✅ |
| `src/utils/nightAutonomy.js` | ✅ |
| `src/utils/navigation.js` | ✅ |
| `src/utils/deliveryEngine.js` | ✅ |
| `scripts/readiness-alerts-regression.mjs` | ✅ |
| `scripts/night-autonomy-regression.mjs` | ✅ |
| `scripts/navigation-regression.mjs` | ✅ |
| `src/utils/inverterCoherence.js` | ❌ not yet (to be added — Phase 7) |
| `src/utils/boreholeEngine.js` | ❌ not yet (to be added — Phase 9) |

### 10–15. 11.5.2 features present
| Feature | Location |
|---|---|
| 10. SmartNumberField | ✅ `src/components/ui.jsx` |
| 11. Project Advisor | ✅ `ProjectAdvisorPanel` in `App.jsx` (reads central readiness engine) |
| 12. Action Center | ✅ `FloatingActionCenter` in `App.jsx` |
| 13. Readiness Dashboard | ✅ `ReadinessDashboard` in `App.jsx` (nav `field-dashboard`) |
| 14. Proposal Gate | ✅ `ProposalGateModal` in `App.jsx` |
| 15. Client / Engineer / Technician views | ✅ `normalizeViewMode` + `project.viewMode` routing |

## Baseline build & tests

```
npm run build   → ✓ built in ~11.7s (416 modules, 0 errors)
npm run test:all → 9 suites, 131 tests, 0 failures
```
`test:all` exists and runs: workflow (24), energy (13), ui (13), startup (16), delivery (15), input (12), readiness (17), night (9), navigation (12).

## Conclusion
**Baseline is green and this is the authoritative 11.5.2 repo.** Safe to implement Voltflow 11.6 on top of it. Note the deployment rule for this sprint: **preview only; production requires explicit approval.**

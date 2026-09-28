# Voltflow 11.5.2 — Readiness Sync Audit

**Build audited:** Voltflow 11.5.1

## Root causes

### 1. Load Inventory never marks complete
`FieldDashboard` (App.jsx ~4374) and `NewProject` (~4486) build their survey checklist from `survey` only, with two steps **hardcoded**:

```js
{ key: "loads", label: "Load Inventory", done: false },   // never true
{ key: "safety-risks", label: "Safety Review", done: false },
```

`FieldDashboard` isn't even passed `loadItemsV2`, `sizing`, or draft state — so no matter how complete the load table is, progress is stuck. This is the reported bug.

### 2. Safety / compliance progress is static
Same hardcoded `Safety Review: false`. Real safety signals (cold Voc, cable drop, BMS, phase, earthing) live in `sizing` and `readiness.js` but the survey dashboards never read them.

### 3. Missing fields not surfaced
There is no single list of "what's missing." `readiness.js` produces `blockers`/`warnings`, `projectAdvisor.js` produces `missingData`, and the dashboards compute their own step flags — three separate, partial views.

### 4. Dashboard and Project Advisor read different signals
- **Field dashboard:** survey-only step flags (+ hardcoded false).
- **Sizing Overview dashboard:** `computeGovernanceStatus(project, sizing, readiness)` + `calculateReadiness`.
- **Project Advisor (11.5.1):** `buildProjectAdvice(project, sizing, readiness, loadCount)`.

They can therefore disagree (e.g. Advisor says "ready" while the field checklist still shows Load Inventory pending).

### 5. Draft vs applied loads
`hasUnappliedLoadChanges` exists and drives the Load Assessment banner, but **no dashboard consumes it** — so a user who edits loads without clicking Update Sizing sees no dashboard-level "unapplied" signal, and readiness is computed from committed `loadItemsV2` only.

## State currently used

| Consumer | Reads |
|---|---|
| FieldDashboard | `survey` only (loads/safety hardcoded false) |
| Sizing Overview Dashboard | `readiness` + `governance` (from committed loads) |
| Project Advisor | `project`, `sizing`, `readiness`, `loadCount` |
| Load Assessment banner | `hasUnappliedLoadChanges`, `draftLoadErrors` |

## Tabs affected
Dashboard (both field + sizing overview), Project Advisor, Proposal readiness line, and — after this sprint — the new Action Center.

## Proposed fix
Create **`src/utils/readinessEngine.js`** — one `buildProjectReadiness(project, loads, draftLoads, survey, sizing, simulation, delivery, energyImportSummary, hasUnappliedLoadChanges)` returning 13 sections (each with score/status/required/completed/missing/actionTab/actionLabel/highlightId), plus `missingFields`, `criticalIssues`, `warnings`, `nextActions`, and the `readyFor*` flags. Every consumer (Dashboard, Advisor, Action Center, proposal gate) reads from it, so they always agree. Load Inventory becomes a real computed section that accounts for applied loads, daily kWh, invalid rows and pending draft changes. Safety/compliance becomes a real section driven by `sizing` engineering flags. Night-dominant autonomy (RISK-1) is computed in `nightAutonomy.js` and surfaced through the same engine.

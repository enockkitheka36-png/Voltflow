# Solarise Pro — Voltflow 11.1
## Workflow Stabilization + Simulation PDF + Live Load Control Build

**Date:** 2026-07-20 · **Schema:** 11.1 (migrates all earlier saves automatically) · **Build:** Vite, clean

This release is a stabilization sprint on top of Voltflow 11.0. No engines were
replaced, no features removed. The one-source-of-truth rule holds: one sizing
engine (`useSizing` / `computeOptionSizing`), one string planner, one roof-layout
calculator, one accessories engine — new capabilities are pure functions in
`src/utils/` adapted into the existing flows.

---

## 1. What was improved

| Area | Change |
|---|---|
| Load workflow | Draft commits are now **validated** — invalid rows block Update Sizing with a red banner and per-row errors. Added **Reset Changes** and per-row **⧉ Duplicate**. |
| Blueprint mode | `sizingMode` is now user-selectable (Existing site / Blueprint–new build / Future expansion) with **11 building templates** that generate draft loads scaled by floor area, occupancy, schedule, and growth margin. |
| System Options | Cards now also show **Annual Savings** and **Daily Energy**. (They already computed from applied loads via the pure `computeOptionSizing`.) |
| String/MPPT | MPPT reassignment now **revalidates instantly** (`computePlanWarnings`): mixed roof-face orientation per MPPT, per-MPPT overload, inverter string capacity, combiner advisory. |
| Cable lengths | New **"Apply simulation cable lengths to project"** button pushes simulation estimates into `project.dcCableLengthM` / `acCableLengthM`, recalculating voltage drop. Never applied silently. |
| Accessories/BoQ | Multi-roof-face installs get a mounting allowance (`multiFaceExtraMountingPct`, default 5%); a "Does not fit → alternative mounting NOT priced" advisory appears when the roof can't take the array. |
| Governance | Cable-ampacity failure now forces **Engineering review required**. Manual pipeline stages **Sent / Won / Lost** layer over the computed status (underlying status stays visible). |
| Readiness | New **Layout/Simulation category (10 pts)**: roof-fit confirmed, panels fit, string plan generated, no danger-level installer warnings. Weights rebalanced to keep the total at 100 (survey 20, loads 15, engineering 25, layout 10, financial 15, proposal 15). |
| Dashboard | New what-to-do-next strip: **quote status, next action, top blocker, work state** (draft-loads pending / simulation warnings). Sizing Overview added to the sidebar. |
| As-built | Added actual **inverter/battery location** inputs; `compareAsBuilt` now also flags planned-vs-actual **cable length deviations > 25%** (alongside the existing Voc >10% / Isc >15% checks). |
| PDF | Full report now prints **effective** cable estimates (manual/auto tagged), an **Installer Warnings** section, and — for blueprint/future-expansion projects — a **Blueprint / New Construction Assumptions** box with the fixed disclaimer. |
| Tests | New `scripts/workflow-regression.mjs` (24 tests) imports the **real** production modules. Existing suites untouched and green. |

## 2. Load update workflow (live load control)

1. All edits go to `draftLoadItemsV2` — committed sizing is untouched.
2. Banner states: ✓ green "All load changes applied" · ⚠ yellow "unapplied load
   changes" · ⛔ red "Some loads are invalid" (commit blocked).
3. Validation rules (`validateLoadItemsV2` in `loadEngine.js`): name required,
   qty ≥ 1, rated W > 0, day+night hours > 0, each ≤ 24, surge ≥ 1.
4. **Update Sizing** validates then commits → PV, battery, BoQ, options,
   readiness, proposal all refresh from the committed loads only.
5. **Reset Changes** discards the draft and restores the applied loads.
6. Save/load stores the committed loads; legacy flat `loads` arrays migrate
   automatically (`resolveLoadItemsV2`).

## 3. System options logic

`computeOptionSizing(project + overrides, appliedLoads)` is a pure function (no
hooks) run inside one `useMemo`. Essential / Balanced / Premium differ only in
solar coverage, backup hours, and autonomy overrides. Each card shows PV kWp,
panels, battery kWh + modules, inverter kW, cost, payback, annual savings,
daily energy, backup hours, per-option roof fit (multi-roof aware), pros/cons,
best-fit note; Premium warns when alternative mounting would be required.

## 4. Simulation → PDF workflow

`generateFullPDF(project, sizing, loads, simulation, panelLayout, stringPlan,
loadAccessoriesData, { roofGeometry, simWarnings })` appends: roof layout
summary, string/MPPT table, cable route estimates (effective values), installer
warnings (danger/warning), as-built summary when commissioning mode is on, and
the simulation disclaimer — then the load/BOS appendix. All appenders are
null-safe: projects without simulation data still export.

## 5. Blueprint sizing workflow

1. Pick sizing basis in Load Assessment (existing / blueprint / expansion).
2. For non-existing-site projects, fill the template card: building type (11
   options), floor area, occupancy, schedule h/day, growth %, confidence.
3. **Generate draft loads from template** — fills the draft table only. The
   growth margin becomes an explicit "Future growth allowance" row whose daily
   kWh equals the chosen % of the template's energy.
4. Update Sizing applies them like any other draft.
5. Proposal and PDF show a "Blueprint / New Construction Assumptions" box and
   the disclaimer: *"This proposal is based on blueprint-stage assumptions.
   Final sizing must be reviewed once the equipment schedule, MEP drawings, or
   actual operating loads are confirmed."*

## 6. Simulation-informed BoQ workflow

The accessories engine keeps reusing the same layout/string/cable state as the
rest of the app. New in 11.1: multi-face mounting allowance, advisory list
(surfaced in the Accessories tab), and the explicit cable-length apply button in
the simulation Cables tab (BoQ quantities remain advisory reference — the main
engineering BoQ lump sums are not overwritten).

## 7. As-built workflow

Enable As-Built mode during commissioning → record actual panels, orientation,
inverter/battery locations, three cable lengths, per-string Voc/Isc, test
passes, monitoring, handover, installer, date, notes. Deviation checks: panel
count shortfall, Voc >10%, Isc >15%, cable lengths >25% vs plan, missing
tests/monitoring/handover. Included in the full PDF when enabled.

## 8. Remaining limitations

- Blueprint templates are indicative Kenya-typical intensities — not a
  substitute for an MEP equipment schedule.
- Per-panel rotation is not modelled; orientation is global per layout (the
  grid model prevents overlaps by construction).
- The BOS total remains a separate procurement reference, not summed into
  `sizing.totalCost` (prevents double-counting with BoQ lump sums).
- Quote stages (Sent/Won/Lost) are manual and per-project; there is no
  multi-project pipeline board yet.
- No automated UI test runner (jsdom/playwright) — UI flows are covered by the
  pure-function suites plus manual browser verification.
- The tool remains a feasibility/planning aid: it does not replace licensed
  engineering sign-off, structural or wind-load design, waterproofing method
  statements, protection coordination, cable ampacity design, earthing design,
  KPLC/EPRA approval, or carbon MRV validation.

## 9. Recommended internal Solarise workflow

1. Create project → 2. Select sizing basis (existing / blueprint / expansion)
→ 3. Complete site survey → 4. Enter or generate draft loads → 5. **Update
Sizing** → 6. Review engineering sizing → 7. Review Engineering Compliance →
8. Review Installer Simulation (apply cable lengths if better than defaults)
→ 9. Review System Options → 10. Review Readiness Score → 11. Manager/Engineer
approval if governance requires → 12. Generate proposal/PDF and **Mark Sent**
→ 13. During installation use Technician View → 14. Complete As-Built
Handover and record **Won/Lost**.

## 10. Verification record (2026-07-20)

- `npm run build` — clean (14.3s, 404 modules; pre-existing chunk-size notice).
- `node scripts/workflow-regression.mjs` — **24/24 pass** (real modules).
- `node scripts/decision-regression.cjs` — **41/41 pass** (untouched).
- `node scripts/calculation-regression.js` — READY on all three grades.
- Browser: validation gate, Reset, Duplicate, blueprint generation → draft →
  commit, six-category readiness, Sent/Won/Lost stages, dashboard strip, cable
  apply (DC drop 2.4% → 0.9%), zero console errors.

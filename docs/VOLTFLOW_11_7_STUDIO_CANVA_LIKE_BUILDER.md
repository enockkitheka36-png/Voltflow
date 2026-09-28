# Voltflow 11.7 — Voltflow Studio: Canva-Like Solar Project Builder

**Build:** Voltflow 11.7 · **Schema:** 11.7 · **Classification:** Internal Alpha / Market-Testing.
**Note:** the 11.7 release now bundles the earlier Evidence-Reports work **and** Voltflow
Studio (neither shipped to production yet; production is still 11.6).

Studio makes Voltflow feel like an interactive, template-driven builder instead of a
spreadsheet. **Calculations stay deterministic** — Studio adds a visual command centre,
templates, scenario cards, plain-language explanations and a proposal composer on top of
the existing engines. Nothing was removed; the sizing engine was not rewritten.

## What's new

### Voltflow Studio tab (`studio`) — Phase 2
A visual command centre. Ten **project blocks** (Client → Site → Loads → PV → Battery →
Inverter → Borehole → BoQ → Proposal → Delivery), each showing status (coloured edge),
key metric, and missing/warning counts. Clicking a block routes to that tab and highlights
the relevant section. Driven by `src/utils/studioBlocks.js` off the central readiness
engine — one source of truth, no recompute.

### Template gallery — Phase 3
`src/utils/projectTemplates.js` — **13 templates** (Residential Backup/Hybrid, Commercial
Rooftop, School, Clinic, Farm Solar + Borehole, Dairy Farm, Carwash, Hotel/Lodge, Mini-grid,
EV Charging, Genset Hybrid, Solar Security Lighting). Each preloads system type, typical
loads, common warnings, proposal language, BoQ categories, checklist items and **whether the
borehole module turns on**. "Use template" builds a real project (loads via loadEngine) in
seconds. See [VOLTFLOW_11_7_TEMPLATE_GALLERY.md](VOLTFLOW_11_7_TEMPLATE_GALLERY.md).

### Scenario cards — Phase 4
`src/utils/scenarios.js` — **Good / Better / Best / Custom** presets that adjust coverage +
backup depth and are sized by the **existing** engine (`computeOptionSizing`). Each card shows
PV/panels/inverter/battery/cost/payback + a confidence score. "Use this design" applies it;
nothing is hidden. Existing system-options logic is untouched.

### Explain-this drawers — Phase 5
`src/utils/explainers.js` + `src/components/ExplainDrawer.jsx` — an **"Explain this"** drawer
for 13 outputs (PV, panels, inverter, DC:AC, battery, autonomy, night autonomy, borehole
pump/PV, tank, cost, payback, readiness). Each gives plain language, the formula, key inputs,
assumptions, warnings and **what to verify** — so a sales user can explain numbers to a
client and an engineer can check the basis. It explains; it never recomputes.

### Proposal Studio — Phase 6
`src/utils/proposalStudio.js` + a panel on the Proposal tab — pick an audience mode (Client /
Engineer / Technician / Lender) and **choose + reorder the 17 sections**. Stored in project
state (`proposalStudioConfig`) as an export-ready structure. The existing report/PDF path is
untouched; it can honour this order. See [VOLTFLOW_11_7_PROPOSAL_STUDIO.md](VOLTFLOW_11_7_PROPOSAL_STUDIO.md).

### Asset Library — Phase 7
`src/utils/assetLibrary.js` + an **Asset Library** tab (`assets-lib`) — 12 categories, a seed
catalogue (brand/model/capacity/price/warranty/supplier/datasheet/compatibility/stock), browse,
add to project, mark preferred, with a compatibility-warning placeholder. No supplier API yet.
See [VOLTFLOW_11_7_ASSET_LIBRARY.md](VOLTFLOW_11_7_ASSET_LIBRARY.md).

### Client / Technician views — Phase 8/9
The Studio is view-aware: the template gallery + build actions are engineer-only; blocks and
scenario comparison remain useful for client conversations. The existing Client and Technician
dashboards (readiness-driven) are unchanged and continue to hide internal detail / foreground
field checklists.

### Microinteractions — Phase 10
`src/components/ui.css` — clickable blocks with status edges + hover lift, template/scenario
card hovers, a smooth explain-drawer, clear empty states — all under
`@media (prefers-reduced-motion: reduce)`. Professional, not over-animated.

## Persistence & migration — Phase 11
New persisted project fields: `selectedTemplateId`, `selectedScenarioId`,
`proposalStudioConfig`, `assetSelections`, `studioProgress`. Old projects migrate safely via
`normalizeProposalStudioConfig` / `normalizeAssetSelections` + defaults in
`normalizeLoadedRecord`. Schema stays **11.7**; localStorage + Export/Import still work.

## Files changed
**New:** `src/utils/projectTemplates.js`, `scenarios.js`, `explainers.js`, `assetLibrary.js`,
`studioBlocks.js`, `proposalStudio.js`; `src/components/ExplainDrawer.jsx`; 5 test scripts;
these docs.
**Extended:** `src/App.jsx` (Studio tab, Asset Library tab, Proposal Studio panel, Explain
drawer, template/scenario apply handlers, nav + routes + defaults + migration),
`src/components/ui.css` (Studio/explain/card styles), `src/utils/navigation.js` (studio +
assets-lib tabs).

## Tests / build — Phase 12
`npm run build` clean; **`npm run test:all` → 21 suites, 241 tests, 0 failures** (new:
studio 6, templates 7, proposal-studio 5, assets 4, explainers 6). Browser-verified: Studio
blocks/scenarios/templates/explain-drawer/asset-library/proposal-studio all work; block
routing works; **zero console errors**.

## Remaining limitations
- Proposal Studio stores section order/mode; the PDF layout still uses the existing generator
  (it can consume the config, but a fully section-driven PDF is a later polish).
- Asset selections are catalogue references with no live pricing/stock feed.
- Client/Technician **views** were made Studio-aware but not fully re-themed; the existing
  dashboards remain the primary client/tech surfaces.
- **Not certified engineering approval.** Studio explains and drafts; it never replaces
  qualified engineering review, and borehole pump selection still needs the pump curve + test report.

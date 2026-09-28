# Voltflow 11.7 — Studio UX Audit (Phase 1)

**Build audited:** Voltflow 11.7 (repo) · **Classification:** Internal Alpha / Market-Testing.
Goal: find where the app still feels like a calculator/form/spreadsheet rather than an
interactive, template-driven *studio*, and ground the Studio sprint that follows.

## Where it still feels like a tool, not a studio

| # | Finding | Class |
|---|---------|-------|
| 1 | Onboarding creates a **blank** project; the user then hunts across ~25 sidebar tabs to fill it. No "start from a job type" path. | onboarding |
| 2 | No **templates** — a residential-backup job and a farm-borehole job start identically; the user re-enters the same typical loads/warnings every time. | template |
| 3 | The workflow is a **list of tabs**, not a visual project. There is no single screen that shows the 10 project blocks (client→delivery) and their status at a glance. | visual-workflow |
| 4 | System **options** exist (essential/balanced/premium) but are buried in a technical tab and read as a table, not as **Good/Better/Best scenario cards** a salesperson can compare with a client. | visual-workflow |
| 5 | Outputs (PV size, inverter, DC:AC, battery, autonomy, borehole pump/PV, cost, payback, readiness) are shown as **numbers with hints** — there is no consistent **"Explain this"** that a sales user can open in front of a client. | calculation-explainability |
| 6 | The Proposal is a fixed layout. There is no way to **choose/reorder sections** or pick a report audience visually — it doesn't feel like composing a document. | proposal |
| 7 | Equipment is entered ad-hoc; there is no **reusable asset catalogue** (panels/inverters/batteries/pumps…) to pick from, so brand/model/price/warranty are re-typed. | market-readiness |
| 8 | **Client View** shows a simplified dashboard but still surfaces some engineer terms; it isn't yet a clean "present to the client" screen with a selected scenario + benefits + water output. | client-readability |
| 9 | **Technician View** foregrounds warnings but isn't a single **field checklist** (survey→load→install→commission→borehole→handover) the installer can work down. | technician-usability |
| 10 | Transitions are functional but flat — few completion cues, no drawer polish, empty states are plain. It reads "engineering utility," not "polished SaaS studio." | market-readiness |

## What already helps (keep and surface, don't rebuild)
- Central **readiness engine** (sections/status/warnings/nextActions) — perfect data source for a Studio block grid.
- **System options** (essential/balanced/premium) — reuse as scenario cards.
- **Inverter coherence** `dcAcAnalysis.explanation` + **borehole** summaries — ready-made "explain" content.
- **navigateToTab / highlightId / goBack** — the routing a Studio block grid needs.
- View modes, Action Center, Project Advisor, Delivery checklists — the technician/client scaffolding to dress up.

## Direction (this sprint)
Add a **Voltflow Studio** command-centre tab (visual blocks), a **template gallery**, **Good/Better/Best/Custom scenario cards**, **Explain-this drawers**, a **Proposal Studio** (choose/reorder sections), an **Asset Library** foundation, and cleaner **Client/Technician** presentations — all on top of the existing deterministic engines. **Calculations stay deterministic; AI may explain/draft only.** No engine rewrite, no feature removal.

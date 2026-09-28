# Voltflow 11.4.1 — Clean Startup + Project Onboarding

**App version:** Voltflow 11.4.1 · **Schema version:** 11.2 (unchanged — no persisted project-shape change)
**Classification:** Voltflow Internal Alpha — controlled testing and development, **not production SaaS**.

---

## 1. What changed

The app used to boot with a fake client project already loaded — "Karen Homeowner", "Karen, Nairobi", a KES 35,000 bill and six household loads. Useful while building; unprofessional in front of a real user or client.

**Voltflow now starts clean.** No client, no location, no bill, no loads. A start screen is the only way in.

| Before | After |
|---|---|
| Opened straight into a fake Karen project | Opens on the **Welcome to Voltflow** start screen |
| `defaultProject.client = "Karen Homeowner"` | `client: ""` — engineering baseline only |
| 6 hardcoded household loads | Empty load table until a load source is chosen |
| `defaultSurvey.county = "Nairobi"` | `county: ""` |
| Demo data indistinguishable from real work | Demos are badged **DEMO** everywhere they appear |

## 2. Why Karen was removed from startup — and what was kept

Two unrelated things shared the name:

- **"Karen Homeowner" / "Karen, Nairobi"** — a fake *client project*. Removed from startup, moved to the demo library.
- **"Nairobi / Karen"** — a real *Kenya site profile* (PSH 5.6, cell temp 47 °C, monthly irradiance curve). **Kept and still selectable**, including the `Nairobi → Nairobi / Karen` county mapping. It is solar-resource data, not client data.

Engineering defaults (module electricals, loss factors, cable sizes, indicative costs, PSH baseline) are all still pre-filled — an engineer needs them, and they identify nobody.

## 3. How demo projects work

`src/utils/demoProjects.js` is the only home for sample data. **Nothing loads automatically.**

Six demos: Residential Hybrid (Karen), Commercial SME, Off-grid Farm, Genset Hybrid, EV Charging, Mini-grid. Each supplies overrides onto the engineering baseline plus sample loads and survey data.

Safety rules:
- Every demo client name starts with `DEMO — ` (asserted by tests).
- A loaded demo shows a purple **DEMO PROJECT** banner on every tab, plus a **DEMO DATA** flag in the sidebar.
- **"Use as template for a real project"** asks for the real client name, strips the badge, and records `convertedFromDemo`.

## 4. How to start a new project

Start screen → **Start New Project** → 5-step wizard:

1. **Client** — client/company name (required), contact, prepared by
2. **Site** — location (required), Kenya site profile, phase, monthly bill
3. **Objective** — residential backup, hybrid bill reduction, off-grid, genset hybrid, EV charging, mini-grid, commercial/industrial → sets `systemType`
4. **Load source** — manual, energy data import, KPLC bill estimate, blueprint/new construction, or blank
5. **Create** — review summary → **Create Project**

You land on the tab that matches the load source (energy import → Energy Data Import, blueprint → Load Assessment, etc.), with a toast confirming what to do next.

## 5. How to import JSON

Start screen → **Import Project JSON** → the Save/Load tab. The existing staged review still applies: the file is validated and summarised (client, versions, load count, sizing basis) with old-version warnings **before** anything is applied. Applying the import now also marks the project active and records it as the last session.

## 6. Using Energy Data Import as the first step

Start screen → **Upload Energy Data**. This creates a blank working project with `loadSource = data_logger` and drops you straight into the import tab. Analyse the logger file, generate draft loads, then name the project in Project Setup. Nothing is fabricated in the meantime.

## 7. Resume behaviour

`rememberLastActiveProject()` stores `lastActiveProjectId` / `lastOpenedAt` in localStorage whenever a project is loaded, imported or resumed. The start screen then offers **Continue Last Project** — but **never opens it automatically**. Demo data is never auto-resumed.

## 7a. Resetting old local data (for upgrading testers)

Testers who used earlier builds may still hold old Karen/demo projects in their browser. Those are **never auto-loaded** — the start screen is always clean and "Continue Last Project" is an explicit click. To clear them, use **"Reset local demo/startup data"** (on the start screen and in Save/Load):

- Shows exactly what is stored: saved projects (by name), resume pointer, assistant chat, feedback entries.
- Offers **Download backup first** — one JSON containing every project, feedback entry and the session pointer.
- **Tester feedback is preserved by default.** Deleting it requires ticking a separate box, because it is research data the team may not have collected yet.
- Clearing is permanent and affects this browser only.

## 8. Empty-state behaviour

While no project is active the sidebar shows no project tabs at all — the start screen is the only surface, so no tab can be opened against an empty project and nothing can crash on blank fields. A **← Start screen** link in the sidebar returns to it at any time. Save/Load and the AI Assistant remain reachable once a project is active.

## 9. Remaining limitations

- The active-project flag lives in memory: a **browser refresh returns you to the start screen** (by design — use Save, then Continue Last Project).
- The wizard collects the basics only; roof, survey and electrical detail still come from the survey tabs.
- Demo projects are static fixtures, not a template editor.
- Converting a demo keeps the demo's numbers as a starting point — every input must still be reviewed before quoting.
- Projects remain browser-local (`CLOUD_STORAGE_CONFIGURED = false`), unchanged from 11.3.
- Readiness still treats a literal "Karen Homeowner" client name as non-specific, which correctly flags imported legacy projects.
- This is a feasibility tool. Final engineering design and installation approval require qualified review.

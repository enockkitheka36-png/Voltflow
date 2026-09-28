# Voltflow 11.5.2 — Readiness Sync + Alert System + UI Polish

**Build:** Voltflow 11.5.2
**Live URL:** https://voltflow-alpha.vercel.app
**Classification:** Voltflow Internal Alpha — controlled testing and development. **Not production SaaS.**
**Predecessor:** [11.5.1 — Field Usability + Market Readiness Polish](VOLTFLOW_11_5_1_INPUT_UX_AUDIT.md)

---

## Why this sprint

Progress tracking, safety readiness and the Project Advisor had drifted apart —
each read a *different* signal, so a completed Load Inventory could still show as
"not done" on the Dashboard, safety progress was effectively static, and missing
fields were easy to miss. 11.5.2 replaces the scattered signals with **one
readiness engine** that every surface reads, adds a guided **Action Center**,
professional **attention animations**, a **proposal gate**, a redesigned
**readiness Dashboard**, and fixes the night-dominant autonomy risk (RISK-1).

See the full root-cause analysis in
[VOLTFLOW_11_5_2_READINESS_SYNC_AUDIT.md](VOLTFLOW_11_5_2_READINESS_SYNC_AUDIT.md).

---

## 1. The problem that was found

| # | Symptom | Root cause |
|---|---------|-----------|
| 1 | Completed Load Inventory didn't update Dashboard | Two dashboards hard-coded `Load Inventory: done:false` and only read the survey |
| 2 | Safety/compliance progress looked static | No section computed status from real safety checks |
| 3 | Missing fields not surfaced strongly | No single missing-fields list existed |
| 4 | Advisor and Dashboard disagreed | Three separate readiness signals (`readiness.js`, `projectAdvisor.js`, dashboard-local booleans) |
| 5 | Draft loads not reflected | `hasUnappliedLoadChanges` existed but no surface consumed it |

## 2. Central readiness engine — the single source of truth

`src/utils/readinessEngine.js` → `buildProjectReadiness(project, loads, draftLoads,
survey, sizing, simulation, delivery, energyImportSummary, hasUnappliedLoadChanges)`.

Pure (no React/DOM). Returns:

- `overallScore` (average of the 9 core sections)
- `sections` — 13 sections (startup, clientDetails, siteSurvey, loadInventory,
  energyImport, pvSizing, batterySizing, inverterSafety, engineeringCompliance,
  boq, proposal, delivery, handover). Each has `label, score, status
  (not_started/incomplete/needs_review/complete), requiredItems, completedItems,
  missingItems, actionTab, actionLabel, highlightId, note, critical, optional`.
- `missingFields`, `criticalIssues`, `warnings`, `nextActions` (each with
  `actionTab` + `highlightId` so it can route + highlight)
- `night` (see §8)
- `readyForProposal`, `readyForEngineeringReview`, `readyForClientView`, `readyForInstallation`

The Dashboard, Project Advisor, Action Center and proposal gate all read this one
object — they can no longer disagree. Consumed via a single `projectReadiness`
`useMemo` in `App.jsx`.

## 3. Load inventory progress fix

`loadInventory` is `complete` only when applied loads exist, at least one row has
valid qty + watts, daily kWh > 0, and there are **no unapplied draft changes**.
The engine distinguishes:

- No loads entered → *not started*
- Draft loads entered but not applied → *needs review* + "Draft loads entered but not applied — click Update Sizing."
- Loads edited but not applied → *needs review* + **"Load inventory edited but not applied. Click Update Sizing."**
- Applied + valid → *complete*

Because everything derives from the live memo, clicking **Update Sizing** updates
Dashboard, Advisor, Action Center and proposal readiness in the same render.

## 4. Safety / engineering-compliance readiness

`inverterSafety` and `engineeringCompliance` now score from real signals: phase
selected, inverter DC-voltage set, cold Voc within limit, DC/AC voltage drop, DC/AC
cable ampacity, BMS discharge limit, earthing confirmed, and (grid/hybrid)
anti-islanding acknowledgement. **Critical** issues (cold Voc over the inverter
max, cable ampacity insufficient, BMS exceeded, phase mismatch between survey and
project) are surfaced in `criticalIssues` and block `readyForProposal`.

## 5. Project Action Center (floating, guided)

A floating **🎯 Action Center** button opens a right-hand drawer listing, by
priority (critical → required → warning → recommended): critical blockers,
required missing fields, unapplied draft changes, safety warnings, night-load
caution and recommended next actions. Every item has a **Go fix →** button that
routes to the target tab, highlights the target, and closes the drawer. The FAB
pulses when critical blockers exist. Engineer + technician only (hidden in client
view). See routing rules in §11.

## 6. Professional attention animations

New `.vf-*` utilities in `src/components/ui.css`, **all disabled under
`prefers-reduced-motion: reduce`** (a static outline replaces the animation):

- `vf-pulse` — Action Center FAB when critical blockers exist
- `vf-glow-warn` — soft glow on critical action items
- `vf-highlight` — target glow when navigating to a field/card
- `vf-shake`, `vf-complete-pop` — error / section-complete accents
- animated **proposal gate** modal (`vf-modal`, entrance transform)

No aggressive constant blinking. Alerts are dismissible.

## 7. Readiness Dashboard redesign

The **Dashboard** tab (`field-dashboard`) is now a readiness-first view: hero with
`ReadinessRing` (overall score) + status pill, key sizing metrics, a critical-
blockers panel, the next 3 actions, a night-load caution, and a grid of clickable
`ProgressCard`s (one per section). It is **view-mode aware** — engineer sees all
sections, technician sees the field-relevant order. The classic financial view is
preserved as **Sizing Overview** (`dashboard`).

New/extended components in `src/components/ui.jsx`: `ReadinessRing`, `ProgressCard`
(clickable, hover/press states, glow when critical).

## 8. Night-dominant autonomy fix (RISK-1)

`src/utils/nightAutonomy.js` → `computeNightAutonomy(loads, mode, sizing, project)`.
Assumed night window **11 h**. Computes `nightLoadShare`, `criticalNightLoadShare`,
`usableBatteryKwh` (× DoD × efficiency), `criticalNightKwh`, `nightEnergyCoverage`,
`estimatedNightAutonomyHours` (clamped to 72 h — never NaN/Infinity),
`isNightDominantLoad` (share ≥ 0.65) and a plain-language `nightAutonomyWarning`.

**Shape-tolerant** — it accepts both V2 items (`ratedW`/`essential`) *and* the
legacy loads the readiness engine actually passes (`watts`/`critical`). This was a
real integration defect: before the fix the engine fed legacy loads into a
V2-only reader and silently computed zero night energy, disabling the feature.

Surfaced on: Battery tab ("Night-load autonomy" card), Dashboard caution, Project
Advisor, proposal text + on-screen proposal, and the Action Center when coverage
< 100%.

> "Night-dominant load detected. Average 24-hour autonomy may overstate real
> backup time. Use night-load autonomy for client promises."

## 9. Project Advisor — now engine-driven

`ProjectAdvisorPanel` reads the central `projectReadiness` (no more separate
signal), so it agrees with the Dashboard and Action Center. It shows the readiness
verdict + score, critical blockers, night-load caution, missing/review items, the
next 3 actions and the proposal-safe / engineering-review decisions. Next actions
and blockers are **clickable** and route via `navigateToTab`. Works with **no
Claude API key** (the AI Assistant remains an optional add-on below it).

## 10. Proposal gate

Generating a PDF quotation/report when the engine reports **critical blockers or
required-missing items** opens an animated warning modal listing them, with
**Review first →** (routes to the first blocker), **Continue anyway** (proceeds
with the internal-alpha disclaimer) and **Cancel**. It **warns, it does not hard-
block** (per internal-alpha policy). The proposal (text + on-screen) now includes
a readiness line, assumptions, unresolved warnings, and the night-load caution
when relevant, alongside the existing engineering disclaimer.

## 11. Guided navigation (Add-on)

`src/utils/navigation.js` centralises routing rules (pure, tested):

- **Clickable Dashboard cards** — each `ProgressCard` routes to its section's
  `actionTab`, highlights the target and shows a toast; Dashboard is stored as the
  previous view.
- **Back button** — `navigateToTab(tab, {source, highlightId})` stores
  `previousView`; **← Back** uses `resolveBackTarget` (returns to the previous
  view, or the Dashboard if none). Internal state only — never browser history.
- **Highlighting** — `highlightClass(activeId, targetId)` returns `vf-highlight`
  only on the matching target; a scroll-into-view effect centres it and the glow
  clears after 4 s (respects reduced-motion). Anchors: `update-sizing-btn`,
  `cold-voc-card`, `night-autonomy-card`, plus the section `highlightId`s.
- **View-mode routing** — `isTabAllowedInView(tab, viewMode)`:
  - **Engineer** — everything.
  - **Technician** — field/survey/install tabs (survey, loads, installer-sim,
    delivery, proposal, …). Engineering-internal tabs are hidden.
  - **Client** — client-safe pages only (dashboard, proposal, assistant,
    feedback). Internal procurement/compliance tabs are hidden.
  - When an item points to a hidden tab, the Action Center shows **"Switch to
    Engineer View to edit this section."** instead of a dead Go-fix.

## 12. Files changed

**New:** `src/utils/nightAutonomy.js`, `src/utils/navigation.js`,
`scripts/readiness-alerts-regression.mjs`, `scripts/night-autonomy-regression.mjs`,
`scripts/navigation-regression.mjs`, `docs/VOLTFLOW_11_5_2_READINESS_SYNC_AUDIT.md`,
this doc.
**Extended:** `src/utils/readinessEngine.js` (central engine),
`src/components/ui.jsx` (`ReadinessRing`, `ProgressCard`),
`src/components/ui.css` (alert/modal/nav CSS + reduced-motion),
`src/App.jsx` (readiness memo, Action Center, Readiness Dashboard, night card,
Advisor rewire, proposal gate, `navigateToTab`/`goBack`, highlight effect),
`src/utils/schemaMigration.js` (version), `package.json` (test scripts).

## 13. Testing

```bash
npm run build
npm run test:all   # workflow, energy, ui, startup, delivery, input, readiness, night, navigation
```

Pure logic (readiness engine, night autonomy, navigation rules) is covered by the
three new node suites (38 tests). UI rendering, animation and the click/scroll of
navigation are **browser-verified** (see the testing guide) because JSX is not
node-importable. 11.5.2 status: **build green, all 9 suites green (131 tests)**,
zero console errors, browser-verified on the local dev server.

## 14. Remaining limitations

- The gate **warns**, it does not block — internal-alpha policy. A weak proposal
  can still be issued after acknowledging the disclaimer.
- Night autonomy uses a fixed 11-hour window and standard DoD/efficiency
  assumptions; it is a planning estimate, not a measured runtime.
- PDF output carries the readiness/night caution via the proposal text and
  on-screen sheet; the generated PDF layout itself is unchanged from 11.5.1.
- Readiness remains a **workflow aid, not certified engineering approval**. Every
  number still requires qualified review before installation or client sign-off.

---

**Voltflow Internal Alpha — controlled testing and development, not production SaaS.**

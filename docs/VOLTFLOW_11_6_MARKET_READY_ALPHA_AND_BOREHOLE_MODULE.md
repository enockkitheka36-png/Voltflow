# Voltflow 11.6 — Market-Ready Alpha + Solar Borehole Specialist Module

**Build:** Voltflow 11.6 · **Schema:** 11.6 · **Live:** https://voltflow-alpha.vercel.app
**Classification:** Voltflow Internal Alpha — controlled testing and development, preparing for market validation. **Not full production SaaS yet.**
**Baseline verified:** [VOLTFLOW_11_6_REPO_BASELINE_VERIFICATION.md](VOLTFLOW_11_6_REPO_BASELINE_VERIFICATION.md) (real repo, 11.5.2, all suites green).

This sprint combines **Track A** (market-ready polish + calculation coherence) and **Track B** (a new water-first Solar Borehole module).

---

## Track A — Market-ready alpha

### P0 market-safety fixes
- **Assistant never leaks config.** The serverless function (`api/assistant.js`) already keeps `ANTHROPIC_API_KEY` server-only and returns safe fallbacks. The **client-facing** wording no longer names any env var: it now reads *“AI Assistant is not enabled in this environment. Project Advisor is still available.”*
- **Help/Feedback dock.** The two floating buttons were replaced by a single bottom-right `.vf-help-dock` (stacked, never overlaps inputs). Labels collapse to icons under 640 px. The Action Center FAB stays bottom-left, so nothing collides.
- **View-mode bar** remains a dedicated `.vf-viewmode-bar` (Engineer / Client / Technician).
- **Console hygiene:** zero console errors across the demo flow (browser-verified).

### Calculation coherence — Inverter/PV ratio (Phases 7–8)
The audit ([VOLTFLOW_11_6_MARKET_READY_ALPHA_AUDIT.md](VOLTFLOW_11_6_MARKET_READY_ALPHA_AUDIT.md)) confirmed the 12 kW inverter / 4.2 kWp / 0.35 DC:AC case: **PV is energy-led** (`requiredKwp = targetDailyKwh / (PSH·PR)`), **inverter is load/surge-led** (`loadBasedInvKw = peakKw × headroom`). They are computed independently, so a high-peak, low-energy site produces a very low ratio shown only as a red metric.

New pure engine `src/utils/inverterCoherence.js` (15 tests) adds:
- **`inverterSizing`** — `loadBasedInvKw, pvBasedInvKw, selectedInverterKw, selectedReason, isLoadLed/isPvLed/isBalanced, peakKw, runningKw, surgeKw, inverterHeadroom, basis, loadSupported`.
- **`dcAcAnalysis`** — `ratio, status, severity (none/low/medium/high), targets, recommendedMinPvKwpForSelectedInverter, additionalPanelsToReachMinRatio, suggestedSmallerInverterKw, explanation, correctiveActions[]`. Thresholds: <0.5 severe · 0.5–0.8 low · 0.8–1.1 acceptable · 1.1–1.35 optimal · 1.35–1.5 high-but-reviewable · >1.5 clipping.
- **`stringSizing`** — `requestedPanelsPerString, effectivePanelsPerString, maxPanelsPerStringByVoltage, strings, note`.
- **Load diversity** — new project fields `runningLoadDiversityFactor` (0.75) and `surgeDiversityFactor` (0.65) feed `peakKw = max(running·div, surge·div)`, with a visible explanation. A **basis selector** (`auto_engineering` / `backup_peak_led` / `pv_ratio_led` / `manual_review`) lets an engineer choose, without forcing it on normal users.

The **Inverter + Safety** tab now shows a Technical-Basis card, the basis/diversity controls and a **“PV array is small compared to inverter”** correction card (current PV, inverter, ratio, target, why selected, and clickable corrective options). For the screenshot case it recommends **~9.6 kWp / 16 panels (add 9)**, or a smaller inverter *if peak/surge allows*, and explains the design is **load-led** and acceptable for backup-led systems but should be reviewed.

### String clarity (Phase 8)
The Inverter tab renames the metrics to **Requested / Effective panels/string used / Max panels/string by voltage**, and shows *“You entered 12 panels per string, but only 7 available…”*. `effectivePanelsPerString` mirrors the engine’s built design (capped to available panels), so the **cold-Voc safety check is preserved** — the voltage limit is reported separately and still enforced.

---

## Track B — Solar Borehole & Water Pumping

New water-first specialist module. Pure engine `src/utils/boreholeEngine.js` (13 tests). Full formulas in [VOLTFLOW_11_6_BOREHOLE_ENGINE_TECHNICAL_BASIS.md](VOLTFLOW_11_6_BOREHOLE_ENGINE_TECHNICAL_BASIS.md).

- **Sizes from water demand**, not from a pump-as-a-load: required flow, TDH (dynamic level + tank height + friction + pressure), hydraulic → pump electrical kW (efficiency chain), daily pumping kWh, PV kWp (energy + power floor), tank storage, suggested pump HP.
- **Warnings:** yield insufficient, TDH high, friction high, pumping hours exceed solar window, **night pumping without a non-solar source**, tank too small, missing dry-run/float/SPD/earthing, long pipe, plus mandatory *confirm-test-report* / *water-quality* notes.
- **UI:** a **Solar Borehole** tab (Specialist Modules) with use case + demand helper, borehole data, pipe/head/tank, pump/control/power, protection, results cards, warnings, BoQ preview and proposal summary. Inputs use SmartNumberField; use-case, pump-type and power-mode presets included.
- **Integration:** borehole warnings/criticals flow into **readiness → Action Center + Project Advisor**; a **borehole section** appears in the **Proposal**; **borehole BoQ rows** are appended (additive subsystem cost); it **saves/exports/imports** (schema 11.6, migrated by `normalizeBorehole`). A **double-count guard** warns when a pump is entered in both Load Assessment and the module.

> Feasibility / pre-design only. Final pump selection must be confirmed against the actual borehole test report, pump curve, measured water level, yield and pipe route. **Not certified hydraulic engineering.**

---

## Files changed
**New:** `src/utils/inverterCoherence.js`, `src/utils/boreholeEngine.js`, `scripts/calculation-coherence-regression.mjs`, `scripts/borehole-engine-regression.mjs`, `scripts/borehole-ui-regression.mjs`, `scripts/market-ready-alpha-regression.mjs`, `scripts/proposal-pdf-regression.mjs`, and the docs in this set.
**Extended:** `src/App.jsx` (useSizing coherence integration, InverterCoherenceCard, SolarBorehole tab + route + nav, boreholeResult memo, BoQ/Proposal integration, Help dock, safe assistant wording), `src/utils/readinessEngine.js` (borehole section + warnings), `src/utils/navigation.js` (borehole tab), `src/components/ui.css` (help dock), `src/utils/schemaMigration.js` (11.6), `package.json` (test scripts; removed unrelated gaseasy scripts), `scripts/input-ux-regression.mjs` (safe-fallback assertion).

## Tests
`npm run build` (clean) + `npm run test:all` → **14 suites, 189 tests, 0 failures.** New suites: coherence (15), borehole engine (13), borehole UI (12), market-ready (11), proposal+PDF (7).

## What remains feasibility-only / partial
- **PDF three-mode split** (client / engineer / technician) — **not** implemented this sprint to avoid destabilising `pdfGenerator.js`; the existing quotation + full report (with disclaimers, readiness gate, borehole section on-screen) remain. *Next sprint.*
- **Sidebar** keeps its working groups plus a new **Specialist Modules** group; a full relabel to the exact Track-A group names is cosmetic and deferred.
- Borehole pumping energy is sized as a **dedicated sub-system** (its own PV/tank) and is **not** auto-merged into the main `designDailyKwh`, to avoid double-counting; the double-count guard + comparison cover this.
- Everything remains a **workflow/feasibility aid, not certified engineering approval.**

## Next recommended sprint
Three-mode PDF export; optional cloud storage (Supabase) to remove the browser-only limitation; borehole pump-curve import; full Technical-Basis “Explain this” drawers for every metric.

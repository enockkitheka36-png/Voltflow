# Voltflow 11.6 — Testing Guide

**Build:** Voltflow 11.6 · **Classification:** Internal Alpha (market-validation prep, not production SaaS).

## Automated
```bash
npm run build      # clean
npm run test:all   # 14 suites, 189 tests, 0 failures
```
Suites: workflow, energy, ui, startup, delivery, input, readiness, night, navigation, **coherence, borehole, borehole-ui, market, proposal**. Pure logic is node-tested; UI/PDF/animation are browser-verified (JSX isn't node-importable).

## Manual — Track A (market-ready)
1. **Clean startup.** Fresh load shows *Welcome to Voltflow*, no auto-loaded demo, no "Karen".
2. **Assistant safety.** Open AI Assistant with no key → message reads *"AI Assistant is not enabled in this environment. Project Advisor is still available."* No env-var name anywhere in the UI.
3. **Help dock.** Bottom-right shows a stacked AI Assistant + Feedback dock that never covers inputs; on a narrow window labels collapse to icons. Action Center FAB is bottom-left.
4. **View modes.** Engineer/Client/Technician bar switches content; switching back to Engineer restores everything.

## Manual — Calculation coherence
5. Load a project whose peak demand is high but daily energy low (or set a big load and low solar coverage). Open **Inverter + Safety**:
   - **Technical basis** card shows *Selected because*, load-based vs PV-based, diversified peak.
   - **DC:AC** shows the ratio + status; if < 0.8 a **"PV array is small compared to inverter"** card lists current PV, inverter, ratio, target, why selected, and corrective options (increase PV by N panels / smaller inverter / diversity / backup-led).
   - Change the **running diversity factor** → the inverter/peak update; the explanation says why.
6. **String clarity.** Set *Panels per String (requested)* above the panel count → the tab shows *Effective panels/string used* + a note ("you entered X, only Y available").

## Manual — Solar Borehole
7. Open **Solar Borehole** (Specialist Modules), tick **Enable borehole module**.
8. Pick a **use case**, set units, click **Estimate demand** (or enter litres/day). Enter yield, static level, drawdown, pump depth, pipe/tank.
9. Confirm **Results**: required flow, borehole-yield status, TDH, pump kW / HP, daily pumping kWh, recommended PV + panels, tank storage.
10. **Warnings** appear for: required flow > yield (critical), night pumping without a non-solar source (critical), missing dry-run/SPD/earthing, hours > solar window.
11. Enter a load named "pump" in Load Assessment while the module is enabled → **double-count guard** warning appears.
12. **Proposal** (borehole enabled) shows a **Solar Borehole & Water Pumping Solution** section (litres/day, TDH, pump HP, PV, tank, strategy, confirmations). **BoQ** shows *Borehole:* rows. **Action Center / Advisor** list borehole criticals/warnings.
13. **Save → Load** (or Export → Import) a borehole project → borehole data round-trips. Load an **old** project → it opens with default borehole (no error).

## Manual — Client / Technician / Engineer
14. **Client View:** clean progress + proposal; no internal procurement/compliance tabs; borehole appears as the water solution in the proposal.
15. **Technician View:** field tabs incl. Solar Borehole; borehole checklist/quick facts practical.
16. **Engineer View:** full technical basis, ratios, thresholds, formulas.

## Reduced motion
17. OS "reduce motion" → pulses/glows stop animating (static outline); nothing blinks aggressively.

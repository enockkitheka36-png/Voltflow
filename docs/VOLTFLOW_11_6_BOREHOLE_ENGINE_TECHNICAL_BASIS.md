# Voltflow 11.6 — Solar Borehole Engine: Technical Basis

**Module:** `src/utils/boreholeEngine.js` · **Tests:** `scripts/borehole-engine-regression.mjs` (13)
**Status:** Feasibility / pre-design. **Not certified hydraulic engineering.** All outputs are clamp-safe (no NaN/Infinity) on blank input.

## Design philosophy
Water-first. The product is **litres/day and reliability**, not kW. For solar boreholes, **water storage is usually the best "battery"** — prefer daytime solar pumping into an elevated tank unless night pumping is genuinely required.

## Formulas

| Output | Formula |
|---|---|
| Dynamic water level | `dynamicWaterLevelM` if given, else `staticWaterLevelM + drawdownM` |
| Total dynamic head (TDH) | `dynamicWaterLevelM + tankHeightM + frictionLossM + pressureAllowanceM` |
| Required flow | `dailyWaterDemandLitres / desiredPumpingHoursPerDay` (L/h) |
| Friction loss (auto) | Hazen-Williams: `10.67·L·Q^1.852 / (C^1.852·d^4.87)` over riser+horizontal+lift, `C=140` (HDPE); manual override honoured; clamped |
| Hydraulic power | `(flowM3ph · TDH · 9.81) / 3600` (kW) |
| Pump electrical power | `hydraulicPowerKw / (pumpEff · motorEff · controllerEff)` |
| Suggested pump HP | next standard HP ≥ `pumpElectricalKw / 0.746` |
| Daily pumping energy | `pumpElectricalKw · pumpingHoursPerDay` (kWh) — physically independent of hours (same water, same head, same energy) |
| PV size (energy) | `dailyPumpingKwh / (PSH · PR)` (kWp) |
| PV power floor | `pumpElectricalKw · 1.25` (solar-direct array must run the pump at rated flow) |
| Recommended PV | `max(energy-based, power floor)`; panels = `ceil(kWp·1000 / panelW)` |
| Tank storage | `dailyWaterDemandLitres · storageAutonomyDays` |

## Conservative defaults
`pumpEfficiency 0.55` · `motorEfficiency 0.85` · `controllerEfficiency 0.95` · `storageAutonomyDays 2.0` · `desiredPumpingHours 6` · `pressureAllowance 0 m` (use-case presets raise it, e.g. 10–20 m for pressurised distribution) · `Hazen-Williams C 140`.

## Warnings (feasibility triggers)
Yield insufficient (required flow > tested yield) · yield unknown · yield tight (>80 %) · TDH high (>200 m) · friction a large share of head (>15 %) · pumping hours exceed the solar window (solar-direct) · **night pumping without battery/grid/genset** · tank well below recommended · missing dry-run / float / SPD / earthing · long pipe run · plus mandatory *confirm borehole test report* and *confirm water quality / pump material*.

## BoQ (editable placeholders, KES)
Pump, controller/VFD, dedicated PV modules + mounting, drop cable, riser + delivery pipe, dry-run protection, float switch, level sensors, SPD, earthing, tank, tank tower (placeholder), plumbing, installation & commissioning, borehole-test confirmation (placeholder). The borehole BoQ is **additive** to the generation-system cost.

## Use-case demand helper (rough planning L/day per unit)
residential 150/person · school 5/student · clinic 40/patient · community 20/person · livestock 50/head · irrigation ~20,000/acre (≈5 mm) · dairy/mixed farm 60/head · hotel/lodge 300/guest. The field team confirms actual demand.

## Required confirmations before final design
Borehole test report; static & dynamic water level at design flow; sustained yield & recovery; pump setting depth; pipe route & diameter; tank location & height; cable route; controller location & shading; earthing & SPD; dry-run protection tested; float switch; water quality & pump material; pump rotation & commissioning flow; measured pumping current/voltage; post-commissioning flow test.

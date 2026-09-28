/**
 * borehole-engine-regression.mjs — Voltflow 11.6 (Solar Borehole module)
 * Run: node scripts/borehole-engine-regression.mjs   (npm run test:borehole)
 *
 * Pure feasibility maths for the solar borehole engine. No React, no DOM.
 */
import assert from "node:assert";
import {
  computeBorehole, calculateTotalDynamicHead, calculateHydraulicPower, calculatePumpPower,
  calculateDailyPumpingEnergy, calculateSolarPumpPvSize, calculateTankStorage,
  createDefaultBorehole, normalizeBorehole,
} from "../src/utils/boreholeEngine.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}
const approx = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const noBadNumbers = (o) => JSON.stringify(o, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? "__BAD__" : v)).indexOf("__BAD__") === -1;

console.log(`\n${APP_VERSION} — Borehole Engine Regression\n`);

test("16. TDH = dynamic level + tank height + friction + pressure allowance", () => {
  const r = calculateTotalDynamicHead({ dynamicWaterLevelM: 50, tankHeightM: 6, frictionLossM: 5, pressureAllowanceM: 10 });
  assert.strictEqual(r.totalDynamicHeadM, 71); // 50+6+5+10
});

test("17. Dynamic water level falls back to static + drawdown", () => {
  const r = calculateTotalDynamicHead({ staticWaterLevelM: 30, drawdownM: 8, tankHeightM: 0, frictionLossM: 0, pressureAllowanceM: 0 });
  assert.strictEqual(r.dynamicWaterLevelM, 38);
});

test("18. Required flow = daily demand / pumping hours", () => {
  const r = computeBorehole({ enabled: true, dailyWaterDemandLitres: 24000, desiredPumpingHoursPerDay: 8 }, { psh: 5.5, pr: 0.75 });
  assert.strictEqual(r.requiredFlowLitresPerHour, 3000);
});

test("19. Hydraulic power = Q·H·g / 3600", () => {
  const kw = calculateHydraulicPower({ flowM3ph: 3.6, totalDynamicHeadM: 100 });
  assert.ok(approx(kw, 0.981), `got ${kw}, expected 0.981`);
});

test("20. Pump electrical power applies pump·motor·controller efficiency", () => {
  const kw = calculatePumpPower({ hydraulicPowerKw: 1, pumpEfficiency: 0.55, motorEfficiency: 0.85, controllerEfficiency: 0.95 });
  assert.ok(approx(kw, 2.252, 0.005), `got ${kw}, expected ~2.252`); // 1 / (0.55·0.85·0.95)
});

test("21. Daily pumping energy = pump kW × pumping hours", () => {
  assert.strictEqual(calculateDailyPumpingEnergy({ pumpElectricalKw: 2, pumpingHoursPerDay: 6 }), 12);
});

test("22. PV kWp = daily pumping kWh / (PSH × PR)", () => {
  const kwp = calculateSolarPumpPvSize({ dailyPumpingKwh: 12, psh: 5, pr: 0.75 });
  assert.ok(approx(kwp, 3.2), `got ${kwp}, expected 3.2`); // 12 / 3.75
});

test("23. Tank storage = demand × autonomy days", () => {
  assert.strictEqual(calculateTankStorage({ dailyWaterDemandLitres: 20000, storageAutonomyDays: 2 }), 40000);
});

test("24. Yield warning triggers when required flow exceeds tested yield", () => {
  const r = computeBorehole({ enabled: true, dailyWaterDemandLitres: 30000, desiredPumpingHoursPerDay: 6, boreholeYieldLitresPerHour: 3000 }, {});
  assert.strictEqual(r.yield.sufficient, false); // 5000 L/h needed > 3000 yield
  assert.ok(r.warnings.some((w) => w.code === "YIELD_INSUFFICIENT" && w.level === "critical"));
});

test("25. Night-pumping warning triggers without a non-solar/battery source", () => {
  const r = computeBorehole({ enabled: true, dailyWaterDemandLitres: 10000, requiresNightPumping: true, powerMode: "solar_direct" }, {});
  assert.ok(r.warnings.some((w) => w.code === "NIGHT_PUMPING_NO_SOURCE" && w.level === "critical"));
  // and NOT when a battery is used
  const r2 = computeBorehole({ enabled: true, dailyWaterDemandLitres: 10000, requiresNightPumping: true, powerMode: "solar_with_battery" }, {});
  assert.ok(!r2.warnings.some((w) => w.code === "NIGHT_PUMPING_NO_SOURCE"));
});

test("26. Dry-run warning triggers when protection missing", () => {
  const r = computeBorehole({ enabled: true, dailyWaterDemandLitres: 10000, dryRunProtectionIncluded: false }, {});
  assert.ok(r.warnings.some((w) => w.code === "NO_DRY_RUN"));
  const r2 = computeBorehole({ enabled: true, dailyWaterDemandLitres: 10000, dryRunProtectionIncluded: true }, {});
  assert.ok(!r2.warnings.some((w) => w.code === "NO_DRY_RUN"));
});

test("27. No NaN/Infinity — blank default and a populated fixture", () => {
  const blank = computeBorehole(createDefaultBorehole(), {});
  assert.ok(noBadNumbers(blank), "blank borehole produced only finite numbers");
  const full = computeBorehole({
    enabled: true, useCase: "irrigation", dailyWaterDemandLitres: 20000, desiredPumpingHoursPerDay: 6,
    staticWaterLevelM: 40, drawdownM: 10, pumpSettingDepthM: 60, tankHeightM: 6, horizontalPipeDistanceM: 20,
    pipeDiameterMm: 50, pressureAllowanceM: 10, boreholeYieldLitresPerHour: 4000,
  }, { psh: 5.6, pr: 0.78, panelW: 550 });
  assert.ok(noBadNumbers(full), "populated borehole produced only finite numbers");
  assert.ok(full.totalDynamicHeadM > 0 && full.pumpElectricalKw > 0 && full.recommendedPvKwp > 0 && full.estimatedPanels > 0);
});

test("28. Normalize fills missing keys on an old/partial borehole object", () => {
  const n = normalizeBorehole({ dailyWaterDemandLitres: 5000 });
  assert.strictEqual(n.dailyWaterDemandLitres, 5000);
  assert.strictEqual(n.pumpEfficiency, 0.55);
  assert.strictEqual(n.enabled, false);
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

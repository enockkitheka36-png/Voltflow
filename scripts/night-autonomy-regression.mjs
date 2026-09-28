/**
 * night-autonomy-regression.mjs — Voltflow 11.5.2 (RISK-1)
 * Run: node scripts/night-autonomy-regression.mjs   (npm run test:night)
 *
 * Verifies the pure night-dominant autonomy engine. computeNightAutonomy is fed
 * BOTH shapes in the real app: legacy loads (what the readiness engine passes,
 * via toLegacyLoads) and V2 items. Both are covered here. No React, no DOM.
 */
import assert from "node:assert";
import { computeNightAutonomy, ASSUMED_NIGHT_WINDOW_HOURS } from "../src/utils/nightAutonomy.js";
import { buildProjectReadiness } from "../src/utils/readinessEngine.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}
const noBadNumbers = (obj) => JSON.stringify(obj, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? "__BAD__" : v)).indexOf("__BAD__") === -1;

// Legacy-shape loads (the exact shape toLegacyLoads emits and the readiness
// engine actually passes): watts is effective per-unit, plus a `critical` flag.
const floodlightNight = [{ qty: 10, watts: 100, dayHours: 0, nightHours: 11, critical: true }];      // 11 kWh, all night
const dayDominant = [
  { qty: 1, watts: 3000, dayHours: 8, nightHours: 1, critical: true },   // 24 day / 3 night
  { qty: 5, watts: 10, dayHours: 4, nightHours: 5, critical: false },
];

console.log(`\n${APP_VERSION} — Night-Autonomy Regression\n`);

test("0. Assumed night window is 11 hours", () => {
  assert.strictEqual(ASSUMED_NIGHT_WINDOW_HOURS, 11);
});

test("11. Night-dominant load is detected (legacy shape)", () => {
  const n = computeNightAutonomy(floodlightNight, "Commercial", { batteryKwh: 5 });
  assert.ok(n.isNightDominantLoad, "should flag night-dominant");
  assert.ok(n.nightLoadShare >= 0.65, `nightLoadShare ${n.nightLoadShare} >= 0.65`);
  assert.ok(n.criticalNightLoadShare >= 0.65, "critical night share high");
});

test("12. estimatedNightAutonomyHours calculates safely and is clamped", () => {
  const n = computeNightAutonomy(floodlightNight, "Commercial", { batteryKwh: 5 });
  assert.ok(Number.isFinite(n.estimatedNightAutonomyHours), "finite hours");
  assert.ok(n.estimatedNightAutonomyHours > 0 && n.estimatedNightAutonomyHours <= 72, "within [0,72]");
  // huge battery must not produce Infinity — clamp to 72h
  const big = computeNightAutonomy(floodlightNight, "Commercial", { batteryKwh: 100000 });
  assert.ok(big.estimatedNightAutonomyHours <= 72, "clamped to 72h");
});

test("13. nightEnergyCoverage < 1 and a warning appears when battery is short", () => {
  const n = computeNightAutonomy(floodlightNight, "Commercial", { batteryKwh: 5 }); // usable 3.8 vs 11 needed
  assert.ok(n.nightEnergyCoverage < 1, `coverage ${n.nightEnergyCoverage} < 1`);
  assert.ok(n.nightAutonomyWarning && /night/i.test(n.nightAutonomyWarning), "warning present");
});

test("13b. Coverage >= 1 with a large enough battery (no shortfall warning)", () => {
  const n = computeNightAutonomy(floodlightNight, "Commercial", { batteryKwh: 20 }); // usable 15.2 vs 11
  assert.ok(n.nightEnergyCoverage >= 1, `coverage ${n.nightEnergyCoverage} >= 1`);
});

test("14. Normal day-dominant load does NOT falsely trigger the night warning", () => {
  const n = computeNightAutonomy(dayDominant, "Residential", { batteryKwh: 10 });
  assert.ok(!n.isNightDominantLoad, "not night-dominant");
  assert.strictEqual(n.nightAutonomyWarning, null, "no warning for day-dominant");
});

test("15. No NaN / Infinity when there is zero night load or zero loads", () => {
  const empty = computeNightAutonomy([], "Residential", { batteryKwh: 10 });
  assert.ok(noBadNumbers(empty), "empty loads produce only finite numbers");
  assert.strictEqual(empty.isNightDominantLoad, false);
  const noBattery = computeNightAutonomy(floodlightNight, "Commercial", {}); // batteryKwh undefined
  assert.ok(noBadNumbers(noBattery), "missing battery produces only finite numbers");
});

test("15b. V2 item shape is also supported (ratedW + essential)", () => {
  const v2 = [{ ratedW: 100, qty: 10, dayHours: 0, nightHours: 11, essential: true, dutyCyclePct: 100 }];
  const n = computeNightAutonomy(v2, "Commercial", { batteryKwh: 5 });
  assert.ok(n.isNightDominantLoad, "V2 night-dominant detected");
  assert.ok(n.criticalNightKwh > 10, `criticalNightKwh ${n.criticalNightKwh} ~ 11`);
});

test("16. Night result flows through the readiness engine (legacy loads path)", () => {
  const r = buildProjectReadiness(
    { systemType: "Off-grid", loadAssessmentMode: "Commercial" },
    floodlightNight, [], {}, { batteryKwh: 5, dailyKwh: 11 }, {}, {}, null, false
  );
  assert.ok(r.night, "readiness carries a night object");
  assert.ok(r.night.isNightDominantLoad, "engine sees night-dominant load");
  assert.ok(r.night.nightEnergyCoverage < 1, "engine sees shortfall");
  // and it surfaces as a warning consumers can route on
  assert.ok(r.warnings.some((w) => w.highlightId === "night-autonomy-card"), "night warning surfaced");
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

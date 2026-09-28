/**
 * explainers-regression.mjs — Voltflow 11.7 (Studio: Explain-this)
 * Run: node scripts/explainers-regression.mjs   (npm run test:explainers)
 */
import assert from "node:assert";
import { explain, EXPLAIN_KEYS } from "../src/utils/explainers.js";
import { computeBorehole } from "../src/utils/boreholeEngine.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log("  PASS: " + name); passed++; } catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; } }
const noBad = (o) => JSON.stringify(o, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? "__BAD__" : v)).indexOf("__BAD__") === -1;

const ctx = {
  project: { psh: 5.6, solarCoverage: 0.8, panelW: 550, dod: 0.8, batteryEfficiency: 0.95 },
  sizing: {
    actualKwp: 6.6, panels: 12, requiredKwp: 6.4, designDailyKwh: 22, pr: 0.78, inverterKw: 8, batteryKwh: 12,
    backupEnergyNeed: 9, usableBatteryKwh: 9.1, batteryModules: 3, autonomyHours: 8, totalCost: 950000, annualSavings: 180000, payback: 5.3,
    inverterSizing: { selectedReason: "Load / surge demand", loadBasedInvKw: 8, pvBasedInvKw: 7.3, peakKw: 6.4, isLoadLed: true },
    dcAcAnalysis: { ratio: 0.83, status: "Acceptable", isLow: false, isHigh: false, explanation: "PV and inverter are well matched." },
  },
  borehole: computeBorehole({ enabled: true, dailyWaterDemandLitres: 20000, boreholeYieldLitresPerHour: 5000, staticWaterLevelM: 40, drawdownM: 10, tankHeightM: 6 }, { psh: 5.6, pr: 0.78, panelW: 550 }),
  readiness: { overallScore: 82, readyForProposal: true, criticalIssues: [], night: { nightLoadShare: 0.2, nightEnergyCoverage: 1, estimatedNightAutonomyHours: 6, criticalNightKwh: 2, isNightDominantLoad: false } },
};

console.log(`\n${APP_VERSION} — Explainers Regression\n`);

test("1. Every explain key returns plain + formula text (no empties)", () => {
  EXPLAIN_KEYS.forEach((k) => {
    const e = explain(k, ctx);
    assert.ok(e.title && e.plain && e.plain.length > 10, `${k} has plain text`);
    assert.ok(typeof e.formula === "string", `${k} has a formula field`);
    assert.ok(Array.isArray(e.inputs) && Array.isArray(e.assumptions) && Array.isArray(e.warnings) && Array.isArray(e.verify), `${k} arrays present`);
    assert.ok(e.disclaimer && /confirm/i.test(e.disclaimer), `${k} carries a verify disclaimer`);
  });
});

test("8. Explain drawer returns text for PV size", () => {
  const e = explain("pvSize", ctx);
  assert.ok(/kWp/i.test(e.plain) && /requiredKwp/i.test(e.formula));
});

test("9. Explain drawer returns text for inverter size", () => {
  const e = explain("inverterSize", ctx);
  assert.ok(/kW/i.test(e.plain));
  assert.ok(/Load \/ surge demand/i.test(e.plain) || e.inputs.some((r) => /Reason/i.test(r[0])));
});

test("10. Explain drawer returns text for borehole pump size (+ caveat)", () => {
  const e = explain("boreholePump", ctx);
  assert.ok(/HP|kW/i.test(e.plain), "mentions pump size");
  assert.ok(e.warnings.some((w) => /pump curve and borehole test/i.test(w)), "keeps the pump-selection caveat");
});

test("11. Unknown key falls back gracefully (no crash)", () => {
  const e = explain("nonsense", ctx);
  assert.ok(e.title && e.plain);
});

test("12. Finite for blank context (no NaN/Infinity)", () => {
  EXPLAIN_KEYS.forEach((k) => assert.ok(noBad(explain(k, {})), `${k} blank finite`));
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

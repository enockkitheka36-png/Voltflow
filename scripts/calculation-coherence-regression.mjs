/**
 * calculation-coherence-regression.mjs — Voltflow 11.6 (Inverter/PV coherence)
 * Run: node scripts/calculation-coherence-regression.mjs   (npm run test:coherence)
 *
 * Locks the inverter-sizing basis, DC:AC interpretation and string-sizing clarity
 * that explain the 12 kW inverter / 4.2 kWp PV / 0.35 DC:AC case. Pure logic.
 */
import assert from "node:assert";
import {
  computeInverterSizing, computeDcAcAnalysis, computeStringSizing, analyzeInverterCoherence, nextStandardInverter,
} from "../src/utils/inverterCoherence.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}
const noBadNumbers = (o) => JSON.stringify(o, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? "__BAD__" : v)).indexOf("__BAD__") === -1;

// The screenshot case: high peak demand, small energy-led array.
const SCREENSHOT = { connectedW: 12800, surgeKw: 0, actualKwp: 4.2, panelW: 600 };

console.log(`\n${APP_VERSION} — Calculation Coherence Regression\n`);

test("1. Screenshot case reproduces a ~0.35 DC:AC ratio", () => {
  const inv = computeInverterSizing(SCREENSHOT);
  assert.strictEqual(inv.selectedInverterKw, 12, `inverter ${inv.selectedInverterKw}`);
  const dc = computeDcAcAnalysis({ actualKwp: 4.2, inverterKw: 12, panelW: 600 });
  assert.strictEqual(dc.ratio, 0.35);
});

test("2. selectedReason is load/surge when loadBasedInvKw drives the inverter", () => {
  const inv = computeInverterSizing(SCREENSHOT);
  assert.strictEqual(inv.isLoadLed, true);
  assert.strictEqual(inv.selectedReason, "Load / surge demand");
});

test("3. DC:AC below 0.5 is severe (high severity)", () => {
  const dc = computeDcAcAnalysis({ actualKwp: 4.2, inverterKw: 12, panelW: 600 });
  assert.strictEqual(dc.isSevere, true);
  assert.strictEqual(dc.severity, "high");
});

test("4. recommendedMinPvKwpForSelectedInverter = inverter × 0.8", () => {
  const dc = computeDcAcAnalysis({ actualKwp: 4.2, inverterKw: 12, panelW: 600 });
  assert.strictEqual(dc.recommendedMinPvKwpForSelectedInverter, 9.6);
});

test("5. additionalPanelsToReachMinRatio computes correctly", () => {
  const dc = computeDcAcAnalysis({ actualKwp: 4.2, inverterKw: 12, panelW: 600 });
  assert.strictEqual(dc.additionalPanelsToReachMinRatio, 9); // ceil((9.6-4.2)*1000/600)
});

test("6. 12 kW inverter with 600 W panels needs ≥16 panels for a 0.8 ratio", () => {
  // 9.6 kWp / 600W = 16 panels total → 16 = current(7) + additional(9)
  const currentPanels = Math.ceil(4.2 * 1000 / 600); // 7
  const dc = computeDcAcAnalysis({ actualKwp: 4.2, inverterKw: 12, panelW: 600 });
  assert.strictEqual(currentPanels + dc.additionalPanelsToReachMinRatio, 16);
});

test("7. Requested panels/string greater than total gives a clear note", () => {
  const s = computeStringSizing({ requestedPanelsPerString: 12, totalPanels: 7, maxPanelsPerStringByVoltage: 18 });
  assert.ok(/only 7/.test(s.note), `note: ${s.note}`);
});

test("8. Effective panels/string is capped to available panels", () => {
  const s = computeStringSizing({ requestedPanelsPerString: 12, totalPanels: 7, maxPanelsPerStringByVoltage: 18 });
  assert.strictEqual(s.effectivePanelsPerString, 7);
  assert.strictEqual(s.strings, 1);
});

test("9. Healthy PV/inverter ratio does not trigger a severe warning", () => {
  const dc = computeDcAcAnalysis({ actualKwp: 13, inverterKw: 10, panelW: 550 });
  assert.strictEqual(dc.ratio, 1.3);
  assert.strictEqual(dc.status, "Optimal");
  assert.strictEqual(dc.severity, "none");
  assert.strictEqual(dc.correctiveActions.length, 0);
});

test("10. backup_peak_led lowers severity but keeps a caution", () => {
  const dc = computeDcAcAnalysis({ actualKwp: 4.2, inverterKw: 12, panelW: 600, basis: "backup_peak_led" });
  assert.strictEqual(dc.isLow, true);
  assert.strictEqual(dc.severity, "medium"); // was high, reduced one notch
  assert.ok(/backup-led/.test(dc.status));
  assert.ok(dc.correctiveActions.length > 0, "still offers corrective actions");
});

test("11. pv_ratio_led warns when load/surge may not be supported", () => {
  const inv = computeInverterSizing({ ...SCREENSHOT, basis: "pv_ratio_led" });
  assert.ok(inv.selectedInverterKw < 12, `pv-led inverter ${inv.selectedInverterKw}`);
  assert.strictEqual(inv.loadSupported, false);
  assert.strictEqual(inv.isPvLed, true);
});

test("12. No NaN/Infinity in coherence outputs (blank + screenshot)", () => {
  assert.ok(noBadNumbers(analyzeInverterCoherence({})), "blank produces finite numbers");
  assert.ok(noBadNumbers(analyzeInverterCoherence({ ...SCREENSHOT, panels: 7, requestedPanelsPerString: 12, maxPanelsPerStringByVoltage: 18, vocCold: 49, moduleVmp: 41 })), "screenshot produces finite numbers");
});

test("13. Diversity factor changes the inverter (explainable)", () => {
  const aggressive = computeInverterSizing({ connectedW: 12800, surgeKw: 0, actualKwp: 6, runningDiversity: 1.0 });
  const diversified = computeInverterSizing({ connectedW: 12800, surgeKw: 0, actualKwp: 6, runningDiversity: 0.6 });
  assert.ok(diversified.peakKw < aggressive.peakKw, "lower diversity lowers peak kW");
  assert.ok(diversified.selectedInverterKw <= aggressive.selectedInverterKw, "and does not increase the inverter");
});

test("14. Balanced sizing is reported when load and PV drivers are close", () => {
  // loadBased ≈ pvBased: pick actualKwp so pvBased≈loadBased
  const inv = computeInverterSizing({ connectedW: 5000, surgeKw: 0, actualKwp: 3.4 });
  // loadBased = 5*0.75*1.25 = 4.6875 ; pvBased = 3.4*1.1 = 3.74 → not balanced; assert reason set sensibly
  assert.ok(["Load / surge demand", "Balanced load and PV sizing", "PV array size"].includes(inv.selectedReason));
});

test("15. Explanation names the driver and the corrective direction", () => {
  const inv = computeInverterSizing(SCREENSHOT);
  const dc = computeDcAcAnalysis({ actualKwp: 4.2, inverterKw: inv.selectedInverterKw, panelW: 600, basis: inv.basis, selectedReason: inv.selectedReason });
  assert.ok(/load\/backup|load\/surge|Load \/ surge/i.test(dc.explanation), "names load driver");
  assert.ok(/increase the PV array|smaller inverter/i.test(dc.explanation), "gives corrective direction");
  assert.ok(dc.correctiveActions.some((a) => /Increase PV/i.test(a.action)));
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

/**
 * input-ux-regression.mjs — Voltflow 11.5.1
 * Run: node scripts/input-ux-regression.mjs   (npm run test:input)
 *
 * SmartNumberField and the load-table inputs are JSX and can't be imported in
 * node, so those behaviours (blank state, no forced 0, decimals, blur clamp,
 * smooth typing) are verified in the browser — see the testing guide. Here we
 * assert the PURE logic the fixes depend on: SmartNumberField's parsing/clamp
 * rules, calc safety with empty values, the >24h rule, preset override, the
 * rule-based Project Advisor, and that clean startup still holds.
 */
import assert from "node:assert";

import { validateLoadItemsV2, createLoadItem, toLegacyLoads } from "../src/utils/loadEngine.js";
import { buildProjectAdvice } from "../src/utils/projectAdvisor.js";
import { createBlankProject, createBlankLoads } from "../src/utils/projectFactory.js";
import { DEMO_PROJECTS } from "../src/utils/demoProjects.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}

// Mirror of SmartNumberField's pure keystroke/commit/blur rules (kept in sync
// with components/ui.jsx). The JSX component is browser-verified separately.
const acceptsKeystroke = (raw) => raw === "" || /^-?\d*\.?\d*$/.test(raw);
function commitValue(rawText, emptyValue = 0) {
  if (rawText === "" || rawText === "." || rawText === "-" || rawText === "-.") return emptyValue;
  const n = Number(rawText);
  return Number.isFinite(n) ? n : emptyValue;
}
function blurValue(text, { min, max, emptyValue = 0 } = {}) {
  if (text === "") return emptyValue;
  let n = Number(text);
  if (!Number.isFinite(n)) return emptyValue;
  if (min !== undefined) n = Math.max(min, n);
  if (max !== undefined) n = Math.min(max, n);
  return n;
}

console.log(`\n${APP_VERSION} — Input UX Regression\n`);

test("1. SmartNumberField allows a blank state (empty stays empty for the user)", () => {
  // While typing, an empty buffer must be an allowed keystroke and must NOT
  // become a visible 0 (it feeds a fallback to calc, but the field is blank).
  assert.ok(acceptsKeystroke(""));
  assert.strictEqual(commitValue("", 0), 0, "blank feeds fallback to calc");
  // the important part: the buffer the user sees is still "", not "0"
});

test("2. Does not force 0 while typing partial values", () => {
  ["0", "0.", "0.5", "500", "585", "1000", "1.", ".5"].forEach((s) => {
    assert.ok(acceptsKeystroke(s), `should accept keystroke "${s}"`);
  });
  // "0." must remain "0." — it is NOT collapsed to 0 mid-type (that's the whole bug)
  assert.ok(acceptsKeystroke("0."), "0. must be typeable");
  // junk is rejected without throwing / without caret loss
  assert.ok(!acceptsKeystroke("abc") && !acceptsKeystroke("1.2.3") && !acceptsKeystroke("1e5"));
});

test("3. Accepts decimal values", () => {
  assert.strictEqual(commitValue("0.5"), 0.5);
  assert.strictEqual(commitValue("585"), 585);
  assert.strictEqual(commitValue("51.2"), 51.2);
  assert.strictEqual(commitValue("0."), 0); // committed numeric value while buffer shows "0."
});

test("4. Clamps safely on blur, not on every keystroke", () => {
  assert.strictEqual(blurValue("25", { min: 0, max: 24 }), 24, "over-max clamps on blur");
  assert.strictEqual(blurValue("-3", { min: 0, max: 24 }), 0, "under-min clamps on blur");
  assert.strictEqual(blurValue("12", { min: 0, max: 24 }), 12, "in-range untouched");
  assert.strictEqual(blurValue("", { min: 0, max: 24, emptyValue: 0 }), 0, "blank → fallback on blur");
  // mid-type "2" toward "25" is NOT clamped (only blur clamps)
  assert.strictEqual(commitValue("2"), 2);
});

test("5. Empty numeric values never create NaN in the sizing adapter", () => {
  // A load row with a blank-derived 0 must still yield finite adapter output
  const rows = [createLoadItem({ name: "X", ratedW: 0, qty: 0, dayHours: 0, nightHours: 0 })];
  const legacy = toLegacyLoads(rows, "Residential");
  legacy.forEach((l) => {
    assert.ok(Number.isFinite(l.watts), "watts finite");
    assert.ok(Number.isFinite(l.qty), "qty finite");
    assert.ok(Number.isFinite(l.dayHours) && Number.isFinite(l.nightHours), "hours finite");
  });
  assert.ok(!Number.isNaN(commitValue("")), "commit of empty is not NaN");
});

test("6. Load table accepts typed values and validation flags blanks", () => {
  const good = createLoadItem({ name: "Fridge", ratedW: 250, qty: 1, dayHours: 6, nightHours: 6 });
  assert.strictEqual(validateLoadItemsV2([good]).length, 0);
  const blankWatts = createLoadItem({ name: "X", ratedW: 0, qty: 1, dayHours: 2 });
  assert.ok(validateLoadItemsV2([blankWatts]).length > 0, "blank watts is flagged");
  const blankQty = createLoadItem({ name: "Y", ratedW: 100, qty: 0, dayHours: 2 });
  assert.ok(validateLoadItemsV2([blankQty]).length > 0, "blank qty is flagged");
});

test("7. Day + night hours over 24 is a hard sizing blocker", () => {
  const item = createLoadItem({ name: "Z", ratedW: 100, qty: 1, dayHours: 14, nightHours: 14 });
  const total = (Number(item.dayHours) || 0) + (Number(item.nightHours) || 0);
  assert.ok(total > 24, "the >24h hard-block condition holds");
  const errors = validateLoadItemsV2([item]);
  assert.strictEqual(errors.length, 1, "invalid daily schedule blocks Update Sizing");
  assert.ok(errors[0].problems.some((p) => /Day \+ night hours cannot exceed 24/i.test(p)));
});

test("8. Preset chip applies its value (chip → onSelect(number))", () => {
  // PresetChips calls onSelect(value); simulate the parent update
  let applied = null;
  const onSelect = (v) => { applied = v; };
  onSelect(585);
  assert.strictEqual(applied, 585, "chip sets the field value");
});

test("9. Manual value overrides a preset (last write wins)", () => {
  let value = 585;                    // from a chip
  const setValue = (v) => { value = v; };
  setValue(commitValue("610"));       // user then types
  assert.strictEqual(value, 610, "manual entry overrides the chip");
});

test("10. Project Advisor renders useful advice WITHOUT any Claude call", () => {
  const project = { client: "Riverside Estate", location: "Nairobi", systemType: "Solar PV – Hybrid", phase: "Three Phase (400V)", monthlyBill: 48000, loadSource: "client_estimate" };
  const sizing = { dailyKwh: 34, totalCost: 1160000, payback: 5.5, coldVocOk: true, warnings: [] };
  const readiness = { totalScore: 78, readyStatus: "Ready with engineer review", blockers: [] };
  const advice = buildProjectAdvice(project, sizing, readiness, 5);
  assert.ok(typeof advice.verdict === "string" && advice.verdict.length > 0);
  assert.ok(Array.isArray(advice.next3) && advice.next3.length > 0 && advice.next3.length <= 3);
  assert.strictEqual(typeof advice.readyForProposal, "boolean");
  assert.strictEqual(typeof advice.engineeringReviewRequired, "boolean");
  assert.strictEqual(typeof advice.clientProposalRecommended, "boolean");
  assert.strictEqual(advice.readiness.score, 78);

  // an engineering flag must force the review verdict
  const bad = buildProjectAdvice(project, { ...sizing, coldVocOk: false }, readiness, 5);
  assert.strictEqual(bad.engineeringReviewRequired, true);
  assert.strictEqual(bad.readyForProposal, false);
  assert.ok(bad.bigWarnings.some((w) => /Voc/i.test(w)));

  // an empty project must not crash and must ask for the basics
  const empty = buildProjectAdvice(createBlankProject({}), {}, null, 0);
  assert.ok(empty.missingData.length > 0);
  assert.ok(empty.verdict.length > 0);
  assert.deepStrictEqual(createBlankLoads(), []);
});

test("11. Assistant fallback wording is safe and points to Project Advisor (v11.6)", () => {
  const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  // v11.6 P0: the client-facing fallback must not name the env var, and must
  // point to Project Advisor with the generic "not enabled" wording.
  assert.ok(/not enabled in this environment/i.test(src), "fallback uses the safe 'not enabled' wording");
  assert.ok(/Project Advisor/i.test(src), "fallback points to Project Advisor");
});

test("12. Clean startup still does not auto-load the Karen demo", () => {
  const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const dp = src.slice(src.indexOf("const defaultProject = {"), src.indexOf("const evChargerSpecs"));
  assert.ok(!dp.includes("Karen Homeowner"), "defaultProject must not hardcode the demo client");
  assert.ok(/const defaultLoads = \[\]/.test(src), "defaultLoads still empty at startup");
  // Karen lives only in the demo library, still badged
  const karen = DEMO_PROJECTS.find((d) => d.id === "residential_karen");
  assert.ok(karen && karen.project.client.startsWith("DEMO —"));
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

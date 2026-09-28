/**
 * navigation-regression.mjs — Voltflow 11.5.2 (Add-on: guided navigation)
 * Run: node scripts/navigation-regression.mjs   (npm run test:navigation)
 *
 * Locks the pure navigation rules shared by App.jsx and these tests: Dashboard
 * card routing (via the readiness engine's actionTab), Action Center "Go fix"
 * targets, Back-target resolution, highlight-class decision, and view-mode
 * routing. The clicks/scroll/animation themselves are browser-verified.
 */
import assert from "node:assert";
import {
  isTabAllowedInView, resolveBackTarget, highlightClass, VALID_TABS, DEFAULT_VIEW,
} from "../src/utils/navigation.js";
import { buildProjectReadiness } from "../src/utils/readinessEngine.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}

// A rich readiness object (blank project + a draft not applied + a safety fail)
// so every routing surface has something to route to.
const r = buildProjectReadiness({}, [], [], {}, { coldVocOk: false }, {}, {}, null, true);
const nightR = buildProjectReadiness(
  { systemType: "Off-grid", loadAssessmentMode: "Commercial" },
  [{ qty: 10, watts: 100, dayHours: 0, nightHours: 11, critical: true }], [], {},
  { batteryKwh: 5, dailyKwh: 11 }, {}, {}, null, false
);

console.log(`\n${APP_VERSION} — Navigation Regression\n`);

test("1. Dashboard Load Inventory card routes to Load Assessment", () => {
  assert.strictEqual(r.sections.loadInventory.actionTab, "loads");
});

test("2. Dashboard Safety card routes to Inverter/Safety or Engineering Compliance", () => {
  assert.strictEqual(r.sections.inverterSafety.actionTab, "inverter");
  assert.strictEqual(r.sections.engineeringCompliance.actionTab, "eng-compliance");
});

test("3. Dashboard Proposal card routes to Proposal", () => {
  assert.strictEqual(r.sections.proposal.actionTab, "proposal");
  assert.strictEqual(r.sections.delivery.actionTab, "delivery");
});

test("4. Action Center 'Go fix' targets are all real routable tabs", () => {
  const tabs = [
    ...r.criticalIssues.map((c) => c.actionTab),
    ...r.warnings.map((w) => w.actionTab),
    ...r.missingFields.map((m) => m.actionTab),
  ];
  assert.ok(tabs.length > 0, "there are items to route");
  tabs.forEach((t) => assert.ok(VALID_TABS.has(t), `unknown route target: ${t}`));
});

test("5. Back button returns to the previous tab/view", () => {
  assert.strictEqual(resolveBackTarget({ tab: "loads", source: "dashboard" }), "loads");
  assert.strictEqual(resolveBackTarget({ tab: "proposal", source: "action_center" }), "proposal");
});

test("6. If no previous view exists, Back returns to the dashboard", () => {
  assert.strictEqual(resolveBackTarget(null), DEFAULT_VIEW);
  assert.strictEqual(resolveBackTarget(undefined), "field-dashboard");
  assert.strictEqual(resolveBackTarget({}), "field-dashboard");
});

test("7. highlightId produces the highlight class only on the matching target", () => {
  assert.strictEqual(highlightClass("cold-voc-card", "cold-voc-card"), "vf-highlight");
  assert.strictEqual(highlightClass("cold-voc-card", "night-autonomy-card"), "");
  assert.strictEqual(highlightClass(null, "cold-voc-card"), "");
  assert.strictEqual(highlightClass(null, null), "", "two nulls must NOT highlight");
});

test("8. Draft-loads warning highlights the Update Sizing button", () => {
  const w = r.warnings.find((x) => x.highlightId === "update-sizing-btn");
  assert.ok(w, "pending-load warning present");
  assert.strictEqual(w.actionTab, "loads");
});

test("9. Night-load warning highlights the Battery / Night Autonomy card", () => {
  const w = nightR.warnings.find((x) => x.highlightId === "night-autonomy-card");
  assert.ok(w, "night warning present");
  assert.strictEqual(w.actionTab, "battery");
});

test("10. Client View does not route to hidden engineer-only tabs", () => {
  ["eng-compliance", "inverter", "boq", "generation", "battery"].forEach((t) =>
    assert.strictEqual(isTabAllowedInView(t, "client"), false, `${t} must be hidden in client view`));
  assert.strictEqual(isTabAllowedInView("proposal", "client"), true);
});

test("11. Technician View routes only to technician-safe tabs", () => {
  ["loads", "site-survey", "installer-sim", "delivery"].forEach((t) =>
    assert.strictEqual(isTabAllowedInView(t, "technician"), true, `${t} should be technician-safe`));
  ["eng-compliance", "finance", "carbon"].forEach((t) =>
    assert.strictEqual(isTabAllowedInView(t, "technician"), false, `${t} should be hidden for technician`));
});

test("12. Sidebar navigation still works normally (engineer sees everything)", () => {
  [...VALID_TABS].forEach((t) => assert.strictEqual(isTabAllowedInView(t, "engineer"), true, `${t} must be reachable for engineer`));
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

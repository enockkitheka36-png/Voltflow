/**
 * uAT-flow-regression.mjs — Voltflow 11.7.1 (bank pilot UAT surfaces)
 * Run: node scripts/uAT-flow-regression.mjs   (npm run test:uat)
 *
 * UAT is manual (see VOLTFLOW_BANK_PILOT_UAT_TEST_PLAN.md). This script confirms
 * the SURFACES each UAT scenario needs exist + the pure flow logic behaves.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { buildScenarioProject, SCENARIOS } from "../src/utils/scenarios.js";
import { isTabAllowedInView } from "../src/utils/navigation.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log("  PASS: " + name); passed++; } catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; } }
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

console.log(`\n${APP_VERSION} — Bank Pilot UAT Flow Regression\n`);

test("Scenario 1-3: lead + site + basics captured in the bank flow", () => {
  assert.ok(/Client \/ lead name/i.test(app) && /Site location/i.test(app) && /monthly electricity bill/i.test(app));
});

test("Scenario 4-5: choose a package + review quote summary", () => {
  assert.ok(/Choose a standard package/i.test(app) && /Recommended system/i.test(app) && /Indicative investment/i.test(app));
  // 3 standard variants
  assert.strictEqual(SCENARIOS.filter((s) => s.id !== "custom").length, 3);
  const g = buildScenarioProject({ solarCoverage: 0.8, backupHours: 8, autonomyDays: 1 }, "best");
  assert.ok(g.backupHours > 8, "best variant increases backup");
});

test("Scenario 6-8: proposal + local ready marker + status tracking", () => {
  assert.ok(/Generate proposal/i.test(app), "generate proposal action");
  assert.ok(/Mark ready locally/i.test(app), "local ready marker");
  assert.ok(/Solarise has not received this automatically/i.test(app), "honest local-only status");
  assert.ok(/bankPilotSubmitted/.test(app), "submit status persisted");
  assert.ok(/Quote status/i.test(app), "status shown");
});

test("Scenario 9-10: export + import present", () => {
  assert.ok(/Export Project JSON/i.test(app), "export available");
  assert.ok(/applyPendingImport|pendingImport/.test(app), "staged import present");
});

test("Scenario 11-12: Client View + Finance view selectable", () => {
  assert.ok(/"client", "👤 Client"/.test(app) && /"bank", "🏦 Finance"/.test(app), "view-mode toggle offers client + finance");
  assert.strictEqual(isTabAllowedInView("bank-flow", "bank"), true);
  assert.strictEqual(isTabAllowedInView("bank-flow", "engineer"), true, "engineer can also open it");
});

test("Scenario 13: error handling — bank flow guards required fields", () => {
  assert.ok(/disabled=\{submitted \|\| !hasPackage \|\| !pilotSafetyAcknowledged\}/.test(app), "submit disabled until a package is chosen and data rules are acknowledged");
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

/**
 * pilot-safety-hotfix-regression.mjs - Voltflow 11.7.2+
 * Run: node scripts/pilot-safety-hotfix-regression.mjs   (npm run test:pilot)
 *
 * Guards the 11.7.2 controlled-pilot hotfixes: explicit bank-flow data-rule
 * acknowledgement, browser-only/no-access-control messaging, and export/import
 * metadata that travels with project JSON without adding secrets.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { APP_VERSION, SCHEMA_VERSION } from "../src/utils/schemaMigration.js";
import { exportProjectJson, importProjectJson, PILOT_SAFETY_METADATA } from "../src/utils/projectStorage.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log("  PASS: " + name);
    passed++;
  } catch (e) {
    console.error("  FAIL: " + name);
    console.error("    " + e.message);
    failed++;
  }
}

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

console.log(`\n${APP_VERSION} - Pilot Safety Hotfix Regression\n`);

test("1. App version is bumped for the hotfix without changing persisted schema", () => {
  // v11.8.1 — accept the 11.8.x bump too; persisted schema must still be 11.7.
  assert.ok(/^Voltflow 11\.(7\.2[a-z]?|8(\.\d+)?)$/i.test(APP_VERSION), `unexpected pilot version: ${APP_VERSION}`);
  assert.strictEqual(SCHEMA_VERSION, "11.7");
});

test("2. Bank submit requires explicit pilot data-rule acknowledgement", () => {
  assert.ok(/pilotSafetyAcknowledged/.test(app), "acknowledgement persisted in project state");
  assert.ok(/disabled=\{submitted \|\| !hasPackage \|\| !pilotSafetyAcknowledged\}/.test(app), "submit is gated");
  assert.ok(/Confirm the pilot data rules before marking ready locally/i.test(app), "safe guard message present");
  assert.ok(/I understand the pilot data rules/i.test(app), "visible acknowledgement text present");
});

test("3. UI states the real pilot constraints plainly", () => {
  assert.ok(/Browser-only storage/i.test(app), "persistent browser-only banner");
  assert.ok(/view modes are not access control/i.test(app), "bank warning names view-mode limitation");
  assert.ok(/Use test or non-sensitive customer data only/i.test(app), "non-sensitive data rule visible");
  assert.ok(/auth and tenant isolation/i.test(app), "production security dependency visible");
});

test("4. Project export injects pilot-safety metadata and no secret markers", () => {
  const { jsonString } = exportProjectJson({
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    project: { client: "Pilot Test", location: "Nairobi" },
    loadItemsV2: [],
    survey: {},
    simulation: {},
  });
  const parsed = JSON.parse(jsonString);
  assert.deepStrictEqual(parsed.pilotSafety, PILOT_SAFETY_METADATA);
  assert.strictEqual(parsed.pilotSafety.productionDeploymentApprovalRequired, true);
  assert.ok(!/ANTHROPIC|api[_-]?key|secret|process\.env|BEGIN [A-Z ]*PRIVATE KEY/i.test(jsonString), "no secret markers in export");
});

test("5. Import review surfaces missing or present pilot-safety metadata", () => {
  const legacy = importProjectJson(JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    appVersion: "Voltflow 11.7.1",
    project: { client: "Legacy" },
    loadItemsV2: [],
    survey: {},
    simulation: {},
  }), { schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION });
  assert.ok(legacy.ok);
  assert.ok(legacy.warnings.some((w) => /pilot-safety metadata/i.test(w)), "older export gets safety warning");

  const exported = exportProjectJson({
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    project: { client: "Current" },
    loadItemsV2: [],
    survey: {},
    simulation: {},
  });
  const current = importProjectJson(exported.jsonString, { schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION });
  assert.ok(current.ok);
  assert.strictEqual(current.summary.hasPilotSafety, true);
  assert.ok(!current.warnings.some((w) => /pilot-safety metadata/i.test(w)), "current export has metadata");
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

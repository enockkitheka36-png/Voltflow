/**
 * borehole-ui-regression.mjs — Voltflow 11.6 (Borehole integration)
 * Run: node scripts/borehole-ui-regression.mjs   (npm run test:borehole-ui)
 *
 * Verifies the borehole module is wired into the app: tab, route, readiness,
 * Action Center, Advisor, BoQ, proposal and save/load migration. UI rendering is
 * browser-verified; here we assert the integration (source + pure logic).
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { buildProjectReadiness } from "../src/utils/readinessEngine.js";
import { computeBorehole, buildBoreholeBoQ, normalizeBorehole, createDefaultBorehole } from "../src/utils/boreholeEngine.js";
import { VALID_TABS, TECHNICIAN_SAFE_TABS, isTabAllowedInView } from "../src/utils/navigation.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

// An enabled borehole with a shortfall + missing dry-run → criticals + warnings.
const bh = computeBorehole({
  enabled: true, dailyWaterDemandLitres: 30000, desiredPumpingHoursPerDay: 6,
  boreholeYieldLitresPerHour: 3000, requiresNightPumping: true, powerMode: "solar_direct",
  dryRunProtectionIncluded: false,
}, { psh: 5.5, pr: 0.75, panelW: 550 });

console.log(`\n${APP_VERSION} — Borehole UI / Integration Regression\n`);

test("1. Solar Borehole tab component + route + nav entry exist", () => {
  assert.ok(/function SolarBorehole/.test(app), "SolarBorehole component");
  assert.ok(/active === "borehole"/.test(app), "borehole route");
  assert.ok(/btn\("borehole"/.test(app), "borehole nav entry");
});

test("2. Borehole result memo is wired (computeBorehole)", () => {
  assert.ok(/computeBorehole\(project\.borehole/.test(app), "boreholeResult memo uses project.borehole");
});

test("3. borehole is a valid, technician-safe route", () => {
  assert.ok(VALID_TABS.has("borehole"));
  assert.ok(TECHNICIAN_SAFE_TABS.has("borehole"));
  assert.strictEqual(isTabAllowedInView("borehole", "technician"), true);
  assert.strictEqual(isTabAllowedInView("borehole", "engineer"), true);
});

test("4. Borehole criticals appear in readiness (Action Center feed)", () => {
  const r = buildProjectReadiness({}, [], [], {}, {}, {}, {}, null, false, bh);
  assert.ok(r.criticalIssues.some((c) => /Borehole:/.test(c.label)), "borehole critical surfaced");
  assert.ok(r.criticalIssues.every((c) => c.label.includes("Borehole") ? c.actionTab === "borehole" : true), "routes to borehole tab");
});

test("5. Borehole warnings appear in readiness warnings", () => {
  const r = buildProjectReadiness({}, [], [], {}, {}, {}, {}, null, false, bh);
  assert.ok(r.warnings.some((w) => /Borehole:/.test(w.label)), "borehole warning surfaced");
});

test("6. Borehole readiness section is present when enabled", () => {
  const r = buildProjectReadiness({}, [], [], {}, {}, {}, {}, null, false, bh);
  assert.ok(r.sections.borehole, "borehole section exists");
  assert.strictEqual(r.sections.borehole.actionTab, "borehole");
});

test("7. Advisor agrees — it reads the same central readiness (source)", () => {
  assert.ok(/ProjectAdvisorPanel readiness=\{readiness\}/.test(app) || /ProjectAdvisorPanel[\s\S]{0,120}readiness=/.test(app), "advisor fed by readiness");
});

test("8. Borehole BoQ rows are produced and wired into the BoQ", () => {
  const boq = buildBoreholeBoQ({ enabled: true, dailyWaterDemandLitres: 20000, pumpType: "dc_submersible" }, bh);
  assert.ok(boq.rows.length > 5 && boq.total > 0, "borehole BoQ has priced rows");
  assert.ok(/buildBoreholeBoQ\(project\.borehole/.test(app), "BOQ component appends borehole rows");
});

test("9. Borehole proposal section is wired", () => {
  assert.ok(/summarizeBoreholeForProposal/.test(app), "proposal uses borehole summary");
  assert.ok(/Solar Borehole & Water Pumping Solution/.test(app), "proposal borehole heading present");
});

test("10. Double-count guard is present (pump in loads + module)", () => {
  assert.ok(/PUMP_DOUBLE_COUNT/.test(app), "double-count guard wired");
});

test("11. Borehole data migrates safely (old projects without it)", () => {
  const def = createDefaultBorehole();
  assert.strictEqual(def.enabled, false);
  const migrated = normalizeBorehole(undefined);
  assert.deepStrictEqual(migrated, def, "undefined → full default");
  const partial = normalizeBorehole({ dailyWaterDemandLitres: 12345 });
  assert.strictEqual(partial.dailyWaterDemandLitres, 12345);
  assert.strictEqual(partial.pumpEfficiency, 0.55, "missing keys filled");
});

test("12. Borehole round-trips through JSON (save/export/import)", () => {
  const b = { ...createDefaultBorehole(), enabled: true, dailyWaterDemandLitres: 9000 };
  const round = normalizeBorehole(JSON.parse(JSON.stringify(b)));
  assert.strictEqual(round.enabled, true);
  assert.strictEqual(round.dailyWaterDemandLitres, 9000);
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

/**
 * template-gallery-regression.mjs — Voltflow 11.7 (Studio templates + scenarios)
 * Run: node scripts/template-gallery-regression.mjs   (npm run test:templates)
 */
import assert from "node:assert";
import { TEMPLATES, listTemplates, getTemplate, applyTemplate } from "../src/utils/projectTemplates.js";
import { SCENARIOS, buildScenarioProject, scenarioConfidence } from "../src/utils/scenarios.js";
import { createBlankProject } from "../src/utils/projectFactory.js";
import { validateLoadItemsV2 } from "../src/utils/loadEngine.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log("  PASS: " + name); passed++; } catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; } }
const noBad = (o) => JSON.stringify(o, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? "__BAD__" : v)).indexOf("__BAD__") === -1;
const base = createBlankProject({});

console.log(`\n${APP_VERSION} — Template Gallery + Scenarios Regression\n`);

test("1. Gallery lists all 13 templates with required preview meta", () => {
  const list = listTemplates();
  assert.strictEqual(list.length, 13, `expected 13, got ${list.length}`);
  list.forEach((t) => ["id", "name", "icon", "category", "systemType", "description"].forEach((k) => assert.ok(t[k], `${t.id} missing ${k}`)));
});

test("2. Every template applies cleanly → valid project + valid loads, no NaN", () => {
  TEMPLATES.forEach((t) => {
    const r = applyTemplate(base, t.id);
    assert.ok(r && r.project && Array.isArray(r.loadItemsV2), `${t.id} applied`);
    assert.strictEqual(r.project.systemType, t.systemType);
    assert.strictEqual(r.project.selectedTemplateId, t.id);
    const errs = validateLoadItemsV2(r.loadItemsV2.filter((l) => l.ratedW > 0)); // template 0W pump rows are placeholders
    assert.strictEqual(errs.length, 0, `${t.id} produced invalid loads: ${JSON.stringify(errs)}`);
    assert.ok(noBad(r.project) && noBad(r.loadItemsV2), `${t.id} finite`);
    assert.ok(r.meta.proposalLanguage.solution, `${t.id} has proposal language`);
  });
});

test("4. Templates load the expected default project data", () => {
  const r = applyTemplate(base, "residential_backup");
  assert.strictEqual(r.project.systemType, "Solar PV – Hybrid");
  assert.strictEqual(r.loadAssessmentMode, "Residential");
  assert.strictEqual(r.loadItemsV2.length, 5);
  assert.ok(r.meta.boqCategories.length > 0 && r.meta.checklistItems.length > 0);
});

test("5. Farm Solar + Borehole template ENABLES the borehole module", () => {
  const r = applyTemplate(base, "farm_borehole");
  assert.strictEqual(r.borehole.enabled, true, "borehole enabled");
  assert.strictEqual(r.project.borehole.enabled, true, "borehole on project");
  assert.ok(r.borehole.dailyWaterDemandLitres > 0, "demand preloaded");
  // a non-borehole template must NOT enable it
  assert.strictEqual(applyTemplate(base, "residential_backup").borehole.enabled, false);
});

test("6. Scenario cards expose Good / Better / Best / Custom", () => {
  assert.deepStrictEqual(SCENARIOS.map((s) => s.id), ["good", "better", "best", "custom"]);
  SCENARIOS.forEach((s) => assert.ok(s.name && s.tag && s.desc, `${s.id} meta`));
});

test("7. 'Use this design' applies a scenario safely (clamped, finite)", () => {
  const good = buildScenarioProject({ ...base, solarCoverage: 0.8, backupHours: 8, autonomyDays: 1 }, "good");
  const best = buildScenarioProject({ ...base, solarCoverage: 0.8, backupHours: 8, autonomyDays: 1 }, "best");
  assert.ok(good.solarCoverage < 0.8 && good.solarCoverage >= 0.3, "good lowers coverage, clamped");
  assert.ok(best.backupHours > 8, "best raises backup");
  assert.ok(best.solarCoverage <= 1.0, "coverage capped at 1.0");
  assert.strictEqual(good.selectedScenarioId, "good");
  // custom returns base values unchanged
  const custom = buildScenarioProject({ ...base, solarCoverage: 0.8 }, "custom");
  assert.strictEqual(custom.solarCoverage, 0.8);
  assert.ok(noBad(good) && noBad(best) && noBad(custom));
});

test("8. scenarioConfidence is a finite 0..100 score", () => {
  const c = scenarioConfidence({ batteryKwh: 10, dcAcAnalysis: { ratio: 1.1 } }, { criticalIssues: [], readyForProposal: true });
  assert.ok(c >= 0 && c <= 100 && Number.isFinite(c));
  const c2 = scenarioConfidence({}, { criticalIssues: [{}, {}], readyForProposal: false });
  assert.ok(c2 >= 0 && c2 <= 100);
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

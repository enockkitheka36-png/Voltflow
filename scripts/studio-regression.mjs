/**
 * studio-regression.mjs — Voltflow 11.7 (Studio: blocks, routing, migration)
 * Run: node scripts/studio-regression.mjs   (npm run test:studio)
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { buildStudioBlocks, studioProgressPct } from "../src/utils/studioBlocks.js";
import { buildProjectReadiness } from "../src/utils/readinessEngine.js";
import { computeBorehole } from "../src/utils/boreholeEngine.js";
import { VALID_TABS } from "../src/utils/navigation.js";
import { normalizeProposalStudioConfig } from "../src/utils/proposalStudio.js";
import { normalizeAssetSelections } from "../src/utils/assetLibrary.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log("  PASS: " + name); passed++; } catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; } }
const noBad = (o) => JSON.stringify(o, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? "__BAD__" : v)).indexOf("__BAD__") === -1;

const readinessBlank = buildProjectReadiness({}, [], [], {}, {}, {}, {}, null, false);
const sizing = { dailyKwh: 12, actualKwp: 6.6, batteryKwh: 12, inverterKw: 8, totalCost: 950000 };
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

console.log(`\n${APP_VERSION} — Studio Regression\n`);

test("1. Studio tab is wired into the app (component + route + nav)", () => {
  assert.ok(/function VoltflowStudio/.test(app), "VoltflowStudio component");
  assert.ok(/active === "studio"/.test(app), "studio route");
  assert.ok(/btn\("studio"/.test(app), "studio nav entry");
});

test("2. buildStudioBlocks returns the 10 project blocks with statuses", () => {
  const blocks = buildStudioBlocks(readinessBlank, sizing, null, false);
  assert.strictEqual(blocks.length, 10);
  const keys = blocks.map((b) => b.key);
  ["client", "site", "loads", "pv", "battery", "inverter", "borehole", "boq", "proposal", "delivery"].forEach((k) => assert.ok(keys.includes(k), `has ${k}`));
  const statuses = new Set(["not_started", "incomplete", "in_progress", "needs_review", "complete"]);
  blocks.forEach((b) => {
    assert.ok(statuses.has(b.status), `${b.key} valid status: ${b.status}`);
    assert.ok(typeof b.missingCount === "number" && typeof b.warningCount === "number", `${b.key} counts`);
    assert.ok(b.label && b.icon && b.actionTab, `${b.key} meta`);
  });
});

test("3. Every Studio block routes to a real tab", () => {
  const blocks = buildStudioBlocks(readinessBlank, sizing, null, false);
  blocks.forEach((b) => assert.ok(VALID_TABS.has(b.actionTab), `${b.key} → unknown tab ${b.actionTab}`));
});

test("3b. Borehole block reflects module on/off", () => {
  const off = buildStudioBlocks(readinessBlank, sizing, null, false).find((b) => b.key === "borehole");
  assert.strictEqual(off.metric, "Off");
  const bres = computeBorehole({ enabled: true, dailyWaterDemandLitres: 20000 }, {});
  const rOn = buildProjectReadiness({}, [], [], {}, {}, {}, {}, null, false, bres);
  const on = buildStudioBlocks(rOn, sizing, bres, true).find((b) => b.key === "borehole");
  assert.ok(/L\/day/.test(on.metric), "shows water metric when enabled");
});

test("18. Studio progress + blocks are finite (no NaN) even blank", () => {
  const blocks = buildStudioBlocks(readinessBlank, {}, null, false);
  const pct = studioProgressPct(blocks);
  assert.ok(pct >= 0 && pct <= 100 && Number.isFinite(pct));
  assert.ok(noBad(blocks));
});

test("17. New persisted Studio fields migrate safely (old projects)", () => {
  // proposalStudioConfig + assetSelections normalize from undefined
  assert.strictEqual(normalizeProposalStudioConfig(undefined).sections.length, 17);
  assert.deepStrictEqual(normalizeAssetSelections(undefined), []);
  // App wires the migration
  assert.ok(/normalizeProposalStudioConfig\(mergedProject\.proposalStudioConfig\)/.test(app), "proposalStudioConfig migrated");
  assert.ok(/normalizeAssetSelections\(mergedProject\.assetSelections\)/.test(app), "assetSelections migrated");
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

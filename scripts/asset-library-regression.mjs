/**
 * asset-library-regression.mjs — Voltflow 11.7 (Studio: Asset Library)
 * Run: node scripts/asset-library-regression.mjs   (npm run test:assets)
 */
import assert from "node:assert";
import { ASSET_CATEGORIES, DEFAULT_ASSETS, listAssets, getAsset, createAssetSelection, normalizeAssetSelections, assetCompatibilityWarning } from "../src/utils/assetLibrary.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log("  PASS: " + name); passed++; } catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; } }

console.log(`\n${APP_VERSION} — Asset Library Regression\n`);

test("13. Asset library loads all 12 categories + a seed catalogue", () => {
  const keys = ASSET_CATEGORIES.map((c) => c.key);
  ["panels", "inverters", "batteries", "pumps", "controllers", "mounting", "protection", "cables", "tanks", "ev_chargers", "generators", "monitoring"].forEach((k) => assert.ok(keys.includes(k), `has ${k}`));
  assert.strictEqual(ASSET_CATEGORIES.length, 12);
  assert.ok(DEFAULT_ASSETS.length >= 12, "seed catalogue populated");
  DEFAULT_ASSETS.forEach((a) => ["id", "category", "brand", "model", "capacity", "unit", "price", "warranty", "supplier", "datasheetUrl", "compatibilityNotes", "stockStatus"].forEach((k) => assert.ok(k in a, `${a.id} has ${k}`)));
});

test("14. Asset can be added to a project (selection normalizes)", () => {
  const sel = createAssetSelection("pnl_550_mono", { qty: 12, preferred: true });
  assert.strictEqual(sel.assetId, "pnl_550_mono");
  assert.strictEqual(sel.category, "panels");
  assert.strictEqual(sel.qty, 12);
  assert.strictEqual(sel.preferred, true);
  const norm = normalizeAssetSelections([sel, { assetId: "inv_5k_hyb", qty: "1" }, { bogus: true }, null]);
  assert.strictEqual(norm.length, 2, "invalid entries dropped");
  assert.strictEqual(norm[1].qty, 1);
});

test("15. listAssets filters by category", () => {
  const panels = listAssets("panels");
  assert.ok(panels.length >= 2 && panels.every((a) => a.category === "panels"));
  assert.ok(listAssets().length === DEFAULT_ASSETS.length);
  assert.ok(getAsset("bat_512_lfp").category === "batteries");
});

test("16. Compatibility warning placeholder fires sensibly", () => {
  const singlePhaseInv = getAsset("inv_5k_hyb");
  assert.ok(assetCompatibilityWarning(singlePhaseInv, { phase: "Three phase" }), "single-phase inverter flagged on 3-phase project");
  assert.ok(/pump curve/i.test(assetCompatibilityWarning(getAsset("pmp_dc_2hp"), {}) || ""), "pump advises curve check");
  assert.strictEqual(assetCompatibilityWarning(getAsset("pnl_550_mono"), {}), null, "panel has no warning");
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

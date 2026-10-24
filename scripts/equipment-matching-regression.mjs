import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { openSizingAuditRuntime } from "./lib/sizingAuditRuntime.mjs";
import { assessEquipment, equipmentBankLimits, normalizeEquipmentSelection, resolveEquipmentProject, updateEquipmentSelection } from "../src/utils/equipmentMatching.js";
import { DOCUMENTED_ASSETS, EQUIPMENT_CATALOGUE_VERSION, EQUIPMENT_SOURCES } from "../src/utils/equipmentCatalogue.js";
import { createDesignRevision, computeOptionSizing } from "../src/utils/designRevision.js";
import { buildProjectReadiness } from "../src/utils/readinessEngine.js";
import { calculateReadiness } from "../src/utils/readiness.js";
import { buildReport, reportToText } from "../src/utils/reportBuilder.js";
import { buildQuotationPDF } from "../src/utils/pdfGenerator.js";
import { migrateLegacyLoadsToV2 } from "../src/utils/schemaMigration.js";

const runtime = await openSizingAuditRuntime();
const results = [];
const selection = {
  enabled: true, inverterId: "gw5000_es20", batteryId: "lx_u54_20", panelId: "longi_440_hth",
  batteryQuantity: 2, modulesPerString: 8, stringCount: 1, armFirmware: "02", firmwareEvidence: "Synthetic test fixture; not a field device",
  protocol: "CAN", market: "KENYA", minAmbientC: 5, maxAmbientC: 40, altitudeM: 1700,
  hotModuleVmp: 27, hotVmpEvidence: "Synthetic test assumption; not an engineering benchmark",
  designPowerFactor: 1, powerFactorEvidence: "Synthetic unity-PF test load; not a field measurement",
  panelPrice: 11000, inverterPrice: 145000, batteryPrice: 240000, priceBasis: "ESTIMATE", sourceVersion: EQUIPMENT_CATALOGUE_VERSION,
};
const loads = [{ id: "fixture", name: "Synthetic load", qty: 1, watts: 1000, dayHours: 6, nightHours: 2, surge: 1, critical: true }];
const base = { ...runtime.defaults, systemType: "Solar PV – Hybrid", phase: "Single phase", backupHours: 4, equipmentSelection: selection };
const size = (patch = {}, projectPatch = {}) => runtime.size({ ...base, ...projectPatch, equipmentSelection: { ...selection, ...patch } }, loads);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.011, `${actual} != ${expected}`);
async function check(label, action) {
  try { await action(); results.push({ label, status: "PASS" }); console.log(`PASS: ${label}`); }
  catch (error) { results.push({ label, status: "FAIL", error: error.message }); console.error(`FAIL: ${label}: ${error.message}`); }
}
try {
  await check("Catalogue has exact source revision, region, date, primary links and no invented prices", () => {
    assert.equal(DOCUMENTED_ASSETS.length, 5);
    for (const source of Object.values(EQUIPMENT_SOURCES)) for (const key of ["revision", "region", "checkedOn", "url"]) assert.ok(source[key]);
    for (const asset of DOCUMENTED_ASSETS) { assert.equal(asset.price, null); assert.equal(asset.stockStatus, "unknown"); assert.ok(asset.sources.length); }
  });
  await check("Complete synthetic matching fixture verifies only its documented scope", () => {
    const result = size();
    assert.equal(result.equipment.status, "Verified", JSON.stringify(result.equipment.checks.filter((item) => item.status !== "Verified")));
    assert.equal(result.quoteReady, true);
    assert.match(result.equipment.scope, /not engineering certification/);
  });
  await check("Selected quantities, published usable energy, bank cap and exact inverter drive actual main engine", () => {
    const result = size();
    assert.equal(result.panels, 8); assert.equal(result.batteryModules, 2); assert.equal(result.inverterKw, 5);
    close(result.batteryKwh, 10.8); close(result.usableBatteryKwh, 10.8 * base.batteryEfficiency);
    assert.equal(result.bmsMaxDischargeA, 100); close(result.equipment.limits.powerKw, 5.12);
    close(result.batteryCost, 2 * selection.batteryPrice + 16000);
    assert.match(result.quote.lines.find((line) => line.sku === "INVERTER").description, /GW5000-ES-20/);
    assert.match(result.quote.lines.find((line) => line.sku === "PV-MODULES").description, /LR5-54HTH-440M/);
  });
  for (const [label, patch, expectedCode, status] of [
    ["Unlisted battery", { batteryId: "unknown" }, "MODELS", "Unverified"],
    ["Missing firmware evidence", { firmwareEvidence: "" }, "FIRMWARE", "Unverified"],
    ["Wrong firmware type", { armFirmware: "DSP 12" }, "FIRMWARE", "Unverified"],
    ["ARM below documented minimum", { armFirmware: "01" }, "FIRMWARE", "Incompatible"],
    ["RS485 instead of CAN", { protocol: "RS485" }, "COMMUNICATION", "Incompatible"],
    ["Unknown bank count", { batteryQuantity: null }, "BANK_QUANTITY", "Unverified"],
    ["Too many batteries", { batteryQuantity: 7 }, "BANK_QUANTITY", "Incompatible"],
    ["Fractional batteries", { batteryQuantity: 1.5 }, "BANK_QUANTITY", "Incompatible"],
    ["Parallel string topology", { stringCount: 3 }, "TOPOLOGY", "Incompatible"],
    ["Fractional string length", { modulesPerString: 8.5 }, "TOPOLOGY", "Incompatible"],
    ["Excess cold voltage", { modulesPerString: 18 }, "COLD_VOC", "Incompatible"],
    ["PV oversizing beyond exact input rating", { modulesPerString: 10, stringCount: 2 }, "PV_POWER", "Incompatible"],
    ["Missing worst-case hot voltage", { hotModuleVmp: null }, "HOT_MPPT", "Unverified"],
    ["Hot voltage below MPPT window", { hotModuleVmp: 5 }, "HOT_MPPT", "Incompatible"],
    ["Hot voltage without calculation reference", { hotVmpEvidence: "" }, "HOT_MPPT", "Unverified"],
    ["Unknown altitude", { altitudeM: "" }, "SITE_ENVELOPE", "Unverified"],
    ["Site above battery altitude limit", { altitudeM: 2200 }, "SITE_ENVELOPE", "Incompatible"],
    ["Charging below battery temperature range", { minAmbientC: -5 }, "SITE_ENVELOPE", "Incompatible"],
    ["Missing market", { market: "" }, "REGION", "Conditional"],
    ["Missing design power factor", { designPowerFactor: null }, "APPARENT_POWER", "Unverified"],
    ["Invalid power factor", { designPowerFactor: 1.2 }, "APPARENT_POWER", "Incompatible"],
    ["South Africa needs regional export review", { market: "SOUTH_AFRICA" }, "REGION", "Conditional"],
    ["Unknown price cannot mean free", { panelPrice: "" }, "PRICES", "Unverified"],
    ["Zero price cannot mean supplier confirmed", { batteryPrice: 0 }, "PRICES", "Incompatible"],
    ["Supplier quote requires a reference", { priceBasis: "SUPPLIER_QUOTE", priceReference: "" }, "PRICE_REFERENCE", "Unverified"],
    ["Source update invalidates earlier verification", { sourceVersion: "old" }, "SOURCE_VERSION", "Incompatible"],
  ]) await check(label, () => {
    const result = size(patch);
    assert.equal(result.equipment.checks.find((item) => item.code === expectedCode)?.status, status);
    assert.equal(result.quoteReady, false);
    assert.notEqual(result.equipment.status, "Verified");
  });
  await check("Three-phase project is not silently changed to single phase", () => {
    const result = size({}, { phase: "Three phase" });
    assert.equal(result.equipment.checks.find((item) => item.code === "PHASE").status, "Incompatible");
    assert.equal(result.quoteReady, false);
  });
  await check("Unsupported grid voltage and system topology do not become verified", () => {
    const voltage = size({}, { acVoltage: 400 });
    assert.equal(voltage.equipment.checks.find((item) => item.code === "AC_VOLTAGE").status, "Incompatible");
    const offgrid = size({}, { systemType: "Off-grid" });
    assert.equal(offgrid.equipment.checks.find((item) => item.code === "SYSTEM_SCOPE").status, "Conditional");
  });
  await check("More batteries increase energy but do not multiply bank power beyond manufacturer cap", () => {
    for (let quantity = 1; quantity <= 6; quantity++) {
      const bank = equipmentBankLimits({ ...selection, batteryQuantity: quantity });
      close(bank.usableKwh, 5.4 * quantity); close(bank.powerKw, quantity === 1 ? 2.56 : 5.12);
      assert.equal(bank.currentA, quantity === 1 ? 50 : 100);
    }
  });
  await check("Model swaps invalidate old model prices, firmware and hot-voltage evidence", () => {
    const inverter = updateEquipmentSelection({ ...selection, priceBasis: "SUPPLIER_QUOTE", priceReference: "old quote" }, { inverterId: "gw6000_es20" });
    assert.equal(inverter.inverterPrice, null); assert.equal(inverter.armFirmware, ""); assert.equal(inverter.firmwareEvidence, "");
    assert.equal(inverter.priceReference, ""); assert.equal(inverter.priceBasis, "ESTIMATE");
    const panel = updateEquipmentSelection(selection, { panelId: "longi_430_hth" });
    assert.equal(panel.panelPrice, null); assert.equal(panel.hotModuleVmp, null); assert.equal(panel.hotVmpEvidence, "");
    const battery = updateEquipmentSelection(selection, { batteryId: "unlisted" });
    assert.equal(battery.batteryPrice, null);
    assert.deepEqual(updateEquipmentSelection(selection, { batteryQuantity: 3 }).armFirmware, selection.armFirmware);
  });
  await check("Battery power and energy shortfalls block matching independently", () => {
    const resolved = resolveEquipmentProject(base);
    const result = assessEquipment(resolved, { peakKw: 6, backupEnergyNeed: 20, requiredKwp: 1 });
    assert.equal(result.checks.find((item) => item.code === "BATTERY_POWER").status, "Incompatible");
    assert.equal(result.checks.find((item) => item.code === "BATTERY_ENERGY").status, "Incompatible");
  });
  await check("Main sizing and option engine agree for all two-model swaps and bank quantities", () => {
    for (const inverterId of ["gw5000_es20", "gw6000_es20"]) for (const panelId of ["longi_430_hth", "longi_440_hth"]) for (const batteryQuantity of [1, 2, 6]) {
      const project = { ...base, equipmentSelection: { ...selection, inverterId, panelId, batteryQuantity } };
      const main = runtime.size(project, loads); const option = computeOptionSizing(project, loads, { inverterStepsKw: [100] });
      close(main.actualKwp, option.actualKwp); close(main.batteryKwh, option.battKwh); close(main.inverterKw, option.invKw);
      close(main.totalCost, option.totalCost); assert.equal(main.quoteReady, option.quoteReady); assert.equal(main.equipment.status, option.equipment.status);
    }
  });
  await check("Malformed and huge quantities do not crash pricing or become verified", () => {
    for (const value of ["garbage", -1, 0, 1e308, Infinity]) {
      const result = size({ batteryQuantity: value, modulesPerString: value, stringCount: value });
      assert.equal(result.quoteReady, false); assert.ok(Number.isFinite(result.totalCost));
    }
  });
  await check("Forged imported numeric specs cannot override manufacturer-linked model data", () => {
    const normalized = runtime.normalizeRecord({ project: { ...base, panelW: 10000, batteryModuleKwh: 1000, manualInverterKw: 100 } });
    const result = runtime.size(normalized.project, loads);
    assert.equal(result.actualKwp, 3.52); assert.equal(result.batteryKwh, 10.8); assert.equal(result.inverterKw, 5);
  });
  await check("JSON save/import round trip preserves selection, source set, quantities and prices", () => {
    const normalized = runtime.normalizeRecord(JSON.parse(JSON.stringify({ project: base, loads })));
    assert.deepEqual(normalizeEquipmentSelection(normalized.project.equipmentSelection), normalizeEquipmentSelection(selection));
    close(runtime.size(normalized.project, loads).totalCost, size().totalCost);
  });
  await check("Legacy projects without matching remain assumption-based and numerically unchanged", () => {
    const project = { ...base }; delete project.equipmentSelection;
    assert.equal(resolveEquipmentProject(project), project);
    const previous = runtime.size(project, loads);
    const restored = runtime.normalizeRecord({ project }).project;
    const next = runtime.size(restored, loads);
    assert.equal(next.equipment, undefined); close(next.actualKwp, previous.actualKwp); close(next.totalCost, previous.totalCost);
  });
  await check("Stable design hash survives round trip; model, quantity, firmware and evidence changes invalidate it", async () => {
    const revision = await createDesignRevision({ project: base, loads });
    const repeated = await createDesignRevision({ project: JSON.parse(JSON.stringify(base)), loads });
    assert.equal(revision.inputs_hash, repeated.inputs_hash);
    for (const patch of [{ inverterId: "gw6000_es20" }, { batteryQuantity: 3 }, { armFirmware: "03" }, { hotVmpEvidence: "new method" }, { batteryPrice: 250000 }]) {
      const changed = await createDesignRevision({ project: { ...base, equipmentSelection: { ...selection, ...patch } }, loads });
      assert.notEqual(changed.inputs_hash, revision.inputs_hash);
    }
  });
  await check("Unknown matching blocks shared readiness and proposal readiness", () => {
    const result = size({ firmwareEvidence: "" });
    const readiness = calculateReadiness(base, loads, {}, result);
    assert.ok(readiness.blockers.some((message) => /Equipment matching/.test(message)));
    const shared = buildProjectReadiness(base, loads, [], {}, result);
    assert.equal(shared.readyForProposal, false);
    assert.ok(shared.criticalIssues.some((issue) => issue.actionTab === "assets-lib"));
  });
  await check("Unverified equipment is rejected inside both commercial export builders", () => {
    const result = size({ firmwareEvidence: "" });
    assert.throws(() => buildReport("client", { project: base, sizing: result }), /Resolve equipment matching/);
    assert.throws(() => buildReport("lender", { project: base, sizing: result }), /Resolve equipment matching/);
    assert.throws(() => buildQuotationPDF(base, result, loads), /Resolve equipment matching/);
    assert.ok(buildReport("engineer", { project: base, sizing: result }).sections.some((section) => section.heading === "Documented equipment matching"));
  });
  await check("Complete reports retain exact models, price basis and manufacturer source revisions", () => {
    const result = size();
    const report = buildReport("client", { project: base, sizing: result });
    const text = reportToText(report);
    for (const value of ["GW5000-ES-20", "LX U5.4-20", "LR5-54HTH-440M", "Planning estimates", "20260910-EMEA-EN-V029.1"]) assert.ok(text.includes(value));
    const document = buildQuotationPDF(resolveEquipmentProject(base), result, loads);
    const content = document.output();
    assert.ok(content.includes("DRAFT ESTIMATE"));
    for (const value of ["GW5000-ES-20", "LX U5.4-20", "LR5-54HTH-440M"]) assert.ok(content.includes(value));
  });
  await check("Extreme or invalid unit prices do not crash the engine or imply a free supplier offer", () => {
    for (const value of [1e308, -1, "bad", Infinity]) {
      const result = size({ panelPrice: value, inverterPrice: value, batteryPrice: value });
      assert.equal(result.quoteReady, false); assert.ok(Number.isFinite(result.totalCost));
    }
  });
  const fixture = runtime.normalizeRecord({ project: { ...base, client: "SYNTHETIC QA — Equipment matching", isDemo: true }, loads, loadItemsV2: migrateLegacyLoadsToV2(loads) });
  await writeFile("qa/equipment-matching-fixture.json", JSON.stringify(fixture, null, 2));
} finally { await runtime.close(); }
await writeFile("qa/equipment-matching-results.json", JSON.stringify({ scope: "Synthetic software checks; no field commissioning or engineering certification", results }, null, 2));
console.log(`\n${results.length} equipment checks; ${results.filter((result) => result.status === "FAIL").length} failing.`);
process.exitCode = results.some((result) => result.status === "FAIL") ? 1 : 0;

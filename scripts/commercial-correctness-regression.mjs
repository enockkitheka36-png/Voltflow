import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createLoadItem,
  getLoadWarnings,
  summarizeLoads,
  toLegacyLoads,
  validateLoadItemsV2,
} from "../src/utils/loadEngine.js";
import { deriveBatterySelection, batterySelectionResponse } from "../src/utils/batterySelection.js";
import { calculateQuote, projectQuoteLines } from "../src/utils/quoteEngine.js";
import {
  createDefaultRoofFace,
  normalizeRoofFace,
  summarizeRoofFaces,
  validateRoofFaces,
} from "../src/utils/multiRoofLayout.js";
import {
  createDesignRevision,
  deriveSystemOptions,
  staleDesignResult,
} from "../src/utils/designRevision.js";
import {
  buildPrivatePhotoObjectKey,
  uploadRetryDelay,
  validatePhotoUpload,
} from "../src/utils/photoEvidence.js";
import { getCommercialAvailability, procurementWarning } from "../src/utils/inventoryAvailability.js";
import { getAsset, listAssets, createAssetSelection } from "../src/utils/assetLibrary.js";
import { canonicalStringify } from "../src/platform/canonicalJson.js";
import { createLocalDemoPlatform } from "../src/platform/localDemoAdapter.js";
import { calculateQuoteRequest } from "../api/quotes/calculate.js";

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${error.message}`);
    failed += 1;
  }
}

console.log("\nVoltflow 11.8 - Commercial Correctness Regression\n");

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

await test("1. Supply classification separates site, solar, backup, grid-only and excluded demand", () => {
  const loads = [
    createLoadItem({ id: "solar", name: "Office", ratedW: 1000, qty: 1, dayHours: 5, nightHours: 0, phase: "SINGLE_PHASE", supply_scope: "SOLAR", criticality: "NON_CRITICAL" }),
    createLoadItem({ id: "backup", name: "Server", ratedW: 500, qty: 1, dayHours: 10, nightHours: 10, phase: "THREE_PHASE", supply_scope: "BACKUP", criticality: "CRITICAL" }),
    createLoadItem({ id: "grid", name: "Welder", ratedW: 2000, qty: 1, dayHours: 3, nightHours: 0, phase: "THREE_PHASE", supply_scope: "GRID_ONLY", criticality: "NON_CRITICAL", exclusion_reason: "Grid starting duty" }),
    createLoadItem({ id: "excluded", name: "Future kiln", ratedW: 3000, qty: 1, dayHours: 4, nightHours: 0, phase: "THREE_PHASE", supply_scope: "EXCLUDED", criticality: "NON_CRITICAL", exclusion_reason: "Future phase" }),
  ];
  const summary = summarizeLoads(loads, "Commercial & Industrial", { phase: "Three-phase" });
  assert.equal(summary.site_daily_kwh, 21);
  assert.equal(summary.solar_daily_kwh, 15);
  assert.equal(summary.backup_daily_kwh, 10);
  assert.equal(summary.gridOnlyDailyKwh, 6);
  assert.equal(summary.excludedItemCount, 1);
  assert.equal(toLegacyLoads(loads).length, 2);
  assert.equal(toLegacyLoads(loads).find((load) => load.id === "backup").critical, true);
  assert.equal(validateLoadItemsV2(loads).length, 0);
});

await test("2. Invalid hours and missing exclusion reasons block load commitment", () => {
  const invalidHours = createLoadItem({ name: "Invalid", dayHours: 13, nightHours: 12 });
  const missingReason = createLoadItem({ name: "Grid only", supply_scope: "GRID_ONLY", exclusion_reason: null });
  const errors = validateLoadItemsV2([invalidHours, missingReason]);
  assert.match(errors[0].problems.join(" "), /cannot exceed 24/i);
  assert.match(errors[1].problems.join(" "), /require a reason/i);
});

await test("3. Three-phase solar or backup demand requires a three-phase system", () => {
  const loads = [createLoadItem({ name: "Pump", ratedW: 4000, dayHours: 4, phase: "THREE_PHASE", supply_scope: "BACKUP", criticality: "ESSENTIAL" })];
  const warnings = getLoadWarnings(loads, "Agricultural / Pumping", null, { phase: "Single-phase" });
  assert.ok(warnings.some((warning) => /selected inverter\/system phase is not three-phase/i.test(warning.msg)));
});

await test("4. Battery hardware is reactive and fails voltage, capacity and power incompatibilities", () => {
  const asset = getAsset("bat_512_lfp");
  const inverter = { asset_id: "inv_5k_hyb", battery_voltage_min: 40, battery_voltage_max: 60 };
  const pass = deriveBatterySelection({ required_usable_kwh: 20, required_power_kw: 8, average_backup_kw: 2 }, { selection_mode: "AUTO" }, asset, inverter);
  assert.equal(pass.recommended_quantity, 5);
  assert.equal(pass.selected_quantity, 5);
  assert.equal(pass.compatibility.status, "PASS");
  assert.equal(pass.system_options_recalculated, true);
  assert.equal(batterySelectionResponse(pass).status, 200);
  const fail = deriveBatterySelection({ required_usable_kwh: 100, required_power_kw: 60 }, { selection_mode: "MANUAL", asset_id: "bat_1024_lfp" }, getAsset("bat_1024_lfp"), inverter);
  assert.equal(fail.compatibility.status, "FAIL");
  assert.ok(fail.compatibility.issues.some((issue) => issue.code === "BATTERY_VOLTAGE_MISMATCH"));
  assert.equal(batterySelectionResponse(fail).status, 422);
  const bankLimited = deriveBatterySelection(
    { required_usable_kwh: 20, required_power_kw: 30 },
    { selection_mode: "AUTO" },
    { ...asset, bank_continuous_discharge_a: 400 },
    inverter,
  );
  assert.equal(bankLimited.available_continuous_power_kw, 20.48);
  assert.ok(bankLimited.compatibility.issues.some((issue) => issue.code === "INSUFFICIENT_DISCHARGE_POWER"));
});

await test("5. Quote engine applies discounts, mixed VAT treatment and deterministic rounding", () => {
  const quote = calculateQuote([
    { sku: "A", category: "EQUIPMENT", qty: 2, unit_price: 1000, discount_pct: 10, tax_code: "VAT_STANDARD" },
    { sku: "B", category: "LABOUR", qty: 1, unit_price: 500, discount_pct: 0, tax_code: "VAT_ZERO" },
    { sku: "C", category: "OTHER", qty: 1, unit_price: 100, discount_pct: 0, tax_code: "VAT_EXEMPT" },
  ], { currency: "KES", version: "VF-11.8-01" });
  assert.equal(quote.discount, 200);
  assert.equal(quote.subtotal_net, 2400);
  assert.equal(quote.tax, 288);
  assert.equal(quote.total_gross, 2688);
  assert.equal(quote.tax_breakdown.length, 3);
  assert.equal(quote.pricing_policy_version, "VF-11.8-01");
  assert.equal(quote.tax_rule_version, "KE-2026-01");
  assert.throws(() => calculateQuote([{ qty: -1, unit_price: 10 }]), /non-negative/i);
  assert.throws(() => calculateQuote([{ qty: 0, unit_price: 10 }]), /greater than zero/i);
});

await test("6. Headline project quote is derived from the same line-level commercial model", () => {
  const project = { panelCost: 10000, mountingPerPanel: 4000, inverterUnitCost: 200000, cablingProtectionCost: 50000, monitoringCost: 20000, epcCost: 100000 };
  const sizing = { panels: 10, inverterCost: 200000, batteryCost: 300000, specialistCapex: 50000 };
  const quote = calculateQuote(projectQuoteLines(project, sizing), { currency: "KES", version: "VF-11.8-01" });
  assert.equal(quote.category_totals.LABOUR, 65000);
  assert.equal(quote.category_totals.TRANSPORT, 20000);
  assert.equal(quote.category_totals.OTHER, 15000);
  assert.equal(quote.total_gross, quote.subtotal_net + quote.tax);
  const apiQuote = calculateQuoteRequest({ currency: "KES", lines: projectQuoteLines(project, sizing), pricingPolicy: { version: "VF-11.8-01" } });
  assert.deepEqual(apiQuote, quote);
});

await test("7. Multi-facing roofs normalize old saves and enforce physical geometry", () => {
  const oldFace = normalizeRoofFace({ id: "old", name: "Old east", roofLengthM: 10, roofWidthM: 5, roofPitchDeg: 12, roofAzimuthDeg: 90, selectedForPv: true });
  assert.equal(oldFace.gross_area_m2, 50);
  assert.equal(oldFace.selected_for_pv, true);
  const north = normalizeRoofFace({ ...createDefaultRoofFace("North"), id: "north", gross_area_m2: 40, usable_area_m2: 25, module_count: 8, mppt_assignment: "MPPT-1" });
  const west = normalizeRoofFace({ ...createDefaultRoofFace("West"), id: "west", azimuth_deg: 270, gross_area_m2: 60, usable_area_m2: 40, module_count: 10, mppt_assignment: "MPPT-2" });
  const summary = summarizeRoofFaces([north, west], { panelLengthM: 2, panelWidthM: 1 });
  assert.equal(summary.selected_faces, 2);
  assert.equal(summary.total_usable_area_m2, 65);
  assert.equal(summary.validation_errors.length, 0);
  assert.ok(validateRoofFaces([{ ...north, usable_area_m2: 41, gross_area_m2: 40 }], { panelLengthM: 2, panelWidthM: 1 }).length > 0);
});

await test("8. Design identity changes for every calculation-driving input and rejects stale options", async () => {
  const project = { systemType: "Solar PV – Hybrid", panelW: 550, psh: 5, solarCoverage: 0.8, backupHours: 6, autonomyDays: 1, dod: 0.9, batteryEfficiency: 0.95, inverterEfficiency: 0.96, inverterHeadroom: 1.25 };
  const loads = [{ id: "l1", name: "Clinic", qty: 1, watts: 1000, dayHours: 8, nightHours: 2, surge: 1.2, critical: true }];
  const loadItemsV2 = [createLoadItem({ id: "l1", name: "Clinic", ratedW: 1000, dayHours: 8, nightHours: 2, supply_scope: "BACKUP" })];
  const roofFaces = [normalizeRoofFace({ id: "r1", name: "Main", roofLengthM: 10, roofWidthM: 6, roofAzimuthDeg: 180, roofPitchDeg: 15 })];
  const base = await createDesignRevision({ project, loads, loadItemsV2, roofFaces });
  const changedLoad = await createDesignRevision({ project, loads: [{ ...loads[0], watts: 1100 }], loadItemsV2: [{ ...loadItemsV2[0], ratedW: 1100 }], roofFaces });
  const changedScope = await createDesignRevision({ project, loads, loadItemsV2: [{ ...loadItemsV2[0], supply_scope: "SOLAR" }], roofFaces });
  const changedRoof = await createDesignRevision({ project, loads, loadItemsV2, roofFaces: [{ ...roofFaces[0], azimuth_deg: 90 }] });
  const changedBattery = await createDesignRevision({ project: { ...project, batterySelection: { selection_mode: "MANUAL", asset_id: "bat_512_lfp" } }, loads, loadItemsV2, roofFaces });
  const changedInverter = await createDesignRevision({ project: { ...project, inverterSelection: { selection_mode: "MANUAL", asset_id: "inv_10k_hyb" } }, loads, loadItemsV2, roofFaces });
  assert.notEqual(base.inputs_hash, changedLoad.inputs_hash);
  assert.notEqual(base.inputs_hash, changedScope.inputs_hash);
  assert.notEqual(base.inputs_hash, changedRoof.inputs_hash);
  assert.notEqual(base.inputs_hash, changedBattery.inputs_hash);
  assert.notEqual(base.inputs_hash, changedInverter.inputs_hash);
  const [option] = deriveSystemOptions({ project, loads, templates: [{ id: "balanced", overrides: {} }], inputsHash: base.inputs_hash, revisionId: base.revision_id });
  assert.equal(staleDesignResult(option, base.inputs_hash).ok, true);
  assert.deepEqual(staleDesignResult(option, changedRoof.inputs_hash), { ok: false, status: 409, code: "STALE_DESIGN", message: "The selected system option was calculated from an older project revision." });
});

await test("9. Private photo contract validates type, MIME, size, path and exponential retry", () => {
  const organisationId = "10000000-0000-4000-8000-000000000001";
  const projectId = "10000000-1000-4000-8000-000000000001";
  const photoId = "10000000-6000-4000-8000-000000000001";
  assert.deepEqual(validatePhotoUpload({ photoType: "ROOF", roofFaceId: "face-1", mimeType: "image/jpeg", sizeBytes: 1024 }), []);
  assert.ok(validatePhotoUpload({ photoType: "METER", roofFaceId: "face-1", mimeType: "application/pdf", sizeBytes: 30 * 1024 * 1024 }).length >= 3);
  assert.equal(buildPrivatePhotoObjectKey({ organisationId, projectId, photoId, filename: "roof.JPG", mimeType: "image/jpeg" }), `${organisationId}/${projectId}/photos/${photoId}.jpg`);
  assert.deepEqual([0, 1, 2, 10].map((attempt) => uploadRetryDelay(attempt)), [500, 1000, 2000, 8000]);
});

await test("9b. Local photo and audit adapters persist, isolate projects and use server-compatible fields", async () => {
  const platform = createLocalDemoPlatform({ storage: memoryStorage() });
  const checksum = "a".repeat(64);
  const prepared = await platform.evidence.prepareUpload({
    projectId: "project-photo-a",
    photoType: "ROOF",
    roofFaceId: "rf-east",
    caption: "East roof before installation",
    filename: "east.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    checksumSha256: checksum,
  });
  await assert.rejects(
    platform.evidence.completeUpload({ evidenceId: prepared.evidenceId, checksumSha256: "b".repeat(64), sizeBytes: 1024 }),
    (error) => error.code === "VALIDATION_FAILED",
  );
  const completed = await platform.evidence.completeUpload({ evidenceId: prepared.evidenceId, checksumSha256: checksum, sizeBytes: 1024 });
  assert.equal(completed.photoType, "ROOF");
  assert.equal(completed.roofFaceId, "rf-east");
  assert.equal(completed.caption, "East roof before installation");
  await assert.rejects(
    platform.evidence.completeUpload({ evidenceId: prepared.evidenceId, checksumSha256: checksum, sizeBytes: 1024 }),
    (error) => error.code === "CONFLICT",
  );
  assert.equal((await platform.evidence.listEvidence({ projectId: "another-project" })).length, 0);
  const deleted = await platform.evidence.deleteEvidence({ evidenceId: prepared.evidenceId });
  assert.equal(deleted.localOnly, true);
  assert.equal((await platform.evidence.listEvidence({ projectId: "project-photo-a" })).length, 0);
  await platform.audit.recordEvent({ projectRef: "project-photo-a", action: "photo_deleted", reason: "Local metadata removed" });
  const [auditEvent] = await platform.audit.listEvents({ projectId: "project-photo-a" });
  assert.equal(auditEvent.action, "photo_deleted");
  assert.equal(auditEvent.reason, "Local metadata removed");
  assert.ok(Number.isFinite(Date.parse(auditEvent.occurred_at)));
  assert.equal((await platform.audit.listEvents({ projectId: "another-project" })).length, 0);
});

await test("10. Engineering catalog remains independent from inventory and historic selections survive unlinking", () => {
  const asset = getAsset("pnl_550_mono");
  assert.equal(getCommercialAvailability(asset).state, "CATALOG_ONLY");
  const nowMs = Date.parse("2026-08-10T12:00:00.000Z");
  const available = { provider: "ZOHO_INVENTORY", external_item_id: "z1", sku: "PV550", qty_available: 12, synced_at: "2026-08-10T11:30:00.000Z", active: true };
  assert.equal(getCommercialAvailability(asset, available, { nowMs }).state, "AVAILABLE");
  assert.equal(listAssets("panels", "AVAILABLE_INVENTORY", { [asset.id]: available }, { nowMs }).length, 1);
  assert.equal(getCommercialAvailability(asset, { ...available, synced_at: "2026-08-01T00:00:00.000Z" }, { nowMs }).state, "INVENTORY_STALE");
  assert.ok(procurementWarning(asset, available, 20, { nowMs }));
  const selection = createAssetSelection(asset.id);
  assert.equal(selection.technicalSnapshot.model, asset.model);
  assert.equal(getCommercialAvailability(asset, { ...available, active: false }, { nowMs }).state, "UNLINKED");
  assert.equal(selection.label.includes(asset.model), true);
});

await test("10b. Local quote repository records immutable revisions and rejects stale design hashes", async () => {
  const platform = createLocalDemoPlatform({ storage: memoryStorage() });
  const inputsHash = `sha256:${"c".repeat(64)}`;
  const design = await platform.quotes.recordDesignRevision({
    projectId: "quote-project", projectRevisionNo: 2, revisionId: `rev_${"c".repeat(16)}`,
    inputsHash, calculationVersion: "11.8.0", normalizedInputs: { loads: [1] }, sizingOptions: [],
  });
  const quote = await platform.quotes.createDraft({
    projectId: "quote-project", designRevisionId: design.id, quoteRef: "Q-001", revisionNo: 1,
    currency: "KES", lineItems: [{ qty: 1, unit_price: 100 }], totals: { total_gross: 116 },
    pricingPolicyVersion: "VF-11.8-01", taxRuleVersion: "KE-2026-01",
    inputsHash, currentInputsHash: inputsHash,
  });
  quote.totals.total_gross = 999;
  const [stored] = await platform.quotes.listQuotes({ projectId: "quote-project" });
  assert.equal(stored.totals.total_gross, 116);
  await assert.rejects(
    platform.quotes.issueQuote({ ...stored, currentInputsHash: `sha256:${"d".repeat(64)}` }),
    (error) => error.code === "CONFLICT" && /STALE_DESIGN/.test(error.message),
  );
});

await test("11. Mumbi-style end-to-end project remains deterministic after reload", async () => {
  const loadItemsV2 = [
    createLoadItem({ id: "m-office", name: "Office circuits", ratedW: 1800, qty: 1, dayHours: 9, supply_scope: "SOLAR", criticality: "NON_CRITICAL" }),
    createLoadItem({ id: "m-server", name: "Server", ratedW: 600, qty: 1, dayHours: 12, nightHours: 12, supply_scope: "BACKUP", criticality: "CRITICAL" }),
    createLoadItem({ id: "m-welder", name: "Welder", ratedW: 6000, qty: 1, dayHours: 2, phase: "THREE_PHASE", supply_scope: "GRID_ONLY", criticality: "NON_CRITICAL", exclusion_reason: "Grid-only intermittent process" }),
  ];
  const legacyLoads = toLegacyLoads(loadItemsV2, "Commercial & Industrial");
  const roofFaces = [0, 90, 180, 270].map((azimuth, index) => normalizeRoofFace({ id: `m-roof-${index + 1}`, name: `Roof ${index + 1}`, roofLengthM: 10, roofWidthM: 6, azimuth_deg: azimuth, tilt_deg: 12, gross_area_m2: 60, usable_area_m2: 40, mppt_assignment: `MPPT-${index % 2 + 1}` }));
  const project = {
    systemType: "Solar PV – Hybrid", panelW: 550, panelLengthM: 2.28, panelWidthM: 1.13,
    psh: 5.2, solarCoverage: 0.8, backupHours: 8, autonomyDays: 1, dod: 0.9,
    batteryEfficiency: 0.95, inverterEfficiency: 0.96, inverterHeadroom: 1.25,
    panelCost: 11000, mountingPerPanel: 4750, inverterUnitCost: 320000,
    batteryModuleKwh: 5.12, batteryModuleCost: 240000, monitoringCost: 20100,
    cablingProtectionCost: 46150, epcCost: 150000, gridTariff: 32, monthlyBill: 85000,
    selfConsumptionRate: 0.85, capSavingsToBill: true, oAndMRate: 0.015,
    batterySelection: { selection_mode: "MANUAL", asset_id: "bat_512_lfp" },
    inverterSelection: { selection_mode: "MANUAL", asset_id: "inv_10k_hyb", phase: "THREE_PHASE" },
  };
  const revision = await createDesignRevision({ project, loads: legacyLoads, loadItemsV2, roofFaces });
  const [option] = deriveSystemOptions({ project, loads: legacyLoads, templates: [{ id: "balanced", label: "Balanced", overrides: {} }], inputsHash: revision.inputs_hash, revisionId: revision.revision_id });
  assert.equal(option.result.loadInventoryBlocked, false);
  const quote = calculateQuote(projectQuoteLines(project, { panels: option.result.panels, inverterCost: project.inverterUnitCost, batteryCost: option.result.battModules * project.batteryModuleCost }), { currency: "KES", version: "VF-11.8-01" });
  const persisted = JSON.parse(JSON.stringify({ project, loadItemsV2, roofFaces, revision, selectedOption: option, quote }));
  assert.equal(canonicalStringify(persisted), canonicalStringify(JSON.parse(JSON.stringify(persisted))));
  const reloadedRevision = await createDesignRevision({ project: persisted.project, loads: toLegacyLoads(persisted.loadItemsV2, "Commercial & Industrial"), loadItemsV2: persisted.loadItemsV2, roofFaces: persisted.roofFaces });
  assert.equal(reloadedRevision.inputs_hash, revision.inputs_hash);
  assert.ok(quote.total_gross > 0);
});

await test("12. Supabase migration is tenant-scoped, immutable and denies commercial records to external roles", () => {
  const sql = readFileSync(new URL("../supabase/migrations/202608100001_commercial_correctness.sql", import.meta.url), "utf8");
  ["design_revisions", "quotes", "inventory_links"].forEach((table) => {
    const definition = sql.match(new RegExp(`create table public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, "i"))?.[1] || "";
    assert.match(definition, /organisation_id uuid not null/i);
    assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`, "i"));
  });
  assert.match(sql, /design_revisions_append_only/i);
  assert.match(sql, /quotes_append_only/i);
  assert.match(sql, /message = 'STALE_DESIGN'/i);
  assert.match(sql, /prepare_project_photo_upload/i);
  assert.match(sql, /\/photos\//i);
  const quotesPolicy = sql.match(/create policy quotes_internal_select[\s\S]*?;\s*\n/i)?.[0] || "";
  assert.doesNotMatch(quotesPolicy, /client|bank/i);
  assert.doesNotMatch(sql, /service[_-]?role/i);
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

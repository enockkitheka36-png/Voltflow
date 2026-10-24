import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { SITE_PHOTO_SLOTS, MAX_SITE_PHOTO_BYTES, countSitePhotos, isAttachedSitePhoto, privateSitePhotoLinks, validateSitePhotoFile, uploadPrivateSitePhoto } from "../src/utils/sitePhotos.js";
import { calculateResidentialEv, createResidentialEvLoad } from "../src/utils/residentialEv.js";
import { calculateImpactEquivalents } from "../src/utils/impactEquivalents.js";
import { normalizeInstalledAsset, validateInstalledAsset, upsertInstalledAsset } from "../src/utils/installedAssets.js";
import { toLegacyLoads } from "../src/utils/loadEngine.js";
import { computeOptionSizing, createDesignRevision } from "../src/utils/designRevision.js";
import { projectSnapshotForAudience } from "../src/platform/audienceProjection.js";
import { buildProjectReadiness } from "../src/utils/readinessEngine.js";
import { openSizingAuditRuntime } from "./lib/sizingAuditRuntime.mjs";

const results = [];
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`);
async function check(label, action) {
  try { await action(); results.push({ label, status: "PASS" }); console.log(`PASS: ${label}`); }
  catch (error) { results.push({ label, status: "FAIL", error: error.message }); console.error(`FAIL: ${label}: ${error.stack}`); }
}
const now = new Date().toISOString();
const localPhoto = { kind: "local_site_photo", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,/9j/" + "A".repeat(100), width: 10, height: 10, attachedAt: now };
const ev = { dailyKm: 60, consumptionKwhPer100Km: 18, consumptionBasis: "BATTERY", chargingEfficiencyPct: 90, chargerKw: 7.2, chargingWindowHours: 8, chargingPeriod: "NIGHT", supplyScope: "GRID_ONLY" };
const asset = { type: "Inverter", manufacturer: "SYNTHETIC", model: "QA model", serial: "QA-UNIT-001", installedOn: "2026-01-02", warrantyUntil: "2030-01-02", status: "installed" };

await check("Photo slots count bounded attachment records, not legacy ticks, strings or unknown slots", () => {
  assert.equal(SITE_PHOTO_SLOTS.length, 10);
  assert.equal(countSitePhotos({ "Roof Front": true, "KPLC Meter": false, unknown: localPhoto }), 0);
  assert.equal(countSitePhotos({ "Roof Front": localPhoto }), 1);
  for (const entry of [true, false, null, "", "https://example.test/photo.jpg", {}, { ...localPhoto, dataUrl: {} }, { ...localPhoto, width: 9000 }, { ...localPhoto, attachedAt: "bad" }, { ...localPhoto, dataUrl: "data:image/svg+xml;base64,AAAA" }, { ...localPhoto, dataUrl: "data:image/jpeg;base64,/9j/" + "A".repeat(MAX_SITE_PHOTO_BYTES * 3) }]) assert.equal(isAttachedSitePhoto(entry), false);
});
await check("Actual upload entry validates MIME and size before attempting image decoding", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) assert.equal(validateSitePhotoFile({ type, size: 100 }), null);
  for (const file of [{ type: "image/svg+xml", size: 10 }, { type: "image/heic", size: 100 }, { type: "image/jpeg", size: 0 }, { type: "image/jpeg", size: 30e6 }, { type: "image/jpeg", size: Infinity }]) assert.ok(validateSitePhotoFile(file));
});
await check("Private photo contract uploads then finalises, persisting receipt IDs but no access tokens", async () => {
  const calls = [];
  const platform = { evidence: {
    async prepareUpload(input) { calls.push(["prepare", input]); return { evidenceId: "evidence-id", storagePath: "private-path", signedToken: "SYNTHETIC-test-token" }; },
    async uploadPreparedFile(input) { calls.push(["binary", input]); },
    async completeUpload(input) { calls.push(["complete", input]); return { id: "canonical-id", serverReceivedAt: now }; },
  } };
  const record = await uploadPrivateSitePhoto({ platform, organisationId: "org", projectId: "project", slot: "Roof Front", prepared: { blob: new Blob(["SYNTHETIC API contract bytes"]), record: { filename: "qa.jpg" } } });
  assert.deepEqual(calls.map(([name]) => name), ["prepare", "binary", "complete"]);
  assert.equal(calls[0][1].photoType, "ROOF"); assert.equal(calls[0][1].caption, "Roof Front");
  assert.equal(calls[1][1].file.type, "image/jpeg"); assert.equal(record.evidenceId, "canonical-id");
  assert.equal(isAttachedSitePhoto(record), true); assert.ok(!JSON.stringify(record).includes("SYNTHETIC-test-token"));
  assert.equal(record.reviewStatus, undefined);
  const links = privateSitePhotoLinks({ "Roof Front": record }, "org", "project");
  assert.deepEqual(links, [["Roof Front", "canonical-id"]]);
  assert.deepEqual(privateSitePhotoLinks({ "Roof Front": { ...record, caption: "Edited note" } }, "org", "project"), links);
  assert.deepEqual(privateSitePhotoLinks({ "Roof Front": record }, "other-org", "project"), []);
  assert.deepEqual(privateSitePhotoLinks({ "Roof Front": record }, "org", "other-project"), []);
  assert.deepEqual(privateSitePhotoLinks({ "Roof Front": record }, "", "project"), []);
  platform.evidence.completeUpload = async () => ({ id: "unconfirmed" });
  await assert.rejects(() => uploadPrivateSitePhoto({ platform, organisationId: "org", projectId: "project", slot: "Roof Front", prepared: { blob: new Blob(["qa"]), record: {} } }), /canonical server receipt/);
  await assert.rejects(() => uploadPrivateSitePhoto({ platform, organisationId: "org", projectId: "", slot: "Roof Front" }), /Save this cloud project/);
  platform.evidence.prepareUpload = async () => ({ uploadDisabled: true });
  await assert.rejects(() => uploadPrivateSitePhoto({ platform, organisationId: "org", projectId: "project", slot: "Roof Front", prepared: { blob: new Blob(["qa"]), record: {} } }), /unavailable/);
});
await check("Impact equivalents never claim issued credits, saved trees or coral counts", () => {
  const impact = calculateImpactEquivalents(6);
  close(impact.illustrativeUrbanTreeYears, 100); assert.equal(impact.coralCount, null); assert.equal(impact.issuedCredits, null);
  assert.equal(calculateImpactEquivalents(0).illustrativeUrbanTreeYears, 0);
  for (const value of [null, undefined, -1, NaN, Infinity, "6", true, 1e30]) assert.equal(calculateImpactEquivalents(value).ready, false);
});
await check("Residential EV hand calculation includes charging losses exactly once", () => {
  const result = calculateResidentialEv(ev);
  assert.equal(result.ready, true); close(result.wallKwh, 12); close(result.chargingHours, 12 / 7.2); close(result.annualWallKwh, 4380);
  close(calculateResidentialEv({ ...ev, consumptionBasis: "WALL", consumptionKwhPer100Km: 20, chargingEfficiencyPct: "" }).wallKwh, 12);
  close(calculateResidentialEv({ ...ev, dailyKm: 0 }).wallKwh, 0);
});
await check("EV invalid assumptions and impossible or direct-solar night charging are blocked", () => {
  for (const patch of [{ dailyKm: "" }, { dailyKm: -1 }, { chargerKw: 50 }, { chargerKw: 0 }, { chargingEfficiencyPct: 0 }, { chargingEfficiencyPct: 101 }, { chargingWindowHours: 1 }, { consumptionKwhPer100Km: NaN }, { consumptionBasis: "unknown" }, { supplyScope: "SOLAR" }]) assert.equal(calculateResidentialEv({ ...ev, ...patch }).ready, false, JSON.stringify(patch));
});
await check("Grid-only home EV never silently enters solar/backup sizing", () => {
  const gridRow = createResidentialEvLoad(ev);
  assert.equal(gridRow.supply_scope, "GRID_ONLY"); assert.equal(toLegacyLoads([gridRow], "Residential").length, 0);
  const solarRow = createResidentialEvLoad({ ...ev, supplyScope: "SOLAR", chargingPeriod: "DAY" });
  const legacy = toLegacyLoads([solarRow], "Residential");
  close(legacy[0].watts * legacy[0].dayHours / 1000, 12); assert.equal(legacy[0].critical, false);
  const backup = toLegacyLoads([createResidentialEvLoad({ ...ev, supplyScope: "BACKUP" })], "Residential");
  assert.equal(backup[0].critical, true); close(backup[0].watts * backup[0].nightHours / 1000, 12);
  assert.equal(solarRow.id, gridRow.id); assert.equal(solarRow.phase, "UNKNOWN");
});
await check("Installed assets require identity, sane chronology and unique per-project serials", () => {
  assert.equal(validateInstalledAsset(asset).ready, true);
  assert.equal(validateInstalledAsset(null).ready, false);
  assert.equal(normalizeInstalledAsset({ status: {} }).status, "");
  assert.equal(upsertInstalledAsset([null, false, "invalid", []], asset).length, 1);
  assert.equal(validateInstalledAsset(asset, [null]).ready, true);
  const records = upsertInstalledAsset([], asset);
  assert.ok(records[0].id);
  assert.equal(validateInstalledAsset({ ...asset, serial: "qa-unit-001" }, records).ready, false);
  assert.equal(upsertInstalledAsset(records, { ...records[0], notes: "QA edit" }).length, 1);
  for (const patch of [{ serial: "" }, { type: "unknown" }, { installedOn: "2026-02-31" }, { warrantyUntil: "2025-01-01" }, { status: "commissioning_recorded" }, { status: "retired", notes: "" }]) assert.equal(validateInstalledAsset({ ...asset, ...patch }).ready, false);
  assert.equal(validateInstalledAsset({ ...asset, status: "commissioning_recorded", commissionedOn: "2026-01-03", reviewedBy: "QA reviewer", testReference: "SYNTHETIC reference, not a real test" }).ready, true);
});

const runtime = await openSizingAuditRuntime();
try {
  const base = { ...runtime.defaults, client: "SYNTHETIC field workflow QA", isDemo: true };
  const loads = [{ id: "qa", name: "SYNTHETIC load", qty: 1, watts: 1000, dayHours: 4, nightHours: 1, surge: 1, critical: true }];
  await check("Photo readiness no longer treats ticked boxes as captured evidence", () => {
    const sizing = runtime.size(base, loads);
    const legacy = buildProjectReadiness(base, loads, [], { photos: { "Roof Front": true } }, sizing);
    assert.ok(legacy.sections.siteSurvey.missingItems.includes("Site photos"));
    const attached = buildProjectReadiness(base, loads, [], { photos: { "Roof Front": localPhoto } }, sizing);
    assert.ok(!attached.sections.siteSurvey.missingItems.includes("Site photos"));
  });
  await check("Mini-grid anchor operating hours drive main and option demand and revenue consistently", async () => {
    const mini = { ...base, systemType: "Mini-grid", mgHouseholds: 10, mgHouseholdLoadKwh: 1, mgCommercialCustomers: 2, mgCommercialLoadKwh: 3, mgAnchorLoad: 2, mgAnchorTariff: 20 };
    for (const hours of [0, 6, 12, 24]) {
      const project = { ...mini, mgAnchorHours: hours };
      const sized = runtime.size(project, loads);
      const option = computeOptionSizing(project, loads);
      close(sized.communityDailyKwh, 16 + 2 * hours); close(option.dailyKwh, sized.communityDailyKwh);
      close(sized.annualAnchorRevenue, 2 * hours * 365 * 20);
    }
    const previous = { ...mini }; delete previous.mgAnchorHours;
    close(runtime.size(previous, loads).communityDailyKwh, runtime.size({ ...mini, mgAnchorHours: 12 }, loads).communityDailyKwh);
    const original = await createDesignRevision({ project: { ...mini, mgAnchorHours: 12 }, loads });
    const changed = await createDesignRevision({ project: { ...mini, mgAnchorHours: 6 }, loads });
    assert.notEqual(original.inputs_hash, changed.inputs_hash);
  });
  await check("Save/import preserves attachment and asset records; neither silently approves delivery or changes design", async () => {
    const withAssets = { ...base, installedAssets: upsertInstalledAsset([], asset) };
    const restored = runtime.normalizeRecord(JSON.parse(JSON.stringify({ project: withAssets, loads, survey: { photos: { "Roof Front": localPhoto } } })));
    assert.equal(countSitePhotos(restored.survey.photos), 1); assert.equal(restored.project.installedAssets[0].serial, asset.serial);
    assert.equal(restored.project.delivery.approvals.commissioningApproved.approved, false);
    assert.equal((await createDesignRevision({ project: base, loads })).inputs_hash, (await createDesignRevision({ project: withAssets, loads })).inputs_hash);
    const publicView = projectSnapshotForAudience({ project: withAssets, survey: restored.survey, sizing: runtime.size(base, loads) }, "client");
    assert.ok(!JSON.stringify(publicView).includes(asset.serial)); assert.ok(!JSON.stringify(publicView).includes("base64"));
  });
} finally { await runtime.close(); }
await writeFile("qa/field-planning-results.json", JSON.stringify({ scope: "Software and mocked-provider contract checks only; actual photo decoding and save/reload require browser QA; no live cloud proof or certification", results }, null, 2));
console.log(`\n${results.length} grouped field-planning checks; ${results.filter((result) => result.status === "FAIL").length} failing.`);
process.exitCode = results.some((result) => result.status === "FAIL") ? 1 : 0;

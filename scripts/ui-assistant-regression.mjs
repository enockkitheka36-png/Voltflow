/**
 * ui-assistant-regression.mjs — Voltflow 11.4
 * Run: node scripts/ui-assistant-regression.mjs   (npm run test:ui)
 *
 * Covers the pure logic behind the 11.4 sprint: assistant context safety,
 * view modes, and the storage/feedback/export/import paths that the UI work
 * touched. JSX rendering (tables, view modes, PDF buttons, assistant panel)
 * is verified in the browser — jsx is not node-importable — so those checks
 * are listed in the testing guide rather than asserted here.
 */
import assert from "node:assert";

import { buildAssistantContext, ASSISTANT_CONTEXT_FIELDS, ASSISTANT_DISCLAIMER } from "../src/utils/assistantContext.js";
import { normalizeViewMode, VIEW_MODES, APP_VERSION, SCHEMA_VERSION } from "../src/utils/schemaMigration.js";
import {
  saveProjectLocal, deleteProjectLocal, exportProjectJson, importProjectJson,
  addFeedbackLocal, deleteFeedbackLocal, exportFeedbackJson, FEEDBACK_ISSUE_TYPES,
  CLOUD_STORAGE_CONFIGURED,
} from "../src/utils/projectStorage.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}

console.log(`\n${APP_VERSION} — UI / Assistant Regression (real modules)\n`);

// ── Assistant context safety (Phase 8) ─────────────────────────────────────

const sampleProject = {
  client: "Karen Homeowner", location: "Karen, Nairobi", systemType: "Solar PV – Hybrid",
  loadSource: "data_logger", sizingMode: "existing_site", quoteStage: "auto",
  energyImport: { dataQualityScore: 88, averageDailyKwh: 56 },
  // Fields that must NEVER be forwarded:
  preparedBy: "Internal Engineer", gridTariff: 26, panelCost: 18000, debtShare: 0.4,
};
const sampleSurvey = {
  clientName: "Karen Homeowner", phone: "+254700000000", email: "client@example.com",
  meterNumber: "123456789", gpsCornerA: { lat: -1.29, lng: 36.82 }, photos: { db: "data:image/png;base64,AAA" },
  siteNotes: "Gate code 1234",
};
const sampleSizing = {
  dailyKwh: 21.4, actualKwp: 5.4, panels: 9, batteryKwh: 10.2, inverterKw: 8,
  totalCost: 1200000, payback: 7.84, warnings: ["DC cable voltage drop is above 1.5%."],
  coldVocOk: true,
};
const sampleReadiness = { totalScore: 78, readyStatus: "Engineering review required", blockers: ["Earthing not confirmed at survey."] };

test("1. buildAssistantContext returns ONLY whitelisted fields", () => {
  const ctx = buildAssistantContext(sampleProject, [{}, {}], sampleSurvey, sampleSizing, sampleReadiness, { roofFitStatus: "Fits comfortably" }, sampleProject.energyImport);
  const extra = Object.keys(ctx).filter((k) => !ASSISTANT_CONTEXT_FIELDS.includes(k));
  assert.strictEqual(extra.length, 0, `Unexpected fields leaked: ${extra.join(", ")}`);
});

test("2. Personal / contact / financial-internal data is never included", () => {
  const ctx = buildAssistantContext(sampleProject, [], sampleSurvey, sampleSizing, sampleReadiness, {}, null);
  const blob = JSON.stringify(ctx);
  ["+254700000000", "client@example.com", "123456789", "36.82", "data:image", "Gate code", "Internal Engineer"]
    .forEach((secret) => assert.ok(!blob.includes(secret), `Context must not contain "${secret}"`));
  // internal cost/finance inputs must not leak either
  assert.ok(!("panelCost" in ctx) && !("debtShare" in ctx) && !("gridTariff" in ctx));
});

test("3. Saved projects, feedback and localStorage contents are never included", () => {
  const ctx = buildAssistantContext(sampleProject, [], sampleSurvey, sampleSizing, sampleReadiness, {}, null);
  const blob = JSON.stringify(ctx);
  assert.ok(!blob.includes("savedProjects"));
  assert.ok(!blob.includes("feedback"));
  assert.ok(!("projects" in ctx) && !("history" in ctx));
});

test("4. Context carries the useful sizing/readiness values", () => {
  const ctx = buildAssistantContext(sampleProject, [{}, {}, {}], sampleSurvey, sampleSizing, sampleReadiness, { roofFitStatus: "Fits comfortably" }, sampleProject.energyImport);
  assert.strictEqual(ctx.clientName, "Karen Homeowner");
  assert.strictEqual(ctx.pvKwp, 5.4);
  assert.strictEqual(ctx.panelCount, 9);
  assert.strictEqual(ctx.paybackYears, 7.8);
  assert.strictEqual(ctx.readinessStatus, "Engineering review required");
  assert.strictEqual(ctx.loadSource, "data_logger");
  assert.strictEqual(ctx.roofFitStatus, "Fits comfortably");
  assert.strictEqual(ctx.energyDataQualityScore, 88);
  assert.strictEqual(ctx.loadCount, 3);
  assert.ok(ctx.warnings.length >= 2, "sizing warnings + readiness blockers should both appear");
});

test("5. Context is defensive with empty/missing input and caps warnings", () => {
  const ctx = buildAssistantContext();
  assert.strictEqual(ctx.clientName, null);
  assert.strictEqual(ctx.loadCount, 0);
  assert.deepStrictEqual(ctx.warnings, []);
  const many = { warnings: Array.from({ length: 40 }, (_, i) => `warning ${i}`) };
  const capped = buildAssistantContext({}, [], {}, many, null, {}, null);
  assert.ok(capped.warnings.length <= 12, `warnings should be capped, got ${capped.warnings.length}`);
});

test("6. Advisory disclaimer text is present and conservative", () => {
  assert.ok(/advisory/i.test(ASSISTANT_DISCLAIMER));
  assert.ok(/may be wrong/i.test(ASSISTANT_DISCLAIMER));
});

// ── View modes (Phase 6) ───────────────────────────────────────────────────

test("7. normalizeViewMode accepts the known modes and defaults safely", () => {
  // v11.7.1 — added "bank" (Bank Pilot Mode); keep the core three + safe default.
  ["engineer", "client", "technician", "bank"].forEach((m) => {
    assert.ok(VIEW_MODES.includes(m), `VIEW_MODES includes ${m}`);
    assert.strictEqual(normalizeViewMode(m), m);
  });
  assert.strictEqual(normalizeViewMode(undefined), "engineer");
  assert.strictEqual(normalizeViewMode("admin"), "engineer");
  assert.strictEqual(normalizeViewMode(null), "engineer");
});

// ── Storage / feedback / export / import still work (Phases 1-5 regression) ─

test("8. Storage save/delete round-trips without a browser", () => {
  const rec = { id: 1, name: "P1", project: { client: "C1" }, savedAt: new Date().toISOString() };
  const { records } = saveProjectLocal(rec, []);
  assert.strictEqual(records.length, 1);
  const replaced = saveProjectLocal({ ...rec, id: 2 }, records);
  assert.strictEqual(replaced.records.length, 1, "same-name save should replace, not duplicate");
  const afterDelete = deleteProjectLocal(2, replaced.records);
  assert.strictEqual(afterDelete.records.length, 0);
});

test("9. Export JSON contains the v11.3 payload fields", () => {
  const record = {
    schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION, project: { client: "Karen", sizingMode: "existing_site" },
    survey: {}, simulation: {}, loadItemsV2: [{ id: "a" }], loads: [{ id: 1 }],
    sizingMode: "existing_site", energyImportSummary: { dataQualityScore: 90 }, exportedAt: new Date().toISOString(),
  };
  const { filename, jsonString } = exportProjectJson(record);
  assert.ok(filename.endsWith(".json"));
  const parsed = JSON.parse(jsonString);
  ["project", "survey", "simulation", "loadItemsV2", "loads", "sizingMode", "energyImportSummary", "appVersion", "exportedAt"]
    .forEach((k) => assert.ok(k in parsed, `export missing ${k}`));
});

test("10. Import review validates, summarises and warns on old versions", () => {
  const cur = { schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION };
  const ok = importProjectJson(JSON.stringify({ schemaVersion: "11.2", appVersion: "Voltflow 11.2", name: "T", project: { client: "C" }, survey: {}, simulation: {}, loadItemsV2: [{ id: 1 }] }), cur);
  assert.ok(ok.ok && ok.summary.loadCount === 1);
  const old = importProjectJson(JSON.stringify({ schemaVersion: "8.5", project: { client: "Old" }, loads: [{ id: 1 }] }), cur);
  assert.ok(old.ok && old.warnings.some((w) => /older app version/i.test(w)));
  assert.ok(!importProjectJson("not json", cur).ok);
  assert.ok(!importProjectJson(JSON.stringify({ nope: 1 }), cur).ok);
});

test("11. Feedback add/delete/export works and keeps issue types", () => {
  assert.ok(FEEDBACK_ISSUE_TYPES.includes("Bug"));
  assert.ok(FEEDBACK_ISSUE_TYPES.includes("Calculation concern"));
  const { records } = addFeedbackLocal({ testerName: "QA", issueType: "Bug", description: "x", pageTab: "Load Assessment" }, []);
  assert.strictEqual(records.length, 1);
  assert.ok(records[0].id && records[0].submittedAt);
  const { filename, jsonString } = exportFeedbackJson(records, APP_VERSION);
  assert.ok(filename.includes("feedback"));
  const parsed = JSON.parse(jsonString);
  assert.strictEqual(parsed.count, 1);
  assert.strictEqual(parsed.appVersion, APP_VERSION);
  assert.strictEqual(deleteFeedbackLocal(records[0].id, records).length, 0);
});

test("12. Cloud storage stays a declared placeholder in this alpha", () => {
  assert.strictEqual(CLOUD_STORAGE_CONFIGURED, false, "Alpha must not claim cloud storage is configured");
});

test("13. Version strings are well-formed and mutually consistent", () => {
  // Version-agnostic on purpose: pinning exact numbers here made this test fail
  // on every routine version bump without catching a real defect.
  assert.ok(/^Voltflow \d+\.\d+(\.\d+)?[a-z]?$/i.test(APP_VERSION), `unexpected app version: ${APP_VERSION}`);
  assert.ok(/^\d+\.\d+(\.\d+)?$/.test(SCHEMA_VERSION), `unexpected schema version: ${SCHEMA_VERSION}`);
  const appMajorMinor = (APP_VERSION.match(/Voltflow (\d+\.\d+)/) || [null, "0.0"])[1];
  const schemaMajor = SCHEMA_VERSION.split(".")[0];
  assert.strictEqual(appMajorMinor.split(".")[0], schemaMajor, "app and schema majors must not diverge");
  assert.ok(parseFloat(SCHEMA_VERSION) <= parseFloat(appMajorMinor), "schema must never be ahead of the app version");
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

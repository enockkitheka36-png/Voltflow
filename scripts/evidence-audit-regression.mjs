/**
 * evidence-audit-regression.mjs — Voltflow 11.7
 * Run: node scripts/evidence-audit-regression.mjs   (npm run test:evidence)
 *
 * Pure core of the audit trail, evidence record, pilot KPIs, compliance workspace
 * and borehole test-report shell. Persistence + UI are browser-verified.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { createAuditEvent, appendEvent, AUDIT_EVENT_TYPES, AUDIT_EVENT_LABELS } from "../src/utils/auditLog.js";
import { createDefaultEvidence, normalizeEvidence, recordEvidenceChange, markReportGenerated, createDefaultPilotEvidence, normalizePilotEvidence, APPROVAL_STATUSES } from "../src/utils/projectEvidence.js";
import { createDefaultCompliance, normalizeCompliance, summarizeCompliance, COMPLIANCE_TEMPLATE } from "../src/utils/complianceEngine.js";
import { createDefaultBorehole, normalizeBorehole, validateBoreholeOperatingPoint, computeBorehole, PUMP_SELECTION_DISCLAIMER } from "../src/utils/boreholeEngine.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}
const noBad = (o) => JSON.stringify(o, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? "__BAD__" : v)).indexOf("__BAD__") === -1;

console.log(`\n${APP_VERSION} — Evidence / Audit / Compliance Regression\n`);

// ── Audit trail ───────────────────────────────────────────────────────────────
test("1. Audit event types cover the required key actions", () => {
  ["PROJECT_CREATED", "SURVEY_UPDATED", "LOAD_APPLIED", "SIZING_CHANGED", "BOREHOLE_CHANGED", "PROPOSAL_GENERATED", "PDF_EXPORTED", "WARNING_OVERRIDDEN", "STAGE_CHANGED", "IMPORT_PERFORMED", "EXPORT_PERFORMED"]
    .forEach((k) => assert.ok(AUDIT_EVENT_TYPES[k], `has ${k}`));
});

test("2. createAuditEvent builds a well-formed, labelled, timestamped event", () => {
  const e = createAuditEvent(AUDIT_EVENT_TYPES.LOAD_APPLIED, "12 loads", { projectRef: "VF-1", user: "Tech" });
  assert.strictEqual(e.type, "load_applied");
  assert.strictEqual(e.label, AUDIT_EVENT_LABELS.load_applied);
  assert.strictEqual(e.projectRef, "VF-1");
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(e.at), "ISO timestamp");
});

test("3. appendEvent prepends (newest first) and caps the log", () => {
  let list = [];
  for (let i = 0; i < 10; i++) list = appendEvent(list, createAuditEvent(AUDIT_EVENT_TYPES.SIZING_CHANGED, `#${i}`), 5);
  assert.strictEqual(list.length, 5, "capped at 5");
  assert.ok(/#9/.test(list[0].detail), "newest first");
});

// ── Evidence record ──────────────────────────────────────────────────────────
test("4. Evidence record has the cloud-ready shape", () => {
  const e = createDefaultEvidence();
  ["inputSource", "responsibleUser", "confidenceLevel", "version", "approvalStatus", "changedFields", "reportFromVersion"].forEach((k) => assert.ok(k in e, `has ${k}`));
  assert.strictEqual(e.version, 1);
});

test("5. recordEvidenceChange bumps version + appends history", () => {
  let e = createDefaultEvidence();
  e = recordEvidenceChange(e, { changedFields: ["panelW"], user: "Eng. A", source: "manual" });
  assert.strictEqual(e.version, 2);
  assert.deepStrictEqual(e.changedFields, ["panelW"]);
  assert.strictEqual(e.history.length, 1);
  e = recordEvidenceChange(e, { changedFields: ["battery"] });
  assert.strictEqual(e.version, 3);
  assert.strictEqual(e.history.length, 2);
});

test("6. markReportGenerated stamps the version the report came from", () => {
  let e = recordEvidenceChange(createDefaultEvidence(), { changedFields: ["x"] }); // v2
  e = markReportGenerated(e);
  assert.strictEqual(e.reportFromVersion, 2);
});

test("7. normalizeEvidence repairs bad input; approval status validated", () => {
  const e = normalizeEvidence({ approvalStatus: "bogus", version: "nan", confidenceLevel: "x" });
  assert.strictEqual(e.approvalStatus, "draft");
  assert.strictEqual(e.version, 1);
  assert.ok(APPROVAL_STATUSES.includes(e.approvalStatus));
});

test("8. Pilot evidence normalizes numbers/nulls safely", () => {
  const p = normalizePilotEvidence({ surveyToDesignMinutes: "45", errorsPrevented: 3, uptimePct: "", savingsKes: "abc" });
  assert.strictEqual(p.surveyToDesignMinutes, 45);
  assert.strictEqual(p.errorsPrevented, 3);
  assert.strictEqual(p.uptimePct, null);
  assert.strictEqual(p.savingsKes, null);
  assert.ok(noBad(p), "no NaN");
  assert.ok(noBad(createDefaultPilotEvidence()));
});

// ── Compliance workspace ─────────────────────────────────────────────────────
test("9. Compliance template has the Kenya-first sections", () => {
  const keys = COMPLIANCE_TEMPLATE.map((s) => s.key);
  ["epra", "netMetering", "nema", "county", "dataConsent", "procurement", "ewaste", "waterPermit"].forEach((k) => assert.ok(keys.includes(k), `has ${k}`));
});

test("10. Compliance default + normalize + summarize", () => {
  const c = createDefaultCompliance();
  const sum0 = summarizeCompliance(c);
  assert.strictEqual(sum0.done, 0);
  // mark a couple done + one N/A
  c.sections.epra.epra_contractor = "done";
  c.sections.epra.epra_signatory = "done";
  c.sections.nema.nema_screen = "not_applicable";
  const sum = summarizeCompliance(c);
  assert.strictEqual(sum.done, 2);
  assert.strictEqual(sum.na, 1);
  assert.ok(sum.score > 0 && sum.score <= 100);
  // bad input → default shape
  assert.ok(normalizeCompliance(null).sections.epra);
});

// ── Borehole test-report shell ───────────────────────────────────────────────
test("11. Borehole model gains test-report / pump-curve fields (migration-safe)", () => {
  const b = createDefaultBorehole();
  ["testReportRef", "testDurationHours", "pumpModel", "pumpCurvePoints", "selectedOperatingPoint", "validationStatus"].forEach((k) => assert.ok(k in b, `has ${k}`));
  // old project without these → filled by normalize
  const migrated = normalizeBorehole({ dailyWaterDemandLitres: 5000 });
  assert.strictEqual(migrated.validationStatus, "unvalidated");
  assert.deepStrictEqual(migrated.pumpCurvePoints, []);
});

test("12. validateBoreholeOperatingPoint never claims final selection", () => {
  const res = computeBorehole({ enabled: true, dailyWaterDemandLitres: 20000, desiredPumpingHoursPerDay: 6, staticWaterLevelM: 40, drawdownM: 10, tankHeightM: 6 }, {});
  const none = validateBoreholeOperatingPoint({ enabled: true }, res);
  assert.strictEqual(none.status, "unvalidated");
  assert.ok(/pump curve and borehole test/i.test(none.message));
  // an operating point below design duty is flagged
  const below = validateBoreholeOperatingPoint({ selectedOperatingPoint: { flowLph: 100, headM: 5 } }, res);
  assert.strictEqual(below.ok, false);
  assert.ok(below.message.includes(PUMP_SELECTION_DISCLAIMER));
});

test("13. No NaN/Infinity across evidence + compliance + borehole-validation", () => {
  assert.ok(noBad(createDefaultEvidence()) && noBad(createDefaultCompliance()));
  const res = computeBorehole(createDefaultBorehole(), {});
  assert.ok(noBad(validateBoreholeOperatingPoint(createDefaultBorehole(), res)));
});

test("14. App wires audit events at key actions + new tabs (source)", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.ok(/recordAudit\(AUDIT_EVENT_TYPES\.LOAD_APPLIED/.test(app), "load applied logged");
  assert.ok(/recordAudit\(AUDIT_EVENT_TYPES\.IMPORT_PERFORMED/.test(app), "import logged");
  assert.ok(/recordAudit\(AUDIT_EVENT_TYPES\.EXPORT_PERFORMED/.test(app), "export logged");
  assert.ok(/recordAudit\(AUDIT_EVENT_TYPES\.PDF_EXPORTED/.test(app), "pdf export logged");
  assert.ok(/recordAudit\(AUDIT_EVENT_TYPES\.WARNING_OVERRIDDEN/.test(app), "warning override logged");
  assert.ok(/recordAudit\(AUDIT_EVENT_TYPES\.PROJECT_CREATED/.test(app), "project created logged");
  assert.ok(/active === "compliance"/.test(app) && /ComplianceWorkspace/.test(app), "compliance tab wired");
  assert.ok(/active === "evidence"/.test(app) && /EvidenceWorkspace/.test(app), "evidence tab wired");
});

test("15. Borehole test-report UI + migration wired (source)", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.ok(/validateBoreholeOperatingPoint/.test(app), "operating-point validation shown");
  assert.ok(/Pump curve & borehole test report/i.test(app), "test-report card present");
  assert.ok(/normalizeEvidence\(mergedProject\.evidence\)/.test(app) && /normalizeCompliance\(mergedProject\.compliance\)/.test(app), "migration wired");
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

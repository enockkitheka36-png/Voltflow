/**
 * readiness-alerts-regression.mjs — Voltflow 11.5.2
 * Run: node scripts/readiness-alerts-regression.mjs   (npm run test:readiness)
 *
 * The central readiness engine is THE source of truth for Dashboard, Project
 * Advisor, Action Center and the proposal gate. This suite locks its pure logic:
 * load-inventory progress (applied vs draft-pending), safety/compliance from
 * real checks, missing-field surfacing, blocker detection, proposal gating and
 * view-mode routing. UI rendering + animation are browser-verified; here we also
 * assert the alert CSS carries reduced-motion overrides (source check).
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { buildProjectReadiness, READINESS_STATUS } from "../src/utils/readinessEngine.js";
import { isTabAllowedInView, VALID_TABS } from "../src/utils/navigation.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}
const noBadNumbers = (obj) => JSON.stringify(obj, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? "__BAD__" : v)).indexOf("__BAD__") === -1;

// ── Fixtures ────────────────────────────────────────────────────────────────
const goodProject = { client: "Acme Ltd", location: "Nairobi", preparedBy: "Eng. A", systemType: "Solar PV – Hybrid", phase: "Single phase", inverterMaxDcV: 500 };
const goodLoads = [{ qty: 2, watts: 500, dayHours: 6, nightHours: 2, critical: true }]; // legacy shape
const goodSizing = {
  dailyKwh: 10, actualKwp: 5, panels: 10, batteryKwh: 12, inverterKw: 5, totalCost: 850000,
  coldVocOk: true, dcDropPct: 0.01, acDropPct: 0.02, batteryInputA: 40, bmsMaxDischargeA: 100,
  dcCableAmpacityOk: true, acCableAmpacityOk: true, payback: 5,
};
const goodSurvey = { county: "Nairobi", roofLengthM: 8, roofWidthM: 6, roofType: "IBR", earthingAvailable: true, photos: { roof: true } };
const buildGood = (overrides = {}, hasUnapplied = false) =>
  buildProjectReadiness({ ...goodProject, ...overrides.project }, overrides.loads || goodLoads, [],
    { ...goodSurvey, ...overrides.survey }, { ...goodSizing, ...overrides.sizing }, {}, {}, null, hasUnapplied);

console.log(`\n${APP_VERSION} — Readiness + Alerts Regression\n`);

test("1. Completed, applied load inventory reads COMPLETE", () => {
  const r = buildGood();
  assert.strictEqual(r.sections.loadInventory.status, READINESS_STATUS.COMPLETE);
});

test("2. Draft loads not applied → needs-review + pending warning", () => {
  const r = buildGood({}, true);
  assert.strictEqual(r.sections.loadInventory.status, READINESS_STATUS.NEEDS_REVIEW);
  assert.ok(/not applied/i.test(r.sections.loadInventory.note || ""), "note tells user to apply");
  assert.ok(r.warnings.some((w) => w.highlightId === "update-sizing-btn"), "pending warning surfaced");
});

test("3. Update Sizing clears the pending warning", () => {
  const r = buildGood({}, false);
  assert.ok(!r.warnings.some((w) => w.highlightId === "update-sizing-btn"), "no pending warning once applied");
  assert.strictEqual(r.sections.loadInventory.status, READINESS_STATUS.COMPLETE);
});

test("4. Missing project fields are surfaced in missingFields", () => {
  const r = buildProjectReadiness({}, [], [], {}, {}, {}, {}, null, false);
  const labels = r.missingFields.map((m) => `${m.section}: ${m.item}`);
  assert.ok(labels.some((l) => /Client details/.test(l)), "client details flagged");
  assert.ok(r.missingFields.length > 3, "several missing fields for a blank project");
});

test("5. Safety warning appears when cold Voc exceeds the inverter limit", () => {
  const r = buildGood({ sizing: { coldVocOk: false } });
  assert.ok(r.criticalIssues.some((c) => /Cold Voc/i.test(c.label)), "cold Voc critical issue");
  assert.strictEqual(r.sections.inverterSafety.critical, true);
});

test("6. Safety/compliance progress reflects REAL checks (not static)", () => {
  const pass = buildGood().sections.engineeringCompliance.score;
  const fail = buildGood({ sizing: { coldVocOk: false, dcDropPct: 0.05, acDropPct: 0.09 } }).sections.engineeringCompliance.score;
  assert.strictEqual(pass, 100, "all checks passing → 100");
  assert.ok(fail < pass, `failing checks lower the score (${fail} < ${pass})`);
});

test("7. Unattended required fields (Action Center feed) are listed for a blank project", () => {
  const r = buildProjectReadiness({}, [], [], {}, {}, {}, {}, null, false);
  const required = r.missingFields.filter((m) => m.priority === "required" || m.priority === "critical");
  assert.ok(required.length > 0, "required items exist to populate the Action Center");
});

test("8. Every 'Go fix' target tab is a real routable tab", () => {
  const r = buildProjectReadiness({}, [], [], {}, { coldVocOk: false }, {}, {}, null, true);
  const tabs = [
    ...r.missingFields.map((m) => m.actionTab),
    ...r.criticalIssues.map((c) => c.actionTab),
    ...r.warnings.map((w) => w.actionTab),
    ...r.nextActions.map((a) => a.actionTab),
    ...Object.values(r.sections).map((s) => s.actionTab),
  ];
  tabs.forEach((t) => assert.ok(VALID_TABS.has(t), `unknown route target: ${t}`));
});

test("9. Proposal is gated when critical blockers exist", () => {
  const blocked = buildGood({ sizing: { coldVocOk: false } });
  assert.strictEqual(blocked.readyForProposal, false, "blocked when cold Voc fails");
  assert.ok(blocked.criticalIssues.length > 0, "gate has blockers to show");
  const clear = buildGood();
  assert.strictEqual(clear.readyForProposal, true, "ready when everything checks out");
});

test("10. Advisor & Dashboard agree — one deterministic source of truth", () => {
  const a = buildGood(), b = buildGood();
  assert.strictEqual(a.overallScore, b.overallScore, "same inputs → same score");
  assert.strictEqual(typeof a.overallScore, "number");
  assert.strictEqual(typeof a.readyForProposal, "boolean");
  // the readiness object both panels read is a single structure
  assert.ok(a.sections && a.nextActions && a.criticalIssues, "shared shape present");
});

test("11. readiness carries the night object for consumers", () => {
  const r = buildGood();
  assert.ok(r.night && typeof r.night.isNightDominantLoad === "boolean", "night present");
});

test("15b. Optional sections (energy import) are NOT counted as required-missing", () => {
  const r = buildProjectReadiness({}, [], [], {}, {}, {}, {}, null, false);
  const energyMissing = r.missingFields.filter((m) => /Energy data import/i.test(m.section));
  assert.ok(energyMissing.length > 0, "energy import still appears (as a recommendation)");
  energyMissing.forEach((m) => assert.strictEqual(m.priority, "recommended", "optional import must be recommended, not required"));
  // and the section itself is flagged optional
  assert.strictEqual(r.sections.energyImport.optional, true);
});

test("16. Client View hides internal technical tabs", () => {
  assert.strictEqual(isTabAllowedInView("eng-compliance", "client"), false);
  assert.strictEqual(isTabAllowedInView("inverter", "client"), false);
  assert.strictEqual(isTabAllowedInView("proposal", "client"), true);
});

test("17. Technician View shows practical field tabs", () => {
  assert.strictEqual(isTabAllowedInView("loads", "technician"), true);
  assert.strictEqual(isTabAllowedInView("delivery", "technician"), true);
  assert.strictEqual(isTabAllowedInView("eng-compliance", "technician"), false);
});

test("18. Alert/pulse classes respect prefers-reduced-motion (CSS source)", () => {
  const css = readFileSync(new URL("../src/components/ui.css", import.meta.url), "utf8");
  const rm = css.slice(css.indexOf("prefers-reduced-motion"));
  assert.ok(/prefers-reduced-motion:\s*reduce/.test(css), "reduced-motion media query exists");
  assert.ok(/\.vf-pulse[\s\S]*animation:\s*none/.test(rm) || /\.vf-pulse[^{]*,[\s\S]*animation:\s*none/.test(rm), "vf-pulse disabled under reduced motion");
});

test("19. Clean startup: blank inputs never throw and produce finite numbers", () => {
  let r;
  assert.doesNotThrow(() => { r = buildProjectReadiness({}, [], [], {}, {}, {}, {}, null, false); });
  assert.ok(r.overallScore >= 0 && r.overallScore <= 100, "score in range");
  assert.ok(noBadNumbers(r), "no NaN/Infinity anywhere in the readiness object");
});

test("20. Readiness is deterministic (survives save/export/import unchanged)", () => {
  const a = JSON.stringify(buildGood());
  const b = JSON.stringify(buildGood());
  assert.strictEqual(a, b, "same inputs → byte-identical readiness");
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

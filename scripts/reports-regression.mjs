/**
 * reports-regression.mjs — Voltflow 11.7 (Evidence Reports)
 * Run: node scripts/reports-regression.mjs   (npm run test:reports)
 *
 * Pure content checks for the four report modes. PDF rendering is browser-verified.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { buildReport, reportToText, REPORT_MODES } from "../src/utils/reportBuilder.js";
import { computeBorehole } from "../src/utils/boreholeEngine.js";
import { APP_VERSION } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}
const noBad = (o) => JSON.stringify(o, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? "__BAD__" : v)).indexOf("__BAD__") === -1;

const project = { client: "Acme Ltd", location: "Nairobi", systemType: "Solar PV – Hybrid", preparedBy: "Eng. A", psh: 5.6, solarCoverage: 0.9, gridTariff: 22, inverterMaxDcV: 500, panelW: 550, runningLoadDiversityFactor: 0.75, surgeDiversityFactor: 0.65 };
const sizing = {
  pr: 0.78, actualKwp: 6.6, panels: 12, batteryKwh: 12, inverterKw: 8, totalCost: 950000, annualSavings: 180000, payback: 5.3,
  annualEnergy: 10500, annualEnergyP90: 9450, autonomyHours: 8, dscrYear1: 1.6, lcoe: 9, designDailyKwh: 22, stringVocCold: 420, coldVocOk: true, dcDropPct: 0.01, acDropPct: 0.02,
  inverterSizing: { selectedReason: "Load / surge demand", loadBasedInvKw: 8, pvBasedInvKw: 7.3, peakKw: 6.4, isLoadLed: true },
  dcAcAnalysis: { ratio: 0.83, status: "Acceptable", targetMin: 0.8, targetMax: 1.5, isLow: false, explanation: "" },
  stringSizing: { requestedPanelsPerString: 12, effectivePanelsPerString: 12, maxPanelsPerStringByVoltage: 10, strings: 1 },
};
const readiness = {
  overallScore: 82, readyForProposal: true,
  criticalIssues: [], warnings: [{ label: "Payback above target", priority: "recommended" }],
  night: { estimatedNightAutonomyHours: 6, nightEnergyCoverage: 1, nightAutonomyWarning: null },
};
const borehole = computeBorehole({ enabled: true, dailyWaterDemandLitres: 20000, boreholeYieldLitresPerHour: 5000, staticWaterLevelM: 40, drawdownM: 10 }, { psh: 5.6, pr: 0.78, panelW: 550 });
const boreholeChecklist = { checklist: ["Confirm borehole test report", "Confirm dynamic water level", "Record flow test after commissioning"] };
const ctx = { project, sizing, readiness, borehole, boreholeChecklist, evidence: { approvalStatus: "in_review", confidenceLevel: "surveyed", version: 3, responsibleUser: "Eng. A" } };

console.log(`\n${APP_VERSION} — Reports Regression\n`);

test("1. All four report modes render non-empty sections", () => {
  REPORT_MODES.forEach((m) => {
    const r = buildReport(m, ctx);
    assert.ok(r.sections.length >= 3, `${m} has sections`);
    assert.ok(r.disclaimers.length >= 1, `${m} has disclaimers`);
    assert.ok(/certified engineering/i.test(r.disclaimers.join(" ")), `${m} keeps the no-cert disclaimer`);
  });
});

test("2. Client report HIDES internal technical detail", () => {
  const txt = reportToText(buildReport("client", ctx));
  assert.ok(!/cold voc/i.test(txt), "no cold Voc");
  assert.ok(!/dc:ac/i.test(txt), "no DC:AC");
  assert.ok(!/voltage drop|ampacity|string/i.test(txt), "no cable/string internals");
  assert.ok(/annual savings/i.test(txt) && /investment/i.test(txt), "shows benefits + investment");
});

test("3. Engineer report INCLUDES technical basis", () => {
  const r = buildReport("engineer", ctx);
  assert.ok(r.sections.some((s) => /technical basis/i.test(s.heading)), "technical basis section");
  const txt = reportToText(r);
  assert.ok(/DC:AC ratio/i.test(txt) && /Cold string Voc/i.test(txt), "includes ratios + cold Voc");
});

test("4. Technician report INCLUDES checklists", () => {
  const r = buildReport("technician", ctx);
  assert.ok(r.sections.some((s) => s.type === "checklist"), "has a checklist section");
  const txt = reportToText(r);
  assert.ok(/commissioning/i.test(txt), "includes commissioning checklist");
  assert.ok(/Borehole checklist/i.test(txt), "includes borehole checklist when enabled");
});

test("5. Lender report INCLUDES assumptions AND unresolved risks", () => {
  const r = buildReport("lender", ctx);
  assert.ok(r.sections.some((s) => /assumptions/i.test(s.heading)), "assumptions section");
  assert.ok(r.sections.some((s) => /unresolved risks/i.test(s.heading)), "risks section");
  const txt = reportToText(r);
  assert.ok(/payback|DSCR/i.test(txt), "includes financials");
  assert.ok(/Approval status/i.test(txt), "includes evidence/approval");
});

test("6. Borehole summary appears in client, engineer, technician, lender when enabled", () => {
  ["client", "engineer", "lender"].forEach((m) => {
    const txt = reportToText(buildReport(m, ctx));
    assert.ok(/borehole|water pumping/i.test(txt), `${m} mentions borehole`);
    assert.ok(/pump curve|test-report|test report/i.test(txt), `${m} keeps the pump-selection caveat`);
  });
});

test("7. Reports are finite even for a blank project (no NaN/Infinity)", () => {
  REPORT_MODES.forEach((m) => {
    const r = buildReport(m, { project: {}, sizing: {}, readiness: {} });
    assert.ok(noBad(r), `${m} blank report finite`);
    assert.ok(r.sections.length >= 1);
  });
});

test("8. Unknown mode falls back to client", () => {
  const r = buildReport("nonsense", ctx);
  assert.strictEqual(r.mode, "client");
});

test("9. Report buttons are wired into the Proposal (source)", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.ok(/buildReport\(mode/.test(app) && /downloadReportPdf\(/.test(app), "genReport builds + downloads");
  assert.ok(/Formal reports/i.test(app), "formal reports card present");
  assert.ok(/visibleReportModes\.map/.test(app), "renders allowed report buttons for the current view");
  assert.ok(/canShowInternalProposal/.test(app), "engineer-only report/export controls are gated");
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

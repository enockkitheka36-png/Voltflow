/**
 * data-integrity-hotfix-regression.mjs - Voltflow 11.7.2b
 * Run: node scripts/data-integrity-hotfix-regression.mjs (npm run test:data-integrity)
 *
 * Locks the 11.7.2b audit blockers around zero-load gating, wizard persistence,
 * proposal sanitization, default-fact labelling, AI privacy, honest bank submit,
 * load validation, BoQ commercial integrity, finance wording and drawer behavior.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { APP_VERSION, SCHEMA_VERSION } from "../src/utils/schemaMigration.js";
import { validateLoadItemsV2, toLegacyLoads } from "../src/utils/loadEngine.js";
import { buildProjectFromOnboarding } from "../src/utils/projectFactory.js";
import { buildProjectReadiness } from "../src/utils/readinessEngine.js";
import { calculateReadiness, computeGovernanceStatus } from "../src/utils/readiness.js";
import { buildProjectAdvice } from "../src/utils/projectAdvisor.js";
import { buildStudioBlocks } from "../src/utils/studioBlocks.js";
import { generateClientExplanation } from "../src/utils/advisory.js";
import { generateAccessoriesBoQ } from "../src/utils/accessoryEngine.js";
import { reconcileBillAndLoads } from "../src/utils/billLoadReconciliation.js";
import { canExportProjectBackup } from "../src/utils/projectSave.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log("  PASS: " + name);
    passed++;
  } catch (e) {
    console.error("  FAIL: " + name);
    console.error("    " + e.message);
    failed++;
  }
}

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const uiCss = readFileSync(new URL("../src/components/ui.css", import.meta.url), "utf8");
const explainDrawer = readFileSync(new URL("../src/components/ExplainDrawer.jsx", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const pendingSizing = {
  dailyKwh: 0,
  designDailyKwh: 0,
  totalCost: 0,
  loadInventoryPending: true,
  loadInventoryBlocked: true,
  quoteBlockedReason: "Pending load inventory",
};
const invalidSizing = {
  dailyKwh: 20,
  designDailyKwh: 20,
  totalCost: 0,
  loadInventoryInvalid: true,
  loadInventoryBlocked: true,
  quoteBlockedReason: "Invalid load inventory",
};
const baseProject = {
  client: "Acme Ltd",
  location: "Nairobi",
  preparedBy: "QA",
  systemType: "Solar PV - Hybrid",
  phase: "Single phase",
  monthlyBill: 123456,
  gridTariff: 25,
  solarCoverage: 0.8,
};
const baseSurvey = {
  county: "Nairobi",
  roofLengthM: 8,
  roofWidthM: 6,
  roofType: "Mabati / Iron sheet",
  photos: { roof: true },
  earthingAvailable: true,
};

console.log(`\n${APP_VERSION} - Data Integrity + Proposal Sanitization Regression\n`);

test("1. App version bumped to 11.8.1 without persisted schema churn", () => {
  // v11.8.1 runtime-trust release; behavioural blockers below unchanged; schema stays 11.7.
  assert.strictEqual(APP_VERSION, "Voltflow 11.8.1");
  assert.strictEqual(SCHEMA_VERSION, "11.7");
});

test("2. Zero committed loads block readiness, advisor, studio and governance", () => {
  const readiness = buildProjectReadiness(baseProject, [], [], baseSurvey, pendingSizing);
  assert.strictEqual(readiness.readyForProposal, false);
  assert.strictEqual(readiness.readyForEngineeringReview, false);
  assert.ok(/Pending load inventory/i.test(readiness.sections.loadInventory.note || ""));
  assert.ok(readiness.warnings.some((w) => /Pending load inventory/i.test(w.label)));

  const dashboard = calculateReadiness(baseProject, [], baseSurvey, pendingSizing);
  assert.ok(dashboard.blockers.some((b) => /Pending load inventory/i.test(b)));
  assert.strictEqual(computeGovernanceStatus(baseProject, pendingSizing, dashboard).status, "Pending load inventory");

  const advice = buildProjectAdvice(baseProject, [], pendingSizing);
  assert.strictEqual(advice.readyForProposal, false);
  assert.ok(advice.missingData.some((m) => /Pending load inventory/i.test(m)));

  const studio = buildStudioBlocks(readiness, pendingSizing);
  assert.strictEqual(studio.find((b) => b.key === "loads").metric, "Pending load inventory");
  assert.strictEqual(studio.find((b) => b.key === "boq").metric, "Pending");
});

test("3. Wizard monthly bill, site type, objective and load source persist", () => {
  const { project, nextTab } = buildProjectFromOnboarding({ psh: 5.6, panelW: 600 }, {
    client: "Ridge Clinic",
    location: "Kisumu",
    siteType: "Hospital / Clinic",
    monthlyBill: 98765,
    objectiveKey: "commercial",
    loadSourceKey: "energy_import",
    phase: "Three Phase (400V)",
  });
  assert.strictEqual(project.monthlyBill, 98765);
  assert.strictEqual(project.siteType, "Hospital / Clinic");
  assert.strictEqual(project.loadAssessmentMode, "Hospital / Clinic");
  assert.strictEqual(project.objectiveKey, "commercial");
  assert.ok(project.objectiveLabel);
  assert.strictEqual(project.loadSourceKey, "energy_import");
  assert.strictEqual(project.loadSource, "data_logger");
  assert.strictEqual(nextTab, "energy-import");
  assert.ok(/monthlyBill: built\.monthlyBill/.test(app), "wizard survey activation passes entered bill");
  assert.ok(/siteType: built\.siteType/.test(app), "wizard survey activation passes entered site type");
  assert.ok(!/Proposal must use default KES 35,000/i.test(app));
});

test("4. Proposal is sanitized outside Engineer View", () => {
  assert.ok(/canShowInternalProposal/.test(app), "internal proposal gate exists");
  assert.ok(/canShowInternalProposal && setProject && <ProposalStudioPanel/.test(app), "Proposal Studio hidden unless engineer");
  assert.ok(/canShowInternalProposal && \(/.test(app), "engineer-only action controls wrapped");
  assert.ok(/visibleReportModes\.map/.test(app), "report buttons are view-filtered");
  assert.ok(/canExportProjectBackup\(normalizeViewMode\(viewMode\)/.test(app), "storage JSON export uses the shared access guard");
  assert.strictEqual(canExportProjectBackup("engineer", { cloudEnabled: true, role: "engineer" }), true);
  for (const viewMode of ["client", "bank", "technician"]) assert.strictEqual(canExportProjectBackup(viewMode), false);
  assert.strictEqual(canExportProjectBackup("engineer", { cloudEnabled: true, role: "bank" }), false);
  assert.ok(/Project JSON hidden in this view/.test(app), "non-engineer storage message present");
  assert.ok(/canShowCommercialProposal = !isTechnicianView/.test(app), "technician commercial suppression exists");
  assert.ok(/canShowInternalProposal && accessoriesBoQ/.test(app), "BOS detail hidden from client/bank");
  assert.ok(/canShowInternalProposal && pr &&/.test(app) && /Unresolved before final issue/.test(app), "raw blockers remain engineer-gated");
});

test("5. Default survey facts are labelled as assumptions, not verified facts", () => {
  assert.ok(/SURVEY_ASSUMPTION_NOTE/.test(app));
  assert.ok(/Assumption.*confirm during site survey/.test(app));
  assert.ok(/withSurveyAssumption\("roofCondition"/.test(app));
  assert.ok(/withSurveyAssumption\("roofAreaM2"/.test(app));
  assert.ok(/withSurveyAssumption\("mainBreakerA"/.test(app));
  assert.ok(/withSurveyAssumption\("earthingAvailable"/.test(app));
});

test("6. AI privacy guard prevents external POST unless explicitly enabled", () => {
  const guardIndex = app.indexOf("if (!aiEnabled)");
  const fetchIndex = app.indexOf('fetch("/api/assistant"');
  assert.ok(guardIndex > -1 && fetchIndex > -1 && guardIndex < fetchIndex, "disabled AI returns before fetch");
  assert.ok(/viewMode === "bank"\) return false/.test(app), "Bank Mode disables assistant calls");
  assert.ok(/window\.__VOLTFLOW_AI_ENABLED__ === true/.test(app), "explicit runtime opt-in required");
  assert.ok(/aiEnabled && destinationDomain/.test(app), "destination domain shown only when enabled");
  assert.ok(!/(?:src|href)=["']https?:\/\//i.test(indexHtml), "local-demo shell must not request third-party fonts or assets");
});

test("7. Bank ready action is honest local-only wording", () => {
  assert.ok(/Mark ready locally/i.test(app));
  assert.ok(/Solarise has not received this automatically/i.test(app));
  assert.ok(/Export\/share for Solarise review/i.test(app));
  assert.ok(!/Solarise is reviewing this quote/i.test(app));
});

test("8. Invalid load hours block update sizing and readiness", () => {
  const errors = validateLoadItemsV2([{ name: "Invalid", qty: 1, watts: 100, dayHours: 18, nightHours: 8 }]);
  assert.ok(errors.some((e) => /Day \+ night hours cannot exceed 24/i.test(e.problems.join(" "))));
  const invalidLoads = toLegacyLoads([{ name: "Invalid", qty: 1, watts: 100, dayHours: 18, nightHours: 8 }], "Residential");
  const readiness = buildProjectReadiness(baseProject, invalidLoads, invalidLoads, baseSurvey, invalidSizing);
  assert.strictEqual(readiness.readyForProposal, false);
  assert.ok(readiness.warnings.some((w) => /Invalid load inventory/i.test(w.label)));
  assert.ok(/draftLoadErrors\.length > 0/.test(app), "Update Sizing blocks invalid drafts");
});

test("9. BoQ includes labour, transport and markup allowances", () => {
  const boq = generateAccessoriesBoQ({
    project: { ...baseProject, phase: "Single phase" },
    survey: baseSurvey,
    sizing: { panels: 12, batteryKwh: 10, batteryModules: 4 },
    roofGeometry: { roofAreaUsableM2: 80 },
    panelLayout: { requiredPanels: 12, numberOfRows: 3 },
    simulation: { dcRouteCustomM: 0, acRouteCustomM: 0 },
    liveStringPlan: { totalStrings: 1 },
  });
  assert.ok(boq.categories.commercial.some((r) => /labour/i.test(r.name)));
  assert.ok(boq.categories.commercial.some((r) => /Transport/i.test(r.name)));
  assert.ok(boq.categories.commercial.some((r) => /markup/i.test(r.name) && r.internalCost));
  assert.ok(boq.commercialSummary.labourAllowance > 0);
  assert.ok(boq.commercialSummary.transportAllowance > 0);
  assert.ok(boq.commercialSummary.markupAmount > 0);
  assert.ok(/Headline BoQ total/.test(app) && /Detailed BOS reference/.test(app), "headline and detailed BOS reconcile in UI");
});

test("10. Financial wording and LCOE are consistent", () => {
  assert.ok(/Carbon Revenue Y1/.test(app));
  assert.ok(/project\.carbonInCashflow \? sizing\.carbonValue : 0/.test(app), "carbon revenue excluded by default");
  assert.ok(/Equity-only case/.test(app), "no-debt wording avoids Cash label");
  assert.ok(/LCOE P50\/P90/.test(app), "canonical LCOE label used");
  assert.ok(!/Metric label="Discounted LCOE"/.test(app), "duplicate LCOE metric removed");
});

test("11. Drawer and short-viewport behavior is wired", () => {
  assert.ok(/event\.key === "Escape"/.test(app), "Action Center closes on Escape");
  assert.ok(/event\.key === "Escape"/.test(explainDrawer), "Explain drawer closes on Escape");
  assert.ok(/closeSidebarOnEscape/.test(app), "Responsive navigation closes on Escape");
  assert.ok(/setStartupView\("welcome"\); setSidebarOpen\(false\)/.test(app), "Responsive navigation closes after returning to start");
  assert.ok(/onClose\(\);/.test(app), "Action Center closes after Go fix");
  assert.ok(/max-height: 560px/.test(uiCss), "short viewport CSS present");
  assert.ok(/\.vf-help-dock \{ display: none; \}/.test(uiCss), "help dock hidden on short viewport");
  assert.ok(/z-index: 12[1-5]/.test(uiCss), "drawers sit above mobile menu");
  assert.ok(/\.vf-viewmode-bar\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/.test(uiCss), "view-mode controls stay inside the sidebar");
  assert.ok(/viewMode !== "technician" && <Metric label="Investment"/.test(app), "technician readiness hides investment");
});

test("12. Unresolved bill/load mismatch suppresses total-consumption claims", () => {
  const reconciliation = reconcileBillAndLoads({
    monthlyBillKes: 350000,
    tariffKesPerKwh: 30,
    itemizedDailyKwh: 0.4,
    monthlySavingsKes: 1556,
    nonEnergyChargesKnown: true,
  });
  const explanation = generateClientExplanation(
    { ...baseProject, monthlyBill: 350000, solarCoverage: 0.85 },
    { dailyKwh: 0.4, actualKwp: 0.6, batteryKwh: 5.1, inverterKw: 1, annualEnergy: 943, annualSavings: 18674, autonomyHours: 251.2 },
    null,
    reconciliation,
  );
  assert.ok(reconciliation.clientClaimsBlocked);
  assert.ok(/captured load inventory/i.test(explanation.recommendation));
  assert.ok(/referenced monthly bill/i.test(explanation.whatItWillDo));
  assert.ok(!/85% of your total electricity consumption/i.test(explanation.recommendation));
  assert.ok(/label="Captured load coverage"/.test(app));
  assert.ok(/label="Savings vs referenced bill"/.test(app));
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

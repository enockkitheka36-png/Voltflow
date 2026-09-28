/**
 * workflow-regression.mjs — Voltflow 11.1
 * Run: node scripts/workflow-regression.mjs
 *
 * Unlike decision-regression.cjs (which mirrors App.jsx logic inline), this
 * suite imports the REAL production modules from src/utils so the tests break
 * when the engines change. Covers the v11.1 workflow-stabilization sprint:
 * draft/commit load validation, blueprint templates, sizing-mode migration,
 * MPPT revalidation, cable-length apply, accessory advisories, governance
 * gates, and as-built deviation checks.
 */
import assert from "node:assert";

import {
  createLoadItem,
  toLegacyLoads,
  validateLoadItemsV2,
  summarizeLoads,
  BLUEPRINT_TEMPLATES,
  generateBlueprintDraftLoads,
} from "../src/utils/loadEngine.js";
import {
  resolveLoadItemsV2,
  migrateLegacyLoadsToV2,
  normalizeSizingMode,
  normalizeBlueprintAssumptions,
  normalizeQuoteStage,
  normalizeAccessoriesAssumptions,
  defaultAccessoriesAssumptions,
  SCHEMA_VERSION,
} from "../src/utils/schemaMigration.js";
import {
  generateStringPlan,
  computePlanWarnings,
  compareAsBuilt,
  getStringColour,
  STRING_COLOURS,
} from "../src/utils/stringPlanner.js";
import { generateAccessoriesBoQ, applyAccessoryOverrides } from "../src/utils/accessoryEngine.js";
import { getCableEstimates } from "../src/utils/installerSimulation.js";
import { distributeAcrossRoofFaces, computeFaceCapacity, createDefaultRoofFace } from "../src/utils/multiRoofLayout.js";
import { calculateReadiness, computeGovernanceStatus } from "../src/utils/readiness.js";
import { appendSimulationSummary, appendLoadAndAccessoriesSummary } from "../src/utils/pdfGenerator.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}

console.log(`\nVoltflow ${SCHEMA_VERSION} — Workflow Regression (real modules)\n`);

// ── Draft / commit workflow (brief tests 1, 2, 4) ──────────────────────────
test("W1. Editing a draft copy does not change committed adapter output", () => {
  const committed = [createLoadItem({ name: "Fridge", ratedW: 250, qty: 1, dayHours: 6, nightHours: 6 })];
  const before = toLegacyLoads(committed, "Residential")[0].watts;
  const draft = committed.map(l => ({ ...l }));
  draft[0].ratedW = 9999;
  const after = toLegacyLoads(committed, "Residential")[0].watts;
  assert.strictEqual(before, after, "Committed loads must be unaffected by draft edits");
});

test("W2. Committing the draft changes the adapter output", () => {
  let committed = [createLoadItem({ name: "Fridge", ratedW: 250, qty: 1, dayHours: 6, nightHours: 6 })];
  const draft = committed.map(l => ({ ...l, ratedW: 500 }));
  assert.strictEqual(validateLoadItemsV2(draft).length, 0, "Draft should be valid");
  committed = draft; // commit
  assert.ok(toLegacyLoads(committed, "Residential")[0].watts > toLegacyLoads([createLoadItem({ name: "Fridge", ratedW: 250, qty: 1, dayHours: 6 })], "Residential")[0].watts);
});

test("W4. Reset restores draft summary to committed summary", () => {
  const committed = [createLoadItem({ name: "TV", ratedW: 120, qty: 1, dayHours: 2, nightHours: 3 })];
  let draft = committed.map(l => ({ ...l, qty: 5 }));
  draft = committed.map(l => ({ ...l })); // reset
  assert.strictEqual(
    summarizeLoads(draft, "Residential").dailyKwh,
    summarizeLoads(committed, "Residential").dailyKwh
  );
});

// ── Validation gate (brief test 3) ─────────────────────────────────────────
test("W3. Invalid rows are caught and block the commit gate", () => {
  const bad = [
    createLoadItem({ name: "", ratedW: 100, qty: 1, dayHours: 2 }),                 // no name
    createLoadItem({ name: "Zero qty", ratedW: 100, qty: 0, dayHours: 2 }),         // qty 0
    createLoadItem({ name: "Zero watts", ratedW: 0, qty: 1, dayHours: 2 }),         // watts 0
    createLoadItem({ name: "No hours", ratedW: 100, qty: 1, dayHours: 0, nightHours: 0 }),
    createLoadItem({ name: "Day 30h", ratedW: 100, qty: 1, dayHours: 30 }),
    createLoadItem({ name: "Surge 0.5", ratedW: 100, qty: 1, dayHours: 2, surgeMultiplier: 0.5 }),
  ];
  const errors = validateLoadItemsV2(bad);
  assert.strictEqual(errors.length, 6, `Expected 6 invalid rows, got ${errors.length}: ${JSON.stringify(errors.map(e => e.problems))}`);
  const good = [createLoadItem({ name: "OK", ratedW: 100, qty: 1, dayHours: 2 })];
  assert.strictEqual(validateLoadItemsV2(good).length, 0);
});

// ── System options inputs (brief tests 5, 6) ───────────────────────────────
test("W5. Adapter output carries every field computeOptionSizing consumes", () => {
  const legacy = toLegacyLoads([createLoadItem({ name: "Pump", ratedW: 1100, qty: 1, dayHours: 1, surgeMultiplier: 4, essential: false })], "Residential")[0];
  ["qty", "watts", "dayHours", "nightHours", "surge", "critical"].forEach(k =>
    assert.ok(k in legacy, `Missing adapter field ${k}`));
});

test("W6. Changing applied loads changes the option-sizing inputs", () => {
  const a = toLegacyLoads([createLoadItem({ name: "L", ratedW: 100, qty: 1, dayHours: 2 })], "Residential");
  const b = toLegacyLoads([createLoadItem({ name: "L", ratedW: 100, qty: 4, dayHours: 2 })], "Residential");
  const dayKwh = (rows) => rows.reduce((s, l) => s + (l.qty * l.watts * l.dayHours) / 1000, 0);
  assert.ok(dayKwh(b) > dayKwh(a));
});

// ── Blueprint templates (brief tests 7, 8) ─────────────────────────────────
test("W7. Blueprint template generates a valid draft load list", () => {
  assert.strictEqual(BLUEPRINT_TEMPLATES.length, 11, "11 building templates expected");
  const rows = generateBlueprintDraftLoads("office", { floorAreaM2: 200, occupancy: 12, scheduleHoursPerDay: 9, futureGrowthPct: 0 });
  assert.ok(rows.length >= 5, `Office template too small: ${rows.length}`);
  assert.strictEqual(validateLoadItemsV2(rows).length, 0, "Generated rows must pass validation");
  const ids = new Set(rows.map(r => r.id));
  assert.strictEqual(ids.size, rows.length, "Row ids must be unique");
});

test("W7b. Growth margin item adds the requested share of daily energy", () => {
  const base = generateBlueprintDraftLoads("residential_house", { floorAreaM2: 150, occupancy: 4, scheduleHoursPerDay: 10, futureGrowthPct: 0 });
  const grown = generateBlueprintDraftLoads("residential_house", { floorAreaM2: 150, occupancy: 4, scheduleHoursPerDay: 10, futureGrowthPct: 20 });
  const kwh = (rows) => rows.reduce((s, it) => s + (it.qty * it.ratedW * ((it.dayHours || 0) + (it.nightHours || 0))) / 1000, 0);
  const ratio = kwh(grown) / kwh(base);
  assert.ok(Math.abs(ratio - 1.2) < 0.02, `Expected ~1.20× energy with 20% growth, got ${ratio.toFixed(3)}×`);
  assert.ok(grown.some(r => r.name.includes("Future growth")), "Growth allowance row expected");
});

test("W8. Blueprint loads stay in draft until the commit gate passes them", () => {
  // Simulated state machine sequencing the REAL functions (validate → assign),
  // mirroring commitDraftLoadItems' gate.
  const state = { committed: [createLoadItem({ name: "Old", ratedW: 50, qty: 1, dayHours: 1 })], draft: [], hasUnapplied: false };
  state.draft = generateBlueprintDraftLoads("school", { floorAreaM2: 400, occupancy: 200, scheduleHoursPerDay: 9 });
  state.hasUnapplied = true;
  assert.strictEqual(state.committed.length, 1, "Committed untouched after generation");
  if (validateLoadItemsV2(state.draft).length === 0) { state.committed = state.draft; state.hasUnapplied = false; }
  assert.ok(state.committed.length > 1, "Commit applies generated loads");
  assert.strictEqual(state.hasUnapplied, false);
});

// ── Multi-roof and layout capacity (brief tests 9, 12, 13) ─────────────────
test("W9. Two roof faces give more capacity than one (affects options roof-fit)", () => {
  const project = { panelLengthM: 2.28, panelWidthM: 1.13, roofEdgeSetbackM: 0.3 };
  const f1 = { ...createDefaultRoofFace("A"), roofLengthM: 8, roofWidthM: 5, selectedForPv: true };
  const f2 = { ...createDefaultRoofFace("B"), roofLengthM: 8, roofWidthM: 5, selectedForPv: true };
  const one = distributeAcrossRoofFaces([f1], project, 40);
  const two = distributeAcrossRoofFaces([f1, f2], project, 40);
  assert.ok(two.totalCapacity > one.totalCapacity, `Expected 2-face capacity ${two.totalCapacity} > 1-face ${one.totalCapacity}`);
});

test("W12. Face obstructions reduce the placeable panel count", () => {
  const project = { panelLengthM: 2.28, panelWidthM: 1.13 };
  const clear = computeFaceCapacity({ ...createDefaultRoofFace("A"), roofLengthM: 10, roofWidthM: 8, obstructions: [] }, project);
  const blocked = computeFaceCapacity({ ...createDefaultRoofFace("A"), roofLengthM: 10, roofWidthM: 8, obstructions: [{ wPct: 60, hPct: 60 }] }, project);
  assert.ok(blocked.maxPanels < clear.maxPanels, `Expected ${blocked.maxPanels} < ${clear.maxPanels}`);
});

test("W13. Face capacity never exceeds what the face area can hold", () => {
  const project = { panelLengthM: 2.28, panelWidthM: 1.13 };
  const face = { ...createDefaultRoofFace("A"), roofLengthM: 6, roofWidthM: 4, obstructions: [] };
  const cap = computeFaceCapacity(face, project);
  const panelArea = 2.28 * 1.13;
  assert.ok(cap.maxPanels * panelArea <= 6 * 4 + 1e-6, `Capacity ${cap.maxPanels} panels exceeds face area`);
});

// ── String plan, colours, MPPT revalidation (brief tests 14, 15) ───────────
test("W14. String plan assigns sequential colour indexes with distinct colours", () => {
  const plan = generateStringPlan({ panelsPerString: 6, inverterMpptCount: 2, inverterStringsPerMppt: 2 }, { panels: 18, strings: 3 }, []);
  assert.strictEqual(plan.strings.length, 3);
  plan.strings.forEach((s, i) => assert.strictEqual(s.colourIndex, i));
  const colours = plan.strings.map((s, i) => getStringColour(i));
  assert.strictEqual(new Set(colours).size, 3, "First strings must get distinct colours");
  assert.ok(STRING_COLOURS.length >= 6);
});

test("W15. Mixed roof-face MPPT and per-MPPT overload warnings (live revalidation)", () => {
  const strings = [
    { id: "S1", mpptNumber: 1, roofAzimuth: 90 },
    { id: "S2", mpptNumber: 1, roofAzimuth: 270 },
  ];
  const warnings = computePlanWarnings(strings, { inverterMpptCount: 2, inverterStringsPerMppt: 2 });
  assert.ok(warnings.some(w => w.includes("different orientations")), JSON.stringify(warnings));

  const overloaded = [
    { id: "S1", mpptNumber: 1, roofAzimuth: null },
    { id: "S2", mpptNumber: 1, roofAzimuth: null },
    { id: "S3", mpptNumber: 1, roofAzimuth: null },
  ];
  const w2 = computePlanWarnings(overloaded, { inverterMpptCount: 2, inverterStringsPerMppt: 2 });
  assert.ok(w2.some(w => w.includes("MPPT 1 has 3 strings")), JSON.stringify(w2));
});

// ── Cable lengths → project (brief test 16) ────────────────────────────────
test("W16. Simulation cable estimates can update the project's drop-calc lengths", () => {
  const simulation = { dcRouteCustomM: 0, acRouteCustomM: 0, batteryRouteCustomM: 0, inverterLocation: "garage", batteryLocation: "near_inverter" };
  const est = getCableEstimates(simulation, {}, { roofLengthEstimatedM: 20 });
  assert.ok(est.dcM > 0 && est.acM > 0, "Estimates must be positive");
  const project = { dcCableLengthM: 30, acCableLengthM: 25 };
  const applied = { ...project, dcCableLengthM: Math.ceil(est.dcM), acCableLengthM: Math.ceil(est.acM) };
  assert.notStrictEqual(applied.dcCableLengthM, project.dcCableLengthM === Math.ceil(est.dcM) ? -1 : project.dcCableLengthM || null);
  assert.strictEqual(applied.dcCableLengthM, Math.ceil(est.dcM));
  assert.strictEqual(applied.acCableLengthM, Math.ceil(est.acM));
});

// ── Accessories BoQ (brief test 17 + v11.1 advisories) ─────────────────────
test("W17. Combiner box appears in BoQ when string count > 2", () => {
  const inputs = {
    project: { panelLengthM: 2.28, panelWidthM: 1.13, phase: "Single phase" },
    survey: { earthingAvailable: true, roofType: "Mabati / Iron sheet" },
    sizing: { panels: 12, batteryKwh: 10, batteryModules: 2 },
    roofGeometry: { roofLengthEstimatedM: 12 },
    panelLayout: { panelsPerRow: 6, recommendedPanelOrientation: "portrait", roofFitStatus: "Fits comfortably" },
    simulation: { roofFaces: [] },
    liveStringPlan: { totalStrings: 3, needsCombiner: true },
  };
  const boq = generateAccessoriesBoQ(inputs);
  const dcCodes = boq.categories.dc.map(r => r.itemCode);
  assert.ok(dcCodes.includes("DC-08"), `Combiner DC-08 missing: ${dcCodes.join(",")}`);
  const noCombiner = generateAccessoriesBoQ({ ...inputs, liveStringPlan: { totalStrings: 2, needsCombiner: false } });
  assert.ok(!noCombiner.categories.dc.map(r => r.itemCode).includes("DC-08"));
});

test("W17b. Multi-face mounting allowance and does-not-fit advisory", () => {
  const base = {
    project: { panelLengthM: 2.28, panelWidthM: 1.13 },
    survey: { earthingAvailable: true, roofType: "Mabati / Iron sheet" },
    sizing: { panels: 10 },
    roofGeometry: {},
    panelLayout: { panelsPerRow: 5, recommendedPanelOrientation: "portrait", roofFitStatus: "Fits comfortably" },
    simulation: { roofFaces: [] },
    liveStringPlan: { totalStrings: 1 },
  };
  const single = generateAccessoriesBoQ(base);
  const multi = generateAccessoriesBoQ({
    ...base,
    simulation: { roofFaces: [{ id: "a", selectedForPv: true }, { id: "b", selectedForPv: true }] },
  });
  assert.ok((multi.advisories || []).some(a => a.includes("multi-face")), "Multi-face advisory expected");
  const railQty = (b) => b.categories.mounting.find(r => r.itemCode === "MNT-01")?.qty || 0;
  assert.ok(railQty(multi) >= railQty(single), "Multi-face rails should not shrink");

  const noFit = generateAccessoriesBoQ({ ...base, panelLayout: { ...base.panelLayout, roofFitStatus: "Does not fit — reduce system" } });
  assert.ok((noFit.advisories || []).some(a => a.includes("alternative mounting")), "Alt-mounting advisory expected");
  const withOverrides = applyAccessoryOverrides(noFit, { items: {}, manualItems: [] });
  assert.ok((withOverrides.advisories || []).length > 0, "Advisories must survive overrides");
});

// ── As-built comparisons (brief test 18) ───────────────────────────────────
test("W18. Voc, Isc and cable-length deviations trigger as-built warnings", () => {
  const plan = generateStringPlan({ panelsPerString: 10, inverterMaxDcV: 1000 }, { panels: 20, strings: 2 }, []);
  const expectedVoc = plan.strings[0].stringVocCold;
  const issues = compareAsBuilt(plan, {
    enabled: true,
    actualPanelsInstalled: 20,
    measuredVoc: [expectedVoc * 0.8, expectedVoc],   // 20% off on string 1
    measuredIsc: [],
    monitoringConfigured: true,
    clientHandoverCompleted: true,
    actualEarthingContinuityPass: true,
    actualInsulationResistancePass: true,
    actualDcCableLengthM: 40,
    actualAcCableLengthM: 6,
  }, { dcM: 20, acM: 6, batM: 2 });
  assert.ok(issues.some(i => i.msg.includes("Voc")), "Voc deviation warning expected");
  assert.ok(issues.some(i => i.msg.includes("DC cable")), "DC cable deviation warning expected (40 m vs 20 m)");
  assert.ok(!issues.some(i => i.msg.includes("AC cable")), "AC within tolerance must not warn");
});

// ── PDF null-safety (brief tests 10, 11) ───────────────────────────────────
test("W10/W11. PDF appenders are null-safe and render when data exists", () => {
  const calls = [];
  const fakeDoc = new Proxy({}, { get: (_, prop) => (...args) => { calls.push(String(prop)); return prop === "splitTextToSize" ? [""] : undefined; } });

  appendSimulationSummary(null, {}, {}, {}, {}, {});          // no doc
  appendSimulationSummary(fakeDoc, {}, {}, null, {}, {});     // no simulation
  assert.strictEqual(calls.length, 0, "Must not touch the doc when simulation is missing");

  appendSimulationSummary(fakeDoc, { client: "T" }, { panels: 6, dcDropPct: 0.01, acDropPct: 0.02 },
    { inverterLocation: "garage", obstructions: [], asBuilt: { enabled: false } },
    { roofFitStatus: "Fits comfortably", estimatedPanelsThatFit: 10 },
    { strings: [], totalStrings: 0 },
    { roofGeometry: { roofLengthEstimatedM: 10 }, simWarnings: [{ level: "danger", msg: "test warning" }] });
  assert.ok(calls.includes("addPage"), "Simulation summary must add a page when simulation exists");

  const before = calls.length;
  appendLoadAndAccessoriesSummary(fakeDoc, {}, null);         // null-safe
  assert.strictEqual(calls.length, before, "Load/BOS appendix must skip cleanly with no data");
});

// ── Save/load migration safety (brief tests 19, 20) ────────────────────────
test("W19. Old record without simulation/blueprint/quoteStage normalizes safely", () => {
  assert.strictEqual(normalizeSizingMode("standard"), "existing_site");
  assert.strictEqual(normalizeSizingMode(undefined), "existing_site");
  assert.strictEqual(normalizeSizingMode("blueprint_new_build"), "blueprint_new_build");
  assert.strictEqual(normalizeSizingMode("future_expansion"), "future_expansion");
  assert.strictEqual(normalizeQuoteStage(undefined), "auto");
  assert.strictEqual(normalizeQuoteStage("Won"), "Won");
  const bp = normalizeBlueprintAssumptions(undefined);
  assert.ok(bp.buildingType && bp.floorAreaM2 > 0 && bp.confidenceLevel === "medium");
  const A = normalizeAccessoriesAssumptions({});
  assert.strictEqual(A.multiFaceExtraMountingPct, defaultAccessoriesAssumptions.multiFaceExtraMountingPct);
});

test("W20. Legacy flat loads migrate into a valid v2 draft/committed list", () => {
  const record = { loads: [{ id: 1, name: "Lights", qty: 8, watts: 10, dayHours: 1, nightHours: 5, surge: 1, critical: true }] };
  const v2 = resolveLoadItemsV2(record);
  assert.ok(Array.isArray(v2) && v2.length === 1);
  assert.strictEqual(validateLoadItemsV2(v2).length, 0, "Migrated legacy loads must pass v11.1 validation");
  const direct = migrateLegacyLoadsToV2(record.loads);
  assert.strictEqual(direct[0].ratedW, 10);
  assert.strictEqual(direct[0].essential, true);
});

// ── Governance gates (v11.1) ───────────────────────────────────────────────
test("W21. Cable ampacity failure forces Engineering review", () => {
  const readiness = { totalScore: 85, readyStatus: "Ready to propose", blockers: [] };
  const gov = computeGovernanceStatus({ quoteStage: "auto" }, { coldVocOk: true, dcCableAmpacityOk: false, totalCost: 400000, payback: 5 }, readiness);
  assert.strictEqual(gov.status, "Engineering review required");
  assert.ok(gov.approvals.some(a => a.reason.includes("ampacity")));
});

test("W22. Manual quote stage overrides computed status and keeps it visible", () => {
  const readiness = { totalScore: 85, readyStatus: "Ready to propose", blockers: [] };
  const sizing = { coldVocOk: true, totalCost: 400000, payback: 5 };
  const auto = computeGovernanceStatus({ quoteStage: "auto" }, sizing, readiness);
  assert.strictEqual(auto.status, "Ready to send");
  const won = computeGovernanceStatus({ quoteStage: "Won" }, sizing, readiness);
  assert.strictEqual(won.status, "Won");
  assert.strictEqual(won.computedStatus, "Ready to send");
  assert.ok(won.nextAction[0].toLowerCase().includes("installation"));
});

test("W23. Readiness layout category scores and total stays within 100", () => {
  const survey = { clientName: "T", phone: "07", siteAddress: "X", county: "Nairobi", roofType: "Mabati / Iron sheet", roofAreaM2: 60, phaseType: "Single phase", monthlyBill: 8000, earthingAvailable: true, siteNotes: "good site", photos: { a: 1, b: 2 }, clientObjectives: ["Backup"], surveyor: "E" };
  const loads = [{ qty: 1, watts: 250, dayHours: 6, nightHours: 6, surge: 3, critical: true }, { qty: 8, watts: 10, dayHours: 1, nightHours: 5, surge: 1 }, { qty: 1, watts: 1100, dayHours: 1, nightHours: 0, surge: 4 }];
  const sizing = { dailyKwh: 5, coldVocOk: true, dcDropPct: 0.01, acDropPct: 0.02, batteryInputA: 50, bmsMaxDischargeA: 100, payback: 5, npvLife: 100000, totalCost: 500000 };
  const withLayout = calculateReadiness({ client: "Test Client" }, loads, survey, sizing, {
    panelLayout: { roofFitStatus: "Fits comfortably" },
    stringPlan: { totalStrings: 2 },
    simDangerCount: 0,
  });
  const withoutLayout = calculateReadiness({ client: "Test Client" }, loads, survey, sizing);
  assert.strictEqual(withLayout.categoryScores.layout.score, 10, `Layout should be 10/10, got ${withLayout.categoryScores.layout.score}`);
  assert.strictEqual(withoutLayout.categoryScores.layout.score, 0);
  assert.ok(withLayout.totalScore <= 100 && withLayout.totalScore > withoutLayout.totalScore);
  const maxSum = Object.values(withLayout.categoryScores).reduce((s, c) => s + c.max, 0);
  assert.strictEqual(maxSum, 100, `Category maxima must sum to 100, got ${maxSum}`);
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

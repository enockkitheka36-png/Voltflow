import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { openSizingAuditRuntime } from "./lib/sizingAuditRuntime.mjs";
import { TARIFF_NUMBER_FIELDS, tariffToday, createTariffDraft, normalizeTariffState, isOfficialTariffSource, calculateTariffBill, assessTariffDraft, createReviewedTariff, evaluateProjectTariff, gateTariffSizing, assertTariffForExport } from "../src/utils/electricityTariff.js";
import { computeOptionSizing, createDesignRevision } from "../src/utils/designRevision.js";
import { reconcileBillAndLoads, billLoadClientMessage } from "../src/utils/billLoadReconciliation.js";
import { projectSnapshotForAudience } from "../src/platform/audienceProjection.js";
import { buildReport, reportToText } from "../src/utils/reportBuilder.js";
import { buildQuotationPDF } from "../src/utils/pdfGenerator.js";
import { migrateLegacyLoadsToV2 } from "../src/utils/schemaMigration.js";
import { calculateReadiness } from "../src/utils/readiness.js";
import { buildProjectReadiness } from "../src/utils/readinessEngine.js";

const asOf = new Date();
const today = tariffToday(asOf);
const month = today.slice(0, 7);
const draft = {
  ...createTariffDraft(), billingMonth: month, validFromMonth: month, validThroughMonth: month,
  category: "Small commercial", consumptionKwh: 100, actualBillKes: 1850,
  baseRate: 10, fuelRate: 2, forexRate: 1, inflationRate: 0.5, waterRate: 0.1, regulatorRate: 0.08,
  ruralLevyPct: 5, vatPct: 16, fixedCharge: 100, demandRate: 20, demandKva: 5,
  vatBase: ["energy", "fuel", "forex", "inflation", "demand"],
  sources: { tariff: "https://www.epra.go.ke/electricity-tariff-overview", adjustments: "https://www.kplc.co.ke/faq/tariff", taxes: "https://www.kra.go.ke/" },
  sourceReference: "SYNTHETIC arithmetic fixture; not a live tariff", reviewer: "SYNTHETIC QA reviewer", checkedOn: today, assumptionsAccepted: true,
};
const results = [];
async function check(label, action) {
  try { await action(); results.push({ label, status: "PASS" }); console.log(`PASS: ${label}`); }
  catch (error) { results.push({ label, status: "FAIL", error: error.message }); console.error(`FAIL: ${label}: ${error.stack}`); }
}
const snapshot = await createReviewedTariff(draft, { asOf });
const project = { systemType: "Solar PV – Hybrid", quoteCurrency: "KES", monthlyBill: 1850, selfConsumptionRate: 1, electricityTariff: { enabled: true, draft, applied: snapshot } };
const evaluate = (patch = {}, options = {}) => evaluateProjectTariff({ ...project, ...patch }, { annualEnergy: 600, annualLoadKwh: 1200, asOf, ...options });

await check("Independent hand arithmetic: before 1850, after 1033; fixed and demand unchanged", () => {
  const before = calculateTariffBill(draft);
  const after = calculateTariffBill(draft, 50);
  assert.equal(before.total, 1850); assert.equal(before.taxableBase, 1450);
  assert.equal(after.total, 1033); assert.equal(after.taxableBase, 775);
  assert.equal(calculateTariffBill(draft, 0).total, 216);
  for (const key of ["fixed", "demand"]) assert.equal(before.lines.find((line) => line.key === key).amount, after.lines.find((line) => line.key === key).amount);
});
await check("Explicit zeros, zero VAT, signed rebates and selective tax bases", () => {
  assert.equal(calculateTariffBill({ ...draft, vatPct: 0, vatBase: [] }).total, 1618);
  assert.equal(calculateTariffBill({ ...draft, vatBase: ["energy"] }).total, 1778);
  assert.equal(calculateTariffBill({ ...draft, fuelRate: -1 }).total, 1502);
  assert.equal(calculateTariffBill({ ...draft, fuelRate: -100 }).ready, false);
});
await check("Every numerical component is explicit; malformed numbers never become free charges", () => {
  for (const key of TARIFF_NUMBER_FIELDS.filter((field) => field !== "actualBillKes")) {
    for (const value of ["", " ", null, undefined, false, [], "bad", NaN, Infinity, 1e20]) assert.equal(calculateTariffBill({ ...draft, [key]: value }).ready, false, `${key}: ${String(value)}`);
  }
  for (const value of [-1, NaN, Infinity, 1e20]) assert.equal(calculateTariffBill(draft, value).ready, false);
  for (const patch of [{ baseRate: -1 }, { vatPct: 101 }, { ruralLevyPct: 101 }, { demandKva: 0 }, { vatBase: [] }, { vatBase: ["energy", "energy"] }, { vatBase: ["unknown"] }, { rateMode: "TOU" }, { rateMode: "BLOCK" }]) assert.equal(calculateTariffBill({ ...draft, ...patch }).ready, false);
  assert.equal(calculateTariffBill({ ...draft, baseRate: 1e9, consumptionKwh: 1e9 }).ready, false);
});
await check("Only public official HTTPS sources pass; no private tokens or lookalike domains", () => {
  for (const value of ["https://epra.go.ke/a", "https://new.kenyalaw.org/a", "https://www.kplc.co.ke/a", "https://kra.go.ke/a"]) assert.equal(isOfficialTariffSource(value), true);
  for (const value of ["http://epra.go.ke", "https://epra.go.ke.evil.test", "https://evil-epra.go.ke", "https://user:secret@epra.go.ke", "https://epra.go.ke/?token=x", "https://epra.go.ke/#private", "javascript:alert(1)", "https://stimatracker.com/"]) assert.equal(isOfficialTariffSource(value), false);
});
await check("Review requires exact bill reconciliation, sources, dates, category and attestation", () => {
  assert.equal(assessTariffDraft(draft, { asOf }).canApply, true);
  for (const value of [1849, 1851]) assert.equal(assessTariffDraft({ ...draft, actualBillKes: value }, { asOf }).canApply, true);
  for (const patch of [{ actualBillKes: 1851.01 }, { actualBillKes: "" }, { reviewer: "" }, { sourceReference: "" }, { assumptionsAccepted: false }, { category: "guessed" }, { checkedOn: "2026-99-99" }, { checkedOn: "2099-01-01" }, { checkedOn: "2000-01-01" }, { billingMonth: "2000-01" }, { billingMonth: "2099-01" }, { validFromMonth: "2099-01" }, { consumptionKwh: 0 }, { sources: {} }]) assert.equal(assessTariffDraft({ ...draft, ...patch }, { asOf }).canApply, false, JSON.stringify(patch));
  assert.equal(calculateTariffBill({ ...draft, billingMonth: "2000-01" }).ready, true);
  assert.equal(tariffToday("2026-10-31T21:05:00Z"), "2026-11-01");
});
await check("Reviewed snapshots are deterministic for identical inputs and cannot bypass assessment", async () => {
  const repeated = await createReviewedTariff(JSON.parse(JSON.stringify(draft)), { asOf });
  assert.equal(repeated.id, snapshot.id);
  await assert.rejects(() => createReviewedTariff({ ...draft, assumptionsAccepted: false }, { asOf }));
  const changed = await createReviewedTariff({ ...draft, reviewer: "Another synthetic reviewer" }, { asOf });
  assert.notEqual(changed.id, snapshot.id);
});
await check("Avoided-cost annualisation is capped to generation, captured loads and recorded imports", () => {
  assert.equal(evaluate().annualSavings, 9804);
  assert.equal(evaluate().monthlySavings, 817);
  assert.equal(evaluate({}, { annualEnergy: 0 }).annualSavings, 0);
  assert.equal(evaluate({}, { annualLoadKwh: 0 }).annualSavings, 0);
  assert.equal(evaluate({}, { annualEnergy: 1e6, annualLoadKwh: 1e6 }).after.total, 216);
  assert.equal(evaluate({ selfConsumptionRate: 0 }).annualSavings, 0);
  assert.equal(evaluate({ selfConsumptionRate: 0.5 }, { annualEnergy: 1200 }).annualSavings, 9804);
});
await check("Invalid applied models hold savings and quotation instead of silently reverting to flat rates", () => {
  const mutated = structuredClone(snapshot); mutated.inputs.baseRate = 20;
  for (const patch of [{ systemType: "Off-grid" }, { quoteCurrency: "USD" }, { selfConsumptionRate: 2 }, { monthlyBill: 999 }, { electricityTariff: { enabled: true } }, { electricityTariff: { enabled: true, applied: mutated } }]) {
    const result = evaluate(patch); assert.equal(result.ready, false); assert.equal(result.annualSavings, 0);
    assert.equal(gateTariffSizing({ quoteReady: true }, result).quoteReady, false);
  }
  assert.equal(evaluate({}, { asOf: "2027-02-01" }).ready, false);
  assert.equal(evaluate({}, { annualEnergy: NaN }).ready, false);
  assert.equal(evaluate({ electricityTariff: null }).enabled, false);
  assert.equal(normalizeTariffState(null).enabled, false);
  const editedDraft = { ...draft, baseRate: 999, assumptionsAccepted: false };
  assert.equal(evaluate({ electricityTariff: { ...project.electricityTariff, draft: editedDraft } }).annualSavings, 9804);
});
await check("Recorded bill kWh replaces monetary division without hiding load mismatches", () => {
  const reconciled = reconcileBillAndLoads({ monthlyBillKes: 1850, tariffKesPerKwh: 999, itemizedDailyKwh: 100 / 31, billingDays: 31, measuredMonthlyKwh: 100, nonEnergyChargesKnown: false });
  assert.equal(reconciled.status, "matched"); assert.equal(reconciled.billImpliedMonthlyKwh, 100);
  assert.equal(reconciled.energyChargeKes, null); assert.match(billLoadClientMessage(reconciled), /recorded bill consumption/);
  assert.equal(reconcileBillAndLoads({ ...reconciled, itemizedDailyKwh: 0.1, measuredMonthlyKwh: 100 }).status, "under_captured");
});

const runtime = await openSizingAuditRuntime();
try {
  const loads = [{ id: "synthetic-tariff", name: "SYNTHETIC test load", qty: 1, watts: 500, dayHours: 6, nightHours: 0, surge: 1, critical: true }];
  const base = { ...runtime.defaults, ...project, client: "SYNTHETIC tariff QA — not a real bill", projectRef: "SYNTHETIC-TARIFF", phase: "Single phase", isDemo: true };
  const sizing = runtime.size(base, loads);
  await check("Shared readiness and Action Center cannot call an invalid applied tariff proposal-ready", () => {
    const invalid = { ...base, monthlyBill: 999 };
    const blocked = runtime.size(invalid, loads);
    assert.ok(calculateReadiness(invalid, loads, {}, blocked).blockers.some((message) => /tariff requires review/.test(message)));
    const readiness = buildProjectReadiness(invalid, loads, [], {}, blocked);
    assert.equal(readiness.readyForProposal, false);
    assert.ok(readiness.criticalIssues.some((issue) => issue.actionTab === "finance"));
    assert.equal(readiness.sections.electricityTariff.critical, true);
  });
  await check("Main sizing and option engine agree on the tariff-derived avoided cost", () => {
    const option = computeOptionSizing(base, loads);
    assert.equal(sizing.quoteReady, true, sizing.quoteBlockedReason);
    assert.equal(sizing.tariffModel.ready, true);
    assert.equal(sizing.annualSavings, sizing.tariffModel.annualSavings);
    const expected = evaluateProjectTariff(base, { annualEnergy: sizing.annualEnergy, annualLoadKwh: sizing.dailyKwh * 365 });
    assert.equal(sizing.annualSavings, expected.annualSavings);
    assert.equal(option.annualSavings, sizing.annualSavings);
    assert.equal(sizing.annualSavingsP90, sizing.annualSavings * base.p90Factor);
    assert.equal(sizing.monthlySavings, sizing.annualSavings / 12);
  });
  await check("Applied snapshot survives save/load; draft edits do not invalidate selected design", async () => {
    const restored = runtime.normalizeRecord(JSON.parse(JSON.stringify({ project: base, loads, loadItemsV2: migrateLegacyLoadsToV2(loads) })));
    assert.equal(restored.project.electricityTariff.applied.id, snapshot.id);
    assert.equal(runtime.size(restored.project, loads).annualSavings, sizing.annualSavings);
    const original = await createDesignRevision({ project: base, loads });
    const drafted = await createDesignRevision({ project: { ...base, electricityTariff: { ...base.electricityTariff, draft: { ...draft, baseRate: 999 } } }, loads });
    assert.equal(original.inputs_hash, drafted.inputs_hash);
    const disabled = await createDesignRevision({ project: { ...base, electricityTariff: { ...base.electricityTariff, enabled: false } }, loads });
    assert.notEqual(original.inputs_hash, disabled.inputs_hash);
  });
  await check("Legacy flat-rate projects keep the same results when tariff mode is disabled", () => {
    const legacy = runtime.size({ ...base, electricityTariff: null }, loads);
    const disabled = runtime.size({ ...base, electricityTariff: { ...base.electricityTariff, enabled: false } }, loads);
    for (const key of ["annualSavings", "payback", "totalCost", "actualKwp"]) assert.equal(legacy[key], disabled[key]);
  });
  await check("Audience projection exposes calculation provenance, not reviewer, draft or private links", () => {
    const output = projectSnapshotForAudience({ project: base, sizing: { ...sizing, tariffSummary: { ...sizing.tariffSummary, reviewer: "PRIVATE REVIEWER", sources: { ...draft.sources, taxes: "https://kra.go.ke/?private=x" } } } }, "client");
    const serialized = JSON.stringify(output);
    assert.ok(serialized.includes(snapshot.id)); assert.ok(!serialized.includes("PRIVATE REVIEWER")); assert.ok(!serialized.includes("private=x")); assert.ok(!serialized.includes("sourceReference")); assert.ok(!serialized.includes("electricityTariff"));
  });
  await check("Commercial exports retain tariff provenance and reject invalid or stale applied models", async () => {
    const report = reportToText(buildReport("client", { project: base, sizing }));
    for (const phrase of [snapshot.id, month, "Reference bill / after solar", "no export credit"]) assert.ok(report.includes(phrase), phrase);
    const pdf = buildQuotationPDF(base, sizing, loads);
    assert.ok(pdf.output().includes(snapshot.id.slice(-12)));
    await writeFile("qa/tariff-synthetic-quotation.pdf", Buffer.from(pdf.output("arraybuffer")));
    const invalid = { ...base, monthlyBill: 999 };
    for (const mode of ["client", "lender"]) assert.throws(() => buildReport(mode, { project: invalid, sizing }), /Tariff review required/);
    assert.throws(() => buildQuotationPDF(invalid, sizing, loads), /Tariff review required/);
    assert.throws(() => assertTariffForExport(invalid, sizing), /Tariff review required/);
    assert.throws(() => assertTariffForExport(base, { ...sizing, tariffSummary: null }), /does not match/);
    assert.throws(() => assertTariffForExport(base, { ...sizing, annualSavings: sizing.annualSavings + 100 }), /does not match/);
    assert.ok(reportToText(buildReport("engineer", { project: invalid, sizing: runtime.size(invalid, loads) })).includes("ELECTRICITY-COST MODEL ON HOLD"));
  });
  const fixture = runtime.normalizeRecord({ project: { ...base, electricityTariff: { enabled: false, draft, applied: null } }, loads, loadItemsV2: migrateLegacyLoadsToV2(loads) });
  await writeFile("qa/tariff-synthetic-fixture.json", JSON.stringify(fixture, null, 2));
} finally { await runtime.close(); }
await writeFile("qa/tariff-results.json", JSON.stringify({ scope: "Synthetic software regression only; fixture rates are deliberately invented, not a live tariff or utility validation", results }, null, 2));
console.log(`\n${results.length} grouped tariff checks; ${results.filter((result) => result.status === "FAIL").length} failing.`);
process.exitCode = results.some((result) => result.status === "FAIL") ? 1 : 0;

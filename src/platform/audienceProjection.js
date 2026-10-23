import { billLoadClientMessage } from "../utils/billLoadReconciliation.js";
import { isOfficialTariffSource } from "../utils/electricityTariff.js";

const pick = (source, keys) => keys.reduce((out, key) => {
  if (source && source[key] !== undefined) out[key] = source[key];
  return out;
}, {});

const PROJECT_PUBLIC_FIELDS = [
  "client", "location", "county", "siteType", "systemType", "phase",
  "designStage", "objective", "monthlyBill", "preparedBy",
];
const SURVEY_PUBLIC_FIELDS = [
  "clientName", "siteAddress", "county", "siteType", "phaseType",
];
const SURVEY_FACT_FIELDS = [
  "roofType", "roofAreaM2", "roofCondition", "mainBreakerA", "earthingAvailable",
];
const SURVEY_ASSUMPTION_LABEL = "Assumption - confirm during site survey.";
const SIZING_PUBLIC_FIELDS = [
  "panels", "actualKwp", "batteryKwh", "batteryModules", "inverterKw",
  "annualEnergy", "annualEnergyP90", "autonomyHours", "totalCost",
  "annualSavings", "annualSavingsP90", "monthlySavings", "payback", "lcoe",
];

function publicTariffSummary(summary) {
  if (!summary || typeof summary !== "object") return null;
  return {
    ...Object.fromEntries(["method", "version", "category", "billingMonth", "checkedOn", "status", "assumption"].filter((key) => typeof summary[key] === "string").map((key) => [key, summary[key]])),
    ...Object.fromEntries(["beforeKes", "afterKes", "avoidedMonthlyKwh", "monthlySavings", "annualSavings"].filter((key) => typeof summary[key] === "number" && Number.isFinite(summary[key])).map((key) => [key, summary[key]])),
    sources: Object.fromEntries(["tariff", "adjustments", "taxes"].filter((key) => isOfficialTariffSource(summary.sources?.[key])).map((key) => [key, summary.sources[key]])),
  };
}

function safeDelivery(delivery = {}) {
  return {
    stage: delivery.stage || "lead",
    expectedStartDate: delivery.expectedStartDate || "",
    expectedCompletionDate: delivery.expectedCompletionDate || "",
    tasks: (Array.isArray(delivery.tasks) ? delivery.tasks : []).map((task) => pick(task, [
      "id", "title", "category", "status", "priority", "owner", "dueDate",
    ])),
    checklist: (Array.isArray(delivery.installationChecklist) ? delivery.installationChecklist : []).map((item) => pick(item, [
      "key", "label", "phase", "complete", "owner", "dateCompleted",
    ])),
  };
}

function publicSurvey(survey = {}) {
  const confirmed = new Set(Array.isArray(survey.confirmedFields) ? survey.confirmedFields : []);
  const facts = SURVEY_FACT_FIELDS.reduce((out, key) => {
    if (survey[key] === undefined) return out;
    const isConfirmed = confirmed.has(key) || survey.assumptionStatus?.[key] === "confirmed";
    out[key] = {
      value: survey[key],
      status: isConfirmed ? "confirmed" : "assumption",
      label: isConfirmed ? "Confirmed survey fact" : SURVEY_ASSUMPTION_LABEL,
    };
    return out;
  }, {});
  return { ...pick(survey, SURVEY_PUBLIC_FIELDS), facts };
}

function publicSnapshot(snapshot = {}, audience = "client") {
  const inputs = snapshot.inputs || {};
  const project = inputs.project || snapshot.project || {};
  const survey = inputs.survey || snapshot.survey || {};
  const reconciliation = snapshot.billLoadReconciliation || null;
  return {
    snapshotSchema: snapshot.snapshotSchema || "11.8",
    projectRef: snapshot.projectRef || "",
    versionLabel: snapshot.versionLabel || null,
    issuedAt: snapshot.issuedAt || null,
    audience,
    project: pick(project, PROJECT_PUBLIC_FIELDS),
    survey: publicSurvey(survey),
    sizing: { ...pick(snapshot.sizing || {}, SIZING_PUBLIC_FIELDS), tariffSummary: publicTariffSummary(snapshot.sizing?.tariffSummary) },
    designRevision: pick(snapshot.designRevision || {}, ["revision_id", "inputs_hash", "calculation_version"]),
    quote: snapshot.quote ? pick(snapshot.quote, ["currency", "category_totals", "discount", "subtotal_net", "tax", "total_gross", "tax_breakdown", "tax_rule_version"]) : null,
    financials: pick(snapshot.financials || {}, ["totalInvestment", "annualSavings", "paybackYears", "lcoeKesPerKwh"]),
    boq: snapshot.boq?.headline ? { headline: snapshot.boq.headline } : null,
    evidenceStatus: pick(snapshot.evidenceStatus || {}, ["status", "verifiedCount", "requiredCount", "missingCount"]),
    reportMetadata: pick(snapshot.reportMetadata || {}, ["reportType", "generatedAt", "methodologyVersion", "disclaimer"]),
    billLoadReconciliation: reconciliation ? {
      status: reconciliation.status,
      mismatchResolved: reconciliation.mismatchResolved,
      capturedLoadCoveragePct: reconciliation.capturedLoadCoveragePct,
      savingsPctOfBill: reconciliation.savingsPctOfBill,
      message: billLoadClientMessage(reconciliation),
    } : null,
  };
}

function technicianSnapshot(snapshot = {}) {
  const inputs = snapshot.inputs || {};
  const project = inputs.project || snapshot.project || {};
  return {
    snapshotSchema: snapshot.snapshotSchema || "11.8",
    projectRef: snapshot.projectRef || "",
    audience: "technician",
    project: pick(project, ["client", "location", "county", "siteType", "systemType", "phase"]),
    survey: pick(inputs.survey || snapshot.survey || {}, [
      "siteAddress", "county", "roofType", "roofAreaM2", "roofCondition",
      "mainBreakerA", "earthingAvailable", "siteNotes", "photos",
      "assumptionStatus", "confirmedFields",
    ]),
    loads: Array.isArray(inputs.loadItemsV2) ? inputs.loadItemsV2.map((load) => pick(load, [
      "id", "name", "category", "qty", "ratedW", "phase", "dayHours",
      "nightHours", "supply_scope", "criticality", "exclusion_reason",
    ])) : [],
    delivery: safeDelivery(project.delivery),
    evidenceStatus: pick(snapshot.evidenceStatus || {}, ["status", "verifiedCount", "requiredCount", "missingCount"]),
  };
}

export function projectSnapshotForAudience(snapshot, audience = "client") {
  if (["manager", "engineer", "sales"].includes(audience)) return structuredClone(snapshot);
  if (audience === "technician") return technicianSnapshot(snapshot);
  return publicSnapshot(snapshot, audience === "bank" ? "bank" : "client");
}

export function containsCommercialInternals(value) {
  const text = JSON.stringify(value || {}).toLowerCase();
  return [
    "suppliercost", "supplier_cost", "internalcost", "internal_cost",
    "marginpct", "margin_pct", "markuppct", "markup_pct", "costbreakdown",
    "cost_breakdown", "bosbreakdown", "bos_breakdown",
  ].some((marker) => text.includes(marker));
}

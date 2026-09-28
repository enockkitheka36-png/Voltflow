import { canonicalize, hashCanonicalJson } from "./canonicalJson.js";
import { projectSnapshotForAudience } from "./audienceProjection.js";

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

export function buildProjectVersionSnapshot(input = {}) {
  const record = input.record || {};
  const project = record.project || {};
  const sizing = input.sizing || {};
  const generatedAt = input.generatedAt || new Date().toISOString();
  return canonicalize({
    snapshotSchema: "11.8",
    schemaVersion: record.schemaVersion || "11.7",
    appVersion: record.appVersion || "Voltflow 11.7.2b",
    calculationVersion: input.calculationVersion || project.designRevision?.calculation_version || record.appVersion || "Voltflow 11.7.2b",
    projectRef: record.projectRef || project.projectRef || "",
    versionLabel: input.versionLabel || null,
    lifecycle: input.lifecycle || "prepared",
    preparedAt: generatedAt,
    issuedAt: input.lifecycle === "issued" ? generatedAt : null,
    inputs: {
      project,
      survey: record.survey || {},
      simulation: record.simulation || {},
      loadAssessmentMode: record.loadAssessmentMode || "Residential",
      loadItemsV2: Array.isArray(record.loadItemsV2) ? record.loadItemsV2 : [],
      accessoriesAssumptions: record.accessoriesAssumptions || {},
      accessoryOverrides: record.accessoryOverrides || {},
      accessoriesCatalogue: Array.isArray(record.accessoriesCatalogue) ? record.accessoriesCatalogue : [],
    },
    assumptions: input.assumptions || {
      billSource: project.billSource || "client_estimate",
      loadSource: project.loadSource || "estimated",
      pricingSource: project.pricingSource || "default",
      sizingMode: project.sizingMode || "existing_site",
    },
    sizing,
    designRevision: input.designRevision || project.designRevision || null,
    quote: input.quote || sizing.quote || null,
    financials: input.financials || {
      totalInvestment: finite(sizing.totalCost),
      annualSavings: finite(sizing.annualSavings),
      paybackYears: finite(sizing.payback),
      lcoeKesPerKwh: finite(sizing.lcoe),
      carbonRevenueIncluded: !!project.carbonInCashflow,
      debtSelected: finite(project.debtShare) > 0,
    },
    boq: input.boq || null,
    evidenceStatus: input.evidenceStatus || project.evidence || null,
    reportMetadata: input.reportMetadata || null,
    billLoadReconciliation: input.billLoadReconciliation || null,
    provenance: {
      source: input.source || "web",
      preparedByUserId: input.preparedByUserId || null,
      legacyRecordId: input.legacyRecordId || null,
      legacySavedAt: input.legacySavedAt || null,
    },
  });
}

export async function createProjectVersionEnvelope(input = {}) {
  const snapshot = buildProjectVersionSnapshot(input);
  return {
    snapshot,
    snapshotHash: await hashCanonicalJson(snapshot),
    publicSnapshot: projectSnapshotForAudience(snapshot, input.publicAudience || "client"),
    bankSnapshot: projectSnapshotForAudience(snapshot, "bank"),
    fieldSnapshot: projectSnapshotForAudience(snapshot, "technician"),
  };
}

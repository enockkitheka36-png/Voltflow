/**
 * assistantContext.js — Voltflow 11.4
 *
 * Builds the STRICTLY LIMITED project context sent to the AI assistant.
 *
 * Safety rules (Phase 8):
 *  - Whitelist only. Nothing is copied wholesale from app state.
 *  - Never include: saved-project lists, feedback records, raw localStorage,
 *    survey photos, phone numbers, meter numbers, GPS coordinates, or any
 *    other personal/contact data beyond the client display name.
 *  - Pure function — no React, no DOM, no network. Unit-testable.
 */

export const ASSISTANT_CONTEXT_FIELDS = [
  "clientName", "location", "systemType",
  "dailyKwh", "pvKwp", "panelCount", "batteryKwh", "inverterKw",
  "totalCost", "paybackYears",
  "warnings", "readinessStatus", "readinessScore",
  "loadSource", "roofFitStatus", "energyDataQualityScore", "proposalStatus",
  "sizingMode", "loadCount",
];

const numOrNull = (v) => (Number.isFinite(Number(v)) ? +Number(v).toFixed(2) : null);
const strOrNull = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * buildAssistantContext(project, loads, survey, sizing, readiness, simulation, energyImportSummary)
 * → flat object containing ONLY the whitelisted fields above.
 */
export function buildAssistantContext(
  project = {}, loads = [], survey = {}, sizing = {},
  readiness = null, simulation = {}, energyImportSummary = null
) {
  // Warnings: cap length and count so a runaway list can't bloat the prompt.
  const sizingWarnings = Array.isArray(sizing.warnings) ? sizing.warnings : [];
  const readinessBlockers = Array.isArray(readiness?.blockers) ? readiness.blockers : [];
  const warnings = [...sizingWarnings, ...readinessBlockers]
    .filter((w) => typeof w === "string")
    .slice(0, 12)
    .map((w) => (w.length > 240 ? `${w.slice(0, 237)}…` : w));

  const payback = sizing.payback;

  return {
    clientName: strOrNull(project.client),
    location: strOrNull(project.location),
    systemType: strOrNull(project.systemType),

    dailyKwh: numOrNull(sizing.dailyKwh),
    pvKwp: numOrNull(sizing.actualKwp),
    panelCount: Number.isFinite(Number(sizing.panels)) ? Math.round(Number(sizing.panels)) : null,
    batteryKwh: numOrNull(sizing.batteryKwh),
    inverterKw: numOrNull(sizing.inverterKw),

    totalCost: numOrNull(sizing.totalCost),
    paybackYears: Number.isFinite(Number(payback)) ? +Number(payback).toFixed(1) : null,

    warnings,
    readinessStatus: strOrNull(readiness?.readyStatus),
    readinessScore: Number.isFinite(Number(readiness?.totalScore)) ? Math.round(Number(readiness.totalScore)) : null,

    loadSource: strOrNull(project.loadSource) || "client_estimate",
    loadCount: Array.isArray(loads) ? loads.length : 0,
    sizingMode: strOrNull(project.sizingMode) || "existing_site",

    roofFitStatus: strOrNull(simulation?.roofFitStatus) || strOrNull(simulation?.panelLayout?.roofFitStatus),
    energyDataQualityScore: Number.isFinite(Number(energyImportSummary?.dataQualityScore))
      ? Math.round(Number(energyImportSummary.dataQualityScore))
      : null,
    proposalStatus: strOrNull(project.quoteStage) && project.quoteStage !== "auto"
      ? project.quoteStage
      : strOrNull(readiness?.readyStatus) || null,
  };
}

/** Advisory notice shown alongside every assistant response. */
export const ASSISTANT_DISCLAIMER =
  "AI assistant responses are advisory and may be wrong. Verify technical and commercial decisions before use.";

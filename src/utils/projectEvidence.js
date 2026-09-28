/**
 * projectEvidence.js — Voltflow 11.7 (canonical project evidence record + pilot KPIs)
 *
 * A cloud-ready evidence record: who is responsible, how confident, what version,
 * approval status, what changed, and which report version was generated. Plus a
 * pilot-evidence model for measurable market-testing outcomes. Pure — no cloud yet,
 * but the shape is designed to sync later.
 */

export const APPROVAL_STATUSES = ["draft", "in_review", "engineer_reviewed", "client_approved"];
export const CONFIDENCE_LEVELS = ["estimated", "surveyed", "measured", "verified"];
export const INPUT_SOURCES = ["manual", "onboarding", "demo", "import", "energy_data", "borehole"];

export function createDefaultEvidence() {
  return {
    inputSource: "manual",
    createdAt: null,
    updatedAt: null,
    responsibleUser: "",
    confidenceLevel: "estimated",
    version: 1,
    approvalStatus: "draft",
    changedFields: [],          // last change set
    reportFromVersion: null,    // version the last report was generated from
    history: [],                // [{version, at, user, changedFields}]
  };
}

export function normalizeEvidence(e) {
  const def = createDefaultEvidence();
  if (!e || typeof e !== "object") return def;
  return {
    ...def,
    ...e,
    approvalStatus: APPROVAL_STATUSES.includes(e.approvalStatus) ? e.approvalStatus : "draft",
    confidenceLevel: CONFIDENCE_LEVELS.includes(e.confidenceLevel) ? e.confidenceLevel : "estimated",
    inputSource: INPUT_SOURCES.includes(e.inputSource) ? e.inputSource : "manual",
    version: Number.isFinite(Number(e.version)) ? Number(e.version) : 1,
    changedFields: Array.isArray(e.changedFields) ? e.changedFields : [],
    history: Array.isArray(e.history) ? e.history.slice(-50) : [],
  };
}

/** Pure — bump the record for a change set. Returns a new evidence object. */
export function recordEvidenceChange(evidence, { changedFields = [], user, source } = {}) {
  const e = normalizeEvidence(evidence);
  const now = new Date().toISOString();
  const version = e.version + 1;
  const entry = { version, at: now, user: user || e.responsibleUser || "", changedFields };
  return {
    ...e,
    version,
    updatedAt: now,
    createdAt: e.createdAt || now,
    responsibleUser: user || e.responsibleUser,
    inputSource: source || e.inputSource,
    changedFields,
    history: [...e.history, entry].slice(-50),
  };
}

/** Pure — stamp the version a report was generated from. */
export function markReportGenerated(evidence) {
  const e = normalizeEvidence(evidence);
  return { ...e, reportFromVersion: e.version };
}

// ── Pilot evidence (measurable market-testing KPIs) ──────────────────────────

export function createDefaultPilotEvidence() {
  return {
    surveyToDesignMinutes: null,
    proposalPrepMinutes: null,
    errorsPrevented: 0,
    actualVsModelledPct: null,   // placeholder — needs monitoring
    uptimePct: null,             // placeholder — needs monitoring
    maintenanceResponseHours: null, // placeholder
    savingsKes: null,
    avoidedFuelKes: null,
    outcomeNotes: "",
  };
}

export function normalizePilotEvidence(p) {
  const def = createDefaultPilotEvidence();
  if (!p || typeof p !== "object") return def;
  const numOrNull = (v) => (v === null || v === undefined || v === "" ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
  return {
    surveyToDesignMinutes: numOrNull(p.surveyToDesignMinutes),
    proposalPrepMinutes: numOrNull(p.proposalPrepMinutes),
    errorsPrevented: Number.isFinite(Number(p.errorsPrevented)) ? Number(p.errorsPrevented) : 0,
    actualVsModelledPct: numOrNull(p.actualVsModelledPct),
    uptimePct: numOrNull(p.uptimePct),
    maintenanceResponseHours: numOrNull(p.maintenanceResponseHours),
    savingsKes: numOrNull(p.savingsKes),
    avoidedFuelKes: numOrNull(p.avoidedFuelKes),
    outcomeNotes: typeof p.outcomeNotes === "string" ? p.outcomeNotes : "",
  };
}

/**
 * proposalStudio.js — Voltflow 11.7 (Studio: Proposal Studio)
 *
 * Lets users choose/reorder proposal sections and pick an audience mode. Pure —
 * this sprint stores the CONFIG in project state (persisted). The existing report
 * builder / PDF path is not rewritten; the config is an export-ready data structure
 * that report generation can honour.
 */

// The 17 composable sections (id + label + whether it's client-safe by default).
export const PROPOSAL_SECTIONS = [
  { id: "cover", label: "Cover page", defaultOn: true },
  { id: "clientProblem", label: "Client problem", defaultOn: true },
  { id: "recommendedSolution", label: "Recommended solution", defaultOn: true },
  { id: "systemSummary", label: "System summary", defaultOn: true },
  { id: "benefits", label: "Benefits", defaultOn: true },
  { id: "savings", label: "Savings", defaultOn: true },
  { id: "backupExpectation", label: "Backup expectation", defaultOn: true },
  { id: "boreholeWater", label: "Borehole water output", defaultOn: true },
  { id: "boqSummary", label: "BoQ summary", defaultOn: true },
  { id: "assumptions", label: "Assumptions", defaultOn: true },
  { id: "exclusions", label: "Exclusions", defaultOn: true },
  { id: "warnings", label: "Warnings", defaultOn: true },
  { id: "warranty", label: "Warranty", defaultOn: true },
  { id: "nextSteps", label: "Next steps", defaultOn: true },
  { id: "paymentTerms", label: "Payment terms", defaultOn: false },
  { id: "photos", label: "Photos", defaultOn: false },
  { id: "companyProfile", label: "Company profile", defaultOn: false },
];

export const PROPOSAL_STUDIO_MODES = [
  { id: "client", label: "Simple Client Proposal" },
  { id: "engineer", label: "Engineer Review Report" },
  { id: "technician", label: "Technician Handover Report" },
  { id: "lender", label: "Lender / Grant Readiness Report" },
];

const SECTION_IDS = PROPOSAL_SECTIONS.map((s) => s.id);
const LABEL = Object.fromEntries(PROPOSAL_SECTIONS.map((s) => [s.id, s.label]));

export function createDefaultProposalStudioConfig() {
  return {
    mode: "client",
    sections: PROPOSAL_SECTIONS.map((s) => ({ id: s.id, label: s.label, enabled: s.defaultOn })),
  };
}

export function normalizeProposalStudioConfig(cfg) {
  const def = createDefaultProposalStudioConfig();
  if (!cfg || typeof cfg !== "object") return def;
  const mode = PROPOSAL_STUDIO_MODES.some((m) => m.id === cfg.mode) ? cfg.mode : "client";
  const seen = new Set();
  const sections = [];
  // keep saved order for known ids
  (Array.isArray(cfg.sections) ? cfg.sections : []).forEach((s) => {
    if (s && SECTION_IDS.includes(s.id) && !seen.has(s.id)) {
      seen.add(s.id);
      sections.push({ id: s.id, label: LABEL[s.id], enabled: s.enabled !== false });
    }
  });
  // append any sections missing from the saved config (new ids), default on/off
  PROPOSAL_SECTIONS.forEach((s) => {
    if (!seen.has(s.id)) sections.push({ id: s.id, label: s.label, enabled: s.defaultOn });
  });
  return { mode, sections };
}

/** Pure — move a section up/down. Returns a new config. */
export function reorderSection(config, id, direction) {
  const c = normalizeProposalStudioConfig(config);
  const i = c.sections.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= c.sections.length) return c;
  const sections = c.sections.slice();
  [sections[i], sections[j]] = [sections[j], sections[i]];
  return { ...c, sections };
}

export function toggleSection(config, id) {
  const c = normalizeProposalStudioConfig(config);
  return { ...c, sections: c.sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)) };
}

export function setProposalMode(config, mode) {
  const c = normalizeProposalStudioConfig(config);
  return { ...c, mode: PROPOSAL_STUDIO_MODES.some((m) => m.id === mode) ? mode : c.mode };
}

/** Ordered list of enabled section ids — the export-ready structure. */
export function enabledSectionIds(config) {
  return normalizeProposalStudioConfig(config).sections.filter((s) => s.enabled).map((s) => s.id);
}

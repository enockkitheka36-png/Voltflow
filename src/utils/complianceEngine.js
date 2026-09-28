/**
 * complianceEngine.js — Voltflow 11.7 (Kenya-first compliance workspace)
 *
 * A structured, editable compliance checklist persisted on the project. Pure — no
 * React, no DOM. This is a WORKFLOW aid to track regulatory readiness; it does not
 * grant approvals and does not claim certified compliance.
 */

export const COMPLIANCE_STATUSES = ["pending", "in_progress", "done", "not_applicable", "flagged"];

// Kenya-first sections. Each item is a tracked checkpoint.
export const COMPLIANCE_TEMPLATE = [
  { key: "epra", label: "EPRA licensing & signatory", items: [
    { key: "epra_contractor", label: "Licensed solar PV contractor (EPRA) identified" },
    { key: "epra_signatory", label: "Licensed technician/engineer signatory (T1/T2/T3) assigned" },
    { key: "epra_workmanship", label: "Workmanship & test certificates to be issued on completion" },
  ] },
  { key: "netMetering", label: "Net-metering applicability", items: [
    { key: "nm_applicable", label: "Net-metering applicability assessed (grid-tied ≤1 MW)" },
    { key: "nm_application", label: "Net-metering / interconnection application path noted" },
  ] },
  { key: "nema", label: "NEMA environmental screening", items: [
    { key: "nema_screen", label: "Project screened for EIA/environmental applicability" },
    { key: "nema_waste", label: "Construction/decommissioning waste plan noted" },
  ] },
  { key: "county", label: "County / building / fire", items: [
    { key: "county_permit", label: "County construction/wayleave requirements checked" },
    { key: "fire", label: "Fire safety / battery room requirements noted" },
    { key: "structural", label: "Structural/wind loading review flagged for engineer" },
  ] },
  { key: "dataConsent", label: "Data consent / ODPC", items: [
    { key: "odpc_consent", label: "Client consent to store project & contact data recorded" },
    { key: "odpc_note", label: "Data Protection Act (ODPC) handling note acknowledged" },
  ] },
  { key: "procurement", label: "Procurement documentation", items: [
    { key: "proc_quotes", label: "Equipment quotes / datasheets collected" },
    { key: "proc_warranty", label: "Warranty & origin documentation to be filed" },
  ] },
  { key: "ewaste", label: "Battery / e-waste handling", items: [
    { key: "ewaste_battery", label: "Battery transport, storage & disposal plan noted" },
    { key: "ewaste_takeback", label: "Take-back / recycling partner identified" },
  ] },
  { key: "waterPermit", label: "Borehole / water permits (placeholder)", items: [
    { key: "wra_permit", label: "WRA borehole/abstraction permit reference (if borehole)" },
    { key: "water_test", label: "Borehole test report & water quality on file (if borehole)" },
  ] },
];

export function createDefaultCompliance() {
  const sections = {};
  COMPLIANCE_TEMPLATE.forEach((s) => {
    sections[s.key] = { notes: "" };
    s.items.forEach((it) => { sections[s.key][it.key] = "pending"; });
  });
  return { sections, updatedAt: null };
}

export function normalizeCompliance(c) {
  const def = createDefaultCompliance();
  if (!c || typeof c !== "object" || !c.sections) return def;
  const out = { sections: {}, updatedAt: c.updatedAt || null };
  COMPLIANCE_TEMPLATE.forEach((s) => {
    const src = c.sections[s.key] || {};
    out.sections[s.key] = { notes: typeof src.notes === "string" ? src.notes : "" };
    s.items.forEach((it) => {
      const v = src[it.key];
      out.sections[s.key][it.key] = COMPLIANCE_STATUSES.includes(v) ? v : "pending";
    });
  });
  return out;
}

export function summarizeCompliance(c) {
  const nc = normalizeCompliance(c);
  let total = 0, done = 0, flagged = 0, na = 0;
  COMPLIANCE_TEMPLATE.forEach((s) => {
    s.items.forEach((it) => {
      total += 1;
      const v = nc.sections[s.key][it.key];
      if (v === "done") done += 1;
      else if (v === "flagged") flagged += 1;
      else if (v === "not_applicable") na += 1;
    });
  });
  const applicable = total - na;
  const score = applicable > 0 ? Math.round((done / applicable) * 100) : 0;
  return { total, done, flagged, na, applicable, score };
}

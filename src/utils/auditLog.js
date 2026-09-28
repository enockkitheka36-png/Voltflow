/**
 * auditLog.js — Voltflow 11.7 (local activity / audit trail)
 *
 * Records key project events to a per-browser localStorage log. The pure core
 * (createAuditEvent + appendEvent) is node-testable; the persistence layer is a
 * thin, defensive wrapper. Cloud-ready: events carry projectRef + ISO timestamps.
 */

export const AUDIT_EVENT_TYPES = {
  PROJECT_CREATED: "project_created",
  SURVEY_UPDATED: "survey_updated",
  LOAD_APPLIED: "load_applied",
  SIZING_CHANGED: "sizing_changed",
  BOREHOLE_CHANGED: "borehole_changed",
  PROPOSAL_GENERATED: "proposal_generated",
  PDF_EXPORTED: "pdf_exported",
  WARNING_OVERRIDDEN: "warning_overridden",
  STAGE_CHANGED: "stage_changed",
  IMPORT_PERFORMED: "import_performed",
  EXPORT_PERFORMED: "export_performed",
};

export const AUDIT_EVENT_LABELS = {
  project_created: "Project created",
  survey_updated: "Survey updated",
  load_applied: "Load inventory applied",
  sizing_changed: "Sizing changed",
  borehole_changed: "Borehole data changed",
  proposal_generated: "Proposal generated",
  pdf_exported: "PDF / report exported",
  warning_overridden: "Warning overridden",
  stage_changed: "Delivery stage changed",
  import_performed: "Project imported",
  export_performed: "Project exported",
};

const STORAGE_KEY = "voltflowAuditLog";
const CAP = 500;
const MAX_AUDIT_STORAGE_BYTES = 1024 * 1024;
export const AUDIT_DEDUPE_WINDOW_MS = 2000;

let _seq = 0;
function id() { _seq += 1; return `evt_${Date.now().toString(36)}_${_seq}`; }

/** Pure — build one event. */
export function createAuditEvent(type, detail = "", meta = {}) {
  return {
    id: id(),
    type,
    label: AUDIT_EVENT_LABELS[type] || type,
    detail: String(detail || ""),
    at: new Date().toISOString(),
    projectRef: meta.projectRef || null,
    user: meta.user || null,
    version: meta.version != null ? meta.version : null,
  };
}

function eventIdentity(event = {}) {
  return [event.type, event.detail, event.projectRef, event.user, event.version]
    .map((value) => String(value ?? ""))
    .join("\u001f");
}

export function isDuplicateAuditEvent(event, existing, windowMs = AUDIT_DEDUPE_WINDOW_MS) {
  if (!event || !existing || eventIdentity(event) !== eventIdentity(existing)) return false;
  const eventAt = Date.parse(event.at);
  const existingAt = Date.parse(existing.at);
  return Number.isFinite(eventAt) && Number.isFinite(existingAt)
    && Math.abs(eventAt - existingAt) <= Math.max(0, Number(windowMs) || 0);
}

/** Pure — prepend and cap. Newest first. */
export function appendEvent(list, event, cap = CAP) {
  const existing = Array.isArray(list) ? list : [];
  if (existing.some((item) => isDuplicateAuditEvent(event, item))) return existing.slice(0, cap);
  return [event, ...existing].slice(0, cap);
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length * 2 > MAX_AUDIT_STORAGE_BYTES) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, CAP) : [];
  }
  catch { return []; }
}
function writeStore(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* best effort */ }
}

/** Load the full log (newest first), optionally filtered to one project. */
export function loadAuditLog(projectRef = null) {
  const list = readStore();
  return projectRef ? list.filter((e) => e.projectRef === projectRef) : list;
}

/** Record an event to the persisted log. Returns the event. Never throws. */
export function recordAudit(type, detail = "", meta = {}) {
  const event = createAuditEvent(type, detail, meta);
  try {
    const existing = readStore();
    const duplicate = existing.find((item) => isDuplicateAuditEvent(event, item));
    if (duplicate) return duplicate;
    writeStore(appendEvent(existing, event));
  } catch { /* best effort */ }
  return event;
}

export function clearAuditLog() { writeStore([]); }

export function formatAuditTime(iso) {
  try { return new Date(iso).toLocaleString("en-KE"); } catch { return iso; }
}

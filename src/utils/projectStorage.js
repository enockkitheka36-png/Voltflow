/**
 * projectStorage.js — Voltflow 11.3
 * Single home for project persistence + tester feedback storage.
 *
 * Today everything is browser localStorage (Internal Alpha). The cloud
 * functions are deliberate placeholders so a Supabase/Firebase backend can
 * slot in later without touching the UI components — they already call
 * through this module.
 *
 * Pure/DOM-free except localStorage access (guarded for SSR/node so the
 * regression suites can import this file).
 */

export const PROJECTS_KEY = "voltflowProProjects";
export const FEEDBACK_KEY = "voltflowFeedback";
export const PROJECTS_QUARANTINE_KEY = "voltflowProProjectsQuarantine";
export const MAX_LOCAL_PROJECTS = 20;
export const MAX_LOCAL_FEEDBACK = 100;
export const MAX_LOCAL_PROJECT_BYTES = 2 * 1024 * 1024;
const MAX_QUARANTINE_ENTRIES = 5;
const MAX_QUARANTINE_COPY_BYTES = 128 * 1024;
const LOCAL_DEMO_AUXILIARY_KEYS = [
  "voltflow11_8LocalDemoVersions",
  "voltflow11_8LocalDemoEvidence",
  "voltflow11_8LocalDemoReviews",
  "voltflow11_8LocalDemoQuotes",
  "voltflowAuditLog",
];
export const PILOT_SAFETY_METADATA = Object.freeze({
  buildClass: "Internal Alpha / Controlled Bank Pilot Build",
  storageModel: "browser localStorage only",
  authModel: "no app authentication or tenant isolation in this build",
  sensitiveDataRule: "use test or non-sensitive customer data only until cloud access control is enabled",
  productionDeploymentApprovalRequired: true,
});

const hasStorage = () => typeof window !== "undefined" && !!window.localStorage;

let latestProjectRecovery = null;

function fingerprint(value = "") {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function readQuarantineEntries() {
  try {
    if (!hasStorage()) return [];
    const parsed = JSON.parse(window.localStorage.getItem(PROJECTS_QUARANTINE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === "object") : [];
  } catch {
    return [];
  }
}

function quarantineEntry({ scope, reason, raw, recordFingerprint = null }) {
  const rawText = typeof raw === "string" ? raw : "";
  const entry = {
    id: `recovery_${Date.now().toString(36)}`,
    quarantinedAt: new Date().toISOString(),
    sourceKey: PROJECTS_KEY,
    scope,
    reason,
    byteLength: rawText.length * 2,
    sourceFingerprint: fingerprint(rawText),
    recordFingerprint,
    raw: rawText.length * 2 <= MAX_QUARANTINE_COPY_BYTES ? rawText : null,
    originalDataPreserved: true,
  };
  latestProjectRecovery = entry;
  try {
    if (hasStorage()) {
      const previous = readQuarantineEntries().filter((item) => (
        item.sourceFingerprint !== entry.sourceFingerprint || item.scope !== entry.scope
      ));
      window.localStorage.setItem(PROJECTS_QUARANTINE_KEY, JSON.stringify([entry, ...previous].slice(0, MAX_QUARANTINE_ENTRIES)));
    }
  } catch { /* original project data remains untouched */ }
  return entry;
}

export function isSafeModeRequested(search) {
  try {
    const value = search ?? (typeof window !== "undefined" ? window.location.search : "");
    return new URLSearchParams(value).get("safeMode") === "1";
  } catch {
    return false;
  }
}

export function getLocalProjectRecovery() {
  return latestProjectRecovery ? { ...latestProjectRecovery, raw: undefined } : null;
}

export function quarantineLocalProjectRecord(record, reason = "Saved project migration failed.") {
  let raw = "";
  try { raw = JSON.stringify(record); } catch { raw = "[unserializable saved project]"; }
  return quarantineEntry({ scope: "project_record", reason, raw, recordFingerprint: fingerprint(raw) });
}

// ─── Local project storage ──────────────────────────────────────────────────

/** loadProjectsLocal() → saved-project records (defensive against corrupted storage). */
export function loadProjectsLocal({ skipSavedData = false } = {}) {
  try {
    if (!hasStorage() || skipSavedData) return [];
    latestProjectRecovery = null;
    const raw = window.localStorage.getItem(PROJECTS_KEY) || "[]";
    const rawFingerprint = fingerprint(raw);
    const quarantined = readQuarantineEntries();
    const matchingBlob = quarantined.find((entry) => entry.scope === "projects_blob" && entry.sourceFingerprint === rawFingerprint);
    if (matchingBlob) {
      latestProjectRecovery = matchingBlob;
      return [];
    }
    if (raw.length * 2 > MAX_LOCAL_PROJECT_BYTES) {
      quarantineEntry({ scope: "projects_blob", reason: "Saved project data exceeds the local startup safety limit.", raw });
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      quarantineEntry({ scope: "projects_blob", reason: "Saved project data is not a project list.", raw });
      return [];
    }
    const recordFingerprints = new Set(quarantined.filter((entry) => entry.scope === "project_record").map((entry) => entry.recordFingerprint));
    const valid = [];
    parsed.forEach((record) => {
      const shaped = record && typeof record === "object" && record.id && record.project && typeof record.project === "object";
      let recordRaw = "";
      try { recordRaw = JSON.stringify(record); } catch { /* quarantined below */ }
      if (!shaped || !recordRaw) {
        quarantineEntry({ scope: "project_record", reason: "Saved project record has an invalid shape.", raw: recordRaw || "[unserializable saved project]", recordFingerprint: fingerprint(recordRaw) });
        return;
      }
      const recordFingerprint = fingerprint(recordRaw);
      if (recordFingerprints.has(recordFingerprint)) {
        latestProjectRecovery ||= quarantined.find((entry) => entry.recordFingerprint === recordFingerprint) || null;
      } else if (valid.length < MAX_LOCAL_PROJECTS) {
        valid.push(record);
      }
    });
    return valid;
  } catch {
    try {
      const raw = hasStorage() ? window.localStorage.getItem(PROJECTS_KEY) || "" : "";
      if (raw) quarantineEntry({ scope: "projects_blob", reason: "Saved project JSON could not be parsed.", raw });
    } catch { /* storage remains untouched */ }
    return [];
  }
}

/** persistProjectsLocal(records) → true if written (false when storage is full/unavailable). */
export function persistProjectsLocal(records) {
  try {
    if (!hasStorage()) return false;
    const serialized = JSON.stringify(records);
    const current = window.localStorage.getItem(PROJECTS_KEY);
    const nextHash = fingerprint(serialized);
    // Avoid write-driven storage/event churn when callers offer the same
    // project list repeatedly. Equality closes the (very small) hash-collision
    // gap while keeping the fast guard explicit and testable.
    if (typeof current === "string" && fingerprint(current) === nextHash && current === serialized) return true;
    window.localStorage.setItem(PROJECTS_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

/**
 * saveProjectLocal(record, existing) → { records, persisted }
 * Prepends the record, replaces any same-name record, caps the list.
 */
export function saveProjectLocal(record, existing = []) {
  const records = [record, ...existing.filter((p) => p.name !== record.name)].slice(0, MAX_LOCAL_PROJECTS);
  return { records, persisted: persistProjectsLocal(records) };
}

/** deleteProjectLocal(id, existing) → { records, persisted } */
export function deleteProjectLocal(id, existing = []) {
  const records = existing.filter((p) => p.id !== id);
  return { records, persisted: persistProjectsLocal(records) };
}

// ─── Last-session pointer (v11.4.1) ─────────────────────────────────────────
// Records which saved project was last open so the start screen can offer
// "Continue last project". NOTHING is auto-loaded — the user must choose.

export const LAST_SESSION_KEY = "voltflowLastSession";

export function rememberLastActiveProject(id, name) {
  try {
    if (!hasStorage() || !id) return false;
    window.localStorage.setItem(LAST_SESSION_KEY, JSON.stringify({
      lastActiveProjectId: id,
      lastActiveProjectName: name || "",
      lastOpenedAt: new Date().toISOString(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function readLastSession() {
  try {
    if (!hasStorage()) return null;
    const parsed = JSON.parse(window.localStorage.getItem(LAST_SESSION_KEY) || "null");
    return parsed && parsed.lastActiveProjectId ? parsed : null;
  } catch {
    return null;
  }
}

/** The saved record the "Continue last project" card should offer, if it still exists. */
export function findLastActiveProject(savedProjects = []) {
  const last = readLastSession();
  if (!last) return null;
  return savedProjects.find((p) => String(p.id) === String(last.lastActiveProjectId)) || null;
}

export function clearLastSession() {
  try { if (hasStorage()) window.localStorage.removeItem(LAST_SESSION_KEY); } catch { /* ignore */ }
}

// ─── Local data reset (v11.4.1) ─────────────────────────────────────────────
// Testers upgrading from earlier builds may still hold old demo/Karen projects
// in this browser. Nothing is ever auto-loaded, but they need a visible way to
// wipe it. Destructive, so the UI must confirm and offer an export first.

export const ASSISTANT_CHAT_STORAGE_KEY = "voltflowAssistantChat";

/** What a reset would affect, so the UI can show exact counts before deleting. */
export function summarizeLocalData() {
  const projects = loadProjectsLocal();
  const feedback = loadFeedbackLocal();
  let assistantMessages = 0;
  try {
    if (hasStorage()) {
      const chat = JSON.parse(window.localStorage.getItem(ASSISTANT_CHAT_STORAGE_KEY) || "[]");
      assistantMessages = Array.isArray(chat) ? chat.length : 0;
    }
  } catch { assistantMessages = 0; }
  return {
    savedProjects: projects.length,
    savedProjectNames: projects.slice(0, 8).map((p) => p.name || "Untitled"),
    feedbackEntries: feedback.length,
    assistantMessages,
    hasLastSession: !!readLastSession(),
  };
}

/**
 * clearLocalProjectData({ includeFeedback })
 * Removes saved projects, the last-session pointer and assistant chat from this
 * browser. Tester feedback is PRESERVED unless includeFeedback is explicitly
 * true — it is research data the team has not collected yet.
 */
export function clearLocalProjectData({ includeFeedback = false } = {}) {
  const before = summarizeLocalData();
  try {
    if (hasStorage()) {
      window.localStorage.removeItem(PROJECTS_KEY);
      window.localStorage.removeItem(PROJECTS_QUARANTINE_KEY);
      window.localStorage.removeItem(LAST_SESSION_KEY);
      window.localStorage.removeItem(ASSISTANT_CHAT_STORAGE_KEY);
      LOCAL_DEMO_AUXILIARY_KEYS.forEach((key) => window.localStorage.removeItem(key));
      if (includeFeedback) window.localStorage.removeItem(FEEDBACK_KEY);
    }
  } catch { /* best effort — report what we intended to clear */ }
  return {
    clearedProjects: before.savedProjects,
    clearedAssistantMessages: before.assistantMessages,
    clearedFeedback: includeFeedback ? before.feedbackEntries : 0,
    keptFeedback: includeFeedback ? 0 : before.feedbackEntries,
  };
}

/** Bundle everything in this browser into one JSON file before a reset. */
export function exportAllLocalData(appVersion = "") {
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    filename: `voltflow_local_backup_${stamp}.json`,
    jsonString: JSON.stringify({
      appVersion,
      exportedAt: new Date().toISOString(),
      pilotSafety: PILOT_SAFETY_METADATA,
      savedProjects: loadProjectsLocal(),
      feedback: loadFeedbackLocal(),
      lastSession: readLastSession(),
      projectRecovery: readQuarantineEntries(),
    }, null, 2),
  };
}

// ─── Export / import ─────────────────────────────────────────────────────────

/** exportProjectJson(record) → { filename, jsonString } (caller creates the Blob/anchor). */
export function exportProjectJson(record) {
  const base = (record?.project?.client || record?.name || "voltflow_project")
    .replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const payload = {
    ...record,
    pilotSafety: PILOT_SAFETY_METADATA,
  };
  return {
    filename: `${base}_voltflow_export.json`,
    jsonString: JSON.stringify(payload, null, 2),
  };
}

const versionNum = (v) => {
  const m = String(v || "").match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
};

/**
 * importProjectJson(jsonString, current = { schemaVersion, appVersion }) →
 *   { ok: true, record, summary, warnings } | { ok: false, error }
 *
 * Validates shape and produces a human-readable summary so the UI can show
 * a review step BEFORE applying, plus warnings for older-version files.
 * Does NOT apply anything — the caller runs normalizeLoadedRecord on accept.
 */
export function importProjectJson(jsonString, current = {}) {
  let data;
  try {
    data = JSON.parse(jsonString);
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "File is not a Voltflow project export (expected a JSON object)." };
  }
  if (!data.project || typeof data.project !== "object") {
    return { ok: false, error: "File has no \"project\" section — this does not look like a Voltflow project export." };
  }

  const warnings = [];
  const fileSchema = versionNum(data.schemaVersion);
  const appSchema = versionNum(current.schemaVersion);
  if (!data.schemaVersion) {
    warnings.push("No schema version in the file — it is from a pre-v10 build; all missing fields will use current defaults.");
  } else if (appSchema > 0 && fileSchema < appSchema) {
    warnings.push(`File is from an older app version (schema ${data.schemaVersion}, current ${current.schemaVersion}) — it will be upgraded on import; newer fields use defaults.`);
  } else if (appSchema > 0 && fileSchema > appSchema) {
    warnings.push(`File is from a NEWER app version (schema ${data.schemaVersion}) than this build (${current.schemaVersion}) — fields this build does not know will be ignored.`);
  }
  if (!Array.isArray(data.loadItemsV2) && !Array.isArray(data.loads)) {
    warnings.push("No load table found in the file — the default load list will be used.");
  }
  if (!data.survey || typeof data.survey !== "object") warnings.push("No survey data in the file — survey fields will start empty.");
  if (!data.simulation || typeof data.simulation !== "object") warnings.push("No installer-simulation data in the file.");
  if (!data.pilotSafety || typeof data.pilotSafety !== "object") {
    warnings.push("No pilot-safety metadata found in this export; verify the controlled-pilot data rules before applying it.");
  }

  const loadCount = Array.isArray(data.loadItemsV2) ? data.loadItemsV2.length
    : Array.isArray(data.loads) ? data.loads.length : 0;

  const summary = {
    name: data.name || data.project.client || "Unnamed project",
    client: data.project.client || "—",
    location: data.project.location || "—",
    systemType: data.project.systemType || "—",
    appVersion: data.appVersion || "unknown (pre-v10)",
    schemaVersion: data.schemaVersion || "—",
    exportedAt: data.exportedAt || data.savedAt || null,
    exportedBy: data.exportedBy || "—",
    loadCount,
    sizingMode: data.project.sizingMode || "existing_site",
    hasSimulation: !!(data.simulation && typeof data.simulation === "object"),
    hasEnergyImport: !!(data.energyImportSummary || data.project.energyImport),
    hasPilotSafety: !!(data.pilotSafety && typeof data.pilotSafety === "object"),
    pilotSafetyStorageModel: data.pilotSafety?.storageModel || "not declared",
    pilotSafetyAuthModel: data.pilotSafety?.authModel || "not declared",
    // v11.5 — surface whether the file carries Voltflow Delivery state
    hasDelivery: !!(data.project.delivery && typeof data.project.delivery === "object"),
    deliveryStage: data.project.delivery?.stage || null,
    deliveryTaskCount: Array.isArray(data.project.delivery?.tasks) ? data.project.delivery.tasks.length : 0,
  };

  return { ok: true, record: data, summary, warnings };
}

// ─── Cloud placeholders (Supabase/Firebase later) ────────────────────────────

export const CLOUD_STORAGE_CONFIGURED = false;

/** Future: save a record to the configured cloud backend. */
export async function saveProjectCloud() {
  throw new Error("Cloud storage is not configured in this Internal Alpha build. Use local save + Export JSON.");
}

/** Future: list/load records from the configured cloud backend. */
export async function loadProjectsCloud() {
  throw new Error("Cloud storage is not configured in this Internal Alpha build. Use local save + Import JSON.");
}

// ─── Tester feedback (Internal Alpha) ────────────────────────────────────────

export const FEEDBACK_ISSUE_TYPES = ["Bug", "Calculation concern", "UI issue", "Missing feature", "Proposal issue"];

export function loadFeedbackLocal() {
  try {
    if (!hasStorage()) return [];
    const parsed = JSON.parse(window.localStorage.getItem(FEEDBACK_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((f) => f && typeof f === "object") : [];
  } catch {
    return [];
  }
}

/** addFeedbackLocal(entry, existing) → { records, persisted } (newest first, capped). */
export function addFeedbackLocal(entry, existing = []) {
  const record = {
    id: `fb_${Date.now()}`,
    submittedAt: new Date().toISOString(),
    ...entry,
  };
  const records = [record, ...existing].slice(0, MAX_LOCAL_FEEDBACK);
  let persisted = false;
  try {
    if (hasStorage()) { window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(records)); persisted = true; }
  } catch { persisted = false; }
  return { records, persisted };
}

export function deleteFeedbackLocal(id, existing = []) {
  const records = existing.filter((f) => f.id !== id);
  try { if (hasStorage()) window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(records)); } catch { /* keep in-memory list */ }
  return records;
}

/** exportFeedbackJson(records, appVersion) → { filename, jsonString } */
export function exportFeedbackJson(records = [], appVersion = "") {
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    filename: `voltflow_alpha_feedback_${stamp}.json`,
    jsonString: JSON.stringify({ appVersion, exportedAt: new Date().toISOString(), count: records.length, feedback: records }, null, 2),
  };
}

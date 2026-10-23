// Zoho Catalyst platform adapter.
//
// Hybrid provider: PROJECTS persist to the Catalyst DataStore "Projects" table
// (scope = User, so Zoho enforces per-user isolation server-side), AUTH uses
// Catalyst Embedded Authentication, and evidence/audit/quotes/reviews reuse the
// local-demo repositories for now (to be migrated to DataStore in later slices).
//
// The browser Catalyst Web SDK (window.catalyst) is loaded by the auth gate in
// index.html before this runs; getCatalyst() waits for it to be ready.

import {
  AuthProvider,
  ProjectRepository,
  EvidenceRepository,
  AuditRepository,
  assertPlatform,
} from "./contracts.js";
import { PlatformError, PLATFORM_ERROR_CODES, mapProviderError } from "./errors.js";
import { normalizeOrganisationRole } from "./accessControl.js";
import {
  LocalDemoReviewRepository,
  LocalDemoQuoteRepository,
} from "./localDemoAdapter.js";

const PROJECTS_TABLE = "Projects";
const AUDIT_TABLE = "AuditEvents";
const VERSIONS_TABLE = "ProjectVersions";
const EVIDENCE_TABLE = "Evidence";
// Evidence binaries live in Catalyst Stratus (File Store is deprecated — sunset 2026-10-31).
// Verified live: catalyst.stratus.bucket(NAME) exposes putObject/getObject/headObject/
// deleteObject/listPagedObjects. Per-user isolation is enforced by a bucket permission rule
// (X_ZUID) on the <ZUID>/... path prefix. Privileged lifecycle ops (verify/lock, controlled
// delete, version details) go through the voltflow-evidence-control serverless function.
const EVIDENCE_BUCKET = "voltflow-evidence-941921258";
const EVIDENCE_PROVIDER = "STRATUS";
const EVIDENCE_CONTROL_FN = "/server/voltflow-evidence-control/execute"; // Catalyst function endpoint
const MAX_COLUMN_CHARS = 9500; // safety margin under the 10,000-char Text limit
const SNAPSHOT_COLUMNS = ["Snapshot", "Snapshot2"];
const VERSION_SNAPSHOT_COLUMNS = ["Snapshot", "Snapshot2", "Snapshot3"];

// ---------------------------------------------------------------------------
// SDK readiness
// ---------------------------------------------------------------------------
function getCatalyst({ timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    (function poll() {
      const c = typeof window !== "undefined" ? window.catalyst : undefined;
      if (c && c.auth && c.table) return resolve(c);
      if (Date.now() - started > timeoutMs) {
        return reject(new PlatformError(
          PLATFORM_ERROR_CODES.NOT_CONFIGURED,
          "Zoho Catalyst SDK did not load. Reload the page to continue.",
        ));
      }
      setTimeout(poll, 100);
    })();
  });
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// Catalyst SDK calls RESOLVE (do not throw) on a permission denial, returning an
// object with status >= 400. Treat those as errors.
function assertCatalystOk(response, code, message) {
  const status = Number(response?.status);
  if (Number.isFinite(status) && status >= 400) {
    throw new PlatformError(
      status === 401 || status === 403 ? PLATFORM_ERROR_CODES.FORBIDDEN : code,
      response?.message || message,
      { details: { status } },
    );
  }
  return response;
}

// ---------------------------------------------------------------------------
// Identity (memoized current Catalyst user)
// ---------------------------------------------------------------------------
let identityCache = null;

function mapRole(roleName) {
  const value = String(roleName || "").trim().toLowerCase();
  if (value.includes("admin")) return "manager"; // App Administrator -> full access
  return normalizeOrganisationRole(value, "engineer");
}

async function loadIdentity() {
  if (identityCache) return identityCache;
  const catalyst = await getCatalyst();
  let raw;
  try {
    raw = await catalyst.auth.isUserAuthenticated();
  } catch (error) {
    throw new PlatformError(PLATFORM_ERROR_CODES.UNAUTHENTICATED, "You are not signed in to Zoho.", { cause: error });
  }
  const u = raw?.content || raw || {};
  const userId = String(u.user_id || u.userId || u.zuid || u.zaaid || "unknown");
  const orgId = String(u.org_id || u.orgId || u.zgid || "941921258");
  const roleName = u.role_details?.role_name || u.role_name || u.role || "App User";
  const displayName = [u.first_name, u.last_name].filter(Boolean).join(" ")
    || u.email_id || u.email || "Voltflow user";
  identityCache = {
    userId,
    zuid: String(u.zuid || u.user_id || userId),
    orgId,
    role: mapRole(roleName),
    displayName,
    email: u.email_id || u.email || null,
  };
  return identityCache;
}

// ---------------------------------------------------------------------------
// Audit trail writer (best-effort: a failed audit write must never break the
// action it records, e.g. if the AuditEvents table is not provisioned yet).
// ---------------------------------------------------------------------------
async function writeAuditRow(ev) {
  try {
    const catalyst = await getCatalyst();
    let actorUserId = ev.actorUserId;
    if (!actorUserId) {
      try { actorUserId = (await loadIdentity()).userId; } catch { actorUserId = null; }
    }
    await catalyst.table.tableId(AUDIT_TABLE).addRow([{
      Action: String(ev.action || "event").slice(0, 255),
      Detail: String(ev.detail || "").slice(0, 9900),
      ProjectRef: String(ev.projectRef || "").slice(0, 255),
      ActorUserId: String(actorUserId || "").slice(0, 255),
      OccurredAt: new Date().toISOString(),
    }]);
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// Snapshot (de)serialization: JSON -> gzip -> base64, split across 2 columns
// ---------------------------------------------------------------------------
function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function encodeToColumns(data, columns) {
  const json = JSON.stringify(data ?? {});
  let payload;
  if (typeof CompressionStream === "function") {
    const stream = new Blob([new TextEncoder().encode(json)]).stream()
      .pipeThrough(new CompressionStream("gzip"));
    const buffer = await new Response(stream).arrayBuffer();
    payload = `gz:${bytesToBase64(new Uint8Array(buffer))}`;
  } else {
    payload = `raw:${json}`;
  }
  if (payload.length > MAX_COLUMN_CHARS * columns.length) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      "This record is too large to save to the cloud in this version.",
    );
  }
  const out = {};
  columns.forEach((name, index) => {
    out[name] = payload.slice(index * MAX_COLUMN_CHARS, (index + 1) * MAX_COLUMN_CHARS) || null;
  });
  return out;
}

async function decodeFromColumns(row, columns) {
  const payload = columns.map((name) => row?.[name] || "").join("");
  if (!payload) return {};
  try {
    if (payload.startsWith("gz:")) {
      const bytes = base64ToBytes(payload.slice(3));
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      const text = await new Response(stream).text();
      return JSON.parse(text);
    }
    if (payload.startsWith("raw:")) return JSON.parse(payload.slice(4));
    return JSON.parse(payload); // legacy / plain
  } catch {
    return {};
  }
}

const encodeSnapshot = (record) => encodeToColumns(record, SNAPSHOT_COLUMNS);
const decodeSnapshot = (row) => decodeFromColumns(row, SNAPSHOT_COLUMNS);

// ---------------------------------------------------------------------------
// Record shaping
// ---------------------------------------------------------------------------
function buildRecord(record, meta, identity) {
  const now = meta.updatedAt || new Date().toISOString();
  return {
    ...record,
    id: String(meta.id || record.id),
    organisationId: identity.orgId,
    projectRef: record.projectRef || meta.projectRef || `VF-${String(meta.id || "").slice(-6)}`,
    name: record.name || record.project?.client || "Untitled project",
    revisionNo: Number(meta.revisionNo || record.revisionNo || 1),
    createdAt: meta.createdAt || record.createdAt || now,
    updatedAt: now,
    savedAt: now,
    archivedAt: meta.archivedAt ?? record.archivedAt ?? null,
    providerMode: "catalyst",
  };
}

async function rowToRecord(row, identity) {
  const stored = await decodeSnapshot(row);
  return buildRecord(stored, {
    id: row.ROWID,
    revisionNo: Number(row.RevisionNo || stored.revisionNo || 1),
    projectRef: stored.projectRef,
    createdAt: row.CREATEDTIME || stored.createdAt,
    updatedAt: row.MODIFIEDTIME || stored.updatedAt,
    archivedAt: stored.archivedAt ?? null,
  }, identity);
}

function projectKey(record) {
  return String(record.project?.id || record.projectRef || record.id || "").slice(0, 255);
}

// ---------------------------------------------------------------------------
// Auth provider
// ---------------------------------------------------------------------------
export class CatalystAuthProvider extends AuthProvider {
  get providerName() { return "catalyst"; }

  async getSession() {
    try {
      const identity = await loadIdentity();
      return { user: { id: identity.userId, email: identity.email }, cloud: true };
    } catch {
      return null;
    }
  }

  subscribe(listener) {
    this.getSession().then((session) => listener?.(session)).catch(() => listener?.(null));
    return () => {};
  }

  async signIn() {
    if (typeof window !== "undefined") window.location.replace("/app/login.html");
    return { redirected: true };
  }

  async signOut() {
    identityCache = null;
    const catalyst = await getCatalyst().catch(() => null);
    if (catalyst?.auth?.signOut) {
      try { await catalyst.auth.signOut("/app/login.html"); return { signedOut: true }; }
      catch { /* fall through */ }
    }
    if (typeof window !== "undefined") window.location.replace("/app/login.html");
    return { signedOut: true };
  }

  async getAuthorizationContext() {
    const identity = await loadIdentity();
    return {
      cloud: true,
      userId: identity.userId,
      profile: { displayName: identity.displayName, email: identity.email },
      memberships: [{
        id: `catalyst-${identity.orgId}`,
        organisationId: identity.orgId,
        organisationName: "Zoho Catalyst Organisation",
        role: identity.role,
        status: "active",
      }],
    };
  }
}

// ---------------------------------------------------------------------------
// Project repository (DataStore-backed)
// ---------------------------------------------------------------------------
export class CatalystProjectRepository extends ProjectRepository {
  async #table() {
    const catalyst = await getCatalyst();
    return catalyst.table.tableId(PROJECTS_TABLE);
  }

  async listProjects({ includeArchived = false } = {}) {
    const identity = await loadIdentity();
    const table = await this.#table();
    const rows = [];
    let nextToken;
    try {
      do {
        const resp = await table.getPagedRows({ next_token: nextToken, max_rows: 200 });
        rows.push(...(resp?.content || []));
        nextToken = resp?.more_records ? resp?.next_token : null;
      } while (nextToken);
    } catch (error) {
      throw mapProviderError(error, "Could not load projects from Zoho.");
    }
    const records = await Promise.all(rows.map((row) => rowToRecord(row, identity)));
    return records
      .filter((record) => includeArchived || !record.archivedAt)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async loadProject({ projectId }) {
    const identity = await loadIdentity();
    const table = await this.#table();
    let row;
    try {
      const resp = await table.rowId(String(projectId)).get();
      row = resp?.content;
    } catch (error) {
      throw mapProviderError(error, "Could not open the project from Zoho.");
    }
    if (!row) throw new PlatformError(PLATFORM_ERROR_CODES.NOT_FOUND, "Project was not found in Zoho.");
    return rowToRecord(row, identity);
  }

  async createProject({ record }) {
    const identity = await loadIdentity();
    const table = await this.#table();
    const draft = buildRecord(record, { id: "pending", revisionNo: 1 }, identity);
    const columns = await encodeSnapshot(draft);
    try {
      const resp = await table.addRow([{
        ProjectKey: projectKey(draft),
        ProjectName: draft.name,
        RevisionNo: 1,
        ...columns,
      }]);
      const created = resp?.content?.[0];
      if (!created) throw new PlatformError(PLATFORM_ERROR_CODES.INTERNAL_ERROR, "Zoho did not return the saved project.");
      const record = await rowToRecord(created, identity);
      await writeAuditRow({ action: "project_created", detail: record.name, projectRef: record.id, actorUserId: identity.userId });
      return record;
    } catch (error) {
      throw mapProviderError(error, "Could not save the project to Zoho.");
    }
  }

  async updateProject({ projectId, expectedRevisionNo, record }) {
    const identity = await loadIdentity();
    const table = await this.#table();
    const current = await this.loadProject({ projectId });
    if (Number(current.revisionNo) !== Number(expectedRevisionNo)) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.CONFLICT,
        "Project changed since it was loaded. Reload before saving.",
      );
    }
    const nextRevision = Number(current.revisionNo) + 1;
    const updated = buildRecord(record, {
      id: projectId,
      revisionNo: nextRevision,
      projectRef: current.projectRef,
      createdAt: current.createdAt,
      archivedAt: record.archivedAt ?? current.archivedAt ?? null,
    }, identity);
    const columns = await encodeSnapshot(updated);
    try {
      await table.updateRow([{
        ROWID: String(projectId),
        ProjectKey: projectKey(updated),
        ProjectName: updated.name,
        RevisionNo: nextRevision,
        ...columns,
      }]);
    } catch (error) {
      throw mapProviderError(error, "Could not save changes to Zoho.");
    }
    await writeAuditRow({
      action: updated.archivedAt ? "project_archived" : "project_updated",
      detail: updated.name,
      projectRef: String(projectId),
      actorUserId: identity.userId,
    });
    return updated;
  }

  async archiveProject({ projectId, expectedRevisionNo }) {
    const current = await this.loadProject({ projectId });
    return this.updateProject({
      projectId,
      expectedRevisionNo,
      record: { ...current, archivedAt: new Date().toISOString() },
    });
  }

  async importLegacyProject({ migration }) {
    const created = await this.createProject({ record: migration.currentRecord });
    return { ...created, migration: migration.provenance, sourceFingerprint: migration.sourceFingerprint };
  }

  async getTechnicianHome() {
    const projects = await this.listProjects();
    return {
      cloud: true,
      syncStatus: "cloud",
      projects: projects.map((record) => ({
        id: record.id,
        projectRef: record.projectRef,
        name: record.name,
        location: record.project?.location || "",
        tasks: record.project?.delivery?.tasks || [],
      })),
    };
  }

  // Immutable project versions (issued proposals) — append-only in DataStore.
  async createVersion({ projectId, envelope, lifecycle = "prepared" }) {
    const identity = await loadIdentity();
    const catalyst = await getCatalyst();
    const table = catalyst.table.tableId(VERSIONS_TABLE);
    let versionNo = 1;
    try {
      const existing = await this.listVersions({ projectId });
      versionNo = Number(existing[0]?.versionNo || 0) + 1;
    } catch { /* default to 1 */ }
    const issuedAt = lifecycle === "issued" ? new Date().toISOString() : null;
    const columns = await encodeToColumns(envelope?.snapshot ?? {}, VERSION_SNAPSHOT_COLUMNS);
    let created;
    try {
      const resp = await table.addRow([{
        ProjectId: String(projectId),
        VersionNo: versionNo,
        Lifecycle: String(lifecycle).slice(0, 255),
        SnapshotHash: String(envelope?.snapshotHash || "").slice(0, 255),
        IssuedAt: issuedAt || "",
        ...columns,
      }]);
      created = resp?.content?.[0];
    } catch (error) {
      throw mapProviderError(error, "Could not create an immutable project version in Zoho.");
    }
    await writeAuditRow({
      action: lifecycle === "issued" ? "version_issued" : "version_prepared",
      detail: `Version ${versionNo} (${lifecycle})`,
      projectRef: String(projectId),
      actorUserId: identity.userId,
    });
    return {
      id: created?.ROWID,
      projectId: String(projectId),
      versionNo,
      lifecycle,
      snapshotHash: envelope?.snapshotHash || null,
      createdAt: created?.CREATEDTIME || new Date().toISOString(),
      issuedAt,
      immutable: true,
      cloud: true,
    };
  }

  async listVersions({ projectId }) {
    const catalyst = await getCatalyst();
    const table = catalyst.table.tableId(VERSIONS_TABLE);
    const rows = [];
    let nextToken;
    try {
      do {
        const resp = await table.getPagedRows({ next_token: nextToken, max_rows: 200 });
        rows.push(...(resp?.content || []));
        nextToken = resp?.more_records ? resp?.next_token : null;
      } while (nextToken);
    } catch {
      return [];
    }
    return rows
      .filter((r) => String(r.ProjectId) === String(projectId))
      .map((r) => ({
        id: r.ROWID,
        projectId: r.ProjectId,
        versionNo: Number(r.VersionNo || 0),
        lifecycle: r.Lifecycle,
        snapshotHash: r.SnapshotHash,
        createdAt: r.CREATEDTIME,
        issuedAt: r.IssuedAt || null,
        immutable: true,
      }))
      .sort((a, b) => b.versionNo - a.versionNo);
  }

  async listSharedVersions() { return []; }
  async createShare() {
    throw new PlatformError(PLATFORM_ERROR_CODES.NOT_CONFIGURED, "Cloud project sharing is not available yet in the Zoho build.");
  }
  async revokeShare() {
    throw new PlatformError(PLATFORM_ERROR_CODES.NOT_CONFIGURED, "Cloud project sharing is not available yet in the Zoho build.");
  }
}

// ---------------------------------------------------------------------------
// Audit repository (DataStore-backed, append-only tamper-evident trail)
// ---------------------------------------------------------------------------
export class CatalystAuditRepository extends AuditRepository {
  async listEvents({ projectRef = null, projectId = null } = {}) {
    const wanted = projectRef || projectId;
    let rows = [];
    try {
      const catalyst = await getCatalyst();
      const table = catalyst.table.tableId(AUDIT_TABLE);
      let nextToken;
      do {
        const resp = await table.getPagedRows({ next_token: nextToken, max_rows: 200 });
        rows.push(...(resp?.content || []));
        nextToken = resp?.more_records ? resp?.next_token : null;
      } while (nextToken);
    } catch {
      return [];
    }
    return rows
      .map((r) => ({
        id: r.ROWID,
        action: r.Action,
        type: r.Action,
        reason: r.Detail,
        detail: r.Detail,
        projectRef: r.ProjectRef,
        actor_user_id: r.ActorUserId,
        occurred_at: r.OccurredAt || r.CREATEDTIME,
        created_at: r.CREATEDTIME || r.OccurredAt,
      }))
      .filter((event) => !wanted || String(event.projectRef) === String(wanted))
      .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));
  }

  async recordEvent(event = {}) {
    const action = event.action || event.type || "event";
    const detail = event.reason || event.detail || "";
    const projectRef = event.projectRef || event.projectId || null;
    const occurredAt = new Date().toISOString();
    await writeAuditRow({ action, detail, projectRef, actorUserId: event.actorUserId });
    return {
      id: `evt_${Date.now()}`,
      action,
      type: action,
      reason: detail,
      detail,
      projectRef,
      occurred_at: occurredAt,
      created_at: occurredAt,
    };
  }
}

// ---------------------------------------------------------------------------
// Evidence repository — binaries in Catalyst STRATUS, metadata in DataStore.
// (Catalyst File Store is deprecated; see docs/CATALYST_MODULAR_JS_SDK_MIGRATION.md.)
// Browser does upload (putObject) + download (getObject->Blob). Per-user isolation
// is enforced by a Stratus X_ZUID bucket rule on the <ZUID>/... path prefix.
// Privileged lifecycle (verify/lock, controlled delete, version details) is routed
// to the voltflow-evidence-control serverless function — NEVER done from the browser,
// so DRAFT/VERIFIED enforcement cannot be bypassed by client logic.
// item.id surfaced to the UI is the DataStore ROWID.
// ---------------------------------------------------------------------------
const EVIDENCE_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024; // 25 MB, matches the existing photo cap

function sanitizeEvidenceFileName(name) {
  // Stratus object keys cannot contain " < > # \ | or spaces.
  const base = String(name || "evidence").split(/[\\/]/).pop() || "evidence";
  const cleaned = base.replace(/["<>#\\|\s]+/g, "_").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 120);
  return cleaned || "evidence.bin";
}

function buildEvidenceObjectKey({ stage = "draft", zuid, projectKey, evidenceKey, fileName }) {
  // DRAFT and VERIFIED live under separate prefixes so the bucket rule can grant
  // end users Get+Put on draft/ but Get-ONLY on verified/ (no overwrite of a
  // verified object even with versioning on).
  return `${stage}/${zuid}/projects/${projectKey}/evidence/${evidenceKey}/${sanitizeEvidenceFileName(fileName)}`;
}

function validateEvidenceFile({ mimeType, sizeBytes }) {
  const errors = [];
  if (!EVIDENCE_MIME_TYPES.includes(String(mimeType || "").toLowerCase())) errors.push({ code: "INVALID_MIME" });
  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size <= 0) errors.push({ code: "INVALID_SIZE" });
  if (size > MAX_EVIDENCE_BYTES) errors.push({ code: "FILE_TOO_LARGE" });
  return errors;
}

export class CatalystEvidenceRepository extends EvidenceRepository {
  constructor() {
    super();
    this.pending = new Map(); // evidenceId -> { input, objectKey, uploaded }
  }

  bucket() {
    const stratus = window.catalyst?.stratus;
    if (!stratus || typeof stratus.bucket !== "function") {
      throw new PlatformError(PLATFORM_ERROR_CODES.NOT_CONFIGURED, "Evidence storage (Stratus) is not available.");
    }
    return stratus.bucket(EVIDENCE_BUCKET);
  }

  // Invoke the privileged evidence-lifecycle serverless function. The function
  // re-derives the caller identity server-side and enforces authorization; the
  // browser-supplied fields are advisory only.
  async callControl(action, payload = {}) {
    let resp;
    try {
      resp = await fetch(EVIDENCE_CONTROL_FN, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
    } catch (error) {
      throw new PlatformError(PLATFORM_ERROR_CODES.INTERNAL_ERROR, "Evidence control service is unavailable.", { cause: error });
    }
    let body = null;
    try { body = await resp.json(); } catch { /* non-JSON */ }
    if (!resp.ok || body?.status === "DENIED" || body?.error) {
      throw new PlatformError(
        resp.status === 401 || resp.status === 403 ? PLATFORM_ERROR_CODES.FORBIDDEN : PLATFORM_ERROR_CODES.INTERNAL_ERROR,
        body?.message || body?.error || `Evidence operation refused (${resp.status}).`,
        { details: { status: resp.status, body } },
      );
    }
    return body;
  }

  async getRow(evidenceId) {
    const catalyst = await getCatalyst();
    const resp = await catalyst.table.tableId(EVIDENCE_TABLE).rowId(String(evidenceId)).get();
    const row = resp?.content;
    if (!row) throw new PlatformError(PLATFORM_ERROR_CODES.NOT_FOUND, "Evidence was not found.");
    return row;
  }

  mapRow(r) {
    const status = String(r.Status || "DRAFT").toUpperCase();
    // DB uses DRAFT/VERIFIED; the UI's review controls key off "submitted"/"verified".
    const reviewStatus = status === "VERIFIED" ? "verified" : status === "REJECTED" ? "rejected" : "submitted";
    return {
      id: r.ROWID,
      evidenceKey: r.EvidenceKey,
      title: r.FileName,
      photoType: r.EvidenceType,
      kind: "site_photo",
      mimeType: r.MimeType,
      sizeBytes: Number(r.FileSize || 0),
      status,
      reviewStatus,
      caption: r.Notes || null,
      checksumSha256: r.Sha256 || null,
      serverReceivedAt: r.UploadedAt || r.CREATEDTIME || null,
      storageProvider: r.StorageProvider || EVIDENCE_PROVIDER,
      bucketName: r.BucketName || EVIDENCE_BUCKET,
      objectKey: r.ObjectKey || null,
      objectVersionId: r.ObjectVersionId || null,
      uploaderUserId: r.UploadedBy,
      revisionNo: Number(r.RevisionNo || 1),
    };
  }

  async listEvidence({ projectId } = {}) {
    const catalyst = await getCatalyst();
    const table = catalyst.table.tableId(EVIDENCE_TABLE);
    const rows = [];
    let nextToken;
    try {
      do {
        const resp = await table.getPagedRows({ next_token: nextToken, max_rows: 200 });
        rows.push(...(resp?.content || []));
        nextToken = resp?.more_records ? resp?.next_token : null;
      } while (nextToken);
    } catch {
      return [];
    }
    return rows
      .filter((r) => !projectId || String(r.ProjectKey) === String(projectId))
      .map((r) => this.mapRow(r))
      .sort((a, b) => String(b.serverReceivedAt).localeCompare(String(a.serverReceivedAt)));
  }

  async prepareUpload(input = {}) {
    const identity = await loadIdentity();
    const errors = validateEvidenceFile({ mimeType: input.mimeType, sizeBytes: input.sizeBytes });
    if (errors.length > 0) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.VALIDATION_FAILED,
        `Evidence file is invalid: ${errors.map((e) => e.code).join(", ")}.`,
        { details: { errors } },
      );
    }
    if (!input.projectId) {
      throw new PlatformError(PLATFORM_ERROR_CODES.VALIDATION_FAILED, "A project is required for evidence upload.");
    }
    const evidenceId = input.evidenceId || `EV-${uuid()}`;
    const objectKey = buildEvidenceObjectKey({
      zuid: identity.zuid,
      projectKey: String(input.projectId),
      evidenceKey: evidenceId,
      fileName: input.filename || input.title || "evidence",
    });
    this.pending.set(evidenceId, { input, objectKey, uploaded: false });
    return { evidenceId, storagePath: evidenceId, signedToken: evidenceId, objectKey, uploadDisabled: false, publicUrl: null };
  }

  async uploadPreparedFile({ storagePath, signedToken, file, onProgress } = {}) {
    const evidenceId = storagePath || signedToken;
    const pending = evidenceId && this.pending.get(evidenceId);
    if (!pending) {
      throw new PlatformError(PLATFORM_ERROR_CODES.NOT_FOUND, "Upload was not prepared or has expired. Retry the upload.");
    }
    if (!file) {
      throw new PlatformError(PLATFORM_ERROR_CODES.VALIDATION_FAILED, "An evidence file is required.");
    }
    await getCatalyst();
    try { onProgress?.(10); } catch { /* ignore */ }
    try {
      // overwrite:false — never silently replace an existing object for this key.
      const resp = assertCatalystOk(
        await this.bucket().putObject(pending.objectKey, file, {
          overwrite: false,
          type: pending.input?.mimeType || file.type || "application/octet-stream",
        }).start(),
        PLATFORM_ERROR_CODES.INTERNAL_ERROR,
        "Could not upload the evidence file to Stratus.",
      );
      if (resp?.content === false) {
        throw new PlatformError(PLATFORM_ERROR_CODES.CONFLICT, "Upload was rejected (object already exists).");
      }
    } catch (error) {
      throw mapProviderError(error, "Could not upload the evidence file to Stratus.");
    }
    pending.uploaded = true;
    try { onProgress?.(90); } catch { /* ignore */ }
    return { uploaded: true, objectKey: pending.objectKey, publicUrl: null };
  }

  async completeUpload({ evidenceId, checksumSha256, sizeBytes } = {}) {
    const pending = evidenceId && this.pending.get(evidenceId);
    if (!pending) {
      throw new PlatformError(PLATFORM_ERROR_CODES.NOT_FOUND, "Upload context was lost. Retry the upload.");
    }
    if (!pending.uploaded) {
      throw new PlatformError(PLATFORM_ERROR_CODES.CONFLICT, "The evidence binary was not uploaded. Retry the upload.");
    }
    const input = pending.input || {};
    // The server function re-derives the caller, verifies the object exists under
    // draft/<callerZUID>/..., FORCES the trusted fields (UploadedBy, Status=DRAFT,
    // StorageProvider, BucketName, RevisionNo), writes the metadata row as the caller
    // (User-scope ownership), appends evidence_uploaded, and returns the canonical
    // record. The browser never writes trusted Evidence metadata directly. On failure
    // the function removes the orphan draft object (end users have no DeleteObject).
    let body;
    try {
      body = await this.callControl("FINALIZE_UPLOAD", {
        evidenceKey: evidenceId,
        projectKey: String(input.projectId || ""),
        objectKey: pending.objectKey,
        evidenceType: input.photoType || "OTHER",
        fileName: input.filename || input.title || "evidence",
        mimeType: input.mimeType || "application/octet-stream",
        sizeBytes: Number(sizeBytes || input.sizeBytes || 0),
        sha256: checksumSha256 || input.checksumSha256 || "",
        caption: input.caption || "",
      });
    } finally {
      this.pending.delete(evidenceId);
    }
    const rec = body?.evidence || null;
    return rec
      ? this.mapRow(rec)
      : { id: body?.rowId || null, evidenceKey: evidenceId, status: "DRAFT", reviewStatus: "submitted", objectKey: pending.objectKey };
  }

  // Verified/locked transition — privileged, server-enforced.
  async reviewEvidence({ evidenceId, status } = {}) {
    if (status === "verified") {
      const body = await this.callControl("VERIFY_EVIDENCE", { evidenceId });
      const row = await this.getRow(evidenceId).catch(() => null);
      return row ? this.mapRow(row) : { id: evidenceId, reviewStatus: "verified", status: "VERIFIED", ...body };
    }
    if (status === "rejected") {
      const body = await this.callControl("REJECT_EVIDENCE", { evidenceId });
      const row = await this.getRow(evidenceId).catch(() => null);
      return row ? this.mapRow(row) : { id: evidenceId, reviewStatus: "rejected", status: "REJECTED", ...body };
    }
    throw new PlatformError(PLATFORM_ERROR_CODES.VALIDATION_FAILED, "Evidence review must be verified or rejected.");
  }

  async createDownloadUrl({ evidenceId } = {}) {
    // NOTE: evidence_downloaded is intentionally NOT audited here — this runs during
    // render to build image thumbnails, and audit must never run during render.
    await loadIdentity();
    const row = await this.getRow(evidenceId);
    if (!row.ObjectKey) return { signedUrl: null, publicUrl: null };
    try {
      const resp = assertCatalystOk(
        await this.bucket().getObject(row.ObjectKey, {}).start(),
        PLATFORM_ERROR_CODES.INTERNAL_ERROR,
        "Could not download the evidence object.",
      );
      const blob = resp?.content;
      if (!blob || typeof URL === "undefined" || !URL.createObjectURL) return { signedUrl: null, publicUrl: null };
      // Local, revocable blob URL for this session only — never a public object URL.
      return { signedUrl: URL.createObjectURL(blob), publicUrl: null, blob };
    } catch (error) {
      throw mapProviderError(error, "Could not download the evidence object.");
    }
  }

  // Deletion is lifecycle-gated and server-enforced; never a browser deleteObject.
  async deleteEvidence({ evidenceId, reason } = {}) {
    const body = await this.callControl("DELETE_DRAFT", { evidenceId, reason: reason || "removed" });
    return { deleted: true, evidenceId, publicUrl: null, ...body };
  }
}

// ---------------------------------------------------------------------------
// Platform factory
// ---------------------------------------------------------------------------
export function createCatalystPlatform(options = {}) {
  const storage = options.storage;
  return assertPlatform({
    mode: "catalyst",
    cloudEnabled: true,
    authRequired: true,
    auth: new CatalystAuthProvider(),
    projects: new CatalystProjectRepository(),
    audit: new CatalystAuditRepository(),
    evidence: new CatalystEvidenceRepository(),
    // Reused local repositories until these entities are migrated to DataStore.
    reviews: new LocalDemoReviewRepository(storage),
    quotes: new LocalDemoQuoteRepository(storage),
  });
}

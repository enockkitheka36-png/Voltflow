import {
  AuthProvider,
  ProjectRepository,
  EvidenceRepository,
  AuditRepository,
  ReviewRepository,
  QuoteRepository,
  assertPlatform,
} from "./contracts.js";
import { PlatformError, PLATFORM_ERROR_CODES } from "./errors.js";
import { normalizeOrganisationRole } from "./accessControl.js";
import { createLocalReviewSubmission, transitionReview } from "./reviewWorkflow.js";
import { appendEvent, createAuditEvent } from "../utils/auditLog.js";
import { PROJECTS_KEY } from "../utils/projectStorage.js";
import { validatePhotoUpload } from "../utils/photoEvidence.js";

const LOCAL_ORGANISATION_ID = "00000000-0000-4000-8000-000000000001";
const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000101";
const VERSION_KEY = "voltflow11_8LocalDemoVersions";
const EVIDENCE_KEY = "voltflow11_8LocalDemoEvidence";
const REVIEW_KEY = "voltflow11_8LocalDemoReviews";
const QUOTE_KEY = "voltflow11_8LocalDemoQuotes";
const AUDIT_KEY = "voltflowAuditLog";
const MAX_LOCAL_REPOSITORY_BYTES = 2 * 1024 * 1024;
const LOCAL_LIST_LIMITS = Object.freeze({
  [PROJECTS_KEY]: 20,
  [VERSION_KEY]: 100,
  [EVIDENCE_KEY]: 500,
  [REVIEW_KEY]: 200,
  [QUOTE_KEY]: 200,
  [AUDIT_KEY]: 500,
});

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch { /* use memory */ }
  return memoryStorage();
}

function readList(storage, key) {
  try {
    const raw = storage.getItem(key) || "[]";
    if (raw.length * 2 > MAX_LOCAL_REPOSITORY_BYTES) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.slice(0, LOCAL_LIST_LIMITS[key] || 500) : [];
  } catch {
    return [];
  }
}

function writeList(storage, key, values) {
  try {
    storage.setItem(key, JSON.stringify((Array.isArray(values) ? values : []).slice(0, LOCAL_LIST_LIMITS[key] || 500)));
  } catch (error) {
    throw new PlatformError(PLATFORM_ERROR_CODES.STORAGE_UNAVAILABLE, "Local demo storage is unavailable.", { cause: error });
  }
}

function asProjectRecord(record, metadata = {}) {
  const now = metadata.updatedAt || new Date().toISOString();
  return {
    ...record,
    id: metadata.id || record.id || uuid(),
    organisationId: LOCAL_ORGANISATION_ID,
    projectRef: record.projectRef || metadata.projectRef || `LOCAL-${Date.now().toString(36).toUpperCase()}`,
    name: record.name || record.project?.client || "Untitled project",
    revisionNo: Number(metadata.revisionNo || record.revisionNo || 1),
    createdAt: metadata.createdAt || record.createdAt || now,
    updatedAt: now,
    savedAt: now,
    archivedAt: metadata.archivedAt ?? record.archivedAt ?? null,
    providerMode: "local-demo",
  };
}

export class LocalDemoAuthProvider extends AuthProvider {
  constructor(role = "engineer") {
    super();
    this.role = normalizeOrganisationRole(role, "engineer");
    this.session = {
      user: { id: LOCAL_USER_ID, email: "local-demo@device.invalid" },
      localOnly: true,
    };
  }
  get providerName() { return "local-demo"; }
  async getSession() { return this.session; }
  subscribe(listener) {
    listener?.(this.session);
    return () => {};
  }
  async signIn() { return this.session; }
  async signOut() { return { localOnly: true }; }
  async getAuthorizationContext() {
    return {
      localOnly: true,
      userId: LOCAL_USER_ID,
      profile: { displayName: "Local Demo User" },
      memberships: [{
        id: "00000000-0000-4000-8000-000000001001",
        organisationId: LOCAL_ORGANISATION_ID,
        organisationName: "Local Demo Organisation",
        role: this.role,
        status: "active",
      }],
    };
  }
}

export class LocalDemoProjectRepository extends ProjectRepository {
  constructor(storage) {
    super();
    this.storage = resolveStorage(storage);
  }
  async listProjects({ includeArchived = false } = {}) {
    return readList(this.storage, PROJECTS_KEY)
      .map((record) => asProjectRecord(record, {
        id: String(record.id || uuid()),
        revisionNo: record.revisionNo || 1,
        createdAt: record.createdAt || record.savedAt,
        updatedAt: record.updatedAt || record.savedAt,
        archivedAt: record.archivedAt,
      }))
      .filter((record) => includeArchived || !record.archivedAt)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  async loadProject({ projectId }) {
    const project = (await this.listProjects({ includeArchived: true }))
      .find((record) => String(record.id) === String(projectId));
    if (!project) throw new PlatformError(PLATFORM_ERROR_CODES.NOT_FOUND, "Local demo project was not found.");
    return project;
  }
  async createProject({ record }) {
    const records = await this.listProjects({ includeArchived: true });
    const created = asProjectRecord(record, { id: uuid(), revisionNo: 1 });
    writeList(this.storage, PROJECTS_KEY, [created, ...records]);
    return created;
  }
  async updateProject({ projectId, expectedRevisionNo, record }) {
    const records = await this.listProjects({ includeArchived: true });
    const index = records.findIndex((item) => String(item.id) === String(projectId));
    if (index < 0) throw new PlatformError(PLATFORM_ERROR_CODES.NOT_FOUND, "Local demo project was not found.");
    if (Number(records[index].revisionNo) !== Number(expectedRevisionNo)) {
      throw new PlatformError(PLATFORM_ERROR_CODES.CONFLICT, "Project changed since it was loaded. Reload before saving.");
    }
    const updated = asProjectRecord(record, {
      id: records[index].id,
      projectRef: records[index].projectRef,
      revisionNo: records[index].revisionNo + 1,
      createdAt: records[index].createdAt,
    });
    records[index] = updated;
    writeList(this.storage, PROJECTS_KEY, records);
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
  async createVersion({ projectId, envelope, lifecycle = "prepared" }) {
    const project = await this.loadProject({ projectId });
    const versions = readList(this.storage, VERSION_KEY);
    const versionNo = versions.filter((item) => item.projectId === projectId).length + 1;
    const version = {
      id: uuid(),
      organisationId: LOCAL_ORGANISATION_ID,
      projectId,
      versionNo,
      lifecycle,
      snapshot: envelope.snapshot,
      publicSnapshot: envelope.publicSnapshot,
      bankSnapshot: envelope.bankSnapshot,
      fieldSnapshot: envelope.fieldSnapshot,
      snapshotHash: envelope.snapshotHash,
      createdAt: new Date().toISOString(),
      issuedAt: lifecycle === "issued" ? new Date().toISOString() : null,
      immutable: true,
      localOnly: true,
    };
    writeList(this.storage, VERSION_KEY, [version, ...versions]);
    await this.updateProject({ projectId, expectedRevisionNo: project.revisionNo, record: project });
    return version;
  }
  async listVersions({ projectId }) {
    return readList(this.storage, VERSION_KEY)
      .filter((item) => item.projectId === projectId)
      .sort((a, b) => Number(b.versionNo) - Number(a.versionNo));
  }
  async importLegacyProject({ migration }) {
    const created = await this.createProject({ record: migration.currentRecord });
    return { ...created, migration: migration.provenance, sourceFingerprint: migration.sourceFingerprint };
  }
  async listSharedVersions() { return []; }
  async createShare() {
    throw new PlatformError(PLATFORM_ERROR_CODES.NOT_CONFIGURED, "Local mode cannot share a project externally. Export and share it manually.");
  }
  async revokeShare() {
    throw new PlatformError(PLATFORM_ERROR_CODES.NOT_CONFIGURED, "Local mode has no cloud project shares.");
  }
  async getTechnicianHome() {
    const projects = await this.listProjects();
    return {
      localOnly: true,
      syncStatus: "local_only",
      projects: projects.map((record) => ({
        id: record.id,
        projectRef: record.projectRef,
        name: record.name,
        location: record.project?.location || "",
        tasks: record.project?.delivery?.tasks || [],
      })),
    };
  }
}

export class LocalDemoEvidenceRepository extends EvidenceRepository {
  constructor(storage) {
    super();
    this.storage = resolveStorage(storage);
  }
  async listEvidence({ projectId }) {
    return readList(this.storage, EVIDENCE_KEY).filter((item) => item.projectId === projectId);
  }
  async prepareUpload(input) {
    if (input.photoType) {
      const errors = validatePhotoUpload({
        photoType: input.photoType,
        roofFaceId: input.roofFaceId,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      });
      if (errors.length > 0) {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.VALIDATION_FAILED,
          `Photo upload is invalid: ${errors.map((error) => error.code).join(", ")}.`,
          { details: { errors } },
        );
      }
    }
    const item = {
      id: input.evidenceId || uuid(),
      organisationId: LOCAL_ORGANISATION_ID,
      projectId: input.projectId,
      title: input.title || input.filename || "Evidence",
      kind: input.kind || "other",
      photoType: input.photoType || null,
      roofFaceId: input.roofFaceId || null,
      caption: input.caption || null,
      mimeType: input.mimeType || "application/octet-stream",
      sizeBytes: Number(input.sizeBytes) || 0,
      checksumSha256: input.checksumSha256 || null,
      deviceCapturedAt: input.deviceCapturedAt || null,
      serverReceivedAt: null,
      gps: input.gps || null,
      uploaderUserId: LOCAL_USER_ID,
      reviewStatus: "draft",
      localOnly: true,
      createdAt: new Date().toISOString(),
    };
    const items = readList(this.storage, EVIDENCE_KEY);
    writeList(this.storage, EVIDENCE_KEY, [item, ...items]);
    return {
      evidence: item,
      evidenceId: item.id,
      storagePath: null,
      signedToken: null,
      uploadDisabled: true,
      publicUrl: null,
      message: "Evidence metadata saved locally. No cloud upload occurred.",
    };
  }
  async uploadPreparedFile() {
    return { uploaded: false, localOnly: true, publicUrl: null, message: "No cloud upload occurred." };
  }
  async completeUpload({ evidenceId, checksumSha256, sizeBytes }) {
    const items = readList(this.storage, EVIDENCE_KEY);
    const index = items.findIndex((item) => item.id === evidenceId);
    if (index < 0) throw new PlatformError(PLATFORM_ERROR_CODES.NOT_FOUND, "Local evidence metadata was not found.");
    if (items[index].serverReceivedAt) throw new PlatformError(PLATFORM_ERROR_CODES.CONFLICT, "Evidence upload is already finalized.");
    if (items[index].checksumSha256 && items[index].checksumSha256 !== checksumSha256) {
      throw new PlatformError(PLATFORM_ERROR_CODES.VALIDATION_FAILED, "Evidence checksum does not match upload authorization.");
    }
    items[index] = { ...items[index], checksumSha256, sizeBytes, serverReceivedAt: new Date().toISOString() };
    writeList(this.storage, EVIDENCE_KEY, items);
    return items[index];
  }
  async reviewEvidence({ evidenceId, status, reason }) {
    const items = readList(this.storage, EVIDENCE_KEY);
    const index = items.findIndex((item) => item.id === evidenceId);
    if (index < 0) throw new PlatformError(PLATFORM_ERROR_CODES.NOT_FOUND, "Local evidence metadata was not found.");
    if (!["verified", "rejected"].includes(status)) throw new PlatformError(PLATFORM_ERROR_CODES.VALIDATION_FAILED, "Evidence review must be verified or rejected.");
    items[index] = {
      ...items[index],
      reviewStatus: status,
      reviewReason: reason || null,
      reviewedAt: new Date().toISOString(),
      localOnly: true,
      authoritative: false,
      message: "Local evidence review is not a cloud approval.",
    };
    writeList(this.storage, EVIDENCE_KEY, items);
    return items[index];
  }
  async createDownloadUrl() {
    return { signedUrl: null, publicUrl: null, localOnly: true, message: "No cloud evidence file exists." };
  }
  async deleteEvidence({ evidenceId }) {
    const items = readList(this.storage, EVIDENCE_KEY);
    const item = items.find((candidate) => candidate.id === evidenceId);
    if (!item) throw new PlatformError(PLATFORM_ERROR_CODES.NOT_FOUND, "Local evidence metadata was not found.");
    writeList(this.storage, EVIDENCE_KEY, items.filter((candidate) => candidate.id !== evidenceId));
    return { deleted: true, evidenceId, localOnly: true, publicUrl: null, message: "Local evidence metadata deleted. No cloud file existed." };
  }
}

export class LocalDemoAuditRepository extends AuditRepository {
  constructor(storage) {
    super();
    this.storage = resolveStorage(storage);
  }
  async listEvents({ projectRef = null, projectId = null } = {}) {
    const requestedProject = projectRef || projectId;
    return readList(this.storage, AUDIT_KEY)
      .filter((event) => !requestedProject || String(event.projectRef || event.project_id || event.projectId) === String(requestedProject))
      .map((event) => ({
        ...event,
        action: event.action || event.type || "local_event",
        reason: event.reason ?? event.detail ?? "",
        actor_user_id: event.actor_user_id || event.actorUserId || event.user || LOCAL_USER_ID,
        occurred_at: event.occurred_at || event.occurredAt || event.at || event.created_at || event.createdAt,
        created_at: event.created_at || event.createdAt || event.occurred_at || event.occurredAt || event.at,
      }));
  }
  async recordEvent(event = {}) {
    const created = createAuditEvent(event.action || event.type || "local_event", event.reason || event.detail || "", {
      projectRef: event.projectRef || null,
      user: event.actorUserId || "local-demo",
      version: event.versionNo ?? null,
    });
    writeList(this.storage, AUDIT_KEY, appendEvent(readList(this.storage, AUDIT_KEY), created));
    return (await this.listEvents({ projectRef: created.projectRef })).find((candidate) => candidate.id === created.id);
  }
}

export class LocalDemoQuoteRepository extends QuoteRepository {
  constructor(storage) {
    super();
    this.storage = resolveStorage(storage);
  }
  async recordDesignRevision(input) {
    if (!input.inputsHash || !input.revisionId) throw new PlatformError(PLATFORM_ERROR_CODES.VALIDATION_FAILED, "Design revision identity is required.");
    return {
      id: input.id || uuid(),
      organisationId: LOCAL_ORGANISATION_ID,
      projectId: input.projectId,
      revisionId: input.revisionId,
      inputsHash: input.inputsHash,
      calculationVersion: input.calculationVersion,
      projectRevisionNo: input.projectRevisionNo,
      normalizedInputs: structuredClone(input.normalizedInputs || {}),
      sizingOptions: structuredClone(input.sizingOptions || []),
      localOnly: true,
      createdAt: new Date().toISOString(),
    };
  }
  async createDraft(input) { return this.create({ ...input, status: "DRAFT" }); }
  async issueQuote(input) { return this.create({ ...input, status: "ISSUED" }); }
  async create(input) {
    if (!input.inputsHash || input.inputsHash !== input.currentInputsHash) {
      throw new PlatformError(PLATFORM_ERROR_CODES.CONFLICT, "STALE_DESIGN: quote inputs do not match the current project.");
    }
    const rows = readList(this.storage, QUOTE_KEY);
    const quote = {
      id: uuid(), organisationId: LOCAL_ORGANISATION_ID, projectId: input.projectId,
      designRevisionId: input.designRevisionId, quoteRef: input.quoteRef,
      revisionNo: input.revisionNo, status: input.status, currency: input.currency || "KES",
      lineItems: structuredClone(input.lineItems || []), totals: structuredClone(input.totals || {}),
      pricingPolicyVersion: input.pricingPolicyVersion, taxRuleVersion: input.taxRuleVersion,
      inputsHash: input.inputsHash, localOnly: true, cloudSubmitted: false,
      createdAt: new Date().toISOString(), issuedAt: input.status === "ISSUED" ? new Date().toISOString() : null,
    };
    writeList(this.storage, QUOTE_KEY, [quote, ...rows]);
    return quote;
  }
  async listQuotes({ projectId }) {
    return readList(this.storage, QUOTE_KEY).filter((quote) => quote.projectId === projectId);
  }
  async getQuote({ quoteId, projectId }) {
    const quote = readList(this.storage, QUOTE_KEY).find((item) => item.id === quoteId && (!projectId || item.projectId === projectId));
    if (!quote) throw new PlatformError(PLATFORM_ERROR_CODES.NOT_FOUND, "Local quote was not found.");
    return quote;
  }
}

export class LocalDemoReviewRepository extends ReviewRepository {
  constructor(storage) {
    super();
    this.storage = resolveStorage(storage);
  }
  async listSubmissions({ projectId } = {}) {
    return readList(this.storage, REVIEW_KEY).filter((item) => !projectId || item.projectId === projectId);
  }
  async createSubmission(input) {
    const item = createLocalReviewSubmission({ ...input, id: uuid() });
    const items = readList(this.storage, REVIEW_KEY);
    writeList(this.storage, REVIEW_KEY, [item, ...items]);
    return item;
  }
  async transitionSubmission({ submissionId, to, actorUserId, reason }) {
    const items = readList(this.storage, REVIEW_KEY);
    const index = items.findIndex((item) => item.id === submissionId);
    if (index < 0) throw new PlatformError(PLATFORM_ERROR_CODES.NOT_FOUND, "Local review was not found.");
    items[index] = transitionReview(items[index], to, { actorUserId, reason });
    writeList(this.storage, REVIEW_KEY, items);
    return items[index];
  }
}

export function createLocalDemoPlatform(options = {}) {
  const storage = resolveStorage(options.storage);
  return assertPlatform({
    mode: "local-demo",
    cloudEnabled: false,
    authRequired: false,
    auth: new LocalDemoAuthProvider(options.role),
    projects: new LocalDemoProjectRepository(storage),
    evidence: new LocalDemoEvidenceRepository(storage),
    audit: new LocalDemoAuditRepository(storage),
    reviews: new LocalDemoReviewRepository(storage),
    quotes: new LocalDemoQuoteRepository(storage),
  });
}

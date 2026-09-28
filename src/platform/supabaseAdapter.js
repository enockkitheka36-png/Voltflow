import {
  AuthProvider,
  ProjectRepository,
  EvidenceRepository,
  AuditRepository,
  ReviewRepository,
  QuoteRepository,
  assertPlatform,
} from "./contracts.js";
import { mapProviderError, PlatformError, PLATFORM_ERROR_CODES } from "./errors.js";
import { EVIDENCE_BUCKET } from "./config.js";

function unwrap(data) {
  return Array.isArray(data) && data.length === 1 ? data[0] : data;
}

function projectRowToRecord(row) {
  if (!row) return null;
  return {
    ...(row.current_record || {}),
    id: row.id,
    organisationId: row.organisation_id,
    projectRef: row.project_ref,
    name: row.name,
    revisionNo: row.revision_no,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    savedAt: row.updated_at,
    archivedAt: row.archived_at,
    providerMode: "supabase",
  };
}

function evidenceRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organisationId: row.organisation_id,
    projectId: row.project_id,
    projectVersionId: row.project_version_id,
    kind: row.kind,
    title: row.title,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    checksumSha256: row.checksum_sha256,
    deviceCapturedAt: row.device_captured_at,
    serverReceivedAt: row.server_received_at,
    gps: row.gps_metadata,
    uploaderUserId: row.uploader_user_id,
    reviewStatus: row.review_status,
    photoType: row.photo_type,
    roofFaceId: row.roof_face_id,
    caption: row.caption,
    createdAt: row.created_at,
  };
}

function reviewRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organisationId: row.organisation_id,
    projectId: row.project_id,
    projectVersionId: row.project_version_id,
    status: row.status,
    requestedReviewerId: row.requested_reviewer_id,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cloudSubmitted: true,
  };
}

function quoteRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organisationId: row.organisation_id,
    projectId: row.project_id,
    designRevisionId: row.design_revision_id,
    quoteRef: row.quote_ref,
    revisionNo: row.revision_no,
    status: row.status,
    currency: row.currency,
    lineItems: row.line_items,
    pricingPolicyVersion: row.pricing_policy_version,
    taxRuleVersion: row.tax_rule_version,
    totals: row.totals,
    inputsHash: row.inputs_hash,
    createdAt: row.created_at,
    issuedAt: row.issued_at,
  };
}

async function checked(query, fallbackMessage) {
  try {
    const result = await query;
    if (result?.error) throw result.error;
    return result?.data;
  } catch (error) {
    throw mapProviderError(error, fallbackMessage);
  }
}

export class SupabaseAuthProvider extends AuthProvider {
  constructor(client) {
    super();
    this.client = client;
  }
  get providerName() { return "supabase"; }
  async getSession() {
    const data = await checked(this.client.auth.getSession(), "Could not read the authentication session.");
    return data?.session || null;
  }
  subscribe(listener) {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => listener?.(session));
    return () => data?.subscription?.unsubscribe();
  }
  async signIn({ email, password, useOtp = false }) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) throw new PlatformError(PLATFORM_ERROR_CODES.VALIDATION_FAILED, "Email is required.");
    if (useOtp) {
      const data = await checked(
        this.client.auth.signInWithOtp({ email: cleanEmail, options: { shouldCreateUser: false } }),
        "Could not send the sign-in link.",
      );
      return { ...data, otpSent: true };
    }
    if (!password) throw new PlatformError(PLATFORM_ERROR_CODES.VALIDATION_FAILED, "Password is required.");
    return checked(
      this.client.auth.signInWithPassword({ email: cleanEmail, password }),
      "Sign-in failed.",
    );
  }
  async signOut() {
    await checked(this.client.auth.signOut(), "Sign-out failed.");
    return true;
  }
  async getAuthorizationContext() {
    const session = await this.getSession();
    if (!session?.user?.id) throw new PlatformError(PLATFORM_ERROR_CODES.UNAUTHENTICATED, "Sign in to continue.");
    const [profile, memberships] = await Promise.all([
      checked(
        this.client.from("profiles").select("user_id,display_name,status,created_at,updated_at").eq("user_id", session.user.id).maybeSingle(),
        "Could not load the user profile.",
      ),
      checked(
        this.client.from("organisation_memberships")
          .select("id,organisation_id,role,status,created_at,organisation:organisations(id,name,slug,status)")
          .eq("user_id", session.user.id)
          .eq("status", "active"),
        "Could not load organisation memberships.",
      ),
    ]);
    return {
      localOnly: false,
      userId: session.user.id,
      email: session.user.email || "",
      profile: profile || { display_name: session.user.email || "User" },
      memberships: (memberships || []).map((membership) => ({
        id: membership.id,
        organisationId: membership.organisation_id,
        organisationName: membership.organisation?.name || "Organisation",
        organisationSlug: membership.organisation?.slug || "",
        role: membership.role,
        status: membership.status,
      })),
    };
  }
  async revokeMembership({ organisationId, membershipId, reason, requestId }) {
    return checked(
      this.client.rpc("revoke_organisation_membership", {
        p_organisation_id: organisationId,
        p_membership_id: membershipId,
        p_reason: reason || "Organisation access revoked",
        p_request_id: requestId || null,
      }),
      "Could not revoke the organisation membership.",
    );
  }
}

export class SupabaseProjectRepository extends ProjectRepository {
  constructor(client) {
    super();
    this.client = client;
  }
  async listProjects({ organisationId, includeArchived = false } = {}) {
    let query = this.client.from("projects")
      .select("id,organisation_id,project_ref,name,status,current_record,revision_no,created_at,updated_at,archived_at")
      .eq("organisation_id", organisationId)
      .order("updated_at", { ascending: false });
    if (!includeArchived) query = query.is("archived_at", null);
    const rows = await checked(query, "Could not list cloud projects.");
    return (rows || []).map(projectRowToRecord);
  }
  async loadProject({ organisationId, projectId }) {
    const row = await checked(
      this.client.from("projects")
        .select("id,organisation_id,project_ref,name,status,current_record,revision_no,created_at,updated_at,archived_at")
        .eq("organisation_id", organisationId)
        .eq("id", projectId)
        .single(),
      "Could not load the cloud project.",
    );
    return projectRowToRecord(row);
  }
  async createProject({ organisationId, record, requestId }) {
    const data = await checked(
      this.client.rpc("create_cloud_project", {
        p_organisation_id: organisationId,
        p_name: record.name || record.project?.client || "Untitled project",
        p_project_ref: record.projectRef || null,
        p_record: record,
        p_request_id: requestId || null,
      }),
      "Could not create the cloud project.",
    );
    return projectRowToRecord(unwrap(data));
  }
  async updateProject({ organisationId, projectId, expectedRevisionNo, expectedUpdatedAt, record, requestId, reason }) {
    const data = await checked(
      this.client.rpc("update_cloud_project", {
        p_organisation_id: organisationId,
        p_project_id: projectId,
        p_expected_revision_no: expectedRevisionNo,
        p_expected_updated_at: expectedUpdatedAt || null,
        p_record: record,
        p_reason: reason || "Project saved",
        p_request_id: requestId || null,
      }),
      "Could not update the cloud project.",
    );
    return projectRowToRecord(unwrap(data));
  }
  async archiveProject({ organisationId, projectId, expectedRevisionNo, requestId, reason }) {
    const data = await checked(
      this.client.rpc("archive_cloud_project", {
        p_organisation_id: organisationId,
        p_project_id: projectId,
        p_expected_revision_no: expectedRevisionNo,
        p_reason: reason || "Project archived",
        p_request_id: requestId || null,
      }),
      "Could not archive the cloud project.",
    );
    return projectRowToRecord(unwrap(data));
  }
  async createVersion({ organisationId, projectId, lifecycle, envelope, reportMetadata, boqRevision, requestId, reason }) {
    const data = await checked(
      this.client.rpc("create_project_version", {
        p_organisation_id: organisationId,
        p_project_id: projectId,
        p_lifecycle: lifecycle || "prepared",
        p_snapshot: envelope.snapshot,
        p_client_snapshot: envelope.publicSnapshot,
        p_bank_snapshot: envelope.bankSnapshot,
        p_field_snapshot: envelope.fieldSnapshot,
        p_report_metadata: reportMetadata || {},
        p_boq_revision: boqRevision || null,
        p_reason: reason || "Proposal version prepared",
        p_request_id: requestId || null,
      }),
      "Could not create an immutable project version.",
    );
    return unwrap(data);
  }
  async listVersions({ organisationId, projectId }) {
    return checked(
      this.client.from("project_versions")
        .select("id,organisation_id,project_id,version_no,lifecycle,snapshot_hash,client_snapshot_hash,schema_version,app_version,calculation_version,report_metadata,created_by,created_at,issued_at")
        .eq("organisation_id", organisationId)
        .eq("project_id", projectId)
        .order("version_no", { ascending: false }),
      "Could not list immutable project versions.",
    );
  }
  async importLegacyProject({ organisationId, migration, requestId }) {
    const data = await checked(
      this.client.rpc("import_legacy_project", {
        p_organisation_id: organisationId,
        p_name: migration.displayName,
        p_requested_project_ref: migration.requestedProjectRef,
        p_current_record: migration.currentRecord,
        p_source_fingerprint: migration.sourceFingerprint,
        p_provenance: migration.provenance,
        p_request_id: requestId || null,
      }),
      "Could not migrate the local project.",
    );
    return projectRowToRecord(unwrap(data));
  }
  async listSharedVersions({ organisationId, audience }) {
    const data = await checked(
      this.client.rpc("list_shared_project_versions", {
        p_organisation_id: organisationId,
        p_audience: audience,
      }),
      "Could not load shared project versions.",
    );
    return data || [];
  }
  async getTechnicianHome({ organisationId }) {
    const data = await checked(
      this.client.rpc("get_technician_home", { p_organisation_id: organisationId }),
      "Could not load assigned field work.",
    );
    return unwrap(data) || { projects: [], syncStatus: "cloud" };
  }
  async createShare(input) {
    return unwrap(await checked(
      this.client.rpc("create_project_share", {
        p_organisation_id: input.organisationId,
        p_project_id: input.projectId,
        p_project_version_id: input.projectVersionId,
        p_shared_with_user_id: input.sharedWithUserId,
        p_audience: input.audience,
        p_expires_at: input.expiresAt,
        p_request_id: input.requestId || null,
      }),
      "Could not share the approved project version.",
    ));
  }
  async revokeShare(input) {
    return unwrap(await checked(
      this.client.rpc("revoke_project_share", {
        p_organisation_id: input.organisationId,
        p_share_id: input.shareId,
        p_reason: input.reason,
        p_request_id: input.requestId || null,
      }),
      "Could not revoke the project share.",
    ));
  }
}

export class SupabaseEvidenceRepository extends EvidenceRepository {
  constructor(client, bucket = EVIDENCE_BUCKET) {
    super();
    this.client = client;
    this.bucket = bucket;
  }
  async listEvidence({ organisationId, projectId }) {
    const rows = await checked(
      this.client.from("evidence_items")
        .select("id,organisation_id,project_id,project_version_id,kind,title,storage_path,mime_type,size_bytes,checksum_sha256,device_captured_at,server_received_at,gps_metadata,uploader_user_id,review_status,photo_type,roof_face_id,caption,created_at")
        .eq("organisation_id", organisationId)
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      "Could not list project evidence.",
    );
    return (rows || []).map(evidenceRow);
  }
  async prepareUpload(input) {
    const rpcName = input.photoType ? "prepare_project_photo_upload" : "prepare_evidence_upload";
    const params = input.photoType ? {
      p_organisation_id: input.organisationId,
      p_project_id: input.projectId,
      p_project_version_id: input.projectVersionId || null,
      p_photo_type: input.photoType,
      p_roof_face_id: input.roofFaceId || null,
      p_title: input.title || input.filename || "Site photo",
      p_caption: input.caption || null,
      p_filename: input.filename,
      p_mime_type: input.mimeType,
      p_size_bytes: input.sizeBytes,
      p_expected_checksum_sha256: input.checksumSha256 || null,
      p_device_captured_at: input.deviceCapturedAt || null,
      p_gps_metadata: input.gps || {},
      p_request_id: input.requestId || null,
    } : {
      p_organisation_id: input.organisationId,
      p_project_id: input.projectId,
      p_project_version_id: input.projectVersionId || null,
      p_kind: input.kind || "other",
      p_title: input.title || input.filename || "Evidence",
      p_filename: input.filename,
      p_mime_type: input.mimeType,
      p_size_bytes: input.sizeBytes,
      p_device_captured_at: input.deviceCapturedAt || null,
      p_gps_metadata: input.gps || {},
      p_request_id: input.requestId || null,
    };
    const prepared = unwrap(await checked(
      this.client.rpc(rpcName, params),
      "Could not authorize the evidence upload.",
    ));
    if (!prepared?.storage_path) throw new PlatformError(PLATFORM_ERROR_CODES.INTERNAL_ERROR, "Evidence upload path was not returned.");
    const signed = await checked(
      this.client.storage.from(this.bucket).createSignedUploadUrl(prepared.storage_path),
      "Could not create the signed evidence upload.",
    );
    return {
      evidenceId: prepared.id,
      storagePath: prepared.storage_path,
      signedToken: signed.token,
      publicUrl: null,
      expiresInSeconds: 300,
    };
  }
  async uploadPreparedFile({ storagePath, signedToken, file, checksumSha256, onProgress }) {
    onProgress?.(10);
    const data = await checked(
      this.client.storage.from(this.bucket).uploadToSignedUrl(storagePath, signedToken, file, {
        contentType: file?.type || "application/octet-stream",
        upsert: false,
        metadata: checksumSha256 ? { checksum_sha256: checksumSha256 } : undefined,
      }),
      "Evidence upload failed.",
    );
    onProgress?.(100);
    return { ...data, publicUrl: null };
  }
  async completeUpload(input) {
    const data = await checked(
      this.client.rpc("complete_evidence_upload", {
        p_organisation_id: input.organisationId,
        p_evidence_id: input.evidenceId,
        p_checksum_sha256: input.checksumSha256,
        p_size_bytes: input.sizeBytes,
        p_request_id: input.requestId || null,
      }),
      "Could not finalize evidence metadata.",
    );
    return evidenceRow(unwrap(data));
  }
  async reviewEvidence(input) {
    const data = await checked(
      this.client.rpc("review_evidence", {
        p_organisation_id: input.organisationId,
        p_evidence_id: input.evidenceId,
        p_status: input.status,
        p_reason: input.reason || null,
        p_request_id: input.requestId || null,
      }),
      "Could not record the evidence review.",
    );
    return evidenceRow(unwrap(data));
  }
  async createDownloadUrl({ organisationId, evidenceId, expiresInSeconds = 300 }) {
    const authorized = unwrap(await checked(
      this.client.rpc("authorize_evidence_download", {
        p_organisation_id: organisationId,
        p_evidence_id: evidenceId,
      }),
      "Evidence download is not authorized.",
    ));
    const data = await checked(
      this.client.storage.from(this.bucket).createSignedUrl(
        authorized.storage_path,
        Math.max(30, Math.min(900, Number(expiresInSeconds) || 300)),
        { download: true },
      ),
      "Could not create the signed evidence download.",
    );
    return { signedUrl: data.signedUrl, publicUrl: null, expiresInSeconds };
  }
  async deleteEvidence({ organisationId, evidenceId, reason, requestId }) {
    const authorized = unwrap(await checked(
      this.client.rpc("authorize_evidence_delete", {
        p_organisation_id: organisationId,
        p_evidence_id: evidenceId,
        p_reason: reason || null,
      }),
      "Evidence deletion is not authorized.",
    ));
    await checked(
      this.client.storage.from(this.bucket).remove([authorized.storage_path]),
      "Could not remove the private evidence object.",
    );
    const deleted = unwrap(await checked(
      this.client.rpc("complete_evidence_delete", {
        p_organisation_id: organisationId,
        p_evidence_id: evidenceId,
        p_reason: reason || null,
        p_request_id: requestId || null,
      }),
      "Could not finalize evidence deletion.",
    ));
    return { deleted: true, evidenceId: deleted.id, publicUrl: null };
  }
}

export class SupabaseAuditRepository extends AuditRepository {
  constructor(client) {
    super();
    this.client = client;
  }
  async listEvents({ organisationId, projectId, limit = 200 }) {
    let query = this.client.from("audit_events")
      .select("id,organisation_id,project_id,project_version_id,actor_user_id,actor_role,action,old_fields,new_fields,request_id,reason,occurred_at,created_at")
      .eq("organisation_id", organisationId)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(500, Number(limit) || 200)));
    if (projectId) query = query.eq("project_id", projectId);
    return checked(query, "Could not load audit events.");
  }
  async recordEvent(input) {
    return unwrap(await checked(
      this.client.rpc("append_audit_event", {
        p_organisation_id: input.organisationId,
        p_project_id: input.projectId || null,
        p_project_version_id: input.projectVersionId || null,
        p_action: input.action,
        p_old_fields: input.oldFields || {},
        p_new_fields: input.newFields || {},
        p_request_id: input.requestId || null,
        p_reason: input.reason || null,
      }),
      "Could not record the audit event.",
    ));
  }
}

export class SupabaseQuoteRepository extends QuoteRepository {
  constructor(client) {
    super();
    this.client = client;
  }
  async recordDesignRevision(input) {
    return unwrap(await checked(
      this.client.rpc("record_design_revision", {
        p_organisation_id: input.organisationId,
        p_project_id: input.projectId,
        p_project_revision_no: input.projectRevisionNo,
        p_revision_id: input.revisionId,
        p_inputs_hash: input.inputsHash,
        p_calculation_version: input.calculationVersion,
        p_normalized_inputs: input.normalizedInputs || {},
        p_sizing_options: input.sizingOptions || [],
        p_request_id: input.requestId || null,
      }),
      "Could not record the design revision.",
    ));
  }
  async createDraft(input) { return this.create({ ...input, status: "DRAFT" }); }
  async issueQuote(input) { return this.create({ ...input, status: "ISSUED" }); }
  async create(input) {
    const data = await checked(
      this.client.rpc("create_project_quote", {
        p_organisation_id: input.organisationId,
        p_project_id: input.projectId,
        p_design_revision_id: input.designRevisionId,
        p_expected_inputs_hash: input.inputsHash,
        p_quote_ref: input.quoteRef,
        p_revision_no: input.revisionNo,
        p_status: input.status,
        p_currency: input.currency || "KES",
        p_line_items: input.lineItems || [],
        p_pricing_policy_version: input.pricingPolicyVersion,
        p_tax_rule_version: input.taxRuleVersion,
        p_totals: input.totals || {},
        p_request_id: input.requestId || null,
      }),
      "Could not record the project quote.",
    );
    return quoteRow(unwrap(data));
  }
  async listQuotes({ organisationId, projectId }) {
    const rows = await checked(
      this.client.from("quotes")
        .select("id,organisation_id,project_id,design_revision_id,quote_ref,revision_no,status,currency,line_items,pricing_policy_version,tax_rule_version,totals,inputs_hash,created_at,issued_at")
        .eq("organisation_id", organisationId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      "Could not list project quotes.",
    );
    return (rows || []).map(quoteRow);
  }
  async getQuote({ organisationId, projectId, quoteId }) {
    const row = await checked(
      this.client.from("quotes")
        .select("id,organisation_id,project_id,design_revision_id,quote_ref,revision_no,status,currency,line_items,pricing_policy_version,tax_rule_version,totals,inputs_hash,created_at,issued_at")
        .eq("organisation_id", organisationId)
        .eq("project_id", projectId)
        .eq("id", quoteId)
        .single(),
      "Could not load the project quote.",
    );
    return quoteRow(row);
  }
}

export class SupabaseReviewRepository extends ReviewRepository {
  constructor(client) {
    super();
    this.client = client;
  }
  async listSubmissions({ organisationId, projectId }) {
    let query = this.client.from("review_submissions")
      .select("id,organisation_id,project_id,project_version_id,status,requested_reviewer_id,submitted_by,submitted_at,reviewed_at,reason,created_at,updated_at")
      .eq("organisation_id", organisationId)
      .order("created_at", { ascending: false });
    if (projectId) query = query.eq("project_id", projectId);
    const rows = await checked(query, "Could not load review submissions.");
    return (rows || []).map(reviewRow);
  }
  async createSubmission(input) {
    const data = await checked(
      this.client.rpc("create_review_submission", {
        p_organisation_id: input.organisationId,
        p_project_id: input.projectId,
        p_project_version_id: input.projectVersionId,
        p_requested_reviewer_id: input.requestedReviewerId || null,
        p_reason: input.reason || null,
        p_request_id: input.requestId || null,
      }),
      "Could not create the review submission.",
    );
    return reviewRow(unwrap(data));
  }
  async transitionSubmission(input) {
    const data = await checked(
      this.client.rpc("transition_review_submission", {
        p_organisation_id: input.organisationId,
        p_submission_id: input.submissionId,
        p_next_status: input.to,
        p_reason: input.reason || null,
        p_request_id: input.requestId || null,
      }),
      "Could not update the review submission.",
    );
    return reviewRow(unwrap(data));
  }
}

export function createSupabasePlatform(client, options = {}) {
  return assertPlatform({
    mode: "supabase",
    cloudEnabled: true,
    authRequired: true,
    auth: new SupabaseAuthProvider(client),
    projects: new SupabaseProjectRepository(client),
    evidence: new SupabaseEvidenceRepository(client, options.evidenceBucket),
    audit: new SupabaseAuditRepository(client),
    reviews: new SupabaseReviewRepository(client),
    quotes: new SupabaseQuoteRepository(client),
  });
}

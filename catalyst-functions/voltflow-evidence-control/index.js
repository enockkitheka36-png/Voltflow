"use strict";
/*
 * voltflow-evidence-control — Catalyst Advanced I/O (Node) function.
 *
 * Privileged evidence-lifecycle operations that MUST NOT run in the browser.
 * Browser POSTs { action, ... } with credentials:"include". This function
 * RE-DERIVES the caller from the authenticated request and NEVER trusts client
 * identity/status/provider/bucket fields.
 *
 * Actions: FINALIZE_UPLOAD | VERIFY_EVIDENCE | REJECT_EVIDENCE | DELETE_DRAFT | GET_VERSION_DETAILS
 *
 * SDKs (verified against installed packages):
 *  - zcatalyst-sdk-node 2.5.1   -> auth (getCurrentUser), zcql, datastore (owned writes).
 *  - @zcatalyst/stratus         -> Stratus. StratusAdmin(app).bucket(name) gives admin-scope
 *    bucket with copyObject(src,dest), getObject(key)->Readable, headObject(key)->{size,version_id,...},
 *    deleteObject(key). Node SDK THROWS on error (error.statusCode); no resolve-with-401 quirk.
 *
 * Security (also enforce at Catalyst Security Rules: authentication=required, methods=["POST"]):
 *  - POST only; unauthenticated rejected before business logic.
 *  - draft/<ZUID>/...  (end users Get+Put)   verified/<ZUID>/...  (end users Get only, no Put/Delete)
 */
const crypto = require("crypto");
const catalystSDK = require("zcatalyst-sdk-node");
// @zcatalyst/stratus exports the admin-scope class as `Stratus`
// (index.d.ts: `export { StratusAdmin as Stratus }`). So new Stratus(app).bucket()
// is the admin bucket with copyObject/getObject/headObject/deleteObject.
const { Stratus: StratusAdmin } = require("@zcatalyst/stratus");

const EVIDENCE_TABLE = "Evidence";
const AUDIT_TABLE = "AuditEvents";
// Single server-side source of the bucket name; MUST equal EVIDENCE_BUCKET in the
// client adapter. Set to the ACTUAL globally-unique bucket name via env or here.
const BUCKET = process.env.VOLTFLOW_EVIDENCE_BUCKET || "voltflow-evidence-941921258";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_BYTES = 25 * 1024 * 1024;

function respond(res, httpStatus, obj) {
  res.status(httpStatus);
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(obj));
}
function sanitizeFileName(name) {
  const base = String(name || "evidence").split(/[\\/]/).pop() || "evidence";
  return (base.replace(/["<>#\\|\s]+/g, "_").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 120)) || "evidence.bin";
}
function draftKey(zuid, projectKey, evidenceKey, file) {
  return `draft/${zuid}/projects/${projectKey}/evidence/${evidenceKey}/${sanitizeFileName(file)}`;
}
function verifiedKey(zuid, projectKey, evidenceKey, file) {
  return `verified/${zuid}/projects/${projectKey}/evidence/${evidenceKey}/${sanitizeFileName(file)}`;
}
function ownsZuidPath(objectKey, zuid) {
  const parts = String(objectKey || "").split("/");
  return parts.length > 2 && parts[1] === String(zuid);
}

// Admin-scope Stratus bucket (for copy/get/head/delete). Pass the explicit
// admin-scope app (NOT the user app) so Stratus runs with admin privileges.
function adminBucket(adminApp) {
  return new StratusAdmin(adminApp).bucket(BUCKET);
}

async function getEvidenceByRowId(app, rowId) {
  const safe = String(rowId).replace(/[^0-9]/g, "");
  if (!safe) return null;
  const rows = await app.zcql().executeZCQLQuery(
    `SELECT ROWID, EvidenceKey, ProjectKey, ObjectKey, BucketName, Status, UploadedBy, FileName, EvidenceType, MimeType, FileSize, Sha256, Notes, RevisionNo
     FROM ${EVIDENCE_TABLE} WHERE ROWID = ${safe} LIMIT 1`,
  );
  return (rows && rows[0] && rows[0][EVIDENCE_TABLE]) || null;
}
async function writeAudit(app, { action, detail, projectRef, actorZuid }) {
  try {
    await app.datastore().table(AUDIT_TABLE).insertRow({
      Action: String(action).slice(0, 255),
      Detail: String(detail || "").slice(0, 9900),
      ProjectRef: String(projectRef || "").slice(0, 255),
      ActorUserId: String(actorZuid || "").slice(0, 255),
      OccurredAt: new Date().toISOString(),
    });
  } catch (e) { /* audit best-effort */ }
}

module.exports = async (req, res) => {
  if (String(req.method || "").toUpperCase() !== "POST") {
    return respond(res, 405, { status: "DENIED", message: "Method not allowed." });
  }
  // Explicit, separated SDK contexts (do not assume inheritance):
  //  baseApp  — request/caller identity (getCurrentUser)
  //  userApp  — DataStore/ZCQL as the App User (User-scope ownership)
  //  adminApp — privileged server ops (Stratus)
  let baseApp, userApp, adminApp, caller;
  try {
    baseApp = catalystSDK.initialize(req);
    caller = await baseApp.userManagement().getCurrentUser();
    if (!caller || !(caller.zuid || caller.user_id)) throw new Error("no user");
    userApp = catalystSDK.initialize(req, { scope: "user" });
    adminApp = catalystSDK.initialize(req, { scope: "admin" });
  } catch (e) {
    return respond(res, 401, { status: "DENIED", message: "Not authenticated." });
  }
  const callerZuid = String(caller.zuid || caller.user_id);
  const isAdmin = String((caller.role_details && caller.role_details.role_name) || "").toLowerCase().includes("admin");

  let body = {};
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {}); } catch { body = {}; }
  const action = String(body.action || "").toUpperCase();

  try {
    // -------------------------------------------------------------- FINALIZE_UPLOAD
    if (action === "FINALIZE_UPLOAD") {
      const evidenceKey = String(body.evidenceKey || "");
      const projectKey = String(body.projectKey || "");
      const objectKey = String(body.objectKey || "");
      if (!evidenceKey || !projectKey || !objectKey) return respond(res, 400, { status: "DENIED", message: "Missing evidenceKey/projectKey/objectKey." });
      const expected = draftKey(callerZuid, projectKey, evidenceKey, (objectKey.split("/").pop() || "evidence"));
      if (objectKey !== expected || !ownsZuidPath(objectKey, callerZuid)) {
        return respond(res, 403, { status: "DENIED", message: "Object key does not match caller's draft path." });
      }
      if (!ALLOWED_TYPES.includes(String(body.mimeType || "").toLowerCase())) return respond(res, 415, { status: "DENIED", message: "Unsupported file type." });
      if (Number(body.sizeBytes) > MAX_BYTES) return respond(res, 413, { status: "DENIED", message: "File too large." });
      // Confirm the uploaded draft object exists in Stratus.
      let head;
      try { head = await adminBucket(adminApp).headObject(objectKey, { throwErr: true }); }
      catch (e) { return respond(res, 409, { status: "DENIED", message: "Uploaded object not found in storage." }); }
      const serverSize = Number((head && head.size) || body.sizeBytes || 0);
      const now = new Date().toISOString();
      const rowData = {
        EvidenceKey: evidenceKey, ProjectKey: projectKey,
        EvidenceType: String(body.evidenceType || "OTHER").slice(0, 255),
        StorageProvider: "STRATUS", BucketName: BUCKET,
        ObjectKey: objectKey, ObjectVersionId: "",
        FileName: String(body.fileName || "evidence").slice(0, 255),
        MimeType: String(body.mimeType || "application/octet-stream").slice(0, 255),
        FileSize: serverSize, Sha256: String(body.sha256 || "").slice(0, 255),
        UploadedBy: callerZuid, UploadedAt: now, Status: "DRAFT", RevisionNo: 1,
        Notes: String(body.caption || "").slice(0, 9900),
      };
      let inserted;
      try {
        inserted = await userApp.datastore().table(EVIDENCE_TABLE).insertRow(rowData);
      } catch (e) {
        try { await adminBucket(adminApp).deleteObject(objectKey); } catch (e2) { /* ignore */ }
        await writeAudit(userApp, { action: "evidence_upload_orphan", detail: objectKey, projectRef: projectKey, actorZuid: callerZuid });
        return respond(res, 500, { status: "ERROR", message: "Metadata write failed; draft object removed. Retry." });
      }
      await writeAudit(userApp, { action: "evidence_uploaded", detail: `${rowData.EvidenceType} · ${rowData.FileName}`, projectRef: projectKey, actorZuid: callerZuid });
      return respond(res, 200, { status: "OK", evidence: { ...rowData, ROWID: inserted && (inserted.ROWID || inserted.rowid), CREATEDTIME: now } });
    }

    const row = await getEvidenceByRowId(userApp, body.evidenceId);
    if (!row) return respond(res, 404, { status: "DENIED", message: "Evidence not found." });
    const uploaderOwns = String(row.UploadedBy) === callerZuid;
    const pathOwned = ownsZuidPath(row.ObjectKey, row.UploadedBy);
    const status = String(row.Status || "DRAFT").toUpperCase();

    // -------------------------------------------------------------- VERIFY_EVIDENCE (copy-first)
    if (action === "VERIFY_EVIDENCE") {
      if (!isAdmin && !uploaderOwns) return respond(res, 403, { status: "DENIED", message: "Not authorized to verify." });
      if (status === "VERIFIED") return respond(res, 200, { status: "OK", evidenceStatus: "VERIFIED", message: "Already verified." });
      if (!pathOwned || !String(row.ObjectKey).startsWith("draft/")) return respond(res, 409, { status: "DENIED", message: "Draft object path invalid." });
      const bucket = adminBucket(adminApp);
      // 5) stream the draft object + 6) trusted SHA-256 incrementally (no full buffer).
      const stream = await bucket.getObject(row.ObjectKey);
      const hash = crypto.createHash("sha256");
      let bytes = 0;
      for await (const chunk of stream) { hash.update(chunk); bytes += chunk.length; }
      const serverSha = hash.digest("hex");
      // 7) server-side COPY draft -> verified.
      const vKey = verifiedKey(callerZuid, row.ProjectKey, row.EvidenceKey, String(row.FileName));
      await bucket.copyObject(row.ObjectKey, vKey);
      // 8) confirm destination + 9) size check + 10) versionId (version_id).
      let vHead;
      try { vHead = await bucket.headObject(vKey, { throwErr: true }); }
      catch (e) {
        try { await bucket.deleteObject(vKey); } catch (e2) { /* ignore */ }
        return respond(res, 500, { status: "ERROR", message: "Verified copy not found after copy; aborted." });
      }
      if (Number(vHead.size) !== bytes) {
        try { await bucket.deleteObject(vKey); } catch (e2) { /* ignore */ }
        return respond(res, 500, { status: "ERROR", message: "Verified copy size mismatch; aborted." });
      }
      const versionId = String(vHead.version_id || "");
      // 11) commit metadata ONLY after destination verified. Roll back copy on failure.
      try {
        await userApp.datastore().table(EVIDENCE_TABLE).updateRow({
          ROWID: row.ROWID, ObjectKey: vKey, ObjectVersionId: versionId, Sha256: serverSha,
          Status: "VERIFIED", VerifiedBy: callerZuid, VerifiedAt: new Date().toISOString(),
        });
      } catch (e) {
        try { await bucket.deleteObject(vKey); }
        catch (e2) { await writeAudit(userApp, { action: "evidence_verified_orphan", detail: vKey, projectRef: row.ProjectKey, actorZuid: callerZuid }); }
        return respond(res, 500, { status: "ERROR", message: "Verification commit failed; rolled back. Retry." });
      }
      // 12) audit
      await writeAudit(userApp, { action: "evidence_verified", detail: `${row.FileName} sha256:${serverSha.slice(0, 12)}`, projectRef: row.ProjectKey, actorZuid: callerZuid });
      // 13) best-effort delete the draft LAST. On failure, keep VERIFIED; record orphan.
      let draftCleanup = "deleted";
      try { await bucket.deleteObject(row.ObjectKey); }
      catch (e) {
        draftCleanup = "orphan";
        await writeAudit(userApp, { action: "evidence_draft_orphan", detail: row.ObjectKey, projectRef: row.ProjectKey, actorZuid: callerZuid });
      }
      return respond(res, 200, { status: "OK", evidenceStatus: "VERIFIED", objectKey: vKey, sha256: serverSha, objectVersionId: versionId, draftCleanup });
    }

    // -------------------------------------------------------------- REJECT_EVIDENCE
    if (action === "REJECT_EVIDENCE") {
      if (!isAdmin && !uploaderOwns) return respond(res, 403, { status: "DENIED", message: "Not authorized." });
      if (status === "VERIFIED") return respond(res, 403, { status: "DENIED", message: "Verified evidence is locked." });
      await userApp.datastore().table(EVIDENCE_TABLE).updateRow({ ROWID: row.ROWID, Status: "REJECTED" });
      await writeAudit(userApp, { action: "evidence_rejected", detail: row.FileName, projectRef: row.ProjectKey, actorZuid: callerZuid });
      return respond(res, 200, { status: "OK", evidenceStatus: "REJECTED" });
    }

    // -------------------------------------------------------------- DELETE_DRAFT
    if (action === "DELETE_DRAFT") {
      if (!(uploaderOwns && pathOwned)) return respond(res, 403, { status: "DENIED", message: "Not authorized to delete." });
      if (status !== "DRAFT") return respond(res, 403, { status: "DENIED", message: "Only DRAFT evidence can be deleted." });
      try { await adminBucket(adminApp).deleteObject(row.ObjectKey); } catch (e) { /* metadata is source of truth */ }
      await userApp.datastore().table(EVIDENCE_TABLE).deleteRow(row.ROWID);
      await writeAudit(userApp, { action: "evidence_deleted", detail: `${row.FileName} (${String(body.reason || "removed").slice(0, 120)})`, projectRef: row.ProjectKey, actorZuid: callerZuid });
      return respond(res, 200, { status: "OK", deleted: true });
    }

    // -------------------------------------------------------------- GET_VERSION_DETAILS
    if (action === "GET_VERSION_DETAILS") {
      if (!(uploaderOwns || isAdmin)) return respond(res, 403, { status: "DENIED", message: "Not authorized." });
      let details = null;
      try { details = await adminBucket(adminApp).headObject(row.ObjectKey, { throwErr: true }); } catch (e) { details = null; }
      return respond(res, 200, { status: "OK", objectKey: row.ObjectKey, versionId: details && details.version_id || null, size: details && details.size || null });
    }

    return respond(res, 400, { status: "DENIED", message: `Unknown action: ${action}` });
  } catch (e) {
    return respond(res, 500, { status: "ERROR", message: "Evidence operation failed.", detail: String((e && e.message) || e) });
  }
};

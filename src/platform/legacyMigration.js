import { canonicalize, hashCanonicalJson } from "./canonicalJson.js";
import { PlatformError, PLATFORM_ERROR_CODES } from "./errors.js";

export async function prepareLegacyProjectMigration(record, options = {}) {
  if (!record || typeof record !== "object" || Array.isArray(record) || !record.project || typeof record.project !== "object") {
    throw new PlatformError(PLATFORM_ERROR_CODES.VALIDATION_FAILED, "Legacy record must contain a project object.");
  }
  const sourceRecord = canonicalize(record);
  const sourceFingerprint = await hashCanonicalJson(sourceRecord);
  return {
    organisationId: options.organisationId || null,
    sourceFingerprint,
    displayName: record.name || record.project.client || "Untitled project",
    requestedProjectRef: record.projectRef || null,
    currentRecord: sourceRecord,
    provenance: {
      source: "voltflow_local_export",
      sourceSchemaVersion: record.schemaVersion || null,
      sourceAppVersion: record.appVersion || null,
      sourceRecordId: record.id != null ? String(record.id) : null,
      sourceProjectRef: record.projectRef || null,
      sourceSavedAt: record.savedAt || null,
      sourceExportedAt: record.exportedAt || null,
      sourceExportedBy: record.exportedBy || null,
      legacyApprovalsTrusted: false,
      legacyEvidenceTrusted: false,
    },
  };
}

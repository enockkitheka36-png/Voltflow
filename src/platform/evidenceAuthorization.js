import { canAccessEvidencePath } from "./accessControl.js";
import { PlatformError, PLATFORM_ERROR_CODES } from "./errors.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function safeEvidenceFilename(filename) {
  const raw = String(filename || "evidence.bin").split(/[\\/]/).pop() || "evidence.bin";
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 120);
  return cleaned || "evidence.bin";
}

export function buildEvidenceObjectPath({ organisationId, projectId, evidenceId, filename }) {
  const ids = [organisationId, projectId, evidenceId];
  if (!ids.every((id) => UUID_RE.test(String(id || "")))) {
    throw new PlatformError(PLATFORM_ERROR_CODES.VALIDATION_FAILED, "Evidence path requires valid UUID identifiers.");
  }
  return `${organisationId}/${projectId}/${evidenceId}/${safeEvidenceFilename(filename)}`;
}

export function parseEvidenceObjectPath(path) {
  const parts = String(path || "").split("/").filter(Boolean);
  if (parts.length < 4 || !parts.slice(0, 3).every((part) => UUID_RE.test(part))) return null;
  return {
    organisationId: parts[0],
    projectId: parts[1],
    evidenceId: parts[2],
    filename: parts.slice(3).join("/"),
  };
}

export function assertEvidencePathAccess(actor, path, access = {}) {
  if (!parseEvidenceObjectPath(path) || !canAccessEvidencePath(actor, path, access)) {
    throw new PlatformError(PLATFORM_ERROR_CODES.FORBIDDEN, "Evidence object access is not authorized.");
  }
  return true;
}

export async function checksumEvidenceFile(file) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new PlatformError(PLATFORM_ERROR_CODES.VALIDATION_FAILED, "An evidence file is required.");
  }
  if (!globalThis.crypto?.subtle) {
    throw new PlatformError(PLATFORM_ERROR_CODES.STORAGE_UNAVAILABLE, "Web Crypto SHA-256 is unavailable.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

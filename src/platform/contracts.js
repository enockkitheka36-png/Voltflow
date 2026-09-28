import { PlatformError, PLATFORM_ERROR_CODES } from "./errors.js";

function unimplemented(contract, method) {
  throw new PlatformError(
    PLATFORM_ERROR_CODES.NOT_CONFIGURED,
    `${contract}.${method} is not implemented by the selected provider.`,
  );
}

export class AuthProvider {
  get providerName() { return "abstract"; }
  async getSession() { return unimplemented("AuthProvider", "getSession"); }
  subscribe() { return unimplemented("AuthProvider", "subscribe"); }
  async signIn() { return unimplemented("AuthProvider", "signIn"); }
  async signOut() { return unimplemented("AuthProvider", "signOut"); }
  async getAuthorizationContext() { return unimplemented("AuthProvider", "getAuthorizationContext"); }
  async revokeMembership() { return unimplemented("AuthProvider", "revokeMembership"); }
}

export class ProjectRepository {
  async listProjects() { return unimplemented("ProjectRepository", "listProjects"); }
  async loadProject() { return unimplemented("ProjectRepository", "loadProject"); }
  async createProject() { return unimplemented("ProjectRepository", "createProject"); }
  async updateProject() { return unimplemented("ProjectRepository", "updateProject"); }
  async archiveProject() { return unimplemented("ProjectRepository", "archiveProject"); }
  async createVersion() { return unimplemented("ProjectRepository", "createVersion"); }
  async listVersions() { return unimplemented("ProjectRepository", "listVersions"); }
  async importLegacyProject() { return unimplemented("ProjectRepository", "importLegacyProject"); }
  async listSharedVersions() { return unimplemented("ProjectRepository", "listSharedVersions"); }
  async getTechnicianHome() { return unimplemented("ProjectRepository", "getTechnicianHome"); }
  async createShare() { return unimplemented("ProjectRepository", "createShare"); }
  async revokeShare() { return unimplemented("ProjectRepository", "revokeShare"); }
}

export class EvidenceRepository {
  async listEvidence() { return unimplemented("EvidenceRepository", "listEvidence"); }
  async prepareUpload() { return unimplemented("EvidenceRepository", "prepareUpload"); }
  async uploadPreparedFile() { return unimplemented("EvidenceRepository", "uploadPreparedFile"); }
  async completeUpload() { return unimplemented("EvidenceRepository", "completeUpload"); }
  async reviewEvidence() { return unimplemented("EvidenceRepository", "reviewEvidence"); }
  async createDownloadUrl() { return unimplemented("EvidenceRepository", "createDownloadUrl"); }
  async deleteEvidence() { return unimplemented("EvidenceRepository", "deleteEvidence"); }
}

export class QuoteRepository {
  async recordDesignRevision() { return unimplemented("QuoteRepository", "recordDesignRevision"); }
  async createDraft() { return unimplemented("QuoteRepository", "createDraft"); }
  async issueQuote() { return unimplemented("QuoteRepository", "issueQuote"); }
  async listQuotes() { return unimplemented("QuoteRepository", "listQuotes"); }
  async getQuote() { return unimplemented("QuoteRepository", "getQuote"); }
}

export class InventoryProvider {
  async listItems() { return unimplemented("InventoryProvider", "listItems"); }
  async getItem() { return unimplemented("InventoryProvider", "getItem"); }
  async getAvailability() { return unimplemented("InventoryProvider", "getAvailability"); }
  async getPrice() { return unimplemented("InventoryProvider", "getPrice"); }
  async syncItems() { return unimplemented("InventoryProvider", "syncItems"); }
}

export class AuditRepository {
  async listEvents() { return unimplemented("AuditRepository", "listEvents"); }
  async recordEvent() { return unimplemented("AuditRepository", "recordEvent"); }
}

export class ReviewRepository {
  async listSubmissions() { return unimplemented("ReviewRepository", "listSubmissions"); }
  async createSubmission() { return unimplemented("ReviewRepository", "createSubmission"); }
  async transitionSubmission() { return unimplemented("ReviewRepository", "transitionSubmission"); }
}

export function assertPlatform(platform) {
  const required = ["mode", "auth", "projects", "evidence", "audit", "reviews", "quotes"];
  const missing = required.filter((key) => !platform?.[key]);
  if (missing.length > 0) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.NOT_CONFIGURED,
      `Selected provider is missing: ${missing.join(", ")}.`,
    );
  }
  return platform;
}

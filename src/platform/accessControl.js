export const ORGANISATION_ROLES = Object.freeze([
  "manager",
  "engineer",
  "sales",
  "technician",
  "client",
  "bank",
]);

export const CAPABILITIES = Object.freeze({
  MANAGE_ORGANISATION: "manage_organisation",
  VIEW_FULL_PROJECT: "view_full_project",
  EDIT_PROJECT: "edit_project",
  VIEW_COMMERCIAL: "view_commercial",
  EDIT_COMMERCIAL: "edit_commercial",
  CREATE_VERSION: "create_version",
  ISSUE_PROPOSAL: "issue_proposal",
  REVIEW_ENGINEERING: "review_engineering",
  MANAGE_SHARES: "manage_shares",
  VIEW_ASSIGNED_FIELD_PROJECT: "view_assigned_field_project",
  CAPTURE_EVIDENCE: "capture_evidence",
  VIEW_SHARED_VERSION: "view_shared_version",
  READ_AUDIT: "read_audit",
});

const ROLE_CAPABILITIES = Object.freeze({
  manager: new Set(Object.values(CAPABILITIES)),
  engineer: new Set([
    CAPABILITIES.VIEW_FULL_PROJECT, CAPABILITIES.EDIT_PROJECT,
    CAPABILITIES.VIEW_COMMERCIAL, CAPABILITIES.CREATE_VERSION,
    CAPABILITIES.ISSUE_PROPOSAL, CAPABILITIES.REVIEW_ENGINEERING,
    CAPABILITIES.CAPTURE_EVIDENCE, CAPABILITIES.READ_AUDIT,
  ]),
  sales: new Set([
    CAPABILITIES.VIEW_FULL_PROJECT, CAPABILITIES.EDIT_PROJECT,
    CAPABILITIES.VIEW_COMMERCIAL, CAPABILITIES.EDIT_COMMERCIAL,
    CAPABILITIES.CREATE_VERSION, CAPABILITIES.ISSUE_PROPOSAL,
    CAPABILITIES.MANAGE_SHARES, CAPABILITIES.READ_AUDIT,
  ]),
  technician: new Set([
    CAPABILITIES.VIEW_ASSIGNED_FIELD_PROJECT,
    CAPABILITIES.CAPTURE_EVIDENCE,
  ]),
  client: new Set([CAPABILITIES.VIEW_SHARED_VERSION]),
  bank: new Set([CAPABILITIES.VIEW_SHARED_VERSION]),
});

const ALL_INTERNAL_TABS = new Set([
  "field-dashboard", "dashboard", "project", "site-survey", "roof-shading", "roof-layout",
  "electrical", "site-photos", "safety-risks", "loads", "energy-import", "generation",
  "battery", "inverter", "eng-compliance", "boq", "finance", "carbon", "installer-sim",
  "system-options", "proposal", "readiness", "storage", "feedback", "assistant", "delivery",
  "genset", "ev", "minigrid", "borehole", "compliance", "evidence", "studio", "assets-lib",
  "bank-flow", "new-project", "accessories",
]);

export const ROLE_TAB_ALLOWLISTS = Object.freeze({
  manager: ALL_INTERNAL_TABS,
  engineer: ALL_INTERNAL_TABS,
  sales: new Set([
    "field-dashboard", "dashboard", "project", "site-survey", "site-photos", "loads",
    "boq", "finance", "proposal", "readiness", "storage", "assistant", "delivery",
    "evidence", "studio", "assets-lib", "bank-flow", "new-project",
  ]),
  technician: new Set([
    "field-dashboard", "site-survey", "roof-shading", "roof-layout", "electrical",
    "site-photos", "safety-risks", "installer-sim", "delivery", "evidence",
  ]),
  client: new Set(["field-dashboard", "proposal"]),
  bank: new Set(["bank-flow", "proposal"]),
});

export function normalizeOrganisationRole(role, fallback = null) {
  const value = String(role || "").trim().toLowerCase();
  return ORGANISATION_ROLES.includes(value) ? value : fallback;
}

export function roleHasCapability(role, capability) {
  const normalized = normalizeOrganisationRole(role);
  return !!normalized && !!ROLE_CAPABILITIES[normalized]?.has(capability);
}

export function isTabAllowedForRole(tab, role) {
  const normalized = normalizeOrganisationRole(role);
  return !!normalized && !!ROLE_TAB_ALLOWLISTS[normalized]?.has(tab);
}

export function usesFullProjectWorkspace(role) {
  return roleHasCapability(role, CAPABILITIES.VIEW_FULL_PROJECT);
}

export function canAccessOrganisation(actor, organisationId) {
  return !!actor?.userId
    && actor.status === "active"
    && String(actor.organisationId) === String(organisationId);
}

export function canAccessProject(actor, project, action = "read") {
  if (!canAccessOrganisation(actor, project?.organisationId)) return false;
  if (["manager", "engineer", "sales"].includes(actor.role)) return true;
  if (actor.role === "technician") {
    return action !== "commercial"
      && Array.isArray(project.assignedUserIds)
      && project.assignedUserIds.includes(actor.userId);
  }
  if (actor.role === "client" || actor.role === "bank") {
    return action === "shared_version"
      && Array.isArray(project.sharedUserIds)
      && project.sharedUserIds.includes(actor.userId);
  }
  return false;
}

export function canAccessEvidencePath(actor, path, access = {}) {
  const parts = String(path || "").split("/").filter(Boolean);
  if (parts.length < 4) return false;
  const [organisationId, projectId] = parts;
  if (!canAccessOrganisation(actor, organisationId)) return false;
  if (["manager", "engineer"].includes(actor.role)) return true;
  if (actor.role === "technician") {
    return Array.isArray(access.assignedProjectIds) && access.assignedProjectIds.includes(projectId);
  }
  if (actor.role === "client" || actor.role === "bank") {
    return access.operation === "download"
      && Array.isArray(access.sharedProjectIds)
      && access.sharedProjectIds.includes(projectId)
      && access.reviewStatus === "verified";
  }
  return false;
}

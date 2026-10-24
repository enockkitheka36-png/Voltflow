import { CAPABILITIES, roleHasCapability } from "../platform/accessControl.js";

export function canExportProjectBackup(viewMode, { cloudEnabled = false, role = null } = {}) {
  return viewMode === "engineer" && (!cloudEnabled || roleHasCapability(role, CAPABILITIES.VIEW_FULL_PROJECT));
}

export async function saveCloudProjectAndRefresh({ projects, organisationId, projectId, expectedRevisionNo, record, requestId, onSaved }) {
  const saved = projectId
    ? await projects.updateProject({ organisationId, projectId, expectedRevisionNo, record, requestId, reason: "Project saved from Voltflow workspace" })
    : await projects.createProject({ organisationId, record, requestId });
  onSaved(saved);
  try {
    const records = await projects.listProjects({ organisationId });
    return { saved, records, refreshError: null };
  } catch (refreshError) {
    return { saved, records: null, refreshError };
  }
}

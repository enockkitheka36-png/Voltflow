export const WORKSPACE_GROUPS = [
  { id: "overview", label: "Overview", hint: "Your project at a glance" },
  { id: "plan", label: "Plan", hint: "Client, site and energy needs" },
  { id: "design", label: "Design", hint: "Size and check the system" },
  { id: "quote", label: "Quote", hint: "Costs and client proposal" },
  { id: "deliver", label: "Deliver", hint: "Readiness, evidence and progress" },
  { id: "workspace", label: "Workspace", hint: "Files, templates and help" },
];

const workspaceItems = [
  ["field-dashboard", "Dashboard", "overview"],
  ["dashboard", "Sizing overview", "overview"],
  ["new-project", "New project", "plan", "engineer"],
  ["project", "Project setup", "plan", "engineer"],
  ["site-survey", "Site survey", "plan", "technical"],
  ["roof-shading", "Roof & shading", "plan", "technical"],
  ["roof-layout", "Roof layout", "plan", "technical"],
  ["electrical", "Electrical assessment", "plan", "technical"],
  ["site-photos", "Site photos", "plan", "technical"],
  ["safety-risks", "Safety & risks", "plan", "technical"],
  ["loads", "Load assessment", "plan", "engineer"],
  ["energy-import", "Energy data import", "plan", "engineer"],
  ["generation", "PV + performance ratio", "design", "engineer"],
  ["battery", "Battery", "design", "engineer"],
  ["inverter", "Inverter + safety", "design", "engineer"],
  ["eng-compliance", "Engineering compliance", "design", "engineer"],
  ["system-options", "System options", "design", "engineer", ["Solar PV – Hybrid", "Off-grid", "Genset hybrid"]],
  ["borehole", "Solar borehole", "design", "technical"],
  ["genset", "Genset hybrid", "design", "engineer", ["Genset hybrid"]],
  ["ev", "EV charging", "design", "engineer", ["EV charging"]],
  ["minigrid", "Mini-grid", "design", "engineer", ["Mini-grid"]],
  ["installer-sim", "Installer simulation", "design", "technical"],
  ["finance", "Financials + DSCR", "quote", "engineer"],
  ["carbon", "Carbon credits", "quote", "engineer"],
  ["accessories", "Accessories / BOS", "quote", "engineer"],
  ["assets-lib", "Asset library", "quote", "engineer"],
  ["boq", "Bill of quantities", "quote", "engineer"],
  ["proposal", "Proposal", "quote"],
  ["delivery", "Project delivery", "deliver"],
  ["compliance", "Compliance", "deliver", "technical"],
  ["evidence", "Evidence & audit", "deliver", "technical"],
  ["readiness", "Project readiness", "deliver", "technical"],
  ["studio", "Voltflow Studio", "workspace", "technical"],
  ["storage", "Save / open projects", "workspace", "technical"],
  ["assistant", "AI assistant", "workspace"],
  ["feedback", "Send feedback", "workspace", "technical"],
];

export function getWorkspaceNavigation({ viewMode = "engineer", project = {}, canAccess = () => true } = {}) {
  const items = viewMode === "bank"
    ? [["bank-flow", "Bank lead & quote", "plan"], ["field-dashboard", "Dashboard", "overview"], ["proposal", "Proposal", "quote"], ["storage", "Save / open projects", "workspace"]]
    : workspaceItems.filter(([, , , audience, systemTypes]) =>
      (audience !== "engineer" || viewMode === "engineer")
      && (audience !== "technical" || viewMode !== "client")
      && (!systemTypes || systemTypes.includes(project.systemType)));

  return WORKSPACE_GROUPS.map((group) => ({
    ...group,
    items: items.filter(([key, , groupId]) => groupId === group.id && canAccess(key))
      .map(([key, label]) => ({ key, label: key === "delivery" && viewMode === "client" ? "Project progress" : label })),
  })).filter((group) => group.items.length > 0);
}

export function filterWorkspaceNavigation(groups, search) {
  const query = search.trim().toLowerCase();
  if (!query) return groups;
  return groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => `${group.label} ${item.label} ${item.key}`.toLowerCase().includes(query)),
  })).filter((group) => group.items.length > 0);
}

export function getWorkspaceLocation(groups, active) {
  const group = groups.find((entry) => entry.items.some((item) => item.key === active));
  return group ? { group, item: group.items.find((entry) => entry.key === active) } : null;
}

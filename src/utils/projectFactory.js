/**
 * projectFactory.js — Voltflow 11.4.1
 *
 * Clean startup: the app must NOT open with a fake client project loaded.
 *
 * The engineering baseline (PSH, module electricals, loss factors, costs,
 * cable sizes…) is still fully populated — those are neutral defaults an
 * engineer needs. Only the *client-identifying* fields are blanked, so nothing
 * on screen pretends to be a real project until the user creates one.
 *
 * Pure functions — no React, no DOM. Unit-testable.
 */

/** Fields that identify a specific client/site. Blank on a fresh start. */
export const BLANK_PROJECT_IDENTITY = {
  client: "",
  location: "",
  systemType: "",
  phase: "",
  siteProfile: "",
  monthlyBill: 0,
};

/** Fields the onboarding wizard collects. */
export const ONBOARDING_FIELDS = ["client", "location", "siteProfile", "phase", "monthlyBill", "systemType", "preparedBy", "siteType", "objectiveKey", "loadSourceKey"];

/**
 * createBlankProject(engineeringDefaults, overrides)
 * → engineering baseline + blanked client identity (+ any overrides).
 *
 * `isDemo` is always false here — demo data only ever comes from
 * demoProjects.js via createProjectFromDemo().
 */
export function createBlankProject(engineeringDefaults = {}, overrides = {}) {
  return {
    ...engineeringDefaults,
    ...BLANK_PROJECT_IDENTITY,
    preparedBy: engineeringDefaults.preparedBy || "Solarise Engineer",
    designStage: "Feasibility / Planning",
    isDemo: false,
    demoId: null,
    ...overrides,
  };
}

/**
 * createBlankLoads() → [] .
 * The load table starts empty; rows appear only when the user picks a load
 * source (manual entry, preset, energy import, blueprint template).
 */
export function createBlankLoads() {
  return [];
}

/** True when the project has no client identity yet (nothing real entered). */
export function isBlankProject(project = {}) {
  return !String(project.client || "").trim() && !String(project.location || "").trim();
}

/** Objectives offered in onboarding step 3 → the systemType they map to. */
export const PROJECT_OBJECTIVES = [
  { key: "residential_backup", label: "Residential backup", systemType: "Solar PV – Hybrid", hint: "Keep essential loads running during outages." },
  { key: "hybrid_bill", label: "Hybrid bill reduction", systemType: "Solar PV – Hybrid", hint: "Cut the monthly KPLC bill with grid support." },
  { key: "offgrid", label: "Off-grid", systemType: "Off-grid", hint: "No grid connection — solar and battery only." },
  { key: "genset_hybrid", label: "Genset hybrid", systemType: "Genset hybrid", hint: "Reduce diesel runtime and fuel cost." },
  { key: "ev", label: "EV charging", systemType: "EV charging", hint: "Charging infrastructure sizing." },
  { key: "minigrid", label: "Mini-grid", systemType: "Mini-grid", hint: "Community or multi-customer distribution." },
  { key: "commercial", label: "Commercial / industrial", systemType: "Solar PV – Hybrid", hint: "SME, institution or production facility." },
];

/** Load-source choices in onboarding step 4 → where the user lands next. */
export const LOAD_SOURCES = [
  { key: "manual", label: "Manual load assessment", tab: "loads", loadSource: "client_estimate", hint: "Enter appliances and run hours yourself." },
  { key: "energy_import", label: "Energy data import", tab: "energy-import", loadSource: "data_logger", hint: "Upload a data logger or interval CSV/XLSX." },
  { key: "kplc_bill", label: "KPLC bill estimate", tab: "project", loadSource: "kplc_bill", hint: "Estimate from the monthly bill amount." },
  { key: "blueprint", label: "Blueprint / new construction", tab: "loads", loadSource: "estimated", hint: "Building not built yet — use a template." },
  { key: "blank", label: "Start blank", tab: "project", loadSource: "client_estimate", hint: "Set everything up manually later." },
];

export function getObjective(key) {
  return PROJECT_OBJECTIVES.find((o) => o.key === key) || null;
}

export function getLoadSource(key) {
  return LOAD_SOURCES.find((s) => s.key === key) || null;
}

/** Keep the first load workspace aligned with the site selected in onboarding. */
export function inferLoadAssessmentMode(siteType = "", objectiveKey = "") {
  const normalized = String(siteType || "").trim().toLowerCase();
  if (normalized === "industrial") return "Industrial / Manufacturing";
  if (normalized === "commercial") return "Commercial & Industrial";
  if (normalized === "farm / agricultural" || normalized === "agricultural") return "Agricultural / Pumping";
  if (normalized === "school") return "School / Institution";
  if (normalized === "hospital / clinic") return "Hospital / Clinic";
  if (normalized === "residential") return "Residential";
  return objectiveKey === "commercial" ? "Commercial & Industrial" : "Residential";
}

/**
 * buildProjectFromOnboarding(engineeringDefaults, answers)
 * answers: { client, contact, preparedBy, location, siteProfile, phase,
 *            monthlyBill, objectiveKey, loadSourceKey }
 * → { project, nextTab, loadSourceKey }
 */
export function buildProjectFromOnboarding(engineeringDefaults = {}, answers = {}) {
  const objective = getObjective(answers.objectiveKey);
  const source = getLoadSource(answers.loadSourceKey);
  const loadAssessmentMode = inferLoadAssessmentMode(answers.siteType, answers.objectiveKey);
  const project = createBlankProject(engineeringDefaults, {
    client: String(answers.client || "").trim(),
    location: String(answers.location || "").trim(),
    preparedBy: String(answers.preparedBy || "").trim() || "Solarise Engineer",
    siteProfile: answers.siteProfile || "",
    phase: answers.phase || "",
    monthlyBill: Math.max(0, Number(answers.monthlyBill) || 0),
    systemType: objective ? objective.systemType : "",
    loadSource: source ? source.loadSource : "client_estimate",
    siteType: String(answers.siteType || "").trim(),
    objectiveKey: answers.objectiveKey || "",
    objectiveLabel: objective ? objective.label : "",
    loadSourceKey: answers.loadSourceKey || "blank",
    loadSourceLabel: source ? source.label : "",
    loadAssessmentMode,
    sizingMode: answers.loadSourceKey === "blueprint" ? "blueprint_new_build" : "existing_site",
    clientContact: String(answers.contact || "").trim(),
    createdAt: new Date().toISOString(),
  });
  return { project, nextTab: source ? source.tab : "project", loadSourceKey: answers.loadSourceKey || "blank", loadAssessmentMode };
}

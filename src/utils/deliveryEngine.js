/**
 * deliveryEngine.js — Voltflow Delivery (EPC project management layer)
 *
 * Pure functions — no React, no DOM. Everything here operates on a
 * `project.delivery` object, which rides along with the project through
 * save/load/export/import automatically.
 *
 * This is solar-EPC specific: stages, tasks, procurement and checklists are
 * modelled on how a Kenyan solar EPC job actually runs (lead → survey →
 * sizing → proposal → client approval → procurement → installation →
 * commissioning → handover → O&M), not a generic kanban.
 *
 * It supports delivery *coordination*. It is not a certified engineering
 * approval system — sign-off gates record that a human approved something,
 * they do not themselves approve anything.
 */

let idCounter = 0;
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;
const nowIso = () => new Date().toISOString();

// ─── Stages ─────────────────────────────────────────────────────────────────

export const PROJECT_STAGES = [
  { key: "lead",                    label: "Lead",                    group: "Survey",       order: 0 },
  { key: "survey_scheduled",        label: "Survey scheduled",        group: "Survey",       order: 1 },
  { key: "survey_done",             label: "Survey done",             group: "Survey",       order: 2 },
  { key: "sizing_in_progress",      label: "Sizing in progress",      group: "Design",       order: 3 },
  { key: "proposal_draft",          label: "Proposal draft",          group: "Proposal",     order: 4 },
  { key: "proposal_sent",           label: "Proposal sent",           group: "Proposal",     order: 5 },
  { key: "client_approved",         label: "Client approved",         group: "Proposal",     order: 6 },
  { key: "procurement",             label: "Procurement",             group: "Procurement",  order: 7 },
  { key: "installation_scheduled",  label: "Installation scheduled",  group: "Installation", order: 8 },
  { key: "installation_in_progress",label: "Installation in progress",group: "Installation", order: 9 },
  { key: "commissioning",           label: "Commissioning",           group: "Installation", order: 10 },
  { key: "handover_done",           label: "Handover done",           group: "Handover",     order: 11 },
  { key: "om_monitoring",           label: "O&M monitoring",          group: "O&M",          order: 12 },
  { key: "lost",                    label: "Lost",                    group: "Closed",       order: 98, terminal: true },
  { key: "cancelled",               label: "Cancelled",               group: "Closed",       order: 99, terminal: true },
];

export const STAGE_BOARD_COLUMNS = ["Survey", "Design", "Proposal", "Procurement", "Installation", "Handover", "O&M"];

export const ACTIVE_STAGE_COUNT = PROJECT_STAGES.filter((s) => !s.terminal).length; // 13

export function getStage(key) {
  return PROJECT_STAGES.find((s) => s.key === key) || null;
}

export const TASK_CATEGORIES = ["sales", "survey", "design", "proposal", "procurement", "installation", "commissioning", "handover", "om"];
export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done"];
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"];
export const PROCUREMENT_STATUSES = ["needed", "quoted", "ordered", "received", "installed"];
export const ISSUE_SEVERITIES = ["low", "medium", "high", "critical"];
export const ISSUE_STATUSES = ["open", "in_progress", "resolved"];

// ─── Installation checklist (delivery sign-off record) ──────────────────────
// Complements — does not replace — the 19-step sequence tick-list in the
// Installer Simulation tab. This one carries owner / date / notes for handover.

export const INSTALLATION_CHECKLIST_ITEMS = [
  { key: "safety_briefing",     label: "Site safety briefing completed",        phase: "Preparation" },
  { key: "roof_access",         label: "Roof access confirmed and safe",        phase: "Preparation" },
  { key: "mounting",            label: "Mounting structure installed",          phase: "Mechanical" },
  { key: "panels",              label: "Panels installed and clamped",          phase: "Mechanical" },
  { key: "dc_cabling",          label: "DC cabling completed",                  phase: "Electrical" },
  { key: "inverter_mounted",    label: "Inverter mounted",                      phase: "Electrical" },
  { key: "battery_installed",   label: "Battery installed",                     phase: "Electrical" },
  { key: "ac_integration",      label: "AC integration completed",              phase: "Electrical" },
  { key: "earthing",            label: "Earthing checked and continuous",       phase: "Electrical" },
  { key: "spd",                 label: "SPD installed (DC and AC)",             phase: "Electrical" },
  { key: "monitoring",          label: "Monitoring configured",                 phase: "Commissioning" },
  { key: "inverter_commissioned", label: "Inverter commissioned",               phase: "Commissioning" },
  { key: "battery_comms",       label: "Battery communication checked",         phase: "Commissioning" },
  { key: "client_training",     label: "Client training completed",             phase: "Handover" },
  { key: "handover_photos",     label: "Handover photos captured",              phase: "Handover" },
  { key: "handover_signed",     label: "Handover document signed",              phase: "Handover" },
];

export const APPROVAL_GATES = [
  { key: "proposalApproved",      label: "Proposal ready",       requiredForStage: "proposal_sent" },
  { key: "clientApproved",        label: "Client approved",      requiredForStage: "procurement" },
  { key: "depositPaid",           label: "Deposit received",     requiredForStage: "procurement" },
  { key: "procurementApproved",   label: "Procurement approved", requiredForStage: "installation_scheduled" },
  { key: "installationApproved",  label: "Installation ready",   requiredForStage: "installation_in_progress" },
  { key: "commissioningApproved", label: "Commissioning passed", requiredForStage: "handover_done" },
  { key: "handoverSigned",        label: "Handover signed",      requiredForStage: "om_monitoring" },
];

// ─── Factories ──────────────────────────────────────────────────────────────

export function createTask(overrides = {}) {
  return {
    id: uid("task"),
    title: "New task",
    category: "installation",
    owner: "",
    dueDate: "",
    status: "todo",
    priority: "medium",
    notes: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...overrides,
  };
}

export function createProcurementItem(overrides = {}) {
  return {
    id: uid("proc"),
    item: "New item",
    category: "Other",
    requiredQty: 0,
    availableQty: 0,
    orderedQty: 0,
    receivedQty: 0,
    unit: "piece",
    supplier: "",
    unitCost: 0,
    status: "needed",
    linkedBoqItem: null,
    manuallyEdited: false,
    ...overrides,
  };
}

export function createIssue(overrides = {}) {
  return {
    id: uid("issue"),
    title: "New issue",
    severity: "medium",
    owner: "",
    status: "open",
    notes: "",
    resolutionNotes: "",
    clientVisible: false,
    createdAt: nowIso(),
    resolvedAt: null,
    ...overrides,
  };
}

function createChecklist() {
  return INSTALLATION_CHECKLIST_ITEMS.map((i) => ({
    key: i.key, label: i.label, phase: i.phase,
    complete: false, owner: "", notes: "", dateCompleted: "",
  }));
}

function createApprovals() {
  const a = {};
  APPROVAL_GATES.forEach((g) => { a[g.key] = { approved: false, approvedBy: "", approvedAt: null, notes: "" }; });
  return a;
}

/** Default tasks for the project's stage and system type — solar-EPC specific. */
export function generateDefaultTasks(project = {}) {
  const sys = project.systemType || "";
  const t = [];
  const add = (title, category, priority = "medium") => t.push(createTask({ title, category, priority }));

  add("Confirm client contact details and site access", "sales", "high");
  add("Schedule and complete site survey", "survey", "high");
  add("Capture roof photos, DB photos and meter details", "survey");
  add("Confirm earthing arrangement on site", "survey", "high");
  add("Complete load assessment and confirm with client", "design", "high");
  add("Review engineering compliance flags", "design", "high");
  add("Confirm roof layout and string plan", "design");
  add("Prepare proposal and BoQ", "proposal", "high");
  add("Send proposal and log client response", "proposal");
  add("Raise purchase orders for major equipment", "procurement", "high");
  add("Confirm delivery lead times with suppliers", "procurement");
  add("Book installation team and transport", "installation", "high");
  add("Complete installation checklist on site", "installation", "high");
  add("Commission inverter and verify monitoring", "commissioning", "high");
  add("Record as-built measurements (Voc/Isc, cable runs)", "commissioning");
  add("Client training and handover pack", "handover", "high");
  add("Schedule first O&M inspection", "om", "low");

  // System-type specific
  if (sys === "Genset hybrid") {
    add("Confirm ATS/changeover interface with genset supplier", "design", "high");
    add("Verify genset minimum loading and control strategy", "commissioning", "high");
  }
  if (sys === "EV charging") {
    add("Confirm charger make/model and OCPP requirement", "design", "high");
    add("Confirm supply capacity for simultaneous charging", "design", "high");
  }
  if (sys === "Mini-grid") {
    add("Confirm customer connection list and metering plan", "design", "high");
    add("Confirm distribution/reticulation scope and permits", "procurement", "high");
  }
  if (sys === "Off-grid") {
    add("Confirm autonomy expectation and generator backup plan", "design", "high");
  }
  if (project.sizingMode === "blueprint_new_build") {
    add("Obtain final equipment schedule / MEP drawings", "design", "urgent");
    add("Re-verify sizing once building loads are confirmed", "design", "high");
  }
  return t;
}

/**
 * generateProcurementFromBoq(boqRows)
 * boqRows: [{ code, item, qty, unit, unitCost, category }] — App.jsx maps both
 * the engineering BoQ (positional arrays) and the accessories BoQ into this.
 */
export function generateProcurementFromBoq(boqRows = []) {
  return boqRows
    .filter((r) => r && r.item && (Number(r.qty) || 0) > 0)
    .map((r) => createProcurementItem({
      item: r.item,
      category: r.category || "Equipment",
      requiredQty: Math.max(0, Number(r.qty) || 0),
      unit: r.unit || "piece",
      unitCost: Math.max(0, Number(r.unitCost) || 0),
      linkedBoqItem: r.code || r.itemCode || null,
    }));
}

/**
 * mergeProcurement(existing, generated)
 * Regenerating from BoQ must never silently discard manual edits: rows the
 * user touched are kept as-is, new rows are appended, and untouched rows are
 * refreshed. Returns { items, kept, added, refreshed }.
 */
export function mergeProcurement(existing = [], generated = []) {
  const byKey = new Map();
  existing.forEach((e) => byKey.set(e.linkedBoqItem || e.item, e));
  let kept = 0, added = 0, refreshed = 0;
  const items = [];

  generated.forEach((g) => {
    const key = g.linkedBoqItem || g.item;
    const prev = byKey.get(key);
    if (!prev) { items.push(g); added++; return; }
    byKey.delete(key);
    if (prev.manuallyEdited) { items.push(prev); kept++; }
    else {
      items.push({ ...prev, item: g.item, requiredQty: g.requiredQty, unit: g.unit, unitCost: g.unitCost, category: g.category });
      refreshed++;
    }
  });
  // Anything the user added by hand that isn't in the BoQ survives
  byKey.forEach((leftover) => { items.push(leftover); kept++; });
  return { items, kept, added, refreshed };
}

export function createDefaultDelivery(project = {}, sizing = {}, boqRows = [], options = {}) {
  const timestamp = options.timestamp === undefined ? nowIso() : options.timestamp;
  const stablePrefix = String(options.stableIdPrefix || "").replace(/[^a-z0-9_-]/gi, "").toLowerCase();
  const tasks = generateDefaultTasks(project).map((task, index) => stablePrefix ? {
    ...task,
    id: `task_${stablePrefix}_${index + 1}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  } : task);
  const procurementItems = generateProcurementFromBoq(boqRows).map((item, index) => stablePrefix ? {
    ...item,
    id: `proc_${stablePrefix}_${index + 1}`,
  } : item);
  return {
    stage: "lead",
    priority: "medium",
    owner: project.preparedBy || "",
    expectedStartDate: "",
    expectedCompletionDate: "",
    projectValue: Math.max(0, Number(sizing.totalCost) || 0),
    tasks,
    procurementItems,
    installationChecklist: createChecklist(),
    issues: [],
    approvals: createApprovals(),
    handover: {
      completed: false,
      handoverDate: "",
      handedOverBy: "",
      receivedBy: "",
      documentsIssued: false,
      trainingCompleted: false,
      notes: "",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// ─── Normalisation (migration-safe) ─────────────────────────────────────────

const clampTo = (list, v, fallback) => (list.includes(v) ? v : fallback);

/** Backfills any missing field so old saved projects never crash the UI. */
export function normalizeDelivery(raw, project = {}) {
  const d = raw && typeof raw === "object" ? raw : {};
  const checklistRaw = Array.isArray(d.installationChecklist) ? d.installationChecklist : [];
  const checklist = INSTALLATION_CHECKLIST_ITEMS.map((item) => {
    const prev = checklistRaw.find((c) => c && c.key === item.key) || {};
    return {
      key: item.key, label: item.label, phase: item.phase,
      complete: !!prev.complete,
      owner: typeof prev.owner === "string" ? prev.owner : "",
      notes: typeof prev.notes === "string" ? prev.notes : "",
      dateCompleted: typeof prev.dateCompleted === "string" ? prev.dateCompleted : "",
    };
  });

  const approvals = createApprovals();
  if (d.approvals && typeof d.approvals === "object") {
    Object.keys(approvals).forEach((k) => {
      const prev = d.approvals[k];
      if (typeof prev === "boolean") approvals[k] = { approved: prev, approvedBy: "", approvedAt: null, notes: "" };
      else if (prev && typeof prev === "object") {
        approvals[k] = {
          approved: !!prev.approved,
          approvedBy: typeof prev.approvedBy === "string" ? prev.approvedBy : "",
          approvedAt: prev.approvedAt || null,
          notes: typeof prev.notes === "string" ? prev.notes : "",
        };
      }
    });
  }

  return {
    stage: getStage(d.stage) ? d.stage : "lead",
    priority: clampTo(TASK_PRIORITIES, d.priority, "medium"),
    owner: typeof d.owner === "string" ? d.owner : (project.preparedBy || ""),
    expectedStartDate: typeof d.expectedStartDate === "string" ? d.expectedStartDate : "",
    expectedCompletionDate: typeof d.expectedCompletionDate === "string" ? d.expectedCompletionDate : "",
    projectValue: Math.max(0, Number(d.projectValue) || 0),
    tasks: (Array.isArray(d.tasks) ? d.tasks : []).filter(Boolean).map((t, index) => ({
      id: `task_migrated_${index + 1}`,
      title: "New task",
      category: "installation",
      owner: "",
      dueDate: "",
      status: "todo",
      priority: "medium",
      notes: "",
      createdAt: null,
      updatedAt: null,
      ...t,
      id: t.id || `task_migrated_${index + 1}`,
      createdAt: t.createdAt || null,
      updatedAt: t.updatedAt || t.createdAt || null,
      status: clampTo(TASK_STATUSES, t.status, "todo"),
      priority: clampTo(TASK_PRIORITIES, t.priority, "medium"),
      category: TASK_CATEGORIES.includes(t.category) ? t.category : "installation",
    })),
    procurementItems: (Array.isArray(d.procurementItems) ? d.procurementItems : []).filter(Boolean).map((p, index) => ({
      id: `proc_migrated_${index + 1}`,
      item: "New item",
      category: "Other",
      requiredQty: 0,
      availableQty: 0,
      orderedQty: 0,
      receivedQty: 0,
      unit: "piece",
      supplier: "",
      unitCost: 0,
      status: "needed",
      linkedBoqItem: null,
      manuallyEdited: false,
      ...p,
      id: p.id || `proc_migrated_${index + 1}`,
      status: clampTo(PROCUREMENT_STATUSES, p.status, "needed"),
    })),
    installationChecklist: checklist,
    issues: (Array.isArray(d.issues) ? d.issues : []).filter(Boolean).map((i, index) => ({
      id: `issue_migrated_${index + 1}`,
      title: "New issue",
      severity: "medium",
      owner: "",
      status: "open",
      notes: "",
      resolutionNotes: "",
      clientVisible: false,
      createdAt: null,
      resolvedAt: null,
      ...i,
      id: i.id || `issue_migrated_${index + 1}`,
      createdAt: i.createdAt || null,
      severity: clampTo(ISSUE_SEVERITIES, i.severity, "medium"),
      status: clampTo(ISSUE_STATUSES, i.status, "open"),
    })),
    approvals,
    handover: {
      completed: !!d.handover?.completed,
      handoverDate: d.handover?.handoverDate || "",
      handedOverBy: d.handover?.handedOverBy || "",
      receivedBy: d.handover?.receivedBy || "",
      documentsIssued: !!d.handover?.documentsIssued,
      trainingCompleted: !!d.handover?.trainingCompleted,
      notes: d.handover?.notes || "",
    },
    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || d.createdAt || null,
  };
}

// ─── Progress & summaries ───────────────────────────────────────────────────

/** getStageProgress(delivery) → { index, total, percent, label, group, terminal } */
export function getStageProgress(delivery = {}) {
  const stage = getStage(delivery.stage) || PROJECT_STAGES[0];
  if (stage.terminal) {
    return { index: stage.order, total: ACTIVE_STAGE_COUNT, percent: 0, label: stage.label, group: stage.group, terminal: true };
  }
  const percent = Math.round((stage.order / (ACTIVE_STAGE_COUNT - 1)) * 100);
  return { index: stage.order, total: ACTIVE_STAGE_COUNT, percent, label: stage.label, group: stage.group, terminal: false };
}

export function getChecklistProgress(delivery = {}) {
  const list = Array.isArray(delivery.installationChecklist) ? delivery.installationChecklist : [];
  const done = list.filter((c) => c.complete).length;
  return { done, total: list.length, percent: list.length > 0 ? Math.round((done / list.length) * 100) : 0 };
}

export function summarizeDelivery(delivery = {}) {
  const tasks = Array.isArray(delivery.tasks) ? delivery.tasks : [];
  const procurement = Array.isArray(delivery.procurementItems) ? delivery.procurementItems : [];
  const issues = Array.isArray(delivery.issues) ? delivery.issues : [];
  const checklist = getChecklistProgress(delivery);
  const stage = getStageProgress(delivery);

  const byStatus = (s) => tasks.filter((t) => t.status === s).length;
  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today).length;

  const procurementValue = procurement.reduce((s, p) => s + (Number(p.requiredQty) || 0) * (Number(p.unitCost) || 0), 0);
  const receivedValue = procurement.reduce((s, p) => s + (Number(p.receivedQty) || 0) * (Number(p.unitCost) || 0), 0);
  const shortages = procurement.filter((p) => (Number(p.receivedQty) || 0) < (Number(p.requiredQty) || 0) && p.status !== "installed");

  const approvals = delivery.approvals || {};
  const approvalsGranted = APPROVAL_GATES.filter((g) => approvals[g.key]?.approved).length;

  return {
    stage,
    tasks: {
      total: tasks.length,
      todo: byStatus("todo"),
      inProgress: byStatus("in_progress"),
      blocked: byStatus("blocked"),
      done: byStatus("done"),
      overdue: overdueTasks,
      percentComplete: tasks.length > 0 ? Math.round((byStatus("done") / tasks.length) * 100) : 0,
    },
    procurement: {
      total: procurement.length,
      needed: procurement.filter((p) => p.status === "needed").length,
      ordered: procurement.filter((p) => p.status === "ordered").length,
      received: procurement.filter((p) => p.status === "received").length,
      installed: procurement.filter((p) => p.status === "installed").length,
      shortages: shortages.length,
      totalValue: Math.round(procurementValue),
      receivedValue: Math.round(receivedValue),
    },
    issues: {
      total: issues.length,
      open: issues.filter((i) => i.status !== "resolved").length,
      critical: issues.filter((i) => i.severity === "critical" && i.status !== "resolved").length,
      resolved: issues.filter((i) => i.status === "resolved").length,
    },
    checklist,
    approvals: { granted: approvalsGranted, total: APPROVAL_GATES.length },
  };
}

/** Everything currently holding the project up. */
export function getBlockedItems(delivery = {}) {
  const blockers = [];
  (Array.isArray(delivery.issues) ? delivery.issues : [])
    .filter((i) => i.status !== "resolved" && (i.severity === "critical" || i.severity === "high"))
    .forEach((i) => blockers.push({
      type: "issue",
      severity: i.severity === "critical" ? "critical" : "high",
      label: i.title,
      detail: i.owner ? `Owner: ${i.owner}` : "No owner assigned",
      id: i.id,
    }));

  (Array.isArray(delivery.tasks) ? delivery.tasks : [])
    .filter((t) => t.status === "blocked")
    .forEach((t) => blockers.push({
      type: "task", severity: "high", label: t.title,
      detail: t.notes || (t.owner ? `Owner: ${t.owner}` : "No owner assigned"), id: t.id,
    }));

  const today = new Date().toISOString().slice(0, 10);
  (Array.isArray(delivery.tasks) ? delivery.tasks : [])
    .filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today)
    .forEach((t) => blockers.push({
      type: "overdue", severity: "medium", label: `Overdue: ${t.title}`,
      detail: `Due ${t.dueDate}`, id: t.id,
    }));

  (Array.isArray(delivery.procurementItems) ? delivery.procurementItems : [])
    .filter((p) => p.status !== "installed" && (Number(p.receivedQty) || 0) < (Number(p.requiredQty) || 0))
    .slice(0, 10)
    .forEach((p) => blockers.push({
      type: "procurement", severity: "medium",
      label: `Short: ${p.item}`,
      detail: `${p.receivedQty || 0} of ${p.requiredQty} ${p.unit} received`,
      id: p.id,
    }));

  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  return blockers.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));
}

/** Practical "what should happen next" list, driven by stage + state. */
export function getNextActions(delivery = {}, project = {}, sizing = {}) {
  const actions = [];
  const s = summarizeDelivery(delivery);
  const approvals = delivery.approvals || {};
  const stage = delivery.stage;

  if (s.issues.critical > 0) actions.push(`Resolve ${s.issues.critical} critical issue(s) before progressing.`);
  if (s.tasks.blocked > 0) actions.push(`Unblock ${s.tasks.blocked} blocked task(s).`);
  if (s.tasks.overdue > 0) actions.push(`${s.tasks.overdue} task(s) are overdue — reschedule or close them.`);

  switch (stage) {
    case "lead":
      actions.push("Schedule the site survey and confirm client contact details."); break;
    case "survey_scheduled":
      actions.push("Complete the site survey and capture photos, earthing and DB details."); break;
    case "survey_done":
      actions.push("Complete the load assessment and run the sizing."); break;
    case "sizing_in_progress":
      actions.push("Clear engineering compliance flags, then draft the proposal."); break;
    case "proposal_draft":
      actions.push("Finish the proposal and send it to the client."); break;
    case "proposal_sent":
      actions.push("Follow up with the client and record approval or loss."); break;
    case "client_approved":
      if (!approvals.depositPaid?.approved) actions.push("Confirm deposit received before committing to purchase orders.");
      actions.push("Generate the procurement list from the BoQ and request supplier quotes.");
      break;
    case "procurement":
      if (s.procurement.shortages > 0) actions.push(`${s.procurement.shortages} procurement line(s) still short — chase suppliers.`);
      else actions.push("All items received — book the installation team.");
      break;
    case "installation_scheduled":
      actions.push("Confirm transport, tools and site access, then start installation."); break;
    case "installation_in_progress":
      actions.push(`Work through the installation checklist (${s.checklist.done}/${s.checklist.total} complete).`); break;
    case "commissioning":
      actions.push("Complete commissioning tests and record as-built measurements."); break;
    case "handover_done":
      actions.push("Move to O&M monitoring and schedule the first inspection."); break;
    case "om_monitoring":
      actions.push("Monitor performance and log any warranty or service issues."); break;
    case "lost":
    case "cancelled":
      actions.push("Project closed — record the reason for pipeline learning."); break;
    default:
      break;
  }

  if (!sizing.coldVocOk && ["sizing_in_progress", "proposal_draft", "proposal_sent"].includes(stage)) {
    actions.push("Engineering: cold Voc check is failing — resolve before quoting.");
  }
  return actions;
}

// ─── Stage gates ────────────────────────────────────────────────────────────

/**
 * getStageGateWarnings(delivery, targetStage) → [{ level, msg }]
 * Advisory only: the user can still move the stage, but they are told what is
 * missing. Nothing here constitutes engineering approval.
 */
export function getStageGateWarnings(delivery = {}, targetStage) {
  const warnings = [];
  const approvals = delivery.approvals || {};
  const s = summarizeDelivery(delivery);
  const target = getStage(targetStage);
  if (!target) return warnings;

  if (targetStage === "procurement") {
    if (!approvals.clientApproved?.approved) warnings.push({ level: "danger", msg: "Client approval has not been recorded — do not commit to purchase orders yet." });
    if (!approvals.depositPaid?.approved) warnings.push({ level: "warning", msg: "Deposit has not been recorded as received." });
  }
  if (targetStage === "installation_scheduled" || targetStage === "installation_in_progress") {
    if (s.procurement.total === 0) warnings.push({ level: "warning", msg: "No procurement list exists — generate it from the BoQ first." });
    else if (s.procurement.shortages > 0) warnings.push({ level: "danger", msg: `${s.procurement.shortages} procurement line(s) not fully received — installation may stall on site.` });
    if (!approvals.procurementApproved?.approved) warnings.push({ level: "warning", msg: "Procurement has not been signed off." });
  }
  if (targetStage === "handover_done") {
    if (s.checklist.percent < 100) warnings.push({ level: "danger", msg: `Installation checklist is ${s.checklist.percent}% complete — finish it before handover.` });
    if (!approvals.commissioningApproved?.approved) warnings.push({ level: "danger", msg: "Commissioning has not been signed off." });
    if (s.issues.open > 0) warnings.push({ level: "warning", msg: `${s.issues.open} issue(s) still open at handover.` });
  }
  if (targetStage === "om_monitoring" && !approvals.handoverSigned?.approved) {
    warnings.push({ level: "warning", msg: "Handover document has not been recorded as signed." });
  }
  if (targetStage === "proposal_sent" && !approvals.proposalApproved?.approved) {
    warnings.push({ level: "warning", msg: "Proposal has not been marked ready for sending." });
  }
  return warnings;
}

/** Readiness of the wider project data for the current delivery stage. */
export function getProjectReadinessForStage(project = {}, sizing = {}, delivery = {}) {
  const stage = delivery.stage || "lead";
  const checks = [];
  const add = (label, ok, hint) => checks.push({ label, ok: !!ok, hint });

  const stageOrder = getStage(stage)?.order ?? 0;
  if (stageOrder >= 2) add("Client and location captured", !!project.client && !!project.location, "Set these in Project Setup.");
  if (stageOrder >= 3) add("Load data present", (Number(sizing.dailyKwh) || 0) > 0, "Complete the load assessment and click Update Sizing.");
  if (stageOrder >= 4) {
    add("Cold Voc within inverter limit", sizing.coldVocOk !== false, "Reduce panels per string.");
    add("System type selected", !!project.systemType, "Choose the system type in Project Setup.");
  }
  if (stageOrder >= 7) add("Project value known", (Number(sizing.totalCost) || 0) > 0, "Complete sizing so the BoQ has a value.");
  if (stageOrder >= 9) add("Installation checklist started", getChecklistProgress(delivery).done > 0, "Start ticking items as work completes.");

  const passed = checks.filter((c) => c.ok).length;
  return { checks, passed, total: checks.length, ready: checks.every((c) => c.ok) };
}

/** Which board column a project belongs in. */
export function getBoardColumn(delivery = {}) {
  const stage = getStage(delivery.stage);
  if (!stage) return "Survey";
  if (stage.terminal) return "Closed";
  return stage.group;
}

/** Client-safe view: no costs, no internal issues unless explicitly shared. */
export function getClientTimeline(delivery = {}) {
  const currentOrder = getStage(delivery.stage)?.order ?? 0;
  const milestones = [
    { key: "survey", label: "Site survey", atOrder: 2 },
    { key: "design", label: "System design and sizing", atOrder: 3 },
    { key: "proposal", label: "Proposal issued", atOrder: 5 },
    { key: "approval", label: "Proposal approved", atOrder: 6 },
    { key: "procurement", label: "Equipment procurement", atOrder: 7 },
    { key: "installation", label: "Installation", atOrder: 9 },
    { key: "commissioning", label: "Commissioning and testing", atOrder: 10 },
    { key: "handover", label: "Handover and training", atOrder: 11 },
  ];
  return milestones.map((m) => ({
    ...m,
    state: currentOrder > m.atOrder ? "done" : currentOrder === m.atOrder ? "current" : "upcoming",
  }));
}

/** Issues a client is allowed to see (explicitly flagged only). */
export function getClientVisibleIssues(delivery = {}) {
  return (Array.isArray(delivery.issues) ? delivery.issues : []).filter((i) => i.clientVisible === true);
}

/** Procurement export rows (CSV/JSON) — internal use. */
export function buildProcurementExportRows(delivery = {}) {
  return (Array.isArray(delivery.procurementItems) ? delivery.procurementItems : []).map((p) => ({
    item: p.item,
    category: p.category,
    requiredQty: p.requiredQty,
    orderedQty: p.orderedQty,
    receivedQty: p.receivedQty,
    unit: p.unit,
    supplier: p.supplier,
    unitCost: p.unitCost,
    lineValue: +((Number(p.requiredQty) || 0) * (Number(p.unitCost) || 0)).toFixed(2),
    status: p.status,
    linkedBoqItem: p.linkedBoqItem || "",
  }));
}

export function procurementRowsToCsv(rows = []) {
  if (rows.length === 0) return "item,category,requiredQty,orderedQty,receivedQty,unit,supplier,unitCost,lineValue,status,linkedBoqItem";
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

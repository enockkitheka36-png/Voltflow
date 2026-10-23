/**
 * readinessEngine.js — Voltflow 11.5.2
 *
 * THE single source of truth for project progress/readiness. Dashboard,
 * Project Advisor, Action Center and the proposal gate all read from here, so
 * they can never disagree (that was the 11.5.2 audit's core finding).
 *
 * Pure — no React, no DOM. Consumes committed loads + draft state + sizing +
 * survey + simulation + delivery + night-autonomy. Safe with empty/blank input.
 */

import { computeNightAutonomy } from "./nightAutonomy.js";

const STATUS = { NOT_STARTED: "not_started", INCOMPLETE: "incomplete", NEEDS_REVIEW: "needs_review", COMPLETE: "complete" };

function section(key, label, actionTab, actionLabel, required, done, extra = {}) {
  const requiredItems = required.map((r) => r.label);
  const completedItems = required.filter((r) => r.ok).map((r) => r.label);
  const missingItems = required.filter((r) => !r.ok).map((r) => r.label);
  const score = required.length > 0 ? Math.round((completedItems.length / required.length) * 100) : (done ? 100 : 0);
  let status;
  if (extra.critical) status = STATUS.NEEDS_REVIEW;
  else if (completedItems.length === 0) status = STATUS.NOT_STARTED;
  else if (missingItems.length === 0) status = STATUS.COMPLETE;
  else status = STATUS.INCOMPLETE;
  if (extra.forceStatus) status = extra.forceStatus;
  return {
    key, label, actionTab, actionLabel,
    highlightId: extra.highlightId || null,
    score, status,
    requiredItems, completedItems, missingItems,
    note: extra.note || null,
    critical: !!extra.critical,
    optional: !!extra.optional,
  };
}

export function buildProjectReadiness(
  project = {}, loads = [], draftLoads = [], survey = {}, sizing = {},
  simulation = {}, delivery = {}, energyImportSummary = null, hasUnappliedLoadChanges = false,
  boreholeResult = null // v11.6 — present when the Solar Borehole module is enabled
) {
  const clientName = String(project.client || "").trim();
  const hasClient = !!clientName && clientName !== "Karen Homeowner";
  const dailyKwh = Number(sizing.dailyKwh) || 0;
  const appliedLoadCount = Array.isArray(loads) ? loads.length : 0;
  const draftLoadCount = Array.isArray(draftLoads) ? draftLoads.length : 0;
  const invalidAppliedLoads = (Array.isArray(loads) ? loads : []).filter((l) => {
    const day = Number(l?.dayHours) || 0;
    const night = Number(l?.nightHours) || 0;
    return day + night > 24;
  });
  const loadInventoryPending = !!sizing.loadInventoryPending || appliedLoadCount === 0 || dailyKwh <= 0;
  const loadInventoryInvalid = !!sizing.loadInventoryInvalid || invalidAppliedLoads.length > 0;
  const loadInventoryBlocked = loadInventoryPending || loadInventoryInvalid;
  const systemType = project.systemType || "";
  const needsBattery = !loadInventoryBlocked && (systemType !== "EV charging" && systemType !== "Mini-grid" ? true : (Number(sizing.batteryKwh) || 0) > 0);
  const gridTied = systemType === "Solar PV – Hybrid" || systemType === "Genset hybrid";

  const night = computeNightAutonomy(loads, project.loadAssessmentMode || "Residential", sizing, project);

  const sections = {};
  const equipmentBlocked = !!sizing.equipment?.enabled && !sizing.equipment.quoteReady;
  if (sizing.equipment?.enabled) sections.equipmentMatching = section("equipmentMatching", "Equipment matching", "assets-lib", "Review equipment matches",
    [{ label: "Documented equipment checks complete", ok: !equipmentBlocked }], !equipmentBlocked,
    { critical: equipmentBlocked, note: sizing.equipment.scope });

  // ── Startup ────────────────────────────────────────────────────────────────
  sections.startup = section("startup", "Project started", "field-dashboard", "Open dashboard",
    [{ label: "Active project", ok: hasClient || appliedLoadCount > 0 || !!systemType }], hasClient);

  // ── Client details ───────────────────────────────────────────────────────────
  sections.clientDetails = section("clientDetails", "Client details", "project", "Open Project Setup",
    [
      { label: "Client name", ok: hasClient },
      { label: "Location", ok: !!project.location },
      { label: "Prepared by", ok: !!project.preparedBy },
    ], hasClient, { highlightId: "client-fields" });

  // ── Site survey ────────────────────────────────────────────────────────────
  sections.siteSurvey = section("siteSurvey", "Site survey", "site-survey", "Open Site Survey",
    [
      { label: "County / site profile", ok: !!survey.county || !!project.siteProfile },
      { label: "Roof dimensions", ok: (Number(survey.roofLengthM) || 0) > 0 && (Number(survey.roofWidthM) || 0) > 0 },
      { label: "Roof type", ok: !!survey.roofType },
      { label: "Earthing captured", ok: survey.earthingAvailable !== undefined && survey.earthingAvailable !== null },
      { label: "Site photos", ok: Object.values(survey.photos || {}).some(Boolean) },
    ], false, { highlightId: "survey-fields" });

  // ── Load inventory (the headline fix) ────────────────────────────────────────
  const validApplied = (Array.isArray(loads) ? loads : []).filter((l) => (Number(l.qty) || 0) >= 1 && (Number(l.watts) || 0) > 0);
  const loadReq = [
    { label: "Committed load inventory", ok: !loadInventoryPending },
    { label: "At least one valid load (qty + watts)", ok: validApplied.length > 0 && !loadInventoryPending },
    { label: "Daily energy > 0", ok: dailyKwh > 0 && !loadInventoryPending },
    { label: "Valid 24-hour load schedule", ok: !loadInventoryInvalid },
  ];
  let loadNote = null, loadForce;
  if (loadInventoryInvalid) { loadNote = "Invalid load inventory - day + night hours must not exceed 24."; loadForce = STATUS.NEEDS_REVIEW; }
  else if (hasUnappliedLoadChanges) { loadNote = "Load inventory edited but not applied. Click Update Sizing."; loadForce = STATUS.NEEDS_REVIEW; }
  else if (appliedLoadCount === 0 && draftLoadCount === 0) loadNote = "Pending load inventory - add committed loads and click Update Sizing before pricing.";
  else if (appliedLoadCount === 0 && draftLoadCount > 0) { loadNote = "Draft loads entered but not applied — click Update Sizing."; loadForce = STATUS.NEEDS_REVIEW; }
  else if (loadInventoryPending) { loadNote = "Pending load inventory - add committed loads and click Update Sizing before pricing."; loadForce = STATUS.NEEDS_REVIEW; }
  else if (validApplied.length === appliedLoadCount && dailyKwh > 0) loadNote = "Load inventory applied and complete.";
  sections.loadInventory = section("loadInventory", "Load inventory", "loads", "Go to Load Assessment",
    loadReq, false, { highlightId: hasUnappliedLoadChanges ? "update-sizing-btn" : "load-table", note: loadNote, forceStatus: loadForce });

  // ── Energy import (optional) ─────────────────────────────────────────────────
  const hasEnergy = !!energyImportSummary;
  sections.energyImport = section("energyImport", "Energy data import", "energy-import", "Open Energy Data Import",
    [{ label: "Interval/logger data imported (optional)", ok: hasEnergy }], hasEnergy,
    { optional: true, forceStatus: hasEnergy ? STATUS.COMPLETE : STATUS.NOT_STARTED, note: hasEnergy ? `Imported — quality ${energyImportSummary.dataQualityScore}/100.` : "Optional — improves sizing confidence." });

  // ── PV sizing ────────────────────────────────────────────────────────────────
  sections.pvSizing = section("pvSizing", "PV sizing", "generation", "Open PV + PR",
    [
      { label: "System type chosen", ok: !!systemType },
      { label: "Load inventory committed", ok: !loadInventoryBlocked },
      { label: "PV array sized", ok: !loadInventoryBlocked && (Number(sizing.actualKwp) || 0) > 0 },
      { label: "Panel count", ok: !loadInventoryBlocked && (Number(sizing.panels) || 0) > 0 },
    ], false, { highlightId: "pv-card", note: loadInventoryBlocked ? (sizing.quoteBlockedReason || "Pending load inventory") : null });

  // ── Battery sizing (+ night coverage) ────────────────────────────────────────
  const batteryReq = [
    { label: "Load inventory committed", ok: !loadInventoryBlocked },
    { label: "Battery sized", ok: !loadInventoryBlocked && (Number(sizing.batteryKwh) || 0) > 0 },
  ];
  if (night.isNightDominantLoad) batteryReq.push({ label: "Night-load coverage reviewed", ok: night.nightEnergyCoverage >= 1 });
  sections.batterySizing = section("batterySizing", "Battery sizing", "battery", "Review Battery",
    batteryReq, false, {
      highlightId: "night-autonomy-card",
      critical: !loadInventoryBlocked && night.isNightDominantLoad && night.nightEnergyCoverage < 0.6 && night.criticalNightKwh > 0,
      note: loadInventoryBlocked ? (sizing.quoteBlockedReason || "Pending load inventory") : night.nightAutonomyWarning,
    });

  // ── Inverter & safety ────────────────────────────────────────────────────────
  const coldVocOk = sizing.coldVocOk !== false;
  const inverterSupported = sizing.inverterSizing?.loadSupported !== false && !sizing.inverterSizing?.catalogueExceeded;
  sections.inverterSafety = section("inverterSafety", "Inverter & safety", "inverter", "Review Inverter + Safety",
    [
      { label: "Load inventory committed", ok: !loadInventoryBlocked },
      { label: "Inverter sized", ok: !loadInventoryBlocked && (Number(sizing.inverterKw) || 0) > 0 },
      { label: "Inverter supports requested sizing basis", ok: inverterSupported },
      { label: "Phase selected", ok: !!project.phase },
      { label: "Cold Voc within inverter limit", ok: coldVocOk },
      { label: "Inverter max DC voltage set", ok: (Number(project.inverterMaxDcV) || 0) > 0 },
    ], false, { highlightId: "cold-voc-card", critical: !coldVocOk || !inverterSupported });

  // ── Engineering compliance ───────────────────────────────────────────────────
  const dcDropOk = (sizing.dcDropPct ?? 0) <= 0.015;
  const acDropOk = (sizing.acDropPct ?? 0) <= 0.03;
  const bmsOk = (sizing.batteryInputA ?? 0) <= (sizing.bmsMaxDischargeA ?? Infinity);
  const dcAmpOk = sizing.dcCableAmpacityOk !== false;
  const acAmpOk = sizing.acCableAmpacityOk !== false;
  const phaseMismatch = !!survey.phaseType && !!project.phase && survey.phaseType.split(" ")[0] !== project.phase.split(" ")[0];
  const engReq = [
    { label: "Cold Voc OK", ok: coldVocOk },
    { label: "DC voltage drop ≤ 1.5%", ok: dcDropOk },
    { label: "AC voltage drop ≤ 3%", ok: acDropOk },
    { label: "BMS discharge within limit", ok: bmsOk },
    { label: "DC cable ampacity OK", ok: dcAmpOk },
    { label: "AC cable ampacity OK", ok: acAmpOk },
    { label: "Earthing confirmed", ok: survey.earthingAvailable === true },
  ];
  if (gridTied) engReq.push({ label: "Anti-islanding / EPRA note acknowledged", ok: true });
  const engCritical = !loadInventoryBlocked && (!coldVocOk || !bmsOk || !dcAmpOk || !acAmpOk || phaseMismatch);
  sections.engineeringCompliance = section("engineeringCompliance", "Engineering compliance", "eng-compliance", "Review Engineering Compliance",
    engReq, false, {
      highlightId: "compliance-card",
      critical: engCritical,
      note: phaseMismatch ? `Phase mismatch: survey says ${survey.phaseType}, project says ${project.phase}.` : null,
    });

  // ── BoQ ────────────────────────────────────────────────────────────────────
  sections.boq = section("boq", "Bill of quantities", "boq", "Open BoQ",
    [
      { label: "Load inventory committed", ok: !loadInventoryBlocked },
      { label: "Project value computed", ok: !loadInventoryBlocked && !equipmentBlocked && (Number(sizing.totalCost) || 0) > 0 },
    ], false, { highlightId: "boq-table", note: loadInventoryBlocked ? (sizing.quoteBlockedReason || "Pending load inventory") : null });

  // ── Proposal ─────────────────────────────────────────────────────────────────
  const noCriticalYet = coldVocOk && bmsOk && dcAmpOk && acAmpOk && !phaseMismatch && !equipmentBlocked;
  sections.proposal = section("proposal", "Proposal", "proposal", "Open Proposal",
    [
      { label: "Client + system type set", ok: hasClient && !!systemType },
      { label: "Pending load inventory cleared", ok: !loadInventoryBlocked },
      { label: "Loads applied", ok: validApplied.length > 0 && !hasUnappliedLoadChanges && !loadInventoryBlocked },
      { label: "No critical safety issues", ok: noCriticalYet && !loadInventoryBlocked },
    ], false, { highlightId: "proposal-actions" });

  // ── Delivery ─────────────────────────────────────────────────────────────────
  const stage = delivery?.stage || "lead";
  sections.delivery = section("delivery", "Project delivery", "delivery", "Open Project Delivery",
    [
      { label: "Delivery stage set", ok: stage !== "lead" },
      { label: "Tasks present", ok: Array.isArray(delivery?.tasks) && delivery.tasks.length > 0 },
    ], false, { highlightId: "delivery-stage" });

  // ── Handover ─────────────────────────────────────────────────────────────────
  const checklist = Array.isArray(delivery?.installationChecklist) ? delivery.installationChecklist : [];
  const checklistDone = checklist.filter((c) => c.complete).length;
  sections.handover = section("handover", "Handover", "delivery", "Open handover checklist",
    [
      { label: "Installation checklist complete", ok: checklist.length > 0 && checklistDone === checklist.length },
      { label: "Handover recorded", ok: !!delivery?.handover?.completed },
    ], false, { highlightId: "handover-card" });

  // ── Solar borehole (v11.6) — only when the specialist module is enabled ──────
  const boreholeCriticals = boreholeResult ? (boreholeResult.warnings || []).filter((w) => w.level === "critical") : [];
  if (boreholeResult) {
    sections.borehole = section("borehole", "Solar borehole", "borehole", "Open Solar Borehole",
      [
        { label: "Water demand entered", ok: (boreholeResult.dailyWaterDemandLitres || 0) > 0 },
        { label: "Borehole yield confirmed", ok: boreholeResult.yield && boreholeResult.yield.sufficient !== null },
        { label: "Pump & PV sized", ok: (boreholeResult.pumpElectricalKw || 0) > 0 && (boreholeResult.recommendedPvKwp || 0) > 0 },
      ], false, { highlightId: "borehole-card", critical: boreholeCriticals.length > 0 });
  }

  // ── Aggregate ────────────────────────────────────────────────────────────────
  const priorityFor = (s) => (s.critical ? "critical" : s.optional ? "recommended" : s.status === STATUS.NOT_STARTED ? "required" : s.status === STATUS.INCOMPLETE ? "required" : s.status === STATUS.NEEDS_REVIEW ? "warning" : "recommended");
  const missingFields = [];
  Object.values(sections).forEach((s) => {
    s.missingItems.forEach((mi) => missingFields.push({
      section: s.label, item: mi, actionTab: s.actionTab, actionLabel: s.actionLabel,
      highlightId: s.highlightId, priority: priorityFor(s),
    }));
  });

  const criticalIssues = [];
  if (equipmentBlocked) criticalIssues.push({ label: `Equipment matching ${sizing.equipment.status.toLowerCase()}`, actionTab: "assets-lib", highlightId: "equipment-matching-title" });
  if (!loadInventoryBlocked && !coldVocOk) criticalIssues.push({ label: "Cold Voc exceeds inverter max DC voltage", actionTab: "inverter", highlightId: "cold-voc-card" });
  if (!loadInventoryBlocked && !bmsOk) criticalIssues.push({ label: "Inverter battery current exceeds BMS discharge limit", actionTab: "inverter", highlightId: "cold-voc-card" });
  if (!loadInventoryBlocked && !dcAmpOk) criticalIssues.push({ label: "DC cable ampacity insufficient", actionTab: "inverter", highlightId: "compliance-card" });
  if (!loadInventoryBlocked && !acAmpOk) criticalIssues.push({ label: "AC cable ampacity insufficient", actionTab: "inverter", highlightId: "compliance-card" });
  if (!loadInventoryBlocked && phaseMismatch) criticalIssues.push({ label: `Phase mismatch (survey ${survey.phaseType} vs project ${project.phase})`, actionTab: "project", highlightId: "phase-field" });
  boreholeCriticals.forEach((w) => criticalIssues.push({ label: `Borehole: ${w.message}`, actionTab: "borehole", highlightId: "borehole-card" }));

  const warnings = [];
  if (loadInventoryPending) warnings.push({ label: "Pending load inventory - add committed loads and click Update Sizing before pricing", actionTab: "loads", highlightId: "load-table", priority: "required" });
  if (loadInventoryInvalid) warnings.push({ label: "Invalid load inventory - day + night hours cannot exceed 24", actionTab: "loads", highlightId: "load-table", priority: "required" });
  if (hasUnappliedLoadChanges) warnings.push({ label: "Load inventory edited but not applied", actionTab: "loads", highlightId: "update-sizing-btn", priority: "warning" });
  if (!loadInventoryBlocked && night.nightAutonomyWarning && night.nightEnergyCoverage < 1) warnings.push({ label: "Night-dominant load — battery may not cover the full night", actionTab: "battery", highlightId: "night-autonomy-card", priority: "warning" });
  if (!loadInventoryBlocked && Number.isFinite(sizing.payback) && sizing.payback > 8) warnings.push({ label: `Payback ${Number(sizing.payback).toFixed(1)} yrs is above target`, actionTab: "finance", highlightId: null, priority: "recommended" });
  if (boreholeResult) (boreholeResult.warnings || []).filter((w) => w.level === "warning").forEach((w) => warnings.push({ label: `Borehole: ${w.message}`, actionTab: "borehole", highlightId: "borehole-card", priority: "warning" }));

  // Overall score — average of the "core" sections (delivery/handover excluded so
  // a fresh feasibility project isn't dragged down by not-yet-started delivery).
  const coreKeys = ["clientDetails", "siteSurvey", "loadInventory", "pvSizing", "batterySizing", "inverterSafety", "engineeringCompliance", "boq", "proposal"];
  if (sizing.equipment?.enabled) coreKeys.push("equipmentMatching");
  const overallScore = Math.round(coreKeys.reduce((s, k) => s + sections[k].score, 0) / coreKeys.length);

  const readyForEngineeringReview = !loadInventoryBlocked && validApplied.length > 0 && !hasUnappliedLoadChanges && (Number(sizing.totalCost) || 0) > 0;
  const readyForProposal = !loadInventoryBlocked && hasClient && !!systemType && validApplied.length > 0 && !hasUnappliedLoadChanges && criticalIssues.length === 0 && dailyKwh > 0;
  const readyForClientView = readyForProposal;
  const readyForInstallation = readyForProposal && !!delivery?.approvals?.clientApproved?.approved && checklist.length > 0;

  // Next actions (leverage order)
  const nextActions = [];
  if (loadInventoryBlocked) nextActions.push({ label: loadInventoryInvalid ? "Fix invalid load hours, then Update Sizing" : "Pending load inventory - add committed loads and Update Sizing", actionTab: "loads", highlightId: "load-table" });
  if (criticalIssues.length > 0) nextActions.push({ label: `Resolve ${criticalIssues.length} critical safety issue(s)`, actionTab: criticalIssues[0].actionTab, highlightId: criticalIssues[0].highlightId });
  if (hasUnappliedLoadChanges) nextActions.push({ label: "Apply load changes — click Update Sizing", actionTab: "loads", highlightId: "update-sizing-btn" });
  const firstMissing = missingFields.find((m) => m.priority === "required");
  if (firstMissing && nextActions.length < 3) nextActions.push({ label: `${firstMissing.section}: ${firstMissing.item}`, actionTab: firstMissing.actionTab, highlightId: firstMissing.highlightId });
  if (readyForProposal && nextActions.length < 3) nextActions.push({ label: "Generate the proposal — review every number first", actionTab: "proposal", highlightId: "proposal-actions" });
  if (nextActions.length === 0) nextActions.push({ label: "Complete the load assessment, then Update Sizing", actionTab: "loads", highlightId: "load-table" });

  return {
    overallScore,
    sections,
    missingFields,
    criticalIssues,
    warnings,
    nextActions: nextActions.slice(0, 3),
    night,
    readyForProposal,
    readyForEngineeringReview,
    readyForClientView,
    readyForInstallation,
  };
}

export { STATUS as READINESS_STATUS };

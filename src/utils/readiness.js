/**
 * Solarise Pro v8 — Project Readiness Engine
 * Pure functions — no React, no side effects.
 * calculateReadiness(project, loads, survey, sizing) → readinessResult
 */

// ─── Readiness Score ────────────────────────────────────────────────────────────
// v11.1: optional 5th arg layoutInfo = { panelLayout, stringPlan, simDangerCount }
// adds a simulation/layout category (10 pts). Omitting it scores layout 0/10 —
// backward compatible with callers that predate the simulation studio.
export function calculateReadiness(project, loads, survey, sizing, layoutInfo) {
  const blockers = [];
  const warnings = [];
  const recommendations = [];
  const loadInventoryPending = !!sizing?.loadInventoryPending || (Array.isArray(loads) ? loads.length : 0) === 0 || (sizing?.dailyKwh ?? 0) <= 0;
  const loadInventoryInvalid = !!sizing?.loadInventoryInvalid || (Array.isArray(loads) ? loads : []).some((l) => (Number(l?.dayHours) || 0) + (Number(l?.nightHours) || 0) > 24);
  if (loadInventoryPending) blockers.push("Pending load inventory. Add committed loads and Update Sizing before quoting.");
  if (loadInventoryInvalid) blockers.push("Invalid load inventory. Day + night hours cannot exceed 24 before sizing.");

  // ── 1. Survey Completeness (20 pts) ──────────────────────────────────────────
  const surveyItems = [
    { label: "Client name",              pts: 2, pass: !!(survey?.clientName || (project.client && project.client !== "Karen Homeowner")) },
    { label: "Phone number",             pts: 1, pass: !!(survey?.phone) },
    { label: "Site address / location",  pts: 2, pass: !!(survey?.siteAddress || project.location) },
    { label: "County / site profile",    pts: 1, pass: !!survey?.county },
    { label: "Roof type",                pts: 1, pass: !!survey?.roofType && survey.roofType !== "Asbestos — Do Not Proceed" },
    { label: "Roof area entered",        pts: 2, pass: (survey?.roofAreaM2 ?? 0) > 5 },
    { label: "Electrical phase",         pts: 1, pass: !!survey?.phaseType },
    { label: "Monthly bill",             pts: 2, pass: (survey?.monthlyBill ?? project.monthlyBill ?? 0) > 0 },
    { label: "Earthing status captured", pts: 2, pass: survey?.earthingAvailable !== undefined && survey?.earthingAvailable !== null },
    { label: "Site notes",               pts: 1, pass: !!(survey?.siteNotes && survey.siteNotes.length > 5) },
    { label: "Photos collected",         pts: 2, pass: Object.keys(survey?.photos ?? {}).length >= 2 },
    { label: "Client objectives",        pts: 2, pass: (survey?.clientObjectives ?? []).length > 0 },
    { label: "Surveyor entered",         pts: 1, pass: !!(survey?.surveyor) },
  ];
  const surveyMax  = 20;
  const surveyRaw  = surveyItems.reduce((s, i) => s + (i.pass ? i.pts : 0), 0);
  const surveyMaxRaw = surveyItems.reduce((s, i) => s + i.pts, 0);
  const surveyScore = Math.round((surveyRaw / surveyMaxRaw) * 20);

  if (survey?.roofType === "Asbestos — Do Not Proceed") {
    blockers.push("CRITICAL: Asbestos roof confirmed. Do not proceed until licensed asbestos removal is complete.");
  }
  // Treat undefined (not captured) and false (explicitly unavailable) both as blockers
  if (!survey?.earthingAvailable) {
    blockers.push("Earthing not confirmed at survey. Do not send proposal until earthing is verified or budgeted.");
  }
  if (surveyScore < 8) {
    blockers.push("Survey is substantially incomplete. Collect key site data before proceeding.");
  }

  // ── 2. Load Quality (15 pts) ─────────────────────────────────────────────────
  // v11.2: a high-quality data-logger import earns bonus points (capped at 15),
  // because measured consumption beats any hand-estimated load table.
  const ei = project.energyImport || null;
  const loggerQualityOk = project.loadSource === "data_logger" && ei
    && (ei.dataQualityScore ?? 0) >= 70 && (ei.dateRange?.days ?? 0) >= 7;
  const loadItems = [
    { label: "≥ 3 loads entered",           pts: 3, pass: loads.length >= 3 },
    { label: "Day hours present",            pts: 2, pass: loads.some(l => (l.dayHours || 0) > 0) },
    { label: "Night hours present",          pts: 2, pass: loads.some(l => (l.nightHours || 0) > 0) },
    { label: "Critical loads identified",    pts: 3, pass: loads.some(l => l.critical) },
    { label: "Daily kWh > 0.5",             pts: 3, pass: (sizing.dailyKwh ?? 0) > 0.5 },
    { label: "Surge loads identified",       pts: 2, pass: loads.some(l => (l.surge || 1) > 1.5) },
    { label: "Measured data logger profile (≥7 days, quality ≥70)", pts: 3, pass: loggerQualityOk },
  ];
  const loadScore = Math.min(loadItems.reduce((s, i) => s + (i.pass ? i.pts : 0), 0), 15);

  if (loads.length < 2) warnings.push("Very few loads entered. Load table may not represent actual site demand.");
  if (!loads.some(l => l.critical)) warnings.push("No critical loads selected. Battery backup sizing may not reflect actual needs.");

  // v11.2 — energy data source quality flags
  if (ei) {
    if ((ei.dateRange?.days ?? 0) < 3) warnings.push(`Data logger period is only ${ei.dateRange?.days ?? 0} day(s) — under 3 days is not representative; extend the logging window.`);
    if ((ei.gapWarnings ?? 0) > 3) warnings.push("Data logger profile has many time gaps — averages may understate true consumption.");
    if ((ei.spikeWarnings ?? 0) > 0) warnings.push("Data logger profile contains unrealistic spikes — verify metering before sizing to the absolute peak.");
  }
  if ((project.loadSource === "client_estimate" || !project.loadSource) && !ei) {
    warnings.push("Load data is a client estimate only — consider a short data logger deployment before final sizing.");
  }

  // ── 3. Engineering Safety (25 pts) ───────────────────────────────────────────
  const engItems = [
    { label: "Cold Voc within inverter limit",   pts: 5, pass: !!sizing.coldVocOk },
    { label: "DC voltage drop ≤ 1.5%",           pts: 3, pass: (sizing.dcDropPct ?? 1) <= 0.015 },
    { label: "AC voltage drop ≤ 3%",             pts: 3, pass: (sizing.acDropPct ?? 1) <= 0.03 },
    { label: "BMS discharge within limits",       pts: 4, pass: (sizing.batteryInputA ?? 0) <= (sizing.bmsMaxDischargeA ?? 999) },
    { label: "DC cable ampacity advisory OK",     pts: 3, pass: sizing.dcCableAmpacityOk !== false },
    { label: "AC cable ampacity advisory OK",     pts: 3, pass: sizing.acCableAmpacityOk !== false },
    { label: "Earthing confirmed at survey",      pts: 2, pass: survey?.earthingAvailable === true },
    { label: "No critical safety blockers",       pts: 2, pass: !blockers.some(b => b.includes("CRITICAL") || b.includes("Voc") || b.includes("asbestos")) },
  ];
  const engScore = engItems.reduce((s, i) => s + (i.pass ? i.pts : 0), 0);

  if (!sizing.coldVocOk) blockers.push("Cold Voc exceeds inverter max DC voltage. Reduce panels per string before quoting.");
  if ((sizing.batteryInputA ?? 0) > (sizing.bmsMaxDischargeA ?? 999)) {
    blockers.push("Inverter peak battery draw exceeds BMS discharge limit. Add parallel battery strings.");
  }
  if (sizing.dcCableAmpacityOk === false) warnings.push("DC cable size may be undersized. Engineer review recommended.");
  if (sizing.acCableAmpacityOk === false) warnings.push("AC cable size may be undersized. Engineer review recommended.");

  // ── 4. Simulation / Layout Readiness (10 pts, v11.1) ─────────────────────────
  const pl = layoutInfo?.panelLayout || null;
  const sp = layoutInfo?.stringPlan || null;
  const simDangerCount = layoutInfo?.simDangerCount ?? null;
  const layoutItems = [
    { label: "Roof fit status confirmed",          pts: 2, pass: !!pl && pl.roofFitStatus !== "Roof dimensions not confirmed" },
    { label: "Required panels fit on roof",        pts: 4, pass: !!pl && (pl.roofFitStatus || "").startsWith("Fits") },
    { label: "String plan generated",              pts: 2, pass: (sp?.totalStrings ?? 0) > 0 },
    { label: "No danger-level installer warnings", pts: 2, pass: simDangerCount === 0 },
  ];
  const layoutScore = layoutItems.reduce((s, i) => s + (i.pass ? i.pts : 0), 0);

  if (pl && (pl.roofFitStatus || "").startsWith("Does not fit")) {
    warnings.push("Roof does not fit all required panels — confirm alternative mounting before proposal.");
  }
  if ((simDangerCount ?? 0) > 0) {
    warnings.push(`${simDangerCount} danger-level installer simulation warning(s) unresolved.`);
  }

  // ── 5. Financial Viability (15 pts, rebalanced v11.1) ────────────────────────
  const payback = sizing.payback ?? Infinity;
  const npv     = sizing.npvLife ?? -Infinity;
  const dscr    = sizing.dscrYear1 ?? Infinity;
  const finItems = [
    { label: "Payback is finite",                 pts: 2, pass: Number.isFinite(payback) },
    { label: "Payback ≤ 8 years",                 pts: 4, pass: payback <= 8 },
    { label: "Payback ≤ 12 years",                pts: 2, pass: payback <= 12 },
    { label: "NPV positive",                      pts: 3, pass: npv > 0 },
    { label: "DSCR ≥ 1.2 (if financed)",          pts: 2, pass: (project.debtShare ?? 0) <= 0.1 || dscr >= 1.2 },
    { label: "Carbon revenue excluded (default)", pts: 2, pass: !(project.carbonInCashflow) },
  ];
  const finScore = Math.min(finItems.reduce((s, i) => s + (i.pass ? i.pts : 0), 0), 15);

  if (loadInventoryPending || loadInventoryInvalid) {
    recommendations.push(loadInventoryInvalid ? "Fix invalid load hours, then click Update Sizing." : "Complete the load inventory, then click Update Sizing.");
  } else if (!Number.isFinite(payback)) {
    blockers.push("Project generates no net benefit — payback infinite. Redesign required before quoting.");
  } else if (payback > 12) {
    warnings.push("Payback exceeds 12 years. Project is commercially very weak.");
  } else if (payback > 8) {
    warnings.push("Payback above 8 years. Consider reducing system scope or improving self-consumption.");
  }
  if (project.carbonInCashflow) {
    warnings.push("Carbon revenue included in cashflow. Confirm additionality with a carbon developer before using in proposal.");
  }
  if ((project.debtShare ?? 0) > 0.3 && dscr < 1.2) {
    warnings.push("P90 DSCR below 1.20 with significant debt. Project may not be bankable — finance review required.");
  }

  // ── 6. Proposal Readiness (15 pts, rebalanced v11.1) ─────────────────────────
  const propItems = [
    { label: "Client name is project-specific",   pts: 2, pass: !!(project.client) && project.client !== "Karen Homeowner" },
    { label: "System type selected",              pts: 1, pass: !!project.systemType },
    { label: "Engineering safety checks pass",    pts: 4, pass: engScore >= 18 },
    { label: "Financial checks pass",             pts: 3, pass: finScore >= 11 },
    { label: "Load table is realistic",           pts: 3, pass: loadScore >= 10 },
    { label: "No critical blockers",              pts: 2, pass: blockers.filter(b => b.includes("CRITICAL") || b.includes("Voc") || b.includes("asbestos") || b.includes("infinite")).length === 0 },
  ];
  const propScore = Math.min(propItems.reduce((s, i) => s + (i.pass ? i.pts : 0), 0), 15);

  // ── Total & Status ─────────────────────────────────────────────────────────────
  // 20 + 15 + 25 + 10 + 15 + 15 = 100
  const totalScore = surveyScore + loadScore + engScore + layoutScore + finScore + propScore;

  let readyStatus;
  const hasCriticalBlocker = blockers.some(b => b.includes("CRITICAL") || b.includes("asbestos") || b.includes("Voc") || b.includes("infinite"));
  if (loadInventoryPending || loadInventoryInvalid) {
    readyStatus = "Pending load inventory";
  } else if (hasCriticalBlocker) {
    readyStatus = "High risk — do not send";
  } else if (blockers.length > 0) {
    // Any unresolved blocker (earthing, incomplete survey, BMS, etc.) prevents "Ready to propose"
    readyStatus = "Engineering review required";
  } else if (totalScore < 40) {
    readyStatus = "Incomplete survey";
  } else if (engScore < 15 || !sizing.coldVocOk) {
    readyStatus = "Engineering review required";
  } else if (!Number.isFinite(payback) || payback > 12) {
    readyStatus = "Commercially weak";
  } else if ((sizing.totalCost ?? 0) > 1000000 || payback > 8) {
    readyStatus = "Ready with engineer review";
  } else if (totalScore < 60) {
    readyStatus = "Engineering review required";
  } else {
    readyStatus = "Ready to propose";
  }

  // ── Recommendations ────────────────────────────────────────────────────────────
  if (surveyScore < 14) recommendations.push("Complete the field survey — particularly earthing, photos, and client objectives.");
  if (loadScore < 10)   recommendations.push("Improve load table — add day/night split and identify critical loads.");
  if (engScore < 20)    recommendations.push("Resolve engineering flags before sending proposal.");
  if (layoutScore < 6)  recommendations.push("Review the installer simulation — confirm roof fit, generate the string plan, and clear danger-level layout warnings.");
  if (payback > 8)      recommendations.push("Review system sizing, tariff assumptions, or self-consumption rate to improve payback.");
  if (!survey?.earthingAvailable) recommendations.push("Confirm or budget for earthing installation.");
  if (sizing.totalCost > 1000000) recommendations.push("High-value project — escalate to manager before sending.");
  if (loads.length < 4) recommendations.push("Add more loads to the assessment to improve system sizing accuracy.");

  const categoryScores = {
    survey:      { score: surveyScore,  max: 20, items: surveyItems },
    loads:       { score: loadScore,    max: 15, items: loadItems },
    engineering: { score: engScore,     max: 25, items: engItems },
    layout:      { score: layoutScore,  max: 10, items: layoutItems },
    financial:   { score: finScore,     max: 15, items: finItems },
    proposal:    { score: propScore,    max: 15, items: propItems },
  };

  return { totalScore, categoryScores, blockers, warnings, recommendations, readyStatus };
}

// ─── Assumption Confidence Score ────────────────────────────────────────────────
export function computeAssumptionConfidence(project, survey) {
  const sourceScore = { data_logger: 1.0, kplc_bill: 0.9, measured: 0.85, supplier_quote: 0.9, approved_price_list: 0.8, estimated: 0.45, client_estimate: 0.35, default: 0.4 };
  const items = [
    { label: "Monthly bill source",       weight: 20, conf: sourceScore[project.billSource ?? "client_estimate"] ?? 0.4 },
    { label: "Load data source",          weight: 20, conf: sourceScore[project.loadSource ?? "estimated"] ?? 0.4 },
    { label: "Roof measurement source",   weight: 10, conf: sourceScore[survey?.roofMeasurementSource ?? "estimated"] ?? 0.4 },
    { label: "Equipment pricing source",  weight: 15, conf: sourceScore[project.pricingSource ?? "default"] ?? 0.4 },
    { label: "Solar resource (site PSH)", weight: 15, conf: survey?.county ? 0.75 : 0.5 },
    { label: "Tariff assumption",         weight: 10, conf: project.gridTariff > 0 ? 0.7 : 0.3 },
    { label: "Survey photos collected",   weight: 10, conf: Object.keys(survey?.photos ?? {}).length >= 3 ? 0.9 : Object.keys(survey?.photos ?? {}).length >= 1 ? 0.6 : 0.3 },
  ];
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  const score = Math.round(items.reduce((s, i) => s + i.conf * i.weight, 0) / totalWeight * 100);
  const weakItems = items.filter(i => i.conf < 0.6).map(i => i.label);
  const level = score >= 75 ? "High" : score >= 50 ? "Medium" : "Low";
  return { score, level, items, weakItems };
}

// ─── Quote Governance ──────────────────────────────────────────────────────────
export function computeGovernanceStatus(project, sizing, readiness) {
  const approvals = [];
  const nextAction = [];

  if (!readiness) return { status: "Draft", approvals: [], nextAction: ["Complete readiness assessment"] };

  const { totalScore, readyStatus, blockers } = readiness;
  const cost = sizing?.totalCost ?? 0;
  const payback = sizing?.payback ?? Infinity;

  let status = "Draft";

  if (sizing?.loadInventoryInvalid) {
    status = "Pending load inventory";
    nextAction.push("Fix invalid load hours before pricing or proposal");
  } else if (sizing?.loadInventoryPending || cost <= 0) {
    status = "Pending load inventory";
    nextAction.push("Add committed loads and Update Sizing before pricing");
  } else if (blockers?.some(b => b.includes("CRITICAL") || b.includes("asbestos"))) {
    status = "High risk — do not send";
    nextAction.push("Resolve critical safety blockers immediately");
  } else if (!sizing?.coldVocOk) {
    status = "Engineering review required";
    approvals.push({ role: "Design Engineer", reason: "Cold Voc string safety violation" });
    nextAction.push("Recalculate string configuration with qualified engineer");
  } else if ((sizing?.batteryInputA ?? 0) > (sizing?.bmsMaxDischargeA ?? 999)) {
    status = "Engineering review required";
    approvals.push({ role: "Design Engineer", reason: "BMS current limit exceeded" });
    nextAction.push("Add parallel battery strings or increase voltage");
  } else if (sizing?.dcCableAmpacityOk === false || sizing?.acCableAmpacityOk === false) {
    // v11.1 — undersized cable is an engineering gate, not just a warning
    status = "Engineering review required";
    approvals.push({ role: "Design Engineer", reason: `${sizing?.dcCableAmpacityOk === false ? "DC" : "AC"} cable ampacity advisory failed` });
    nextAction.push("Increase cable cross-section or shorten the route, then re-check ampacity");
  } else if (totalScore < 40) {
    status = "Survey incomplete";
    nextAction.push("Complete field survey before any further action");
  } else if (totalScore < 60) {
    status = "Engineering review required";
    approvals.push({ role: "Sales Engineer", reason: "Readiness score below threshold" });
    nextAction.push("Review engineering flags and load assessment");
  } else if (cost > 1000000) {
    status = "Manager review required";
    approvals.push({ role: "Manager", reason: `Project value KES ${Math.round(cost / 1000)}k exceeds KES 1M threshold` });
    nextAction.push("Submit for manager approval before sending");
  } else if (payback > 8) {
    status = "Commercial review required";
    approvals.push({ role: "Manager / Finance", reason: `Payback ${payback.toFixed(1)} years exceeds 8-year target` });
    nextAction.push("Review pricing, scope, or client value proposition");
  } else if (readyStatus === "Ready to propose") {
    status = "Ready to send";
    nextAction.push("Generate PDF proposal and get client meeting");
  } else {
    status = "Ready with engineer review";
    approvals.push({ role: "Sales Engineer", reason: "Final check before sending" });
    nextAction.push("Senior sales engineer sign-off required");
  }

  // v11.1 — manual pipeline stage (Sent / Won / Lost) overrides the computed
  // pre-send status once the quote has actually gone out the door.
  const stage = project?.quoteStage;
  if (stage === "Sent" || stage === "Won" || stage === "Lost") {
    const stageActions = {
      Sent: "Awaiting client response — follow up and record the outcome (Won / Lost).",
      Won:  "Move to contract, scheduling and installation planning. Enable As-Built mode during commissioning.",
      Lost: "Record the loss reason for pipeline learning, then archive or revise the design.",
    };
    return { status: stage, approvals, nextAction: [stageActions[stage]], computedStatus: status };
  }

  return { status, approvals, nextAction, computedStatus: status };
}

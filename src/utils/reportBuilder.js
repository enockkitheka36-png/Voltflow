/**
 * reportBuilder.js — Voltflow 11.7 (Evidence Reports)
 *
 * Builds structured report CONTENT for four audiences from existing project data,
 * readiness, warnings, assumptions, BoQ and borehole results. Pure — no React, no
 * DOM, no jsPDF. The PDF renderer (reportPdf.js) and on-screen preview both consume
 * this shape, so what's tested is what's printed.
 *
 * Modes:
 *  - client    → benefits + investment; internal technical detail HIDDEN
 *  - engineer  → technical basis, formulas summary, readiness, limitations
 *  - technician→ site/install/commissioning checklists (+ borehole checklist)
 *  - lender    → summary, financials, ASSUMPTIONS and UNRESOLVED RISKS, evidence
 *
 * Nothing here claims certified engineering approval. Feasibility / market-testing.
 */

export const REPORT_MODES = ["client", "engineer", "technician", "lender"];
export const REPORT_LABELS = {
  client: "Client Proposal",
  engineer: "Engineer Review",
  technician: "Technician Handover",
  lender: "Lender / Grant Readiness Report",
};

const FEASIBILITY_DISCLAIMER = "This is a feasibility and proposal-support document. Final engineering design, protection coordination, structural/earthing checks and installation approval require qualified review. Voltflow Internal Alpha — market-testing build, not certified engineering approval.";
const BOREHOLE_DISCLAIMER = "Final borehole pump selection requires the pump curve and borehole test-report confirmation (yield, static/dynamic water level).";

const finite = (v, fb = 0) => (Number.isFinite(Number(v)) ? Number(v) : fb);
const kes = (v) => `KES ${Math.round(finite(v)).toLocaleString()}`;
const n = (v, d = 1) => finite(v).toFixed(d);
const pct = (v) => `${(finite(v) * 100).toFixed(1)}%`;

function coverSection(project, mode) {
  return {
    heading: "Project", type: "kv", items: [
      ["Client", project.client || "—"],
      ["Location", project.location || "—"],
      ["System type", project.systemType || "—"],
      ["Prepared by", project.preparedBy || "—"],
      ["Report type", REPORT_LABELS[mode]],
      ["Generated", new Date().toISOString().slice(0, 10)],
      ["Reference", project.projectRef?.reference || project.projectRef || "—"],
    ],
  };
}

function assumptionsSection(project, sizing) {
  return {
    heading: "Assumptions", type: "list", items: [
      `Peak Sun Hours: ${n(project.psh, 2)} h/day; Performance Ratio: ${pct(sizing.pr)}.`,
      `Solar coverage target: ${pct(project.solarCoverage)}; tariff: ${kes(project.gridTariff)}/kWh.`,
      `Load diversity — running ${project.runningLoadDiversityFactor ?? 0.75}, surge ${project.surgeDiversityFactor ?? 0.65}; final simultaneity to be confirmed.`,
      `Backup/night estimates use an 11-hour night window; actual runtime depends on real load behaviour.`,
      "Figures are planning-level and must be confirmed against site survey, equipment quotes and qualified review.",
    ],
  };
}

function risksSection(readiness, sizing, borehole) {
  const items = [];
  (readiness.criticalIssues || []).forEach((c) => items.push(`CRITICAL — ${c.label}`));
  (readiness.warnings || []).filter((w) => w.priority === "warning").forEach((w) => items.push(`Warning — ${w.label}`));
  if (readiness.night?.nightAutonomyWarning && readiness.night.nightEnergyCoverage < 1) items.push(`Night-load — ${readiness.night.nightAutonomyWarning}`);
  if (borehole) (borehole.warnings || []).filter((w) => w.level !== "info").forEach((w) => items.push(`Borehole — ${w.message}`));
  if (items.length === 0) items.push("No unresolved critical items recorded at time of generation.");
  return { heading: "Unresolved risks & warnings", type: "list", items };
}

function boreholeSummarySection(borehole, plain) {
  if (!borehole) return null;
  const kv = [
    ["Daily water demand", `${Math.round(finite(borehole.dailyWaterDemandLitres)).toLocaleString()} L/day`],
    ["Total dynamic head", `${n(borehole.totalDynamicHeadM, 0)} m`],
    ["Suggested pump", `~${borehole.suggestedPumpHp} HP (${n(borehole.pumpElectricalKw, 2)} kW)`],
    ["Recommended PV", `${n(borehole.recommendedPvKwp, 2)} kWp (${borehole.estimatedPanels} panels)`],
    ["Recommended tank", `${Math.round(finite(borehole.recommendedTankLitres)).toLocaleString()} L`],
  ];
  if (!plain) kv.push(["Required flow", `${Math.round(finite(borehole.requiredFlowLitresPerHour)).toLocaleString()} L/h`]);
  return { heading: "Solar borehole & water pumping", type: "kv", items: kv, note: BOREHOLE_DISCLAIMER };
}

// ── Client ───────────────────────────────────────────────────────────────────
function buildClient(project, sizing, readiness, borehole) {
  const sections = [coverSection(project, "client")];
  sections.push({
    heading: "Recommended system", type: "kv", items: [
      ["Solar array", `${n(sizing.actualKwp, 1)} kWp (${sizing.panels || 0} panels)`],
      ["Battery", `${n(sizing.batteryKwh, 1)} kWh`],
      ["Inverter", `${n(sizing.inverterKw, 1)} kW`],
      ["Expected annual production", `${Math.round(finite(sizing.annualEnergy)).toLocaleString()} kWh/year`],
    ],
  });
  sections.push({
    heading: "Expected benefits", type: "kv", items: [
      ["Estimated annual savings", kes(sizing.annualSavings)],
      ["Estimated payback", `${n(sizing.payback, 1)} years`],
      ["Backup expectation", sizing.batteryKwh > 0 ? `~${n(sizing.autonomyHours, 1)} h on critical loads (average)` : "No battery backup in this option"],
    ],
  });
  const bh = boreholeSummarySection(borehole, true);
  if (bh) sections.push(bh);
  sections.push({
    heading: "Your investment", type: "kv", items: [
      ["Indicative system cost", kes(sizing.totalCost)],
      ["Validity", "Subject to site survey, final equipment quotes and engineering review."],
    ],
  });
  sections.push({
    heading: "Next steps", type: "list", items: [
      "Review this proposal and raise any questions.",
      "Confirm the site survey and final equipment schedule.",
      "Qualified engineer signs off the final design.",
      "Agreement, installation, commissioning and handover.",
    ],
  });
  return sections;
}

// ── Engineer ─────────────────────────────────────────────────────────────────
function buildEngineer(project, sizing, readiness, borehole) {
  const inv = sizing.inverterSizing || {}, dc = sizing.dcAcAnalysis || {}, ss = sizing.stringSizing || {};
  const sections = [coverSection(project, "engineer")];
  sections.push({
    heading: "Technical basis", type: "kv", items: [
      ["PV sizing", `Energy-led: ${n(sizing.actualKwp, 2)} kWp from daily energy ${n(sizing.designDailyKwh, 1)} kWh @ PSH ${n(project.psh, 2)}, PR ${pct(sizing.pr)}`],
      ["Inverter sizing", `${inv.selectedReason || "—"} → ${n(sizing.inverterKw, 1)} kW (load-based ${n(inv.loadBasedInvKw, 1)}, PV-based ${n(inv.pvBasedInvKw, 1)}, peak ${n(inv.peakKw, 2)})`],
      ["DC:AC ratio", `${n(dc.ratio, 2)} — ${dc.status || "—"} (target ${dc.targetMin ?? 0.8}–${dc.targetMax ?? 1.5})`],
      ["String sizing", `Requested ${ss.requestedPanelsPerString ?? "—"} / effective ${ss.effectivePanelsPerString ?? "—"} / max-by-voltage ${ss.maxPanelsPerStringByVoltage ?? "—"}`],
      ["Cold string Voc", `${n(sizing.stringVocCold, 0)} V vs limit ${project.inverterMaxDcV} V — ${sizing.coldVocOk ? "OK" : "EXCEEDS"}`],
      ["Voltage drop", `DC ${pct(sizing.dcDropPct)}, AC ${pct(sizing.acDropPct)}`],
      ["Battery", `${n(sizing.batteryKwh, 1)} kWh; night autonomy ${n(readiness.night?.estimatedNightAutonomyHours, 1)} h, coverage ${pct(readiness.night?.nightEnergyCoverage)}`],
    ],
  });
  if (dc.isLow && dc.explanation) sections.push({ heading: "Inverter/PV coherence", type: "text", items: [dc.explanation] });
  sections.push({
    heading: "Readiness", type: "kv", items: [
      ["Overall score", `${finite(readiness.overallScore)}/100`],
      ["Critical issues", `${(readiness.criticalIssues || []).length}`],
      ["Proposal-safe", readiness.readyForProposal ? "Yes" : "No"],
      ["Engineering review", (readiness.criticalIssues || []).length > 0 ? "Required" : "No blockers recorded"],
    ],
  });
  const bh = boreholeSummarySection(borehole, false);
  if (bh) sections.push(bh);
  sections.push(assumptionsSection(project, sizing));
  sections.push(risksSection(readiness, sizing, borehole));
  sections.push({
    heading: "Design limitations", type: "list", items: [
      "Feasibility-level: not a certified/stamped engineering design.",
      "Protection coordination, earthing and structural/wind design require qualified review.",
      "Cable ampacity is advisory; confirm with full thermal derating.",
      borehole ? BOREHOLE_DISCLAIMER : null,
    ].filter(Boolean),
  });
  return sections;
}

// ── Technician ───────────────────────────────────────────────────────────────
function buildTechnician(project, sizing, readiness, borehole, boreholeChecklist) {
  const sections = [coverSection(project, "technician")];
  sections.push({
    heading: "System to install", type: "kv", items: [
      ["PV", `${sizing.panels || 0} × ${project.panelW}W (${n(sizing.actualKwp, 1)} kWp)`],
      ["Strings", `${sizing.stringSizing?.strings ?? sizing.strings ?? "—"} × ${sizing.stringSizing?.effectivePanelsPerString ?? "—"} panels`],
      ["Inverter", `${n(sizing.inverterKw, 1)} kW`],
      ["Battery", `${n(sizing.batteryKwh, 1)} kWh`],
    ],
  });
  sections.push({
    heading: "Site & installation checklist", type: "checklist", items: [
      "Confirm roof/structure and mounting zones",
      "Confirm string layout and polarity",
      "Confirm cold-Voc within inverter limit before energising",
      "Confirm earthing and SPD installed",
      "Confirm cable routing and glanding",
      "Confirm inverter and battery mounting/ventilation",
      "Label DC/AC isolators and circuits",
    ],
  });
  sections.push({
    heading: "Commissioning checklist", type: "checklist", items: [
      "Insulation/continuity checks",
      "String Voc/Isc measured and recorded",
      "Inverter start-up and firmware/settings",
      "Battery BMS communication verified",
      "Anti-islanding / grid settings (if grid-tied)",
      "Record as-built values and photos",
    ],
  });
  if (borehole && boreholeChecklist?.checklist) {
    sections.push({ heading: "Borehole checklist", type: "checklist", items: boreholeChecklist.checklist, note: BOREHOLE_DISCLAIMER });
  }
  const warns = [];
  (readiness.criticalIssues || []).forEach((c) => warns.push(`CRITICAL — ${c.label}`));
  (readiness.warnings || []).filter((w) => w.priority === "warning").forEach((w) => warns.push(w.label));
  if (warns.length) sections.push({ heading: "Safety warnings — resolve on site", type: "list", items: warns });
  return sections;
}

// ── Lender / grant ───────────────────────────────────────────────────────────
function buildLender(project, sizing, readiness, borehole, evidence) {
  const sections = [coverSection(project, "lender")];
  sections.push({
    heading: "Project summary", type: "kv", items: [
      ["System", `${n(sizing.actualKwp, 1)} kWp PV · ${n(sizing.batteryKwh, 1)} kWh · ${n(sizing.inverterKw, 1)} kW`],
      ["Annual production (P50/P90)", `${Math.round(finite(sizing.annualEnergy)).toLocaleString()} / ${Math.round(finite(sizing.annualEnergyP90)).toLocaleString()} kWh`],
      ["Readiness", `${finite(readiness.overallScore)}/100 (${readiness.readyForProposal ? "proposal-safe" : "in progress"})`],
    ],
  });
  sections.push({
    heading: "Investment & financials", type: "kv", items: [
      ["Indicative cost", kes(sizing.totalCost)],
      ["Annual savings (P50)", kes(sizing.annualSavings)],
      ["Simple payback", `${n(sizing.payback, 1)} years`],
      ["Year-1 DSCR (P90)", Number.isFinite(sizing.dscrYear1) ? n(sizing.dscrYear1, 2) : "N/A"],
      ["LCOE (P50)", `${n(sizing.lcoe, 2)} KES/kWh`],
    ],
  });
  const bh = boreholeSummarySection(borehole, false);
  if (bh) sections.push(bh);
  sections.push(assumptionsSection(project, sizing));
  sections.push(risksSection(readiness, sizing, borehole));
  sections.push({
    heading: "Evidence & auditability", type: "kv", items: [
      ["Approval status", evidence?.approvalStatus || "draft"],
      ["Confidence level", evidence?.confidenceLevel || "estimated"],
      ["Responsible", evidence?.responsibleUser || project.preparedBy || "—"],
      ["Record version", evidence?.version != null ? String(evidence.version) : "—"],
      ["Last updated", evidence?.updatedAt ? String(evidence.updatedAt).slice(0, 10) : "—"],
    ],
    note: "An activity/audit trail is maintained in the app for this project.",
  });
  return sections;
}

export function buildReport(mode, ctx = {}) {
  const m = REPORT_MODES.includes(mode) ? mode : "client";
  const { project = {}, sizing = {}, readiness = {}, borehole: boreholeInput = null, boreholeChecklist = null, evidence = null } = ctx;
  const borehole = project.borehole?.enabled === false ? null : boreholeInput;
  if (["client", "lender"].includes(m) && project.equipmentSelection?.enabled && (!sizing.equipment?.quoteReady || sizing.quoteReady === false)) throw new Error("Resolve equipment matching and sizing checks before generating a commercial report.");
  let sections;
  if (m === "engineer") sections = buildEngineer(project, sizing, readiness, borehole);
  else if (m === "technician") sections = buildTechnician(project, sizing, readiness, borehole, boreholeChecklist);
  else if (m === "lender") sections = buildLender(project, sizing, readiness, borehole, evidence);
  else sections = buildClient(project, sizing, readiness, borehole);
  if (sizing.equipment?.enabled) sections.splice(1, 0, {
    heading: "Documented equipment matching", type: "kv", items: [
      ["Matching status", sizing.equipment.status],
      ["PV module", sizing.equipment.models.panel || "Unverified"],
      ["Inverter", sizing.equipment.models.inverter || "Unverified"],
      ["Battery", `${sizing.batteryModules} × ${sizing.equipment.models.battery || "Unverified"}`],
      ["Pricing basis", sizing.equipment.commercialBasis === "SUPPLIER_QUOTE" ? `Supplier quote reference: ${project.equipmentSelection?.priceReference || "missing"}` : "Planning estimates; not a supplier offer"],
      ["Manufacturer source set", `${sizing.equipment.catalogueVersion}; ${Object.values(sizing.equipment.sourceRevisions).join("; ")}`],
      ["Scope", sizing.equipment.scope],
    ],
  });

  const disclaimers = [FEASIBILITY_DISCLAIMER];
  if (borehole) disclaimers.push(BOREHOLE_DISCLAIMER);

  return {
    mode: m,
    title: `${REPORT_LABELS[m]} — ${project.client || "Untitled project"}`,
    generatedAt: new Date().toISOString(),
    sections,
    disclaimers,
    meta: { client: project.client || "", systemType: project.systemType || "", readinessScore: finite(readiness.overallScore) },
  };
}

/** Flatten a report to plain text (used by the copy button and by tests). */
export function reportToText(report) {
  if (!report) return "";
  const lines = [report.title, "=".repeat(Math.min(report.title.length, 60)), ""];
  report.sections.forEach((s) => {
    lines.push(s.heading.toUpperCase());
    (s.items || []).forEach((it) => {
      if (Array.isArray(it)) lines.push(`  ${it[0]}: ${it[1]}`);
      else if (s.type === "checklist") lines.push(`  [ ] ${it}`);
      else lines.push(`  - ${it}`);
    });
    if (s.note) lines.push(`  (${s.note})`);
    lines.push("");
  });
  lines.push("");
  report.disclaimers.forEach((d) => lines.push(d));
  return lines.join("\n");
}

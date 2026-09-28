/**
 * projectAdvisor.js — Voltflow 11.5.1
 *
 * Rule-based (NON-AI) project advisor. Runs entirely on existing computed
 * state — sizing, readiness, warnings, load source, delivery. It never calls
 * Claude, so it works before (or instead of) ANTHROPIC_API_KEY being set.
 *
 * Pure function — no React, no DOM, no network. Unit-testable.
 *
 * It is advisory only: it summarises what the app already computed. It does not
 * constitute engineering approval.
 */

export function buildProjectAdvice(project = {}, sizing = {}, readiness = null, loadCount = 0) {
  const missingData = [];
  const bigWarnings = [];
  const nextActions = [];

  const client = String(project.client || "").trim();
  const hasClient = !!client && client !== "Karen Homeowner";
  const dailyKwh = Number(sizing.dailyKwh) || 0;
  const payback = sizing.payback;
  const totalCost = Number(sizing.totalCost) || 0;
  const loadInventoryPending = !!sizing.loadInventoryPending || loadCount === 0 || dailyKwh <= 0;
  const loadInventoryInvalid = !!sizing.loadInventoryInvalid;

  // ── Missing data ──────────────────────────────────────────────────────────
  if (!hasClient) missingData.push("Client name is not set (or is still a demo name).");
  if (!project.location) missingData.push("Site location is not set.");
  if (!project.systemType) missingData.push("System type has not been chosen.");
  if (loadInventoryInvalid) missingData.push("Invalid load inventory - day + night hours cannot exceed 24 before sizing.");
  else if (loadInventoryPending) missingData.push("Pending load inventory - add committed loads or import energy data, then Update Sizing.");
  if (!project.phase) missingData.push("Electrical phase (single/three) is not set.");
  if ((project.monthlyBill || 0) <= 0 && project.systemType !== "Off-grid" && project.systemType !== "Mini-grid") {
    missingData.push("Monthly bill is blank — needed for savings and payback.");
  }
  const loadSource = project.loadSource || "client_estimate";
  if (loadSource === "client_estimate") missingData.push("Load data is a client estimate — a data logger or itemised survey would raise confidence.");

  // ── Big warnings (safety / commercial) ─────────────────────────────────────
  const engineeringReasons = [];
  if (sizing.coldVocOk === false) { const m = "Cold Voc exceeds the inverter's maximum DC voltage — reduce panels per string."; bigWarnings.push(m); engineeringReasons.push(m); }
  if ((sizing.batteryInputA ?? 0) > (sizing.bmsMaxDischargeA ?? Infinity)) { const m = "Inverter battery current exceeds the BMS discharge limit — add parallel strings or a higher-voltage bank."; bigWarnings.push(m); engineeringReasons.push(m); }
  if (sizing.dcCableAmpacityOk === false) { const m = "DC cable ampacity looks insufficient — increase cable size or shorten the route."; bigWarnings.push(m); engineeringReasons.push(m); }
  if (sizing.acCableAmpacityOk === false) { const m = "AC cable ampacity looks insufficient — increase cable size."; bigWarnings.push(m); engineeringReasons.push(m); }
  if (!project.earthingConfirmed && readiness?.blockers?.some((b) => /earthing/i.test(b))) {
    bigWarnings.push("Earthing is not confirmed — verify or budget for it before quoting.");
  }
  if (!loadInventoryPending && !loadInventoryInvalid && Number.isFinite(payback) && payback > 12) bigWarnings.push(`Payback is ${payback.toFixed(1)} years — commercially weak; review scope, tariff or self-consumption.`);
  else if (!loadInventoryPending && !loadInventoryInvalid && Number.isFinite(payback) && payback > 8) bigWarnings.push(`Payback is ${payback.toFixed(1)} years — above the 8-year target.`);
  if (!loadInventoryPending && !loadInventoryInvalid && !Number.isFinite(payback) && dailyKwh > 0) bigWarnings.push("Payback is not finite — the project shows no net saving as configured.");

  // Fold in any sizing warnings the engine already produced (deduped, capped)
  (Array.isArray(sizing.warnings) ? sizing.warnings : []).forEach((w) => {
    if (typeof w === "string" && !bigWarnings.includes(w)) bigWarnings.push(w);
  });

  // ── Readiness summary ──────────────────────────────────────────────────────
  const score = Number(readiness?.totalScore);
  const readyStatus = readiness?.readyStatus || "Not assessed";
  const blockers = Array.isArray(readiness?.blockers) ? readiness.blockers : [];

  // ── Decisions ──────────────────────────────────────────────────────────────
  const engineeringReviewRequired = !loadInventoryPending && !loadInventoryInvalid && (
    engineeringReasons.length > 0 || blockers.some((b) => /Voc|BMS|ampacity|earthing|CRITICAL/i.test(b))
  );

  const readyForProposal =
    !loadInventoryPending && !loadInventoryInvalid &&
    hasClient && !!project.systemType && dailyKwh > 0 &&
    !engineeringReviewRequired &&
    Number.isFinite(score) && score >= 60 &&
    (Number.isFinite(payback) ? payback <= 12 : false);

  const clientProposalRecommended =
    readyForProposal && Number.isFinite(payback) && payback <= 8 &&
    blockers.length === 0;

  // ── Next 3 actions (ordered by leverage) ────────────────────────────────────
  if (loadInventoryInvalid) nextActions.push("Fix invalid load hours, then click Update Sizing.");
  else if (loadInventoryPending) nextActions.push("Pending load inventory - add committed loads and click Update Sizing.");
  if (engineeringReviewRequired) nextActions.push("Resolve the engineering flags above with a qualified engineer.");
  if (missingData.length > 0) nextActions.push(`Fill the missing data (${missingData.length} item${missingData.length === 1 ? "" : "s"}), starting with loads and client details.`);
  if (Number.isFinite(payback) && payback > 8 && nextActions.length < 3) nextActions.push("Improve payback: revisit tariff, self-consumption or system scope.");
  if (readyForProposal && nextActions.length < 3) nextActions.push("Generate the proposal PDF and review every number before sending.");
  if (nextActions.length === 0) nextActions.push("Complete the load assessment, then click Update Sizing.");
  const next3 = nextActions.slice(0, 3);

  // ── One-line verdict ────────────────────────────────────────────────────────
  let verdict;
  if (loadInventoryInvalid) verdict = "Pending load inventory - fix invalid load hours before sizing.";
  else if (loadInventoryPending) verdict = "Pending load inventory - add committed loads before pricing or proposal.";
  else if (engineeringReviewRequired) verdict = "Engineering review required before this can be quoted.";
  else if (readyForProposal) verdict = clientProposalRecommended ? "Ready — strong enough to take to the client." : "Ready to propose, with a note on the payback.";
  else if (dailyKwh <= 0) verdict = "Not enough data yet — start with the load assessment.";
  else verdict = "Getting there — clear the items below before proposing.";

  return {
    verdict,
    missingData,
    bigWarnings: bigWarnings.slice(0, 8),
    readiness: { score: Number.isFinite(score) ? Math.round(score) : null, status: readyStatus, blockers: blockers.length },
    next3,
    readyForProposal,
    engineeringReviewRequired,
    clientProposalRecommended,
    loadSource,
  };
}

/**
 * inverterCoherence.js — Voltflow 11.6 (Calculation Coherence: Inverter/PV ratio)
 *
 * Explains WHY the inverter was selected and how the PV array relates to it, so a
 * 12 kW inverter with a 4.2 kWp array (DC:AC 0.35) is presented as an
 * interpreted, correctable design decision — not just a red metric.
 *
 * Pure — no React, no DOM. Clamp-safe (no NaN/Infinity) on blank input.
 *
 * IMPORTANT: this module does NOT change the cold-Voc safety check. The string
 * "effectivePanelsPerString" is what the built design uses (capped to available
 * panels); the per-string voltage limit is reported separately and still enforced
 * by the engine's cold-Voc test, so that safety signal is preserved.
 */

export const STANDARD_INVERTERS = [1, 2, 3, 3.6, 5, 6, 8, 10, 12, 15, 20, 30, 50, 100];

export const DCAC_TARGETS = { min: 0.8, idealLow: 1.1, idealHigh: 1.35, max: 1.5 };
export const DEFAULT_RUNNING_DIVERSITY = 0.75;
export const DEFAULT_SURGE_DIVERSITY = 0.65;
export const PV_INVERTER_FACTOR = 1.1; // pvBasedInvKw = actualKwp × 1.1

export const INVERTER_BASES = ["auto_engineering", "backup_peak_led", "pv_ratio_led", "manual_review"];

const finite = (v, fb = 0) => (Number.isFinite(v) ? v : fb);
const pos = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : fb; };
const r2 = (v) => +finite(v).toFixed(2);

export function nextStandardInverter(value, list = STANDARD_INVERTERS) {
  return list.find((x) => x >= value) ?? list[list.length - 1];
}
function prevStandardInverter(value, list = STANDARD_INVERTERS) {
  let best = null;
  for (const x of list) { if (x <= value) best = x; else break; }
  return best;
}

// ── Phase 7: inverter sizing basis ───────────────────────────────────────────

export function computeInverterSizing({
  connectedW = 0, surgeKw = 0, actualKwp = 0,
  runningDiversity = DEFAULT_RUNNING_DIVERSITY, surgeDiversity = DEFAULT_SURGE_DIVERSITY,
  inverterHeadroom = 1.25, basis = "auto_engineering", manualInverterKw = 0,
} = {}) {
  const runningKw = finite(connectedW) / 1000;
  const rawSurgeKw = finite(surgeKw);
  const diversifiedRunningKw = r2(runningKw * pos(runningDiversity, DEFAULT_RUNNING_DIVERSITY));
  const diversifiedSurgeKw = r2(rawSurgeKw * pos(surgeDiversity, DEFAULT_SURGE_DIVERSITY));
  const peakKw = r2(Math.max(diversifiedRunningKw, diversifiedSurgeKw));

  const loadBasedInvKw = r2(peakKw * pos(inverterHeadroom, 1.25));
  const pvBasedInvKw = r2(finite(actualKwp) * PV_INVERTER_FACTOR);
  const engineeringMinInvKw = r2(Math.max(loadBasedInvKw, pvBasedInvKw));

  const useBasis = INVERTER_BASES.includes(basis) ? basis : "auto_engineering";
  let selectedInverterKw, loadSupported = true, requiresNote = false;
  if (useBasis === "backup_peak_led") {
    selectedInverterKw = nextStandardInverter(loadBasedInvKw);
  } else if (useBasis === "pv_ratio_led") {
    selectedInverterKw = nextStandardInverter(pvBasedInvKw);
    loadSupported = selectedInverterKw >= loadBasedInvKw - 0.001;
  } else if (useBasis === "manual_review") {
    selectedInverterKw = nextStandardInverter(pos(manualInverterKw, engineeringMinInvKw));
    loadSupported = selectedInverterKw >= loadBasedInvKw - 0.001;
    requiresNote = true;
  } else {
    selectedInverterKw = nextStandardInverter(engineeringMinInvKw);
  }
  loadSupported = selectedInverterKw >= loadBasedInvKw - 0.001;
  const catalogueExceeded = (useBasis === "backup_peak_led" ? loadBasedInvKw : useBasis === "pv_ratio_led" ? pvBasedInvKw : useBasis === "manual_review" ? pos(manualInverterKw, engineeringMinInvKw) : engineeringMinInvKw) > STANDARD_INVERTERS[STANDARD_INVERTERS.length - 1];

  // Which physical driver set the engineering minimum?
  const span = Math.max(loadBasedInvKw, pvBasedInvKw, 0.001);
  const closeEnough = Math.abs(loadBasedInvKw - pvBasedInvKw) / span < 0.1;
  let isBalanced = closeEnough, isLoadLed = false, isPvLed = false;
  if (!isBalanced) { if (loadBasedInvKw > pvBasedInvKw) isLoadLed = true; else isPvLed = true; }
  if (useBasis === "backup_peak_led") { isLoadLed = true; isBalanced = false; isPvLed = false; }
  if (useBasis === "pv_ratio_led") { isPvLed = true; isBalanced = false; isLoadLed = false; }

  let selectedReason;
  if (useBasis === "backup_peak_led") selectedReason = "Backup / peak demand (backup-led design)";
  else if (useBasis === "pv_ratio_led") selectedReason = "PV array size (PV-ratio-led)";
  else if (useBasis === "manual_review") selectedReason = "Manual engineer selection";
  else if (isBalanced) selectedReason = "Balanced load and PV sizing";
  else if (isLoadLed) selectedReason = "Load / surge demand";
  else selectedReason = "PV array size";

  return {
    runningKw: r2(runningKw), surgeKw: r2(rawSurgeKw),
    diversifiedRunningKw, diversifiedSurgeKw, peakKw,
    loadBasedInvKw, pvBasedInvKw, engineeringMinInvKw,
    selectedInverterKw, selectedReason,
    isLoadLed, isPvLed, isBalanced,
    inverterHeadroom: peakKw > 0 ? r2(selectedInverterKw / peakKw) : 0,
    basis: useBasis, loadSupported, requiresNote, catalogueExceeded,
    runningDiversity: pos(runningDiversity, DEFAULT_RUNNING_DIVERSITY),
    surgeDiversity: pos(surgeDiversity, DEFAULT_SURGE_DIVERSITY),
  };
}

// ── Phase 7/8: DC:AC interpretation ──────────────────────────────────────────

export function computeDcAcAnalysis({ actualKwp = 0, inverterKw = 0, panelW = 550, basis = "auto_engineering", selectedReason = "" } = {}) {
  const kwp = finite(actualKwp);
  const inv = pos(inverterKw, 0.001);
  const w = pos(panelW, 550);
  const ratio = +(kwp / inv).toFixed(2);
  const t = DCAC_TARGETS;

  let status, severity;
  if (ratio < 0.5) { status = "Severe low PV-to-inverter mismatch"; severity = "high"; }
  else if (ratio < t.min) { status = "Low PV-to-inverter ratio"; severity = "medium"; }
  else if (ratio < t.idealLow) { status = "Acceptable"; severity = "none"; }
  else if (ratio <= t.idealHigh) { status = "Optimal"; severity = "none"; }
  else if (ratio <= t.max) { status = "High but acceptable — review"; severity = "low"; }
  else { status = "High clipping risk"; severity = "medium"; }

  // Intentional backup-led designs carry a lower severity (still cautioned).
  const backupLed = basis === "backup_peak_led";
  if (backupLed && ratio < t.min) {
    severity = severity === "high" ? "medium" : "low";
    status += " (intentional backup-led design)";
  }

  const recommendedMinPvKwpForSelectedInverter = r2(inv * t.min);
  const recommendedIdealPvKwpLow = r2(inv * t.idealLow);
  const recommendedIdealPvKwpHigh = r2(inv * t.idealHigh);
  const panelsFor = (targetKwp) => Math.max(0, Math.ceil(Math.max(0, targetKwp - kwp) * 1000 / w));
  const additionalPanelsToReachMinRatio = panelsFor(recommendedMinPvKwpForSelectedInverter);
  const additionalPanelsToReachIdealLow = panelsFor(recommendedIdealPvKwpLow);

  // Smaller inverter that would lift the ratio to ≥ min, if a smaller standard exists.
  const smallerCandidate = prevStandardInverter(kwp / t.min);
  const suggestedSmallerInverterKw = smallerCandidate && smallerCandidate < inv ? smallerCandidate : null;

  const isLow = ratio < t.min;
  const isSevere = ratio < 0.5;
  const isHigh = ratio > t.max;

  let explanation;
  if (isLow) {
    explanation = `${selectedReason ? selectedReason + ". " : ""}The PV array (${r2(kwp)} kWp) is below the ideal solar input range for this ${r2(inv)} kW inverter (target ≥ ${recommendedMinPvKwpForSelectedInverter} kWp at ${t.min} DC:AC). This inverter is sized primarily for load/backup demand. It can be acceptable for backup-led systems but should be reviewed — increase the PV array, or use a smaller inverter if peak/surge demand allows.`;
  } else if (isHigh) {
    explanation = `The PV array is large relative to the ${r2(inv)} kW inverter (DC:AC ${ratio}). Some midday production may clip; confirm the inverter's MPPT and AC limits and whether the extra harvest is worthwhile.`;
  } else {
    explanation = `PV and inverter are well matched (DC:AC ${ratio}, within the ${t.min}–${t.max} window).`;
  }

  const correctiveActions = isLow ? [
    { action: "Increase PV array", detail: `Add ~${additionalPanelsToReachMinRatio} panel(s) to reach the ${t.min} minimum (${recommendedMinPvKwpForSelectedInverter} kWp), or ~${additionalPanelsToReachIdealLow} to reach the ideal ${t.idealLow} (${recommendedIdealPvKwpLow} kWp).`, actionTab: "generation" },
    { action: "Reduce inverter size if load allows", detail: suggestedSmallerInverterKw ? `A ${suggestedSmallerInverterKw} kW inverter would raise the ratio to ≥ ${t.min} — only if the peak/surge demand is genuinely lower.` : "Peak/surge demand already needs this inverter; reducing it may under-serve peak loads.", actionTab: "inverter" },
    { action: "Split non-critical loads", detail: "Move deferrable loads off the backup inverter to lower peak demand.", actionTab: "loads" },
    { action: "Adjust load diversity / simultaneity", detail: "Confirm how many loads truly run at once; a lower running-diversity factor reduces the inverter.", actionTab: "inverter" },
    { action: "Accept backup-led design", detail: "If intentionally sized for backup/surge, set the inverter basis to 'backup-led' and record an engineering note.", actionTab: "inverter" },
    { action: "Recheck load inventory", detail: "If peak looks unrealistic, verify quantities, watts and surge factors in Load Assessment.", actionTab: "loads" },
  ] : [];

  return {
    ratio, status, severity,
    targetMin: t.min, targetIdealLow: t.idealLow, targetIdealHigh: t.idealHigh, targetMax: t.max,
    recommendedMinPvKwpForSelectedInverter, recommendedIdealPvKwpLow, recommendedIdealPvKwpHigh,
    additionalPanelsToReachMinRatio, additionalPanelsToReachIdealLow,
    suggestedSmallerInverterKw,
    isLow, isSevere, isHigh, backupLed,
    explanation, correctiveActions,
  };
}

// ── Phase 8: string sizing clarity ───────────────────────────────────────────

export function computeStringSizing({ requestedPanelsPerString = 1, totalPanels = 1, maxPanelsPerStringByVoltage = 1, vocCold = 0, moduleVmp = 0 } = {}) {
  const requested = Math.max(1, Math.floor(pos(requestedPanelsPerString, 1)));
  const total = Math.max(1, Math.floor(pos(totalPanels, 1)));
  const maxByVoltage = Math.max(1, Math.floor(pos(maxPanelsPerStringByVoltage, 1)));
  // What the built design actually uses (capped to available panels only, so the
  // cold-Voc safety check still fires when a string is electrically too long).
  const effectivePanelsPerString = Math.min(requested, total);
  const strings = Math.max(1, Math.ceil(total / effectivePanelsPerString));
  const stringVocCold = r2(finite(vocCold) * effectivePanelsPerString);
  const stringVmp = r2(finite(moduleVmp) * effectivePanelsPerString);

  let note = null;
  if (requested > total) {
    note = `You entered ${requested} panels per string, but only ${total} panel(s) are available. The design uses ${strings} string(s) of ${effectivePanelsPerString} panel(s).`;
  } else if (effectivePanelsPerString > maxByVoltage) {
    note = `A string of ${effectivePanelsPerString} panels exceeds the voltage limit (max ${maxByVoltage} by cold Voc). Reduce panels per string or raise the inverter max DC voltage.`;
  }

  return {
    requestedPanelsPerString: requested,
    effectivePanelsPerString,
    maxPanelsPerStringByVoltage: maxByVoltage,
    totalPanels: total,
    strings,
    stringVocCold,
    stringVmp,
    note,
  };
}

// Convenience: run all three from the engine's primitives.
export function analyzeInverterCoherence(input = {}) {
  const inverterSizing = computeInverterSizing(input);
  const dcAcAnalysis = computeDcAcAnalysis({
    actualKwp: input.actualKwp, inverterKw: inverterSizing.selectedInverterKw,
    panelW: input.panelW, basis: inverterSizing.basis, selectedReason: inverterSizing.selectedReason,
  });
  const stringSizing = computeStringSizing({
    requestedPanelsPerString: input.requestedPanelsPerString,
    totalPanels: input.totalPanels ?? input.panels,
    maxPanelsPerStringByVoltage: input.maxPanelsPerStringByVoltage,
    vocCold: input.vocCold, moduleVmp: input.moduleVmp,
  });
  return { inverterSizing, dcAcAnalysis, stringSizing };
}

/**
 * scenarios.js — Voltflow 11.7 (Studio: Good / Better / Best / Custom cards)
 *
 * Scenario cards are deterministic parameter presets. They only adjust a few
 * project inputs (solar coverage + backup depth); the REAL sizing is still done
 * by the existing engine (useSizing) on the returned project — no sizing rewrite.
 * Pure — no React, no DOM.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

export const SCENARIOS = [
  { id: "good",   name: "Good",   tag: "Budget",                 icon: "💛",
    desc: "Lowest cost — essential loads and a shorter backup window.",
    coverageMul: 0.75, backupMul: 0.6, autonomyMul: 0.7 },
  { id: "better", name: "Better", tag: "Balanced",               icon: "💚",
    desc: "Balanced cost, savings and backup — the usual recommendation.",
    coverageMul: 1.0, backupMul: 1.0, autonomyMul: 1.0 },
  { id: "best",   name: "Best",   tag: "High-backup / future-ready", icon: "💙",
    desc: "Maximum resilience and headroom for future loads.",
    coverageMul: 1.15, backupMul: 1.6, autonomyMul: 1.5 },
  { id: "custom", name: "Custom", tag: "Engineer-defined",       icon: "🛠️",
    desc: "Use the current, engineer-set project values as-is.",
    coverageMul: null, backupMul: null, autonomyMul: null },
];

export function getScenario(id) { return SCENARIOS.find((s) => s.id === id) || null; }

/**
 * buildScenarioProject(baseProject, id) → a new project with adjusted coverage +
 * backup. "custom" returns the base unchanged (plus selectedScenarioId). Never
 * mutates the input; all values clamped to safe ranges.
 */
export function buildScenarioProject(baseProject = {}, id) {
  const s = getScenario(id) || getScenario("better");
  const p = { ...baseProject, selectedScenarioId: s.id };
  if (s.coverageMul == null) return p; // custom
  const baseCoverage = Number(baseProject.solarCoverage) || 0.8;
  const baseBackup = Number(baseProject.backupHours) || 6;
  const baseAutonomy = Number(baseProject.autonomyDays) || 1;
  p.solarCoverage = clamp(+(baseCoverage * s.coverageMul).toFixed(2), 0.3, 1.0);
  p.backupHours = clamp(Math.round(baseBackup * s.backupMul), 1, 48);
  p.autonomyDays = clamp(+(baseAutonomy * s.autonomyMul).toFixed(1), 0.5, 5);
  return p;
}

/**
 * scenarioConfidence(sizing, readiness) → 0..100. A rough, deterministic score
 * for the card: rewards no critical issues, a healthy DC:AC ratio and real
 * battery backup. Advisory only.
 */
export function scenarioConfidence(sizing = {}, readiness = {}) {
  let score = 60;
  const crit = (readiness.criticalIssues || []).length;
  score -= crit * 20;
  const ratio = Number(sizing?.dcAcAnalysis?.ratio);
  if (Number.isFinite(ratio) && ratio >= 0.8 && ratio <= 1.5) score += 15;
  if ((Number(sizing.batteryKwh) || 0) > 0) score += 10;
  if (readiness.readyForProposal) score += 15;
  return clamp(Math.round(score), 0, 100);
}

export function backupExpectation(sizing = {}) {
  const kwh = Number(sizing.batteryKwh) || 0;
  if (kwh <= 0) return "No battery backup (solar/daytime only)";
  const h = Number(sizing.autonomyHours) || 0;
  return `~${h.toFixed(0)} h on critical loads (24-h average)`;
}

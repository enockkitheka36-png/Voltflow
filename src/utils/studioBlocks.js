/**
 * studioBlocks.js — Voltflow 11.7 (Studio: visual project blocks)
 *
 * Turns the central readiness engine + sizing into the 10 visual project blocks
 * the Studio command-centre renders (client → delivery). Pure — reads existing
 * state, never recomputes sizing. Each block carries a status, a key metric,
 * missing/warning counts and where its "action" routes.
 */

const f = (v, d = 1) => (Number.isFinite(Number(v)) ? Number(v).toFixed(d) : "—");
const money = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? `KES ${Math.round(Number(v)).toLocaleString()}` : "—");

// Fixed block spec: label, icon, which readiness section drives it, its tab + metric.
const BLOCK_SPEC = [
  { key: "client", label: "Client", icon: "👤", section: "clientDetails", actionTab: "project", highlightId: "client-fields", metric: () => null },
  { key: "site", label: "Site", icon: "📍", section: "siteSurvey", actionTab: "site-survey", highlightId: "survey-fields", metric: () => null },
  { key: "loads", label: "Loads", icon: "🔌", section: "loadInventory", actionTab: "loads", highlightId: "load-table", metric: (s) => `${f(s.dailyKwh, 1)} kWh/day` },
  { key: "pv", label: "PV Array", icon: "🔆", section: "pvSizing", actionTab: "generation", highlightId: "pv-card", metric: (s) => `${f(s.actualKwp, 1)} kWp` },
  { key: "battery", label: "Battery", icon: "🔋", section: "batterySizing", actionTab: "battery", highlightId: "night-autonomy-card", metric: (s) => `${f(s.batteryKwh, 1)} kWh` },
  { key: "inverter", label: "Inverter", icon: "🔁", section: "inverterSafety", actionTab: "inverter", highlightId: "cold-voc-card", metric: (s) => `${f(s.inverterKw, 1)} kW` },
  { key: "borehole", label: "Borehole", icon: "💧", section: "borehole", actionTab: "borehole", highlightId: "borehole-card", metric: (s, b, enabled) => (enabled ? `${Math.round(Number(b?.dailyWaterDemandLitres) || 0).toLocaleString()} L/day` : "Off") },
  { key: "boq", label: "BoQ", icon: "🧾", section: "boq", actionTab: "boq", highlightId: "boq-table", metric: (s) => money(s.totalCost) },
  { key: "proposal", label: "Proposal", icon: "📄", section: "proposal", actionTab: "proposal", highlightId: "proposal-actions", metric: () => null },
  { key: "delivery", label: "Delivery", icon: "🚚", section: "delivery", actionTab: "delivery", highlightId: "delivery-stage", metric: () => null },
];

/**
 * buildStudioBlocks(readiness, sizing, borehole, boreholeEnabled) → array of blocks:
 *   { key, label, icon, status, metric, missingCount, warningCount, actionTab, highlightId, actionLabel }
 */
export function buildStudioBlocks(readiness = {}, sizing = {}, borehole = null, boreholeEnabled = false) {
  const sections = readiness.sections || {};
  const warnings = readiness.warnings || [];
  const criticals = readiness.criticalIssues || [];
  const loadBlocked = !!sizing.loadInventoryBlocked || !!sizing.loadInventoryPending || !!sizing.loadInventoryInvalid;
  return BLOCK_SPEC.map((spec) => {
    const sec = sections[spec.section];
    let status = sec ? sec.status : "not_started";
    // Borehole block: reflect the module's on/off state when there's no section.
    if (spec.key === "borehole" && !sec) status = boreholeEnabled ? "in_progress" : "not_started";
    const missingCount = sec ? (sec.missingItems || []).length : 0;
    const warningCount =
      warnings.filter((w) => w.actionTab === spec.actionTab).length +
      criticals.filter((c) => c.actionTab === spec.actionTab).length +
      (sec && sec.critical ? 1 : 0);
    return {
      key: spec.key, label: spec.label, icon: spec.icon,
      status,
      metric: loadBlocked && ["loads", "pv", "battery", "inverter", "boq", "proposal"].includes(spec.key)
        ? (spec.key === "loads" ? "Pending load inventory" : "Pending")
        : spec.metric(sizing, borehole, boreholeEnabled),
      missingCount, warningCount,
      actionTab: spec.actionTab, highlightId: spec.highlightId,
      actionLabel: sec?.actionLabel || `Open ${spec.label}`,
    };
  });
}

// Overall completion % from the blocks that map to a real readiness section.
export function studioProgressPct(blocks = []) {
  const scored = { complete: 100, needs_review: 70, incomplete: 40, in_progress: 40, not_started: 0 };
  if (!blocks.length) return 0;
  const core = blocks.filter((b) => b.key !== "delivery" && b.key !== "borehole");
  const total = core.reduce((s, b) => s + (scored[b.status] ?? 0), 0);
  return Math.round(total / core.length);
}

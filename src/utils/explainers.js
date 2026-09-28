/**
 * explainers.js — Voltflow 11.7 (Studio: "Explain this" drawers)
 *
 * Plain-language + formula explanations for the major outputs, so a sales user
 * can explain the numbers to a client and an engineer can see the basis. Pure —
 * reads a context object { project, sizing, borehole, readiness } and returns a
 * structured explanation. It EXPLAINS existing deterministic outputs; it never
 * recomputes or replaces them.
 */

const f = (v, d = 1, fb = "—") => (Number.isFinite(Number(v)) ? Number(v).toFixed(d) : fb);
const kes = (v) => (Number.isFinite(Number(v)) ? `KES ${Math.round(Number(v)).toLocaleString()}` : "—");
const pctf = (v) => (Number.isFinite(Number(v)) ? `${(Number(v) * 100).toFixed(1)}%` : "—");

export const EXPLAIN_KEYS = [
  "pvSize", "panelCount", "inverterSize", "dcAcRatio", "batterySize", "autonomy",
  "nightAutonomy", "boreholePump", "boreholePv", "tankStorage", "totalCost", "payback", "readinessScore",
];

const COMMON_DISCLAIMER = "Planning-level figure — confirm with site survey, equipment datasheets and qualified engineering review.";

const BUILDERS = {
  pvSize: ({ project = {}, sizing = {} }) => ({
    title: "PV array size",
    plain: `The solar array is sized to cover your target share of daily energy. It works out to about ${f(sizing.actualKwp, 1)} kWp.`,
    formula: "requiredKwp = (dailyKwh × coverage) ÷ (PSH × PR); rounded up to whole panels → actualKwp",
    inputs: [["Design daily energy", `${f(sizing.designDailyKwh, 1)} kWh`], ["Solar coverage target", pctf(project.solarCoverage)], ["Peak sun hours", `${f(project.psh, 2)} h`], ["Performance ratio", pctf(sizing.pr)], ["Result", `${f(sizing.actualKwp, 1)} kWp`]],
    assumptions: ["Average irradiance for the site profile", "Standard loss/performance ratio"],
    warnings: [], verify: ["Roof area/orientation can host the panels", "Actual consumption vs the daily-energy estimate"],
  }),
  panelCount: ({ project = {}, sizing = {} }) => ({
    title: "Panel count",
    plain: `${sizing.panels || 0} panels of ${project.panelW || "—"} W each make up the array.`,
    formula: "panels = ceil(requiredKwp × 1000 ÷ panelWatts)",
    inputs: [["Required kWp", `${f(sizing.requiredKwp, 2)} kWp`], ["Panel wattage", `${project.panelW || "—"} W`], ["Panels", `${sizing.panels || 0}`], ["Actual array", `${f(sizing.actualKwp, 1)} kWp`]],
    assumptions: ["Whole panels only (rounded up)"], warnings: [], verify: ["Panels physically fit the roof/ground area"],
  }),
  inverterSize: ({ sizing = {} }) => {
    const inv = sizing.inverterSizing || {};
    return {
      title: "Inverter size",
      plain: `The inverter is ${f(sizing.inverterKw, 1)} kW. It was chosen by: ${inv.selectedReason || "engineering minimum"}.`,
      formula: "inverterKw = nextStandard(max(loadBasedKw, pvBasedKw)); loadBasedKw = peakKw × headroom; peakKw = max(running×diversity, surge×diversity)",
      inputs: [["Load/surge-based", `${f(inv.loadBasedInvKw, 1)} kW`], ["PV-based", `${f(inv.pvBasedInvKw, 1)} kW`], ["Diversified peak", `${f(inv.peakKw, 2)} kW`], ["Selected", `${f(sizing.inverterKw, 1)} kW`], ["Reason", inv.selectedReason || "—"]],
      assumptions: ["Load diversity factors (not all loads run at once)", "Standard inverter sizes"],
      warnings: inv.isLoadLed ? ["Load-led sizing: confirm real simultaneity of loads"] : [], verify: ["Peak/surge demand is realistic", "Inverter model supports the string voltage"],
    };
  },
  dcAcRatio: ({ sizing = {} }) => {
    const dc = sizing.dcAcAnalysis || {};
    return {
      title: "DC:AC ratio",
      plain: dc.explanation || `The DC:AC ratio is ${f(dc.ratio, 2)} (${dc.status || "—"}). It compares PV size to inverter size.`,
      formula: "ratio = actualKwp ÷ inverterKw; healthy target ≈ 0.8–1.5 (ideal 1.1–1.35)",
      inputs: [["PV", `${f(sizing.actualKwp, 1)} kWp`], ["Inverter", `${f(sizing.inverterKw, 1)} kW`], ["Ratio", f(dc.ratio, 2)], ["Status", dc.status || "—"]],
      assumptions: ["Standard clipping/utilisation bands"],
      warnings: dc.isLow ? [`Low ratio — consider adding ~${dc.additionalPanelsToReachMinRatio ?? "?"} panels or a smaller inverter`] : (dc.isHigh ? ["High ratio — check inverter MPPT/AC limits for clipping"] : []),
      verify: ["Whether the design is intentionally backup/load-led"],
    };
  },
  batterySize: ({ project = {}, sizing = {} }) => ({
    title: "Battery size",
    plain: `The battery bank is about ${f(sizing.batteryKwh, 1)} kWh, sized to carry your critical loads through the chosen backup window.`,
    formula: "requiredKwh = backupEnergyNeed ÷ (DoD × efficiency); rounded up to whole modules",
    inputs: [["Backup energy need", `${f(sizing.backupEnergyNeed, 1)} kWh`], ["Depth of discharge", pctf(project.dod)], ["Round-trip efficiency", pctf(project.batteryEfficiency)], ["Modules", `${sizing.batteryModules || 0}`], ["Usable", `${f(sizing.usableBatteryKwh, 1)} kWh`]],
    assumptions: ["Backup covers critical loads only", "Battery derates with temperature/age"],
    warnings: [], verify: ["Which loads are truly critical", "Backup window expectation with the client"],
  }),
  autonomy: ({ sizing = {} }) => ({
    title: "Autonomy (24-h average)",
    plain: `On a 24-hour average, the battery carries the critical load for roughly ${f(sizing.autonomyHours, 1)} hours.`,
    formula: "autonomyHours = usableBatteryKwh ÷ (backupEnergyNeed ÷ backupWindow)",
    inputs: [["Usable battery", `${f(sizing.usableBatteryKwh, 1)} kWh`], ["Autonomy (avg)", `${f(sizing.autonomyHours, 1)} h`]],
    assumptions: ["24-hour AVERAGE load — not the same as night-only backup"],
    warnings: ["For night-dominant loads use the night-autonomy figure instead"], verify: ["Real load profile vs the average"],
  }),
  nightAutonomy: ({ readiness = {} }) => {
    const n = readiness.night || {};
    return {
      title: "Night-load autonomy",
      plain: n.nightAutonomyWarning || `The battery covers about ${pctf(n.nightEnergyCoverage)} of the critical night energy (~${f(n.estimatedNightAutonomyHours, 1)} h).`,
      formula: "nightEnergyCoverage = usableBatteryKwh ÷ criticalNightKwh; window ≈ 11 h",
      inputs: [["Night load share", pctf(n.nightLoadShare)], ["Critical night energy", `${f(n.criticalNightKwh, 1)} kWh`], ["Coverage", pctf(n.nightEnergyCoverage)], ["Est. night autonomy", `${f(n.estimatedNightAutonomyHours, 1)} h`]],
      assumptions: ["Assumed 11-hour night window"],
      warnings: n.isNightDominantLoad && n.nightEnergyCoverage < 1 ? ["Night-dominant load — average autonomy overstates real backup"] : [],
      verify: ["Actual night hours of operation for the loads"],
    };
  },
  boreholePump: ({ borehole = {} }) => ({
    title: "Borehole pump size",
    plain: `The pump works out to about ${f(borehole.pumpElectricalKw, 2)} kW (~${borehole.suggestedPumpHp || "—"} HP) to lift the required flow against the total head.`,
    formula: "pumpKw = hydraulicKw ÷ (pumpEff × motorEff × ctrlEff); hydraulicKw = (flow × TDH × 9.81) ÷ 3600",
    inputs: [["Required flow", `${Math.round(Number(borehole.requiredFlowLitresPerHour) || 0).toLocaleString()} L/h`], ["Total dynamic head", `${f(borehole.totalDynamicHeadM, 0)} m`], ["Pump (electrical)", `${f(borehole.pumpElectricalKw, 2)} kW`], ["Suggested", `~${borehole.suggestedPumpHp || "—"} HP`]],
    assumptions: ["Conservative pump/motor/controller efficiencies"],
    warnings: ["Final pump selection requires pump curve and borehole test confirmation"], verify: ["Borehole test report, yield and water level"],
  }),
  boreholePv: ({ borehole = {} }) => ({
    title: "Borehole PV size",
    plain: `About ${f(borehole.recommendedPvKwp, 2)} kWp of PV (${borehole.estimatedPanels || 0} panels) is recommended to run the pump.`,
    formula: "requiredPvKwp = dailyPumpingKwh ÷ (PSH × PR); power floor = pumpKw × 1.25; recommend the larger",
    inputs: [["Daily pumping energy", `${f(borehole.dailyPumpingKwh, 1)} kWh`], ["Recommended PV", `${f(borehole.recommendedPvKwp, 2)} kWp`], ["Panels", `${borehole.estimatedPanels || 0}`]],
    assumptions: ["Solar-direct array must run the pump at rated flow"], warnings: [], verify: ["Array can be sited near the borehole with minimal shading"],
  }),
  tankStorage: ({ borehole = {} }) => ({
    title: "Tank storage",
    plain: `A storage tank of about ${Math.round(Number(borehole.recommendedTankLitres) || 0).toLocaleString()} litres gives water buffer for cloudy days.`,
    formula: "recommendedTankLitres = dailyWaterDemandLitres × storageAutonomyDays",
    inputs: [["Daily demand", `${Math.round(Number(borehole.dailyWaterDemandLitres) || 0).toLocaleString()} L`], ["Recommended tank", `${Math.round(Number(borehole.recommendedTankLitres) || 0).toLocaleString()} L`]],
    assumptions: ["Storage is the 'battery' for solar pumping"], warnings: [], verify: ["Tank site, height and structural support"],
  }),
  totalCost: ({ sizing = {} }) => ({
    title: "Total cost",
    plain: `The indicative system cost is ${kes(sizing.totalCost)}, including equipment, installation, contingency and VAT.`,
    formula: "total = (PV + inverter + battery + BOS + EPC) × (1 + contingency) × (1 + VAT)",
    inputs: [["Indicative total", kes(sizing.totalCost)]],
    assumptions: ["Placeholder unit costs — confirm with supplier quotes"], warnings: [], verify: ["Current equipment prices and installation scope"],
  }),
  payback: ({ sizing = {} }) => ({
    title: "Payback",
    plain: `Simple payback is about ${f(sizing.payback, 1)} years — how long the savings take to cover the cost.`,
    formula: "payback = totalCost ÷ annualNetSavings",
    inputs: [["Total cost", kes(sizing.totalCost)], ["Annual savings (P50)", kes(sizing.annualSavings)], ["Payback", `${f(sizing.payback, 1)} yrs`]],
    assumptions: ["Assumed tariff and escalation; savings capped to bill where set"], warnings: [], verify: ["Actual tariff, consumption and self-consumption rate"],
  }),
  readinessScore: ({ readiness = {} }) => ({
    title: "Readiness score",
    plain: `Readiness is ${Math.round(Number(readiness.overallScore) || 0)}/100 — how complete and safe-to-quote the project is.`,
    formula: "average of the core section scores (client, survey, loads, PV, battery, inverter, compliance, BoQ, proposal)",
    inputs: [["Overall", `${Math.round(Number(readiness.overallScore) || 0)}/100`], ["Critical issues", `${(readiness.criticalIssues || []).length}`], ["Proposal-safe", readiness.readyForProposal ? "Yes" : "No"]],
    assumptions: ["A workflow aid, not certified approval"], warnings: (readiness.criticalIssues || []).map((c) => c.label), verify: ["Every number before issuing a quotation"],
  }),
};

/**
 * explain(key, ctx) → { key, title, plain, formula, inputs, assumptions, warnings, verify, disclaimer }
 * Always returns a usable object (falls back gracefully for unknown keys).
 */
export function explain(key, ctx = {}) {
  const builder = BUILDERS[key];
  const base = builder ? builder(ctx) : { title: key, plain: "No explanation available for this item.", formula: "", inputs: [], assumptions: [], warnings: [], verify: [] };
  return { key, disclaimer: COMMON_DISCLAIMER, assumptions: [], warnings: [], verify: [], inputs: [], ...base };
}

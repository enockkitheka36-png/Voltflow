/**
 * loadEngine.js — Solarise Pro v10
 * Single source of truth for load assessment across residential, commercial,
 * industrial and special-purpose sites. Pure functions — no React, no DOM.
 *
 * IMPORTANT: toLegacyLoads() is the only bridge into the existing sizing
 * engine (useSizing/computeOptionSizing in App.jsx) and into readiness.js /
 * advisory.js. Those consumers are NOT modified — they keep reading the same
 * flat {qty, watts, dayHours, nightHours, surge, critical} shape they always
 * have. Do not add a second sizing path here.
 */

// ─── Load modes ────────────────────────────────────────────────────────────

export const LOAD_MODES = [
  { value: "Residential",              label: "Residential" },
  { value: "Small Commercial",         label: "Small Commercial" },
  { value: "Commercial & Industrial",  label: "Commercial & Industrial" },
  { value: "Industrial / Manufacturing", label: "Industrial / Manufacturing" },
  { value: "Agricultural / Pumping",   label: "Agricultural / Pumping" },
  { value: "Hospitality / Hotel",      label: "Hospitality / Hotel" },
  { value: "Cold Room / Refrigeration", label: "Cold Room / Refrigeration" },
  { value: "School / Institution",     label: "School / Institution" },
  { value: "Hospital / Clinic",        label: "Hospital / Clinic" },
  { value: "Apartment / Multi-tenant", label: "Apartment / Multi-tenant" },
  { value: "Workshop",                 label: "Workshop" },
  { value: "Warehouse",                label: "Warehouse" },
  { value: "Custom",                   label: "Custom" },
];

// Demand/diversity defaults are planning-level rules of thumb, not a
// certified electrical design standard — same epistemic stance as the rest
// of this app (see roofGeometry.js / installerSimulation.js disclaimers).
export const LOAD_MODE_DEFAULTS = {
  "Residential": {
    demandFactorPct: 100, diversityFactorPct: 100, presetGroup: "residential",
    proposalLanguage: "Sized from itemised household appliance loads.",
    dataLoggerMinDays: 0, dataLoggerMaxDays: 0,
  },
  "Small Commercial": {
    demandFactorPct: 65, diversityFactorPct: 80, presetGroup: "commercial",
    proposalLanguage: "Sized from itemised commercial loads with demand and diversity factors applied for shops, clinics and small offices.",
    dataLoggerMinDays: 7, dataLoggerMaxDays: 7,
  },
  "Commercial & Industrial": {
    demandFactorPct: 60, diversityFactorPct: 75, presetGroup: "commercial",
    proposalLanguage: "Sized for mixed-use commercial/industrial demand with demand and diversity factors applied.",
    dataLoggerMinDays: 7, dataLoggerMaxDays: 14,
  },
  "Industrial / Manufacturing": {
    demandFactorPct: 70, diversityFactorPct: 70, presetGroup: "industrial",
    proposalLanguage: "Sized from production load schedule, motor starting requirements and duty cycles.",
    dataLoggerMinDays: 14, dataLoggerMaxDays: 30,
  },
  "Agricultural / Pumping": {
    demandFactorPct: 80, diversityFactorPct: 85, presetGroup: "industrial",
    proposalLanguage: "Sized for pumping/irrigation duty cycle and borehole/motor starting requirements.",
    dataLoggerMinDays: 7, dataLoggerMaxDays: 14,
  },
  "Hospitality / Hotel": {
    demandFactorPct: 50, diversityFactorPct: 60, presetGroup: "commercial",
    proposalLanguage: "Sized with hotel-typical room and common-area diversity applied.",
    dataLoggerMinDays: 7, dataLoggerMaxDays: 14,
  },
  "Cold Room / Refrigeration": {
    demandFactorPct: 85, diversityFactorPct: 90, presetGroup: "industrial",
    proposalLanguage: "Sized for continuous compressor duty with defrost and starting surge accounted for.",
    dataLoggerMinDays: 7, dataLoggerMaxDays: 14,
  },
  "School / Institution": {
    demandFactorPct: 55, diversityFactorPct: 70, presetGroup: "commercial",
    proposalLanguage: "Sized for institutional occupancy patterns with daytime-weighted demand.",
    dataLoggerMinDays: 7, dataLoggerMaxDays: 7,
  },
  "Hospital / Clinic": {
    demandFactorPct: 70, diversityFactorPct: 80, presetGroup: "commercial",
    proposalLanguage: "Sized with a high essential-load fraction for continuity of critical medical equipment.",
    dataLoggerMinDays: 7, dataLoggerMaxDays: 14,
  },
  "Apartment / Multi-tenant": {
    demandFactorPct: 45, diversityFactorPct: 50, presetGroup: "commercial",
    proposalLanguage: "Sized with multi-unit diversity applied across tenant loads and common areas.",
    dataLoggerMinDays: 7, dataLoggerMaxDays: 14,
  },
  "Workshop": {
    demandFactorPct: 65, diversityFactorPct: 70, presetGroup: "industrial",
    proposalLanguage: "Sized for intermittent workshop/fabrication duty with motor starting requirements.",
    dataLoggerMinDays: 7, dataLoggerMaxDays: 14,
  },
  "Warehouse": {
    demandFactorPct: 50, diversityFactorPct: 65, presetGroup: "industrial",
    proposalLanguage: "Sized for warehouse lighting, security and intermittent material-handling loads.",
    dataLoggerMinDays: 7, dataLoggerMaxDays: 14,
  },
  "Custom": {
    demandFactorPct: 100, diversityFactorPct: 100, presetGroup: "all",
    proposalLanguage: "Sized from manually specified load assumptions.",
    dataLoggerMinDays: 7, dataLoggerMaxDays: 14,
  },
};

export function getModeDefaults(mode) {
  return LOAD_MODE_DEFAULTS[mode] || LOAD_MODE_DEFAULTS.Custom;
}

// ─── Starting-method default surge multipliers (used when not overridden) ──

export const STARTING_METHODS = ["DOL", "Star-Delta", "Soft Starter", "VFD/Inverter", "Unknown"];

export const STARTING_METHOD_SURGE = {
  "DOL": 7, "Star-Delta": 2.5, "Soft Starter": 3, "VFD/Inverter": 1.2, "Unknown": 4,
};

export const LOAD_PHASES = ["SINGLE_PHASE", "THREE_PHASE", "DC", "UNKNOWN"];
export const LOAD_SUPPLY_SCOPES = ["SOLAR", "BACKUP", "GRID_ONLY", "EXCLUDED"];
export const LOAD_CRITICALITIES = ["CRITICAL", "ESSENTIAL", "NON_CRITICAL"];

export function normalizeLoadPhase(value) {
  const phase = String(value || "").trim().toUpperCase().replace(/[ -]+/g, "_");
  if (phase === "SINGLE" || phase === "1_PHASE" || phase === "1PH") return "SINGLE_PHASE";
  if (phase === "THREE" || phase === "3_PHASE" || phase === "3PH") return "THREE_PHASE";
  return LOAD_PHASES.includes(phase) ? phase : "UNKNOWN";
}

export function normalizeSupplyScope(item = {}) {
  const raw = String(item.supply_scope || item.supplyScope || "").trim().toUpperCase();
  if (LOAD_SUPPLY_SCOPES.includes(raw)) return raw;
  if (item.solarOffsetOnly) return "SOLAR";
  return (item.backupRequired ?? item.essential) ? "BACKUP" : "SOLAR";
}

export function normalizeCriticality(item = {}) {
  const raw = String(item.criticality || "").trim().toUpperCase();
  if (LOAD_CRITICALITIES.includes(raw)) return raw;
  if (item.criticalProcess) return "CRITICAL";
  return (item.backupRequired ?? item.essential) ? "ESSENTIAL" : "NON_CRITICAL";
}

// ─── Load item model ────────────────────────────────────────────────────────

let itemCounter = 1;

/** Full v2 load item shape with sensible defaults; pass overrides to seed from a preset. */
export function createLoadItem(overrides = {}) {
  const item = {
    id: `load_${Date.now()}_${itemCounter++}`,
    name: "New load",
    category: "Other",
    qty: 1,
    ratedW: 100,
    voltage: 230,
    phase: "SINGLE_PHASE",
    powerFactor: 0.95,
    surgeMultiplier: 1,
    startingMethod: "Unknown",
    dayHours: 4,
    nightHours: 0,
    schedule: "",
    dutyCyclePct: 100,
    demandFactorPct: undefined,   // undefined = use mode default
    diversityFactorPct: undefined,
    essential: true,
    backupRequired: undefined,    // undefined = falls back to `essential`
    solarOffsetOnly: false,
    motorLoad: false,
    heavyLoad: false,
    criticalProcess: false,
    seasonal: false,
    notes: "",
    ...overrides,
  };
  item.phase = normalizeLoadPhase(item.phase);
  item.supply_scope = normalizeSupplyScope(item);
  item.criticality = normalizeCriticality(item);
  item.exclusion_reason = item.exclusion_reason == null ? null : String(item.exclusion_reason).trim() || null;
  item.backupRequired = item.supply_scope === "BACKUP";
  item.solarOffsetOnly = item.supply_scope === "SOLAR";
  item.essential = item.criticality !== "NON_CRITICAL";
  return item;
}

// ─── Presets (items 3, 4, 5) ─────────────────────────────────────────────────

const R = (name, ratedW, qty, dayHours, nightHours, extra = {}) => ({
  name, category: "Residential", ratedW, qty, dayHours, nightHours,
  phase: "single", essential: true, surgeMultiplier: 1.2, ...extra,
});

export const RESIDENTIAL_PRESETS = [
  R("LED lights", 10, 10, 1, 5, { surgeMultiplier: 1 }),
  R("TV", 120, 1, 1, 4, { surgeMultiplier: 1.1 }),
  R("Fridge", 250, 1, 6, 6, { surgeMultiplier: 3, category: "Refrigeration" }),
  R("Freezer", 300, 1, 6, 6, { surgeMultiplier: 3, category: "Refrigeration" }),
  R("Router", 15, 1, 8, 16, { surgeMultiplier: 1 }),
  R("Laptop", 65, 2, 6, 2, { surgeMultiplier: 1 }),
  R("CCTV", 40, 1, 12, 12, { surgeMultiplier: 1 }),
  R("Gate motor", 200, 1, 0.3, 0.3, { surgeMultiplier: 4, motorLoad: true, category: "Motor", essential: false }),
  R("Water pump", 1100, 1, 1, 0, { surgeMultiplier: 4, motorLoad: true, category: "Motor", essential: false }),
  R("Washing machine", 500, 1, 1, 0, { surgeMultiplier: 3, essential: false }),
  R("Iron box", 1200, 1, 0.5, 0, { surgeMultiplier: 1, essential: false, heavyLoad: true, category: "Resistive heating" }),
  R("Kettle", 2000, 1, 0.3, 0, { surgeMultiplier: 1, essential: false, heavyLoad: true, category: "Resistive heating" }),
  R("Microwave", 1100, 1, 0.3, 0.2, { surgeMultiplier: 1, essential: false, category: "Kitchen" }),
  R("Electric cooker", 2500, 1, 1, 0.5, { surgeMultiplier: 1, essential: false, heavyLoad: true, category: "Resistive heating" }),
  R("Water heater", 3000, 1, 1, 0.5, { surgeMultiplier: 1, essential: false, heavyLoad: true, category: "Resistive heating" }),
  R("AC", 1200, 1, 4, 2, { surgeMultiplier: 3, essential: false, category: "HVAC" }),
  R("Other", 100, 1, 2, 0, {}),
];

const C = (name, ratedW, qty, dayHours, nightHours, extra = {}) => ({
  name, category: "Commercial", ratedW, qty, dayHours, nightHours,
  phase: "single", essential: true, powerFactor: 0.92, surgeMultiplier: 1.3, ...extra,
});

export const COMMERCIAL_PRESETS = [
  C("Office lighting circuits", 800, 1, 10, 2, { surgeMultiplier: 1, category: "Lighting" }),
  C("Computers/desktops", 180, 5, 9, 0, { surgeMultiplier: 1, category: "IT/Electronics" }),
  C("Laptops", 65, 5, 9, 0, { surgeMultiplier: 1, category: "IT/Electronics" }),
  C("Printers", 400, 2, 4, 0, { surgeMultiplier: 1.2, category: "IT/Electronics" }),
  C("POS systems", 60, 2, 10, 0, { surgeMultiplier: 1, category: "IT/Electronics" }),
  C("Routers/network rack", 300, 1, 12, 12, { surgeMultiplier: 1, category: "IT/Electronics" }),
  C("CCTV/security", 150, 1, 12, 12, { surgeMultiplier: 1, category: "Security" }),
  C("Fridges/freezers", 350, 2, 12, 12, { surgeMultiplier: 3, category: "Refrigeration" }),
  C("Water dispenser", 500, 1, 8, 0, { surgeMultiplier: 1.5, category: "Kitchen" }),
  C("Kitchen equipment", 3000, 1, 4, 0, { surgeMultiplier: 1.5, essential: false, category: "Kitchen" }),
  C("Pumps", 1500, 1, 2, 0, { surgeMultiplier: 4, motorLoad: true, phase: "three", essential: false, category: "Motor" }),
  C("Air conditioners", 1800, 2, 8, 2, { surgeMultiplier: 3, essential: false, category: "HVAC" }),
  C("Elevators/lifts", 5500, 1, 10, 2, { surgeMultiplier: 5, motorLoad: true, phase: "three", essential: false, category: "Motor", startingMethod: "Star-Delta" }),
  C("Server room", 2000, 1, 24, 24, { surgeMultiplier: 1.3, criticalProcess: true, category: "IT/Electronics" }),
  C("Laundry machines", 2500, 1, 4, 0, { surgeMultiplier: 2.5, essential: false, category: "Laundry" }),
  C("Hotel room loads", 600, 10, 6, 10, { surgeMultiplier: 1.5, category: "Hospitality" }),
  C("Common area lighting", 1500, 1, 6, 8, { surgeMultiplier: 1, category: "Lighting" }),
  C("Borehole pump", 4000, 1, 4, 0, { surgeMultiplier: 5, motorLoad: true, phase: "three", essential: false, category: "Motor", startingMethod: "Star-Delta" }),
  C("Other", 200, 1, 4, 0, {}),
];

const I = (name, ratedW, qty, dayHours, nightHours, extra = {}) => ({
  name, category: "Industrial", ratedW, qty, dayHours, nightHours,
  phase: "three", essential: false, powerFactor: 0.85, surgeMultiplier: 5,
  motorLoad: true, startingMethod: "DOL", ...extra,
});

export const INDUSTRIAL_PRESETS = [
  I("Three-phase motor", 7500, 1, 8, 0, {}),
  I("Compressor", 5500, 1, 10, 2, { startingMethod: "Star-Delta", surgeMultiplier: 3 }),
  I("Cold room compressor", 4000, 1, 12, 12, { category: "Refrigeration", criticalProcess: true, startingMethod: "Soft Starter", surgeMultiplier: 3 }),
  I("Chiller", 11000, 1, 10, 2, { startingMethod: "VFD/Inverter", surgeMultiplier: 1.5 }),
  I("Pump", 5500, 1, 6, 0, { startingMethod: "Star-Delta", surgeMultiplier: 3 }),
  I("Borehole pump", 7500, 1, 6, 0, { startingMethod: "Star-Delta", surgeMultiplier: 3 }),
  I("Welding machine", 6000, 1, 4, 0, { motorLoad: false, surgeMultiplier: 2, powerFactor: 0.7, dutyCyclePct: 40 }),
  I("Grinder", 3000, 1, 4, 0, { surgeMultiplier: 3 }),
  I("Milling machine", 7500, 1, 8, 0, { startingMethod: "Star-Delta", surgeMultiplier: 3 }),
  I("Conveyor", 2200, 1, 10, 0, { startingMethod: "VFD/Inverter", surgeMultiplier: 1.5 }),
  I("Packaging machine", 3000, 1, 8, 0, { startingMethod: "Soft Starter", surgeMultiplier: 2.5 }),
  I("HVAC", 5500, 1, 10, 2, { motorLoad: false, category: "HVAC", surgeMultiplier: 3 }),
  I("Air compressor", 11000, 1, 8, 0, { startingMethod: "Star-Delta", surgeMultiplier: 3, dutyCyclePct: 60 }),
  I("Water treatment equipment", 4000, 1, 10, 0, { startingMethod: "Soft Starter", surgeMultiplier: 2.5, criticalProcess: true }),
  I("Production line", 15000, 1, 10, 0, { startingMethod: "VFD/Inverter", surgeMultiplier: 1.5, criticalProcess: true }),
  I("Lighting circuits", 2000, 1, 10, 4, { motorLoad: false, phase: "single", surgeMultiplier: 1, category: "Lighting" }),
  I("Office/admin loads", 1500, 1, 9, 0, { motorLoad: false, phase: "single", surgeMultiplier: 1, category: "IT/Electronics", essential: true }),
  I("Security loads", 300, 1, 12, 12, { motorLoad: false, phase: "single", surgeMultiplier: 1, category: "Security", essential: true }),
  I("Forklift charger", 3000, 1, 6, 0, { motorLoad: false, surgeMultiplier: 1.5, category: "Material handling", essential: false }),
  I("Other", 1000, 1, 8, 0, { motorLoad: false }),
];

/** Returns the preset list relevant to a given load assessment mode. */
export function getPresetsForMode(mode) {
  const group = getModeDefaults(mode).presetGroup;
  if (group === "residential") return RESIDENTIAL_PRESETS;
  if (group === "industrial") return INDUSTRIAL_PRESETS;
  if (group === "commercial") return COMMERCIAL_PRESETS;
  return [...RESIDENTIAL_PRESETS, ...COMMERCIAL_PRESETS, ...INDUSTRIAL_PRESETS];
}

// ─── Per-item derived electrical values ─────────────────────────────────────

/**
 * @param {object} item        loadItemsV2 entry
 * @param {object} modeDefaults  result of getModeDefaults(mode)
 */
export function computeItemDerived(item, modeDefaults = LOAD_MODE_DEFAULTS.Custom) {
  const qty            = Math.max(0, Number(item.qty) || 0);
  const ratedW          = Math.max(0, Number(item.ratedW) || 0);
  const ratedKw         = ratedW / 1000;
  const voltage         = Number(item.voltage) || 230;
  const pf              = clamp01(item.powerFactor, 0.95);
  const dutyFraction    = clamp01Pct(item.dutyCyclePct, 100);
  const demandPct       = item.demandFactorPct ?? modeDefaults.demandFactorPct ?? 100;
  const demandFraction  = clamp01Pct(demandPct, 100);
  const surgeMultiplier = Math.max(1, Number(item.surgeMultiplier) || STARTING_METHOD_SURGE[item.startingMethod] || 1);

  const connectedKw   = qty * ratedKw;
  const effectiveWattsPerUnit = ratedW * dutyFraction;          // feeds toLegacyLoads
  const demandKw      = connectedKw * demandFraction * dutyFraction;
  const apparentKva   = pf > 0 ? connectedKw / pf : connectedKw;
  const phaseFactor   = normalizeLoadPhase(item.phase) === "THREE_PHASE" ? Math.sqrt(3) : 1;
  const runningCurrentA  = voltage > 0 && pf > 0 ? (ratedW) / (voltage * pf * phaseFactor) : 0;
  const startingCurrentA = runningCurrentA * surgeMultiplier;
  const startingKva      = (voltage * phaseFactor * startingCurrentA) / 1000;
  const dayKwh   = qty * ratedKw * dutyFraction * (Number(item.dayHours) || 0);
  const nightKwh = qty * ratedKw * dutyFraction * (Number(item.nightHours) || 0);

  return {
    connectedKw, demandKw, apparentKva, runningCurrentA, startingCurrentA,
    startingKva, dayKwh, nightKwh, effectiveWattsPerUnit, surgeMultiplier,
  };
}

function clamp01(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, 1);
}
function clamp01Pct(v, fallback) {
  const n = Number(v ?? fallback);
  if (!Number.isFinite(n)) return fallback / 100;
  return Math.min(Math.max(n, 0), 100) / 100;
}

// ─── Aggregate summary (item 3/4/5 outputs) ─────────────────────────────────

export function summarizeLoads(items = [], mode = "Residential", project = {}) {
  const modeDefaults = getModeDefaults(mode);
  const derived = items.map(item => ({ item, scope: normalizeSupplyScope(item), d: computeItemDerived(item, modeDefaults) }));
  const active = derived.filter(x => x.scope !== "EXCLUDED");
  const solar = active.filter(x => x.scope === "SOLAR" || x.scope === "BACKUP");
  const backup = active.filter(x => x.scope === "BACKUP");

  const connectedKw = sum(solar, x => x.d.connectedKw);
  const demandKw     = sum(solar, x => x.d.demandKw);
  const dayKwh       = sum(solar, x => x.d.dayKwh);
  const nightKwh     = sum(solar, x => x.d.nightKwh);
  const dailyKwh     = dayKwh + nightKwh;

  const criticalKwh    = sum(backup, x => x.d.dayKwh + x.d.nightKwh);
  const nonCriticalKwh = Math.max(0, dailyKwh - criticalKwh);
  const solarOffsetOnlyKwh = sum(solar.filter(x => x.scope === "SOLAR"), x => x.d.dayKwh + x.d.nightKwh);

  const surgeKw = sum(solar, x => x.d.connectedKw * x.d.surgeMultiplier);
  const peakKw  = Math.max(connectedKw, surgeKw * 0.65);

  const siteDailyKwh = sum(active, x => x.d.dayKwh + x.d.nightKwh);
  const siteConnectedKw = sum(active, x => x.d.connectedKw);
  const siteSurgeKw = sum(active, x => x.d.connectedKw * x.d.surgeMultiplier);
  const sitePeakKw = Math.max(siteConnectedKw, siteSurgeKw * 0.65);
  const backupConnectedKw = sum(backup, x => x.d.connectedKw);
  const backupSurgeKw = sum(backup, x => x.d.connectedKw * x.d.surgeMultiplier);
  const backupPeakKw = Math.max(backupConnectedKw, backupSurgeKw * 0.65);
  const threePhase = active.filter(x => normalizeLoadPhase(x.item.phase) === "THREE_PHASE");
  const threePhaseConnectedKw = sum(threePhase, x => x.d.connectedKw);
  const threePhaseSurgeKw = sum(threePhase, x => x.d.connectedKw * x.d.surgeMultiplier);
  const threePhasePeakKw = Math.max(threePhaseConnectedKw, threePhaseSurgeKw * 0.65);

  // Diversity factor applies once at the aggregate level — weighted by each
  // item's own override if set, else the mode default.
  const diversityFraction = demandKw > 0
    ? sum(solar, x => x.d.demandKw * clamp01Pct(x.item.diversityFactorPct, modeDefaults.diversityFactorPct)) / demandKw
    : modeDefaults.diversityFactorPct / 100;
  const diversityAdjustedKw = demandKw * diversityFraction;
  const maxDemandKw = diversityAdjustedKw;

  const loadFactor = peakKw > 0 ? (dailyKwh / 24) / peakKw : 0;

  const motorItems = active.filter(x => x.item.motorLoad);
  const largestMotor = motorItems.sort((a, b) => b.d.startingKva - a.d.startingKva)[0] || null;

  const criticalFraction = dailyKwh > 0 ? criticalKwh / dailyKwh : 0;
  const recommendation = recommendSystemApproach(mode, { connectedKw, criticalFraction, largestMotor, dailyKwh });

  return {
    mode, modeDefaults,
    connectedKw, demandKw, diversityAdjustedKw, maxDemandKw,
    dayKwh, nightKwh, dailyKwh,
    criticalKwh, nonCriticalKwh, solarOffsetOnlyKwh,
    peakKw, surgeKw, loadFactor, criticalFraction,
    siteDailyKwh, solarDailyKwh: dailyKwh, backupDailyKwh: criticalKwh,
    sitePeakKw, solarPeakKw: peakKw, backupPeakKw, threePhasePeakKw,
    site_daily_kwh: siteDailyKwh, solar_daily_kwh: dailyKwh, backup_daily_kwh: criticalKwh,
    site_peak_kw: sitePeakKw, solar_peak_kw: peakKw, backup_peak_kw: backupPeakKw,
    three_phase_peak_kw: threePhasePeakKw,
    gridOnlyDailyKwh: sum(active.filter(x => x.scope === "GRID_ONLY"), x => x.d.dayKwh + x.d.nightKwh),
    excludedItemCount: derived.filter(x => x.scope === "EXCLUDED").length,
    largestMotorName: largestMotor?.item.name ?? null,
    largestMotorStartingKva: largestMotor?.d.startingKva ?? 0,
    itemCount: items.length,
    recommendation,
  };
}

function sum(rows, fn) { return rows.reduce((s, r) => s + (fn(r) || 0), 0); }

function recommendSystemApproach(mode, { connectedKw, criticalFraction, largestMotor, dailyKwh }) {
  if (dailyKwh <= 0) return "Add loads to generate a system recommendation.";
  const isIndustrialish = ["Industrial / Manufacturing", "Agricultural / Pumping", "Cold Room / Refrigeration"].includes(mode);
  if (isIndustrialish) {
    if (largestMotor && largestMotor.d.startingKva > connectedKw * 0.5) {
      return "Large motor starting load relative to connected load — recommend grid-tie with genset hybrid for starting support; pure battery backup of all loads is unlikely to be economical.";
    }
    if (criticalFraction < 0.3) {
      return "Low critical-load fraction — recommend grid-tie (daytime solar offset) or genset hybrid rather than full battery backup.";
    }
    return "Recommend hybrid system sized to back up only the identified critical/process loads, with solar offsetting daytime production load.";
  }
  if (criticalFraction >= 0.6) return "High essential-load fraction — hybrid system with meaningful backup autonomy is well justified.";
  if (criticalFraction <= 0.15) return "Low essential-load fraction — grid-tie (solar offset only) may be more cost-effective than a large battery bank.";
  return "Hybrid system recommended — backup sized to the identified essential/critical loads.";
}

// ─── Adapter into the existing sizing engine — DO NOT duplicate useSizing ───

/**
 * Projects loadItemsV2 down into the flat shape useSizing/computeOptionSizing
 * (App.jsx) and calculateReadiness/generateAdvisory (readiness.js/advisory.js)
 * already consume. This is the only integration point — those engines are
 * unmodified and unaware loadItemsV2 exists.
 */
export function toLegacyLoads(items = [], mode = "Residential") {
  const modeDefaults = getModeDefaults(mode);
  return items.filter(item => ["SOLAR", "BACKUP"].includes(normalizeSupplyScope(item))).map(item => {
    const d = computeItemDerived(item, modeDefaults);
    return {
      id: item.id,
      name: item.name,
      qty: Math.max(0, Number(item.qty) || 0),
      watts: d.effectiveWattsPerUnit,
      dayHours: Number(item.dayHours) || 0,
      nightHours: Number(item.nightHours) || 0,
      surge: d.surgeMultiplier,
      critical: normalizeSupplyScope(item) === "BACKUP",
      phase: normalizeLoadPhase(item.phase),
      supplyScope: normalizeSupplyScope(item),
    };
  });
}

// ─── Draft validation (v11.1) ────────────────────────────────────────────────

/**
 * Validate draft load items before they are committed to sizing.
 * Returns [] when everything is valid, else one entry per invalid item:
 *   { id, name, problems: ["Quantity must be at least 1", ...] }
 * Pure — used by App.jsx commitDraftLoadItems and workflow-regression tests.
 */
export function validateLoadItemsV2(items = []) {
  const errors = [];
  (Array.isArray(items) ? items : []).forEach((item, idx) => {
    const problems = [];
    if (!item || typeof item !== "object") {
      errors.push({ id: `row_${idx}`, name: `Row ${idx + 1}`, problems: ["Row is not a valid load item"] });
      return;
    }
    const day = Number(item.dayHours) || 0;
    const night = Number(item.nightHours) || 0;
    if (!String(item.name || "").trim())        problems.push("Name is required");
    if (!(Number(item.qty) >= 1))               problems.push("Quantity must be at least 1");
    if (!(Number(item.ratedW) > 0))             problems.push("Rated watts must be greater than 0");
    if (day + night <= 0)                       problems.push("Day + night hours must be greater than 0");
    if (day > 24)                               problems.push("Day hours cannot exceed 24");
    if (night > 24)                             problems.push("Night hours cannot exceed 24");
    if (day + night > 24)                       problems.push("Day + night hours cannot exceed 24");
    if (!(Number(item.surgeMultiplier) >= 1))   problems.push("Surge multiplier must be at least 1");
    if (!LOAD_PHASES.includes(normalizeLoadPhase(item.phase))) problems.push("Phase is invalid");
    if (!LOAD_SUPPLY_SCOPES.includes(normalizeSupplyScope(item))) problems.push("Powered by selection is invalid");
    if (!LOAD_CRITICALITIES.includes(normalizeCriticality(item))) problems.push("Criticality is invalid");
    if (["GRID_ONLY", "EXCLUDED"].includes(normalizeSupplyScope(item)) && !String(item.exclusion_reason || "").trim()) {
      problems.push("Grid-only or excluded loads require a reason");
    }
    if (problems.length > 0) errors.push({ id: item.id || `row_${idx}`, name: item.name || `Row ${idx + 1}`, problems });
  });
  return errors;
}

// ─── Load quality warnings (item 8) ─────────────────────────────────────────

const RESISTIVE_HEATING_RE = /kettle|iron|cooker|heater|oven|geyser/i;

export function getLoadWarnings(items = [], mode = "Residential", summary = null, project = {}) {
  const warnings = [];
  const s = summary || summarizeLoads(items, mode);
  const modeDefaults = getModeDefaults(mode);
  const isCI = modeDefaults.presetGroup !== "residential";

  items.forEach(item => {
    const looksHeavy = item.heavyLoad || RESISTIVE_HEATING_RE.test(item.name || "");
    if (looksHeavy && normalizeSupplyScope(item) === "BACKUP") {
      warnings.push({ level: "warning", msg: `"${item.name}" is a heavy load marked for backup — heavy resistive/surge loads should not be backed up unless the battery bank is intentionally oversized for this draw.` });
    }
    if (item.motorLoad && !item.powerFactor) {
      warnings.push({ level: "warning", msg: `"${item.name}": power factor missing — assumed default. Confirm against motor nameplate for accurate current/kVA.` });
    }
    if (isCI && item.demandFactorPct === undefined) {
      warnings.push({ level: "info", msg: `"${item.name}": no item-level demand factor set — using the ${mode} mode default (${modeDefaults.demandFactorPct}%).` });
    }
  });

  if (s.largestMotorStartingKva > 0 && s.largestMotorStartingKva > s.connectedKw * 0.6) {
    warnings.push({ level: "danger", msg: `Largest motor (${s.largestMotorName}) starting load (${s.largestMotorStartingKva.toFixed(1)} kVA) is high relative to total connected load — verify selected inverter/genset surge rating, and consider a soft starter or VFD.` });
  }
  if (isCI && !items.some(i => i.motorLoad)) {
    warnings.push({ level: "info", msg: "No motor load identified for this mode — confirm whether any pumps, compressors or fans were missed, since they dominate starting-current design." });
  }

  const activeItems = items.filter(i => normalizeSupplyScope(i) !== "EXCLUDED");
  const threePhaseItems = activeItems.filter(i => normalizeLoadPhase(i.phase) === "THREE_PHASE");
  const singlePhaseItems = activeItems.filter(i => normalizeLoadPhase(i.phase) === "SINGLE_PHASE");
  if (threePhaseItems.length > 0 && singlePhaseItems.length > 0) {
    const singleKw = sum(singlePhaseItems.map(i => ({ item: i, d: computeItemDerived(i, modeDefaults) })), x => x.d.connectedKw);
    if (singleKw > s.connectedKw * 0.3) {
      warnings.push({ level: "warning", msg: "Significant single-phase load alongside three-phase loads — check phase balancing to avoid neutral overload and voltage imbalance." });
    }
  }
  const solarThreePhase = activeItems.filter(i => ["SOLAR", "BACKUP"].includes(normalizeSupplyScope(i)) && normalizeLoadPhase(i.phase) === "THREE_PHASE");
  if (solarThreePhase.length > 0 && !/three/i.test(String(project.phase || ""))) {
    warnings.push({ level: "danger", msg: "Three-phase solar/backup load is included but the selected inverter/system phase is not three-phase." });
  }

  const poorPf = items.filter(i => (i.powerFactor || 1) < 0.85 && i.ratedW > 500);
  if (poorPf.length > 0) {
    warnings.push({ level: "warning", msg: `${poorPf.length} load(s) with power factor below 0.85 (e.g. "${poorPf[0].name}") — power factor correction may be required to avoid utility penalties and reduce apparent power demand.` });
  }

  if (mode === "Cold Room / Refrigeration") {
    warnings.push({ level: "warning", msg: "Cold room backup requires careful autonomy sizing — compressor duty cycle and defrost load must be included, and even short outages risk product loss if backup is undersized." });
  }

  if (["Industrial / Manufacturing", "Commercial & Industrial"].includes(mode) && s.criticalFraction < 0.3 && s.connectedKw > 20) {
    warnings.push({ level: "info", msg: "Industrial load profile is better suited to grid-tie or genset hybrid than pure battery backup — backing up all industrial loads on battery may be uneconomical." });
  }

  if (isCI) {
    warnings.push({ level: "info", msg: "Load data is estimated from presets/site interview; recommend temporary data logging to validate before final sizing — see data logger recommendation below." });
  }

  return warnings;
}

// ─── Data logger recommendation (item 9) ────────────────────────────────────

export function getDataLoggerRecommendation(mode) {
  const modeDefaults = getModeDefaults(mode);
  if (modeDefaults.presetGroup === "residential") return null;
  return {
    recommended: true,
    minDays: modeDefaults.dataLoggerMinDays,
    maxDays: modeDefaults.dataLoggerMaxDays,
    capture: ["Voltage", "Current", "kW", "kVA", "Power factor", "Peak demand", "Phase imbalance"],
    note: `Install a temporary data logger for ${modeDefaults.dataLoggerMinDays}${modeDefaults.dataLoggerMaxDays > modeDefaults.dataLoggerMinDays ? `–${modeDefaults.dataLoggerMaxDays}` : ""} days and use the measured profile to validate this estimated sizing before procurement.`,
  };
}

// ─── 24-hour load profile (item 7) ──────────────────────────────────────────

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 18;

/** Simplified bell-curve PV generation shape for the chart overlay only — not an irradiance model. */
function solarShapeAt(hour, actualKwp) {
  if (hour < DAY_START_HOUR || hour >= DAY_END_HOUR) return 0;
  const span = DAY_END_HOUR - DAY_START_HOUR;
  const x = (hour + 0.5 - DAY_START_HOUR) / span; // 0..1 across daylight
  return actualKwp * Math.max(0, Math.sin(Math.PI * x));
}

export function computeLoadProfile24h(items = [], mode = "Residential", sizing = {}) {
  const modeDefaults = getModeDefaults(mode);
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, loadKw: 0, criticalLoadKw: 0, solarKw: 0 }));
  const dayWindowHours = DAY_END_HOUR - DAY_START_HOUR;
  const nightWindowHours = 24 - dayWindowHours;

  items.forEach(item => {
    const d = computeItemDerived(item, modeDefaults);
    const kwPerDayHour   = dayWindowHours > 0 ? (item.dayHours || 0) / dayWindowHours * d.connectedKw * (item.dutyCyclePct ?? 100) / 100 : 0;
    const kwPerNightHour = nightWindowHours > 0 ? (item.nightHours || 0) / nightWindowHours * d.connectedKw * (item.dutyCyclePct ?? 100) / 100 : 0;
    const isCritical = item.solarOffsetOnly ? false : (item.backupRequired ?? item.essential ?? false);
    for (let h = 0; h < 24; h++) {
      const isDay = h >= DAY_START_HOUR && h < DAY_END_HOUR;
      const kw = isDay ? kwPerDayHour : kwPerNightHour;
      hours[h].loadKw += kw;
      if (isCritical) hours[h].criticalLoadKw += kw;
    }
  });

  const actualKwp = sizing.actualKwp || 0;
  hours.forEach(h => { h.solarKw = +solarShapeAt(h.hour, actualKwp).toFixed(2); h.loadKw = +h.loadKw.toFixed(2); h.criticalLoadKw = +h.criticalLoadKw.toFixed(2); });

  return {
    hours,
    disclaimer: "Hourly profile spreads each load's day/night hours evenly across standard daylight (06:00–18:00) and night windows, and the solar curve is a simplified shape for visual reference only — both are planning aids, not a substitute for metered/logged data or PVsyst-grade irradiance modelling.",
  };
}

// ─── Special calculators (item 6) ───────────────────────────────────────────

const HP_TO_KW = 0.7457;

/** 6A — Motor Load Calculator */
export function calcMotorLoad({ kw, hp, voltage = 400, phase = "three", powerFactor = 0.85, efficiency = 0.9, startingMethod = "DOL", surgeMultiplier, qty = 1, hoursPerDay = 8 } = {}) {
  const shaftKw = kw || (hp || 0) * HP_TO_KW;
  const inputKw = efficiency > 0 ? shaftKw / efficiency : shaftKw;
  const phaseFactor = phase === "three" ? Math.sqrt(3) : 1;
  const runningCurrentA = voltage > 0 && powerFactor > 0 ? (inputKw * 1000) / (voltage * powerFactor * phaseFactor) : 0;
  const multiplier = surgeMultiplier || STARTING_METHOD_SURGE[startingMethod] || 4;
  const startingCurrentA = runningCurrentA * multiplier;
  const runningKva = powerFactor > 0 ? inputKw / powerFactor : inputKw;
  const startingKva = (voltage * phaseFactor * startingCurrentA) / 1000;
  const vfdRecommended = multiplier > 3 && startingKva > inputKw * 2.5;
  const dailyKwh = inputKw * Math.max(1, qty) * hoursPerDay;

  return {
    shaftKw, inputKw, runningCurrentA, startingCurrentA, runningKva, startingKva,
    dailyKwh: +dailyKwh.toFixed(2),
    recommendedInverterSurgeKva: +(startingKva * 1.1).toFixed(2),
    vfdRecommended,
    recommendation: vfdRecommended
      ? "Starting surge is high relative to running load — a VFD or soft starter is recommended to reduce starting current and protect the inverter/genset."
      : "Starting surge is within a typical range for the selected starting method.",
    suggestedLoadItem: createLoadItem({
      name: "Motor (calculator)", category: "Motor", motorLoad: true, phase, voltage, powerFactor,
      ratedW: Math.round(inputKw * 1000), startingMethod, surgeMultiplier: +multiplier.toFixed(2),
      essential: false, qty: Math.max(1, qty), dayHours: hoursPerDay, nightHours: 0,
    }),
  };
}

/** 6B — Pumping Load Calculator */
export function calcPumpingLoad({ pumpKw = 1.1, hoursPerDay = 4, headM, flowM3h, pumpType = "Borehole submersible", startingMethod = "Star-Delta", daytimeOnly = true } = {}) {
  const dailyKwh = pumpKw * hoursPerDay;
  const solarPumpingSuitable = daytimeOnly && hoursPerDay <= 10; // pumping is a classic daytime-only solar-direct load
  const suggestedOperationWindow = solarPumpingSuitable
    ? `~09:00–${(9 + hoursPerDay).toString().padStart(2, "0")}:00 (peak solar hours)`
    : "Outside peak solar hours — needs grid, genset, or battery support to cover the shortfall";
  return {
    dailyKwh: +dailyKwh.toFixed(2),
    solarPumpingSuitable,
    suggestedOperationWindow,
    batteryBackupRecommended: !daytimeOnly, // pumping is normally solar-direct/grid, not battery-backed
    vfdRecommended: pumpKw >= 3,
    recommendation: solarPumpingSuitable
      ? "Pumping load is well suited to direct solar (or solar + small buffer) operation during daylight hours rather than battery backup."
      : "Pump runtime extends beyond daylight hours — either accept reduced run hours, add a buffer tank for daytime-only pumping, or size battery backup explicitly for this load.",
    suggestedLoadItem: createLoadItem({
      name: `${pumpType} (calculator)`, category: "Motor", motorLoad: true, phase: "three",
      ratedW: Math.round(pumpKw * 1000), startingMethod, surgeMultiplier: STARTING_METHOD_SURGE[startingMethod] || 3,
      essential: false, solarOffsetOnly: solarPumpingSuitable, qty: 1, dayHours: hoursPerDay, nightHours: daytimeOnly ? 0 : Math.max(0, hoursPerDay - 10),
      notes: [headM ? `Head: ${headM} m` : null, flowM3h ? `Flow: ${flowM3h} m³/h` : null].filter(Boolean).join(", "),
    }),
  };
}

/** 6C — Cold Room / Refrigeration Calculator */
export function calcColdRoomLoad({ compressorKw = 3, numberOfCompressors = 1, dutyCyclePct = 60, hoursPerDay = 24, setpointC, defrostKwPerDay = 0 } = {}) {
  const duty = clamp01Pct(dutyCyclePct, 60);
  const dailyKwh = compressorKw * numberOfCompressors * duty * hoursPerDay + defrostKwPerDay;
  const startingSurgeKva = compressorKw * numberOfCompressors * 3;
  const dutyHours = duty * hoursPerDay;
  const backupRecommended = dutyHours > 8; // near-continuous duty -> outage risk to stored product
  // Explicit 3-way recommendation: battery (near-continuous, product-loss risk),
  // genset (heavy but tolerant of short gaps), or grid (light/intermittent duty).
  const recommendedSupport = dutyHours > 12 ? "battery" : dutyHours > 6 ? "genset" : "grid";
  const autonomyWarning = backupRecommended
    ? "Size battery autonomy for the full expected outage duration plus defrost cycles — undersized autonomy risks product loss before backup is exhausted."
    : null;
  return {
    dailyKwh: +dailyKwh.toFixed(2),
    startingSurgeKva: +startingSurgeKva.toFixed(2),
    backupRecommended,
    recommendedSupport,
    autonomyWarning,
    recommendation: backupRecommended
      ? "Near-continuous compressor duty — battery backup (sized for full autonomy window) is recommended to avoid product loss; pair with genset support for extended outages."
      : "Moderate duty cycle — grid/genset support during outages may be sufficient; confirm acceptable temperature excursion time with the client before skipping battery backup.",
    suggestedLoadItem: createLoadItem({
      name: "Cold room compressor (calculator)", category: "Refrigeration", motorLoad: true, phase: "three",
      ratedW: Math.round(compressorKw * 1000), qty: numberOfCompressors, dutyCyclePct: duty * 100,
      startingMethod: "Soft Starter", surgeMultiplier: 3, essential: true, backupRequired: backupRecommended,
      criticalProcess: true, dayHours: hoursPerDay / 2, nightHours: hoursPerDay / 2,
      notes: setpointC ? `Setpoint: ${setpointC}°C` : "",
    }),
  };
}

/** 6D — HVAC / AC Calculator */
export function calcHvacLoad({ unitKw = 1.5, numberOfUnits = 1, inverterType = "non-inverter", hoursPerDay = 8, diversityFactorPct = 80 } = {}) {
  const diversity = clamp01Pct(diversityFactorPct, 80);
  const peakKw = unitKw * numberOfUnits * diversity;
  const dailyKwh = unitKw * numberOfUnits * hoursPerDay * (inverterType === "inverter" ? 0.65 : 1) * diversity;
  const tooLargeForBackup = peakKw > 5;
  return {
    dailyKwh: +dailyKwh.toFixed(2),
    peakKw: +peakKw.toFixed(2),
    solarOffsetRecommended: true,
    backupWarning: tooLargeForBackup ? "Combined AC load is large for battery backup — recommend solar-offset-only or backing up only a subset of units." : null,
    suggestedLoadItem: createLoadItem({
      name: `AC ${inverterType} (calculator)`, category: "HVAC", qty: numberOfUnits,
      ratedW: Math.round(unitKw * 1000), surgeMultiplier: inverterType === "inverter" ? 1.5 : 3,
      essential: false, solarOffsetOnly: tooLargeForBackup, dayHours: hoursPerDay * 0.7, nightHours: hoursPerDay * 0.3,
      diversityFactorPct: diversity * 100,
    }),
  };
}

/** 6E — Generator Hybrid Calculator. Reuses project.genset* fields/derate math — does not model a second genset engine. */
export function calcGeneratorHybrid({ gensetKva, fuelLPerHour, runtimeHoursPerDay, fuelCostPerLitre, minimumLoadingPct = 30, solarDisplacementKwhPerDay = 0, existingLoadProfileKwhPerDay } = {}) {
  const dailyFuelL = fuelLPerHour * runtimeHoursPerDay;
  const currentDieselCostPerDay = dailyFuelL * fuelCostPerLitre;
  // If the site's actual measured/estimated daily load is supplied, use it to sanity-check
  // (cap) the solar displacement claim rather than letting it exceed what the site actually uses.
  const effectiveDisplacementKwh = existingLoadProfileKwhPerDay
    ? Math.min(solarDisplacementKwhPerDay, existingLoadProfileKwhPerDay)
    : solarDisplacementKwhPerDay;
  const fuelDisplacedL = gensetKva > 0 ? Math.min(dailyFuelL, (effectiveDisplacementKwh / (gensetKva * 0.8)) * dailyFuelL) : 0;
  const fuelSavingsPerDay = fuelDisplacedL * fuelCostPerLitre;
  const wetStackingRisk = minimumLoadingPct < 30;
  return {
    dailyFuelL: +dailyFuelL.toFixed(1),
    currentDieselCostPerDay: Math.round(currentDieselCostPerDay),
    dailyFuelCost: Math.round(currentDieselCostPerDay), // kept for backward compatibility with existing UI bindings
    fuelSavingsPerDay: Math.round(fuelSavingsPerDay),
    annualFuelSavings: Math.round(fuelSavingsPerDay * 365),
    wetStackingRisk,
    wetStackingWarning: wetStackingRisk
      ? "Genset minimum loading below ~30% risks wet-stacking (incomplete combustion fouling the engine) — schedule periodic full-load runs or reduce genset size."
      : null,
    batteryRole: "Battery should absorb load swings and cover short outages; let the genset run at a steady, well-loaded setpoint rather than cycling with the load.",
    recommendedRuntimeStrategy: "Run genset in scheduled blocks at >50% load (e.g. to recharge battery and cover peak demand), rather than continuously at light load.",
  };
}

// ─── Blueprint / new-construction templates (v11.1) ─────────────────────────
// Generate a starter draft load list for a building that is not yet built or
// occupied, scaled by floor area / occupancy / operating schedule. Output is
// ordinary loadItemsV2 rows — they land in draftLoadItemsV2 and are only
// applied to sizing when the user clicks Update Sizing (same commit path as
// hand-entered loads; no second engine).

const BP = (name, ratedW, qty, dayHours, nightHours, extra = {}) => ({
  name, ratedW: Math.max(1, Math.round(ratedW)), qty: Math.max(1, Math.round(qty)),
  dayHours: +Math.min(dayHours, 24).toFixed(1), nightHours: +Math.min(nightHours, 24).toFixed(1),
  notes: "Blueprint-stage estimate — confirm against equipment schedule.", ...extra,
});

export const BLUEPRINT_TEMPLATES = [
  { key: "residential_house", label: "Residential house",       usesOccupancy: true },
  { key: "apartment_common",  label: "Apartment common loads",  usesOccupancy: false },
  { key: "office",            label: "Office",                  usesOccupancy: true },
  { key: "school",            label: "School",                  usesOccupancy: true },
  { key: "clinic",            label: "Clinic / health centre",  usesOccupancy: true },
  { key: "hotel_lodge",       label: "Hotel / lodge",           usesOccupancy: true },
  { key: "carwash",           label: "Carwash",                 usesOccupancy: false },
  { key: "warehouse",         label: "Warehouse",               usesOccupancy: false },
  { key: "farm_borehole",     label: "Farm / borehole",         usesOccupancy: false },
  { key: "ev_fleet",          label: "EV / fleet yard",         usesOccupancy: false },
  { key: "custom",            label: "Custom (empty)",          usesOccupancy: false },
];

/**
 * generateBlueprintDraftLoads(templateKey, { floorAreaM2, occupancy, scheduleHoursPerDay, futureGrowthPct })
 * → loadItemsV2[] (via createLoadItem). Pure and deterministic; safe to re-run.
 */
export function generateBlueprintDraftLoads(templateKey, opts = {}) {
  const fa  = Math.max(10, Number(opts.floorAreaM2) || 100);
  const occ = Math.max(1, Math.round(Number(opts.occupancy) || 4));
  const sch = Math.min(24, Math.max(1, Number(opts.scheduleHoursPerDay) || 10));
  const dayShare = Math.min(sch, 12);              // hours that fall in daylight
  const nightShare = Math.max(0, sch - dayShare);  // remainder runs at night
  const growthPct = Math.max(0, Number(opts.futureGrowthPct) || 0);

  let rows = [];
  switch (templateKey) {
    case "residential_house":
      rows = [
        BP("LED lighting", fa * 4, 1, 1, 5, { category: "Lighting", surgeMultiplier: 1 }),
        BP("Sockets / small power", 60 * occ, 1, 4, 2, { category: "Sockets", surgeMultiplier: 1.2 }),
        BP("Fridge", 250, 1, 6, 6, { category: "Refrigeration", surgeMultiplier: 3 }),
        BP("TV / entertainment", 150, 1, 1, 4, { surgeMultiplier: 1.1 }),
        BP("Washing machine", 500, 1, 0.7, 0, { essential: false, surgeMultiplier: 3 }),
        BP("Water pump (booster)", 750, 1, 0.8, 0.2, { category: "Motor", motorLoad: true, surgeMultiplier: 4, essential: false }),
        BP("Security / CCTV / gate", 120, 1, 12, 12, { surgeMultiplier: 1.5 }),
        BP("Kitchen appliances (kettle/microwave)", 1800, 1, 0.6, 0.3, { category: "Resistive heating", heavyLoad: true, essential: false, surgeMultiplier: 1 }),
      ];
      break;
    case "apartment_common":
      rows = [
        BP("Corridor / stair lighting", fa * 3, 1, 2, 10, { category: "Lighting", surgeMultiplier: 1 }),
        BP("Compound / security lighting", 800, 1, 0, 11, { category: "Lighting", surgeMultiplier: 1 }),
        BP("Water pumps (booster set)", 2200, 1, 2, 1, { category: "Motor", motorLoad: true, surgeMultiplier: 4, startingMethod: "Star-Delta" }),
        BP("CCTV / access control", 200, 1, 12, 12, { surgeMultiplier: 1.2 }),
        BP("Lift (if fitted)", 5500, 1, 3, 1, { category: "Motor", motorLoad: true, phase: "three", surgeMultiplier: 3.5, startingMethod: "VFD/Inverter", essential: false }),
        BP("Intercom / network", 100, 1, 12, 12, { surgeMultiplier: 1 }),
      ];
      break;
    case "office":
      rows = [
        BP("LED lighting", fa * 8, 1, dayShare, nightShare, { category: "Lighting", surgeMultiplier: 1 }),
        BP("Workstations / IT", 120 * occ, 1, dayShare, 0, { category: "IT", surgeMultiplier: 1.1 }),
        BP("Server / network rack", 800, 1, 12, 12, { category: "IT", surgeMultiplier: 1.2, criticalProcess: true }),
        BP("Printers / copiers", 900, 1, Math.min(dayShare, 4), 0, { essential: false, surgeMultiplier: 1.5 }),
        BP("AC units", fa * 30 / 1000 * 1000 * 0.4, 1, Math.min(dayShare, 8), 0, { category: "HVAC", surgeMultiplier: 3, essential: false }),
        BP("Kitchenette / dispenser", 1500, 1, 1.5, 0, { category: "Resistive heating", heavyLoad: true, essential: false, surgeMultiplier: 1 }),
        BP("Security / CCTV", 150, 1, 12, 12, { surgeMultiplier: 1.2 }),
      ];
      break;
    case "school":
      rows = [
        BP("Classroom lighting", fa * 6, 1, Math.min(dayShare, 9), 1, { category: "Lighting", surgeMultiplier: 1 }),
        BP("Computer lab", 150 * Math.max(5, Math.round(occ / 10)), 1, Math.min(dayShare, 6), 0, { category: "IT", surgeMultiplier: 1.2 }),
        BP("Staffroom / admin IT", 600, 1, Math.min(dayShare, 8), 0, { category: "IT", surgeMultiplier: 1.1 }),
        BP("Water pump", 1100, 1, 1, 0, { category: "Motor", motorLoad: true, surgeMultiplier: 4, essential: false }),
        BP("PA / bell system", 200, 1, Math.min(dayShare, 9), 0, { surgeMultiplier: 1.2 }),
        BP("Kitchen (if boarding)", 3000, 1, 3, 1, { category: "Resistive heating", heavyLoad: true, essential: false, surgeMultiplier: 1 }),
        BP("Security lighting", 600, 1, 0, 11, { category: "Lighting", surgeMultiplier: 1 }),
      ];
      break;
    case "clinic":
      rows = [
        BP("LED lighting", fa * 8, 1, dayShare, 4, { category: "Lighting", surgeMultiplier: 1 }),
        BP("Vaccine / medicine fridge", 300, 1, 6, 6, { category: "Refrigeration", surgeMultiplier: 3, criticalProcess: true }),
        BP("Diagnostic equipment", 1200, 1, Math.min(dayShare, 8), 1, { criticalProcess: true, surgeMultiplier: 1.5 }),
        BP("Sterilizer / autoclave", 2200, 1, 1.5, 0, { category: "Resistive heating", heavyLoad: true, surgeMultiplier: 1, essential: false }),
        BP("IT / records", 400, 1, dayShare, 1, { category: "IT", surgeMultiplier: 1.1 }),
        BP("Water pump", 750, 1, 1, 0.5, { category: "Motor", motorLoad: true, surgeMultiplier: 4 }),
        BP("Security / CCTV", 150, 1, 12, 12, { surgeMultiplier: 1.2 }),
      ];
      break;
    case "hotel_lodge":
      rows = [
        BP("Guest room loads", 350 * Math.max(2, Math.round(occ / 2)), 1, 3, 5, { category: "Guest rooms", surgeMultiplier: 1.5 }),
        BP("Common area lighting", fa * 6, 1, 3, 9, { category: "Lighting", surgeMultiplier: 1 }),
        BP("Kitchen (commercial)", 6000, 1, 5, 2, { category: "Kitchen", heavyLoad: true, essential: false, surgeMultiplier: 1.5 }),
        BP("Cold room / freezers", 1500, 1, 8, 8, { category: "Refrigeration", surgeMultiplier: 3, criticalProcess: true }),
        BP("Laundry", 3000, 1, 3, 0, { essential: false, heavyLoad: true, surgeMultiplier: 2 }),
        BP("Water pumps", 2200, 1, 2, 1, { category: "Motor", motorLoad: true, surgeMultiplier: 4, startingMethod: "Star-Delta" }),
        BP("Reception / IT / CCTV", 500, 1, 12, 12, { category: "IT", surgeMultiplier: 1.2 }),
        BP("Pool pump (if fitted)", 1100, 1, 4, 0, { category: "Motor", motorLoad: true, surgeMultiplier: 3.5, essential: false }),
      ];
      break;
    case "carwash":
      rows = [
        BP("Pressure washers", 2200, 2, Math.min(dayShare, 8), 0, { category: "Motor", motorLoad: true, surgeMultiplier: 3.5, phase: "single" }),
        BP("Vacuum cleaners", 1500, 2, Math.min(dayShare, 8), 0, { category: "Motor", motorLoad: true, surgeMultiplier: 3, essential: false }),
        BP("Water pump / borehole", 1500, 1, 3, 0, { category: "Motor", motorLoad: true, surgeMultiplier: 4, startingMethod: "Star-Delta" }),
        BP("Compressor", 1500, 1, 2, 0, { category: "Motor", motorLoad: true, surgeMultiplier: 4, essential: false }),
        BP("Lighting", fa * 5, 1, 2, 4, { category: "Lighting", surgeMultiplier: 1 }),
        BP("Office / POS", 300, 1, Math.min(dayShare, 10), 0, { category: "IT", surgeMultiplier: 1.1 }),
      ];
      break;
    case "warehouse":
      rows = [
        BP("High-bay LED lighting", fa * 4, 1, dayShare, 2, { category: "Lighting", surgeMultiplier: 1 }),
        BP("Roller doors", 750, 2, 0.5, 0, { category: "Motor", motorLoad: true, surgeMultiplier: 3, essential: false }),
        BP("Forklift charging", 3000, 1, 2, 6, { category: "Charging", surgeMultiplier: 1.2, essential: false }),
        BP("Office block", 1500, 1, dayShare, 0, { category: "IT", surgeMultiplier: 1.2 }),
        BP("CCTV / security", 300, 1, 12, 12, { surgeMultiplier: 1.2 }),
        BP("Ventilation fans", fa * 1.5, 1, dayShare, 0, { category: "HVAC", motorLoad: true, surgeMultiplier: 2, essential: false }),
      ];
      break;
    case "farm_borehole":
      rows = [
        BP("Borehole pump", 2200, 1, 5, 0, { category: "Motor", motorLoad: true, surgeMultiplier: 4, startingMethod: "Star-Delta", phase: "three" }),
        BP("Irrigation pump", 1500, 1, 3, 0, { category: "Motor", motorLoad: true, surgeMultiplier: 4, essential: false }),
        BP("Chill tank / milk cooler (if dairy)", 2000, 1, 6, 4, { category: "Refrigeration", surgeMultiplier: 3, criticalProcess: true, essential: false }),
        BP("Electric fence energizer", 50, 1, 12, 12, { surgeMultiplier: 1 }),
        BP("Farmhouse / store lighting", 400, 1, 1, 4, { category: "Lighting", surgeMultiplier: 1 }),
        BP("Workshop tools", 1500, 1, 1, 0, { category: "Motor", motorLoad: true, surgeMultiplier: 3, essential: false }),
      ];
      break;
    case "ev_fleet":
      rows = [
        BP("AC chargers 7 kW", 7000, 2, 2, 6, { category: "Charging", surgeMultiplier: 1.1, phase: "single" }),
        BP("AC chargers 22 kW", 22000, 1, 1, 4, { category: "Charging", surgeMultiplier: 1.1, phase: "three", essential: false }),
        BP("Yard lighting", fa * 2, 1, 0, 11, { category: "Lighting", surgeMultiplier: 1 }),
        BP("Office / dispatch", 800, 1, dayShare, 2, { category: "IT", surgeMultiplier: 1.2 }),
        BP("CCTV / barriers", 300, 1, 12, 12, { surgeMultiplier: 1.5 }),
      ];
      break;
    case "custom":
    default:
      rows = [BP("Load 1 (edit me)", 500, 1, Math.min(dayShare, 6), 0, {})];
      break;
  }

  const items = rows.map((r) => createLoadItem(r));

  // Future-growth allowance: one flat item whose daily energy equals
  // growthPct% of the template's daily kWh (keeps energy math exact).
  if (growthPct > 0) {
    const dailyKwh = items.reduce((s, it) => s + (it.qty * it.ratedW * ((it.dayHours || 0) + (it.nightHours || 0))) / 1000, 0);
    const growthKwh = dailyKwh * (growthPct / 100);
    const hours = Math.max(1, dayShare);
    items.push(createLoadItem({
      name: `Future growth allowance (${growthPct}%)`,
      category: "Provision",
      ratedW: Math.max(1, Math.round((growthKwh * 1000) / hours)),
      qty: 1, dayHours: hours, nightHours: 0,
      essential: false, surgeMultiplier: 1,
      notes: "Blueprint growth margin — sized so its daily kWh equals the growth % of the template loads.",
    }));
  }
  return items;
}

export { clamp01Pct as clampPctFraction };

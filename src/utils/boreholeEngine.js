/**
 * boreholeEngine.js — Voltflow 11.6 (Solar Borehole & Water Pumping Specialist Module)
 *
 * Water-FIRST solar pumping feasibility. Pure — no React, no DOM. Sizes pump,
 * PV, tank and operating hours from water demand, borehole depth/head and pump
 * assumptions, and surfaces the field/electrical warnings that matter.
 *
 * FEASIBILITY / PRE-DESIGN ONLY. Final pump selection must be confirmed against
 * the actual borehole test report, pump curve, measured water level and yield.
 * This module never claims certified hydraulic engineering.
 *
 * All outputs are clamp-safe (no NaN/Infinity) even on blank/zero input.
 */

const G = 9.81; // m/s²

// Conservative feasibility defaults (documented in the technical-basis doc).
export const BOREHOLE_DEFAULTS = {
  pumpEfficiency: 0.55,
  motorEfficiency: 0.85,
  controllerEfficiency: 0.95,
  storageAutonomyDays: 2.0,
  pressureAllowanceM: 0,
  desiredPumpingHoursPerDay: 6,
  hazenWilliamsC: 140, // HDPE / uPVC
  pvPowerOversize: 1.25, // solar-direct array vs pump kW
};

// Standard submersible pump sizes (HP) for "suggested pump HP".
const STANDARD_PUMP_HP = [0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7.5, 10, 12.5, 15, 20, 25, 30];

// Per-unit demand figures (litres/day) for the use-case helper. Rough planning
// values — the field team confirms actual demand.
export const USE_CASE_PRESETS = {
  residential: { label: "Residential household", perUnitLitres: 150, unit: "person", typicalUnits: 6, pressureAllowanceM: 10, note: "~150 L/person/day incl. domestic use." },
  school:      { label: "School", perUnitLitres: 5, unit: "student", typicalUnits: 300, pressureAllowanceM: 10, note: "~5 L/student/day (day school); more for boarding." },
  clinic:      { label: "Clinic / health centre", perUnitLitres: 40, unit: "patient", typicalUnits: 100, pressureAllowanceM: 10, note: "~40 L/outpatient/day; inpatient wards need more." },
  community:   { label: "Community water point", perUnitLitres: 20, unit: "person", typicalUnits: 500, pressureAllowanceM: 5, note: "~20 L/person/day at a kiosk/standpipe." },
  livestock:   { label: "Livestock", perUnitLitres: 50, unit: "cattle-equiv", typicalUnits: 100, pressureAllowanceM: 0, note: "~50 L/head/day cattle; ~5 L smallstock." },
  irrigation:  { label: "Irrigation", perUnitLitres: 20000, unit: "acre", typicalUnits: 1, pressureAllowanceM: 15, note: "~20,000 L/acre/day (≈5 mm) — crop & method dependent." },
  farm:        { label: "Dairy / mixed farm", perUnitLitres: 60, unit: "cattle-equiv", typicalUnits: 80, pressureAllowanceM: 10, note: "Livestock + dairy washdown; confirm herd size." },
  commercial:  { label: "Commercial", perUnitLitres: 50, unit: "person", typicalUnits: 100, pressureAllowanceM: 15, note: "Offices/retail; process water excluded." },
  hotel_lodge: { label: "Hotel / lodge", perUnitLitres: 300, unit: "guest", typicalUnits: 40, pressureAllowanceM: 20, note: "~300 L/guest/day incl. laundry & grounds." },
};

export const PUMP_TYPE_PRESETS = {
  dc_submersible:     { label: "DC solar submersible", pumpEfficiency: 0.55, note: "Best for solar-direct; brushless DC, wide voltage window." },
  ac_submersible_vfd: { label: "AC submersible + VFD", pumpEfficiency: 0.60, note: "Robust, uses a solar pump inverter/VFD; good for deeper/larger." },
  surface_pump:       { label: "Surface pump", pumpEfficiency: 0.50, note: "Shallow lift / booster from a sump; not for deep boreholes." },
  booster_pump:       { label: "Booster pump", pumpEfficiency: 0.55, note: "Pressurises distribution from a tank." },
};

export const POWER_MODE_PRESETS = {
  solar_direct:            { label: "Daytime solar direct + tank", note: "No battery — pump into storage during sun hours. Storage is the battery." },
  solar_with_grid_backup:  { label: "Solar + grid backup", note: "Grid tops up pumping when solar is short." },
  solar_with_genset_backup:{ label: "Solar + genset backup", note: "Generator covers pumping during poor weather / night." },
  solar_with_battery:      { label: "Solar + battery", note: "Battery enables night pumping — costlier than tank storage." },
  hybrid:                  { label: "Hybrid", note: "Combination — confirm control strategy." },
};

const finite = (v, fb = 0) => (Number.isFinite(v) ? v : fb);
const pos = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : fb; };

export function createDefaultBorehole() {
  return {
    enabled: false,
    useCase: "farm",
    dailyWaterDemandLitres: 0,
    boreholeYieldLitresPerHour: 0,
    staticWaterLevelM: 0,
    dynamicWaterLevelM: 0,
    drawdownM: 0,
    pumpSettingDepthM: 0,
    tankHeightM: 0,
    horizontalPipeDistanceM: 0,
    pipeDiameterMm: 50,
    frictionLossM: 0,          // 0 = auto-estimate (Hazen-Williams)
    pressureAllowanceM: BOREHOLE_DEFAULTS.pressureAllowanceM,
    totalDynamicHeadM: 0,      // 0 = auto-compute
    desiredPumpingHoursPerDay: BOREHOLE_DEFAULTS.desiredPumpingHoursPerDay,
    pumpEfficiency: BOREHOLE_DEFAULTS.pumpEfficiency,
    motorEfficiency: BOREHOLE_DEFAULTS.motorEfficiency,
    controllerEfficiency: BOREHOLE_DEFAULTS.controllerEfficiency,
    pumpType: "dc_submersible",
    powerMode: "solar_direct",
    tankStorageLitres: 0,
    storageAutonomyDays: BOREHOLE_DEFAULTS.storageAutonomyDays,
    irrigationAreaAcres: 0,
    livestockCount: 0,
    requiresNightPumping: false,
    dryRunProtectionIncluded: false,
    floatSwitchIncluded: false,
    spdIncluded: false,
    earthingIncluded: false,
    controllerIncluded: true,
    notes: "",
    // v11.7 — pump-curve / borehole test-report shell (feasibility evidence).
    testReportRef: "",
    testDurationHours: 0,
    pumpModel: "",
    pumpCurvePoints: [],          // [{ flowLph, headM }]
    selectedOperatingPoint: null, // { flowLph, headM }
    validationStatus: "unvalidated", // unvalidated | provisional | confirmed
  };
}

export const PUMP_SELECTION_DISCLAIMER = "Final pump selection requires pump curve and borehole test confirmation.";

/**
 * validateBoreholeOperatingPoint — checks a selected operating point against the
 * design flow/TDH. NEVER asserts final selection; returns an advisory status.
 */
export function validateBoreholeOperatingPoint(boreholeInput = {}, results = {}) {
  const b = normalizeBorehole(boreholeInput);
  const op = b.selectedOperatingPoint;
  const hasCurve = Array.isArray(b.pumpCurvePoints) && b.pumpCurvePoints.length >= 2;
  const hasReport = !!String(b.testReportRef || "").trim();
  if (!op || !Number.isFinite(Number(op.flowLph)) || !Number.isFinite(Number(op.headM))) {
    return { status: "unvalidated", ok: null, message: PUMP_SELECTION_DISCLAIMER, hasCurve, hasReport };
  }
  const designFlow = finite(results.requiredFlowLitresPerHour);
  const designHead = finite(results.totalDynamicHeadM);
  const flowOk = Number(op.flowLph) >= designFlow * 0.95;
  const headOk = Number(op.headM) >= designHead * 0.95;
  const meets = flowOk && headOk;
  let status = "provisional";
  if (meets && hasCurve && hasReport && b.validationStatus === "confirmed") status = "confirmed";
  const message = meets
    ? `Selected operating point meets the design duty (~${Math.round(designFlow)} L/h @ ${Math.round(designHead)} m). ${PUMP_SELECTION_DISCLAIMER}`
    : `Selected operating point is BELOW the design duty (~${Math.round(designFlow)} L/h @ ${Math.round(designHead)} m). Choose a stronger pump or reduce demand/head. ${PUMP_SELECTION_DISCLAIMER}`;
  return { status, ok: meets, message, hasCurve, hasReport, designFlow, designHead };
}

// Migration-safe: fill any missing keys on an old/partial borehole object.
export function normalizeBorehole(b) {
  if (!b || typeof b !== "object") return createDefaultBorehole();
  return { ...createDefaultBorehole(), ...b };
}

// ── Hydraulics ───────────────────────────────────────────────────────────────

export function estimateFrictionLoss({ flowM3ph = 0, pipeDiameterMm = 50, totalPipeLengthM = 0, hazenWilliamsC = BOREHOLE_DEFAULTS.hazenWilliamsC } = {}) {
  const Q = pos(flowM3ph) / 3600;                 // m³/s
  const d = pos(pipeDiameterMm) / 1000;           // m
  const L = finite(totalPipeLengthM);
  const C = pos(hazenWilliamsC, 140);
  if (Q <= 0 || d <= 0 || L <= 0) return 0;
  // Hazen-Williams head loss (m): 10.67·L·Q^1.852 / (C^1.852·d^4.87)
  const hf = (10.67 * L * Math.pow(Q, 1.852)) / (Math.pow(C, 1.852) * Math.pow(d, 4.87));
  return finite(+Math.min(hf, 1000).toFixed(2)); // clamp absurd values
}

export function calculateTotalDynamicHead(input = {}) {
  const staticWaterLevelM = finite(input.staticWaterLevelM);
  const drawdownM = finite(input.drawdownM);
  const dynamicWaterLevelM = pos(input.dynamicWaterLevelM, staticWaterLevelM + drawdownM);
  const tankHeightM = finite(input.tankHeightM);
  const pressureAllowanceM = finite(input.pressureAllowanceM);
  // friction: use provided override if >0, else estimate over riser+horizontal+lift
  const totalPipeLengthM = pos(input.pumpSettingDepthM, dynamicWaterLevelM) + finite(input.horizontalPipeDistanceM) + tankHeightM;
  const frictionLossM = pos(input.frictionLossM,
    estimateFrictionLoss({ flowM3ph: input.flowM3ph, pipeDiameterMm: input.pipeDiameterMm, totalPipeLengthM }));
  const totalDynamicHeadM = +(dynamicWaterLevelM + tankHeightM + frictionLossM + pressureAllowanceM).toFixed(2);
  return { totalDynamicHeadM, dynamicWaterLevelM, frictionLossM, tankHeightM, pressureAllowanceM };
}

export function calculateHydraulicPower({ flowM3ph = 0, totalDynamicHeadM = 0 } = {}) {
  const Q = pos(flowM3ph);
  const H = finite(totalDynamicHeadM);
  return +((Q * H * G) / 3600).toFixed(3); // kW
}

export function calculatePumpPower({ hydraulicPowerKw = 0, pumpEfficiency, motorEfficiency, controllerEfficiency } = {}) {
  const eff = pos(pumpEfficiency, BOREHOLE_DEFAULTS.pumpEfficiency)
    * pos(motorEfficiency, BOREHOLE_DEFAULTS.motorEfficiency)
    * pos(controllerEfficiency, BOREHOLE_DEFAULTS.controllerEfficiency);
  if (eff <= 0) return 0;
  return +(finite(hydraulicPowerKw) / eff).toFixed(3); // kW
}

export function calculateDailyPumpingEnergy({ pumpElectricalKw = 0, pumpingHoursPerDay = 0 } = {}) {
  return +(finite(pumpElectricalKw) * pos(pumpingHoursPerDay)).toFixed(2); // kWh/day
}

export function calculateSolarPumpPvSize({ dailyPumpingKwh = 0, psh = 5.5, pr = 0.75 } = {}) {
  const denom = pos(psh, 5.5) * pos(pr, 0.75);
  if (denom <= 0) return 0;
  return +(finite(dailyPumpingKwh) / denom).toFixed(2); // kWp
}

export function calculateTankStorage({ dailyWaterDemandLitres = 0, storageAutonomyDays = BOREHOLE_DEFAULTS.storageAutonomyDays } = {}) {
  return Math.round(finite(dailyWaterDemandLitres) * pos(storageAutonomyDays, BOREHOLE_DEFAULTS.storageAutonomyDays));
}

export function checkBoreholeYield({ requiredFlowLitresPerHour = 0, boreholeYieldLitresPerHour = 0 } = {}) {
  const req = finite(requiredFlowLitresPerHour);
  const yield_ = finite(boreholeYieldLitresPerHour);
  const sufficient = yield_ <= 0 ? null : req <= yield_; // null = yield unknown
  const utilisation = yield_ > 0 ? +(req / yield_).toFixed(2) : null;
  return { requiredFlowLitresPerHour: req, boreholeYieldLitresPerHour: yield_, sufficient, utilisation };
}

export function checkPumpRuntime({ desiredPumpingHoursPerDay = 0, psh = 5.5, powerMode = "solar_direct", requiresNightPumping = false } = {}) {
  const hours = pos(desiredPumpingHoursPerDay, BOREHOLE_DEFAULTS.desiredPumpingHoursPerDay);
  const solarWindow = pos(psh, 5.5);
  const exceedsSolarWindow = hours > solarWindow + 0.01;
  const hasNonSolarSource = powerMode !== "solar_direct" || false;
  return { hours, solarWindow, exceedsSolarWindow, requiresNightPumping: !!requiresNightPumping, hasNonSolarSource };
}

function nextPumpHp(hp) { return STANDARD_PUMP_HP.find((x) => x >= hp) ?? STANDARD_PUMP_HP[STANDARD_PUMP_HP.length - 1]; }

// ── Use-case demand helper ───────────────────────────────────────────────────

export function estimateWaterDemand(useCase, units) {
  const p = USE_CASE_PRESETS[useCase];
  if (!p) return 0;
  const n = pos(units, p.typicalUnits);
  return Math.round(p.perUnitLitres * n);
}

// ── Umbrella: run the whole feasibility chain ────────────────────────────────

/**
 * computeBorehole(borehole, { psh, pr, panelW }) → full results object.
 * Everything the UI, readiness, BoQ and proposal need.
 */
export function computeBorehole(boreholeInput = {}, ctx = {}) {
  const b = normalizeBorehole(boreholeInput);
  const psh = pos(ctx.psh, 5.5);
  const pr = pos(ctx.pr, 0.75);
  const panelW = pos(ctx.panelW, 550);

  const dailyWaterDemandLitres = finite(b.dailyWaterDemandLitres);
  const desiredHours = pos(b.desiredPumpingHoursPerDay, BOREHOLE_DEFAULTS.desiredPumpingHoursPerDay);
  const requiredFlowLitresPerHour = desiredHours > 0 ? +(dailyWaterDemandLitres / desiredHours).toFixed(1) : 0;
  const flowM3ph = requiredFlowLitresPerHour / 1000;

  const headParts = calculateTotalDynamicHead({ ...b, flowM3ph });
  const totalDynamicHeadM = pos(b.totalDynamicHeadM, headParts.totalDynamicHeadM);

  const hydraulicPowerKw = calculateHydraulicPower({ flowM3ph, totalDynamicHeadM });
  const pumpElectricalKw = calculatePumpPower({
    hydraulicPowerKw, pumpEfficiency: b.pumpEfficiency, motorEfficiency: b.motorEfficiency, controllerEfficiency: b.controllerEfficiency,
  });
  const suggestedPumpHp = nextPumpHp(pumpElectricalKw / 0.746);

  const dailyPumpingKwh = calculateDailyPumpingEnergy({ pumpElectricalKw, pumpingHoursPerDay: desiredHours });

  // PV: energy-based (spec) plus a solar-direct power floor; recommend the larger.
  const requiredPvKwp = calculateSolarPumpPvSize({ dailyPumpingKwh, psh, pr });
  const pvPowerFloorKwp = +(pumpElectricalKw * BOREHOLE_DEFAULTS.pvPowerOversize).toFixed(2);
  const recommendedPvKwp = +Math.max(requiredPvKwp, pvPowerFloorKwp).toFixed(2);
  const estimatedPanels = recommendedPvKwp > 0 ? Math.max(1, Math.ceil((recommendedPvKwp * 1000) / panelW)) : 0;
  const pvIsPowerLimited = pvPowerFloorKwp > requiredPvKwp + 0.001;

  const recommendedTankLitres = calculateTankStorage({ dailyWaterDemandLitres, storageAutonomyDays: b.storageAutonomyDays });
  const yield_ = checkBoreholeYield({ requiredFlowLitresPerHour, boreholeYieldLitresPerHour: b.boreholeYieldLitresPerHour });
  const runtime = checkPumpRuntime({ desiredPumpingHoursPerDay: desiredHours, psh, powerMode: b.powerMode, requiresNightPumping: b.requiresNightPumping });

  const results = {
    dailyWaterDemandLitres,
    requiredFlowLitresPerHour,
    flowM3ph: +flowM3ph.toFixed(3),
    dynamicWaterLevelM: headParts.dynamicWaterLevelM,
    frictionLossM: headParts.frictionLossM,
    totalDynamicHeadM,
    hydraulicPowerKw,
    pumpElectricalKw,
    suggestedPumpHp,
    dailyPumpingKwh,
    requiredPvKwp,
    pvPowerFloorKwp,
    recommendedPvKwp,
    estimatedPanels,
    pvIsPowerLimited,
    recommendedTankLitres,
    pumpingHoursPerDay: desiredHours,
    yield: yield_,
    runtime,
    psh, pr, panelW,
  };
  results.warnings = buildBoreholeWarnings(b, results);
  return results;
}

// ── Warnings ─────────────────────────────────────────────────────────────────

export function buildBoreholeWarnings(boreholeInput = {}, results = {}) {
  const b = normalizeBorehole(boreholeInput);
  const w = [];
  const add = (level, code, message) => w.push({ level, code, message });

  if (finite(b.dailyWaterDemandLitres) <= 0) add("warning", "NO_DEMAND", "Enter the daily water demand (litres/day) to size the system.");
  if (results.yield && results.yield.sufficient === false) {
    add("critical", "YIELD_INSUFFICIENT", `Required flow (${Math.round(results.requiredFlowLitresPerHour)} L/h) exceeds the tested borehole yield (${Math.round(b.boreholeYieldLitresPerHour)} L/h). Reduce pumping rate (pump longer), stagger demand, or confirm a higher-yield source.`);
  } else if (results.yield && results.yield.sufficient === null) {
    add("warning", "YIELD_UNKNOWN", "Borehole yield not entered — confirm against the borehole test report before sizing the pump.");
  } else if (results.yield && results.yield.utilisation !== null && results.yield.utilisation > 0.8) {
    add("warning", "YIELD_TIGHT", `Design draws ${Math.round(results.yield.utilisation * 100)}% of tested yield — little margin. Confirm sustained yield and recovery.`);
  }

  if (results.totalDynamicHeadM > 200) add("warning", "TDH_HIGH", `Total dynamic head (${Math.round(results.totalDynamicHeadM)} m) is high — confirm the pump curve can deliver the flow at this head.`);
  if (results.frictionLossM > 0.15 * Math.max(results.totalDynamicHeadM, 1)) add("warning", "FRICTION_HIGH", `Friction loss (${results.frictionLossM} m) is a large share of head. Consider a larger pipe diameter or confirm the pipe route.`);

  if (results.runtime && results.runtime.exceedsSolarWindow && b.powerMode === "solar_direct") {
    add("warning", "HOURS_EXCEED_SOLAR", `Requested pumping hours (${results.runtime.hours} h) exceed the solar window (~${results.runtime.solarWindow.toFixed(1)} h). Use a larger array/tank, or add grid/genset/battery.`);
  }
  if (b.requiresNightPumping && (b.powerMode === "solar_direct")) {
    add("critical", "NIGHT_PUMPING_NO_SOURCE", "Night pumping requested but power mode is solar-direct with no battery/grid/genset. Store water in a tank for night use, or add a non-solar source/battery.");
  }
  const tankCoversDemand = finite(b.tankStorageLitres) >= finite(results.recommendedTankLitres) * 0.5 || finite(results.recommendedTankLitres) === 0;
  if (finite(b.tankStorageLitres) > 0 && finite(b.tankStorageLitres) < finite(results.recommendedTankLitres) * 0.5) {
    add("warning", "TANK_SMALL", `Planned tank (${Math.round(b.tankStorageLitres)} L) is well below the recommended ${Math.round(results.recommendedTankLitres)} L for ${b.storageAutonomyDays}-day autonomy.`);
  }

  if (!b.dryRunProtectionIncluded) add("warning", "NO_DRY_RUN", "Dry-run protection not included — strongly recommended to protect the pump when the borehole draws down.");
  if (!b.floatSwitchIncluded) add("info", "NO_FLOAT", "Tank float switch not included — recommended to stop pumping when the tank is full.");
  if (!b.spdIncluded) add("warning", "NO_SPD", "Surge/lightning protection (SPD) not included — recommended for exposed borehole/PV installations.");
  if (!b.earthingIncluded) add("warning", "NO_EARTH", "Earthing kit not included — required for pump and array safety.");
  if (finite(b.horizontalPipeDistanceM) > 100 && pos(b.frictionLossM) === 0) add("info", "LONG_PIPE", "Long horizontal pipe run — confirm friction loss and pipe sizing on site.");

  add("info", "CONFIRM_TEST", "Feasibility only: confirm pump selection against the borehole test report, pump curve, water level and yield before final design.");
  add("info", "CONFIRM_WATER_QUALITY", "Confirm water quality and pump material suitability (sand, salinity, corrosion).");
  return w;
}

// ── BoQ ──────────────────────────────────────────────────────────────────────

/**
 * buildBoreholeBoQ(borehole, results) → editable rows
 * [{ item, description, qty, unit, unitCost, total, category }]
 * Costs are conservative KES placeholders — the estimator edits them.
 */
export function buildBoreholeBoQ(boreholeInput = {}, results = {}) {
  const b = normalizeBorehole(boreholeInput);
  const rows = [];
  const add = (item, qty, unit, unitCost, description = "") =>
    rows.push({ item, description, qty: Math.max(0, Math.round(qty * 100) / 100), unit, unitCost, total: Math.round(Math.max(0, qty) * unitCost), category: "Solar borehole" });

  const panels = pos(results.estimatedPanels, 1);
  const pumpHp = pos(results.suggestedPumpHp, 1);
  const setting = pos(b.pumpSettingDepthM, pos(results.dynamicWaterLevelM, 30));
  const dropCable = Math.ceil(setting + 5);
  const riser = Math.ceil(setting + 3);
  const delivery = Math.ceil(pos(b.horizontalPipeDistanceM, 20) + pos(b.tankHeightM, 0) + 5);

  add(PUMP_TYPE_PRESETS[b.pumpType]?.label || "Solar submersible pump", 1, "unit", 80000 + pumpHp * 30000, `~${pumpHp} HP for ${Math.round(results.totalDynamicHeadM)} m TDH`);
  if (b.controllerIncluded) add("Pump controller / VFD", 1, "unit", 45000, "Solar pump controller / drive");
  add("PV modules (pumping)", panels, "panel", 11000, `${results.recommendedPvKwp} kWp dedicated to pumping`);
  add("PV mounting structure", panels, "panel", 4750, "Ground/pole mount allowance");
  add("Borehole drop cable", dropCable, "m", 350, "Submersible pump cable");
  add("Riser pipe (HDPE/uPVC)", riser, "m", 900, `${b.pipeDiameterMm}mm riser to surface`);
  add("Delivery pipe", delivery, "m", 650, "Surface pipe to tank");
  if (b.dryRunProtectionIncluded) add("Dry-run protection", 1, "unit", 12000, "Low-water cutout / probe");
  if (b.floatSwitchIncluded) add("Tank float switch", 1, "unit", 4500, "Tank-full cutoff");
  add("Water level sensors / probes", 1, "set", 6000, "Well & tank level sensing");
  if (b.spdIncluded) add("Lightning protection / SPD", 1, "unit", 9000, "DC/AC surge protection");
  if (b.earthingIncluded) add("Earthing kit", 1, "set", 8000, "Rod + conductor + clamps");
  if (pos(b.tankStorageLitres, results.recommendedTankLitres) > 0)
    add("Storage tank", 1, "unit", Math.round(pos(b.tankStorageLitres, results.recommendedTankLitres) * 12), `${Math.round(pos(b.tankStorageLitres, results.recommendedTankLitres))} L storage`);
  add("Tank tower / platform (allowance)", 1, "item", 60000, "Placeholder — confirm height/structure");
  add("Plumbing accessories", 1, "lot", 15000, "Fittings, valves, non-return");
  add("Installation & commissioning", 1, "lot", 55000, "Set pump, wire, test flow");
  add("Borehole test confirmation (placeholder)", 1, "item", 0, "Confirm/obtain borehole test report");

  const total = rows.reduce((s, r) => s + r.total, 0);
  return { rows, total };
}

// ── Proposal / technician summaries ──────────────────────────────────────────

export function summarizeBoreholeForProposal(boreholeInput = {}, results = {}) {
  const b = normalizeBorehole(boreholeInput);
  const critical = (results.warnings || []).filter((x) => x.level === "critical");
  const powerMode = POWER_MODE_PRESETS[b.powerMode]?.label || b.powerMode;
  return {
    useCase: USE_CASE_PRESETS[b.useCase]?.label || b.useCase,
    dailyWaterDemandLitres: results.dailyWaterDemandLitres,
    totalDynamicHeadM: results.totalDynamicHeadM,
    suggestedPumpHp: results.suggestedPumpHp,
    pumpElectricalKw: results.pumpElectricalKw,
    recommendedPvKwp: results.recommendedPvKwp,
    estimatedPanels: results.estimatedPanels,
    recommendedTankLitres: results.recommendedTankLitres,
    pumpingStrategy: powerMode,
    protectionIncluded: [
      b.dryRunProtectionIncluded && "dry-run protection",
      b.floatSwitchIncluded && "float switch",
      b.spdIncluded && "SPD",
      b.earthingIncluded && "earthing",
    ].filter(Boolean),
    criticalCount: critical.length,
    headline: `This design pumps approximately ${Math.round(results.dailyWaterDemandLitres).toLocaleString()} litres per day using ${powerMode.toLowerCase()} into storage. Final pump selection must be confirmed against the actual borehole test report, pump curve, water level, yield and pipe route.`,
    reviewRequired: critical.length > 0,
  };
}

export function summarizeBoreholeForTechnician(boreholeInput = {}, results = {}) {
  const b = normalizeBorehole(boreholeInput);
  return {
    checklist: [
      "Confirm borehole test report available",
      "Confirm static water level",
      "Confirm dynamic water level (at design flow)",
      "Confirm sustained yield & recovery",
      "Confirm pump setting depth",
      "Confirm pipe route & diameter",
      "Confirm tank location & height",
      "Confirm cable route & length",
      "Confirm controller/VFD location & shading",
      "Confirm earthing & SPD",
      "Confirm dry-run protection wired & tested",
      "Confirm tank float switch",
      "Confirm water quality & pump material suitability",
      "Confirm pump rotation/direction & commissioning flow",
      "Record actual pumping current & voltage",
      "Record flow test after commissioning",
    ],
    quickFacts: {
      pump: `${results.suggestedPumpHp} HP (${results.pumpElectricalKw} kW)`,
      tdh: `${results.totalDynamicHeadM} m TDH`,
      flow: `${Math.round(results.requiredFlowLitresPerHour)} L/h design flow`,
      pv: `${results.recommendedPvKwp} kWp (${results.estimatedPanels} panels)`,
      tank: `${Math.round(results.recommendedTankLitres).toLocaleString()} L recommended`,
      dryRun: b.dryRunProtectionIncluded ? "included" : "MISSING — recommend",
    },
  };
}

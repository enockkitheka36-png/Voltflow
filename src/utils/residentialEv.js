import { createLoadItem } from "./loadEngine.js";

const value = (input) => (typeof input === "number" || typeof input === "string") && String(input).trim() !== "" && Number.isFinite(Number(input)) ? Number(input) : null;
export const RESIDENTIAL_EV_DEFAULTS = { dailyKm: "", consumptionKwhPer100Km: "", consumptionBasis: "BATTERY", chargingEfficiencyPct: "", chargerKw: "", chargingWindowHours: "", chargingPeriod: "NIGHT", supplyScope: "GRID_ONLY" };

export function calculateResidentialEv(input = {}) {
  const errors = [];
  const inputs = { ...RESIDENTIAL_EV_DEFAULTS, ...input };
  const numbers = Object.fromEntries(["dailyKm", "consumptionKwhPer100Km", "chargerKw", "chargingWindowHours"].map((key) => [key, value(inputs[key])]));
  if (numbers.dailyKm === null || numbers.dailyKm < 0 || numbers.dailyKm > 2000) errors.push("Enter daily driving distance from 0 to 2,000 km.");
  if (!(numbers.consumptionKwhPer100Km > 0) || numbers.consumptionKwhPer100Km > 100) errors.push("Enter a vehicle consumption between 0 and 100 kWh/100 km, excluding zero.");
  if (!(numbers.chargerKw > 0) || numbers.chargerKw > 22) errors.push("Enter a residential AC charger rating up to 22 kW.");
  if (!(numbers.chargingWindowHours > 0) || numbers.chargingWindowHours > 24) errors.push("Enter a charging window greater than 0 and at most 24 hours.");
  if (!["BATTERY", "WALL"].includes(inputs.consumptionBasis)) errors.push("Choose whether vehicle consumption is battery-side or wall-metered.");
  const efficiency = inputs.consumptionBasis === "WALL" ? 1 : value(inputs.chargingEfficiencyPct) / 100;
  if (!(efficiency > 0) || efficiency > 1) errors.push("Enter charging efficiency greater than 0 and at most 100%; do not add losses twice to wall-metered consumption.");
  if (!["DAY", "NIGHT"].includes(inputs.chargingPeriod)) errors.push("Choose daytime or night charging.");
  if (!["GRID_ONLY", "SOLAR", "BACKUP"].includes(inputs.supplyScope)) errors.push("Choose the intended charger supply.");
  if (inputs.chargingPeriod === "NIGHT" && inputs.supplyScope === "SOLAR") errors.push("Night charging cannot be directly solar-only. Choose grid or a separately reviewed backup supply.");
  if (errors.length) return { ready: false, errors };
  const batteryOrWallKwh = numbers.dailyKm * numbers.consumptionKwhPer100Km / 100;
  const wallKwh = batteryOrWallKwh / efficiency;
  const chargingHours = wallKwh / numbers.chargerKw;
  if (chargingHours > numbers.chargingWindowHours + 1e-9) errors.push("The required charging time exceeds the available charging window.");
  return { ready: errors.length === 0, errors, wallKwh, chargingHours, annualWallKwh: wallKwh * 365, chargerKw: numbers.chargerKw, inputs, chargingEfficiency: efficiency };
}

export function createResidentialEvLoad(input) {
  const result = calculateResidentialEv(input);
  if (!result.ready) throw new Error(result.errors.join(" "));
  return createLoadItem({ id: "residential-ev-charger", name: "Residential EV charging", category: "Other", qty: 1, ratedW: result.chargerKw * 1000, dayHours: input.chargingPeriod === "DAY" ? result.chargingHours : 0, nightHours: input.chargingPeriod === "NIGHT" ? result.chargingHours : 0, dutyCyclePct: 100, demandFactorPct: 100, diversityFactorPct: 100, phase: "UNKNOWN", powerFactor: 0.95, surgeMultiplier: 1, supply_scope: input.supplyScope, criticality: "NON_CRITICAL", evPlanningInputs: Object.fromEntries(Object.keys(RESIDENTIAL_EV_DEFAULTS).map((key) => [key, input[key]])), notes: "EV wall energy includes charging losses once. Phase and assumed 0.95 power factor require qualified review; not a commercial charger revenue model." });
}

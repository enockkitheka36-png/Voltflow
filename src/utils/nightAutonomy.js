/**
 * nightAutonomy.js — Voltflow 11.5.2 (fixes RISK-1)
 *
 * The main sizing reports battery autonomy against a 24-hour-AVERAGED critical
 * load. For night-dominant jobs (flood/security/street lighting) that overstates
 * real backup — the lights run all night at full power, not at the daily average.
 *
 * This pure helper computes the honest night-window picture from the committed
 * loads and the sized battery. No React, no DOM. Safe against NaN/Infinity and
 * zero-load projects.
 */

import { computeItemDerived, getModeDefaults } from "./loadEngine.js";

export const ASSUMED_NIGHT_WINDOW_HOURS = 11; // 18:00–05:00 local, per sizing day/night convention
const DAY_START = 6, DAY_END = 18;

const finite = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

/**
 * computeNightAutonomy(loadItemsV2, mode, sizing, project) → {
 *   dayKwh, nightKwh, nightLoadShare,
 *   criticalDayKwh, criticalNightKwh, criticalNightLoadShare,
 *   usableBatteryKwh, nightEnergyCoverage, estimatedNightAutonomyHours,
 *   isNightDominantLoad, nightAutonomyWarning
 * }
 */
export function computeNightAutonomy(loadItems = [], mode = "Residential", sizing = {}, project = {}) {
  const modeDefaults = getModeDefaults(mode);
  let dayKwh = 0, nightKwh = 0, criticalDayKwh = 0, criticalNightKwh = 0;

  // Accept BOTH shapes so this works everywhere it is called:
  //  • V2 items  → { ratedW, dutyCyclePct, dayHours, nightHours, essential/backupRequired }
  //  • legacy loads (toLegacyLoads, what the readiness engine actually passes)
  //               → { watts (already duty-adjusted per unit), qty, dayHours, nightHours, critical }
  (Array.isArray(loadItems) ? loadItems : []).forEach((item) => {
    if (!item || typeof item !== "object") return;
    let day, night, isCritical;
    if (item.ratedW != null) {
      const d = computeItemDerived(item, modeDefaults);
      day = finite(d.dayKwh);
      night = finite(d.nightKwh);
      isCritical = item.solarOffsetOnly ? false : (item.backupRequired ?? item.essential ?? false);
    } else {
      const qty = Math.max(0, Number(item.qty) || 0);
      const kwPerUnit = (Number(item.watts) || 0) / 1000; // legacy watts is already effective (duty-adjusted)
      day = finite(qty * kwPerUnit * (Number(item.dayHours) || 0));
      night = finite(qty * kwPerUnit * (Number(item.nightHours) || 0));
      isCritical = item.solarOffsetOnly ? false : (item.critical ?? item.backupRequired ?? item.essential ?? false);
    }
    dayKwh += day;
    nightKwh += night;
    if (isCritical) { criticalDayKwh += day; criticalNightKwh += night; }
  });

  const totalKwh = dayKwh + nightKwh;
  const criticalTotal = criticalDayKwh + criticalNightKwh;
  const nightLoadShare = totalKwh > 0 ? nightKwh / totalKwh : 0;
  const criticalNightLoadShare = criticalTotal > 0 ? criticalNightKwh / criticalTotal : 0;

  // Usable battery energy — prefer engine values, fall back to project defaults.
  const batteryKwh = finite(sizing.batteryKwh);
  const dod = finite(project.dod, 0.8) || 0.8;
  const eff = finite(project.batteryEfficiency, 0.95) || 0.95;
  const usableBatteryKwh = +(batteryKwh * dod * eff).toFixed(2);

  // Coverage of the CRITICAL night energy (what backup actually has to carry).
  const nightEnergyCoverage = criticalNightKwh > 0
    ? +(usableBatteryKwh / criticalNightKwh).toFixed(3)
    : (usableBatteryKwh > 0 ? 1 : 0); // no night critical load → trivially covered

  // Real backup time on the sustained night demand (kW = night kWh / window).
  const nightDemandKw = criticalNightKwh > 0 ? criticalNightKwh / ASSUMED_NIGHT_WINDOW_HOURS : 0;
  const estimatedNightAutonomyHours = nightDemandKw > 0
    ? +Math.min(usableBatteryKwh / nightDemandKw, 72).toFixed(1) // clamp to avoid runaway/Infinity
    : 0;

  const isNightDominantLoad = nightLoadShare >= 0.65 || criticalNightLoadShare >= 0.65;

  let nightAutonomyWarning = null;
  if (isNightDominantLoad && criticalNightKwh > 0 && nightEnergyCoverage < 1) {
    nightAutonomyWarning =
      `Night-dominant load detected (${Math.round(criticalNightLoadShare * 100)}% of critical energy is at night). ` +
      `The battery covers about ${Math.round(nightEnergyCoverage * 100)}% of the critical night energy ` +
      `(~${estimatedNightAutonomyHours} h). Average 24-hour autonomy overstates real backup — use the night-load ` +
      `figure for client promises, or increase battery capacity.`;
  } else if (isNightDominantLoad && criticalNightKwh > 0) {
    nightAutonomyWarning =
      `Night-dominant load: the battery covers the full critical night energy (~${estimatedNightAutonomyHours} h). ` +
      `Still confirm depth-of-discharge and temperature derating before quoting backup time.`;
  }

  return {
    dayKwh: +dayKwh.toFixed(2),
    nightKwh: +nightKwh.toFixed(2),
    nightLoadShare: +nightLoadShare.toFixed(3),
    criticalDayKwh: +criticalDayKwh.toFixed(2),
    criticalNightKwh: +criticalNightKwh.toFixed(2),
    criticalNightLoadShare: +criticalNightLoadShare.toFixed(3),
    usableBatteryKwh,
    nightEnergyCoverage,
    estimatedNightAutonomyHours,
    isNightDominantLoad,
    nightAutonomyWarning,
  };
}

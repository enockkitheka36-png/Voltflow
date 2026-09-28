/**
 * stringPlanner.js — Solarise Pro v8.5
 * String and MPPT planning logic.
 * Pure functions — no React, no DOM.
 *
 * All calculations are planning-level estimates.
 * Final string design must be verified by a qualified engineer
 * against inverter datasheet, module datasheet, IEC 62548 and
 * local wiring regulations.
 */

// ─── Colour palette for string visualisation ─────────────────────────────────
export const STRING_COLOURS = [
  "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6",
  "#ef4444", "#06b6d4", "#f97316", "#ec4899",
  "#84cc16", "#6366f1", "#14b8a6", "#a855f7",
];

export function getStringColour(stringIndex) {
  return STRING_COLOURS[stringIndex % STRING_COLOURS.length];
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Auto-generate a string plan from project/sizing settings.
 * @param {object} project  - Current project state
 * @param {object} sizing   - Output from useSizing
 * @param {Array}  roofFaces - simulation.roofFaces (may be empty)
 * @returns {StringPlan}
 */
export function generateStringPlan(project = {}, sizing = {}, roofFaces = []) {
  const totalPanels     = sizing.panels          || 0;
  const panelsPerString = sizing.panelsPerString || project.panelsPerString || 12;
  const numStrings      = Math.max(1, sizing.strings || Math.ceil(totalPanels / Math.max(panelsPerString, 1)));
  const mpptCount       = project.inverterMpptCount       || 2;
  const strPerMppt      = project.inverterStringsPerMppt  || 2;

  const moduleVoc   = project.moduleVoc   || 49.9;
  const moduleTcVoc = project.tempCoeffVoc || -0.0028; // /°C
  const minTemp     = project.minTemp     || 7;
  const invMaxDcV   = project.inverterMaxDcV || 1000;
  const moduleVmp   = project.moduleVmp   || 41.8;
  const moduleIsc   = project.moduleIsc   || 15.2;
  const moduleImp   = project.moduleImp   || 14.35;

  // Cold Voc per panel at minimum temperature
  const panelVocCold = moduleVoc * (1 + moduleTcVoc * (minTemp - 25));

  const strings = [];
  let panelsAssigned = 0;

  for (let s = 0; s < numStrings; s++) {
    const count    = s < numStrings - 1
      ? panelsPerString
      : Math.max(1, totalPanels - panelsAssigned);
    panelsAssigned += count;

    const mppt         = Math.floor(s / Math.max(strPerMppt, 1));
    const stringVocCold = panelVocCold * count;
    const stringVmp     = moduleVmp    * count;
    const stringIsc     = moduleIsc;
    const stringImp     = moduleImp;

    // Determine which roof face this string is on (round-robin across selected faces)
    const selectedFaces  = roofFaces.filter(f => f.selectedForPv !== false);
    const faceForString  = selectedFaces.length > 0
      ? selectedFaces[s % selectedFaces.length]
      : null;

    const warnings = [];
    if (stringVocCold > invMaxDcV) {
      warnings.push(`Cold Voc ${stringVocCold.toFixed(0)} V EXCEEDS inverter max ${invMaxDcV} V — reduce panels per string immediately.`);
    }
    if (count < Math.max(1, panelsPerString - 2)) {
      warnings.push(`String has only ${count} panels — Vmp may fall below MPPT operating window. Verify with inverter datasheet.`);
    }
    if (mppt >= mpptCount) {
      warnings.push(`Assigned to MPPT ${mppt + 1} but inverter only has ${mpptCount} MPPT inputs — revise string grouping.`);
    }

    strings.push({
      id:          `S${s + 1}`,
      label:       `String ${s + 1}`,
      mpptNumber:  mppt + 1,
      panelCount:  count,
      roofFaceId:  faceForString?.id   ?? null,
      roofFaceName: faceForString?.name ?? "Main roof",
      roofAzimuth: faceForString?.roofAzimuthDeg ?? null,
      stringVocCold: +stringVocCold.toFixed(1),
      stringVmp:    +stringVmp.toFixed(1),
      stringIsc:    +stringIsc.toFixed(2),
      stringImp:    +stringImp.toFixed(2),
      colourIndex:  s,
      status:       warnings.length > 0 ? "warning" : "ok",
      warnings,
    });
  }

  const planWarnings  = computePlanWarnings(strings, project);
  const needsCombiner = numStrings > 2;

  return {
    strings,
    totalStrings:   numStrings,
    totalPanels,
    panelsPerString,
    mpptCount,
    stringsPerMppt: strPerMppt,
    needsCombiner,
    panWarnings:    planWarnings,
    generatedAt:    new Date().toISOString(),
  };
}

// ─── Cross-string / MPPT validation (v11.1: extracted so MPPT reassignment in
// the UI can revalidate live without regenerating the whole plan) ─────────────

/**
 * computePlanWarnings(strings, project) → string[]
 * Pure. Checks inverter string capacity, mixed roof-face orientation per MPPT,
 * and combiner recommendation. Used by generateStringPlan and by the
 * StringPlanTab MPPT-reassignment handler.
 */
export function computePlanWarnings(strings = [], project = {}) {
  const numStrings = strings.length;
  const mpptCount  = project.inverterMpptCount      || 2;
  const strPerMppt = project.inverterStringsPerMppt || 2;

  const planWarnings = [];
  if (numStrings > mpptCount * strPerMppt) {
    planWarnings.push(`Total strings (${numStrings}) exceeds inverter capacity (${mpptCount} MPPT × ${strPerMppt} strings = ${mpptCount * strPerMppt} max).`);
  }

  // Per-MPPT overload after manual reassignment
  const perMppt = {};
  strings.forEach(s => { perMppt[s.mpptNumber] = (perMppt[s.mpptNumber] || 0) + 1; });
  Object.entries(perMppt).forEach(([mppt, count]) => {
    if (count > strPerMppt) {
      planWarnings.push(`MPPT ${mppt} has ${count} strings assigned but the inverter supports ${strPerMppt} per MPPT — move strings to another input.`);
    }
  });

  // Mixed-azimuth MPPT check
  const mpptMap = {};
  strings.forEach(s => {
    if (s.roofAzimuth === null) return;
    if (!mpptMap[s.mpptNumber]) mpptMap[s.mpptNumber] = [];
    mpptMap[s.mpptNumber].push(s.roofAzimuth);
  });
  Object.entries(mpptMap).forEach(([mppt, azimuths]) => {
    const unique = [...new Set(azimuths.map(a => Math.round(a / 45) * 45))];
    if (unique.length > 1) {
      planWarnings.push(`MPPT ${mppt} has strings from roof faces with different orientations (${unique.map(a => `${a}°`).join(", ")}) — energy mismatch may reduce MPPT efficiency.`);
    }
  });

  if (numStrings > 2) {
    planWarnings.push(`${numStrings} strings — combiner box / DC junction is recommended before inverter DC input.`);
  }
  return planWarnings;
}

// ─── As-built comparison ──────────────────────────────────────────────────────

// v11.1: optional third arg cableEstimates = { dcM, acM, batM } (from
// installerSimulation.getCableEstimates) enables planned-vs-actual cable checks.
export function compareAsBuilt(stringPlan = {}, asBuilt = {}, cableEstimates = null) {
  const issues = [];

  // Panel count difference
  const plannedPanels = stringPlan.totalPanels || 0;
  const actualPanels  = asBuilt.actualPanelsInstalled || 0;
  if (actualPanels > 0 && actualPanels < plannedPanels) {
    issues.push({ level: "warning", msg: `Actual panels installed (${actualPanels}) is less than planned (${plannedPanels}).` });
  }

  // Voc comparison per string
  const measuredVoc = asBuilt.measuredVoc || [];
  (stringPlan.strings || []).forEach((s, i) => {
    const measured = measuredVoc[i];
    if (measured > 0) {
      const diff = Math.abs(measured - s.stringVocCold) / s.stringVocCold;
      if (diff > 0.10) {
        issues.push({ level: "warning", msg: `String ${s.id}: measured Voc ${measured} V differs from expected ${s.stringVocCold} V by ${(diff * 100).toFixed(0)}% — check connections and module integrity.` });
      }
    }
  });

  // Isc comparison
  const measuredIsc = asBuilt.measuredIsc || [];
  (stringPlan.strings || []).forEach((s, i) => {
    const measured = measuredIsc[i];
    if (measured > 0) {
      const diff = Math.abs(measured - s.stringIsc) / s.stringIsc;
      if (diff > 0.15) {
        issues.push({ level: "warning", msg: `String ${s.id}: measured Isc ${measured.toFixed(2)} A differs from expected ${s.stringIsc} A by ${(diff * 100).toFixed(0)}% — check shading, soiling, or faulty module.` });
      }
    }
  });

  // Planned vs actual cable lengths (>25% deviation) — a big miss means the
  // voltage-drop and BoQ assumptions no longer match what was installed.
  if (cableEstimates) {
    [
      ["DC",      cableEstimates.dcM,  asBuilt.actualDcCableLengthM],
      ["AC",      cableEstimates.acM,  asBuilt.actualAcCableLengthM],
      ["Battery", cableEstimates.batM, asBuilt.actualBatteryCableLengthM],
    ].forEach(([label, planned, actual]) => {
      const p = Number(planned) || 0, a = Number(actual) || 0;
      if (p > 0 && a > 0) {
        const diff = Math.abs(a - p) / p;
        if (diff > 0.25) {
          issues.push({ level: "warning", msg: `${label} cable: installed ${a} m vs planned ${p} m (${(diff * 100).toFixed(0)}% off) — re-check voltage drop and update project cable lengths.` });
        }
      }
    });
  }

  if (!asBuilt.monitoringConfigured) {
    issues.push({ level: "warning", msg: "Monitoring not yet configured — complete before handover." });
  }
  if (!asBuilt.clientHandoverCompleted) {
    issues.push({ level: "info", msg: "Client handover not yet completed." });
  }
  if (!asBuilt.actualEarthingContinuityPass) {
    issues.push({ level: "warning", msg: "Earthing continuity test not recorded as passed." });
  }
  if (!asBuilt.actualInsulationResistancePass) {
    issues.push({ level: "warning", msg: "Insulation resistance test not recorded as passed." });
  }

  return issues;
}

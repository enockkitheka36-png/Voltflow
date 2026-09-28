/**
 * multiRoofLayout.js — Solarise Pro v8.5
 * Multi-roof-face capacity and panel distribution logic.
 * Pure functions — no React, no DOM.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function orientationScore(azimuthDeg) {
  // Kenya is near the equator: south-ish and east-ish are both good.
  const d = ((azimuthDeg % 360) + 360) % 360;
  if (d >= 135 && d <= 225) return 100; // South-facing
  if (d >= 45  && d <= 315) return 75;  // East, West, SE, SW, N
  return 50; // North-facing (still OK in Kenya)
}

function conditionScore(condition = "") {
  if (condition === "Good")          return 100;
  if (condition === "Fair")          return 70;
  if (condition === "Weak")          return 20;
  if (condition === "Rusted")        return 20;
  if (condition.includes("asbestos") || condition.toLowerCase().includes("asbestos")) return 0;
  if (condition === "Needs structural repair") return 10;
  return 60;
}

/** Score a roof face 0-100 for PV suitability (higher = better). */
export function getRoofFaceScore(face = {}) {
  const condPts  = conditionScore(face.roofCondition || "Good");
  const azPts    = orientationScore(face.roofAzimuthDeg || 180);
  const areaPts  = Math.min(100, (face.roofLengthM || 0) * (face.roofWidthM || 0) * 2);
  const shadePts = (face.shadingSource || []).some(s => s !== "None") ? 50 : 100;
  return Math.round((condPts * 0.3 + azPts * 0.3 + areaPts * 0.2 + shadePts * 0.2));
}

/** Compute how many panels fit on one roof face (portrait and landscape). */
export function computeFaceCapacity(face = {}, project = {}) {
  if (face.selectedForPv === false || face.selected_for_pv === false) {
    return { maxPanelsPortrait: 0, maxPanelsLandscape: 0, maxPanels: 0, usableAreaM2: 0 };
  }

  const roofLM   = Math.max(face.roofLengthM  || 0, 0);
  const roofWM   = Math.max(face.roofWidthM   || 0, 0);
  const grossM2  = Math.max(Number(face.gross_area_m2 ?? face.grossAreaM2) || roofLM * roofWM, 0);
  const usePct   = face.roofUsablePercent ?? (grossM2 > 0 ? (Number(face.usable_area_m2 ?? face.usableAreaM2) || 0) / grossM2 : 0.70);
  const usableM2 = Math.max(0, Math.min(grossM2, Number(face.usable_area_m2 ?? face.usableAreaM2) || grossM2 * usePct));

  if (usableM2 <= 0) return { maxPanelsPortrait: 0, maxPanelsLandscape: 0, maxPanels: 0, usableAreaM2: 0 };

  const pL     = project.panelLengthM  || 2.28;
  const pW     = project.panelWidthM   || 1.13;
  const sb     = project.roofEdgeSetbackM    || 0.3;
  const wk     = project.roofWalkwayAllowanceM || 0.6;
  const gap    = 0.05;

  const effL   = Math.max(0, roofLM - 2 * sb - wk);
  const effW   = Math.max(0, roofWM - 2 * sb);

  const colsP  = effL > 0 ? Math.floor(effL / (pL + gap)) : 0;
  const rowsP  = effW > 0 ? Math.floor(effW / (pW + gap)) : 0;
  const maxP   = colsP * rowsP;

  const colsL  = effL > 0 ? Math.floor(effL / (pW + gap)) : 0;
  const rowsL  = effW > 0 ? Math.floor(effW / (pL + gap)) : 0;
  const maxL   = colsL * rowsL;
  const maxByArea = Math.floor(usableM2 / Math.max(0.01, pL * pW));

  // Account for face obstructions (each obstruction as % of face area)
  const obstructionFactor = (face.obstructions || []).reduce((acc, ob) => {
    return acc - (ob.wPct / 100) * (ob.hPct / 100);
  }, 1);
  const factor = Math.max(0.1, obstructionFactor);

  const maxPortrait = roofLM > 0 && roofWM > 0 ? Math.floor(maxP * factor) : Math.floor(maxByArea * factor);
  const maxLandscape = roofLM > 0 && roofWM > 0 ? Math.floor(maxL * factor) : Math.floor(maxByArea * factor);
  return {
    maxPanelsPortrait:  Math.min(maxPortrait, maxByArea),
    maxPanelsLandscape: Math.min(maxLandscape, maxByArea),
    maxPanels:          Math.min(Math.max(maxPortrait, maxLandscape), maxByArea),
    usableAreaM2:       +(usableM2 * factor).toFixed(1),
    grossAreaM2:        +grossM2.toFixed(1),
  };
}

// ─── Multi-face distribution ──────────────────────────────────────────────────

/**
 * Distribute required panels across roof faces by priority.
 * Returns per-face allocation and totals.
 */
export function distributeAcrossRoofFaces(roofFaces = [], project = {}, requiredPanels = 0) {
  // Filter to selected faces that are safe
  const eligible = roofFaces
    .filter(f => f.selectedForPv !== false)
    .filter(f => (f.roofCondition || "Good") !== "Asbestos — Do Not Proceed")
    .map(f => ({ ...f, capacity: computeFaceCapacity(f, project), score: getRoofFaceScore(f) }))
    .sort((a, b) => b.score - a.score); // best faces first

  const results = [];
  let remaining = requiredPanels;

  eligible.forEach(face => {
    const avail = face.capacity.maxPanels;
    const allocated = Math.min(avail, remaining);
    remaining -= allocated;
    results.push({
      faceId:    face.id,
      faceName:  face.name,
      score:     face.score,
      capacity:  avail,
      allocated,
      usableAreaM2: face.capacity.usableAreaM2,
      fitStatus: allocated >= avail * 0.8 ? "Fits comfortably"
                 : allocated >= avail     ? "Fits with limited space"
                 : "Partial fit",
      warnings:  computeFaceWarnings(face),
    });
  });

  const totalFitted   = requiredPanels - remaining;
  const totalCapacity = eligible.reduce((s, f) => s + f.capacity.maxPanels, 0);
  const overallFit    = remaining <= 0  ? (totalFitted >= requiredPanels * 0.95 ? "Fits comfortably" : "Fits with limited space")
                      : remaining > 0   ? "Does not fit — additional mounting area needed"
                      : "Fits comfortably";

  return {
    faceResults:    results,
    totalFitted,
    panelsNotFitted: Math.max(0, remaining),
    totalCapacity,
    overallFitStatus: overallFit,
  };
}

/** Per-face warnings based on condition, azimuth, obstructions. */
function computeFaceWarnings(face = {}) {
  const w = [];
  const cond = face.roofCondition || "Good";
  if (cond === "Asbestos — Do Not Proceed") w.push({ level: "danger",  msg: "STOP: Asbestos — do not install." });
  if (cond === "Weak" || cond === "Needs structural repair") w.push({ level: "danger",  msg: "Structural review required before installation." });
  if (cond === "Rusted") w.push({ level: "warning", msg: "Rusted roof — assess sheet/rafter condition." });
  const pitch = face.roofPitchDeg || 15;
  if (pitch > 30) w.push({ level: "warning", msg: `Steep roof (${pitch}°) — fall protection and wind loading review required.` });
  if (pitch < 5)  w.push({ level: "info",    msg: "Near-flat — tilt/ballast structure and row spacing required." });
  const az = face.roofAzimuthDeg || 180;
  if (az >= 45 && az <= 315 && !(az >= 90 && az <= 270)) {
    // north-facing sector
    w.push({ level: "info", msg: "North-facing roof in Kenya — verify yield impact with irradiance data." });
  }
  return w;
}

// ─── Default face factory ────────────────────────────────────────────────────

let faceCounter = 1;

// Fixed (non-id) shape used both to create new faces and to backfill faces
// loaded from older saved projects that predate a given field.
const ROOF_FACE_FIELD_DEFAULTS = {
  roofLengthM:       12,
  roofWidthM:        8,
  roofPitchDeg:      15,
  roofAzimuthDeg:    180,
  roofUsablePercent: 0.70,
  roofType:          "Mabati / Iron sheet",
  roofCondition:     "Good",
  selectedForPv:     true,
  obstructions:      [],
  shadingSource:     [],
  notes:             "",
  label:             "Roof Face",
  azimuth_deg:       180,
  tilt_deg:          15,
  gross_area_m2:     96,
  usable_area_m2:    67.2,
  shading_pct:       0,
  selected_for_pv:  true,
  module_count:      0,
  mppt_assignment:  null,
  photo_ids:         [],
};

export function createDefaultRoofFace(name = "", surveyOverrides = {}) {
  const roofLengthM = surveyOverrides.roofLengthM || ROOF_FACE_FIELD_DEFAULTS.roofLengthM;
  const roofWidthM = surveyOverrides.roofWidthM || ROOF_FACE_FIELD_DEFAULTS.roofWidthM;
  const roofUsablePercent = surveyOverrides.roofUsablePercent || ROOF_FACE_FIELD_DEFAULTS.roofUsablePercent;
  return normalizeRoofFace({
    ...ROOF_FACE_FIELD_DEFAULTS,
    id:               `face_${Date.now()}_${faceCounter++}`,
    name:             name || `Roof Face ${faceCounter}`,
    roofLengthM,
    roofWidthM,
    roofPitchDeg:     surveyOverrides.roofPitch      || ROOF_FACE_FIELD_DEFAULTS.roofPitchDeg,
    roofAzimuthDeg:   surveyOverrides.roofAzimuthDeg || ROOF_FACE_FIELD_DEFAULTS.roofAzimuthDeg,
    roofUsablePercent,
    gross_area_m2: roofLengthM * roofWidthM,
    usable_area_m2: roofLengthM * roofWidthM * roofUsablePercent,
    roofType:         surveyOverrides.roofType        || ROOF_FACE_FIELD_DEFAULTS.roofType,
    roofCondition:    surveyOverrides.roofCondition   || ROOF_FACE_FIELD_DEFAULTS.roofCondition,
  });
}

/**
 * Backfill a roof face loaded from a saved/imported project with any fields
 * missing because the save predates them, and guard array fields against
 * corruption (e.g. a non-array landing where an array is expected).
 */
export function normalizeRoofFace(face = {}) {
  const roofLengthM = Math.max(0, Number(face.roofLengthM) || 0);
  const roofWidthM = Math.max(0, Number(face.roofWidthM) || 0);
  const grossAreaM2 = Math.max(0, Number(face.gross_area_m2 ?? face.grossAreaM2) || roofLengthM * roofWidthM);
  const usablePercent = Math.max(0, Math.min(1, Number(face.roofUsablePercent) || 0.7));
  const usableAreaM2 = Math.max(0, Math.min(grossAreaM2, Number(face.usable_area_m2 ?? face.usableAreaM2) || grossAreaM2 * usablePercent));
  const azimuthDeg = ((Number(face.azimuth_deg ?? face.roofAzimuthDeg) || 0) % 360 + 360) % 360;
  const tiltDeg = Math.max(0, Math.min(90, Number(face.tilt_deg ?? face.roofPitchDeg) || 0));
  const selectedForPv = face.selected_for_pv ?? face.selectedForPv ?? true;
  return {
    ...ROOF_FACE_FIELD_DEFAULTS,
    ...face,
    id:            face.id   || `face_${Date.now()}_${faceCounter++}`,
    name:          face.name || "Roof Face",
    label:         face.label || face.name || "Roof Face",
    roofLengthM,
    roofWidthM,
    roofPitchDeg: tiltDeg,
    roofAzimuthDeg: azimuthDeg,
    roofUsablePercent: grossAreaM2 > 0 ? usableAreaM2 / grossAreaM2 : usablePercent,
    selectedForPv: !!selectedForPv,
    azimuth_deg: azimuthDeg,
    tilt_deg: tiltDeg,
    gross_area_m2: grossAreaM2,
    usable_area_m2: usableAreaM2,
    shading_pct: Math.max(0, Math.min(100, Number(face.shading_pct ?? face.shadingPct) || 0)),
    selected_for_pv: !!selectedForPv,
    module_count: Math.max(0, Math.round(Number(face.module_count ?? face.moduleCount) || 0)),
    mppt_assignment: face.mppt_assignment ?? face.mpptAssignment ?? null,
    obstructions:  Array.isArray(face.obstructions)  ? face.obstructions  : [],
    shadingSource: Array.isArray(face.shadingSource) ? face.shadingSource : [],
    photo_ids: Array.isArray(face.photo_ids ?? face.photoIds) ? [...(face.photo_ids ?? face.photoIds)] : [],
  };
}

export function validateRoofFaces(faces = [], project = {}) {
  const errors = [];
  (Array.isArray(faces) ? faces : []).forEach((raw, index) => {
    const face = normalizeRoofFace(raw);
    const problems = [];
    const inputAzimuth = Number(raw.azimuth_deg ?? raw.roofAzimuthDeg);
    const inputTilt = Number(raw.tilt_deg ?? raw.roofPitchDeg);
    if (!Number.isFinite(inputAzimuth) || inputAzimuth < 0 || inputAzimuth >= 360) problems.push("Azimuth must be at least 0 and below 360 degrees");
    if (!Number.isFinite(inputTilt) || inputTilt < 0 || inputTilt > 90) problems.push("Tilt must be between 0 and 90 degrees");
    if (Number(raw.usable_area_m2 ?? raw.usableAreaM2) > Number(raw.gross_area_m2 ?? raw.grossAreaM2)) problems.push("Usable area cannot exceed gross area");
    const moduleArea = Math.max(0, Number(project.panelLengthM) || 0) * Math.max(0, Number(project.panelWidthM) || 0) * face.module_count;
    if (moduleArea > face.usable_area_m2 + 1e-9) problems.push("Module occupied area exceeds usable roof area");
    if (problems.length > 0) errors.push({ id: face.id, index, label: face.label, problems });
  });
  return errors;
}

export function summarizeRoofFaces(faces = [], project = {}) {
  const normalized = (Array.isArray(faces) ? faces : []).map(normalizeRoofFace);
  const selected = normalized.filter((face) => face.selected_for_pv);
  return {
    roof_faces: normalized,
    total_usable_area_m2: +selected.reduce((sum, face) => sum + face.usable_area_m2, 0).toFixed(2),
    selected_faces: selected.length,
    maximum_modules: selected.reduce((sum, face) => sum + computeFaceCapacity(face, project).maxPanels, 0),
    design_revision_required: true,
    validation_errors: validateRoofFaces(normalized, project),
  };
}

/** Build initial roofFaces from survey/project data (called when faces array is empty). */
export function initRoofFacesFromSurvey(survey = {}, project = {}) {
  return [createDefaultRoofFace("Main roof", {
    roofLengthM:       survey.roofLengthM  || project.blueprintRoofLengthM || 12,
    roofWidthM:        survey.roofWidthM   || project.blueprintRoofWidthM  || 8,
    roofPitch:         survey.roofPitch    || project.blueprintRoofPitchDeg || 15,
    roofAzimuthDeg:    survey.roofAzimuthDeg || 180,
    roofUsablePercent: survey.roofUsablePercent || project.roofUsablePercent || 0.70,
    roofType:          survey.roofType      || "Mabati / Iron sheet",
    roofCondition:     survey.roofCondition || "Good",
  })];
}

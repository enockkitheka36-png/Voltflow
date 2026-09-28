/**
 * roofGeometry.js — Solarise Pro v8.3
 * Roof geometry calculations, panel layout estimator, tilt/pitch guidance,
 * row-spacing advisory, and installer technical tips.
 *
 * All functions are pure (no React state). They receive survey/project objects
 * and return plain result objects.
 *
 * IMPORTANT DISCLAIMER embedded in every output:
 * "Roof layout is a planning estimate. Final design must be verified on-site by
 *  qualified personnel including structural, wind-load, waterproofing and
 *  earthing checks."
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const CONSERVATIVE_SUN_ELEVATION_DEG = 35; // Kenya planning default
const DEG = Math.PI / 180;

// ─── Haversine & bearing helpers ─────────────────────────────────────────────

/** Distance between two GPS coords in metres (haversine). */
export function haversineDistanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * DEG, φ2 = lat2 * DEG;
  const Δφ = (lat2 - lat1) * DEG, Δλ = (lon2 - lon1) * DEG;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Compass bearing (degrees) from point 1 to point 2. */
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * DEG, φ2 = lat2 * DEG;
  const Δλ = (lon2 - lon1) * DEG;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

/** Approximate polygon area in m² from an array of {lat, lng} vertices
 *  using a flat-earth approximation (accurate enough for rooftop scale). */
export function polygonAreaM2(corners) {
  const valid = corners.filter(c => c && Number.isFinite(c.lat) && Number.isFinite(c.lng));
  if (valid.length < 3) return 0;
  // Convert to local Cartesian (metres) relative to first point
  const ref = valid[0];
  const pts = valid.map(c => ({
    x: haversineDistanceM(ref.lat, ref.lng, ref.lat, c.lng) * (c.lng >= ref.lng ? 1 : -1),
    y: haversineDistanceM(ref.lat, ref.lng, c.lat, ref.lng) * (c.lat >= ref.lat ? 1 : -1),
  }));
  // Shoelace formula
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area / 2);
}

/** Orientation label from azimuth degrees */
export function azimuthToLabel(deg) {
  const d = ((deg % 360) + 360) % 360;
  if (d < 22.5 || d >= 337.5) return "North";
  if (d < 67.5) return "North-East";
  if (d < 112.5) return "East";
  if (d < 157.5) return "South-East";
  if (d < 202.5) return "South";
  if (d < 247.5) return "South-West";
  if (d < 292.5) return "West";
  return "North-West";
}

// ─── PHASE B ─ calculateRoofGeometry ─────────────────────────────────────────

/**
 * Returns roof geometry estimates from survey & project inputs.
 * @param {object} survey  Current survey state
 * @param {object} project Current project state
 * @returns {RoofGeometry}
 */
export function calculateRoofGeometry(survey = {}, project = {}) {
  const warnings = [];
  let roofAreaGrossM2     = 0;
  let roofAreaUsableM2    = 0;
  let roofLengthEstimatedM = survey.roofLengthM || 0;
  let roofWidthEstimatedM  = survey.roofWidthM  || 0;
  let roofAzimuthEstimatedDeg = survey.roofAzimuthDeg || orientationLabelToAzimuth(survey.orientation);
  let roofPitchDeg        = survey.roofPitch || project.blueprintRoofPitchDeg || 15;
  let roofCaptureConfidence = "low";

  const usablePct = survey.roofUsablePercent ?? project.roofUsablePercent ?? 0.70;
  const inputMode = survey.roofInputMode || "manual_dimensions";

  // ── GPS coordinates ────────────────────────────────────────────────────────
  if (inputMode === "gps_coordinates") {
    const corners = [survey.gpsCornerA, survey.gpsCornerB, survey.gpsCornerC, survey.gpsCornerD]
      .filter(c => c && Number.isFinite(c.lat) && Number.isFinite(c.lng));

    if (corners.length >= 3) {
      roofAreaGrossM2 = polygonAreaM2(corners);
      roofAreaUsableM2 = roofAreaGrossM2 * usablePct;

      // Estimate length/width from longest and perpendicular edge
      const edgeLengths = corners.map((c, i) => {
        const next = corners[(i + 1) % corners.length];
        return haversineDistanceM(c.lat, c.lng, next.lat, next.lng);
      });
      const maxEdge = Math.max(...edgeLengths);
      const maxIdx  = edgeLengths.indexOf(maxEdge);
      roofLengthEstimatedM = maxEdge;
      roofWidthEstimatedM  = roofAreaGrossM2 / Math.max(maxEdge, 0.1);

      // Azimuth from longest edge
      const a = corners[maxIdx], b = corners[(maxIdx + 1) % corners.length];
      roofAzimuthEstimatedDeg = bearingDeg(a.lat, a.lng, b.lat, b.lng);
      roofCaptureConfidence = "medium";

      warnings.push("GPS/satellite measurements are approximate. Confirm roof dimensions physically before final BoQ and installation.");
    } else {
      warnings.push("Fewer than 3 valid GPS corners provided. Falling back to manual dimensions.");
      roofAreaGrossM2 = (survey.roofLengthM || 0) * (survey.roofWidthM || 0);
      roofAreaUsableM2 = roofAreaGrossM2 * usablePct;
    }
  }

  // ── Blueprint dimensions ───────────────────────────────────────────────────
  else if (inputMode === "blueprint_dimensions") {
    const scale = survey.blueprintScaleFactor || project.blueprintScaleFactor || 1;
    const bLen  = (survey.blueprintRoofLengthM  || project.blueprintRoofLengthM  || 0) * scale;
    const bWid  = (survey.blueprintRoofWidthM   || project.blueprintRoofWidthM   || 0) * scale;
    const obstr = survey.blueprintObstructionPct ?? 0.15;
    roofLengthEstimatedM = bLen;
    roofWidthEstimatedM  = bWid;
    roofAreaGrossM2  = bLen * bWid;
    roofAreaUsableM2 = roofAreaGrossM2 * (1 - obstr) * usablePct;
    roofAzimuthEstimatedDeg = survey.blueprintOrientationDeg ?? project.blueprintRoofOrientationDeg ?? 180;
    roofPitchDeg = survey.blueprintPitchDeg ?? project.blueprintRoofPitchDeg ?? 15;
    roofCaptureConfidence = project.roofDrawingConfidence || "estimated";
    warnings.push("Blueprint dimensions are indicative until confirmed on-site with physical measurements.");
  }

  // ── Satellite estimate ─────────────────────────────────────────────────────
  else if (inputMode === "satellite_estimate") {
    roofAreaGrossM2 = (survey.roofLengthM || 0) * (survey.roofWidthM || 0);
    roofAreaUsableM2 = roofAreaGrossM2 * usablePct;
    roofCaptureConfidence = "low";
    warnings.push("Satellite estimates must be verified on site. Do not use for final BoQ or structural design.");
  }

  // ── Manual dimensions (default) ───────────────────────────────────────────
  else {
    roofAreaGrossM2  = (survey.roofLengthM || 0) * (survey.roofWidthM || 0);
    roofAreaUsableM2 = (survey.roofAreaM2 > 0) ? survey.roofAreaM2 : roofAreaGrossM2 * usablePct;
    roofCaptureConfidence = "medium";
  }

  // ── Condition warnings ────────────────────────────────────────────────────
  if (survey.roofCondition === "Weak" || survey.roofCondition === "Needs structural repair") {
    warnings.push("Engineer/structural review required before installation.");
  }
  if (survey.roofCondition === "Rusted") {
    warnings.push("Rusted roof requires assessment. Replace sheets or use alternative mounting before installing panels.");
  }
  if (survey.roofType === "Asbestos — Do Not Proceed") {
    warnings.push("STOP: Do not proceed. Licensed asbestos handling and removal required before any installation.");
  }
  if (roofPitchDeg > 30) {
    warnings.push(`Steep roof (${roofPitchDeg}°). Installer safety review, wind loading check, and harness/anchor points required.`);
  }
  if (roofPitchDeg < 5) {
    warnings.push("Near-flat roof. Tilt structure required for panel self-cleaning and rain runoff. Include row spacing for shade clearance.");
  }
  if (!survey.orientation && roofAzimuthEstimatedDeg === 0) {
    warnings.push("Roof orientation not confirmed. Use compass app or site survey before final design.");
  }
  if (survey.shadingSources && survey.shadingSources.length > 0 && !survey.shadingSources.includes("None")) {
    warnings.push("Shading detected. Consider MPPT optimisers, alternative roof face, or ground/carport mount.");
  }

  const roofOrientationLabel = azimuthToLabel(roofAzimuthEstimatedDeg);

  return {
    roofAreaGrossM2,
    roofAreaUsableM2,
    roofLengthEstimatedM,
    roofWidthEstimatedM,
    roofAzimuthEstimatedDeg,
    roofPitchDeg,
    roofOrientationLabel,
    roofCaptureConfidence,
    usablePct,
    roofWarnings: warnings,
  };
}

// ─── PHASE C ─ estimatePanelLayout ───────────────────────────────────────────

/**
 * Estimates how many panels fit on the roof and whether the required count fits.
 * @param {object} project      Current project state
 * @param {object} sizing       Output from useSizing
 * @param {object} roofGeometry Output from calculateRoofGeometry
 */
export function estimatePanelLayout(project = {}, sizing = {}, roofGeometry = {}) {
  const warnings = [];

  const panelLen  = project.panelLengthM  || 2.28;
  const panelWid  = project.panelWidthM   || 1.13;
  const setback   = project.roofEdgeSetbackM    || 0.3;
  const walkway   = project.roofWalkwayAllowanceM || 0.6;
  const orientation = project.mountingOrientation || "auto";

  const rLen = Math.max(0, (roofGeometry.roofLengthEstimatedM || 0) - 2 * setback - walkway);
  const rWid = Math.max(0, (roofGeometry.roofWidthEstimatedM  || 0) - 2 * setback);

  // Portrait: length along roof length axis
  const panelsPortraitLong  = rLen > 0 ? Math.floor(rLen / panelLen) : 0;
  const panelsPortraitShort = rWid > 0 ? Math.floor(rWid / panelWid) : 0;
  const maxPanelsPortrait   = panelsPortraitLong * panelsPortraitShort;

  // Landscape: width along roof length axis
  const panelsLandscapeLong  = rLen > 0 ? Math.floor(rLen / panelWid) : 0;
  const panelsLandscapeShort = rWid > 0 ? Math.floor(rWid / panelLen) : 0;
  const maxPanelsLandscape   = panelsLandscapeLong * panelsLandscapeShort;

  // Area-based fallback (when length/width unknown)
  const usableAreaM2     = roofGeometry.roofAreaUsableM2 || 0;
  const panelAreaM2      = panelLen * panelWid;
  const maxPanelsArea    = panelAreaM2 > 0 ? Math.floor(usableAreaM2 / panelAreaM2) : 0;

  let recommendedPanelOrientation = "portrait";
  let estimatedPanelsThatFit      = maxPanelsPortrait;

  if (orientation === "landscape") {
    recommendedPanelOrientation = "landscape";
    estimatedPanelsThatFit      = maxPanelsLandscape;
  } else if (orientation === "auto") {
    if (maxPanelsLandscape > maxPanelsPortrait) {
      recommendedPanelOrientation = "landscape";
      estimatedPanelsThatFit      = maxPanelsLandscape;
    } else {
      estimatedPanelsThatFit = maxPanelsPortrait;
    }
  }

  // If geometry-based count is 0 (no valid length/width), fall back to area
  if (estimatedPanelsThatFit === 0 && maxPanelsArea > 0) {
    estimatedPanelsThatFit = maxPanelsArea;
    warnings.push("Using area-based panel count (roof length/width not available). Physical layout verification required.");
  }

  const requiredPanels = sizing.panels || 0;
  const utilisation    = estimatedPanelsThatFit > 0
    ? Math.min(requiredPanels / estimatedPanelsThatFit, 1)
    : 0;

  let roofFitStatus;
  if (estimatedPanelsThatFit <= 0) {
    roofFitStatus = "Roof dimensions not confirmed — enter measurements to check fit";
  } else if (requiredPanels <= estimatedPanelsThatFit * 0.8) {
    roofFitStatus = "Fits comfortably";
  } else if (requiredPanels <= estimatedPanelsThatFit) {
    roofFitStatus = "Fits with limited space";
  } else {
    roofFitStatus = "Does not fit — reduce system size or consider alternative roof face / ground mount";
    warnings.push(
      `Required ${requiredPanels} panels exceeds estimated roof capacity of ${estimatedPanelsThatFit}. ` +
      "Consider split-array, second roof face, carport, or ground mount."
    );
  }

  if (roofGeometry.roofAreaUsableM2 > 0 && requiredPanels * panelAreaM2 > roofGeometry.roofAreaUsableM2) {
    warnings.push(`Required panel area (~${(requiredPanels * panelAreaM2).toFixed(1)} m²) exceeds usable roof area (${roofGeometry.roofAreaUsableM2.toFixed(1)} m²).`);
  }

  warnings.push(
    "Panel layout is a planning estimate. Final layout must account for ridges, hips, gutters, water tanks, " +
    "chimneys, skylights, purlin positions, access paths, and wind uplift."
  );

  // v10 — panels-per-row / number-of-rows for the recommended orientation,
  // additive fields reused by accessoryEngine.js for mounting BOM math
  // (rails/clamps/L-feet) so that calculation isn't re-derived a third time
  // alongside this function and RoofCanvas's own pixel grid.
  const panelsPerRow  = recommendedPanelOrientation === "landscape" ? panelsLandscapeLong  : panelsPortraitLong;
  const numberOfRows  = recommendedPanelOrientation === "landscape" ? panelsLandscapeShort : panelsPortraitShort;

  return {
    maxPanelsPortrait,
    maxPanelsLandscape,
    maxPanelsArea,
    recommendedPanelOrientation,
    estimatedPanelsThatFit,
    requiredPanels,
    roofFitStatus,
    roofUtilisationPercent: utilisation * 100,
    panelLayoutWarnings: warnings,
    panelsPerRow,
    numberOfRows,
  };
}

// ─── PHASE D ─ recommendPanelTiltAndOrientation ──────────────────────────────

/** Kenya-specific tilt/orientation guidance */
export function recommendPanelTiltAndOrientation(project = {}, survey = {}, roofGeometry = {}) {
  const pitch   = roofGeometry.roofPitchDeg ?? survey.roofPitch ?? 15;
  const azimuth = roofGeometry.roofAzimuthEstimatedDeg ?? 180;
  const orient  = roofGeometry.roofOrientationLabel || "South";

  let recommendedTiltDeg  = pitch;
  let tiltReason          = "";
  let azimuthComment      = "";
  let pitchAdjustmentAdvice = "";
  let shadingRiskAdvice   = "";

  // Tilt guidance
  if (pitch < 5) {
    recommendedTiltDeg = 10;
    tiltReason = "Near-flat roof. Use tilted ballast/tilt structure at 10–15° for self-cleaning, rain runoff, and optimal yield.";
    pitchAdjustmentAdvice = "Add ballast tilt frame and include row-spacing calculation to avoid inter-row shading.";
  } else if (pitch >= 5 && pitch <= 25) {
    recommendedTiltDeg = pitch;
    tiltReason = `Follow existing roof pitch of ${pitch}° — suitable for flush/in-roof mounting if roof structure and orientation are good.`;
    pitchAdjustmentAdvice = "Flush mounting on existing roof pitch is standard for Kenya. Confirm purlin/rafter positions.";
  } else if (pitch > 25 && pitch <= 40) {
    recommendedTiltDeg = pitch;
    tiltReason = `Steep roof (${pitch}°). Flush mounting possible but requires full wind-load and structural check.`;
    pitchAdjustmentAdvice = "Ensure clamp spacing meets IEC 62548 for wind uplift at this pitch. Installer harness and anchor points required.";
  } else {
    recommendedTiltDeg = pitch;
    tiltReason = `Very steep roof (${pitch}°). Installation is high-risk. Specialist installer and full structural/wind review required.`;
    pitchAdjustmentAdvice = "Do not proceed without licensed structural engineer sign-off.";
  }

  // Azimuth / orientation guidance for Kenya
  const isSouthish = azimuth >= 135 && azimuth <= 225;
  const isNorthFacing = azimuth >= 315 || azimuth <= 45;
  const isEastWest = !isSouthish && !isNorthFacing;

  if (isSouthish) {
    azimuthComment = `${orient}-facing roof (${azimuth.toFixed(0)}°) — good orientation for Kenya solar yield. No correction needed.`;
  } else if (isNorthFacing) {
    azimuthComment = `${orient}-facing roof. Kenya is near equator — north-facing roofs can also perform well. Verify with site-specific irradiance tool.`;
  } else if (isEastWest) {
    azimuthComment = `${orient}-facing roof (${azimuth.toFixed(0)}°). East or west faces give ~10–20% less yield vs south. ` +
      "Consider split East/West array or alternative mounting if south face is available.";
    pitchAdjustmentAdvice += " East/West orientation may benefit from lower tilt (5–10°) to improve morning/afternoon capture.";
  } else {
    azimuthComment = "Roof orientation not confirmed. Confirm with compass reading before finalising design.";
  }

  // Shading advisory
  const shadingSources = (survey.shadingSources || []).filter(s => s !== "None");
  if (shadingSources.length > 0) {
    shadingRiskAdvice = `Shading from ${shadingSources.join(", ")} detected. Run shading analysis or use MPPT string/module optimisers. ` +
      "Shade on even one cell reduces the full string output without optimisers.";
  } else {
    shadingRiskAdvice = "No shading sources reported. Confirm with site visit — trees/structures not visible on survey may cast shadows.";
  }

  return {
    recommendedTiltDeg,
    tiltReason,
    azimuthComment,
    pitchAdjustmentAdvice,
    shadingRiskAdvice,
  };
}

// ─── PHASE E ─ estimateRowSpacing ────────────────────────────────────────────

/**
 * Approximate row spacing for tilted panels to avoid inter-row shading.
 * Uses conservative 35° sun elevation for Kenya planning.
 */
export function estimateRowSpacing(panelLengthM = 2.28, tiltDeg = 15, sunElevationDeg = CONSERVATIVE_SUN_ELEVATION_DEG) {
  const t = tiltDeg * DEG;
  const e = Math.max(sunElevationDeg, 5) * DEG; // prevent division by zero
  const shadowLength = panelLengthM * Math.sin(t) / Math.tan(e);
  const approximateRowSpacingM = panelLengthM * Math.cos(t) + shadowLength;

  return {
    shadowLengthM: +shadowLength.toFixed(2),
    approximateRowSpacingM: +approximateRowSpacingM.toFixed(2),
    rowSpacingWarning:
      "Approximate row spacing is for early layout planning only. " +
      "Final row spacing must be confirmed with site-specific solar path and shading analysis (e.g. SolarEdge, PVsyst, or Helioscope).",
  };
}

// ─── PHASE F ─ getInstallerTips ──────────────────────────────────────────────

/** Returns an array of installer tip strings relevant to the survey data. */
export function getInstallerTips(survey = {}, project = {}) {
  const tips = [];
  const rt = survey.roofType || "";

  // ── Roof-type-specific tips ────────────────────────────────────────────────
  if (rt.includes("Mabati") || rt.includes("Iron")) {
    tips.push(...[
      "Confirm purlin positions before drilling — fix only to structural members, not thin sheet.",
      "Use correct roof hooks or L-feet with EPDM/rubber washers for watertight penetrations.",
      "Maintain water flow direction — keep rails above waterline and seal all penetrations.",
      "Avoid mounting on visibly corroded sheet. Replace affected sections before installation.",
      "Bond rails and mounting frames to the main earthing system (IEC 60364-7-712).",
    ]);
  }
  if (rt.includes("Concrete") || rt.includes("slab")) {
    tips.push(...[
      "Confirm waterproofing membrane is intact before drilling; repair/re-seal all penetrations.",
      "Use chemical anchors or through-bolt where structurally approved — not just surface adhesive.",
      "Check wind uplift load at slab edges; use ballast-framed mounts if anchor drilling is restricted.",
      "Allow drainage path — do not create dam behind array that could pool water against the parapet.",
    ]);
  }
  if (rt.includes("Clay") || rt.includes("tile") || rt.includes("Tile")) {
    tips.push(...[
      "Use tile hooks designed for the specific tile profile — do not cut or crack tiles.",
      "Keep a stock of matching spare tiles available before installation day.",
      "Waterproof all roof hook penetrations with compatible flashing and sealant.",
    ]);
  }
  if (rt.includes("Ground")) {
    tips.push(...[
      "Confirm soil bearing capacity and drainage before setting ground screw or concrete piers.",
      "Include security fencing if site is accessible to the public or livestock.",
      "Confirm shading from structures, vegetation and the array itself at all sun angles.",
      "Protect cable trenches from water ingress and physical damage.",
    ]);
  }
  if (rt.includes("Carport")) {
    tips.push(...[
      "Confirm structural steel capacity for dead load (panels + frame) plus wind uplift.",
      "Include guttering or drainage direction — rainwater run-off from panels must be managed.",
      "Allow vehicle height clearance and maintenance access beneath the canopy.",
    ]);
  }

  // ── General tips (always included) ────────────────────────────────────────
  tips.push(...[
    "Keep DC cable runs as short as practicable — minimise voltage drop and losses.",
    "Separate AC and DC cable routes (minimum 50 mm or separate conduit) per IEC 60364-7-712.",
    "Label all strings, disconnects and combiner boxes clearly.",
    "Avoid sharp cable bends below minimum bend radius — use cable saddles and trunking.",
    "Use UV-rated cable ties and conduit for all outdoor/roof cable routes.",
    "Maintain clear service access (≥600 mm) around inverter, battery, and DC isolators.",
    "Never install battery bank in direct sunlight or a damp unventilated space.",
    "Confirm Wi-Fi or SIM signal at inverter/monitoring location before commissioning.",
    "Take timestamped before, during, and after photos for warranty and as-built records.",
    "Record open-circuit Voc and short-circuit Isc per string before connecting to inverter.",
    "Prepare as-built Single Line Diagram (SLD) for handover to client and KPLC submission.",
  ]);

  // ── Condition-specific additions ──────────────────────────────────────────
  if (!survey.earthingAvailable) {
    tips.push("No earthing confirmed — install earthing electrode system before energising. Required for IEC 62548 and EPRA compliance.");
  }
  if (survey.dbCondition === "Needs upgrade") {
    tips.push("DB upgrade required — coordinate with licensed electrician before solar integration.");
  }
  if (survey.wiringCondition && survey.wiringCondition !== "Good") {
    tips.push(`Wiring condition reported as "${survey.wiringCondition}" — address wiring defects before commissioning.`);
  }
  if (project.systemType === "Solar PV – Hybrid" || project.systemType === "Genset hybrid") {
    tips.push("Grid-tied/genset-hybrid system: confirm KPLC/EPRA anti-islanding protection is certified and obtain Generation Licence or EPRA Exemption before energising.");
  }
  if (project.batteryChemistry === "VRLA" || project.batteryChemistry === "FLOODED") {
    tips.push("Lead-acid batteries: install in ventilated enclosure per IEC 62485-2. Hydrogen gas is explosive — no naked flames near the battery room.");
  }

  return tips;
}

// ─── PHASE G ─ getRoofWarnings (standalone for re-use) ───────────────────────

/** Critical installation warnings separate from the full geometry output. */
export function getRoofInstallationWarnings(survey = {}, roofGeometry = {}, panelLayout = {}) {
  const warnings = [];

  if ((survey.roofCondition === "Weak" || survey.roofCondition === "Needs structural repair")) {
    warnings.push({ level: "danger", msg: "Engineer/structural review required before any installation." });
  }
  if (survey.roofType === "Asbestos — Do Not Proceed") {
    warnings.push({ level: "danger", msg: "STOP: Do not proceed. Licensed asbestos handling required." });
  }
  if (roofGeometry.roofPitchDeg > 30) {
    warnings.push({ level: "warning", msg: `Steep roof (${roofGeometry.roofPitchDeg}°) — installer safety, wind loading, and harness/anchor review required.` });
  }
  if (roofGeometry.roofPitchDeg < 5 && roofGeometry.roofPitchDeg > 0) {
    warnings.push({ level: "info", msg: "Near-flat roof — tilt/ballast structure and row-spacing design required." });
  }
  if (
    panelLayout.roofFitStatus &&
    panelLayout.roofFitStatus.startsWith("Does not fit")
  ) {
    warnings.push({ level: "danger", msg: panelLayout.roofFitStatus });
  }
  if (
    roofGeometry.roofAreaUsableM2 > 0 &&
    panelLayout.requiredPanels > 0 &&
    panelLayout.estimatedPanelsThatFit > 0 &&
    panelLayout.requiredPanels > panelLayout.estimatedPanelsThatFit
  ) {
    warnings.push({ level: "warning", msg: `Roof area may be insufficient — ${panelLayout.requiredPanels} panels required, ~${panelLayout.estimatedPanelsThatFit} estimated to fit.` });
  }
  const activeShadingSources = (survey.shadingSources || []).filter(s => s !== "None");
  if (activeShadingSources.length > 0) {
    warnings.push({ level: "info", msg: `Shading from ${activeShadingSources.join(", ")} — consider optimisers or alternative mounting.` });
  }

  return warnings;
}

// ─── PHASE I ─ Blueprint new-build construction-stage advice ─────────────────

export function getBlueprintConstructionAdvice() {
  return [
    "Reserve prime south-facing roof zones for PV before finalising roof plan — avoid placing HVAC units, water tanks, satellite dishes or vents in the solar zone.",
    "Install cable sleeves/conduits from roof to DB room during construction — much cheaper than cutting channels after plastering.",
    "Reserve a dedicated inverter/battery room: dry, ventilated, cool, and accessible. Minimum 2 m² for a residential hybrid system.",
    "Provide earthing electrode provision (earth rod or ring) during ground works — avoid retrofitting in hard ground.",
    "Allow for an additional 4–6-way DB space for solar integration breakers alongside main DB during electrical rough-in.",
    "Consider a future EV charger cable route (32A dedicated circuit) from DB to garage/parking during first-fix wiring.",
    "Ensure battery room ventilation complies with IEC 62485-2 if lead-acid batteries are anticipated, or provide at least one vent for LFP systems.",
    "Confirm roof structural design includes the panel/mounting dead load (typically 15–25 kg/m²) plus wind uplift with the structural engineer before roofing completion.",
    "Mark and protect cable route zones to prevent future drilling through conduits by trades.",
    "Brief site architect and M&E consultant on solar/storage integration requirements at design-freeze stage.",
  ];
}

// ─── Utility ─ orientation label → azimuth ───────────────────────────────────

function orientationLabelToAzimuth(label = "") {
  const map = {
    "North": 0, "North-East": 45, "East": 90, "South-East": 135,
    "South": 180, "South-West": 225, "West": 270, "North-West": 315,
  };
  return map[label] ?? 180;
}

/**
 * installerSimulation.js — Solarise Pro v8.4
 * Pure helper functions for the Installer Simulation Studio.
 * No React dependencies — all functions take plain objects and return plain objects.
 *
 * DISCLAIMER embedded in outputs:
 * "This simulation is a technician planning guide only. Final installation layout,
 *  structural assessment, wind loading, waterproofing, cable ampacity, earthing
 *  and safe-work methods must be verified on site by qualified personnel."
 */

// ─── Installation sequence steps ─────────────────────────────────────────────

export function getInstallationSteps() {
  return [
    { id: 1,  label: "Confirm roof condition, structural suitability and access safety" },
    { id: 2,  label: "Mark panel layout and string zones on roof" },
    { id: 3,  label: "Confirm purlin / rafter fixing points (probe or drawings)" },
    { id: 4,  label: "Install mounting rails and clamps with correct fixings" },
    { id: 5,  label: "Bond rails and panel frames to earthing system" },
    { id: 6,  label: "Mount PV modules and torque to manufacturer specification" },
    { id: 7,  label: "Route and secure DC string cables (separate from AC route)" },
    { id: 8,  label: "Install DC isolators, string fuses / combiner and SPD (Type II)" },
    { id: 9,  label: "Mount inverter (dry, ventilated, shaded, near DB)" },
    { id: 10, label: "Mount battery rack and modules; connect BMS comms cable" },
    { id: 11, label: "Connect AC side to changeover switch / DB as per approved SLD" },
    { id: 12, label: "Configure inverter settings (grid type, battery chemistry, limits)" },
    { id: 13, label: "Measure and record open-circuit Voc per string (before connecting)" },
    { id: 14, label: "Measure and record short-circuit Isc per string" },
    { id: 15, label: "Test DC insulation resistance (>1 MΩ per IEC 62446)" },
    { id: 16, label: "Test earth continuity on all metalwork" },
    { id: 17, label: "Start inverter and confirm normal operation" },
    { id: 18, label: "Configure remote monitoring (Wi-Fi / SIM) and verify data" },
    { id: 19, label: "Client handover: demonstrate app, take final photos, sign off as-built SLD" },
  ];
}

// ─── Inverter placement advisory ─────────────────────────────────────────────

export function getInverterAdvice(simulation = {}, project = {}, sizing = {}) {
  const advice = [];
  const loc = simulation.inverterLocation || "indoor_utility";
  const acRouteM = simulation.acRouteCustomM > 0 ? simulation.acRouteCustomM : estimateAcRouteM(simulation);
  const dcRouteM = simulation.dcRouteCustomM > 0 ? simulation.dcRouteCustomM : estimateDcRouteM(simulation);

  // Good practice notes
  advice.push({ level: "info", msg: "Mount inverter in a dry, ventilated location, shaded from direct sun, within 3 m of the DB where practical." });
  advice.push({ level: "info", msg: "Ensure ≥600 mm clearance on all sides for maintenance access and ventilation." });
  advice.push({ level: "info", msg: "Confirm Wi-Fi or SIM signal at the proposed inverter location for remote monitoring." });

  // Location-specific warnings
  if (loc === "outside_shaded") {
    advice.push({ level: "warning", msg: "Outdoor installation: confirm inverter IP rating (minimum IP65 for protected outdoor). Provide rain/drip shield and ensure not in direct sun." });
  }
  if (loc === "outside_unshaded") {
    advice.push({ level: "danger", msg: "Direct outdoor sun exposure will raise internal temperature, reduce efficiency, and void some manufacturer warranties. Install a sunshade or relocate inverter." });
  }
  if (loc === "garage") {
    advice.push({ level: "info", msg: "Garage installation is generally acceptable — confirm the space is dry, not used for flammable storage, and has adequate ventilation." });
  }
  if (loc === "corridor") {
    advice.push({ level: "info", msg: "Corridor: confirm no condensation risk and no risk of physical damage from passing people or goods." });
  }

  // Distance warnings
  if (acRouteM > 15) {
    advice.push({ level: "warning", msg: `Estimated AC cable route (${acRouteM} m) is long — verify cable size for voltage drop (<3%) and confirm circuit protection rating matches inverter output.` });
  }
  if (dcRouteM > 30) {
    advice.push({ level: "warning", msg: `Estimated DC cable route (${dcRouteM} m) is long — use 6 mm² or larger DC cable, verify <1.5% voltage drop, and separate DC route from AC conductors.` });
  }

  return advice;
}

// ─── Battery placement advisory ──────────────────────────────────────────────

export function getBatteryAdvice(simulation = {}, project = {}) {
  const advice = [];
  const loc     = simulation.batteryLocation || "near_inverter";
  const chem    = project.batteryChemistry   || "LFP";
  const batRouteM = simulation.batteryRouteCustomM > 0 ? simulation.batteryRouteCustomM : estimateBatRouteM(simulation);

  // Universal guidance
  advice.push({ level: "info", msg: "Install battery in a dry, cool, ventilated location away from direct sunlight and away from bedroom or living areas where practical." });
  advice.push({ level: "info", msg: "Protect from children and water ingress. Mark with appropriate battery hazard signage." });
  advice.push({ level: "info", msg: "Keep battery cable route short — long battery cables carry high DC current and must be adequately sized and fused." });

  // Location-specific
  if (loc === "outside" || loc === "outside_shaded") {
    advice.push({ level: "warning", msg: "Outdoor battery placement requires manufacturer approval, IP65+ enclosure, rain protection, and thermal management to avoid overtemperature." });
  }
  if (loc === "bedroom") {
    advice.push({ level: "danger", msg: "Battery in bedroom is not recommended — relocate to utility room, garage, or corridor." });
  }
  if (loc === "near_inverter") {
    advice.push({ level: "info", msg: "Near-inverter placement is ideal — minimises battery cable voltage drop and makes BMS comms cable routing simpler." });
  }

  // Chemistry-specific
  if (chem === "VRLA" || chem === "FLOODED") {
    advice.push({ level: "danger", msg: "Lead-acid batteries produce hydrogen gas during charging. MANDATORY: install in IEC 62485-2 compliant ventilated enclosure. No naked flames or sparks near battery area." });
    advice.push({ level: "warning", msg: "Provide acid-containment tray under flooded batteries. Electrolyte spill is corrosive." });
  }
  if (chem === "LFP" || chem === "NMC") {
    advice.push({ level: "info", msg: "Lithium battery: maintain manufacturer-specified spacing for thermal management. Place BMS communication cable between battery modules and inverter per manufacturer requirements." });
    advice.push({ level: "warning", msg: "Locate lithium battery away from flammable materials. In the event of thermal runaway, the BMS must be able to disconnect the battery from the system." });
  }

  // Distance
  if (batRouteM > 5) {
    advice.push({ level: "warning", msg: `Estimated battery cable route (${batRouteM} m) — use adequately rated DC cable (consult manufacturer), include DC fuse/breaker on positive lead, and follow IEC 62534 where applicable.` });
  }

  return advice;
}

// ─── Cable route estimates ────────────────────────────────────────────────────

export function getCableEstimates(simulation = {}, project = {}, roofGeometry = {}) {
  const dcM  = simulation.dcRouteCustomM  > 0 ? simulation.dcRouteCustomM  : estimateDcRouteM(simulation, roofGeometry);
  const acM  = simulation.acRouteCustomM  > 0 ? simulation.acRouteCustomM  : estimateAcRouteM(simulation);
  const batM = simulation.batteryRouteCustomM > 0 ? simulation.batteryRouteCustomM : estimateBatRouteM(simulation);

  const warnings = [];

  if (dcM > 30)  warnings.push({ level: "warning", msg: `DC route (${dcM} m): use 6 mm² minimum, label strings, route in UV-rated conduit outdoors.` });
  if (acM > 15)  warnings.push({ level: "warning", msg: `AC route (${acM} m): verify conductor size against inverter output and check voltage drop <3%.` });
  if (batM > 5)  warnings.push({ level: "warning", msg: `Battery cable (${batM} m): short is always better — re-evaluate inverter/battery positions if >5 m.` });

  warnings.push({ level: "info", msg: "Keep DC and AC routes physically separated by ≥50 mm or use separate conduits (IEC 60364-7-712)." });
  warnings.push({ level: "info", msg: "Use UV-stabilised conduit or trunking for all outdoor cable sections." });
  warnings.push({ level: "info", msg: "Avoid sharp cable bends below minimum bend radius. Use cable saddles and trunking, not loose ties on roof sheets." });
  warnings.push({ level: "info", msg: "Form drip-loops at cable roof penetrations to prevent water tracking into the building." });
  warnings.push({ level: "info", msg: "Waterproof all roof penetrations with appropriate flashing and sealant on installation day." });

  return { dcM, acM, batM, warnings };
}

// ─── Simulation warnings ─────────────────────────────────────────────────────

export function getSimulationWarnings(project = {}, survey = {}, simulation = {}, panelLayout = {}, roofGeometry = {}) {
  const warnings = [];

  // Roof condition
  const cond = survey.roofCondition || "";
  if (cond === "Weak" || cond === "Needs structural repair") {
    warnings.push({ level: "danger", msg: "Roof condition requires engineer/structural review before any installation work." });
  }
  if (cond === "Rusted") {
    warnings.push({ level: "warning", msg: "Rusted roof: assess sheet thickness and purlin condition. Replace affected sections before installing panels." });
  }
  if (survey.roofType === "Asbestos — Do Not Proceed") {
    warnings.push({ level: "danger", msg: "STOP: Do not proceed. Licensed asbestos handling and removal required." });
  }

  // Pitch warnings
  const pitch = roofGeometry.roofPitchDeg || survey.roofPitch || 0;
  if (pitch > 30) {
    warnings.push({ level: "danger", msg: `Steep roof (${pitch}°): fall-arrest equipment, scaffolding, and wind loading review required before installation.` });
  }
  if (pitch < 5 && pitch > 0) {
    warnings.push({ level: "warning", msg: "Near-flat roof: tilt/ballast structure required. Include row-spacing calculation to avoid inter-row shading." });
  }

  // Panel fit
  const notFit = (panelLayout.requiredPanels || 0) - (panelLayout.estimatedPanelsThatFit || 0);
  if (notFit > 0) {
    warnings.push({ level: "danger", msg: `${notFit} required panel(s) cannot fit on the selected roof area. Alternative roof face, carport, or ground mount needed.` });
  }

  // Obstructions
  const totalObstructionPct = (simulation.obstructions || [])
    .reduce((s, ob) => s + (ob.wPct / 100) * (ob.hPct / 100), 0) * 100;
  if (totalObstructionPct > 15) {
    warnings.push({ level: "warning", msg: `Obstructions cover ~${totalObstructionPct.toFixed(0)}% of roof — high impact. Consider alternate roof face or additional mounting area.` });
  }

  // Equipment location warnings
  const invLoc = simulation.inverterLocation || "";
  if (invLoc.includes("outside")) {
    warnings.push({ level: "warning", msg: "Outdoor inverter: confirm IP rating (min IP65), rain drip-shield, and absence of direct sunlight exposure." });
  }
  const batLoc = simulation.batteryLocation || "";
  if (batLoc.includes("outside")) {
    warnings.push({ level: "warning", msg: "Outdoor battery: manufacturer approval, weather enclosure, and thermal management required." });
  }

  // Cable routes
  const dcM = simulation.dcRouteCustomM > 0 ? simulation.dcRouteCustomM : estimateDcRouteM(simulation, roofGeometry);
  const acM = simulation.acRouteCustomM > 0 ? simulation.acRouteCustomM : estimateAcRouteM(simulation);
  if (dcM > 30 || acM > 15) {
    warnings.push({ level: "warning", msg: "Long cable route detected. Confirm cable sizing, voltage drop, and conduit protection before procurement." });
  }

  // Earthing
  if (!survey.earthingAvailable) {
    warnings.push({ level: "danger", msg: "No earthing confirmed on site. Install earth electrode system before energising the solar system." });
  }

  return warnings;
}

// ─── Blueprint construction guidance ─────────────────────────────────────────

export function getBlueprintSimulationGuidance() {
  return [
    "Reserve prime south/east-facing roof area for PV early in the design — mark as 'Solar Zone, No Equipment' on roof plan.",
    "Agree conduit routing from roof solar zone to inverter/battery room during first-fix electrical rough-in.",
    "Reserve a dedicated inverter/battery room (min 2 m², dry, ventilated, lockable) close to the main DB.",
    "Provide ventilation opening for the battery room sized per battery manufacturer requirements.",
    "Include a 4–6-way DB space reservation for the solar integration breakers in the main consumer unit.",
    "Provide earthing electrode provision (earth rod or ring) during ground works rather than retrofitting.",
    "Consider a 32A dedicated cable route from DB to garage/car port if EV charging is planned.",
    "Brief the structural engineer on PV dead load (typically 15–25 kg/m²) plus wind uplift before roofing design.",
    "Brief the M&E consultant and roofing contractor on conduit sleeves, roof penetrations and waterproofing method.",
    "This is construction-stage guidance. Update the layout after roof completion and physical site verification.",
  ];
}

// ─── Internal route estimators (used when user does not override) ─────────────

function estimateDcRouteM(simulation = {}, roofGeometry = {}) {
  const roofLen  = roofGeometry.roofLengthEstimatedM || 12;
  const entry    = simulation.cableEntryPoint || "bottom";
  const base     = entry === "bottom" ? roofLen * 0.5 : roofLen * 0.7;
  return Math.round(base + 5); // roof route + 5m inside building
}

function estimateAcRouteM(simulation = {}) {
  const invLoc = simulation.inverterLocation || "indoor_utility";
  if (invLoc === "indoor_utility") return 6;
  if (invLoc === "garage")         return 10;
  if (invLoc === "corridor")       return 5;
  if (invLoc.includes("outside"))  return 3;
  return 8; // custom / default
}

function estimateBatRouteM(simulation = {}) {
  const batLoc = simulation.batteryLocation || "near_inverter";
  if (batLoc === "near_inverter") return 1;
  if (batLoc === "utility_room")  return 3;
  if (batLoc === "garage")        return 5;
  return 3; // custom
}

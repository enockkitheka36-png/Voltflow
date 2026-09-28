/**
 * projectTemplates.js — Voltflow 11.7 (Studio: Project Template Gallery)
 *
 * Job-type starting points so a user builds a useful project in minutes instead
 * of filling blank forms. Pure — no React, no DOM. `applyTemplate` maps a
 * template onto the blank project factory + real loadItemsV2 (via loadEngine),
 * and enables the borehole module where relevant. Calculations stay deterministic;
 * templates only pre-fill inputs the user can edit.
 */

import { createLoadItem } from "./loadEngine.js";
import { createDefaultBorehole, normalizeBorehole } from "./boreholeEngine.js";

// Compact load spec → real loadItemsV2 item.
const L = (name, ratedW, qty, dayHours, nightHours, essential = true, category = "Other") =>
  ({ name, ratedW, qty, dayHours, nightHours, essential, category });

export const TEMPLATES = [
  {
    id: "residential_backup", name: "Residential Backup", icon: "🏠", category: "Residential",
    systemType: "Solar PV – Hybrid", loadAssessmentMode: "Residential",
    description: "Home essential-loads backup for blackouts: lights, TV, fridge, Wi-Fi.",
    project: { solarCoverage: 0.6, backupHours: 6, phase: "Single phase" }, enableBorehole: false,
    loads: [L("LED lighting", 10, 12, 5, 5, true, "Lighting"), L("TV + decoder", 120, 1, 4, 3, true, "Electronics"),
      L("Refrigerator", 150, 1, 8, 8, true, "Refrigeration"), L("Wi-Fi router", 12, 1, 12, 12, true, "Electronics"),
      L("Phone/laptop charging", 65, 3, 3, 2, true, "Electronics")],
    commonWarnings: ["Confirm which loads must stay on during a blackout", "Fridge surge current on start-up"],
    proposalLanguage: { problem: "Frequent power outages disrupt lighting, refrigeration and connectivity.", solution: "A solar-plus-battery hybrid that keeps essential loads running through outages.", benefits: "Reliable backup for lights, fridge, TV and internet; lower monthly bills." },
    boqCategories: ["PV modules", "Hybrid inverter", "Battery", "Mounting", "Protection & cabling"],
    checklistItems: ["Confirm essential loads", "Confirm roof space/orientation", "Confirm backup runtime expectation"],
    recommendedSections: ["loads", "generation", "battery", "inverter", "proposal"],
  },
  {
    id: "residential_hybrid", name: "Residential Hybrid", icon: "🏡", category: "Residential",
    systemType: "Solar PV – Hybrid", loadAssessmentMode: "Residential",
    description: "Whole-home hybrid: bill reduction + backup, including pump and sockets.",
    project: { solarCoverage: 0.8, backupHours: 8, phase: "Single phase" }, enableBorehole: false,
    loads: [L("LED lighting", 10, 16, 5, 5, true, "Lighting"), L("Refrigerator", 150, 1, 8, 8, true, "Refrigeration"),
      L("TV + electronics", 150, 1, 5, 4, true, "Electronics"), L("Water pump", 750, 1, 2, 0, true, "Motor"),
      L("Iron/kettle (non-backup)", 2000, 1, 1, 0, false, "Heating"), L("Sockets/general", 300, 1, 6, 2, false, "Other")],
    commonWarnings: ["Heavy loads (iron/kettle) usually excluded from backup", "Water pump surge sizing"],
    proposalLanguage: { problem: "High electricity bills and unreliable grid supply.", solution: "A right-sized hybrid solar system covering most daily energy with battery backup.", benefits: "Major bill reduction, backup for essentials, quieter than a generator." },
    boqCategories: ["PV modules", "Hybrid inverter", "Battery", "Mounting", "Protection & cabling"],
    checklistItems: ["Confirm daily energy use", "Confirm backup vs bill-reduction priority", "Confirm roof area"],
    recommendedSections: ["loads", "generation", "battery", "inverter", "finance", "proposal"],
  },
  {
    id: "commercial_rooftop", name: "Commercial Rooftop", icon: "🏢", category: "Commercial",
    systemType: "Solar PV – Hybrid", loadAssessmentMode: "Small Commercial",
    description: "Daytime bill reduction for offices/retail; modest backup.",
    project: { solarCoverage: 0.7, backupHours: 3, phase: "Three phase" }, enableBorehole: false,
    loads: [L("Office lighting", 18, 40, 10, 1, false, "Lighting"), L("Computers/POS", 150, 10, 9, 0, true, "Electronics"),
      L("Air conditioning", 1500, 3, 8, 0, false, "HVAC"), L("Refrigeration", 400, 2, 12, 12, true, "Refrigeration"),
      L("Server/network", 300, 1, 12, 12, true, "Electronics")],
    commonWarnings: ["Confirm three-phase balance", "Daytime load profile suits grid-tied/hybrid", "Demand/simultaneity of AC units"],
    proposalLanguage: { problem: "Daytime operating costs are dominated by grid electricity.", solution: "A rooftop solar system sized to daytime demand with optional backup for critical loads.", benefits: "Lower daytime energy cost, hedge against tariff rises, ESG credentials." },
    boqCategories: ["PV modules", "Grid/hybrid inverter", "Mounting", "Metering", "Protection & cabling"],
    checklistItems: ["Confirm daytime demand profile", "Confirm roof structure/access", "Confirm net-metering applicability"],
    recommendedSections: ["loads", "generation", "inverter", "eng-compliance", "finance", "proposal"],
  },
  {
    id: "school", name: "School Solar System", icon: "🏫", category: "Institution",
    systemType: "Solar PV – Hybrid", loadAssessmentMode: "School / Institution",
    description: "Classrooms, computer lab, water pumping and admin backup.",
    project: { solarCoverage: 0.75, backupHours: 4, phase: "Three phase" }, enableBorehole: false,
    loads: [L("Classroom lighting", 18, 60, 8, 1, false, "Lighting"), L("Computer lab", 150, 20, 6, 0, true, "Electronics"),
      L("Water pump", 1100, 1, 3, 0, true, "Motor"), L("Admin/office", 300, 1, 8, 0, true, "Electronics"),
      L("Kitchen/dining", 2000, 1, 3, 0, false, "Heating")],
    commonWarnings: ["Confirm term-time vs holiday load", "Water pumping schedule"],
    proposalLanguage: { problem: "Grid costs and outages disrupt learning and water supply.", solution: "A solar system powering classrooms, ICT and water pumping with backup.", benefits: "Reliable ICT and water, lower running costs, budget predictability." },
    boqCategories: ["PV modules", "Hybrid inverter", "Battery", "Mounting", "Pump/plumbing", "Protection & cabling"],
    checklistItems: ["Confirm ICT & lab load", "Confirm water source/pump", "Confirm term calendar impact"],
    recommendedSections: ["loads", "generation", "battery", "inverter", "proposal"],
  },
  {
    id: "clinic", name: "Clinic Solar System", icon: "🏥", category: "Institution",
    systemType: "Solar PV – Hybrid", loadAssessmentMode: "Hospital / Clinic",
    description: "Critical-load backup: vaccine fridge, lighting, lab, water.",
    project: { solarCoverage: 0.7, backupHours: 12, autonomyDays: 1, phase: "Single phase" }, enableBorehole: false,
    loads: [L("Vaccine/medical fridge", 200, 2, 12, 12, true, "Refrigeration"), L("Ward/exam lighting", 12, 30, 6, 8, true, "Lighting"),
      L("Lab equipment", 400, 1, 6, 1, true, "Electronics"), L("Water pump", 750, 1, 2, 0, true, "Motor"),
      L("Sterilizer (non-backup)", 1500, 1, 2, 0, false, "Heating")],
    commonWarnings: ["Vaccine fridge is a 24-hour critical load — size battery for it", "Confirm night lighting for maternity/emergency"],
    proposalLanguage: { problem: "Outages threaten cold chain, lighting and emergency care.", solution: "A solar system with battery backup prioritising the vaccine fridge, lighting and lab.", benefits: "Protected cold chain, safe night care, resilient operations." },
    boqCategories: ["PV modules", "Hybrid inverter", "Battery", "Mounting", "Protection & cabling"],
    checklistItems: ["Identify all 24-hour critical loads", "Confirm cold-chain fridge count", "Confirm autonomy requirement"],
    recommendedSections: ["loads", "battery", "inverter", "eng-compliance", "proposal"],
  },
  {
    id: "farm_borehole", name: "Farm Solar + Borehole", icon: "🚜", category: "Agricultural",
    systemType: "Off-grid", loadAssessmentMode: "Agricultural / Pumping",
    description: "Solar water pumping into storage + farmhouse essentials.",
    project: { solarCoverage: 0.9, autonomyDays: 1, backupHours: 8, phase: "Single phase" }, enableBorehole: true,
    boreholeOverrides: { useCase: "irrigation", dailyWaterDemandLitres: 20000, desiredPumpingHoursPerDay: 6, staticWaterLevelM: 40, drawdownM: 10, pumpSettingDepthM: 60, tankHeightM: 6, horizontalPipeDistanceM: 30, pipeDiameterMm: 50, pressureAllowanceM: 10, boreholeYieldLitresPerHour: 5000, pumpType: "dc_submersible", powerMode: "solar_direct", storageAutonomyDays: 2, dryRunProtectionIncluded: true, earthingIncluded: true },
    loads: [L("Borehole pump (see Borehole module)", 0, 1, 0, 0, false, "Motor"), L("Farmhouse lighting", 10, 10, 5, 5, true, "Lighting"),
      L("Security lighting", 30, 6, 0, 11, true, "Lighting"), L("Fridge", 150, 1, 8, 8, true, "Refrigeration")],
    commonWarnings: ["Borehole pump is sized in the Solar Borehole module — avoid double-counting it as a load", "Confirm borehole test report and yield"],
    proposalLanguage: { problem: "No reliable grid; water and basic power needed for the farm.", solution: "Daytime solar pumping into a storage tank plus battery backup for farmhouse essentials.", benefits: "Reliable water (litres/day), lights and refrigeration; no diesel pumping." },
    boqCategories: ["Solar pump & controller", "PV modules", "Storage tank", "Battery", "Riser/drop cable", "Protection & cabling"],
    checklistItems: ["Confirm borehole test report", "Confirm water demand (L/day)", "Confirm tank size/height"],
    recommendedSections: ["borehole", "loads", "battery", "inverter", "proposal"],
  },
  {
    id: "dairy_farm", name: "Dairy Farm", icon: "🐄", category: "Agricultural",
    systemType: "Solar PV – Hybrid", loadAssessmentMode: "Agricultural / Pumping",
    description: "Milk cooling (24h critical), milking, pumping and lighting.",
    project: { solarCoverage: 0.85, backupHours: 10, phase: "Three phase" }, enableBorehole: true,
    boreholeOverrides: { useCase: "livestock", dailyWaterDemandLitres: 8000, desiredPumpingHoursPerDay: 5, staticWaterLevelM: 30, drawdownM: 8, boreholeYieldLitresPerHour: 4000, pumpType: "ac_submersible_vfd", powerMode: "solar_with_grid_backup", dryRunProtectionIncluded: true },
    loads: [L("Milk cooler/chiller", 2000, 1, 12, 12, true, "Refrigeration"), L("Milking machine", 1500, 1, 3, 1, true, "Motor"),
      L("Water pump", 1100, 1, 4, 0, true, "Motor"), L("Barn lighting", 18, 20, 4, 6, true, "Lighting")],
    commonWarnings: ["Milk cooler is a 24-hour critical load", "Motor surge (milking/pump) sizing", "Water pumping vs milk cooling priority"],
    proposalLanguage: { problem: "Milk spoilage risk from outages and high diesel/grid costs.", solution: "Solar-hybrid powering milk cooling, milking and water with backup.", benefits: "Protected milk quality, lower running costs, reliable water." },
    boqCategories: ["PV modules", "Hybrid inverter", "Battery", "Solar pump & controller", "Mounting", "Protection & cabling"],
    checklistItems: ["Confirm cooler capacity/hours", "Confirm herd water demand", "Confirm motor starting method"],
    recommendedSections: ["loads", "battery", "inverter", "borehole", "proposal"],
  },
  {
    id: "carwash", name: "Carwash", icon: "🚿", category: "Commercial",
    systemType: "Solar PV – Hybrid", loadAssessmentMode: "Small Commercial",
    description: "High-pressure pumps and vacuums with daytime solar.",
    project: { solarCoverage: 0.75, backupHours: 2, phase: "Three phase" }, enableBorehole: false,
    loads: [L("Pressure pump", 3000, 2, 8, 0, true, "Motor"), L("Vacuum cleaners", 1400, 2, 6, 0, false, "Motor"),
      L("Water pump", 1100, 1, 6, 0, true, "Motor"), L("Lighting/office", 300, 1, 10, 4, false, "Lighting")],
    commonWarnings: ["Motor surge dominates inverter sizing — confirm starting method", "Confirm simultaneity of pumps/vacuums"],
    proposalLanguage: { problem: "Motor-heavy operation with high daytime grid demand.", solution: "Solar-hybrid sized to pump/vacuum peaks to cut daytime costs.", benefits: "Lower running costs; resilience for core wash operations." },
    boqCategories: ["PV modules", "Hybrid inverter", "Battery (optional)", "Mounting", "Protection & cabling"],
    checklistItems: ["Confirm pump/vacuum ratings & surge", "Confirm peak simultaneity", "Confirm water supply"],
    recommendedSections: ["loads", "inverter", "generation", "proposal"],
  },
  {
    id: "hotel_lodge", name: "Hotel / Lodge", icon: "🏨", category: "Hospitality",
    systemType: "Solar PV – Hybrid", loadAssessmentMode: "Hospitality / Hotel",
    description: "Rooms, kitchen, pumps and lighting with guest-grade backup.",
    project: { solarCoverage: 0.8, backupHours: 8, phase: "Three phase" }, enableBorehole: true,
    boreholeOverrides: { useCase: "hotel_lodge", dailyWaterDemandLitres: 12000, desiredPumpingHoursPerDay: 6, boreholeYieldLitresPerHour: 4000, pressureAllowanceM: 20, powerMode: "solar_with_grid_backup" },
    loads: [L("Guest room loads", 400, 20, 6, 6, true, "Other"), L("Kitchen (non-backup)", 4000, 1, 6, 2, false, "Heating"),
      L("Water pump/pressure", 1500, 1, 5, 2, true, "Motor"), L("Common-area lighting", 18, 40, 4, 8, true, "Lighting"),
      L("Cold room/fridges", 800, 2, 12, 12, true, "Refrigeration")],
    commonWarnings: ["Kitchen/heating loads usually excluded from backup", "Confirm occupancy-based demand", "Water pressure/pumping"],
    proposalLanguage: { problem: "Guest experience suffers during outages; energy is a major cost.", solution: "Solar-hybrid keeping rooms, water and refrigeration running, cutting grid/diesel use.", benefits: "Seamless guest experience, lower energy cost, sustainability story." },
    boqCategories: ["PV modules", "Hybrid inverter", "Battery", "Solar pump & controller", "Mounting", "Protection & cabling"],
    checklistItems: ["Confirm occupancy & load profile", "Confirm backup scope (rooms vs kitchen)", "Confirm water demand"],
    recommendedSections: ["loads", "battery", "inverter", "borehole", "proposal"],
  },
  {
    id: "minigrid", name: "Mini-grid", icon: "🔌", category: "Community",
    systemType: "Mini-grid", loadAssessmentMode: "Commercial & Industrial",
    description: "Community distribution: households + small commercial + anchor.",
    project: { solarCoverage: 0.9, autonomyDays: 1, phase: "Three phase", mgHouseholds: 60, mgHouseholdLoadKwh: 1.2, mgCommercialCustomers: 8, mgCommercialLoadKwh: 4, mgAnchorLoad: 3 }, enableBorehole: false,
    loads: [L("Representative household", 200, 1, 4, 5, true, "Other"), L("Small commercial", 500, 1, 8, 2, true, "Other")],
    commonWarnings: ["Sizing is community-load driven (see Mini-grid tab)", "Confirm distribution/metering plan", "Anchor-load reliability"],
    proposalLanguage: { problem: "Unserved community with no grid access.", solution: "A solar mini-grid serving households, businesses and an anchor load.", benefits: "Reliable electricity access, local economic activity, scalable design." },
    boqCategories: ["PV modules", "Inverters", "Battery bank", "LV distribution", "Smart meters", "Protection & cabling"],
    checklistItems: ["Confirm customer counts & loads", "Confirm distribution layout", "Confirm anchor load & metering"],
    recommendedSections: ["minigrid", "generation", "battery", "proposal"],
  },
  {
    id: "ev_charging", name: "EV Charging Station", icon: "⚡", category: "Commercial",
    systemType: "EV charging", loadAssessmentMode: "Small Commercial",
    description: "AC chargers with solar offset and optional battery buffer.",
    project: { solarCoverage: 0.7, phase: "Three phase", evChargerType: "L2", evChargersTotal: 4, evDailyChargingHours: 6, evOccupancy: 0.6 }, enableBorehole: false,
    loads: [L("Site lighting/office", 300, 1, 10, 6, false, "Lighting")],
    commonWarnings: ["Sizing driven by charger schedule (see EV tab)", "Confirm simultaneous charging & grid capacity", "Demand-charge management"],
    proposalLanguage: { problem: "Rising EV demand and grid capacity/cost constraints.", solution: "Solar-assisted EV charging with optional battery buffering for peak demand.", benefits: "Lower charging cost, reduced demand charges, green branding." },
    boqCategories: ["EV chargers", "PV modules", "Inverter", "Battery buffer (optional)", "Protection & cabling"],
    checklistItems: ["Confirm charger type & count", "Confirm daily sessions/occupancy", "Confirm grid connection capacity"],
    recommendedSections: ["ev", "generation", "proposal"],
  },
  {
    id: "genset_hybrid", name: "Genset Hybrid", icon: "🛢️", category: "Commercial",
    systemType: "Genset hybrid", loadAssessmentMode: "Commercial & Industrial",
    description: "Cut diesel runtime by adding solar + battery to an existing genset.",
    project: { solarCoverage: 0.7, backupHours: 6, phase: "Three phase", gensetFuelLPerHour: 8, gensetRunHoursPerDay: 10, gensetRatedKva: 40 }, enableBorehole: false,
    loads: [L("Facility lighting", 18, 40, 10, 3, false, "Lighting"), L("Machinery/loads", 3000, 2, 8, 0, true, "Motor"),
      L("Refrigeration", 600, 2, 12, 12, true, "Refrigeration"), L("Office/IT", 400, 1, 9, 0, true, "Electronics")],
    commonWarnings: ["Confirm current diesel fuel/run hours for savings baseline", "Genset altitude derating", "Solar/battery displacement fraction"],
    proposalLanguage: { problem: "Expensive, noisy diesel generation running many hours a day.", solution: "Add solar + battery so the genset runs far fewer hours.", benefits: "Major fuel savings, less maintenance/noise, extended genset life." },
    boqCategories: ["PV modules", "Hybrid inverter", "Battery", "Genset ATS/integration", "Protection & cabling"],
    checklistItems: ["Confirm diesel cost & run hours", "Confirm genset rating/age", "Confirm ATS integration"],
    recommendedSections: ["genset", "loads", "battery", "finance", "proposal"],
  },
  {
    id: "security_lighting", name: "Solar Security Lighting", icon: "🔦", category: "Specialist",
    systemType: "Off-grid", loadAssessmentMode: "Custom",
    description: "Night-dominant flood/security lighting + CCTV (tests night autonomy).",
    project: { solarCoverage: 1.0, autonomyDays: 1, phase: "Single phase" }, enableBorehole: false,
    loads: [L("Flood/security lights", 100, 10, 0, 11, true, "Lighting"), L("CCTV + NVR", 120, 1, 12, 12, true, "Electronics"),
      L("Perimeter LED", 30, 8, 0, 11, true, "Lighting")],
    commonWarnings: ["Night-dominant load — battery must cover the full night (see Night Autonomy)", "Average 24-hour autonomy overstates real backup for night-only loads"],
    proposalLanguage: { problem: "Security lighting must run all night with no grid.", solution: "Solar charging by day, battery powering lights and CCTV all night.", benefits: "Reliable all-night security lighting and surveillance, no grid or diesel." },
    boqCategories: ["PV modules", "Battery", "Charge controller/inverter", "Flood/CCTV fixtures", "Protection & cabling"],
    checklistItems: ["Confirm night hours of operation", "Confirm number/wattage of fixtures", "Confirm battery autonomy for full night"],
    recommendedSections: ["loads", "battery", "generation", "proposal"],
  },
];

export function listTemplates() {
  return TEMPLATES.map((t) => ({
    id: t.id, name: t.name, icon: t.icon, category: t.category, systemType: t.systemType,
    description: t.description, enableBorehole: !!t.enableBorehole, loadCount: (t.loads || []).length,
  }));
}

export function getTemplate(id) { return TEMPLATES.find((t) => t.id === id) || null; }

/**
 * applyTemplate(baseProject, id) → { project, loadItemsV2, loadAssessmentMode, borehole }
 * Merges template overrides onto the caller's blank/base project, builds real
 * load items, and enables the borehole module where the template calls for it.
 * Never mutates inputs.
 */
export function applyTemplate(baseProject = {}, id) {
  const t = getTemplate(id);
  if (!t) return null;
  const project = {
    ...baseProject,
    ...(t.project || {}),
    systemType: t.systemType,
    loadAssessmentMode: t.loadAssessmentMode,
    selectedTemplateId: t.id,
  };
  const loadItemsV2 = (t.loads || []).map((spec) => createLoadItem(spec));
  let borehole = baseProject.borehole ? { ...baseProject.borehole } : createDefaultBorehole();
  if (t.enableBorehole) {
    borehole = normalizeBorehole({ ...createDefaultBorehole(), ...(t.boreholeOverrides || {}), enabled: true });
  }
  project.borehole = borehole;
  return {
    project,
    loadItemsV2,
    loadAssessmentMode: t.loadAssessmentMode,
    borehole,
    meta: {
      commonWarnings: t.commonWarnings || [], proposalLanguage: t.proposalLanguage || {},
      boqCategories: t.boqCategories || [], checklistItems: t.checklistItems || [], recommendedSections: t.recommendedSections || [],
    },
  };
}

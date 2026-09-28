/**
 * demoProjects.js — Voltflow 11.4.1
 *
 * The ONLY home for demo/sample data. Nothing here loads automatically — a
 * demo is applied exclusively when the user picks it from the start screen,
 * and it is badged DEMO until they convert it into a real project.
 *
 * The old "Karen Homeowner" startup project lives here now (demo 1) instead of
 * being the app's default state. The "Nairobi / Karen" *site profile* is
 * unrelated Kenya solar-resource data and remains selectable in the app.
 *
 * Each demo supplies OVERRIDES onto the engineering baseline, so demos stay
 * small and inherit module/loss/cost defaults from the app.
 */

export const DEMO_DISCLAIMER = "Demo data only — not a real client or site. Use \"Use as template\" to turn it into a real project.";

const L = (id, name, qty, watts, dayHours, nightHours, surge, critical) =>
  ({ id, name, qty, watts, dayHours, nightHours, surge, critical });

export const DEMO_PROJECTS = [
  {
    id: "residential_karen",
    label: "Residential Hybrid Demo — Karen",
    description: "Typical Nairobi household: fridge, lighting, TV, pump and a heavy socket. Hybrid backup + bill reduction.",
    tags: ["Residential", "Hybrid"],
    project: {
      client: "DEMO — Karen Residence",
      location: "Karen, Nairobi",
      systemType: "Solar PV – Hybrid",
      phase: "Single Phase (230V)",
      siteProfile: "Nairobi / Karen",
      monthlyBill: 35000,
      psh: 5.6, cellTemp: 47, minTemp: 7, altitude: 1795, soilingLoss: 0.04,
      loadSource: "client_estimate",
    },
    survey: { county: "Nairobi", siteType: "Residential", roofType: "Mabati / Iron sheet", roofLengthM: 12, roofWidthM: 8, roofAreaM2: 67 },
    loads: [
      L(1, "Fridge", 1, 250, 6, 6, 3, true),
      L(2, "LED lights", 10, 10, 1, 5, 1, true),
      L(3, "Computers", 2, 150, 8, 0, 1.2, true),
      L(4, "Television", 1, 120, 1, 4, 1.1, true),
      L(5, "Water pump", 1, 1100, 1, 0, 4, false),
      L(6, "Kettle / heavy socket", 1, 2000, 0.3, 0, 1, false),
    ],
  },
  {
    id: "commercial_sme",
    label: "Commercial SME Demo",
    description: "Small business in Nairobi industrial area: office IT, lighting, AC and a compressor. Three-phase supply.",
    tags: ["Commercial", "Three-phase"],
    project: {
      client: "DEMO — Riverside SME Ltd",
      location: "Industrial Area, Nairobi",
      systemType: "Solar PV – Hybrid",
      phase: "Three Phase (400V)",
      siteProfile: "Nairobi / Karen",
      monthlyBill: 180000,
      acVoltage: 400,
      loadSource: "client_estimate",
    },
    survey: { county: "Nairobi", siteType: "Commercial", roofType: "Mabati / Iron sheet", roofLengthM: 30, roofWidthM: 18, roofAreaM2: 380 },
    loads: [
      L(1, "Office lighting", 60, 18, 9, 1, 1, true),
      L(2, "Workstations + IT", 25, 120, 9, 0, 1.1, true),
      L(3, "Server / network rack", 1, 800, 12, 12, 1.2, true),
      L(4, "Split AC units", 6, 1500, 8, 0, 3, false),
      L(5, "Air compressor", 1, 5500, 4, 0, 4, false),
      L(6, "Kitchen / water dispenser", 1, 2000, 2, 0, 1, false),
    ],
  },
  {
    id: "offgrid_farm",
    label: "Off-grid Farm Demo",
    description: "Borehole pumping, milk cooling and farmhouse lighting with no grid connection. Battery autonomy critical.",
    tags: ["Off-grid", "Agricultural"],
    project: {
      client: "DEMO — Rift Valley Farm",
      location: "Naivasha, Nakuru",
      systemType: "Off-grid",
      phase: "Three Phase (400V)",
      siteProfile: "Nakuru / Naivasha",
      monthlyBill: 0,
      autonomyDays: 1.5,
      loadSource: "client_estimate",
    },
    survey: { county: "Nakuru", siteType: "Agricultural", roofType: "Mabati / Iron sheet", roofLengthM: 20, roofWidthM: 12, roofAreaM2: 170 },
    loads: [
      L(1, "Borehole pump", 1, 2200, 5, 0, 4, true),
      L(2, "Milk chill tank", 1, 2000, 6, 4, 3, true),
      L(3, "Farmhouse lighting", 20, 12, 1, 5, 1, true),
      L(4, "Electric fence energizer", 1, 50, 12, 12, 1, true),
      L(5, "Workshop tools", 1, 1500, 1, 0, 3, false),
    ],
  },
  {
    id: "genset_hybrid",
    label: "Genset Hybrid Demo",
    description: "Site currently running a diesel generator daily. Solar + battery to cut fuel hours and cost.",
    tags: ["Genset", "Fuel saving"],
    project: {
      client: "DEMO — Northern Depot",
      location: "Garissa Town, Garissa",
      systemType: "Genset hybrid",
      phase: "Three Phase (400V)",
      siteProfile: "Garissa / Northern Kenya",
      monthlyBill: 240000,
      gensetRatedKva: 30,
      gensetFuelLPerHour: 7.5,
      gensetRunHoursPerDay: 10,
      loadSource: "client_estimate",
    },
    survey: { county: "Garissa", siteType: "Commercial", roofType: "Mabati / Iron sheet", roofLengthM: 25, roofWidthM: 15, roofAreaM2: 260 },
    loads: [
      L(1, "Cold storage", 2, 3000, 12, 12, 3, true),
      L(2, "Depot lighting", 40, 20, 2, 8, 1, true),
      L(3, "Office block", 1, 2500, 9, 0, 1.2, true),
      L(4, "Workshop / welding", 1, 6000, 3, 0, 3.5, false),
      L(5, "Water pump", 1, 2200, 3, 0, 4, true),
    ],
  },
  {
    id: "ev_charging",
    label: "EV Charging Demo",
    description: "Fleet yard with AC chargers, mostly overnight charging plus daytime top-ups.",
    tags: ["EV", "Charging"],
    project: {
      client: "DEMO — Nairobi Fleet Yard",
      location: "Mombasa Road, Nairobi",
      systemType: "EV charging",
      phase: "Three Phase (400V)",
      siteProfile: "Nairobi / Karen",
      monthlyBill: 320000,
      evChargerType: "L2",
      evChargersTotal: 6,
      evDailyChargingHours: 6,
      loadSource: "client_estimate",
    },
    survey: { county: "Nairobi", siteType: "Commercial", roofType: "Concrete / slab", roofLengthM: 28, roofWidthM: 16, roofAreaM2: 310 },
    loads: [
      L(1, "AC chargers 7 kW", 4, 7000, 2, 6, 1.1, true),
      L(2, "AC charger 22 kW", 1, 22000, 1, 4, 1.1, false),
      L(3, "Yard lighting", 24, 40, 0, 11, 1, true),
      L(4, "Dispatch office", 1, 900, 10, 2, 1.2, true),
      L(5, "CCTV / barriers", 1, 300, 12, 12, 1.5, true),
    ],
  },
  {
    id: "minigrid",
    label: "Mini-grid Demo",
    description: "Community mini-grid serving households plus small commercial customers.",
    tags: ["Mini-grid", "Community"],
    project: {
      client: "DEMO — Lake Region Mini-grid",
      location: "Mbita, Homa Bay",
      systemType: "Mini-grid",
      phase: "Three Phase (400V)",
      siteProfile: "Kisumu / Lake Region",
      monthlyBill: 0,
      mgHouseholds: 120,
      mgHouseholdLoadKwh: 1.2,
      mgCommercialCustomers: 12,
      mgCommercialLoadKwh: 6,
      autonomyDays: 1.5,
      loadSource: "estimated",
    },
    survey: { county: "Kisumu", siteType: "Community", roofType: "Ground mount", roofLengthM: 40, roofWidthM: 25, roofAreaM2: 900 },
    loads: [
      L(1, "Household lighting + phone charging", 120, 40, 1, 5, 1, true),
      L(2, "Household TV / radio", 60, 80, 1, 4, 1.1, false),
      L(3, "Shops / kiosks", 12, 400, 8, 3, 1.3, true),
      L(4, "Water pumping", 1, 3000, 4, 0, 4, true),
      L(5, "Health post refrigeration", 1, 300, 12, 12, 3, true),
    ],
  },
];

export function getDemoProject(id) {
  return DEMO_PROJECTS.find((d) => d.id === id) || null;
}

/**
 * createProjectFromDemo(engineeringDefaults, demoId)
 * → { project, loads, survey } with the DEMO badge set, or null.
 * Never called automatically — only from an explicit user action.
 */
export function createProjectFromDemo(engineeringDefaults = {}, demoId) {
  const demo = getDemoProject(demoId);
  if (!demo) return null;
  return {
    project: {
      ...engineeringDefaults,
      ...demo.project,
      designStage: "Feasibility / Planning",
      isDemo: true,
      demoId: demo.id,
      demoLabel: demo.label,
      createdAt: new Date().toISOString(),
    },
    loads: demo.loads.map((l) => ({ ...l })),
    survey: { ...(demo.survey || {}) },
    disclaimer: DEMO_DISCLAIMER,
  };
}

/**
 * convertDemoToRealProject(project, clientName)
 * Strips the demo badge and applies the real client name the user supplies.
 */
export function convertDemoToRealProject(project = {}, clientName = "") {
  const name = String(clientName || "").trim();
  return {
    ...project,
    client: name || "",
    isDemo: false,
    demoId: null,
    demoLabel: null,
    convertedFromDemo: project.demoId || null,
  };
}

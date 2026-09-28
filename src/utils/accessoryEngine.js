/**
 * accessoryEngine.js — Solarise Pro v10
 * Real-time accessories/BOS (balance-of-system) BoQ generator. Pure
 * functions — no React, no DOM. Recomputed via useMemo in App.jsx from
 * already-derived state (sizing, panelLayout, liveStringPlan, simulation) —
 * it does not re-derive panel/string/cable math, it reuses:
 *   - roofGeometry.estimatePanelLayout()'s panelsPerRow/numberOfRows
 *   - installerSimulation.getCableEstimates() for DC/AC/battery route lengths
 *   - stringPlanner.generateStringPlan()'s totalStrings/needsCombiner
 * so accessory quantities can never drift from what the rest of the app
 * already shows for layout/strings/cables.
 */

import { DEFAULT_CATALOGUE, getCatalogueItem } from "./catalogue.js";
import { getCableEstimates } from "./installerSimulation.js";
import { defaultAccessoriesAssumptions } from "./schemaMigration.js";

function lineItem(catalogue, itemCode, qty, dependency, extra = {}) {
  const cat = getCatalogueItem(catalogue, itemCode);
  const unitCost = extra.unitCost ?? cat?.defaultUnitCost ?? 0;
  const q = Math.max(0, Math.round((qty || 0) * 100) / 100);
  return {
    itemCode,
    name: cat?.name || itemCode,
    category: cat?.category || "Other",
    unit: cat?.unit || "piece",
    qty: q,
    unitCost,
    total: +(q * unitCost).toFixed(2),
    source: "auto",
    dependency,         // "layout" | "string" | "cable" | "battery" | "system-type"
    required: true,
    ...extra,
  };
}

/**
 * @param {object} inputs.project, survey, sizing, roofGeometry, panelLayout,
 *   simulation, liveStringPlan — all already computed once at the top of
 *   SolariseProSizingApp; pass them straight through.
 * @param {object} inputs.accessoriesAssumptions  editable formula constants
 * @param {Array}  inputs.catalogue  project's catalogue, or [] to use DEFAULT_CATALOGUE
 */
export function generateAccessoriesBoQ({
  project = {}, survey = {}, sizing = {}, roofGeometry = {}, panelLayout = {},
  simulation = {}, liveStringPlan = {}, accessoriesAssumptions, catalogue,
} = {}) {
  const A = { ...defaultAccessoriesAssumptions, ...(accessoriesAssumptions || {}) };
  const cat = catalogue && catalogue.length > 0 ? catalogue : DEFAULT_CATALOGUE;
  const missingAssumptions = [];
  const advisories = [];

  // v11.1 — multiple active roof faces need extra rail cuts, flashings and
  // setting-out time; apply a mounting allowance instead of pretending one face.
  const activeFaceCount = (simulation.roofFaces || []).filter((f) => f && f.selectedForPv !== false).length;
  const multiFaceFactor = activeFaceCount > 1 ? 1 + (A.multiFaceExtraMountingPct ?? 5) / 100 : 1;
  if (activeFaceCount > 1) {
    advisories.push(`${activeFaceCount} roof faces selected — mounting quantities include a ${A.multiFaceExtraMountingPct ?? 5}% multi-face allowance for extra rail cuts and flashings.`);
  }

  // v11.1 — flag when the roof cannot take the full array; the BoQ has no
  // carport/ground-mount structure priced, so make that visible.
  if ((panelLayout.roofFitStatus || "").startsWith("Does not fit")) {
    advisories.push("Roof does not fit all required panels — alternative mounting (carport / ground mount / second structure) is NOT priced in this BoQ. Add it manually once the mounting solution is confirmed.");
  }

  // ── Mounting (from panelLayout.panelsPerRow/numberOfRows — see file header) ──
  const panels = sizing.panels || 0;
  const panelsPerRow = Math.max(1, panelLayout.panelsPerRow || panels || 1);
  const numberOfRows = Math.max(1, Math.ceil(panels / panelsPerRow));
  if (!panelLayout.panelsPerRow) missingAssumptions.push("Roof layout panels-per-row not available — mounting quantities use a single-row fallback.");

  const panelLen = project.panelLengthM || 2.28;
  const panelWid = project.panelWidthM || 1.13;
  const dimAlongRow = (panelLayout.recommendedPanelOrientation || "portrait") === "landscape" ? panelWid : panelLen;
  const GAP_M = 0.02;
  const railsPerRow = 2; // top + bottom rail per row, standard rail-and-clamp mounting

  let totalRailLengthM = 0, midClamps = 0, endClamps = 0;
  for (let r = 0; r < numberOfRows; r++) {
    const n = Math.max(0, Math.min(panelsPerRow, panels - r * panelsPerRow));
    if (n <= 0) continue;
    totalRailLengthM += (n * dimAlongRow + Math.max(0, n - 1) * GAP_M) * railsPerRow;
    midClamps += railsPerRow * Math.max(n - 1, 0);
    endClamps += railsPerRow * 2;
  }
  totalRailLengthM *= multiFaceFactor;
  const railPieces = Math.ceil(totalRailLengthM / Math.max(A.railStandardLengthM, 0.1));
  const numberOfRailRuns = numberOfRows * railsPerRow;
  const railJoiners = Math.max(0, railPieces - numberOfRailRuns);
  const lFeet = totalRailLengthM > 0 ? Math.ceil(totalRailLengthM / Math.max(A.lFootSpacingM, 0.1)) + (A.railSafetyAllowance || 0) : 0;

  const roofType = survey.roofType || project.roofType || "";
  if (!roofType) missingAssumptions.push("Roof type not set — mounting fixings assumed for sheet roofing (roof hooks). Confirm on site.");
  const isSheetOrTile = roofType === "" || /Mabati|Iron|Tile|Clay/i.test(roofType);
  const roofHooksQty = isSheetOrTile ? lFeet : 0;
  const hangerBoltsQty = isSheetOrTile ? 0 : lFeet;

  const mounting = [
    lineItem(cat, "MNT-01", railPieces, "layout"),
    lineItem(cat, "MNT-02", railJoiners, "layout"),
    lineItem(cat, "MNT-03", lFeet, "layout"),
    lineItem(cat, "MNT-04", hangerBoltsQty, "layout"),
    lineItem(cat, "MNT-05", roofHooksQty, "layout"),
    lineItem(cat, "MNT-06", midClamps, "layout"),
    lineItem(cat, "MNT-07", endClamps, "layout"),
    lineItem(cat, "MNT-08", panels, "layout"),
    lineItem(cat, "MNT-09", numberOfRailRuns, "layout"),
    lineItem(cat, "MNT-10", railJoiners, "layout"),
    lineItem(cat, "MNT-11", panels * 4, "layout"),
    lineItem(cat, "MNT-12", Math.ceil((hangerBoltsQty + roofHooksQty) / 10), "layout"),
    lineItem(cat, "MNT-13", panels > 0 ? 1 : 0, "layout"),
  ].filter((r) => r.qty > 0);

  // ── DC / PV (from liveStringPlan + getCableEstimates — see file header) ────
  const cableEstimates = getCableEstimates(simulation, project, roofGeometry);
  const stringCount = liveStringPlan.totalStrings || (panels > 0 ? 1 : 0);
  if (!liveStringPlan.totalStrings) missingAssumptions.push("String plan not yet generated — DC accessory quantities use a single-string fallback.");

  const dcCableLengthM = +(2 * cableEstimates.dcM * stringCount * (1 + A.cableAllowancePct / 100)).toFixed(1);
  const mc4Pairs = Math.ceil(stringCount * (1 + A.mc4AllowancePct / 100)) * 2; // 2 ends per string
  const dcIsolators = Math.ceil(stringCount / Math.max(A.isolatorCapacityStrings, 1));
  const needsCombiner = !!liveStringPlan.needsCombiner || stringCount > A.stringFuseRequiredAboveStrings;

  const dc = [
    lineItem(cat, "DC-01", dcCableLengthM / 2, "string"),
    lineItem(cat, "DC-02", dcCableLengthM / 2, "string"),
    lineItem(cat, "DC-03", mc4Pairs, "string"),
    lineItem(cat, "DC-05", dcIsolators, "string"),
    lineItem(cat, "DC-06", needsCombiner ? dcIsolators : 0, "string"),
    lineItem(cat, "DC-07", needsCombiner ? stringCount : 0, "string"),
    lineItem(cat, "DC-08", needsCombiner ? 1 : 0, "string"),
    lineItem(cat, "DC-09", panels > 0 ? 1 : 0, "cable"),
    lineItem(cat, "DC-10", Math.ceil(dcCableLengthM / 5), "cable"),
    lineItem(cat, "DC-11", Math.ceil(cableEstimates.dcM), "cable"),
    lineItem(cat, "DC-13", panels > 0 ? 1 : 0, "string"),
  ].filter((r) => r.qty > 0);

  // ── AC ───────────────────────────────────────────────────────────────────
  const isThreePhase = (project.phase || "").includes("Three");
  const acCableLengthM = +(cableEstimates.acM * (1 + A.cableAllowancePct / 100)).toFixed(1);
  const ac = [
    lineItem(cat, "AC-01", acCableLengthM, "cable"),
    lineItem(cat, "AC-02", panels > 0 ? 1 : 0, "cable"),
    lineItem(cat, "AC-03", isThreePhase ? 3 : 1, "cable"),
    lineItem(cat, "AC-04", project.systemType === "Genset hybrid" ? 1 : 0, "system-type"),
    lineItem(cat, "AC-05", panels > 0 ? 1 : 0, "system-type"),
    lineItem(cat, "AC-06", panels > 0 ? 1 : 0, "cable"),
    lineItem(cat, "AC-07", isThreePhase ? 3 : 1, "cable"),
    lineItem(cat, "AC-08", acCableLengthM, "cable"),
    lineItem(cat, "AC-09", panels > 0 ? 1 : 0, "cable"),
  ].filter((r) => r.qty > 0);

  // ── Battery ──────────────────────────────────────────────────────────────
  const hasBattery = (sizing.batteryKwh || 0) > 0;
  const batteryModules = sizing.batteryModules || 0;
  const batCableLengthM = +(2 * cableEstimates.batM).toFixed(1);
  const battery = hasBattery ? [
    lineItem(cat, "BAT-01", batCableLengthM, "battery"),
    lineItem(cat, "BAT-02", 1, "battery"),
    lineItem(cat, "BAT-03", Math.max(1, Math.ceil(batteryModules / 4)), "battery"),
    lineItem(cat, "BAT-04", 1, "battery"),
    lineItem(cat, "BAT-05", 1, "battery"),
    lineItem(cat, "BAT-06", batteryModules * 2, "battery"),
    lineItem(cat, "BAT-07", 1, "battery"),
    lineItem(cat, "BAT-08", batCableLengthM, "battery"),
  ].filter((r) => r.qty > 0) : [];

  // ── Earthing / lightning ─────────────────────────────────────────────────
  if (survey.earthingAvailable === undefined) missingAssumptions.push("Earthing availability not confirmed — assumed existing earthing present.");
  const earthingAvailable = survey.earthingAvailable !== false;
  const earthing = [
    lineItem(cat, "EARTH-01", panels > 0 ? (earthingAvailable ? 1 : 2) : 0, "system-type"),
    lineItem(cat, "EARTH-02", panels > 0 ? +(cableEstimates.dcM + 5).toFixed(1) : 0, "cable"),
    lineItem(cat, "EARTH-03", numberOfRows > 0 ? numberOfRows * 2 + 2 : 0, "layout"),
    lineItem(cat, "EARTH-04", numberOfRows, "layout"),
    lineItem(cat, "EARTH-06", panels > 0 ? 1 : 0, "system-type"),
  ].filter((r) => r.qty > 0);

  // ── Monitoring ───────────────────────────────────────────────────────────
  const monitoring = [
    lineItem(cat, "MON-01", panels > 0 ? 1 : 0, "system-type"),
    lineItem(cat, "MON-02", panels > 0 ? 1 : 0, "system-type"),
  ].filter((r) => r.qty > 0);

  // ── Consumables / labour / transport ────────────────────────────────────
  const consumables = [
    lineItem(cat, "CONS-01", panels > 0 ? 1 : 0, "layout"),
    lineItem(cat, "CONS-02", Math.max(1, Math.ceil(panels / 10)), "layout"),
    lineItem(cat, "CONS-03", Math.max(1, Math.ceil(panels / 10)), "layout"),
    lineItem(cat, "CONS-04", panels > 0 ? 1 : 0, "layout"),
    lineItem(cat, "CONS-05", panels > 0 ? 1 : 0, "layout"),
    lineItem(cat, "CONS-06", panels > 0 ? 1 : 0, "layout"),
    lineItem(cat, "CONS-07", panels > 0 ? 2 : 0, "cable"),
    lineItem(cat, "CONS-08", numberOfRows * 2, "cable"),
    lineItem(cat, "CONS-09", panels > 0 ? 1 : 0, "system-type", { required: false }),
    lineItem(cat, "CONS-10", panels > 0 ? 1 : 0, "system-type", { required: false }),
  ].filter((r) => r.qty > 0);

  const hardwareCategories = { mounting, dc, ac, battery, earthing, monitoring, consumables };
  const hardwareSubtotal = Object.values(hardwareCategories).flat().reduce((s, r) => s + r.total, 0);
  const labourAllowance = panels > 0 ? Math.max(25000, Math.round(hardwareSubtotal * 0.12)) : 0;
  const transportAllowance = panels > 0 ? Math.max(12000, Math.round(hardwareSubtotal * 0.04)) : 0;
  const markupRate = 0.1;
  const markupBase = hardwareSubtotal + labourAllowance + transportAllowance;
  const markupAmount = panels > 0 ? Math.round(markupBase * markupRate) : 0;
  const commercial = [
    lineItem(cat, "COMM-LABOUR", labourAllowance > 0 ? 1 : 0, "commercial", { name: "Installation labour allowance", category: "Commercial", unit: "allowance", unitCost: labourAllowance }),
    lineItem(cat, "COMM-TRANSPORT", transportAllowance > 0 ? 1 : 0, "commercial", { name: "Transport / logistics allowance", category: "Commercial", unit: "allowance", unitCost: transportAllowance }),
    lineItem(cat, "COMM-MARKUP", markupAmount > 0 ? 1 : 0, "commercial", { name: "Project overhead / markup allowance", category: "Commercial", unit: "allowance", unitCost: markupAmount, internalCost: true }),
  ].filter((r) => r.qty > 0);
  const categories = { ...hardwareCategories, commercial };
  const totalCost = Object.values(categories).flat().reduce((s, r) => s + r.total, 0);
  const commercialSummary = { hardwareSubtotal, labourAllowance, transportAllowance, markupRate, markupAmount, customerSubtotal: totalCost };

  return { categories, totalCost, missingAssumptions, advisories, commercialSummary };
}

/**
 * Merge user overrides on top of the auto-generated BoQ: per-item qty/price/
 * exclude/required, plus fully manual extra line items. Never mutates autoBoQ.
 */
export function applyAccessoryOverrides(autoBoQ, overrides = {}) {
  const itemOverrides = overrides.items || {};
  const categories = {};
  Object.entries(autoBoQ.categories).forEach(([catKey, rows]) => {
    categories[catKey] = rows
      .map((row) => {
        const o = itemOverrides[row.itemCode];
        if (!o) return row;
        if (o.excluded) return null;
        const qty = o.qtyOverride !== undefined ? o.qtyOverride : row.qty;
        const unitCost = o.unitCostOverride !== undefined ? o.unitCostOverride : row.unitCost;
        const overridden = o.qtyOverride !== undefined || o.unitCostOverride !== undefined;
        return { ...row, qty, unitCost, total: +(qty * unitCost).toFixed(2), source: overridden ? "manual" : row.source, required: o.required !== false };
      })
      .filter(Boolean);
  });
  const manualItems = (overrides.manualItems || []).map((m) => ({
    itemCode: m.itemCode || `MANUAL-${m.id}`, name: m.name, category: m.category || "Manual", unit: m.unit || "piece",
    qty: Number(m.qty) || 0, unitCost: Number(m.unitCost) || 0, total: +((Number(m.qty) || 0) * (Number(m.unitCost) || 0)).toFixed(2),
    source: "manual", dependency: "manual", required: true,
  }));
  if (manualItems.length > 0) categories.manual = manualItems;

  const totalCost = Object.values(categories).flat().reduce((s, r) => s + r.total, 0);
  return { categories, totalCost, missingAssumptions: autoBoQ.missingAssumptions, advisories: autoBoQ.advisories || [], commercialSummary: autoBoQ.commercialSummary };
}

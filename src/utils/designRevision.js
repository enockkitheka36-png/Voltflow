import { canonicalize, hashCanonicalJson } from "../platform/canonicalJson.js";

export const DESIGN_CALCULATION_VERSION = "11.8.0";
export const DEFAULT_INVERTER_STEPS_KW = [1, 2, 3, 3.6, 5, 6, 8, 10, 12, 15, 20, 30, 50, 100];

const EV_KW = { L1: 3.7, L2: 7.4, DCFC50: 50, DCFC150: 150, HPC350: 350 };
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(Math.max(finite(value), min), max);

function performanceRatio(project = {}) {
  const tempLoss = Math.max(0, (finite(project.cellTemp, 25) - 25) * Math.abs(finite(project.temperatureCoeffPmax)));
  const losses = [
    tempLoss, project.soilingLoss, project.lidLoss, project.mismatchLoss,
    project.shadingLoss, project.dcCableLoss, project.acCableLoss, project.availabilityLoss,
  ];
  const afterLosses = losses.reduce((value, loss) => value * (1 - clamp(loss, 0, 0.4)), 1);
  return clamp(afterLosses * clamp(project.inverterEfficiency, 0.75, 0.99), 0.45, 0.95);
}

function nextStandard(value, steps = DEFAULT_INVERTER_STEPS_KW) {
  const list = Array.isArray(steps) && steps.length > 0 ? steps : DEFAULT_INVERTER_STEPS_KW;
  return list.find((step) => step >= value) ?? list[list.length - 1];
}

function invalidLoadHours(loads) {
  return (Array.isArray(loads) ? loads : []).some((load) => finite(load.dayHours) + finite(load.nightHours) > 24);
}

export function buildDesignInputs(input = {}) {
  const project = input.project || {};
  return canonicalize({
    loads: Array.isArray(input.loads) ? input.loads : [],
    loadSupplyScopes: Array.isArray(input.loadItemsV2) ? input.loadItemsV2.map((load) => ({
      id: load.id,
      name: load.name,
      qty: load.qty,
      ratedW: load.ratedW,
      voltage: load.voltage,
      powerFactor: load.powerFactor,
      dayHours: load.dayHours,
      nightHours: load.nightHours,
      dutyCyclePct: load.dutyCyclePct,
      demandFactorPct: load.demandFactorPct,
      diversityFactorPct: load.diversityFactorPct,
      surgeMultiplier: load.surgeMultiplier,
      startingMethod: load.startingMethod,
      phase: load.phase,
      supply_scope: load.supply_scope,
      criticality: load.criticality,
      exclusion_reason: load.exclusion_reason || null,
    })) : [],
    // Hash only STABLE, design-relevant roof-face geometry. The face `id` (and
    // name/label/photo_ids) are ephemeral UI identifiers — normalizeRoofFace /
    // initRoofFacesFromSurvey mint a fresh `face_${Date.now()}_…` id on every
    // render — so including them makes the design hash change every render. That
    // caused the auto design-revision effect's inputs_hash guard to never match,
    // re-running setProject in an infinite loop and freezing the tab (Page
    // Unresponsive) around Create Project. Geometry drives sizing, not the id.
    roofFaces: Array.isArray(input.roofFaces) ? input.roofFaces.map((face) => ({
      azimuth_deg: face.azimuth_deg,
      tilt_deg: face.tilt_deg,
      gross_area_m2: face.gross_area_m2,
      usable_area_m2: face.usable_area_m2,
      roofUsablePercent: face.roofUsablePercent,
      shading_pct: face.shading_pct,
      selected_for_pv: face.selected_for_pv,
      module_count: face.module_count,
      mppt_assignment: face.mppt_assignment ?? null,
    })) : [],
    solarModule: input.solarModule || {
      assetId: project.solarModuleAssetId || null,
      panelW: project.panelW,
      panelLengthM: project.panelLengthM,
      panelWidthM: project.panelWidthM,
      panelsPerString: project.panelsPerString,
      panelCost: project.panelCost,
      mountingPerPanel: project.mountingPerPanel,
    },
    batterySelection: input.batterySelection || project.batterySelection || { selection_mode: "AUTO" },
    batteryHardwareAssumptions: {
      chemistry: project.batteryChemistry,
      moduleKwh: project.batteryModuleKwh,
      moduleCost: project.batteryModuleCost,
      voltage: project.batteryVoltage,
    },
    inverterSelection: input.inverterSelection || project.inverterSelection || {
      selection_mode: "AUTO",
      asset_id: project.inverterAssetId || null,
      phase: project.phase,
      maxDcV: project.inverterMaxDcV,
      mpptCount: project.inverterMpptCount,
    },
    inverterCommercialAssumptions: {
      unitCost: project.inverterUnitCost,
    },
    gridMode: input.gridMode || project.systemType || "",
    generator: input.generator || {
      ratedKva: project.gensetRatedKva,
      loadPct: project.gensetLoadPct,
      powerFactor: project.gensetPowerFactor,
      derating: project.gensetDerating,
    },
    designAssumptions: input.designAssumptions || {
      psh: project.psh,
      solarCoverage: project.solarCoverage,
      backupHours: project.backupHours,
      autonomyDays: project.autonomyDays,
      dod: project.dod,
      batteryEfficiency: project.batteryEfficiency,
      inverterEfficiency: project.inverterEfficiency,
      inverterHeadroom: project.inverterHeadroom,
      runningLoadDiversityFactor: project.runningLoadDiversityFactor,
      surgeDiversityFactor: project.surgeDiversityFactor,
      temperatureCoeffPmax: project.temperatureCoeffPmax,
      cellTemp: project.cellTemp,
      soilingLoss: project.soilingLoss,
      lidLoss: project.lidLoss,
      mismatchLoss: project.mismatchLoss,
      shadingLoss: project.shadingLoss,
      dcCableLoss: project.dcCableLoss,
      acCableLoss: project.acCableLoss,
      availabilityLoss: project.availabilityLoss,
    },
    optionCommercialAssumptions: {
      monthlyBill: project.monthlyBill,
      gridTariff: project.gridTariff,
      selfConsumptionRate: project.selfConsumptionRate,
      capSavingsToBill: project.capSavingsToBill,
      oAndMRate: project.oAndMRate,
      monitoringCost: project.monitoringCost,
      cablingProtectionCost: project.cablingProtectionCost,
      epcCost: project.epcCost,
      contingency: project.contingency,
      vat: project.vat,
      quoteCurrency: project.quoteCurrency,
      pricingPolicyVersion: project.pricingPolicyVersion,
      taxRuleVersion: project.taxRuleVersion,
    },
    specialistInputs: {
      evChargerType: project.evChargerType,
      evChargersTotal: project.evChargersTotal,
      evDailyChargingHours: project.evDailyChargingHours,
      evOccupancy: project.evOccupancy,
      mgHouseholds: project.mgHouseholds,
      mgHouseholdLoadKwh: project.mgHouseholdLoadKwh,
      mgCommercialCustomers: project.mgCommercialCustomers,
      mgCommercialLoadKwh: project.mgCommercialLoadKwh,
      mgAnchorLoad: project.mgAnchorLoad,
    },
  });
}

export async function createDesignRevision(input = {}) {
  const inputs = buildDesignInputs(input);
  const hash = await hashCanonicalJson(inputs);
  return {
    revision_id: `rev_${hash.slice(0, 16)}`,
    inputs_hash: `sha256:${hash}`,
    calculation_version: input.calculationVersion || DESIGN_CALCULATION_VERSION,
    inputs,
  };
}

export function settleFailedDesignRevision(existing = {}) {
  if (existing.designRevision == null && existing.selectedDesignOption == null) return existing;
  return { ...existing, designRevision: null, selectedDesignOption: null };
}

export function computeOptionSizing(project = {}, loads = [], config = {}) {
  const pr = performanceRatio(project);
  const isEV = project.systemType === "EV charging";
  const isMG = project.systemType === "Mini-grid";
  const isOff = project.systemType === "Off-grid";
  const evDailyKwh = isEV
    ? finite(EV_KW[project.evChargerType], 7.4) * finite(project.evChargersTotal) * finite(project.evDailyChargingHours) * finite(project.evOccupancy)
    : 0;
  const mgDailyKwh = isMG
    ? finite(project.mgHouseholds) * finite(project.mgHouseholdLoadKwh) + finite(project.mgCommercialCustomers) * finite(project.mgCommercialLoadKwh)
    : 0;
  const dayKwh = loads.reduce((sum, load) => sum + finite(load.qty) * finite(load.watts) * finite(load.dayHours) / 1000, 0);
  const nightKwh = loads.reduce((sum, load) => sum + finite(load.qty) * finite(load.watts) * finite(load.nightHours) / 1000, 0);
  const dailyKwh = isEV ? evDailyKwh : isMG ? mgDailyKwh : dayKwh + nightKwh;
  const criticalDailyKwh = loads.filter((load) => load.critical).reduce(
    (sum, load) => sum + finite(load.qty) * finite(load.watts) * (finite(load.dayHours) + finite(load.nightHours)) / 1000,
    0,
  );
  const loadInventoryInvalid = invalidLoadHours(loads);
  const loadInventoryPending = loads.length === 0 || dailyKwh <= 0;
  if (loadInventoryInvalid || loadInventoryPending) {
    const reason = loadInventoryInvalid ? "Invalid load inventory" : "Pending load inventory";
    return {
      pr, panels: 0, actualKwp: 0, battKwh: 0, battModules: 0, invKw: 0,
      totalCost: 0, annualSavings: 0, annualNet: 0, payback: Infinity, autonomyH: 0, dailyKwh: 0,
      loadInventoryPending, loadInventoryInvalid, loadInventoryBlocked: true, quoteReady: false,
      quoteBlockedReason: reason, warnings: [`${reason} - add committed loads and click Update Sizing before pricing.`],
    };
  }

  const targetKwh = dailyKwh * finite(project.solarCoverage);
  const requiredKwp = targetKwh / Math.max(finite(project.psh) * pr, 0.1);
  const panels = Math.max(1, Math.ceil(requiredKwp * 1000 / Math.max(finite(project.panelW), 1)));
  const actualKwp = panels * finite(project.panelW) / 1000;
  const annualEnergy = actualKwp * finite(project.psh) * pr * 365;
  const backupNeed = (isOff || isMG)
    ? dailyKwh * finite(project.autonomyDays)
    : criticalDailyKwh * finite(project.backupHours) / 24;
  const requiredBatteryKwh = backupNeed / Math.max(finite(project.dod) * finite(project.batteryEfficiency), 0.1);
  const battModules = Math.max(1, Math.ceil(requiredBatteryKwh / Math.max(finite(project.batteryModuleKwh), 0.1)));
  const battKwh = battModules * finite(project.batteryModuleKwh);
  const usableKwh = battKwh * finite(project.dod) * finite(project.batteryEfficiency);
  const backupReferenceKw = backupNeed / Math.max((isOff || isMG) ? 24 * finite(project.autonomyDays) : finite(project.backupHours), 1);
  const autonomyH = backupReferenceKw > 0 ? usableKwh / backupReferenceKw : 0;
  const surgeKw = loads.reduce((sum, load) => sum + finite(load.qty) * finite(load.watts) * Math.max(finite(load.surge, 1), 1) / 1000, 0);
  const runningDiversity = finite(project.runningLoadDiversityFactor, 0.75) || 0.75;
  const surgeDiversity = finite(project.surgeDiversityFactor, 0.65) || 0.65;
  const connectedKw = loads.reduce((sum, load) => sum + finite(load.qty) * finite(load.watts), 0) / 1000;
  const peakKw = Math.max(connectedKw * runningDiversity, surgeKw * surgeDiversity);
  const invKw = nextStandard(Math.max(peakKw * finite(project.inverterHeadroom), actualKwp * 1.1), config.inverterStepsKw);
  const pvCost = panels * finite(project.panelCost);
  const mountingCost = panels * finite(project.mountingPerPanel);
  const batteryCost = battModules * finite(project.batteryModuleCost) + 16000;
  const specialistCost = project.systemType === "Genset hybrid" ? 85000 : 0;
  const subtotal = pvCost + mountingCost + finite(project.inverterUnitCost) + batteryCost
    + finite(project.monitoringCost) + finite(project.cablingProtectionCost) + finite(project.epcCost) + specialistCost;
  const totalCost = subtotal * (1 + finite(project.contingency)) * (1 + finite(project.vat));
  const annualSavingsRaw = annualEnergy * finite(project.selfConsumptionRate) * finite(project.gridTariff);
  const billLimit = finite(project.monthlyBill) * 12 * finite(project.solarCoverage);
  const annualSavings = project.capSavingsToBill ? Math.min(annualSavingsRaw, billLimit) : annualSavingsRaw;
  const annualNet = annualSavings - totalCost * finite(project.oAndMRate);
  return {
    pr, panels, actualKwp, battKwh, battModules, invKw, totalCost, annualSavings, annualNet,
    payback: annualNet > 0 ? totalCost / annualNet : Infinity, autonomyH, dailyKwh,
    loadInventoryPending: false, loadInventoryInvalid: false, loadInventoryBlocked: false,
    quoteReady: true, quoteBlockedReason: null, warnings: [],
  };
}

export function deriveSystemOptions(input = {}) {
  const templates = Array.isArray(input.templates) ? input.templates : [];
  return templates.map((template) => ({
    ...template,
    inputs_hash: input.inputsHash || null,
    revision_id: input.revisionId || null,
    calculation_version: input.calculationVersion || DESIGN_CALCULATION_VERSION,
    result: computeOptionSizing({ ...(input.project || {}), ...(template.overrides || {}) }, input.loads || [], input.calculationConfig),
  }));
}

export function isDesignOptionCurrent(option, currentInputsHash) {
  return !!option?.inputs_hash && option.inputs_hash === currentInputsHash;
}

export function staleDesignResult(option, currentInputsHash) {
  return isDesignOptionCurrent(option, currentInputsHash)
    ? { ok: true }
    : { ok: false, status: 409, code: "STALE_DESIGN", message: "The selected system option was calculated from an older project revision." };
}

import { EQUIPMENT_CATALOGUE_VERSION, EQUIPMENT_SOURCES, getDocumentedAsset } from "./equipmentCatalogue.js";

const numberOrNull = (value) => ["number", "string"].includes(typeof value) && String(value).trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
const textValue = (value) => typeof value === "string" ? value.trim().slice(0, 500) : "";
const positivePrice = (value) => Math.max(0, numberOrNull(value) || 0);
const priceOrNull = (value) => { const number = numberOrNull(value); return number != null && number >= 0 && number <= 1e9 ? number : null; };

export function normalizeEquipmentSelection(raw = {}) {
  const selection = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: selection.enabled === true,
    inverterId: textValue(selection.inverterId), batteryId: textValue(selection.batteryId), panelId: textValue(selection.panelId),
    batteryQuantity: numberOrNull(selection.batteryQuantity), modulesPerString: numberOrNull(selection.modulesPerString), stringCount: numberOrNull(selection.stringCount),
    armFirmware: textValue(selection.armFirmware), firmwareEvidence: textValue(selection.firmwareEvidence),
    protocol: textValue(selection.protocol), market: textValue(selection.market),
    minAmbientC: numberOrNull(selection.minAmbientC), maxAmbientC: numberOrNull(selection.maxAmbientC), altitudeM: numberOrNull(selection.altitudeM),
    hotModuleVmp: numberOrNull(selection.hotModuleVmp), hotVmpEvidence: textValue(selection.hotVmpEvidence),
    designPowerFactor: numberOrNull(selection.designPowerFactor), powerFactorEvidence: textValue(selection.powerFactorEvidence),
    panelPrice: priceOrNull(selection.panelPrice), inverterPrice: priceOrNull(selection.inverterPrice), batteryPrice: priceOrNull(selection.batteryPrice),
    priceBasis: selection.priceBasis === "SUPPLIER_QUOTE" ? "SUPPLIER_QUOTE" : "ESTIMATE", priceReference: textValue(selection.priceReference),
    sourceVersion: textValue(selection.sourceVersion),
  };
}

export function updateEquipmentSelection(previousInput, patch = {}) {
  const previous = normalizeEquipmentSelection(previousInput);
  const next = { ...previous, ...patch };
  const changed = (key) => Object.hasOwn(patch, key) && patch[key] !== previous[key];
  if (changed("inverterId")) Object.assign(next, { inverterPrice: null, armFirmware: "", firmwareEvidence: "" });
  if (changed("panelId")) Object.assign(next, { panelPrice: null, hotModuleVmp: null, hotVmpEvidence: "" });
  if (changed("batteryId")) next.batteryPrice = null;
  if (["inverterId", "panelId", "batteryId"].some(changed)) Object.assign(next, { priceBasis: "ESTIMATE", priceReference: "" });
  return normalizeEquipmentSelection(next);
}

export function equipmentBankLimits(selectionInput) {
  const selection = normalizeEquipmentSelection(selectionInput);
  const battery = getDocumentedAsset(selection.batteryId, "batteries");
  const inverter = getDocumentedAsset(selection.inverterId, "inverters");
  const quantity = selection.batteryQuantity;
  if (!battery || !inverter || !Number.isInteger(quantity) || quantity < 1 || quantity > battery.max_parallel_units) return { currentA: 0, powerKw: 0, usableKwh: 0 };
  return {
    currentA: Math.min(battery.singleCurrentA * quantity, battery.bankCurrentCapA, inverter.maxBatteryCurrentA),
    powerKw: Math.min(battery.singlePowerKw * quantity, battery.bankPowerCapKw, inverter.maxDischargeW / 1000),
    usableKwh: battery.usableKwh * quantity, minimumVoltage: battery.minVoltage,
  };
}

export function resolveEquipmentProject(project = {}) {
  const selection = normalizeEquipmentSelection(project.equipmentSelection);
  if (!selection.enabled) return project;
  const panel = getDocumentedAsset(selection.panelId, "panels");
  const inverter = getDocumentedAsset(selection.inverterId, "inverters");
  const battery = getDocumentedAsset(selection.batteryId, "batteries");
  return {
    ...project, equipmentSelection: selection,
    ...(panel ? { solarModuleAssetId: panel.id, panelW: panel.watts, panelArea: panel.lengthM * panel.widthM, panelLengthM: panel.lengthM, panelWidthM: panel.widthM, moduleVoc: panel.voc, moduleVmp: panel.vmp, moduleIsc: panel.isc, moduleImp: panel.imp, tempCoeffVoc: panel.vocCoefficient, temperatureCoeffPmax: panel.pmaxCoefficient } : {}),
    ...(inverter ? { inverterSelection: { selection_mode: "MANUAL", asset_id: inverter.id }, inverterSizingBasis: "manual_review", manualInverterKw: inverter.powerKw, inverterMaxDcV: inverter.maxDcV } : {}),
    ...(battery ? { batterySelection: { selection_mode: "MANUAL", asset_id: battery.id, quantity: selection.batteryQuantity }, batteryModuleKwh: battery.usableKwh, batteryVoltage: battery.nominal_voltage, batteryChemistry: "LFP", dod: 1 } : {}),
    ...(selection.minAmbientC != null ? { minTemp: selection.minAmbientC } : {}),
    ...(selection.altitudeM != null ? { altitude: selection.altitudeM } : {}),
    panelsPerString: selection.modulesPerString || 1,
    panelCost: positivePrice(selection.panelPrice), inverterUnitCost: positivePrice(selection.inverterPrice), batteryModuleCost: positivePrice(selection.batteryPrice),
  };
}

export function equipmentPanelCount(project, fallback) {
  const selection = normalizeEquipmentSelection(project.equipmentSelection);
  const valid = Number.isInteger(selection.modulesPerString) && selection.modulesPerString > 0 && selection.modulesPerString <= 100 && Number.isInteger(selection.stringCount) && selection.stringCount > 0 && selection.stringCount <= 2;
  return selection.enabled ? valid ? selection.modulesPerString * selection.stringCount : 1 : fallback;
}

export function equipmentBatteryCount(project, fallback) {
  const selection = normalizeEquipmentSelection(project.equipmentSelection);
  const valid = Number.isInteger(selection.batteryQuantity) && selection.batteryQuantity > 0 && selection.batteryQuantity <= 6;
  return selection.enabled ? valid ? selection.batteryQuantity : 1 : fallback;
}

export function assessEquipment(project = {}, sizing = {}) {
  const selection = normalizeEquipmentSelection(project.equipmentSelection);
  if (!selection.enabled) return { enabled: false, status: "Unverified", checks: [], quoteReady: true };
  const inverter = getDocumentedAsset(selection.inverterId, "inverters");
  const battery = getDocumentedAsset(selection.batteryId, "batteries");
  const panel = getDocumentedAsset(selection.panelId, "panels");
  const checks = [];
  const add = (code, status, message, source) => checks.push({ code, status, message, source: source || null });
  const check = (code, known, pass, message, source) => add(code, !known ? "Unverified" : pass ? "Verified" : "Incompatible", message, source);
  check("MODELS", inverter && battery && panel, true, "Choose exact documented inverter, battery and module models.");
  check("SOURCE_VERSION", selection.sourceVersion, selection.sourceVersion === EQUIPMENT_CATALOGUE_VERSION, "Source set must match the current catalogue. Reconfirm after a source revision.");
  if (inverter && battery) {
    check("PAIRING", true, battery.compatible_inverter_ids.includes(inverter.id), `${inverter.model} + ${battery.model}: ES G2 pairing listed; mixed battery models are not supported.`, "pairing");
    check("VOLTAGE", true, battery.minVoltage >= inverter.battery_voltage_min && battery.maxVoltage <= inverter.battery_voltage_max, `Battery operating window ${battery.minVoltage}–${battery.maxVoltage} V; inverter ${inverter.battery_voltage_min}–${inverter.battery_voltage_max} V.`, "esg2");
    const armKnown = /^\d{1,3}$/.test(selection.armFirmware) && !!selection.firmwareEvidence;
    check("FIRMWARE", armKnown, Number(selection.armFirmware) >= battery.minimumArm, "ES G2 ARM ≥02 required. Record the device version and where it was checked; a model name alone is insufficient.", "pairing");
    check("COMMUNICATION", selection.protocol, selection.protocol === "CAN", "This inverter uses CAN to the battery BMS; RS485 is not a substitute.", "esg2");
    check("BANK_QUANTITY", selection.batteryQuantity != null, Number.isInteger(selection.batteryQuantity) && selection.batteryQuantity >= 1 && selection.batteryQuantity <= battery.max_parallel_units, "Use 1–6 identical LX U5.4-20 units. Additional units increase energy, not unlimited discharge power.", "lynx");
    const bank = equipmentBankLimits(selection);
    const efficiency = Number(project.batteryEfficiency);
    const requiredEnergy = Math.max(Number(sizing.backupEnergyNeed) || 0, (Number(sizing.evBatteryBufferKwh) || 0) * (Number(project.dod) || 1) * (efficiency || 0));
    check("BATTERY_ENERGY", Number.isFinite(efficiency) && efficiency > 0 && efficiency <= 1 && sizing.backupEnergyNeed != null, bank.usableKwh * efficiency + 1e-9 >= requiredEnergy, `${(bank.usableKwh * (efficiency || 0)).toFixed(2)} kWh after project efficiency vs ${requiredEnergy.toFixed(2)} kWh backup requirement. Published 5.4 kWh is already usable; DoD is not deducted twice.`, "lynx");
    const designPowerKw = Number(sizing.loadBasedInvKw) || (Number(sizing.peakKw) || 0) * (Number(project.inverterHeadroom) || 1.25);
    check("BATTERY_POWER", sizing.peakKw != null && Number.isFinite(efficiency) && efficiency > 0 && efficiency <= 1, bank.powerKw * efficiency + 1e-9 >= designPowerKw, `${(bank.powerKw * (efficiency || 0)).toFixed(2)} kW after project efficiency vs ${designPowerKw.toFixed(2)} kW design peak including headroom. Bank cap is 100 A / 5.12 kW at nominal conditions, with SOC/temperature derating.`, "lynx");
    check("PHASE", project.phase, /single/i.test(project.phase), "This first model family is single-phase only; it does not validate a three-phase design.", "esg2");
    check("AC_VOLTAGE", numberOrNull(project.acVoltage) != null, [220, 230, 240].includes(Number(project.acVoltage)), "Documented nominal AC voltage options are 220 / 230 / 240 V. Country grid settings require separate approval.", "esg2");
    const factor = selection.designPowerFactor;
    check("APPARENT_POWER", factor != null && !!selection.powerFactorEvidence && sizing.peakKw != null, factor > 0 && factor <= 1 && designPowerKw / factor <= inverter.powerKw, `Design peak including headroom / reviewed power factor must fit the ${inverter.powerKw} kVA back-up rating. This does not establish motor starting duration or overload performance.`, "esg2");
    if (project.systemType !== "Solar PV – Hybrid") add("SYSTEM_SCOPE", "Conditional", "This slice checks a grid-connected residential hybrid with backup. Other operating topologies need manufacturer confirmation.", "esg2");
  }
  if (inverter && panel) {
    const series = selection.modulesPerString;
    const strings = selection.stringCount;
    const topology = Number.isInteger(series) && series >= 1 && series <= 100 && Number.isInteger(strings) && strings >= 1 && strings <= inverter.mppts;
    check("TOPOLOGY", series != null && strings != null, topology, "One equal-length string per MPPT; use 1 or 2 strings. Parallel strings and partial last strings are outside this slice.", "esg2");
    const coldVoc = panel.voc * (1 + panel.vocCoefficient * ((selection.minAmbientC ?? 25) - 25)) * 1.03 * (series || 0);
    check("COLD_VOC", selection.minAmbientC != null && series != null, coldVoc <= inverter.maxDcV, `Cold string Voc including +3% voltage tolerance: ${coldVoc.toFixed(1)} V / ${inverter.maxDcV} V absolute maximum.`, "longi");
    check("PV_OPERATION", series != null, coldVoc < inverter.standbyV && panel.vmp * series <= inverter.mpptMaxV, "ES G2 enters standby above 560 V; maximum-input survival voltage is not a valid operating target.", "esg2");
    const hotKnown = selection.hotModuleVmp != null && !!selection.hotVmpEvidence;
    check("HOT_MPPT", hotKnown, selection.hotModuleVmp > 0 && selection.hotModuleVmp <= panel.vmp && selection.hotModuleVmp * series >= inverter.mpptMinV, "Record a reviewed worst-case hot-module Vmp and its calculation/reference; STC Vmp alone cannot verify the hot MPPT window.", "esg2");
    const maxIsc = panel.isc * 1.03 * (1 + panel.iscCoefficient * (85 - 25));
    check("PV_CURRENT", true, panel.imp * 1.03 <= inverter.maxMpptCurrentA && maxIsc <= inverter.maxMpptIscA, `Per-MPPT input limit ${inverter.maxMpptCurrentA} A, short-circuit limit ${inverter.maxMpptIscA} A; Isc check includes +3% tolerance and 85°C cell-temperature allowance.`, "esg2");
    check("PV_POWER", topology, series * strings * panel.watts * (1 + panel.powerTolerance) <= inverter.maxPvW, `Installed STC power plus +3% tolerance must not exceed ${inverter.maxPvW} W; no generic DC:AC ratio can override this.`, "esg2");
    if (panel.vmp * (series || 0) > 490) add("PV_DERATING", "Conditional", "PV input above 490 V progressively limits battery power; obtain a manufacturer derating assessment.", "esg2");
    check("PV_REQUIREMENT", sizing.requiredKwp != null, series * strings * panel.watts / 1000 + 1e-9 >= Number(sizing.requiredKwp), `Installed array must meet ${(Number(sizing.requiredKwp) || 0).toFixed(2)} kWp energy-based requirement; increasing string length still needs voltage checks.`);
  }
  check("SITE_ENVELOPE", selection.minAmbientC != null && selection.maxAmbientC != null && selection.altitudeM != null, selection.minAmbientC >= 0 && selection.maxAmbientC <= 50 && selection.minAmbientC <= selection.maxAmbientC && selection.altitudeM >= 0 && selection.altitudeM <= 2000, "Conservative common envelope: 0–50°C ambient and ≤2000 m; battery charging below 0°C is not approved by this slice. SOC/temperature power derating still requires review.", "lynx");
  if (!["KENYA", "EAST_AFRICA"].includes(selection.market)) add("REGION", "Conditional", "EMEA documents do not establish local grid approval. South African export limits and other markets need a separate regional design review.", "esg2");
  else add("REGION", "Verified", "EMEA technical source set selected. Country grid approval, stock and warranty eligibility are not verified by this match.", "esg2");
  check("PRICES", [selection.panelPrice, selection.inverterPrice, selection.batteryPrice].every((price) => price != null), [selection.panelPrice, selection.inverterPrice, selection.batteryPrice].every((price) => price > 0), "Enter positive KES unit prices for the module, inverter and battery. No manufacturer pricing or stock is assumed.");
  if (selection.priceBasis === "SUPPLIER_QUOTE" && !selection.priceReference) add("PRICE_REFERENCE", "Unverified", "Add the supplier quote reference; otherwise label these prices as estimates.");
  const status = checks.some((item) => item.status === "Incompatible") ? "Incompatible" : checks.some((item) => item.status === "Unverified") ? "Unverified" : checks.some((item) => item.status === "Conditional") ? "Conditional" : "Verified";
  const limits = equipmentBankLimits(selection);
  return { enabled: true, status, checks, quoteReady: status === "Verified", limits, models: { inverter: inverter ? `${inverter.brand} ${inverter.model}` : null, battery: battery ? `${battery.brand} ${battery.model}` : null, panel: panel ? `${panel.brand} ${panel.model}` : null }, catalogueVersion: EQUIPMENT_CATALOGUE_VERSION, sourceRevisions: Object.fromEntries(Object.entries(EQUIPMENT_SOURCES).map(([key, source]) => [key, source.revision])), commercialBasis: selection.priceBasis, scope: "Documented matching checks only, not engineering certification or country grid approval." };
}

export function gateEquipmentSizing(project, sizing) {
  const equipment = assessEquipment(project, sizing);
  if (!equipment.enabled) return sizing;
  return { ...sizing, equipment, quoteReady: sizing.quoteReady !== false && equipment.quoteReady, quoteBlockedReason: sizing.quoteBlockedReason || (!equipment.quoteReady ? `Equipment matching ${equipment.status.toLowerCase()} — review Asset library` : null) };
}

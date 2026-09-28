export const BATTERY_SELECTION_MODES = ["AUTO", "MANUAL"];

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeBatterySelection(raw = {}) {
  const mode = String(raw.selection_mode || raw.selectionMode || "AUTO").toUpperCase();
  return {
    selection_mode: BATTERY_SELECTION_MODES.includes(mode) ? mode : "AUTO",
    asset_id: raw.asset_id || raw.assetId || null,
    quantity: Math.max(0, Math.round(finite(raw.quantity))),
    override_reason: raw.override_reason || raw.overrideReason || null,
    selected_by: raw.selected_by || raw.selectedBy || null,
    selected_at: raw.selected_at || raw.selectedAt || null,
  };
}

export function deriveBatterySelection(requirement = {}, selectionInput = {}, assetInput = {}, inverterInput = {}) {
  const selection = normalizeBatterySelection(selectionInput);
  const asset = assetInput || {};
  const requiredUsableKwh = Math.max(0, finite(requirement.required_usable_kwh ?? requirement.requiredUsableKwh));
  const requiredPowerKw = Math.max(0, finite(requirement.required_power_kw ?? requirement.requiredPowerKw));
  const nominalKwh = Math.max(0, finite(asset.nominal_kwh ?? asset.nominalKwh ?? asset.capacityKwh));
  const usableDod = Math.min(1, Math.max(0.05, finite(asset.usable_dod ?? asset.usableDod, 0.9)));
  const voltage = Math.max(0, finite(asset.nominal_voltage ?? asset.nominalVoltage));
  const continuousCurrentA = Math.max(0, finite(asset.continuous_discharge_a ?? asset.continuousDischargeA));
  const bankContinuousCurrentA = Math.max(0, finite(asset.bank_continuous_discharge_a ?? asset.bankContinuousDischargeA));
  const maxParallel = Math.max(1, Math.round(finite(asset.max_parallel_units ?? asset.maxParallelUnits, 1)));
  const usablePerUnit = nominalKwh * usableDod;
  const recommendedQuantity = usablePerUnit > 0 ? Math.max(1, Math.ceil(requiredUsableKwh / usablePerUnit)) : 0;
  const selectedQuantity = Math.min(recommendedQuantity, maxParallel);
  const installedNominalKwh = nominalKwh * selectedQuantity;
  const estimatedUsableKwh = usablePerUnit * selectedQuantity;
  const availableCurrentA = bankContinuousCurrentA > 0 ? bankContinuousCurrentA : continuousCurrentA * selectedQuantity;
  const availablePowerKw = voltage * availableCurrentA / 1000;
  const issues = [];

  const minVoltage = finite(inverterInput.battery_voltage_min ?? inverterInput.batteryVoltageMin, voltage);
  const maxVoltage = finite(inverterInput.battery_voltage_max ?? inverterInput.batteryVoltageMax, voltage);
  if (voltage <= 0 || voltage < minVoltage || voltage > maxVoltage) {
    issues.push({ code: "BATTERY_VOLTAGE_MISMATCH", message: `Battery nominal voltage ${voltage || "unknown"}V is outside the inverter range ${minVoltage}-${maxVoltage}V.`, suggested_correction: "Choose a compatible battery voltage or inverter." });
  }
  const compatibleIds = Array.isArray(asset.compatible_inverter_ids) ? asset.compatible_inverter_ids : [];
  if (compatibleIds.length > 0 && inverterInput.asset_id && !compatibleIds.includes(inverterInput.asset_id)) {
    issues.push({ code: "BMS_INVERTER_MISMATCH", message: "The selected battery BMS is not listed as compatible with the selected inverter.", suggested_correction: "Use a documented inverter/BMS pairing." });
  }
  if (recommendedQuantity > maxParallel) {
    issues.push({ code: "MAX_PARALLEL_EXCEEDED", message: `${recommendedQuantity} units are required but the asset permits ${maxParallel}.`, suggested_correction: "Choose a larger module or a battery family with a higher parallel limit." });
  }
  if (estimatedUsableKwh + 1e-9 < requiredUsableKwh) {
    issues.push({ code: "INSUFFICIENT_USABLE_KWH", message: `Selected hardware provides ${estimatedUsableKwh.toFixed(2)} usable kWh against ${requiredUsableKwh.toFixed(2)} kWh required.`, suggested_correction: "Increase permitted parallel capacity or choose a larger battery." });
  }
  if (requiredPowerKw > 0 && availablePowerKw + 1e-9 < requiredPowerKw) {
    issues.push({ code: "INSUFFICIENT_DISCHARGE_POWER", message: `Selected hardware provides ${availablePowerKw.toFixed(2)} kW continuous discharge against ${requiredPowerKw.toFixed(2)} kW required.`, suggested_correction: "Use a higher-current battery or a compatible larger bank." });
  }

  const averageBackupKw = Math.max(0, finite(requirement.average_backup_kw ?? requirement.averageBackupKw, requiredPowerKw));
  return {
    selection_mode: selection.selection_mode,
    asset_id: selection.asset_id || asset.id || null,
    required_usable_kwh: requiredUsableKwh,
    required_power_kw: requiredPowerKw,
    recommended_quantity: recommendedQuantity,
    selected_quantity: selectedQuantity,
    installed_nominal_kwh: installedNominalKwh,
    estimated_usable_kwh: estimatedUsableKwh,
    available_continuous_current_a: availableCurrentA,
    available_continuous_power_kw: availablePowerKw,
    autonomy_hours: averageBackupKw > 0 ? estimatedUsableKwh / averageBackupKw : 0,
    compatibility: { status: issues.length === 0 ? "PASS" : "FAIL", issues },
    system_options_recalculated: true,
  };
}

export function batterySelectionResponse(result) {
  return result?.compatibility?.status === "PASS"
    ? { status: 200, body: result }
    : { status: 422, body: { code: "BATTERY_INCOMPATIBLE", issues: result?.compatibility?.issues || [], result } };
}

export const EQUIPMENT_CATALOGUE_VERSION = "2026-10-21.1";

export const EQUIPMENT_SOURCES = Object.freeze({
  esg2: { title: "GoodWe ES G2 EMEA datasheet", revision: "20260430-EMEA-EN-V1.1", region: "EMEA", page: 2, checkedOn: "2026-10-21", url: "https://es.goodwe.com/Ftp/Downloads/Datasheet/EMEA/GW_ES%20G2_Datasheet_EMEA-EN.pdf" },
  lynx: { title: "GoodWe LX U5.4-20 EMEA datasheet", revision: "20231201-EN-EMEA-V1.1", region: "EMEA", page: 2, checkedOn: "2026-10-21", url: "https://gr.goodwe.com/Skippower/downloadFileF?id=2121&mid=60" },
  pairing: { title: "GoodWe battery compatibility overview", revision: "20260910-EMEA-EN-V029.1", region: "EMEA", page: 1, checkedOn: "2026-10-21", url: "https://emea.goodwe.com/Ftp/EN/Downloads/User%20Manual/GW_Battery%20Compatibility%20Overview-EMEA_EN.pdf" },
  longi: { title: "LONGi Hi-MO X6 Explorer datasheet", revision: "20230926V19 DG", region: "Global technical data; local supply unverified", page: 2, checkedOn: "2026-10-21", url: "https://static.longi.com/L_Gi_LE_PM_T_PMD_059_F130_LR_5_54_HTH_420_440_M_30_30_and_15_Frame_Explorer_V19_4448f2931d.pdf" },
});

const inverter = (id, model, powerKw, maxPvW, maxDischargeW) => ({
  id, category: "inverters", brand: "GoodWe", model, capacity: `${powerKw} kVA`, unit: "unit", powerKw,
  phase: "SINGLE_PHASE", battery_voltage_min: 40, battery_voltage_max: 60,
  maxBatteryCurrentA: 120, maxDischargeW, maxPvW, maxDcV: 600, standbyV: 560,
  mpptMinV: 60, mpptMaxV: 550, maxMpptCurrentA: 16, maxMpptIscA: 23, mppts: 2,
  stringsPerMppt: 1, protocol: "CAN", sources: ["esg2", "pairing"],
});

const panel = (id, model, watts, voc, vmp, isc, imp) => ({
  id, category: "panels", brand: "LONGi", model, capacity: `${watts} W`, unit: "panel",
  watts, voc, vmp, isc, imp, vocCoefficient: -0.0023, pmaxCoefficient: -0.0029,
  iscCoefficient: 0.0005, voltageTolerance: 0.03, powerTolerance: 0.03,
  lengthM: 1.722, widthM: 1.134, sources: ["longi"],
});

export const DOCUMENTED_ASSETS = [
  inverter("gw5000_es20", "GW5000-ES-20", 5, 7500, 5300),
  inverter("gw6000_es20", "GW6000-ES-20", 6, 9000, 6300),
  {
    id: "lx_u54_20", category: "batteries", brand: "GoodWe", model: "LX U5.4-20", capacity: "5.4 usable kWh", unit: "module",
    usableKwh: 5.4, nominal_voltage: 51.2, minVoltage: 47.5, maxVoltage: 57.6,
    singleCurrentA: 50, bankCurrentCapA: 100, singlePowerKw: 2.56, bankPowerCapKw: 5.12,
    max_parallel_units: 6, protocol: "CAN", minimumArm: 2,
    compatible_inverter_ids: ["gw5000_es20", "gw6000_es20"], sources: ["lynx", "pairing"],
  },
  panel("longi_430_hth", "LR5-54HTH-430M", 430, 39.13, 32.84, 14.15, 13.10),
  panel("longi_440_hth", "LR5-54HTH-440M", 440, 39.53, 33.24, 14.30, 13.24),
].map((asset) => Object.freeze({
  ...asset, technicalCatalog: true, documented: true, price: null, warranty: "Confirm regional terms",
  supplier: "Not confirmed", stockStatus: "unknown", inventoryLink: null,
  datasheetUrl: EQUIPMENT_SOURCES[asset.sources[0]].url,
  compatibilityNotes: "Use documented equipment matching below; catalogue presence is not system approval.",
}));

export function getDocumentedAsset(id, category) {
  return DOCUMENTED_ASSETS.find((asset) => asset.id === id && (!category || category === asset.category)) || null;
}

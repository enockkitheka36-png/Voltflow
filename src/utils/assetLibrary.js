/**
 * assetLibrary.js — Voltflow 11.7 (Studio: Solar Asset Library foundation)
 *
 * A reusable component catalogue (panels, inverters, batteries, pumps, …). Pure —
 * no React, no DOM, NO supplier API. A seed catalogue plus helpers to browse and
 * to attach selections to a project. Prices/stock are placeholders to be confirmed.
 */

import { getCommercialAvailability, normalizeInventoryLink } from "./inventoryAvailability.js";
import { DOCUMENTED_ASSETS } from "./equipmentCatalogue.js";

export const ASSET_CATEGORIES = [
  { key: "panels", label: "Panels", icon: "🔆", unit: "panel" },
  { key: "inverters", label: "Inverters", icon: "🔁", unit: "unit" },
  { key: "batteries", label: "Batteries", icon: "🔋", unit: "module" },
  { key: "pumps", label: "Pumps", icon: "💧", unit: "unit" },
  { key: "controllers", label: "Controllers / VFD", icon: "🎛️", unit: "unit" },
  { key: "mounting", label: "Mounting", icon: "🧱", unit: "set" },
  { key: "protection", label: "Protection", icon: "🛡️", unit: "set" },
  { key: "cables", label: "Cables", icon: "🧵", unit: "m" },
  { key: "tanks", label: "Tanks", icon: "🛢️", unit: "unit" },
  { key: "ev_chargers", label: "EV chargers", icon: "⚡", unit: "unit" },
  { key: "generators", label: "Generators", icon: "🛢️", unit: "unit" },
  { key: "monitoring", label: "Monitoring", icon: "📡", unit: "unit" },
];

const A = (id, category, brand, model, capacity, unit, price, warranty, extra = {}) => ({
  id, category, brand, model, capacity, unit, price, warranty, technicalCatalog: true,
  ...extra,
  supplier: extra.supplier || "TBD", datasheetUrl: extra.datasheetUrl || "",
  compatibilityNotes: extra.compatibilityNotes || "", stockStatus: extra.stockStatus || "unknown",
  inventoryLink: normalizeInventoryLink(extra.inventoryLink),
});

// Seed catalogue — representative, brand-neutral placeholders. Prices in KES.
export const DEFAULT_ASSETS = [
  A("pnl_550_mono", "panels", "Generic", "Mono PERC 550W", "550 W", "panel", 11000, "12/25 yr", { compatibilityNotes: "Voc suits ≥600V strings" }),
  A("pnl_450_mono", "panels", "Generic", "Mono PERC 450W", "450 W", "panel", 9500, "12/25 yr"),
  A("inv_5k_hyb", "inverters", "Generic", "Hybrid 5kW 48V", "5 kW", "unit", 145000, "5 yr", { phase: "SINGLE_PHASE", battery_voltage_min: 40, battery_voltage_max: 60, compatibilityNotes: "Max DC ~500V; single-phase" }),
  A("inv_10k_hyb", "inverters", "Generic", "Hybrid 10kW 3ph", "10 kW", "unit", 320000, "5 yr", { phase: "THREE_PHASE", battery_voltage_min: 40, battery_voltage_max: 60, compatibilityNotes: "Three-phase; max DC ~1000V" }),
  A("inv_12k_hyb", "inverters", "Generic", "Hybrid 12kW 3ph", "12 kW", "unit", 380000, "5 yr", { phase: "THREE_PHASE", battery_voltage_min: 40, battery_voltage_max: 60 }),
  A("bat_512_lfp", "batteries", "Generic", "LFP 5.12kWh 48V", "5.12 kWh", "module", 240000, "10 yr", { nominal_kwh: 5.12, usable_dod: 0.9, nominal_voltage: 51.2, continuous_discharge_a: 100, maximum_charge_a: 100, max_parallel_units: 16, compatible_inverter_ids: ["inv_5k_hyb", "inv_10k_hyb", "inv_12k_hyb"], compatibilityNotes: "Stackable; BMS comms with inverter" }),
  A("bat_1024_lfp", "batteries", "Generic", "LFP 10.24kWh HV", "10.24 kWh", "module", 460000, "10 yr", { nominal_kwh: 10.24, usable_dod: 0.9, nominal_voltage: 204.8, continuous_discharge_a: 50, maximum_charge_a: 50, max_parallel_units: 8, compatible_inverter_ids: [] }),
  A("pmp_dc_2hp", "pumps", "Generic", "DC solar submersible 2HP", "2 HP", "unit", 145000, "2 yr", { compatibilityNotes: "Confirm against pump curve + TDH" }),
  A("pmp_ac_vfd_5hp", "pumps", "Generic", "AC submersible + VFD 5HP", "5 HP", "unit", 320000, "2 yr"),
  A("ctl_mppt_pump", "controllers", "Generic", "Solar pump controller", "—", "unit", 45000, "2 yr"),
  A("mnt_roof", "mounting", "Generic", "Roof mount rail set", "per panel", "set", 4750, "10 yr"),
  A("prot_dc_ac", "protection", "Generic", "DC/AC protection + SPD kit", "—", "set", 46150, "1 yr"),
  A("cbl_6mm_dc", "cables", "Generic", "DC solar cable 6mm²", "6 mm²", "m", 350, "—"),
  A("tnk_10000", "tanks", "Generic", "Water tank 10,000L", "10,000 L", "unit", 120000, "5 yr"),
  A("ev_l2_22k", "ev_chargers", "Generic", "AC EV charger 22kW", "22 kW", "unit", 210000, "2 yr"),
  A("gen_ats", "generators", "Generic", "Genset ATS + integration", "—", "unit", 85000, "1 yr"),
  A("mon_iot", "monitoring", "Generic", "IoT monitoring gateway", "—", "unit", 20100, "1 yr"),
  ...DOCUMENTED_ASSETS,
];

export function listAssets(category = null, filter = "ALL_ASSETS", inventoryLinks = {}, options = {}) {
  const assets = category ? DEFAULT_ASSETS.filter((a) => a.category === category) : DEFAULT_ASSETS.slice();
  if (filter === "TECHNICAL_CATALOG" || filter === "ALL_ASSETS") return assets;
  if (filter === "AVAILABLE_INVENTORY") {
    return assets.filter((asset) => ["AVAILABLE", "LOW_STOCK"].includes(getCommercialAvailability(asset, inventoryLinks[asset.id], options).state));
  }
  return assets;
}
export function getAsset(id) { return DEFAULT_ASSETS.find((a) => a.id === id) || null; }
export function getCategory(key) { return ASSET_CATEGORIES.find((c) => c.key === key) || null; }

/** A project's chosen asset (references the catalogue id; qty + preferred flag). */
export function createAssetSelection(assetId, { qty = 1, preferred = false } = {}) {
  const a = getAsset(assetId);
  return {
    assetId, category: a?.category || "other", label: a ? `${a.brand} ${a.model}` : assetId,
    qty: Math.max(1, Math.round(Number(qty) || 1)), preferred: !!preferred, addedAt: new Date().toISOString(),
    technicalSnapshot: a ? { manufacturer: a.brand, model: a.model, capacity: a.capacity } : null,
  };
}

export function normalizeAssetSelections(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => s && typeof s === "object" && s.assetId)
    .map((s) => ({
      assetId: s.assetId, category: s.category || getAsset(s.assetId)?.category || "other",
      label: s.label || (getAsset(s.assetId) ? `${getAsset(s.assetId).brand} ${getAsset(s.assetId).model}` : s.assetId),
      qty: Math.max(1, Math.round(Number(s.qty) || 1)), preferred: !!s.preferred, addedAt: s.addedAt || null,
      technicalSnapshot: s.technicalSnapshot || null,
    }))
    .slice(0, 200);
}

/** Placeholder compatibility check (no engine coupling yet). */
export function assetCompatibilityWarning(asset, project = {}) {
  if (!asset) return null;
  if (asset.category === "inverters" && /single/i.test(asset.compatibilityNotes || "") && /Three/i.test(project.phase || "")) {
    return "Selected inverter is single-phase but the project is three-phase — confirm compatibility.";
  }
  if (asset.category === "pumps") return "Confirm pump against the borehole pump curve and total dynamic head.";
  return null;
}

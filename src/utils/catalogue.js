/**
 * catalogue.js — Solarise Pro v10
 * Local default accessory/BOS product catalogue. Pure data — no React, no DOM.
 *
 * Unit costs are estimated planning-level defaults (KES), consistent in scale
 * with the existing project.panelCost/mountingPerPanel/batteryModuleCost
 * defaults — not authoritative supplier pricing. Every field is editable per
 * project via accessoriesCatalogue / accessoryOverrides (see Storage tab).
 * Later this can be backed by a real inventory/Sheet/Supabase source without
 * changing accessoryEngine.js, which only consumes {itemCode, defaultUnitCost}.
 */

const item = (itemCode, category, name, unit, defaultUnitCost, extra = {}) => ({
  itemCode, category, name, unit, defaultUnitCost,
  supplier: "Local distributor", stockStatus: "Check stock", preferredBrand: "", notes: "",
  ...extra,
});

export const CATALOGUE_CATEGORIES = [
  "Mounting", "DC protection", "AC protection", "Battery", "Earthing", "Monitoring", "Consumables",
];

export const DEFAULT_CATALOGUE = [
  // ── Mounting ──────────────────────────────────────────────────────────
  item("MNT-01", "Mounting", "Aluminium mounting rail (4.2 m)", "piece", 3200),
  item("MNT-02", "Mounting", "Rail joiner", "piece", 450),
  item("MNT-03", "Mounting", "L-foot", "piece", 350),
  item("MNT-04", "Mounting", "Hanger bolt", "piece", 180),
  item("MNT-05", "Mounting", "Roof hook (tile/sheet)", "piece", 420),
  item("MNT-06", "Mounting", "Mid clamp", "piece", 250),
  item("MNT-07", "Mounting", "End clamp", "piece", 220),
  item("MNT-08", "Mounting", "Grounding clip", "piece", 150),
  item("MNT-09", "Mounting", "Earthing lug (mounting)", "piece", 120),
  item("MNT-10", "Mounting", "Rail splice kit", "piece", 600),
  item("MNT-11", "Mounting", "EPDM washer", "piece", 60),
  item("MNT-12", "Mounting", "Roof screws (pack of 10)", "pack", 350),
  item("MNT-13", "Mounting", "Walkway / clearance allowance", "lot", 3500, { notes: "Maintenance access strip per row spacing guidance." }),

  // ── DC / PV ───────────────────────────────────────────────────────────
  item("DC-01", "DC protection", "PV cable, red (per m)", "m", 220),
  item("DC-02", "DC protection", "PV cable, black (per m)", "m", 220),
  item("DC-03", "DC protection", "MC4 connector pair", "pair", 350),
  item("DC-04", "DC protection", "MC4 branch connector (Y)", "pair", 650, { notes: "Only where parallel strings are combined outside the inverter." }),
  item("DC-05", "DC protection", "DC isolator", "piece", 4200),
  item("DC-06", "DC protection", "DC fuse holder", "piece", 950),
  item("DC-07", "DC protection", "String fuse", "piece", 280),
  item("DC-08", "DC protection", "DC combiner box", "piece", 8500),
  item("DC-09", "DC protection", "DC surge protection device (SPD)", "piece", 6200),
  item("DC-10", "DC protection", "Cable clips (pack of 50)", "pack", 450),
  item("DC-11", "DC protection", "UV-rated conduit (per m)", "m", 280),
  item("DC-12", "DC protection", "Cable tray (per m)", "m", 650),
  item("DC-13", "DC protection", "Labels & warning stickers (set)", "set", 1200),

  // ── AC ────────────────────────────────────────────────────────────────
  item("AC-01", "AC protection", "AC cable (per m)", "m", 380),
  item("AC-02", "AC protection", "AC isolator", "piece", 3800),
  item("AC-03", "AC protection", "AC breaker (MCB)", "piece", 1500),
  item("AC-04", "AC protection", "Changeover switch", "piece", 8500, { notes: "Only for genset-hybrid or off-grid with manual changeover." }),
  item("AC-05", "AC protection", "Consumer unit / DB upgrade allowance", "lot", 15000),
  item("AC-06", "AC protection", "AC surge protection device (SPD)", "piece", 6800),
  item("AC-07", "AC protection", "RCD / RCBO", "piece", 4500),
  item("AC-08", "AC protection", "Trunking / conduit (per m)", "m", 320),
  item("AC-09", "AC protection", "Glands, lugs & ferrules (set)", "set", 1800),

  // ── Battery ───────────────────────────────────────────────────────────
  item("BAT-01", "Battery", "Battery cable (per m)", "m", 950),
  item("BAT-02", "Battery", "Battery breaker / fuse", "piece", 3200),
  item("BAT-03", "Battery", "Battery rack", "piece", 12000),
  item("BAT-04", "Battery", "Battery communication cable", "piece", 2200),
  item("BAT-05", "Battery", "BMS communication accessories", "set", 3500),
  item("BAT-06", "Battery", "Battery lugs", "piece", 180),
  item("BAT-07", "Battery", "Heat shrink (pack)", "pack", 600),
  item("BAT-08", "Battery", "Cable trunking (per m)", "m", 280),

  // ── Earthing / lightning ─────────────────────────────────────────────
  item("EARTH-01", "Earthing", "Earth rod (1.2 m copper-bonded)", "piece", 2800),
  item("EARTH-02", "Earthing", "Earth cable (per m)", "m", 450),
  item("EARTH-03", "Earthing", "Earth clamp", "piece", 350),
  item("EARTH-04", "Earthing", "Bonding jumper", "piece", 420),
  item("EARTH-05", "Earthing", "Lightning protection allowance", "lot", 35000, { notes: "Include where risk assessment or local code requires an air terminal/down-conductor system." }),
  item("EARTH-06", "Earthing", "Equipotential bonding accessories", "set", 4500),

  // ── Monitoring ────────────────────────────────────────────────────────
  item("MON-01", "Monitoring", "Wi-Fi dongle / monitoring stick", "piece", 8500),
  item("MON-02", "Monitoring", "Smart meter / CT meter", "piece", 12500),
  item("MON-03", "Monitoring", "Data logger", "piece", 45000, { notes: "Recommended for C&I sizing validation — see Load Assessment data logger recommendation." }),
  item("MON-04", "Monitoring", "Router allowance (no Wi-Fi on site)", "piece", 6500),
  item("MON-05", "Monitoring", "SIM router option", "piece", 9500),

  // ── Installation consumables ────────────────────────────────────────
  item("CONS-01", "Consumables", "Labels (set)", "set", 600),
  item("CONS-02", "Consumables", "Cable ties (pack of 100)", "pack", 350),
  item("CONS-03", "Consumables", "Saddles / clips (pack)", "pack", 400),
  item("CONS-04", "Consumables", "Screws, assorted (pack)", "pack", 350),
  item("CONS-05", "Consumables", "Wall plugs (pack)", "pack", 250),
  item("CONS-06", "Consumables", "Silicone / weatherproof sealant", "tube", 850),
  item("CONS-07", "Consumables", "Junction box", "piece", 650),
  item("CONS-08", "Consumables", "Conduit bends", "piece", 180),
  item("CONS-09", "Consumables", "Labour allowance", "lot", 0, { notes: "Default 0 — already covered by project.epcCost. Set a value here only if estimating labour outside that lump sum." }),
  item("CONS-10", "Consumables", "Transport allowance", "lot", 0, { notes: "Default 0 — already covered by project.epcCost. Set a value here only if estimating transport outside that lump sum." }),
];

export function getCatalogueItem(catalogue, itemCode) {
  return (catalogue || DEFAULT_CATALOGUE).find((c) => c.itemCode === itemCode);
}

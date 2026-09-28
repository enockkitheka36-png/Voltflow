export const INVENTORY_STATES = ["CATALOG_ONLY", "AVAILABLE", "LOW_STOCK", "OUT_OF_STOCK", "INVENTORY_STALE", "UNLINKED"];

export function normalizeInventoryLink(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    provider: raw.provider || null,
    external_item_id: raw.external_item_id || raw.externalItemId || null,
    sku: raw.sku || null,
    warehouse_id: raw.warehouse_id || raw.warehouseId || null,
    qty_available: Number.isFinite(Number(raw.qty_available ?? raw.qtyAvailable)) ? Number(raw.qty_available ?? raw.qtyAvailable) : null,
    sales_rate: Number.isFinite(Number(raw.sales_rate ?? raw.salesRate)) ? Number(raw.sales_rate ?? raw.salesRate) : null,
    purchase_rate: Number.isFinite(Number(raw.purchase_rate ?? raw.purchaseRate)) ? Number(raw.purchase_rate ?? raw.purchaseRate) : null,
    synced_at: raw.synced_at || raw.syncedAt || null,
    active: raw.active !== false,
  };
}

export function getCommercialAvailability(asset = {}, linkInput = null, options = {}) {
  const link = normalizeInventoryLink(linkInput || asset.inventoryLink);
  if (!link) return { state: "CATALOG_ONLY", provider: null, available_qty: null, message: "Valid engineering asset; no live inventory source is linked." };
  if (!link.external_item_id || !link.sku || !link.active) return { state: "UNLINKED", provider: link.provider, available_qty: link.qty_available, message: "Inventory mapping requires manual review." };
  const syncedAt = Date.parse(link.synced_at || "");
  const maxAgeMs = Number(options.maxAgeMs) || 24 * 60 * 60 * 1000;
  const nowMs = Number(options.nowMs) || Date.now();
  if (!Number.isFinite(syncedAt) || nowMs - syncedAt > maxAgeMs) return { state: "INVENTORY_STALE", provider: link.provider, available_qty: link.qty_available, message: "Inventory data is stale; confirm availability before procurement." };
  if ((link.qty_available ?? 0) <= 0) return { state: "OUT_OF_STOCK", provider: link.provider, available_qty: link.qty_available, message: "Technically valid asset; current linked inventory is out of stock." };
  const lowStockThreshold = Math.max(1, Number(options.lowStockThreshold) || 2);
  if (link.qty_available <= lowStockThreshold) return { state: "LOW_STOCK", provider: link.provider, available_qty: link.qty_available, message: "Limited linked inventory; reserve or reconfirm stock." };
  return { state: "AVAILABLE", provider: link.provider, available_qty: link.qty_available, message: "Linked inventory reports available stock." };
}

export function procurementWarning(asset, link, requiredQty = 1, options = {}) {
  const availability = getCommercialAvailability(asset, link, options);
  if (availability.state === "AVAILABLE" && availability.available_qty >= requiredQty) return null;
  return { code: `INVENTORY_${availability.state}`, asset_id: asset?.id || null, required_qty: requiredQty, ...availability };
}

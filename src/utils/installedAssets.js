export const INSTALLED_ASSET_TYPES = ["Panel", "Inverter", "Battery", "EV charger", "Controller", "Meter", "Other"];
export const INSTALLED_ASSET_STATUSES = ["recorded", "installed", "commissioning_recorded", "service_required", "retired"];
const text = (value, maximum = 300) => typeof value === "string" ? value.trim().slice(0, maximum) : "";
const dayValid = (value) => { const date = new Date(`${value}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; };

export function normalizeInstalledAsset(raw = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return Object.fromEntries(["id", "type", "manufacturer", "model", "serial", "installedOn", "warrantyUntil", "commissionedOn", "reviewedBy", "testReference", "status", "notes"].map((key) => [key, text(source[key], key === "notes" ? 800 : 300)]));
}

export function validateInstalledAsset(raw, records = []) {
  const asset = normalizeInstalledAsset(raw);
  const errors = [];
  if (!INSTALLED_ASSET_TYPES.includes(asset.type)) errors.push("Choose the equipment type.");
  for (const key of ["manufacturer", "model", "serial"]) if (!asset[key]) errors.push(`Enter the ${key} from the installed equipment.`);
  if (!INSTALLED_ASSET_STATUSES.includes(asset.status)) errors.push("Choose a lifecycle status.");
  for (const key of ["installedOn", "warrantyUntil", "commissionedOn"]) if (asset[key] && !dayValid(asset[key])) errors.push(`Enter a valid ${key} date.`);
  if (asset.status === "installed" && !asset.installedOn) errors.push("Record an installation date before marking the unit installed.");
  if (asset.warrantyUntil && asset.installedOn && asset.warrantyUntil < asset.installedOn) errors.push("Warranty end must not precede installation.");
  if (asset.commissionedOn && asset.installedOn && asset.commissionedOn < asset.installedOn) errors.push("Commissioning must not precede installation.");
  if (asset.status === "commissioning_recorded" && (!asset.installedOn || !asset.commissionedOn || !asset.reviewedBy || !asset.testReference)) errors.push("Recorded commissioning requires installation/commissioning dates, reviewer and test evidence reference.");
  if (asset.status === "retired" && !asset.notes) errors.push("Record the retirement reason and intended repair, take-back or recycling route.");
  if (Array.isArray(records) && records.some((record) => record && record.id !== asset.id && text(record.serial).toUpperCase() === asset.serial.toUpperCase())) errors.push("That serial number already exists in this project's asset register.");
  return { asset, errors, ready: errors.length === 0 };
}

export function upsertInstalledAsset(records = [], raw) {
  const assessment = validateInstalledAsset(raw, records);
  if (!assessment.ready) throw new Error(assessment.errors.join(" "));
  const asset = { ...assessment.asset, id: assessment.asset.id || crypto.randomUUID() };
  return [...(Array.isArray(records) ? records : []).filter((record) => record && typeof record === "object" && !Array.isArray(record) && record.id !== asset.id).map(normalizeInstalledAsset), asset];
}

/**
 * schemaMigration.js — Solarise Pro v10
 * Converts saved/imported project records into the current state shape.
 * Pure functions — no React, no DOM. Used by normalizeLoadedRecord in App.jsx
 * for both "Load" (localStorage) and "Import JSON" so the two paths can't
 * diverge (see App.jsx v8.5 normalizeSimulation/normalizeSurvey for the same
 * pattern this extends).
 */

import { createLoadItem, toLegacyLoads, LOAD_MODES } from "./loadEngine.js";

// Schema stays 11.2 — v11.3 adds no persisted project fields (feedback lives
// under its own localStorage key; export metadata is not part of the schema).
// 11.5 adds project.delivery — new persisted shape, so the schema moves too.
// Old saves without it are migrated by normalizeLoadedRecord.
// 11.5.1 is a polish patch (input UX, preset chips, Project Advisor) — no new
// persisted project shape, so schema stays 11.5.
// 11.5.2 (readiness sync, Action Center, night autonomy) is derived, not persisted.
// 11.6 adds project.borehole + inverter-coherence fields — new persisted shape,
// so the schema moves to 11.6. Old saves are migrated by normalizeLoadedRecord
// (normalizeBorehole + inverter-basis/diversity defaults).
// 11.7 adds project.evidence + project.compliance + project.pilotEvidence +
// borehole test-report/pump-curve fields — persisted, so schema moves to 11.7.
// Old saves migrate via normalizeEvidence/normalizeCompliance/normalizePilotEvidence.
// 11.7.2 is a pilot-safety hotfix (warnings/export metadata only), so the
// persisted project schema remains 11.7.
// 11.8.1 (Runtime Trust Wiring & Proof) is a runtime-trust proof release, NOT a
// feature-breadth release: honest runtime-mode reporting, a release security
// gate that refuses to pass when RLS/storage tests are skipped, and DB-security
// test scripts that report NOT_EXECUTED when live Supabase/Postgres is
// unavailable. Persisted project schema is UNCHANGED and stays 11.7.
export const SCHEMA_VERSION = "11.7";
export const APP_VERSION = "Voltflow 11.8.1";

/** Stable per-project reference, generated once and persisted — not regenerated on every export. */
export function generateProjectRef() {
  return `SOL-${Date.now().toString(36).toUpperCase()}`;
}

function stableLegacyRef(seed = {}) {
  const source = [
    seed?.id,
    seed?.name,
    seed?.savedAt,
    seed?.exportedAt,
    seed?.project?.client,
    seed?.project?.location,
  ].map((value) => String(value || "")).join("|");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `SOL-LEGACY-${(hash >>> 0).toString(36).toUpperCase()}`;
}

export function normalizeProjectRef(raw, seed = {}) {
  return typeof raw === "string" && raw.trim() ? raw : stableLegacyRef(seed);
}

// ─── Load items ──────────────────────────────────────────────────────────

/** Pre-v10 saves only have a flat `loads` array. Convert each row into a full loadItemsV2 entry. */
export function migrateLegacyLoadsToV2(loads = []) {
  if (!Array.isArray(loads)) return [];
  return loads.map((l, index) => createLoadItem({
    id: l?.id != null ? `migrated_${l.id}` : `load_migrated_${index + 1}`,
    name: l?.name || "Load",
    category: "Residential",
    qty: Math.max(1, Number(l?.qty) || 1),
    ratedW: Math.max(0, Number(l?.watts) || 0),
    phase: "single",
    dayHours: Number(l?.dayHours) || 0,
    nightHours: Number(l?.nightHours) || 0,
    surgeMultiplier: Math.max(1, Number(l?.surge) || 1),
    essential: !!l?.critical,
    backupRequired: !!l?.critical,
    dutyCyclePct: 100,
  }));
}

/** Backfill every field on each v2 item (handles a v10 save from an older minor version that's missing a newer field). */
export function normalizeLoadItemsV2(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map((item, index) => createLoadItem({
    ...(item && typeof item === "object" ? item : {}),
    id: item?.id || `load_migrated_${index + 1}`,
  }));
}

/**
 * Resolve the load items for a loaded record: prefer loadItemsV2 if present
 * and well-formed, else migrate the legacy flat `loads` array, else null
 * (caller defaults to the standard residential preset list).
 */
export function resolveLoadItemsV2(record = {}) {
  const v2 = normalizeLoadItemsV2(record?.loadItemsV2);
  if (v2 && v2.length > 0) return v2;
  if (Array.isArray(record?.loads) && record.loads.length > 0) return migrateLegacyLoadsToV2(record.loads);
  return null;
}

export function normalizeLoadAssessmentMode(raw) {
  return LOAD_MODES.some(m => m.value === raw) ? raw : "Residential";
}

// ─── Sizing basis / blueprint / quote pipeline (v11.1) ─────────────────────

export const SIZING_MODES = ["existing_site", "blueprint_new_build", "future_expansion"];

/** Legacy v8.x saves used "standard" — map it to "existing_site". */
export function normalizeSizingMode(raw) {
  if (raw === "standard") return "existing_site";
  return SIZING_MODES.includes(raw) ? raw : "existing_site";
}

export const defaultBlueprintAssumptions = {
  buildingType: "residential_house",   // key from BLUEPRINT_TEMPLATES
  floorAreaM2: 150,
  occupancy: 4,
  scheduleHoursPerDay: 10,
  confidenceLevel: "medium",           // low | medium | high
  futureGrowthPct: 15,
  notes: "",
};

export function normalizeBlueprintAssumptions(raw) {
  const b = { ...defaultBlueprintAssumptions, ...(raw && typeof raw === "object" ? raw : {}) };
  if (!["low", "medium", "high"].includes(b.confidenceLevel)) b.confidenceLevel = "medium";
  return b;
}

/** Manual pipeline stage layered over the computed governance status. */
export const QUOTE_STAGES = ["auto", "Sent", "Won", "Lost"];

export function normalizeQuoteStage(raw) {
  return QUOTE_STAGES.includes(raw) ? raw : "auto";
}

// ─── View mode (v11.4) ─────────────────────────────────────────────────────
// Presentation only — never changes calculations, only what is shown.
export const VIEW_MODES = ["engineer", "client", "technician", "bank"]; // v11.7.1 — Bank Pilot Mode

export function normalizeViewMode(raw) {
  return VIEW_MODES.includes(raw) ? raw : "engineer";
}

// ─── Energy data import summary (v11.2) ────────────────────────────────────
// Only the compact analysis summary is persisted — raw logger rows stay in
// session memory (they can be tens of thousands of rows; localStorage-unsafe).

export function normalizeEnergyImport(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    source: typeof raw.source === "string" ? raw.source : "Data logger",
    importedAt: raw.importedAt || null,
    dateRange: raw.dateRange && typeof raw.dateRange === "object" ? raw.dateRange : { start: null, end: null, days: 0 },
    totalRecords: Number(raw.totalRecords) || 0,
    cleanedRecords: Number(raw.cleanedRecords) || 0,
    intervalMinutes: Number(raw.intervalMinutes) || 0,
    dataQualityScore: Math.max(0, Math.min(100, Number(raw.dataQualityScore) || 0)),
    averageDailyKwh: Number(raw.averageDailyKwh) || 0,
    peakDemandKw: Number(raw.peakDemandKw) || 0,
    p95DemandKw: Number(raw.p95DemandKw) || 0,
    baseLoadKw: Number(raw.baseLoadKw) || 0,
    dayNightSplit: raw.dayNightSplit && typeof raw.dayNightSplit === "object" ? raw.dayNightSplit : { dayPct: 0, nightPct: 0 },
    loadFactor: Number(raw.loadFactor) || 0,
    profileConfidence: ["High", "Medium", "Low"].includes(raw.profileConfidence) ? raw.profileConfidence : "Low",
    gapWarnings: Number(raw.gapWarnings) || 0,
    spikeWarnings: Number(raw.spikeWarnings) || 0,
  };
}

// ─── Accessories state (engine itself lands in Step 3 — shape is stable now
// so old saves never crash even before that lands) ─────────────────────────

export const defaultAccessoriesAssumptions = {
  railStandardLengthM: 4.2,
  lFootSpacingM: 1.1,
  railSafetyAllowance: 2,
  mc4AllowancePct: 5,        // spare MC4 pairs as % of string count
  cableAllowancePct: 10,     // extra cable length for routing/slack
  isolatorCapacityStrings: 2, // strings per DC isolator
  stringFuseRequiredAboveStrings: 2,
  earthRodSpacingM: 6,
  multiFaceExtraMountingPct: 5, // extra rail/fixings allowance when >1 roof face (v11.1)
};

export function normalizeAccessoriesAssumptions(raw) {
  return { ...defaultAccessoriesAssumptions, ...(raw && typeof raw === "object" ? raw : {}) };
}

export function normalizeAccessoryOverrides(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    items: r.items && typeof r.items === "object" ? r.items : {},     // { [itemCode]: {qty, unitCost, excluded, required} }
    manualItems: Array.isArray(r.manualItems) ? r.manualItems : [],
  };
}

export function normalizeAccessoriesCatalogue(raw, defaultCatalogue = []) {
  return Array.isArray(raw) && raw.length > 0 ? raw : defaultCatalogue;
}

// ─── Voltflow Copilot state (engine lands alongside VoltflowCopilot.jsx —
// shape is stable now so old saves never crash before/after that lands) ───

/** Each entry: { id, at (ISO), action, question, response }. Capped to the most recent 50 by the caller. */
export function normalizeCopilotHistory(raw) {
  return Array.isArray(raw) ? raw.filter((h) => h && typeof h === "object") : [];
}

/** Most recent structured design-review result: { at, summary, findings[], warnings[], recommendedAction } or null. */
export function normalizeCopilotLastReview(raw) {
  return raw && typeof raw === "object" ? raw : null;
}

// Re-exported so App.jsx's normalizeLoadedRecord has one place to import migration helpers from.
export { toLegacyLoads };

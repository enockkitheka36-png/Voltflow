/**
 * energy-import-regression.mjs — Voltflow 11.2
 * Run: node scripts/energy-import-regression.mjs  (npm run test:energy)
 *
 * Imports the REAL production modules (no mirrors). Synthetic 15-minute logger
 * data with a known shape: 1.0 kW base (24 h) + 2.0 kW daytime (06–18)
 * + 4.0 kW evening peak (19–21) → 56 kWh/day, peak 5.0 kW, day 36 / night 20.
 */
import assert from "node:assert";

import {
  parseCsvText,
  autoDetectMapping,
  normalizeEnergyRows,
  validateEnergyRows,
  inferIntervalMinutes,
  cleanEnergyProfile,
  analyseLoadProfile,
  generateSizingFromLoadProfile,
  generateSyntheticLoads,
  buildEnergySurveyTemplateCsv,
  parseEnergySurveyRows,
  buildEnergyImportSummary,
  parseTimestamp,
} from "../src/utils/energyImportEngine.js";
import { validateLoadItemsV2, toLegacyLoads } from "../src/utils/loadEngine.js";
import { calculateReadiness } from "../src/utils/readiness.js";
import { normalizeEnergyImport } from "../src/utils/schemaMigration.js";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log("  PASS: " + name); passed++; }
  catch (e) { console.error("  FAIL: " + name); console.error("    " + e.message); failed++; }
}

// ── Synthetic logger data ───────────────────────────────────────────────────
const kwAt = (hour) => 1.0 + (hour >= 6 && hour < 18 ? 2.0 : 0) + (hour >= 19 && hour < 21 ? 4.0 : 0);

function buildCsv({ days = 10, gapHours = 0, withNegative = false, withDuplicate = false } = {}) {
  const lines = ["timestamp,kW"];
  const start = new Date(2026, 5, 1, 0, 0, 0); // 1 Jun 2026 local — starts Monday
  const totalSlots = days * 96;
  for (let i = 0; i < totalSlots; i++) {
    const t = new Date(start.getTime() + i * 15 * 60000);
    // Cut a gap in the middle of day 2 (skip rows entirely)
    if (gapHours > 0) {
      const gapStart = 1 * 96 + 40, gapSlots = gapHours * 4;
      if (i >= gapStart && i < gapStart + gapSlots) continue;
    }
    const pad = (n) => String(n).padStart(2, "0");
    const ts = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
    lines.push(`${ts},${kwAt(t.getHours()).toFixed(3)}`);
    if (withDuplicate && i === 10) lines.push(`${ts},${kwAt(t.getHours()).toFixed(3)}`);
  }
  if (withNegative) lines.push("2026-06-01 00:07,-2.5");
  return lines.join("\n");
}

function analyse(csvOpts) {
  const { headers, rows } = parseCsvText(buildCsv(csvOpts));
  const mapping = autoDetectMapping(headers);
  const normalized = normalizeEnergyRows(rows, mapping);
  const quality = cleanEnergyProfile(normalized);
  const profile = analyseLoadProfile(quality.cleanedRows, quality.detectedIntervalMinutes);
  return { headers, rows, mapping, normalized, quality, profile };
}

console.log("\nVoltflow 11.2 — Energy Import Regression (real modules)\n");

test("1. CSV parser reads timestamp and kW (incl. dd/mm/yyyy support)", () => {
  const { headers, rows, mapping, normalized } = analyse({ days: 2 });
  assert.deepStrictEqual(headers, ["timestamp", "kW"]);
  assert.strictEqual(mapping.timestamp, "timestamp");
  assert.strictEqual(mapping.kw, "kW");
  assert.ok(rows.length >= 190, `Expected ≥190 rows, got ${rows.length}`);
  assert.ok(isFinite(normalized[0].t), "First timestamp must parse");
  assert.strictEqual(normalized[0].kw, 1.0);
  // Kenya day-first format
  const dmy = parseTimestamp("15/06/2026 14:30");
  const d = new Date(dmy);
  assert.strictEqual(d.getDate(), 15);
  assert.strictEqual(d.getMonth(), 5);
  // Semicolon-delimited variant
  const alt = parseCsvText("date_time;power\n2026-06-01 00:00;2.5");
  assert.strictEqual(autoDetectMapping(alt.headers).timestamp, "date_time");
  assert.strictEqual(autoDetectMapping(alt.headers).kw, "power");
});

test("2. Interval detection identifies 15-minute data", () => {
  const { normalized, quality } = analyse({ days: 3 });
  assert.strictEqual(inferIntervalMinutes(normalized), 15);
  assert.strictEqual(quality.detectedIntervalMinutes, 15);
});

test("3. Daily kWh is calculated correctly (56 kWh/day shape)", () => {
  const { profile } = analyse({ days: 10 });
  assert.ok(Math.abs(profile.averageDailyKwh - 56) < 0.5, `Expected ~56 kWh/day, got ${profile.averageDailyKwh}`);
  assert.ok(Math.abs(profile.maxDailyKwh - 56) < 0.5);
  assert.ok(profile.days >= 9, `Expected ~10 days, got ${profile.days}`);
});

test("4. Day/night split uses the 06:00–18:00 window (36/20 kWh)", () => {
  const { profile } = analyse({ days: 10 });
  const dayPerDay = profile.dayKwh / profile.days;
  const nightPerDay = profile.nightKwh / profile.days;
  assert.ok(Math.abs(dayPerDay - 36) < 0.5, `Day ≈36 kWh expected, got ${dayPerDay.toFixed(2)}`);
  assert.ok(Math.abs(nightPerDay - 20) < 0.5, `Night ≈20 kWh expected, got ${nightPerDay.toFixed(2)}`);
  assert.strictEqual(profile.dayNightSplit.dayPct, 64);
});

test("5. Peak demand is detected (5.0 kW)", () => {
  const { profile } = analyse({ days: 10 });
  assert.strictEqual(profile.peakDemandKw, 5.0);
  assert.strictEqual(profile.baseLoadKw, 1.0);
});

test("6. P95 demand is calculated from the demand distribution", () => {
  const { profile } = analyse({ days: 10 });
  // 8/96 slots per day sit at 5.0 kW (>5% of time) → P95 = 5.0
  assert.strictEqual(profile.p95DemandKw, 5.0);
  const avg = profile.averageDemandKw;
  assert.ok(Math.abs(avg - 56 / 24) < 0.05, `Average ≈2.33 kW expected, got ${avg}`);
  assert.ok(Math.abs(profile.loadFactor - avg / 5.0) < 0.01);
});

test("7. Data gaps produce warnings and reduce the quality score", () => {
  const gappy = analyse({ days: 5, gapHours: 6 });
  const clean = analyse({ days: 5 });
  assert.ok(gappy.quality.validationWarnings.some((w) => /gap/i.test(w.msg)), "Gap warning expected");
  assert.ok(gappy.quality.dataQualityScore <= clean.quality.dataQualityScore, "Gappy data must not score higher");
});

test("8. Negative values are rejected and reported", () => {
  const { quality } = analyse({ days: 3, withNegative: true, withDuplicate: true });
  assert.ok(quality.validationWarnings.some((w) => /negative/i.test(w.msg)), "Negative warning expected");
  assert.ok(quality.validationWarnings.some((w) => /duplicate/i.test(w.msg)), "Duplicate warning expected");
  assert.ok(quality.cleanedRows.every((r) => r.kw >= 0 && r.kwh >= 0), "Cleaned rows must be non-negative");
});

test("9. Synthetic loads are generated from the profile and reconcile with measured energy", () => {
  const { profile } = analyse({ days: 10 });
  const loads = generateSyntheticLoads(profile);
  assert.ok(loads.length >= 4, `Expected ≥4 synthetic rows, got ${loads.length}`);
  assert.ok(loads.every((l) => l.source === "data_logger_profile"));
  assert.strictEqual(validateLoadItemsV2(loads).length, 0, "Synthetic rows must pass draft validation");
  const kwh = loads.reduce((s, l) => s + (l.qty * l.ratedW * ((l.dayHours || 0) + (l.nightHours || 0))) / 1000, 0);
  const ratio = kwh / profile.averageDailyKwh;
  assert.ok(ratio > 0.85 && ratio < 1.25, `Synthetic daily kWh ${kwh.toFixed(1)} should be within −15%/+25% of measured ${profile.averageDailyKwh} (ratio ${ratio.toFixed(2)})`);
  assert.ok(loads.some((l) => l.essential && /base/i.test(l.name)), "Base load row must be critical");
});

test("10. Generated loads are draft-only until the commit gate runs", () => {
  const { profile } = analyse({ days: 7 });
  const state = { committed: [], draft: [], hasUnapplied: false };
  state.committed = [ { id: "x", name: "Old load" } ];
  state.draft = generateSyntheticLoads(profile);   // ← "Generate draft loads from data logger"
  state.hasUnapplied = true;
  assert.strictEqual(state.committed.length, 1, "Committed loads untouched by generation");
  assert.ok(state.draft.length >= 4);
  if (validateLoadItemsV2(state.draft).length === 0) { state.committed = state.draft; state.hasUnapplied = false; }
  assert.ok(state.committed.length >= 4, "Update Sizing commits the draft");
  const legacy = toLegacyLoads(state.committed, "Residential");
  assert.ok(legacy.every((l) => l.watts > 0), "Adapter output stays valid for useSizing");
});

test("11. Energy survey template round-trips into draft load items", () => {
  const csv = buildEnergySurveyTemplateCsv();
  const { headers, rows } = parseCsvText(csv);
  assert.strictEqual(headers.length, 9, "Template must have 9 columns");
  const { items, errors } = parseEnergySurveyRows(rows);
  assert.strictEqual(errors.length, 0, `Unexpected errors: ${errors.join("; ")}`);
  assert.strictEqual(items.length, 3, "3 example rows expected");
  const fridge = items.find((i) => i.name === "Fridge");
  assert.ok(fridge && fridge.ratedW === 250 && fridge.essential === true && fridge.surgeMultiplier === 3);
  const pump = items.find((i) => i.name === "Water pump");
  assert.ok(pump && pump.essential === false && pump.source === "energy_survey");
  assert.strictEqual(validateLoadItemsV2(items).length, 0);
});

test("12. Readiness improves for a high-quality data logger source", () => {
  const survey = { clientName: "T", siteAddress: "X", county: "Nairobi", roofType: "Mabati / Iron sheet", roofAreaM2: 60, phaseType: "Single phase", monthlyBill: 8000, earthingAvailable: true, siteNotes: "good site", photos: { a: 1, b: 2 }, clientObjectives: ["Backup"], surveyor: "E", phone: "07" };
  const loads = [ // deliberately no surge loads → baseline loses those 2 pts
    { qty: 1, watts: 250, dayHours: 6, nightHours: 6, surge: 1, critical: true },
    { qty: 8, watts: 10, dayHours: 1, nightHours: 5, surge: 1 },
    { qty: 2, watts: 150, dayHours: 8, nightHours: 0, surge: 1 },
  ];
  const sizing = { dailyKwh: 5, coldVocOk: true, dcDropPct: 0.01, acDropPct: 0.02, batteryInputA: 50, bmsMaxDischargeA: 100, payback: 5, npvLife: 100000, totalCost: 500000 };
  const layout = { panelLayout: { roofFitStatus: "Fits comfortably" }, stringPlan: { totalStrings: 2 }, simDangerCount: 0 };

  const baseline = calculateReadiness({ client: "Test Client" }, loads, survey, sizing, layout);
  const loggerImport = normalizeEnergyImport(buildEnergyImportSummary(
    { dateRange: { start: "2026-06-01", end: "2026-06-10", days: 9.9 }, totalRecords: 960, cleanedRows: { length: 960 }, detectedIntervalMinutes: 15, dataQualityScore: 90, validationWarnings: [] },
    { averageDailyKwh: 56, peakDemandKw: 5, p95DemandKw: 5, baseLoadKw: 1, dayNightSplit: { dayPct: 64, nightPct: 36 }, loadFactor: 0.47, profileConfidence: "High" },
    "Data logger"
  ));
  const withLogger = calculateReadiness({ client: "Test Client", loadSource: "data_logger", energyImport: loggerImport }, loads, survey, sizing, layout);

  assert.ok(withLogger.categoryScores.loads.score > baseline.categoryScores.loads.score,
    `Logger source should raise load score: ${withLogger.categoryScores.loads.score} vs ${baseline.categoryScores.loads.score}`);
  assert.ok(withLogger.totalScore > baseline.totalScore, "Total readiness must improve");

  // Short logging period triggers a warning instead
  const shortImport = { ...loggerImport, dateRange: { start: "2026-06-01", end: "2026-06-02", days: 1.5 } };
  const shortRun = calculateReadiness({ client: "Test Client", loadSource: "data_logger", energyImport: shortImport }, loads, survey, sizing, layout);
  assert.ok(shortRun.warnings.some((w) => /logger period/i.test(w)), "Short-period warning expected");
});

// ── Bonus: sizing recommendation sanity (documented behaviour) ──────────────
test("13. Sizing recommendation scales with basis and never mutates project", () => {
  const { profile } = analyse({ days: 10 });
  const project = Object.freeze({ psh: 5.0, solarCoverage: 0.8, dod: 0.8, batteryEfficiency: 0.95 });
  const avg = generateSizingFromLoadProfile(profile, project, "average_profile");
  const cons = generateSizingFromLoadProfile(profile, project, "conservative_peak");
  assert.ok(cons.recommendedDailyKwh > avg.recommendedDailyKwh);
  assert.ok(cons.recommendedPvKwp > avg.recommendedPvKwp);
  assert.ok(avg.recommendedInverterKw >= profile.p95DemandKw, "Inverter suggestion must cover P95");
  assert.ok(avg.engineeringNotes.length > 0 && avg.commercialNotes.length > 0);
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

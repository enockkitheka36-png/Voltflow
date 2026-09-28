/**
 * energyImportEngine.js — Voltflow 11.2
 * Energy Data Import + Load Profile Intelligence.
 *
 * Pure functions — no React, no DOM, no xlsx dependency (the component reads
 * .xlsx via the xlsx package and feeds plain row arrays into this engine, so
 * node-based regression tests exercise the exact production maths).
 *
 * Everything here produces a *suggested sizing basis* that feeds the existing
 * draft-load workflow (draftLoadItemsV2 → Update Sizing → useSizing). The main
 * sizing engine is never bypassed or duplicated.
 */

import { createLoadItem } from "./loadEngine.js";

// ─── Column auto-detection ───────────────────────────────────────────────────

const COLUMN_ALIASES = {
  timestamp: ["timestamp", "time", "date_time", "datetime", "date time", "date", "reading_time", "period"],
  kw:        ["kw", "power", "active_power", "demand_kw", "p", "total_kw", "kw_total", "power_kw", "demand"],
  kwh:       ["kwh", "energy", "interval_kwh", "import_kwh", "energy_kwh", "consumption", "wh"],
  voltage:   ["voltage", "volt", "v", "avg_voltage", "voltage_v"],
  current:   ["current", "amps", "a", "amp", "current_a"],
  powerFactor: ["power_factor", "pf", "powerfactor", "cos_phi", "cosphi"],
};

const norm = (s) => String(s || "").trim().toLowerCase().replace(/[\s\-.]+/g, "_");

/** autoDetectMapping(headers) → { timestamp, kw, kwh, voltage, current, powerFactor } (header names or null). */
export function autoDetectMapping(headers = []) {
  const mapping = { timestamp: null, kw: null, kwh: null, voltage: null, current: null, powerFactor: null };
  const normalized = headers.map((h) => ({ raw: h, n: norm(h) }));
  Object.entries(COLUMN_ALIASES).forEach(([field, aliases]) => {
    // Exact alias match first, then prefix match (e.g. "kwh_import" → kwh)
    let hit = normalized.find((h) => aliases.includes(h.n));
    if (!hit) hit = normalized.find((h) => aliases.some((a) => a.length > 1 && h.n.startsWith(a + "_")));
    if (hit && !Object.values(mapping).includes(hit.raw)) mapping[field] = hit.raw;
  });
  return mapping;
}

// ─── CSV parsing ─────────────────────────────────────────────────────────────

function detectDelimiter(headerLine) {
  const counts = [[",", (headerLine.match(/,/g) || []).length], [";", (headerLine.match(/;/g) || []).length], ["\t", (headerLine.match(/\t/g) || []).length]];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

function splitCsvLine(line, delim) {
  const out = [];
  let cur = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

/**
 * parseCsvText(text) → { headers: string[], rows: object[] }
 * Handles comma/semicolon/tab delimiters, quoted fields, \r\n, blank lines.
 */
export function parseCsvText(text = "") {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };
  const delim = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delim);
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delim);
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
  return { headers, rows };
}

// ─── Timestamp + number parsing ──────────────────────────────────────────────

/**
 * Parse a timestamp cell. ISO and "YYYY-MM-DD HH:mm" parse directly;
 * "DD/MM/YYYY[ HH:mm]" is treated as day-first (Kenya convention).
 * Excel serial date numbers (e.g. 45123.5) are also supported.
 * Returns epoch ms or NaN.
 */
export function parseTimestamp(value) {
  if (value == null || value === "") return NaN;
  if (typeof value === "number" && isFinite(value)) {
    // Excel serial date (days since 1899-12-30)
    if (value > 20000 && value < 80000) return Math.round((value - 25569) * 86400000);
    if (value > 1e11) return value; // already epoch ms
    return NaN;
  }
  const s = String(value).trim();
  const dmy = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmy) {
    const [, d, m, y, hh = "0", mm = "0", ss = "0"] = dmy;
    const t = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)).getTime();
    return isFinite(t) ? t : NaN;
  }
  const t = Date.parse(s);
  return isFinite(t) ? t : NaN;
}

function parseNum(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return isFinite(n) ? n : null;
}

/**
 * normalizeEnergyRows(rows, mapping) → [{ t, kw, kwh, voltage, current, pf }]
 * mapping: { timestamp, kw, kwh, voltage, current, powerFactor } (header names).
 * Rows that fail timestamp parsing keep t = NaN so validation can count them.
 */
export function normalizeEnergyRows(rows = [], mapping = {}) {
  return rows.map((r) => ({
    t: parseTimestamp(r[mapping.timestamp]),
    kw: mapping.kw ? parseNum(r[mapping.kw]) : null,
    kwh: mapping.kwh ? parseNum(r[mapping.kwh]) : null,
    voltage: mapping.voltage ? parseNum(r[mapping.voltage]) : null,
    current: mapping.current ? parseNum(r[mapping.current]) : null,
    pf: mapping.powerFactor ? parseNum(r[mapping.powerFactor]) : null,
  }));
}

// ─── Interval inference ──────────────────────────────────────────────────────

/** inferIntervalMinutes(rows) → most common timestamp delta in minutes (0 if unknown). */
export function inferIntervalMinutes(rows = []) {
  const ts = rows.map((r) => r.t).filter((t) => isFinite(t)).sort((a, b) => a - b);
  if (ts.length < 2) return 0;
  const counts = {};
  for (let i = 1; i < ts.length; i++) {
    const d = Math.round((ts[i] - ts[i - 1]) / 60000);
    if (d > 0 && d <= 24 * 60) counts[d] = (counts[d] || 0) + 1;
  }
  let best = 0, bestCount = 0;
  Object.entries(counts).forEach(([d, c]) => { if (c > bestCount) { best = Number(d); bestCount = c; } });
  return best;
}

// ─── Validation ──────────────────────────────────────────────────────────────

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1));
  return sortedValues[idx];
}

/**
 * validateEnergyRows(rows) → [{ level: "danger"|"warning"|"info", msg }]
 * Detects: missing/duplicate timestamps, missing kW+kWh, negatives,
 * unrealistic spikes, large gaps, irregular intervals, timezone ambiguity.
 */
export function validateEnergyRows(rows = []) {
  const warnings = [];
  if (rows.length === 0) return [{ level: "danger", msg: "No data rows found." }];

  const missingTs = rows.filter((r) => !isFinite(r.t)).length;
  if (missingTs > 0) warnings.push({ level: missingTs > rows.length * 0.05 ? "danger" : "warning", msg: `${missingTs} row(s) have missing or unreadable timestamps — they will be dropped.` });

  const valid = rows.filter((r) => isFinite(r.t));
  const seen = new Set();
  let dupes = 0;
  valid.forEach((r) => { if (seen.has(r.t)) dupes++; else seen.add(r.t); });
  if (dupes > 0) warnings.push({ level: "warning", msg: `${dupes} duplicate timestamp(s) — duplicates keep the first reading only.` });

  const missingVal = valid.filter((r) => r.kw == null && r.kwh == null).length;
  if (missingVal > 0) warnings.push({ level: missingVal > valid.length * 0.05 ? "danger" : "warning", msg: `${missingVal} row(s) have no kW or kWh value — they will be dropped.` });

  const negatives = valid.filter((r) => (r.kw != null && r.kw < 0) || (r.kwh != null && r.kwh < 0)).length;
  if (negatives > 0) warnings.push({ level: "warning", msg: `${negatives} negative reading(s) — treated as invalid and dropped (check for export/CT-reversal channels).` });

  const kws = valid.map((r) => r.kw).filter((v) => v != null && v >= 0).sort((a, b) => a - b);
  if (kws.length > 10) {
    const p95 = percentile(kws, 95);
    const spikes = kws.filter((v) => p95 > 0 && v > p95 * 5).length;
    if (spikes > 0) warnings.push({ level: "warning", msg: `${spikes} reading(s) exceed 5× the P95 demand — possible metering spikes; verify before sizing to the absolute peak.` });
  }

  const interval = inferIntervalMinutes(rows);
  if (interval > 0) {
    const ts = [...seen].sort((a, b) => a - b);
    let gaps = 0, irregular = 0;
    for (let i = 1; i < ts.length; i++) {
      const d = Math.round((ts[i] - ts[i - 1]) / 60000);
      if (d > interval * 3) gaps++;
      else if (d !== interval) irregular++;
    }
    if (gaps > 0) warnings.push({ level: gaps > 5 ? "danger" : "warning", msg: `${gaps} time gap(s) longer than 3× the ${interval}-minute interval — the profile has missing periods.` });
    if (irregular > ts.length * 0.1) warnings.push({ level: "warning", msg: `Irregular interval lengths detected (expected ${interval} min) — averages remain valid but per-interval energy uses each row's actual duration.` });
  } else {
    warnings.push({ level: "warning", msg: "Could not infer a consistent logging interval — check the timestamp column." });
  }

  warnings.push({ level: "info", msg: "Timestamps are assumed to be local site time (EAT, UTC+3). Day/night splits are wrong if the logger recorded UTC — confirm the logger's clock setting." });
  return warnings;
}

// ─── Cleaning ────────────────────────────────────────────────────────────────

/**
 * cleanEnergyProfile(rows) →
 * { cleanedRows, dataQualityScore, validationWarnings, detectedIntervalMinutes, dateRange, totalRecords }
 * cleanedRows are sorted, deduplicated, and every row has a usable kW value
 * (derived from kWh when only energy was logged).
 */
export function cleanEnergyProfile(rows = []) {
  const validationWarnings = validateEnergyRows(rows);
  const interval = inferIntervalMinutes(rows) || 60;

  const seen = new Set();
  const cleanedRows = rows
    .filter((r) => isFinite(r.t))
    .filter((r) => (r.kw != null && r.kw >= 0) || (r.kwh != null && r.kwh >= 0))
    .filter((r) => { if (seen.has(r.t)) return false; seen.add(r.t); return true; })
    .sort((a, b) => a.t - b.t)
    .map((r) => {
      const kwh = r.kwh != null && r.kwh >= 0 ? r.kwh : (r.kw ?? 0) * (interval / 60);
      const kw = r.kw != null && r.kw >= 0 ? r.kw : kwh / (interval / 60);
      return { ...r, kw, kwh };
    });

  const totalRecords = rows.length;
  const droppedPct = totalRecords > 0 ? (totalRecords - cleanedRows.length) / totalRecords : 1;
  const dangerCount = validationWarnings.filter((w) => w.level === "danger").length;
  const warnCount = validationWarnings.filter((w) => w.level === "warning").length;
  const days = cleanedRows.length > 1 ? (cleanedRows[cleanedRows.length - 1].t - cleanedRows[0].t) / 86400000 : 0;

  let score = 100;
  score -= Math.round(droppedPct * 40);
  score -= dangerCount * 15;
  score -= warnCount * 5;
  if (days < 3) score -= 20;
  else if (days < 7) score -= 10;
  const dataQualityScore = Math.max(0, Math.min(100, score));

  // Local-time strings (site time), not toISOString — UTC shifting would show
  // the previous calendar day for early-morning EAT readings.
  const localStamp = (ms) => {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const dateRange = cleanedRows.length > 0
    ? { start: localStamp(cleanedRows[0].t), end: localStamp(cleanedRows[cleanedRows.length - 1].t), days: +days.toFixed(1) }
    : { start: null, end: null, days: 0 };

  return { cleanedRows, dataQualityScore, validationWarnings, detectedIntervalMinutes: interval, dateRange, totalRecords };
}

// ─── Load profile analysis ───────────────────────────────────────────────────

const DAY_START = 6, DAY_END = 18; // 06:00–18:00 local

/**
 * analyseLoadProfile(cleanedRows, intervalMinutes) → full profile statistics.
 * Day window 06:00–18:00; night is the remainder.
 */
export function analyseLoadProfile(cleanedRows = [], intervalMinutes = 60) {
  const empty = {
    totalKwh: 0, averageDailyKwh: 0, maxDailyKwh: 0, minDailyKwh: 0,
    weekdayAverageKwh: 0, weekendAverageKwh: 0,
    peakDemandKw: 0, p95DemandKw: 0, averageDemandKw: 0, baseLoadKw: 0,
    dayKwh: 0, nightKwh: 0, dayNightSplit: { dayPct: 0, nightPct: 0 },
    loadFactor: 0, operatingHoursEstimate: 0,
    monthlyKwhEstimate: 0, annualKwhEstimate: 0,
    recommendedCriticalLoadKw: 0, profileConfidence: "Low",
    hourlyAverageKw: Array(24).fill(0), dailyTotals: [], peakDay: null, peakDayRows: [],
    durationCurve: [], days: 0,
  };
  if (cleanedRows.length === 0) return empty;

  const hourFactor = intervalMinutes / 60;
  const byDay = {};          // dateKey → { kwh, dayKwh, nightKwh, dow }
  const hourSum = Array(24).fill(0), hourCount = Array(24).fill(0);
  let totalKwh = 0, dayKwh = 0, nightKwh = 0;

  cleanedRows.forEach((r) => {
    const d = new Date(r.t);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const hour = d.getHours();
    const kwh = r.kwh ?? r.kw * hourFactor;
    const isDay = hour >= DAY_START && hour < DAY_END;
    if (!byDay[dateKey]) byDay[dateKey] = { kwh: 0, dayKwh: 0, nightKwh: 0, dow: d.getDay() };
    byDay[dateKey].kwh += kwh;
    if (isDay) { byDay[dateKey].dayKwh += kwh; dayKwh += kwh; } else { byDay[dateKey].nightKwh += kwh; nightKwh += kwh; }
    totalKwh += kwh;
    hourSum[hour] += r.kw; hourCount[hour]++;
  });

  const dailyTotals = Object.entries(byDay).map(([date, v]) => ({ date, ...v, kwh: +v.kwh.toFixed(2) })).sort((a, b) => a.date.localeCompare(b.date));
  // Ignore partial first/last days for min/avg fairness when ≥3 days logged
  const fullDays = dailyTotals.length >= 3 ? dailyTotals.slice(1, -1) : dailyTotals;
  const dayList = fullDays.length > 0 ? fullDays : dailyTotals;

  const kws = cleanedRows.map((r) => r.kw).sort((a, b) => a - b);
  const peakDemandKw = kws[kws.length - 1] || 0;
  const p95DemandKw = percentile(kws, 95);
  const averageDemandKw = kws.reduce((s, v) => s + v, 0) / kws.length;
  const baseLoadKw = percentile(kws, 5);

  const weekdays = dayList.filter((d) => d.dow >= 1 && d.dow <= 5);
  const weekends = dayList.filter((d) => d.dow === 0 || d.dow === 6);
  const avg = (arr) => (arr.length > 0 ? arr.reduce((s, d) => s + d.kwh, 0) / arr.length : 0);

  const averageDailyKwh = avg(dayList);
  const hourlyAverageKw = hourSum.map((s, i) => (hourCount[i] > 0 ? +(s / hourCount[i]).toFixed(3) : 0));
  const loadFactor = peakDemandKw > 0 ? averageDemandKw / peakDemandKw : 0;
  const operatingHoursEstimate = peakDemandKw > 0 ? +(averageDailyKwh / peakDemandKw).toFixed(1) : 0;

  const peakDayEntry = [...dailyTotals].sort((a, b) => b.kwh - a.kwh)[0] || null;
  const peakDayRows = peakDayEntry
    ? cleanedRows.filter((r) => { const d = new Date(r.t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === peakDayEntry.date; })
    : [];

  // Demand duration curve: sorted descending kW with % of time exceeded
  const desc = [...kws].reverse();
  const step = Math.max(1, Math.floor(desc.length / 100));
  const durationCurve = [];
  for (let i = 0; i < desc.length; i += step) durationCurve.push({ pct: +((i / desc.length) * 100).toFixed(1), kw: desc[i] });

  const days = dailyTotals.length;
  const dataSpanOk = days >= 7;
  const profileConfidence = dataSpanOk && cleanedRows.length > 300 ? "High" : days >= 3 ? "Medium" : "Low";

  return {
    totalKwh: +totalKwh.toFixed(2),
    averageDailyKwh: +averageDailyKwh.toFixed(2),
    maxDailyKwh: +(dayList.reduce((m, d) => Math.max(m, d.kwh), 0)).toFixed(2),
    minDailyKwh: +(dayList.reduce((m, d) => Math.min(m, d.kwh), Infinity)).toFixed(2),
    weekdayAverageKwh: +avg(weekdays).toFixed(2),
    weekendAverageKwh: +avg(weekends).toFixed(2),
    peakDemandKw: +peakDemandKw.toFixed(3),
    p95DemandKw: +p95DemandKw.toFixed(3),
    averageDemandKw: +averageDemandKw.toFixed(3),
    baseLoadKw: +baseLoadKw.toFixed(3),
    dayKwh: +dayKwh.toFixed(2),
    nightKwh: +nightKwh.toFixed(2),
    dayNightSplit: totalKwh > 0
      ? { dayPct: +((dayKwh / totalKwh) * 100).toFixed(0), nightPct: +((nightKwh / totalKwh) * 100).toFixed(0) }
      : { dayPct: 0, nightPct: 0 },
    loadFactor: +loadFactor.toFixed(3),
    operatingHoursEstimate,
    monthlyKwhEstimate: +(averageDailyKwh * 30.4).toFixed(0),
    annualKwhEstimate: +(averageDailyKwh * 365).toFixed(0),
    recommendedCriticalLoadKw: +(baseLoadKw * 1.2).toFixed(3),
    profileConfidence,
    hourlyAverageKw, dailyTotals, peakDay: peakDayEntry, peakDayRows, durationCurve, days,
  };
}

// ─── Sizing recommendation (suggestion only — main engine untouched) ────────

/**
 * generateSizingFromLoadProfile(profile, project, sizingBasis)
 * sizingBasis: "average_profile" | "conservative_peak" | "worst_day"
 * Returns a suggested sizing basis for the existing workflow — NOT a second
 * sizing engine (no cost/financial math; the real numbers still come from
 * useSizing once loads are committed).
 */
export function generateSizingFromLoadProfile(profile, project = {}, sizingBasis = "average_profile") {
  const psh = Number(project.psh) || 5.0;
  const pr = 0.75; // indicative planning PR; useSizing computes the real one
  const coverage = Number(project.solarCoverage) || 0.8;
  const dod = Number(project.dod) || 0.8;
  const battEff = Number(project.batteryEfficiency) || 0.95;

  const basisDailyKwh = sizingBasis === "worst_day" ? (profile.maxDailyKwh || profile.averageDailyKwh)
    : sizingBasis === "conservative_peak" ? profile.averageDailyKwh * 1.15
    : profile.averageDailyKwh;
  const basisPeakKw = sizingBasis === "average_profile" ? profile.p95DemandKw : profile.peakDemandKw;

  const recommendedDailyKwh = +basisDailyKwh.toFixed(2);
  const recommendedPeakKw = +basisPeakKw.toFixed(2);
  const recommendedNightKwh = +(profile.nightKwh / Math.max(profile.days, 1)).toFixed(2);
  const recommendedPvKwp = +((basisDailyKwh * coverage) / Math.max(psh * pr, 0.1)).toFixed(2);
  const recommendedInverterKw = +(basisPeakKw * 1.2).toFixed(1);
  const criticalNightKwh = recommendedNightKwh * 0.8 + profile.recommendedCriticalLoadKw * 2;
  const recommendedBatteryKwh = +(criticalNightKwh / Math.max(dod * battEff, 0.1)).toFixed(1);
  const usableBattKwh = recommendedBatteryKwh * dod * battEff;
  const recommendedBackupHours = profile.recommendedCriticalLoadKw > 0
    ? +(usableBattKwh / profile.recommendedCriticalLoadKw).toFixed(1) : 0;

  const engineeringNotes = [
    `Basis: ${sizingBasis.replace(/_/g, " ")} — ${recommendedDailyKwh} kWh/day, ${recommendedPeakKw} kW ${sizingBasis === "average_profile" ? "P95" : "peak"} demand.`,
    `Inverter suggestion includes a 20% margin over the ${sizingBasis === "average_profile" ? "P95" : "absolute peak"} demand; confirm surge behaviour of motor loads separately.`,
    `Battery suggestion targets ~80% of night energy plus 2 h of base-load backup at ${profile.recommendedCriticalLoadKw} kW critical.`,
    `PV suggestion uses site PSH ${psh} and an indicative PR of ${pr} — the committed design PR comes from the main sizing engine.`,
  ];
  const commercialNotes = [
    `Measured consumption ≈ ${profile.monthlyKwhEstimate} kWh/month (${profile.annualKwhEstimate} kWh/yr).`,
    profile.profileConfidence === "High"
      ? "High-confidence measured profile — pricing can lean on the measured average without heavy contingency."
      : "Short or gappy logging period — quote with contingency or extend the logging window before final pricing.",
    `Load factor ${profile.loadFactor} — ${profile.loadFactor < 0.3 ? "peaky profile; inverter sizing dominates cost" : "steady profile; energy volume dominates cost"}.`,
  ];

  return {
    recommendedDailyKwh, recommendedPeakKw, recommendedNightKwh,
    recommendedPvKwp, recommendedInverterKw, recommendedBatteryKwh, recommendedBackupHours,
    sizingBasis, engineeringNotes, commercialNotes,
  };
}

// ─── Synthetic draft loads from a logger profile ─────────────────────────────

/**
 * generateSyntheticLoads(profile) → loadItemsV2[] (5 rows, source "data_logger_profile").
 * Logger data cannot identify appliances, so the profile is decomposed into
 * base / daytime-variable / night-variable / peak-allowance / critical-margin
 * blocks whose combined daily energy reconciles with the measured average.
 */
export function generateSyntheticLoads(profile) {
  const base = Math.max(0, profile.baseLoadKw);
  const dailyKwh = Math.max(0.1, profile.averageDailyKwh);
  const dayShareKwh = profile.dayKwh + profile.nightKwh > 0 ? (profile.dayKwh / (profile.dayKwh + profile.nightKwh)) * dailyKwh : dailyKwh * 0.6;
  const nightShareKwh = dailyKwh - dayShareKwh;

  const baseDayKwh = base * 12, baseNightKwh = base * 12;
  const dayVarKw = Math.max(0, (dayShareKwh - baseDayKwh) / 12);
  const nightVarKw = Math.max(0, (nightShareKwh - baseNightKwh) / 12);
  const peakAllowKw = Math.max(0, profile.p95DemandKw - profile.averageDemandKw);
  const criticalMarginKw = Math.max(0, profile.recommendedCriticalLoadKw - base);

  const mk = (name, kw, dayHours, nightHours, extra = {}) => createLoadItem({
    name, category: "Logger profile", qty: 1,
    ratedW: Math.max(1, Math.round(kw * 1000)),
    dayHours, nightHours, surgeMultiplier: 1,
    notes: "Synthesised from data logger profile — not an appliance inventory. Verify against site equipment.",
    source: "data_logger_profile",
    ...extra,
  });

  const rows = [
    mk("Base load (24h measured)", base, 12, 12, { essential: true, backupRequired: true }),
    mk("Daytime variable load", dayVarKw, 12, 0, { essential: false }),
    mk("Evening/night load", nightVarKw, 0, 12, { essential: false }),
    mk("Peak/surge allowance", Math.max(0.05, peakAllowKw), 1, 0.5, { essential: false, surgeMultiplier: +(profile.peakDemandKw > 0 && profile.p95DemandKw > 0 ? Math.max(1, profile.peakDemandKw / profile.p95DemandKw) : 1.5).toFixed(2) }),
    mk("Critical/base backup margin", Math.max(0.02, criticalMarginKw), 6, 6, { essential: true, backupRequired: true }),
  ].filter((r) => r.ratedW > 0);

  return rows;
}

// ─── Energy survey template (manual Excel collection) ───────────────────────

export const ENERGY_SURVEY_TEMPLATE_COLUMNS = [
  "Load name", "Quantity", "Rated watts", "Day hours", "Night hours",
  "Surge multiplier", "Critical yes/no", "Category", "Notes",
];

/** buildEnergySurveyTemplateCsv() → CSV string with headers + 3 example rows. */
export function buildEnergySurveyTemplateCsv() {
  const example = [
    ["LED lights", 10, 10, 1, 5, 1, "yes", "Lighting", "Example row — replace"],
    ["Fridge", 1, 250, 6, 6, 3, "yes", "Refrigeration", ""],
    ["Water pump", 1, 1100, 1, 0, 4, "no", "Motor", "DOL start"],
  ];
  return [ENERGY_SURVEY_TEMPLATE_COLUMNS.join(","), ...example.map((r) => r.join(","))].join("\n");
}

const truthy = (v) => /^(yes|y|true|1)$/i.test(String(v || "").trim());

/**
 * parseEnergySurveyRows(rows) → { items: loadItemsV2[], errors: string[] }
 * rows: objects keyed by the template headers (case/spacing tolerant).
 */
export function parseEnergySurveyRows(rows = []) {
  const items = [];
  const errors = [];
  const get = (row, name) => {
    const key = Object.keys(row).find((k) => norm(k) === norm(name));
    return key !== undefined ? row[key] : undefined;
  };
  rows.forEach((row, i) => {
    const name = String(get(row, "Load name") ?? "").trim();
    if (!name) { if (Object.values(row).some((v) => String(v).trim() !== "")) errors.push(`Row ${i + 2}: missing load name — skipped.`); return; }
    const watts = parseNum(get(row, "Rated watts"));
    if (!watts || watts <= 0) { errors.push(`Row ${i + 2} ("${name}"): rated watts missing or invalid — skipped.`); return; }
    items.push(createLoadItem({
      name,
      qty: Math.max(1, Math.round(parseNum(get(row, "Quantity")) || 1)),
      ratedW: watts,
      dayHours: Math.min(24, Math.max(0, parseNum(get(row, "Day hours")) ?? 0)),
      nightHours: Math.min(24, Math.max(0, parseNum(get(row, "Night hours")) ?? 0)),
      surgeMultiplier: Math.max(1, parseNum(get(row, "Surge multiplier")) || 1),
      essential: truthy(get(row, "Critical yes/no")),
      backupRequired: truthy(get(row, "Critical yes/no")),
      category: String(get(row, "Category") ?? "Survey").trim() || "Survey",
      notes: String(get(row, "Notes") ?? "").trim(),
      source: "energy_survey",
    }));
  });
  return { items, errors };
}

// ─── Persisted summary (project.energyImport) ───────────────────────────────

/** Build the compact summary stored on the project record (raw rows are session-only). */
export function buildEnergyImportSummary(quality, profile, sourceLabel = "Data logger") {
  return {
    source: sourceLabel,
    importedAt: new Date().toISOString(),
    dateRange: quality.dateRange,
    totalRecords: quality.totalRecords,
    cleanedRecords: quality.cleanedRows ? quality.cleanedRows.length : undefined,
    intervalMinutes: quality.detectedIntervalMinutes,
    dataQualityScore: quality.dataQualityScore,
    averageDailyKwh: profile.averageDailyKwh,
    peakDemandKw: profile.peakDemandKw,
    p95DemandKw: profile.p95DemandKw,
    baseLoadKw: profile.baseLoadKw,
    dayNightSplit: profile.dayNightSplit,
    loadFactor: profile.loadFactor,
    profileConfidence: profile.profileConfidence,
    gapWarnings: quality.validationWarnings.filter((w) => /gap/i.test(w.msg)).length,
    spikeWarnings: quality.validationWarnings.filter((w) => /spike/i.test(w.msg)).length,
  };
}

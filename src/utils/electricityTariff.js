import { canonicalStringify, hashCanonicalJson } from "../platform/canonicalJson.js";

export const TARIFF_METHOD_VERSION = "VF-KE-FLAT-1";
export const TARIFF_CATEGORIES = ["Domestic lifeline", "Domestic ordinary", "Small commercial", "Commercial / industrial"];
export const TARIFF_PROJECT_TYPES = ["Solar PV – Hybrid", "Grid-tied", "Genset hybrid"];
export const TARIFF_COMPONENTS = [
  ["energy", "Energy charge"], ["fuel", "Fuel adjustment"], ["forex", "Forex adjustment"],
  ["inflation", "Inflation adjustment"], ["water", "Water levy"], ["regulator", "Regulator levy"],
  ["rural", "Rural electrification levy"], ["fixed", "Fixed charge"], ["demand", "Demand charge"],
];
export const TARIFF_NUMBER_FIELDS = ["baseRate", "fuelRate", "forexRate", "inflationRate", "waterRate", "regulatorRate", "ruralLevyPct", "vatPct", "fixedCharge", "demandRate", "demandKva", "consumptionKwh", "actualBillKes"];
const money = (value) => Math.round((value + Math.sign(value) * Number.EPSILON) * 100) / 100;
const number = (value) => (typeof value === "number" || typeof value === "string") && String(value).trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
const monthIndex = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value || "") ? Number(value.slice(0, 4)) * 12 + Number(value.slice(5)) - 1 : null;
const isoDay = (value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const text = (value) => typeof value === "string" ? value.slice(0, 500) : "";

export function tariffToday(asOf = new Date()) {
  const date = new Date(asOf);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(date) : "";
}

export function createTariffDraft() {
  return {
    billingMonth: "", validFromMonth: "", validThroughMonth: "", category: "", rateMode: "FLAT",
    ...Object.fromEntries(TARIFF_NUMBER_FIELDS.map((key) => [key, ""])),
    vatBase: [], sources: { tariff: "", adjustments: "", taxes: "" }, sourceReference: "",
    checkedOn: "", reviewer: "", assumptionsAccepted: false,
  };
}

export function normalizeTariffDraft(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const draft = createTariffDraft();
  for (const key of ["billingMonth", "validFromMonth", "validThroughMonth", "category", "rateMode", "sourceReference", "checkedOn", "reviewer"]) draft[key] = key in source ? text(source[key]) : draft[key];
  for (const key of TARIFF_NUMBER_FIELDS) draft[key] = typeof source[key] === "number" || typeof source[key] === "string" ? source[key] : "";
  draft.sources = Object.fromEntries(["tariff", "adjustments", "taxes"].map((key) => [key, text(source.sources?.[key])]));
  draft.vatBase = Array.isArray(source.vatBase) ? source.vatBase.map(text) : [];
  draft.assumptionsAccepted = source.assumptionsAccepted === true;
  return draft;
}

export function normalizeTariffState(raw) {
  return { enabled: raw?.enabled === true, draft: normalizeTariffDraft(raw?.draft), applied: raw?.applied && typeof raw.applied === "object" && !Array.isArray(raw.applied) ? raw.applied : null };
}

export function isOfficialTariffSource(value) {
  try {
    const url = new URL(value);
    const allowed = ["epra.go.ke", "kplc.co.ke", "kenyalaw.org", "kra.go.ke"];
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && allowed.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}

function numericErrors(draft) {
  const errors = [];
  for (const key of TARIFF_NUMBER_FIELDS.filter((field) => field !== "actualBillKes")) {
    const value = number(draft[key]);
    const signed = ["fuelRate", "forexRate", "inflationRate", "waterRate"].includes(key);
    if (value === null || Math.abs(value) > 1e9 || (!signed && value < 0)) errors.push(`Enter a valid ${key.replace(/([A-Z])/g, " $1").toLowerCase()} (use 0 where not applicable).`);
  }
  for (const key of ["ruralLevyPct", "vatPct"]) if (number(draft[key]) > 100) errors.push(`${key} must be between 0 and 100%.`);
  if (number(draft.demandRate) > 0 && !(number(draft.demandKva) > 0)) errors.push("Enter the billed demand in kVA when a demand rate applies.");
  const allowed = new Set(TARIFF_COMPONENTS.map(([key]) => key));
  if (new Set(draft.vatBase).size !== draft.vatBase.length || draft.vatBase.some((key) => !allowed.has(key))) errors.push("VAT component selection is invalid.");
  if (number(draft.vatPct) > 0 && !draft.vatBase.length) errors.push("Select the charge components subject to VAT from the reviewed source.");
  if (draft.rateMode !== "FLAT") errors.push("Time-of-use, block tariffs and power-factor surcharge rules are not supported by this version.");
  return errors;
}

export function calculateTariffBill(input, consumptionKwh = input?.consumptionKwh) {
  const draft = normalizeTariffDraft(input);
  const errors = numericErrors(draft);
  const quantity = number(consumptionKwh);
  if (quantity === null || quantity < 0 || quantity > 1e9) errors.push("Consumption must be a finite, non-negative kWh value.");
  if (errors.length) return { ready: false, errors, lines: [], total: null };
  const amounts = {
    energy: money(quantity * number(draft.baseRate)), fuel: money(quantity * number(draft.fuelRate)),
    forex: money(quantity * number(draft.forexRate)), inflation: money(quantity * number(draft.inflationRate)),
    water: money(quantity * number(draft.waterRate)), regulator: money(quantity * number(draft.regulatorRate)),
    fixed: money(number(draft.fixedCharge)), demand: money(number(draft.demandRate) * number(draft.demandKva)),
  };
  amounts.rural = money(amounts.energy * number(draft.ruralLevyPct) / 100);
  const taxableBase = money(draft.vatBase.reduce((sum, key) => sum + amounts[key], 0));
  const vat = money(taxableBase * number(draft.vatPct) / 100);
  const total = money(Object.values(amounts).reduce((sum, value) => sum + value, vat));
  const variable = amounts.energy + amounts.fuel + amounts.forex + amounts.inflation + amounts.water + amounts.regulator + amounts.rural;
  if (!Number.isFinite(total) || !Number.isSafeInteger(Math.round(total * 100)) || total < 0 || variable < 0 || taxableBase < 0) return { ready: false, errors: ["Combined charges or the VAT base are negative, invalid or outside supported monetary precision; review adjustments."], lines: [], total: null };
  return { ready: true, errors: [], consumptionKwh: quantity, lines: [...TARIFF_COMPONENTS.map(([key, label]) => ({ key, label, amount: amounts[key] })), { key: "vat", label: "VAT", amount: vat }], taxableBase, total };
}

export function assessTariffDraft(input, { asOf = new Date() } = {}) {
  const draft = normalizeTariffDraft(input);
  const before = calculateTariffBill(draft);
  const errors = [...before.errors];
  const now = new Date(asOf);
  const today = tariffToday(now);
  const currentMonth = monthIndex(today.slice(0, 7));
  const referenceMonth = monthIndex(draft.billingMonth);
  const firstMonth = monthIndex(draft.validFromMonth);
  const lastMonth = monthIndex(draft.validThroughMonth);
  if (referenceMonth === null || firstMonth === null || lastMonth === null || firstMonth > referenceMonth || lastMonth < referenceMonth) errors.push("The tariff validity period must cover the complete reference billing month.");
  if (currentMonth === null || referenceMonth > currentMonth || referenceMonth < currentMonth - 2) errors.push("Use the current or previous two billing months for annual forecasts; older months are comparison-only.");
  if (!TARIFF_CATEGORIES.includes(draft.category)) errors.push("Choose the customer's confirmed tariff category; do not infer it from reduced solar consumption.");
  if (!isoDay(draft.checkedOn) || draft.checkedOn > today || (today && Date.parse(`${today}T00:00:00Z`) - Date.parse(`${draft.checkedOn}T00:00:00Z`) > 90 * 86400000)) errors.push("Enter a source-check date within the last 90 days, not in the future.");
  for (const [key, value] of Object.entries(draft.sources)) if (!isOfficialTariffSource(value)) errors.push(`Add an official HTTPS ${key} source (EPRA, Kenya Power, Kenya Law or KRA; no private links or query strings).`);
  if (!draft.sourceReference.trim()) errors.push("Record the exact tariff / monthly notice reference.");
  if (!draft.reviewer.trim()) errors.push("Enter who reviewed the source and bill.");
  if (!draft.assumptionsAccepted) errors.push("Confirm the rates, VAT bases, bill category and absence of unsupported charges have been reviewed.");
  const actual = number(draft.actualBillKes);
  if (actual === null || actual < 0 || actual > 1e12) errors.push("Enter the actual current-period bill, excluding arrears and payment fees.");
  const difference = before.ready && actual !== null ? money(before.total - actual) : null;
  if (difference !== null && Math.abs(difference) > 1) errors.push("The model differs from the actual bill by more than KES 1. Resolve the bill breakdown before applying.");
  if (!(number(draft.consumptionKwh) > 0)) errors.push("A positive recorded consumption is required before applying annual savings.");
  return { draft, before, difference, toleranceKes: 1, canApply: errors.length === 0, errors: [...new Set(errors)] };
}

export async function createReviewedTariff(input, { asOf = new Date() } = {}) {
  const assessment = assessTariffDraft(input, { asOf });
  if (!assessment.canApply) throw new Error(assessment.errors.join(" "));
  const inputs = assessment.draft;
  const content = canonicalStringify(inputs);
  const id = `tariff-sha256:${await hashCanonicalJson({ method: TARIFF_METHOD_VERSION, inputs })}`;
  return { id, method: TARIFF_METHOD_VERSION, reviewedAt: new Date(asOf).toISOString(), content, inputs };
}

export function evaluateProjectTariff(project, { annualEnergy = 0, annualLoadKwh = 0, asOf = new Date() } = {}) {
  const state = normalizeTariffState(project?.electricityTariff);
  if (!state.enabled) return { enabled: false, ready: false, errors: [] };
  const snapshot = state.applied;
  const errors = [];
  if (!snapshot || snapshot.method !== TARIFF_METHOD_VERSION || !/^tariff-sha256:[a-f0-9]{64}$/.test(snapshot.id || "") || snapshot.content !== canonicalStringify(snapshot.inputs)) errors.push("Applied tariff snapshot is missing, changed or unsupported. Review and apply a new version.");
  const assessment = assessTariffDraft(snapshot?.inputs, { asOf });
  errors.push(...assessment.errors);
  if (number(project?.monthlyBill) === null || Math.abs(number(project?.monthlyBill) - number(assessment.draft.actualBillKes)) > 1) errors.push("The project bill changed after tariff review. Reconcile and apply a new snapshot.");
  const reviewedTime = Date.parse(snapshot?.reviewedAt);
  if (!Number.isFinite(reviewedTime) || reviewedTime > new Date(asOf).getTime()) errors.push("Tariff review time is missing or in the future.");
  if (!TARIFF_PROJECT_TYPES.includes(project?.systemType)) errors.push("The reviewed utility-bill model currently supports grid-connected PV and genset-hybrid projects only.");
  if (project?.quoteCurrency && project.quoteCurrency !== "KES") errors.push("The Kenya tariff model uses KES only; resolve the project currency before applying.");
  const selfConsumption = number(project?.selfConsumptionRate);
  if (selfConsumption === null || selfConsumption < 0 || selfConsumption > 1 || number(annualEnergy) === null || annualEnergy < 0 || number(annualLoadKwh) === null || annualLoadKwh < 0) errors.push("Solar generation, captured load and self-consumption assumptions are invalid.");
  if (errors.length) return { enabled: true, ready: false, annualSavings: 0, errors: [...new Set(errors)] };
  const referenceKwh = number(assessment.draft.consumptionKwh);
  const avoidedMonthlyKwh = Math.min(annualEnergy * selfConsumption, annualLoadKwh, referenceKwh * 12) / 12;
  const after = calculateTariffBill(assessment.draft, Math.max(0, referenceKwh - avoidedMonthlyKwh));
  if (!after.ready) return { enabled: true, ready: false, annualSavings: 0, errors: after.errors };
  const monthlySavings = money(assessment.before.total - after.total);
  if (monthlySavings < 0) return { enabled: true, ready: false, annualSavings: 0, errors: ["The reviewed tariff produces negative avoided cost; review the component bases."] };
  const [year, month] = assessment.draft.billingMonth.split("-").map(Number);
  const summary = {
    method: TARIFF_METHOD_VERSION, version: snapshot.id, category: assessment.draft.category,
    billingMonth: assessment.draft.billingMonth, checkedOn: assessment.draft.checkedOn,
    status: "Manually reviewed inputs — not utility certification", sources: assessment.draft.sources,
    beforeKes: assessment.before.total, afterKes: after.total, avoidedMonthlyKwh, monthlySavings,
    annualSavings: money(monthlySavings * 12), assumption: "Annual forecast repeats the reference month's tariff and representative consumption; no export credit, demand reduction or battery-dispatch guarantee.",
  };
  return { enabled: true, ready: true, errors: [], before: assessment.before, after, referenceKwh, billingDays: new Date(Date.UTC(year, month, 0)).getUTCDate(), avoidedMonthlyKwh, monthlySavings, annualSavings: summary.annualSavings, summary };
}

export function gateTariffSizing(sizing, model) {
  if (!model.enabled) return sizing;
  if (model.ready) return { ...sizing, tariffModel: model, tariffSummary: sizing.quoteReady === false ? null : model.summary };
  const message = `Tariff review required: ${model.errors[0] || "Review and apply the tariff inputs."}`;
  return { ...sizing, tariffModel: model, tariffSummary: null, quoteReady: false, quoteBlockedReason: sizing.quoteReady === false ? sizing.quoteBlockedReason : message, warnings: [...(sizing.warnings || []), message] };
}

export function assertTariffForExport(project, sizing) {
  if (!project?.electricityTariff?.enabled) return;
  const model = evaluateProjectTariff(project, { annualEnergy: sizing.annualEnergy, annualLoadKwh: sizing.dailyKwh * 365 });
  if (!model.ready || sizing.quoteReady === false) throw new Error(`Tariff review required before export: ${model.errors[0] || "Resolve design checks."}`);
  if (sizing.tariffSummary?.version !== model.summary.version || !Number.isFinite(sizing.annualSavings) || Math.abs(sizing.annualSavings - model.annualSavings) > 0.01) throw new Error("Tariff review required before export: sizing does not match the applied snapshot. Recalculate the current design.");
}

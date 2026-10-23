/**
 * Solarise Pro v8 — Advisory & Recommendation Engine
 * Deterministic rule-based — no external AI API.
 * Pure functions: no React, no side effects.
 */

// ─── Main Advisory Engine ────────────────────────────────────────────────────────
export function generateAdvisory(project, loads, survey, sizing, readiness, billLoadReconciliation = null) {
  const engineeringAdvice = [];
  const commercialAdvice  = [];
  const salesAdvice       = [];
  const operationalAdvice = [];

  const payback  = sizing?.payback  ?? Infinity;
  const cost     = sizing?.totalCost ?? 0;
  const annualBill = (project.monthlyBill ?? 0) * 12;

  // ── Engineering ──────────────────────────────────────────────────────────────
  if (!sizing?.coldVocOk) {
    engineeringAdvice.push(`Reduce panels per string. Cold Voc at ${(sizing?.stringVocCold ?? 0).toFixed(0)} V exceeds the ${project.inverterMaxDcV ?? 1000} V inverter limit.`);
  }
  if ((sizing?.autonomyHours ?? 0) < (project.backupHours ?? 10) * 0.8) {
    engineeringAdvice.push(`Increase battery bank. Estimated autonomy (${(sizing?.autonomyHours ?? 0).toFixed(1)} h) is below requested backup (${project.backupHours ?? 10} h).`);
  }
  if ((sizing?.dcDropPct ?? 0) > 0.015) {
    engineeringAdvice.push(`Increase DC cable size or shorten cable route. DC drop is ${((sizing.dcDropPct) * 100).toFixed(1)} % (target ≤ 1.5 %).`);
  }
  if ((sizing?.acDropPct ?? 0) > 0.03) {
    engineeringAdvice.push(`Increase AC cable size or shorten cable route. AC drop is ${((sizing.acDropPct) * 100).toFixed(1)} % (target ≤ 3 %).`);
  }
  if (survey?.earthingAvailable === false) {
    engineeringAdvice.push("Confirm or install compliant earthing before finalising proposal. Earth electrode and earth bar should be in BoQ.");
  }
  if (project.batteryChemistry === "VRLA" || project.batteryChemistry === "FLOODED") {
    engineeringAdvice.push("Lead-acid battery selected. Hydrogen ventilation is required (IEC 62485-2). Include ventilation, cable protection, and warning signage in BoQ.");
  }
  if (sizing?.dcCableAmpacityOk === false) {
    engineeringAdvice.push(`DC cable ${project.dcCableSizeMm2 ?? "?"}mm² may be undersized for design current. Increase to next standard size.`);
  }
  if (sizing?.acCableAmpacityOk === false) {
    engineeringAdvice.push(`AC cable ${project.acCableSizeMm2 ?? "?"}mm² may be undersized for design breaker current. Increase to next standard size.`);
  }
  if ((sizing?.batteryInputA ?? 0) > (sizing?.bmsMaxDischargeA ?? 999)) {
    engineeringAdvice.push(`Inverter battery draw (${(sizing.batteryInputA ?? 0).toFixed(0)} A) exceeds BMS limit (${(sizing.bmsMaxDischargeA ?? 0).toFixed(0)} A). Add parallel battery strings or upgrade to higher-voltage battery bank.`);
  }
  if (survey?.dbCondition === "Needs upgrade") {
    engineeringAdvice.push("DB upgrade required at site. Include DB works in BoQ and confirm cost before sending proposal.");
  }

  // ── Commercial ───────────────────────────────────────────────────────────────
  const billRatio = annualBill > 0 ? cost / annualBill : Infinity;
  if (billRatio > 5 && annualBill > 0) {
    commercialAdvice.push(`System cost is ${billRatio.toFixed(1)}× annual electricity bill. Client may find this hard to justify — consider proposing a scaled-down Essential package first.`);
  }
  if (payback > 8 && Number.isFinite(payback)) {
    commercialAdvice.push(`Payback of ${payback.toFixed(1)} years is above the 8-year target. Reduce scope, improve self-consumption rate, or confirm actual tariff.`);
  }

  const nightFrac = (sizing?.nightKwh ?? 0) / Math.max(sizing?.dailyKwh ?? 1, 0.1);
  const dayFrac   = (sizing?.dayKwh  ?? 0) / Math.max(sizing?.dailyKwh ?? 1, 0.1);
  if (nightFrac > 0.55) {
    commercialAdvice.push(`Night load dominates (${Math.round(nightFrac * 100)} % of daily). Battery sizing will drive the cost. Confirm backup priority list with client.`);
  }
  if (dayFrac > 0.75) {
    commercialAdvice.push("Daytime load dominates. Grid-tied bill reduction is the primary value. Backup battery may be smaller than client expects.");
  }
  if (project.systemType === "Genset hybrid") {
    const fuelSaved = sizing?.annualFuelSaved ?? 0;
    if (fuelSaved > 100000) {
      commercialAdvice.push(`Genset fuel savings (KES ${Math.round(fuelSaved / 1000)}k/yr) make this a strong financial case. Highlight fuel + maintenance savings prominently.`);
    }
  }

  // ── Sales ────────────────────────────────────────────────────────────────────
  const hasPumps = loads.some(l => l.watts > 1000 || (l.surge ?? 1) >= 3);
  const hasHeavySockets = loads.some(l => (l.name || "").toLowerCase().match(/kettle|iron|cooker|heat/));
  if (hasPumps) {
    salesAdvice.push("High-surge load detected (pumps or motors). Explain to client that inverter sizing is dominated by surge, not average consumption. Show inverter sizing logic.");
  }
  if (hasHeavySockets) {
    salesAdvice.push("Heavy resistive loads (kettle, iron, cooker, heater) present. Advise client to avoid running these simultaneously during a power outage.");
  }
  if (billRatio > 3) {
    salesAdvice.push("Monthly bill is modest relative to system cost. Lead with Essential Backup option and let client upgrade.");
  } else if (billRatio < 1.5 && annualBill > 50000) {
    salesAdvice.push("Strong ROI profile. Lead with Balanced or Premium option — payback story is compelling at this bill level.");
  }
  if (project.systemType === "Off-grid" || (project.autonomyDays ?? 1) > 1.5) {
    salesAdvice.push("Off-grid or high-autonomy sizing. Client values reliability — Premium Energy Security option will resonate.");
  }
  if (payback <= 5) {
    salesAdvice.push(`Excellent payback of ${payback.toFixed(1)} years. Lead with the ROI and monthly savings story — KES ${Math.round((sizing?.annualSavings ?? 0) / 12).toLocaleString()}/month.`);
  }

  // ── Operational ──────────────────────────────────────────────────────────────
  if (Object.keys(survey?.photos ?? {}).length < 2) {
    operationalAdvice.push("Photo checklist incomplete. Collect DB, roof, and meter photos before finalising design.");
  }
  if (cost > 1000000) {
    operationalAdvice.push(`Project value KES ${Math.round(cost / 1000)}k exceeds KES 1,000,000. Manager approval required before sending proposal.`);
  }
  if (survey?.siteType === "Commercial" || survey?.siteType === "Industrial") {
    operationalAdvice.push("Commercial or industrial site. Recommend 7-day data logging before finalising design if loads are unverified.");
  }
  if (survey?.spareBreakerSpace === "No — DB upgrade needed") {
    operationalAdvice.push("DB has no spare space. DB upgrade is required — add to BoQ and flag in proposal.");
  }
  if ((readiness?.totalScore ?? 0) < 60) {
    operationalAdvice.push("Readiness score below 60. Do not send proposal until critical items are resolved.");
  }

  const clientExp = generateClientExplanation(project, sizing, readiness, billLoadReconciliation);
  const managerSummary = buildManagerSummary(project, sizing, readiness);

  return { engineeringAdvice, commercialAdvice, salesAdvice, operationalAdvice, clientFriendlySummary: clientExp, internalManagerSummary: managerSummary };
}

// ─── Client-Friendly Explanation ────────────────────────────────────────────────
export function generateClientExplanation(project, sizing, readiness, billLoadReconciliation = null) {
  if (sizing?.loadInventoryBlocked || sizing?.loadInventoryPending || sizing?.loadInventoryInvalid) {
    const bill = (project.monthlyBill ?? 0).toLocaleString();
    return {
      whatWeFound: `Pending load inventory. The current monthly bill reference is KES ${bill || "0"}, but no committed load inventory is available for quote-ready sizing.`,
      recommendation: "Complete the load inventory and click Update Sizing before presenting PV, battery, inverter, BoQ, savings or investment figures.",
      whatItWillDo: "Once loads are committed, Voltflow can calculate the feasible system size and expected savings.",
      whatItWillNot: "This draft should not be treated as a priced quotation or final engineering design.",
      assumptions: "Any default site or survey values are assumptions until confirmed during the site survey.",
      nextSteps: "Add committed loads, confirm survey facts, then review the proposal with a qualified Solarise engineer.",
    };
  }
  if (sizing?.quoteReady === false) {
    const equipmentBlocked = sizing.equipment?.enabled && !sizing.equipment.quoteReady;
    const nextStep = equipmentBlocked
      ? "Resolve equipment matching in Asset library, including exact hardware, quantities, evidence and prices."
      : sizing.tariffModel?.enabled && !sizing.tariffModel.ready ? "Review and apply the electricity bill and tariff inputs in Financials + DSCR."
      : "Resolve the outstanding sizing checks before preparing a commercial proposal.";
    return {
      whatWeFound: `${sizing.quoteBlockedReason || "Design checks incomplete"}. This proposal is on hold.`,
      recommendation: nextStep,
      whatItWillDo: "Performance, backup and savings claims are on hold until the required design checks are complete.",
      whatItWillNot: "This draft is not a priced offer, performance guarantee or engineering-approved design.",
      assumptions: "Recorded hardware and site assumptions still require qualified review.",
      nextSteps: nextStep,
    };
  }
  const daily     = (sizing?.dailyKwh    ?? 0).toFixed(1);
  const kwp       = (sizing?.actualKwp   ?? 0).toFixed(1);
  const batt      = (sizing?.batteryKwh  ?? 0).toFixed(1);
  const inv       = sizing?.inverterKw   ?? 0;
  const annual    = Math.round(sizing?.annualEnergy ?? 0);
  const coverage  = Math.round((project.solarCoverage ?? 0.8) * 100);
  const autonomy  = (sizing?.autonomyHours ?? 0).toFixed(1);
  const bill      = (project.monthlyBill ?? 0).toLocaleString();
  const savings   = Math.round((sizing?.annualSavings ?? 0) / 12).toLocaleString();
  const payback   = sizing?.payback ?? Infinity;
  const tariff    = project.gridTariff ?? 22;
  const hasPumps  = (project.surgeKw ?? 0) > (project.runningKw ?? 0) * 1.5;
  const claimsBlocked = billLoadReconciliation?.clientClaimsBlocked === true;
  const savingsPctOfBill = Number.isFinite(billLoadReconciliation?.savingsPctOfBill)
    ? `${(billLoadReconciliation.savingsPctOfBill * 100).toFixed(1)}%`
    : "not available";

  const whatWeFound =
    `${claimsBlocked ? "The captured itemized load inventory" : "Your site profile"} shows approximately ${daily} kWh per day, ` +
    `against a monthly electricity bill of approximately KES ${bill}. ` +
    (claimsBlocked ? `The bill and itemized loads are not yet reconciled, so this is not a verified total-site consumption figure. ` : ``) +
    (sizing?.nightKwh > sizing?.dayKwh * 0.5
      ? `A significant portion of your consumption happens in the evening and night, which affects battery sizing. `
      : `The majority of your consumption is during the day, which is ideal for solar savings. `);

  const recommendation =
    `We recommend a ${kwp} kWp solar PV system with a ${batt} kWh lithium battery bank and a ${inv} kW hybrid inverter. ` +
    `This is designed to offset approximately ${coverage}% of the captured load inventory.` +
    (claimsBlocked ? ` It must not be presented as ${coverage}% coverage of total site consumption until the bill and loads are reconciled.` : ``);

  const whatItWillDo =
    `This system will generate approximately ${annual.toLocaleString()} kWh of electricity per year. ` +
    `During grid outages, the battery will support your essential loads for approximately ${autonomy} hours. ` +
    `This is a daily-average planning estimate, not guaranteed continuous runtime; actual backup depends on load timing, state of charge and battery condition. ` +
    (Number.isFinite(payback) && payback <= 10
      ? `Expected monthly savings are approximately KES ${savings}, with a payback period of ${payback.toFixed(1)} years. `
      : `Expected monthly savings are approximately KES ${savings}. `) +
    (claimsBlocked ? `That estimate is ${savingsPctOfBill} of the referenced monthly bill and remains provisional. ` : ``);

  const whatItWillNot =
    `This system is not designed to run all loads simultaneously during an outage. ` +
    (hasPumps ? `Heavy motor loads such as pumps, compressors, and high-pressure equipment should not be run at the same time as other heavy loads during backup. ` : ``) +
    `Cooking loads (kettles, microwave, electric cooker) and ironing equipment consume high power and will deplete the battery quickly — these should ideally be used during daylight hours when solar energy is available.`;

  const assumptions =
    `This estimate is based on your monthly bill of KES ${bill}, a self-consumption rate of ${Math.round((project.selfConsumptionRate ?? 0.9) * 100)}%, ` +
    (sizing.tariffSummary ? `and the manually reviewed ${sizing.tariffSummary.billingMonth} electricity tariff. Fixed and demand charges remain. ${sizing.tariffSummary.assumption} ` : `and a current grid tariff of KES ${tariff}/kWh. `) +
    `Final savings depend on your actual usage patterns. We recommend 30 days of monitoring after installation to confirm performance.`;

  const nextSteps =
    `Next steps: review this proposal with your Solarise engineer, approve the equipment schedule, confirm site readiness, and schedule the installation survey. ` +
    `A signed proposal and deposit are required to confirm your installation date.`;

  return { whatWeFound, recommendation, whatItWillDo, whatItWillNot, assumptions, nextSteps };
}

// ─── Quick Wins Generator ────────────────────────────────────────────────────────
export function generateQuickWins(loads, survey) {
  const wins = [];

  // Lighting
  const heavyLights = loads.filter(l => (l.name || "").toLowerCase().includes("light") && l.watts > 18);
  if (heavyLights.length > 0) {
    wins.push({ rec: "Replace halogen or fluorescent lights with LED", detail: `${heavyLights.length} non-LED lighting load(s) detected. LED retrofit can cut lighting consumption by 60–80%.`, impact: "Medium", cost: "Low", priority: "Immediate" });
  }

  // Night security lights
  const secLights = loads.filter(l => (l.name || "").toLowerCase().match(/security|flood|outdoor/) && l.nightHours > 6);
  if (secLights.length > 0) {
    wins.push({ rec: "Add motion sensors or timers to security/flood lights", detail: "Reduces unnecessary overnight consumption and extends battery life.", impact: "Low", cost: "Low", priority: "Before installation" });
  }

  // Heavy day loads used at night
  const kettles = loads.filter(l => (l.name || "").toLowerCase().match(/kettle|iron|cooker|heat/) && l.nightHours > 0);
  if (kettles.length > 0) {
    wins.push({ rec: "Shift kettle, iron, and cooking loads to solar daytime hours", detail: "These loads draw 1–3 kW. Running them during the day uses free solar energy instead of battery storage.", impact: "High", cost: "Low", priority: "Immediate" });
  }

  // Old fridge
  const bigFridges = loads.filter(l => (l.name || "").toLowerCase().match(/fridge|freezer/) && l.watts > 300);
  if (bigFridges.length > 0) {
    wins.push({ rec: "Check if fridge or freezer can be upgraded to an A-rated inverter model", detail: "Old fridges can consume 3–5× more than modern inverter-compressor models.", impact: "High", cost: "Medium", priority: "Before installation" });
  }

  // Pump scheduling
  const pumps = loads.filter(l => (l.name || "").toLowerCase().match(/pump|borehole|submers/));
  if (pumps.length > 0) {
    wins.push({ rec: "Schedule water pump operation during peak solar hours (9am–3pm)", detail: "Pump during the day fills the tank using free solar energy and avoids drawing from battery at night.", impact: "High", cost: "Low", priority: "Immediate" });
  }

  // Stagger high-surge loads for commercial sites
  const highSurge = loads.filter(l => (l.surge ?? 1) >= 4 && l.qty > 1);
  if (highSurge.length > 0) {
    wins.push({ rec: "Stagger high-surge loads (pumps, compressors, motors) — start one at a time", detail: "Starting multiple high-surge loads simultaneously can exceed inverter capacity. Use soft starters or VFDs for larger motors.", impact: "Medium", cost: "Medium", priority: "Before installation" });
  }

  // DB / earthing issues from survey
  if (survey?.dbCondition === "Needs upgrade" || survey?.spareBreakerSpace === "No — DB upgrade needed") {
    wins.push({ rec: "Fix DB / electrical infrastructure before solar installation", detail: "The DB needs an upgrade before solar equipment can be safely connected. This should be done before or alongside the solar install.", impact: "High", cost: "Medium", priority: "Immediate" });
  }

  // Shading trees
  if ((survey?.shadingSources ?? []).some(s => s.toLowerCase().includes("tree") || s.toLowerCase().includes("vegetation"))) {
    wins.push({ rec: "Trim or remove shading trees/vegetation from proposed panel area", detail: "Even partial shading of a single panel can significantly reduce whole-string output.", impact: "High", cost: "Low", priority: "Before installation" });
  }

  // Data logging for commercial
  if (survey?.siteType === "Commercial" || survey?.siteType === "Industrial") {
    wins.push({ rec: "Install 7-day data logger before finalising design", detail: "Measured load data significantly improves design accuracy and eliminates oversizing or undersizing risk.", impact: "High", cost: "Low", priority: "Before installation" });
  }

  return wins;
}

// ─── Internal ────────────────────────────────────────────────────────────────────
function buildManagerSummary(project, sizing, readiness) {
  const cost = sizing?.totalCost ?? 0;
  const payback = sizing?.payback ?? Infinity;
  const score = readiness?.totalScore ?? 0;
  const status = readiness?.readyStatus ?? "Unknown";
  const blockers = (readiness?.blockers ?? []).length;
  return (
    `Project: ${project.client || "Unnamed"} | ${project.location || "—"} | ${project.systemType}\n` +
    `System: ${(sizing?.actualKwp ?? 0).toFixed(1)} kWp / ${(sizing?.batteryKwh ?? 0).toFixed(1)} kWh / ${sizing?.inverterKw ?? 0} kW inv\n` +
    `Cost: KES ${Math.round(cost).toLocaleString()} | Payback: ${Number.isFinite(payback) ? payback.toFixed(1) + " yr" : "Not viable"}\n` +
    `Readiness: ${status} (${score}/100) | Blockers: ${blockers}\n` +
    `Action: ${status === "Ready to propose" ? "Approve for sending" : status === "Ready with engineer review" ? "Engineer sign-off then send" : "Resolve blockers before proceeding"}`
  );
}

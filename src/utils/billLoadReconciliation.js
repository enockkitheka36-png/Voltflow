const finiteOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const BILL_LOAD_STATUS = Object.freeze({
  UNAVAILABLE: "unavailable",
  MATCHED: "matched",
  UNDER_CAPTURED: "under_captured",
  OVER_CAPTURED: "over_captured",
  NON_ENERGY_CHARGES_UNRESOLVED: "non_energy_charges_unresolved",
});

export function reconcileBillAndLoads(input = {}) {
  const monthlyBillKes = finiteOrNull(input.monthlyBillKes);
  const tariffKesPerKwh = finiteOrNull(input.tariffKesPerKwh);
  const itemizedDailyKwh = Math.max(0, finiteOrNull(input.itemizedDailyKwh) || 0);
  const billingDays = Math.max(1, finiteOrNull(input.billingDays) || 30);
  const nonEnergyChargesKes = Math.max(0, finiteOrNull(input.nonEnergyChargesKes) || 0);
  const nonEnergyChargesKnown = input.nonEnergyChargesKnown !== false;
  const tolerancePct = Math.max(0.01, finiteOrNull(input.tolerancePct) || 0.15);
  const monthlySavingsKes = Math.max(0, finiteOrNull(input.monthlySavingsKes) || 0);
  const measuredMonthlyKwh = input.measuredMonthlyKwh == null ? null : finiteOrNull(input.measuredMonthlyKwh);
  const hasMeasuredEnergy = measuredMonthlyKwh > 0;
  const itemizedMonthlyKwh = itemizedDailyKwh * billingDays;

  const warnings = [];
  if (!(monthlyBillKes > 0)) warnings.push("Monthly bill is missing; bill-implied energy cannot be calculated.");
  if (!(tariffKesPerKwh > 0) && !hasMeasuredEnergy) warnings.push("Energy tariff is missing; bill-implied kWh cannot be calculated.");
  if (!nonEnergyChargesKnown && !hasMeasuredEnergy) warnings.push("Non-energy bill charges are unresolved; bill-implied kWh is provisional.");
  if (!hasMeasuredEnergy && monthlyBillKes != null && nonEnergyChargesKes >= monthlyBillKes) {
    warnings.push("Non-energy charges equal or exceed the bill; no energy-charge basis remains.");
  }

  const hasEnergyBasis = hasMeasuredEnergy || monthlyBillKes > 0
    && tariffKesPerKwh > 0
    && nonEnergyChargesKes < monthlyBillKes;
  const energyChargeKes = hasEnergyBasis && !hasMeasuredEnergy ? monthlyBillKes - nonEnergyChargesKes : null;
  const billImpliedMonthlyKwh = hasMeasuredEnergy ? measuredMonthlyKwh : hasEnergyBasis ? energyChargeKes / tariffKesPerKwh : null;
  const capturedLoadCoveragePct = billImpliedMonthlyKwh > 0
    ? itemizedMonthlyKwh / billImpliedMonthlyKwh
    : null;
  const mismatchPct = capturedLoadCoveragePct == null ? null : capturedLoadCoveragePct - 1;
  const savingsPctOfBill = monthlyBillKes > 0 ? monthlySavingsKes / monthlyBillKes : null;

  let status = BILL_LOAD_STATUS.UNAVAILABLE;
  if (hasEnergyBasis && !nonEnergyChargesKnown && !hasMeasuredEnergy) status = BILL_LOAD_STATUS.NON_ENERGY_CHARGES_UNRESOLVED;
  else if (hasEnergyBasis && Math.abs(mismatchPct) <= tolerancePct) status = BILL_LOAD_STATUS.MATCHED;
  else if (hasEnergyBasis && mismatchPct < -tolerancePct) status = BILL_LOAD_STATUS.UNDER_CAPTURED;
  else if (hasEnergyBasis && mismatchPct > tolerancePct) status = BILL_LOAD_STATUS.OVER_CAPTURED;

  if (status === BILL_LOAD_STATUS.UNDER_CAPTURED) {
    warnings.push(`Itemized loads materially understate ${hasMeasuredEnergy ? "recorded bill consumption" : "bill-implied energy"}; confirm missing or seasonal loads.`);
  } else if (status === BILL_LOAD_STATUS.OVER_CAPTURED) {
    warnings.push(`Itemized loads materially exceed ${hasMeasuredEnergy ? "recorded bill consumption" : "bill-implied energy"}; confirm schedules, duty cycles and tariff basis.`);
  }

  const mismatchResolved = status === BILL_LOAD_STATUS.MATCHED;
  return {
    status,
    mismatchResolved,
    clientCoverageClaimAllowed: mismatchResolved,
    clientClaimsBlocked: !mismatchResolved,
    monthlyBillKes,
    tariffKesPerKwh,
    nonEnergyChargesKes,
    nonEnergyChargesKnown,
    billingDays,
    energyBasis: hasMeasuredEnergy ? "recorded_bill_kwh" : "bill_implied",
    energyChargeKes,
    billImpliedMonthlyKwh,
    itemizedDailyKwh,
    itemizedMonthlyKwh,
    capturedLoadCoveragePct,
    mismatchPct,
    monthlySavingsKes,
    savingsPctOfBill,
    tolerancePct,
    warnings,
  };
}

export function billLoadClientMessage(reconciliation) {
  const formatPct = (value) => {
    if (!Number.isFinite(value)) return "not available";
    const percent = Math.max(0, value * 100);
    return `${percent < 1 ? percent.toFixed(1) : Math.round(percent)}%`;
  };
  const captured = formatPct(reconciliation?.capturedLoadCoveragePct);
  const savings = formatPct(reconciliation?.savingsPctOfBill);
  const basis = reconciliation?.energyBasis === "recorded_bill_kwh" ? "recorded bill consumption" : "bill-implied energy";
  if (!reconciliation?.clientCoverageClaimAllowed) {
    return `Captured load coverage is ${captured} of ${basis}; estimated savings are ${savings} of the referenced bill. Bill and itemized loads are not yet reconciled, so savings are indicative and must not be described as full bill coverage.`;
  }
  return `Captured load coverage is ${captured} of ${basis}; estimated savings are ${savings} of the referenced bill.`;
}

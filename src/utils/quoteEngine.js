export const DEFAULT_TAX_POLICY = Object.freeze({
  version: "KE-2026-01",
  codes: Object.freeze({ VAT_STANDARD: 16, VAT_ZERO: 0, VAT_EXEMPT: null }),
});

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function requireFiniteNonNegative(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new RangeError(`${field} must be a non-negative finite number.`);
  return number;
}

export function calculateQuote(lines = [], pricingPolicy = {}, taxPolicy = DEFAULT_TAX_POLICY) {
  if (!Array.isArray(lines)) throw new TypeError("Quote lines must be an array.");
  const currency = pricingPolicy.currency || "KES";
  const taxCodes = taxPolicy.codes || DEFAULT_TAX_POLICY.codes;
  const calculatedLines = lines.map((line, index) => {
    const qty = requireFiniteNonNegative(line.qty, `lines[${index}].qty`);
    if (qty <= 0) throw new RangeError(`lines[${index}].qty must be greater than zero.`);
    const unitPrice = requireFiniteNonNegative(line.unit_price ?? line.unitPrice, `lines[${index}].unit_price`);
    const discountPct = requireFiniteNonNegative(line.discount_pct ?? line.discountPct ?? 0, `lines[${index}].discount_pct`);
    if (discountPct > 100) throw new RangeError(`lines[${index}].discount_pct cannot exceed 100.`);
    const taxCode = line.tax_code || line.taxCode || "VAT_STANDARD";
    if (!(taxCode in taxCodes)) throw new RangeError(`Unknown tax code: ${taxCode}.`);
    const grossBeforeDiscount = roundMoney(qty * unitPrice);
    const discountAmount = roundMoney(grossBeforeDiscount * discountPct / 100);
    const netAmount = roundMoney(grossBeforeDiscount - discountAmount);
    const rate = taxCodes[taxCode];
    const taxAmount = rate == null ? 0 : roundMoney(netAmount * Number(rate) / 100);
    return {
      ...line,
      qty,
      unit_price: unitPrice,
      discount_pct: discountPct,
      tax_code: taxCode,
      net_amount: netAmount,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      gross_amount: roundMoney(netAmount + taxAmount),
    };
  });

  const baseNet = roundMoney(calculatedLines.reduce((sum, line) => sum + line.net_amount, 0));
  const contingencyPct = requireFiniteNonNegative(pricingPolicy.contingency_pct ?? pricingPolicy.contingencyPct ?? 0, "contingency_pct");
  const contingencyAmount = roundMoney(baseNet * contingencyPct / 100);
  if (contingencyAmount > 0) {
    const taxCode = pricingPolicy.contingency_tax_code || "VAT_STANDARD";
    const rate = taxCodes[taxCode];
    calculatedLines.push({
      sku: "CONTINGENCY", description: "Sizing contingency", category: "OTHER", qty: 1,
      unit_price: contingencyAmount, discount_pct: 0, tax_code: taxCode,
      net_amount: contingencyAmount, discount_amount: 0,
      tax_amount: rate == null ? 0 : roundMoney(contingencyAmount * Number(rate) / 100),
      gross_amount: roundMoney(contingencyAmount + (rate == null ? 0 : contingencyAmount * Number(rate) / 100)),
      policy_generated: true,
    });
  }

  const subtotalNet = roundMoney(calculatedLines.reduce((sum, line) => sum + line.net_amount, 0));
  const discount = roundMoney(calculatedLines.reduce((sum, line) => sum + line.discount_amount, 0));
  const tax = roundMoney(calculatedLines.reduce((sum, line) => sum + line.tax_amount, 0));
  const breakdownMap = new Map();
  calculatedLines.forEach((line) => {
    const current = breakdownMap.get(line.tax_code) || { tax_code: line.tax_code, rate_pct: taxCodes[line.tax_code], taxable_amount: 0, tax_amount: 0 };
    current.taxable_amount = roundMoney(current.taxable_amount + line.net_amount);
    current.tax_amount = roundMoney(current.tax_amount + line.tax_amount);
    breakdownMap.set(line.tax_code, current);
  });
  const categoryTotals = calculatedLines.reduce((out, line) => {
    const category = String(line.category || "OTHER").toUpperCase();
    out[category] = roundMoney((out[category] || 0) + line.net_amount);
    return out;
  }, {});
  return {
    currency,
    lines: calculatedLines,
    category_totals: categoryTotals,
    discount,
    subtotal_net: subtotalNet,
    tax,
    total_gross: roundMoney(subtotalNet + tax),
    tax_breakdown: Array.from(breakdownMap.values()),
    pricing_policy_version: pricingPolicy.version || "default",
    tax_rule_version: taxPolicy.version || "unversioned",
  };
}

export function projectQuoteLines(project = {}, sizing = {}) {
  const epc = Math.max(0, Number(project.epcCost) || 0);
  const labour = roundMoney(epc * 0.65);
  const transport = roundMoney(epc * 0.2);
  const otherEpc = roundMoney(epc - labour - transport);
  const standard = "VAT_STANDARD";
  const lines = [
    { sku: "PV-MODULES", description: "PV modules", category: "EQUIPMENT", qty: Math.max(1, Number(sizing.panels) || 1), unit_price: Number(project.panelCost) || 0, discount_pct: 0, tax_code: standard },
    { sku: "PV-MOUNTING", description: "Mounting hardware", category: "EQUIPMENT", qty: Math.max(1, Number(sizing.panels) || 1), unit_price: Number(project.mountingPerPanel) || 0, discount_pct: 0, tax_code: standard },
    { sku: "INVERTER", description: "Inverter", category: "EQUIPMENT", qty: 1, unit_price: Number(sizing.inverterCost ?? project.inverterUnitCost) || 0, discount_pct: 0, tax_code: standard },
    { sku: "BATTERY-BANK", description: "Battery bank and interconnects", category: "EQUIPMENT", qty: 1, unit_price: Number(sizing.batteryCost) || 0, discount_pct: 0, tax_code: standard },
    { sku: "BOS", description: "Cabling and electrical protection", category: "EQUIPMENT", qty: 1, unit_price: Number(project.cablingProtectionCost) || 0, discount_pct: 0, tax_code: standard },
    { sku: "MONITORING", description: "Monitoring", category: "EQUIPMENT", qty: 1, unit_price: Number(project.monitoringCost) || 0, discount_pct: 0, tax_code: standard },
    { sku: "LABOUR", description: "Installation labour", category: "LABOUR", qty: 1, unit_price: labour, discount_pct: 0, tax_code: standard },
    { sku: "TRANSPORT", description: "Transport and logistics", category: "TRANSPORT", qty: 1, unit_price: transport, discount_pct: 0, tax_code: standard },
    { sku: "PROJECT-OVERHEAD", description: "Project overhead", category: "OTHER", qty: 1, unit_price: otherEpc, discount_pct: 0, tax_code: standard },
  ];
  if (Number(sizing.specialistCapex) > 0) lines.push({ sku: "SPECIALIST", description: "Specialist system equipment", category: "EQUIPMENT", qty: 1, unit_price: Number(sizing.specialistCapex), discount_pct: 0, tax_code: standard });
  return lines;
}

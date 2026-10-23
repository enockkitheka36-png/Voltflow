import React, { useEffect, useRef, useState } from "react";
import { canonicalStringify } from "../platform/canonicalJson.js";
import { TARIFF_CATEGORIES, TARIFF_COMPONENTS, TARIFF_PROJECT_TYPES, normalizeTariffState, assessTariffDraft, calculateTariffBill, createReviewedTariff } from "../utils/electricityTariff.js";
import "./ElectricityTariffPanel.css";

const formatMoney = (value) => Number.isFinite(value) ? new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(value) : "—";
const rateFields = [["baseRate", "Base energy rate"], ["fuelRate", "Fuel adjustment"], ["forexRate", "Forex adjustment"], ["inflationRate", "Inflation adjustment"], ["waterRate", "Water levy"], ["regulatorRate", "Regulator levy"]];

function Input({ label, value, onChange, type = "text", unit, ...attributes }) {
  return <label className="tariff-field"><span>{label}{unit && <small>{unit}</small>}</span><input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} {...attributes} /></label>;
}

export default function ElectricityTariffPanel({ project, setProject, sizing }) {
  const state = normalizeTariffState(project.electricityTariff);
  const draft = state.draft;
  const assessment = assessTariffDraft(draft);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(true);
  const latestProject = useRef(project);
  latestProject.current = project;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const updateDraft = (patch) => {
    setMessage("");
    setProject((current) => {
      const currentState = normalizeTariffState(current.electricityTariff);
      return { ...current, electricityTariff: { ...currentState, draft: { ...currentState.draft, ...patch, assumptionsAccepted: Object.keys(patch).length === 1 && "assumptionsAccepted" in patch ? patch.assumptionsAccepted === true : false } } };
    });
  };
  const model = sizing.tariffModel;
  const supportedProject = TARIFF_PROJECT_TYPES.includes(project.systemType) && (!project.quoteCurrency || project.quoteCurrency === "KES");
  const pendingChanges = state.applied && canonicalStringify(draft) !== canonicalStringify(state.applied.inputs);
  const physicalReady = !sizing.loadInventoryBlocked && !sizing.loadInventoryPending && !sizing.loadInventoryInvalid && (!sizing.equipment?.enabled || sizing.equipment.quoteReady);
  const quantity = Number(draft.consumptionKwh);
  const offset = physicalReady ? Math.min(sizing.annualEnergy * project.selfConsumptionRate, sizing.dailyKwh * 365, quantity * 12) / 12 : NaN;
  const after = assessment.before.ready && Number.isFinite(offset) ? calculateTariffBill(draft, Math.max(0, quantity - offset)) : null;
  const apply = async () => {
    if (!assessment.canApply || !supportedProject || busy) return;
    setBusy(true);
    setMessage("");
    const identity = canonicalStringify([project.projectRef, project.client, project.location]);
    try {
      const snapshot = await createReviewedTariff(draft);
      if (!mounted.current) return;
      const latest = latestProject.current;
      if (canonicalStringify(normalizeTariffState(latest.electricityTariff).draft) !== canonicalStringify(draft) || canonicalStringify([latest.projectRef, latest.client, latest.location]) !== identity) {
        setMessage("Inputs changed during review. Review and apply them again.");
        return;
      }
      setProject((current) => {
        const currentState = normalizeTariffState(current.electricityTariff);
        if (canonicalStringify(currentState.draft) !== canonicalStringify(draft) || canonicalStringify([current.projectRef, current.client, current.location]) !== identity) return current;
        return { ...current, monthlyBill: Number(draft.actualBillKes), electricityTariff: { ...currentState, enabled: true, applied: snapshot } };
      });
      setMessage("Tariff review completed. The reviewed reference bill now drives the savings forecast. Save the project to retain it.");
    } catch (error) { if (mounted.current) setMessage(error.message || "Tariff could not be applied. Review the inputs."); }
    finally { if (mounted.current) setBusy(false); }
  };

  return <section className="tariff-panel" aria-label="Electricity bill and tariff calculator">
    <header className="tariff-heading"><div><p className="tariff-eyebrow">KENYA POWER · SOURCE-BACKED COST MODEL</p><h2>Electricity bill &amp; tariff</h2><p>Review a real bill, enter the applicable rates, then compare retained grid costs after solar.</p></div><span className="tariff-badge">{state.enabled ? model?.ready ? "Reviewed inputs applied" : "Applied model needs review" : "Draft — not applied"}</span></header>
    <div className="tariff-notice">Independent Voltflow calculation, not a live Stima Tracker connection or utility certification. No rates are prefilled as current facts. <a href="https://www.stimatracker.com/" target="_blank" rel="noopener noreferrer">Cross-check with Stima Tracker ↗</a></div>
    {!supportedProject && <div className="tariff-alert">Applying this Kenya Power model requires a KES grid-connected PV or genset-hybrid project. EV charging, mini-grid and off-grid business models are not supported by this calculator.</div>}
    {state.enabled && model && !model.ready && <div className="tariff-alert" role="status"><strong>Savings and quotation are on hold.</strong> {model.errors[0]}</div>}
    {pendingChanges && <p className="tariff-notice">Draft changes are not applied. The last reviewed snapshot remains in use until you review and apply a new version.</p>}
    <fieldset><legend>1. Reference bill and tariff period</legend><div className="tariff-grid">
      <Input label="Billing month" type="month" value={draft.billingMonth} onChange={(value) => updateDraft({ billingMonth: value })} />
      <label className="tariff-field"><span>Tariff category from bill</span><select value={draft.category} onChange={(event) => updateDraft({ category: event.target.value })}><option value="">Choose category</option>{TARIFF_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="tariff-field"><span>Billing structure</span><select value={draft.rateMode} onChange={(event) => updateDraft({ rateMode: event.target.value })}><option value="FLAT">One category rate for all units</option><option value="TOU">Time-of-use — not supported yet</option><option value="BLOCK">Progressive blocks / other charges — not supported yet</option></select></label>
      <Input label="Rates valid from" type="month" value={draft.validFromMonth} onChange={(value) => updateDraft({ validFromMonth: value })} />
      <Input label="Rates valid through" type="month" value={draft.validThroughMonth} onChange={(value) => updateDraft({ validThroughMonth: value })} />
      <Input label="Recorded consumption" type="number" min="0" step="any" unit="kWh in reference month" value={draft.consumptionKwh} onChange={(value) => updateDraft({ consumptionKwh: value })} />
      <Input label="Actual current-period bill" type="number" min="0" step="0.01" unit="KES; exclude arrears and payment fees" value={draft.actualBillKes} onChange={(value) => updateDraft({ actualBillKes: value })} />
    </div><p className="tariff-help">Use the category assigned on the bill. Solar does not automatically move an account to another tariff band. Historical months remain comparison-only; annual forecasts require a recent reference month.</p></fieldset>
    <fieldset><legend>2. Itemised rates and charges</legend><div className="tariff-grid">
      {rateFields.map(([key, label]) => <Input key={key} label={label} type="number" step="any" unit="KES/kWh" value={draft[key]} onChange={(value) => updateDraft({ [key]: value })} />)}
      <Input label="Rural electrification levy" type="number" min="0" max="100" step="any" unit="% of base energy charge only" value={draft.ruralLevyPct} onChange={(value) => updateDraft({ ruralLevyPct: value })} />
      <Input label="VAT rate" type="number" min="0" max="100" step="any" unit="%; select taxable components below" value={draft.vatPct} onChange={(value) => updateDraft({ vatPct: value })} />
      <Input label="Fixed charge" type="number" min="0" step="0.01" unit="KES/month; retained after solar" value={draft.fixedCharge} onChange={(value) => updateDraft({ fixedCharge: value })} />
      <Input label="Demand rate" type="number" min="0" step="any" unit="KES/kVA; 0 if not applicable" value={draft.demandRate} onChange={(value) => updateDraft({ demandRate: value })} />
      <Input label="Billed demand" type="number" min="0" step="any" unit="kVA; retained after solar" value={draft.demandKva} onChange={(value) => updateDraft({ demandKva: value })} />
    </div><p className="tariff-help">Enter 0 explicitly where a charge does not apply. Monthly rebates may be entered as negative fuel, forex, inflation or water adjustments. Do not apply one VAT percentage indiscriminately to the whole bill.</p>
    <div className="tariff-vat"><strong>VAT applies to these reviewed components</strong>{TARIFF_COMPONENTS.map(([key, label]) => <label key={key}><input type="checkbox" checked={draft.vatBase.includes(key)} onChange={(event) => updateDraft({ vatBase: event.target.checked ? [...draft.vatBase, key] : draft.vatBase.filter((value) => value !== key) })} />{label}</label>)}</div></fieldset>
    <fieldset><legend>3. Source and review record</legend><div className="tariff-grid">
      <Input label="Official base-tariff source" type="url" placeholder="https://www.epra.go.ke/…" value={draft.sources.tariff} onChange={(value) => updateDraft({ sources: { ...draft.sources, tariff: value } })} />
      <Input label="Official monthly-adjustments source" type="url" placeholder="https://new.kenyalaw.org/…" value={draft.sources.adjustments} onChange={(value) => updateDraft({ sources: { ...draft.sources, adjustments: value } })} />
      <Input label="Official tax and levy source" type="url" placeholder="https://www.kra.go.ke/…" value={draft.sources.taxes} onChange={(value) => updateDraft({ sources: { ...draft.sources, taxes: value } })} />
      <Input label="Tariff / monthly notice reference" placeholder="Notice number and publication date; no account numbers" value={draft.sourceReference} onChange={(value) => updateDraft({ sourceReference: value })} />
      <Input label="Sources checked on" type="date" value={draft.checkedOn} onChange={(value) => updateDraft({ checkedOn: value })} />
      <Input label="Reviewed by" value={draft.reviewer} onChange={(value) => updateDraft({ reviewer: value })} />
    </div><label className="tariff-confirm"><input type="checkbox" checked={draft.assumptionsAccepted} onChange={(event) => updateDraft({ assumptionsAccepted: event.target.checked })} /><span>I reviewed the rates for this billing month, the customer's assigned category and the VAT bases. No unmodelled time-of-use, progressive-block, power-factor surcharge or other adjustments apply.</span></label><p className="tariff-help">Use official EPRA, Kenya Power, Kenya Law or KRA links without private tokens, account numbers or query strings. A completed review is your recorded review—not verification by the utility.</p></fieldset>
    <section aria-label="Draft bill comparison"><h3>4. Bill reconstruction and solar comparison</h3><p className="tariff-help">Solar offset uses existing PV generation × self-consumption, capped to captured annual loads and recorded imports. No export credit, demand reduction or battery-dispatch guarantee is assumed.</p>
      <div className="tariff-table-wrap"><table><thead><tr><th>Charge</th><th>Reference bill</th><th>After-solar estimate</th></tr></thead><tbody>{assessment.before.lines.map((line) => <tr key={line.key}><th scope="row">{line.label}</th><td>{formatMoney(line.amount)}</td><td>{formatMoney(after?.lines.find((item) => item.key === line.key)?.amount)}</td></tr>)}<tr className="tariff-total"><th scope="row">Modelled total</th><td>{formatMoney(assessment.before.total)}</td><td>{formatMoney(after?.total)}</td></tr></tbody></table></div>
      <div className="tariff-results"><div><span>Difference from actual bill</span><strong>{formatMoney(assessment.difference)}</strong><small>Must be within KES 1 before applying</small></div><div><span>Draft monthly avoided cost</span><strong>{after?.ready ? formatMoney(assessment.before.total - after.total) : "Complete sizing checks"}</strong><small>Not applied until reviewed</small></div><div><span>Forecast basis</span><strong>Reference month × 12</strong><small>Representative-month assumption, not guaranteed future savings</small></div></div>
    </section>
    {assessment.errors.length > 0 && <details className="tariff-checks"><summary>{assessment.errors.length} checks remain before applying</summary><ul>{assessment.errors.map((error) => <li key={error}>{error}</li>)}</ul></details>}
    <div className="tariff-actions"><button type="button" className="btn btn-primary" disabled={!assessment.canApply || !supportedProject || busy} onClick={apply}>{busy ? "Saving reviewed snapshot…" : "Review and apply tariff"}</button>{state.enabled && <button type="button" className="btn btn-secondary" onClick={() => setProject((current) => ({ ...current, electricityTariff: { ...normalizeTariffState(current.electricityTariff), enabled: false } }))}>Use flat-rate estimate instead</button>}{state.applied && <button type="button" className="btn btn-secondary" onClick={() => updateDraft(state.applied.inputs)}>Restore reviewed inputs to draft</button>}</div>
    {state.applied && <p className="tariff-help">Saved reference: {state.applied.inputs?.billingMonth || "unknown"} · version {state.applied.id?.slice(-12)} · {state.enabled ? "Applied" : "Inactive"}. Editing this draft never rewrites an issued project-version snapshot.</p>}
    {message && <p className="tariff-message" role="status">{message}</p>}
  </section>;
}

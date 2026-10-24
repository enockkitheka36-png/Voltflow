import React from "react";
import { DOCUMENTED_ASSETS, EQUIPMENT_CATALOGUE_VERSION, EQUIPMENT_SOURCES } from "../utils/equipmentCatalogue.js";
import { normalizeEquipmentSelection, resolveEquipmentProject, updateEquipmentSelection } from "../utils/equipmentMatching.js";
import "./EquipmentMatchingPanel.css";

export default function EquipmentMatchingPanel({ project, setProject, sizing }) {
  const selection = normalizeEquipmentSelection(project.equipmentSelection);
  const assessment = sizing?.equipment;
  const update = (patch) => setProject((previous) => resolveEquipmentProject({
    ...previous,
    equipmentSelection: updateEquipmentSelection(previous.equipmentSelection, patch),
  }));
  const numeric = (key, label, help, extra = {}) => (
    <label className="equipment-field" key={key}>
      <span>{label}</span>
      <input type="number" step="any" {...extra} aria-label={label} aria-describedby={help ? `equipment-${key}-help` : undefined} value={selection[key] ?? ""} onChange={(event) => update({ [key]: event.target.value })} />
      {help && <small id={`equipment-${key}-help`}>{help}</small>}
    </label>
  );
  const textInput = (key, label, help) => (
    <label className="equipment-field" key={key}>
      <span>{label}</span>
      <input type="text" maxLength={500} aria-label={label} aria-describedby={help ? `equipment-${key}-help` : undefined} value={selection[key]} onChange={(event) => update({ [key]: event.target.value })} />
      {help && <small id={`equipment-${key}-help`}>{help}</small>}
    </label>
  );
  return (
    <section className="equipment-match card" aria-labelledby="equipment-matching-title">
      <div className="equipment-heading">
        <div><p className="equipment-eyebrow">From catalogue to a checked design</p><h2 id="equipment-matching-title">Match your equipment</h2></div>
        {selection.enabled && <span className={`equipment-status equipment-status-${(assessment?.status || "Unverified").toLowerCase()}`} role="status">{assessment?.status || "Unverified"}</span>}
      </div>
      <p>Start with GoodWe ES G2, Lynx U5.4-20 and two documented LONGi modules. Check the exact models, firmware and string layout before using them in a quote.</p>
      {!selection.enabled ? <>
        <p>Your existing sizing stays unchanged until you opt in. This is a small documented catalogue, not a live supplier feed or a substitute for qualified review.</p>
        <button type="button" className="btn btn-primary" onClick={() => update({ enabled: true, sourceVersion: EQUIPMENT_CATALOGUE_VERSION })}>Start equipment matching</button>
      </> : <>
        <p className="equipment-notice">Selections update sizing immediately. Changing a model clears its price and model-specific checks, so old evidence is not reused. Hardware values are pinned to the selected datasheets. “Verified” covers only the checks below—not engineering certification, grid approval, availability or a performance guarantee. Final designs require qualified review.</p>
        <fieldset><legend>1. Choose exact hardware</legend><div className="equipment-grid">
          {[["inverterId", "inverters", "Inverter"], ["batteryId", "batteries", "Battery"], ["panelId", "panels", "PV module"]].map(([key, category, label]) => <label className="equipment-field" key={key}><span>{label}</span><select value={selection[key]} onChange={(event) => update({ [key]: event.target.value })}><option value="">Choose a documented model</option>{DOCUMENTED_ASSETS.filter((asset) => asset.category === category).map((asset) => <option key={asset.id} value={asset.id}>{asset.brand} {asset.model} · {asset.capacity}</option>)}</select></label>)}
          {numeric("batteryQuantity", "Battery units", "1–6 identical units; power caps at 5.12 kW DC for 2–6 units.", { min: 1, max: 6, step: 1 })}
          {numeric("modulesPerString", "Modules per string", "Equal-length strings, one per MPPT.", { min: 1, step: 1 })}
          {numeric("stringCount", "Number of strings", "1 or 2; this slice does not support parallel strings.", { min: 1, max: 2, step: 1 })}
        </div></fieldset>
        <fieldset><legend>2. Record the installation assumptions</legend><div className="equipment-grid">
          {textInput("armFirmware", "Inverter ARM version", "Use the ARM integer, e.g. 02—not a DSP or app version.")}
          {textInput("firmwareEvidence", "Firmware check reference", "Device screen, dated service report or manufacturer confirmation.")}
          <label className="equipment-field"><span>BMS communication</span><select value={selection.protocol} onChange={(event) => update({ protocol: event.target.value })}><option value="">Not checked</option><option value="CAN">CAN</option><option value="RS485">RS485</option></select></label>
          <label className="equipment-field"><span>Project market</span><select value={selection.market} onChange={(event) => update({ market: event.target.value })}><option value="">Not selected</option><option value="KENYA">Kenya · EMEA technical set</option><option value="EAST_AFRICA">Other East Africa · EMEA technical set</option><option value="SOUTH_AFRICA">South Africa · regional review needed</option><option value="OTHER">Other · regional review needed</option></select></label>
          {numeric("minAmbientC", "Minimum design ambient (°C)")}
          {numeric("maxAmbientC", "Maximum design ambient (°C)")}
          {numeric("altitudeM", "Site altitude (m)", null, { min: 0 })}
          {numeric("hotModuleVmp", "Reviewed hot-module Vmp (V)", "A worst-case design value, not STC Vmp. Ask your engineer if unknown.", { min: 0 })}
          {textInput("hotVmpEvidence", "Hot-voltage calculation reference", "Record the method, design cell temperature and reviewer/source.")}
          {numeric("designPowerFactor", "Reviewed design power factor", "Use a conservative value for the supplied loads; not an assumed default.", { min: 0, max: 1, step: 0.01 })}
          {textInput("powerFactorEvidence", "Power factor check reference", "Load specifications, measurements or engineer-reviewed design assumption.")}
        </div></fieldset>
        <fieldset><legend>3. Add transparent pricing</legend><p>Prices are per unit in KES. Blank is unknown, not free. Rack/interconnect, installation, contingency and tax remain separate project allowances.</p><div className="equipment-grid">
          {numeric("panelPrice", "PV module price (KES)", null, { min: 0 })}
          {numeric("inverterPrice", "Inverter price (KES)", null, { min: 0 })}
          {numeric("batteryPrice", "Battery unit price (KES)", null, { min: 0 })}
          <label className="equipment-field"><span>Price basis</span><select value={selection.priceBasis} onChange={(event) => update({ priceBasis: event.target.value })}><option value="ESTIMATE">Planning estimate · not a supplier offer</option><option value="SUPPLIER_QUOTE">Supplier quote · add a reference</option></select></label>
          {textInput("priceReference", "Supplier / pricing reference", "A reference is required when marking prices as a supplier quote.")}
        </div></fieldset>
        {selection.sourceVersion !== EQUIPMENT_CATALOGUE_VERSION && <button className="btn btn-secondary" type="button" onClick={() => update({ sourceVersion: EQUIPMENT_CATALOGUE_VERSION })}>Reconfirm current manufacturer source set</button>}
        <div className="equipment-result">
          <h3>{assessment?.quoteReady ? "Documented checks complete" : "Resolve these checks before quoting"}</h3>
          <p>{assessment?.quoteReady ? "Exact hardware, quantities and prices now feed the sizing and draft quote. Final design and regional approvals still need qualified review." : "Unknowns stay visible. Commercial proposal exports are held while matching is unverified, conditional or incompatible."}</p>
          <ul>{(assessment?.checks || []).filter((item) => item.status !== "Verified").map((item) => <li key={item.code}><strong>{item.status}:</strong> {item.message}</li>)}</ul>
          <details><summary>See all {assessment?.checks?.length || 0} checks and their evidence</summary><ul>{(assessment?.checks || []).map((item) => <li key={item.code}><strong>{item.status} · {item.code.replaceAll("_", " ")}</strong><br />{item.message} {item.source && <a href={EQUIPMENT_SOURCES[item.source].url} target="_blank" rel="noreferrer">Manufacturer source ↗</a>}</li>)}</ul></details>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setProject((previous) => ({ ...previous, equipmentSelection: { ...normalizeEquipmentSelection(previous.equipmentSelection), enabled: false }, batterySelection: { selection_mode: "AUTO", asset_id: null }, inverterSelection: { selection_mode: "AUTO", asset_id: null } }))}>Return to assumption-based sizing</button>
        <small className="equipment-exit-note">Keeps the current numeric assumptions; it does not restore an earlier project. Save a copy first if you want to compare.</small>
      </>}
      <details className="equipment-sources"><summary>Manufacturer evidence · checked 21 October 2026</summary><ul>{Object.entries(EQUIPMENT_SOURCES).map(([key, source]) => <li key={key}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a><br /><small>{source.revision} · {source.region}</small></li>)}</ul><p>Published ratings are not a site-performance simulation. Motor start duration, power factor, SOC/temperature derating, protection, cable installation and local grid compliance still need engineering review.</p></details>
    </section>
  );
}

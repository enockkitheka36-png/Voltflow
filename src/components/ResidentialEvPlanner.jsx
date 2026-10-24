import React, { useState } from "react";
import { RESIDENTIAL_EV_DEFAULTS, calculateResidentialEv, createResidentialEvLoad } from "../utils/residentialEv.js";
import "./FieldPlanning.css";

export default function ResidentialEvPlanner({ onPrepareLoad }) {
  const [draft, setDraft] = useState({ ...RESIDENTIAL_EV_DEFAULTS });
  const [message, setMessage] = useState("");
  const result = calculateResidentialEv(draft);
  const update = (key, entry) => { setDraft((current) => ({ ...current, [key]: entry })); setMessage(""); };
  const fields = [["dailyKm", "Daily driving distance (km)"], ["consumptionKwhPer100Km", "Vehicle consumption (kWh/100 km)"], ["chargerKw", "AC charger rating (kW)"], ["chargingWindowHours", "Available charging window (hours)"]];
  return <section className="card field-planning" aria-label="Residential EV load planner">
    <h2>Home + EV charging</h2><p>Add a household vehicle without switching the project to a commercial charging business.</p>
    <div className="planning-grid">{fields.map(([key, label]) => <label key={key}>{label}<input type="number" min="0" step="any" value={draft[key]} onChange={(event) => update(key, event.target.value)} /></label>)}
      <label>Consumption measurement basis<select value={draft.consumptionBasis} onChange={(event) => update("consumptionBasis", event.target.value)}><option value="BATTERY">Battery / vehicle consumption</option><option value="WALL">Wall-metered, already includes charging losses</option></select></label>
      {draft.consumptionBasis === "BATTERY" && <label>Charging efficiency (%)<input type="number" min="1" max="100" step="any" value={draft.chargingEfficiencyPct} onChange={(event) => update("chargingEfficiencyPct", event.target.value)} /></label>}
      <label>Charging period<select value={draft.chargingPeriod} onChange={(event) => update("chargingPeriod", event.target.value)}><option value="NIGHT">Night</option><option value="DAY">Daytime</option></select></label>
      <label>Charger supply scope<select value={draft.supplyScope} onChange={(event) => update("supplyScope", event.target.value)}><option value="GRID_ONLY">Grid only</option><option value="SOLAR">Direct solar offset</option><option value="BACKUP">Include in backup design — review battery and inverter</option></select></label>
    </div>
    {result.ready ? <div className="planning-grid"><div className="planning-value">Wall energy<strong>{result.wallKwh.toFixed(2)} kWh/day</strong></div><div className="planning-value">Charging duration<strong>{result.chargingHours.toFixed(2)} hours/day</strong></div><div className="planning-value">Annual electricity<strong>{Math.round(result.annualWallKwh).toLocaleString()} kWh</strong></div></div> : <ul className="planning-errors">{result.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    <p className="field-note">Use the vehicle/charger's documented or measured values. Wall-metered ratings already include charging losses. Grid-only charging is not automatically counted as solar savings or battery backup. Phase, service capacity, protection and simultaneous household loads need qualified review.</p>
    <button type="button" className="btn btn-primary" disabled={!result.ready} onClick={() => { onPrepareLoad(createResidentialEvLoad(draft)); setMessage("EV row prepared in draft loads. Review its supply, hours and power factor, then click Update Sizing. An existing residential EV row is replaced, not duplicated."); }}>Prepare EV row in draft loads</button>
    {message && <p role="status" className="field-note">{message}</p>}
  </section>;
}

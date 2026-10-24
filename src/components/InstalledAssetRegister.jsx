import React, { useEffect, useState } from "react";
import { INSTALLED_ASSET_TYPES, INSTALLED_ASSET_STATUSES, normalizeInstalledAsset, validateInstalledAsset, upsertInstalledAsset } from "../utils/installedAssets.js";
import "./FieldPlanning.css";

const empty = () => normalizeInstalledAsset({ type: "Inverter", status: "recorded" });
export default function InstalledAssetRegister({ project, setProject }) {
  const records = Array.isArray(project.installedAssets) ? project.installedAssets.filter((record) => record && typeof record === "object" && !Array.isArray(record)).map(normalizeInstalledAsset) : [];
  const [draft, setDraft] = useState(empty);
  const [message, setMessage] = useState("");
  useEffect(() => { setDraft(empty()); setMessage(""); }, [project.projectRef]);
  const result = validateInstalledAsset(draft, records);
  const update = (key, value) => { setDraft((current) => ({ ...current, [key]: value })); setMessage(""); };
  return <section className="card field-planning" aria-label="Installed asset passport"><h2>Installed Asset Passport</h2><p>One physical unit per serial number. Link what was actually installed to commissioning, warranty and future service.</p>
    <div className="planning-grid">
      <label>Installed equipment type<select value={draft.type} onChange={(event) => update("type", event.target.value)}>{INSTALLED_ASSET_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
      {[["manufacturer", "Manufacturer"], ["model", "Installed model"], ["serial", "Serial number"], ["reviewedBy", "Commissioning reviewer"], ["testReference", "Commissioning evidence reference"]].map(([key, label]) => <label key={key}>{label}<input value={draft[key]} maxLength={300} onChange={(event) => update(key, event.target.value)} /></label>)}
      {[["installedOn", "Installation date"], ["warrantyUntil", "Warranty end date"], ["commissionedOn", "Commissioning date"]].map(([key, label]) => <label key={key}>{label}<input type="date" value={draft[key]} onChange={(event) => update(key, event.target.value)} /></label>)}
      <label>Asset lifecycle status<select value={draft.status} onChange={(event) => update("status", event.target.value)}>{INSTALLED_ASSET_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
      <label>Service / retirement notes<input value={draft.notes} maxLength={800} onChange={(event) => update("notes", event.target.value)} /></label>
    </div>
    <p className="field-note">These are recorded human inputs, not certified tests or verified warranty coverage. This register never approves commissioning, changes the quote or updates the design automatically. Retired units need a qualified assessment and an appropriate repair/take-back partner; a note is not a recycling certificate.</p>
    {!result.ready && <ul className="planning-errors">{result.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    <div className="tariff-actions"><button type="button" className="btn btn-primary" disabled={!result.ready} onClick={() => { setProject((current) => ({ ...current, installedAssets: upsertInstalledAsset(current.installedAssets || [], draft) })); setDraft(empty()); setMessage("Asset recorded in this working project. Save / open to retain it. Existing delivery approvals were not changed."); }}>{draft.id ? "Update asset record" : "Record installed asset"}</button>{draft.id && <button type="button" className="btn btn-secondary" onClick={() => setDraft(empty())}>Cancel asset edit</button>}</div>
    {message && <p role="status" className="field-note">{message}</p>}
    {records.length === 0 ? <p>No installed assets recorded yet.</p> : <div className="planning-grid">{records.map((record) => <article className="site-photo-card" key={record.id}><h3>{record.type}: {record.manufacturer} {record.model}</h3><p>Serial: {record.serial}<br />Status: {record.status?.replaceAll("_", " ")}<br />Warranty end: {record.warrantyUntil || "Not recorded"}</p><button type="button" className="btn btn-secondary" onClick={() => { setDraft(normalizeInstalledAsset(record)); setMessage(""); }}>Edit asset {record.serial}</button>{!validateInstalledAsset(record, records).ready && <small>Incomplete record — review required</small>}</article>)}</div>}
  </section>;
}

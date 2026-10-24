import React, { useEffect, useRef, useState } from "react";
import { SITE_PHOTO_SLOTS, countSitePhotos, isAttachedSitePhoto, privateSitePhotoLinks, prepareSitePhoto, uploadPrivateSitePhoto } from "../utils/sitePhotos.js";
import "./FieldPlanning.css";

export default function SitePhotoGallery({ survey, setSurvey, projectRef, cloudEnabled = false, platform, organisationId, projectId, onOpenEvidence }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [urls, setUrls] = useState({});
  const [preview, setPreview] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const dialog = useRef(null);
  const scope = `${cloudEnabled ? projectId || "unsaved" : projectRef}:${organisationId || "local"}`;
  const previewLinks = JSON.stringify(privateSitePhotoLinks(survey.photos, organisationId, projectId));
  const latestScope = useRef(scope);
  latestScope.current = scope;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setMessage(""); setPreview(null); }, [scope]);
  useEffect(() => { if (preview && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [preview]);
  useEffect(() => {
    let active = true;
    setUrls({});
    if (!cloudEnabled || !projectId || !organisationId) return;
    Promise.all(JSON.parse(previewLinks).map(async ([slot, evidenceId]) => {
      try {
        const result = await platform.evidence.createDownloadUrl({ organisationId, evidenceId, expiresInSeconds: 300 });
        return [slot, result.signedUrl];
      } catch { return null; }
    })).then((entries) => { if (active) setUrls(Object.fromEntries(entries.filter((entry) => entry?.[1]))); });
    return () => { active = false; };
  }, [cloudEnabled, platform, projectId, organisationId, previewLinks, refreshVersion]);
  const update = (slot, value) => setSurvey((current) => ({ ...current, photos: { ...current.photos, [slot]: value } }));
  const attach = async (slot, file) => {
    if (!file || busy) return;
    const startedScope = scope;
    setBusy(slot); setMessage("");
    try {
      const prepared = await prepareSitePhoto(file, cloudEnabled ? { maximumBytes: 2 * 1024 * 1024, maximumDimension: 2048 } : undefined);
      if (!mounted.current || latestScope.current !== startedScope) return;
      const photo = cloudEnabled ? await uploadPrivateSitePhoto({ platform, organisationId, projectId, slot, prepared }) : prepared.record;
      if (!mounted.current || latestScope.current !== startedScope) return;
      setSurvey((current) => latestScope.current !== startedScope ? current : { ...current, photos: { ...current.photos, [slot]: photo } });
      setMessage(cloudEnabled ? `${slot}: private upload received; save the project to retain the slot link. Evidence review is separate.` : `${slot}: image attached to the working project. Save the project or export a backup; no cloud upload occurred.`);
    } catch (error) { if (mounted.current && latestScope.current === startedScope) setMessage(error.message || "Image could not be attached. The previous attachment was kept."); }
    finally { if (mounted.current) setBusy(""); }
  };
  const captured = countSitePhotos(survey.photos);
  return <section className="card field-planning" aria-label="Site photo attachments">
    <h2>Site Photos</h2><p>{captured} of {SITE_PHOTO_SLOTS.length} images attached</p>
    <p className="field-note">{cloudEnabled ? "Optimised images use existing private project evidence storage. Save this project first. Server receipt does not mean engineering verification." : "Small optimised copies are stored with this browser project, not a cloud backup. Save / export includes these copies and may contain private information. Keep originals separately for fine details and formal evidence."} Originals are unchanged; image metadata is stripped during preparation.</p>
    <p className="field-note">Previously ticked boxes do not count as image attachments. Photo relevance and project-specific requirements need human review. Never open energised electrical equipment just to take a photo; use qualified personnel.</p>
    {cloudEnabled && (!projectId || !organisationId) && <p role="status">Open a saved cloud project in an active organisation before attaching images.</p>}
    <div className="site-photo-grid">{SITE_PHOTO_SLOTS.map((slot) => {
      const photo = survey.photos?.[slot];
      const attached = isAttachedSitePhoto(photo);
      const source = attached ? photo.kind === "local_site_photo" && !cloudEnabled ? photo.dataUrl : urls[slot] : null;
      return <article className="site-photo-card" key={slot}>
        <h3>{slot}</h3>
        {source ? <button className="site-photo-preview" type="button" onClick={() => setPreview({ source, slot })} aria-label={`View ${slot} photo`}><img src={source} alt={`${slot} attachment`} onError={(event) => { event.currentTarget.alt = "Image unavailable; replace or check Evidence"; }} /></button> : <div className="site-photo-placeholder">{attached ? "Private image unavailable — check Evidence" : photo ? "Previously marked — image still needed" : "No image attached"}</div>}
        <label className="btn btn-secondary photo-file-label">{busy === slot ? "Preparing image…" : attached ? `Replace ${slot} image` : `Upload ${slot} image`}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Upload ${slot} image`} disabled={!!busy || (cloudEnabled && (!projectId || !organisationId))} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void attach(slot, file); }} /></label>
        {attached && <><small>{photo.kind === "local_site_photo" ? "Local copy — not cloud evidence" : "Private evidence link — review separate"}</small><label>Photo note<input maxLength={300} value={photo.caption || ""} onChange={(event) => update(slot, { ...photo, caption: event.target.value })} /></label><button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => { update(slot, null); setMessage("Attachment removed from this survey. Original files and private evidence records were not deleted."); }}>Remove {slot} attachment</button></>}
      </article>;
    })}</div>
    {cloudEnabled && <div className="tariff-actions"><button type="button" className="btn btn-secondary" onClick={onOpenEvidence}>Open protected Evidence workspace</button><button type="button" className="btn btn-secondary" onClick={() => setRefreshVersion((current) => current + 1)}>Refresh private previews</button></div>}
    {message && <p role="status" className="field-note">{message}</p>}
    {preview && <dialog ref={dialog} aria-label={`${preview.slot} photo preview`} className="site-photo-dialog" onCancel={(event) => { event.preventDefault(); setPreview(null); }}><button autoFocus type="button" className="btn btn-secondary" onClick={() => setPreview(null)}>Close photo preview</button><img src={preview.source} alt={`${preview.slot} enlarged attachment`} /></dialog>}
  </section>;
}

import React from "react";
import { BrandLogo } from "../BrandLogo.jsx";
import "./workspace.css";

const workflow = [
  ["Plan", "Capture the client, site and energy needs."],
  ["Design", "Explore sizing and check assumptions."],
  ["Quote", "Build costs and a clear client proposal."],
  ["Deliver", "Track readiness, evidence and progress."],
];

export function WorkspaceHome({ onNewProject, onOpenSaved, onImport, onDemo, onEnergyUpload,
  lastProject, onContinueLast, savedCount, cloudEnabled, pausedProject, onResumeCurrent, children }) {
  const canResume = Boolean(pausedProject || lastProject);
  const projectName = pausedProject?.client || lastProject?.name || "Untitled project";
  return (
    <div className="vfw-home">
      <section className="vfw-welcome" aria-labelledby="workspace-welcome-title">
        <div className="vfw-welcome-copy">
          <BrandLogo style={{ height: "48px", maxWidth: "100%" }} />
          <p className="vfw-eyebrow">YOUR SOLAR PROJECT WORKSPACE</p>
          <h1 id="workspace-welcome-title">Less searching.<br />More moving forward.</h1>
          <p>From first site visit to client proposal, keep your solar project in one clear workflow.</p>
          <div className="vfw-welcome-actions">
            <button type="button" className="vfw-primary-action" onClick={pausedProject ? onResumeCurrent : lastProject ? onContinueLast : onNewProject}>
              {canResume ? "Continue project" : "Start new project"}<span aria-hidden="true">→</span>
            </button>
            {canResume && <button type="button" className="vfw-light-action" onClick={onNewProject}>+ New project</button>}
          </div>
          <p className="vfw-welcome-note">{pausedProject ? `${projectName} · Current session. Use Save / open before reloading.` : lastProject ? projectName : "A short guided setup. No technical detail needed to begin."}</p>
        </div>
        <div className="vfw-workflow-preview">
          <p className="vfw-eyebrow">A CLEAR PATH, NOT A WALL OF TOOLS</p>
          <ol>{workflow.map(([label, description], index) => <li key={label}>
            <span className="vfw-path-number" aria-hidden="true">{index + 1}</span>
            <div><strong>{label}</strong><p>{description}</p></div>
          </li>)}</ol>
          <span className="vfw-preview-note">Explore in any order. Review before issuing.</span>
        </div>
      </section>

      <section className="vfw-projects" aria-labelledby="workspace-projects-title">
        <div className="vfw-section-heading">
          <div><p className="vfw-eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2 id="workspace-projects-title">Your projects</h2></div>
          <span className="vfw-storage-badge">{cloudEnabled ? "Organisation workspace" : "This browser only"}</span>
        </div>
        {savedCount > 0 ? <div className="vfw-project-row">
          <div><strong>{lastProject?.name || "Saved projects"}</strong>
            <p>{savedCount} project{savedCount === 1 ? "" : "s"} {cloudEnabled ? "available in this workspace" : "saved in this browser"}.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onOpenSaved}>Open saved projects →</button>
        </div> : <div className="vfw-project-row">
          <div><strong>No saved projects yet</strong><p>Start a project, then use Save / open to keep a copy. Prefer a walkthrough? Try a labelled demo below.</p></div>
          <button type="button" className="btn btn-secondary" onClick={onDemo}>Explore a demo →</button>
        </div>}
        {!cloudEnabled && <p className="vfw-storage-note">Browser copies do not sync between devices. Export a backup before clearing browser data.</p>}
      </section>

      <section aria-labelledby="workspace-tools-title">
        <div className="vfw-section-heading"><div><p className="vfw-eyebrow">OTHER WAYS TO BEGIN</p><h2 id="workspace-tools-title">Bring your work, or explore</h2></div></div>
        <div className="vfw-quick-tools">
          {[
            ["01", "Import a project", "Open an exported JSON project from your device or a teammate.", "Open import tools", onImport],
            ["02", "Try a demo", "Explore with clearly labelled sample data, not a real client.", "Choose a demo", onDemo],
            ["03", "Use energy data", "Start with measured consumption from a CSV or spreadsheet.", "Open energy import", onEnergyUpload],
          ].map(([number, title, description, action, handler]) => <button type="button" key={title} className="vfw-tool-card" onClick={handler}>
            <span className="vfw-tool-number" aria-hidden="true">{number}</span><strong>{title}</strong><span>{description}</span><span className="vfw-tool-action">{action} <span aria-hidden="true">↗</span></span>
          </button>)}
        </div>
      </section>
      {children}
    </div>
  );
}

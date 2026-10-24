import React from "react";
import { getWorkspaceLocation } from "../../utils/workspaceNavigation.js";
import "./workspace.css";

export function WorkspaceHeader({ project, groups, active, previousTab, onBack, onNavigate }) {
  const location = getWorkspaceLocation(groups, active);
  const stages = groups.filter((group) => ["plan", "design", "quote", "deliver"].includes(group.id));
  const canGoBack = previousTab !== active && getWorkspaceLocation(groups, previousTab);
  const canOpenStorage = groups.some((group) => group.items.some((item) => item.key === "storage"));
  return (
    <header className="vfw-workspace-header">
      <div className="vfw-project-heading">
        <div>
          <p className="vfw-eyebrow">{location?.group.label || "Project workspace"} <span aria-hidden="true">/</span> {location?.item.label || "Project tool"}</p>
          <h1>{project.client || "Untitled project"}</h1>
          <p className="vfw-project-meta">{project.location || "Site details not added"}{project.isDemo ? " · Demo data" : ""}</p>
        </div>
        <div className="vfw-header-actions">
          {canGoBack && <button type="button" className="btn btn-secondary" onClick={onBack}>← Back</button>}
          {canOpenStorage && <button type="button" className="btn btn-secondary" onClick={() => onNavigate("storage")}>Save / open</button>}
        </div>
      </div>
      {stages.length > 0 && <nav className="vfw-stage-nav" aria-label="Project workflow">
        {stages.map((stage, index) => <button type="button" key={stage.id}
          aria-current={location?.group.id === stage.id ? "step" : undefined}
          onClick={() => onNavigate((stage.items.find((item) => item.key === "project") || stage.items[0]).key)} title={stage.hint}>
          <span className="vfw-stage-number" aria-hidden="true">{index + 1}</span><span>{stage.label}</span>
        </button>)}
      </nav>}
    </header>
  );
}

import React, { useEffect, useState } from "react";
import { filterWorkspaceNavigation, getWorkspaceLocation } from "../../utils/workspaceNavigation.js";
import "./workspace.css";

export function WorkspaceNavigation({ groups, active, onNavigate }) {
  const [search, setSearch] = useState("");
  const activeGroup = getWorkspaceLocation(groups, active)?.group.id;
  const [expanded, setExpanded] = useState({ overview: true, [activeGroup]: true });
  useEffect(() => {
    if (activeGroup) setExpanded({ overview: true, [activeGroup]: true });
  }, [activeGroup]);
  const visibleGroups = filterWorkspaceNavigation(groups, search);
  const resultCount = visibleGroups.reduce((total, group) => total + group.items.length, 0);
  return (
    <nav className="sidebar-nav vfw-navigation" aria-label="Project tools">
      <label className="vfw-search-label" htmlFor="workspace-tool-search">Find a tool</label>
      <div className="vfw-search">
        <input id="workspace-tool-search" type="search" placeholder="e.g. battery, proposal…"
          value={search} onChange={(event) => setSearch(event.target.value)} />
        {search && <button type="button" aria-label="Clear tool search" onClick={() => setSearch("")}>×</button>}
      </div>
      {search && <p className="vfw-search-result" role="status">{resultCount ? `${resultCount} matching tools` : "No matching tools. Try another word."}</p>}
      {visibleGroups.map((group) => {
        const isExpanded = Boolean(search) || expanded[group.id];
        return (
          <div className="vfw-nav-group" key={group.id}>
            <button type="button" className="vfw-nav-heading" aria-expanded={Boolean(isExpanded)}
              aria-controls={`workspace-group-${group.id}`}
              onClick={() => setExpanded((current) => ({ ...current, [group.id]: !current[group.id] }))}>
              <span>{group.label}</span><span aria-hidden="true">{isExpanded ? "−" : "+"}</span>
            </button>
            <div id={`workspace-group-${group.id}`} hidden={!isExpanded}>
              {group.items.map((item) => <button type="button" key={item.key}
                className={`nav-item ${active === item.key ? "active" : ""}`}
                aria-current={active === item.key ? "page" : undefined}
                onClick={() => { onNavigate(item.key); setSearch(""); }}>{item.label}</button>)}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { BrandLogo } from "./BrandLogo.jsx";
import { createWorkspaceLoader } from "../utils/workspaceLoader.js";
import "./DeferredWorkspace.css";

const loadEngineeringWorkspace = createWorkspaceLoader(() => import("../App.jsx"));

export function WorkspaceLoadingScreen({ failed = false, onRetry, onReload }) {
  const messageRef = useRef(null);
  useEffect(() => { if (failed) messageRef.current?.focus(); }, [failed]);
  return (
    <main className="vf-workspace-boot" data-workspace-boot={failed ? "failed" : "loading"} aria-busy={!failed}>
      <section className="vf-workspace-boot-card" aria-labelledby="workspace-boot-title">
        <BrandLogo style={{ height: "46px", maxWidth: "100%" }} />
        <p className="vf-workspace-boot-eyebrow">Your solar project workspace</p>
        <h1 id="workspace-boot-title" ref={messageRef} tabIndex={-1}>{failed ? "Let’s get you back to work" : "Opening your workspace…"}</h1>
        <p role={failed ? "alert" : "status"}>{failed ? "The workspace could not finish downloading. Check your connection and try again." : "Loading the design tools. Your projects will be ready in a moment."}</p>
        {failed ? <>
          <div className="vf-workspace-boot-actions">
            <button type="button" className="vf-workspace-boot-retry" onClick={onRetry}>Try again</button>
            <button type="button" onClick={onReload}>Reload latest app</button>
          </div>
          <small>Saved projects have not been cleared. Reloading does not delete browser copies.</small>
        </> : <>
          <div className="vf-workspace-boot-skeleton" aria-hidden="true"><span /><span /><span /></div>
          <small>No need to keep clicking. This page will continue automatically.</small>
        </>}
      </section>
    </main>
  );
}

export function DeferredWorkspace({ loadWorkspace = loadEngineeringWorkspace, onReload = () => window.location.reload() }) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState({ Workspace: null, failed: false });
  useEffect(() => {
    let active = true;
    loadWorkspace().then((module) => {
      if (active) setLoaded({ Workspace: module.default, failed: false });
    }).catch(() => {
      if (active) setLoaded({ Workspace: null, failed: true });
    });
    return () => { active = false; };
  }, [loadWorkspace, attempt]);
  const retry = () => {
    setLoaded({ Workspace: null, failed: false });
    setAttempt((current) => current + 1);
  };
  return loaded.Workspace ? <loaded.Workspace /> : <WorkspaceLoadingScreen failed={loaded.failed} onRetry={retry} onReload={onReload} />;
}

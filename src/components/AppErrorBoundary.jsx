import React from "react";
import { clearLocalProjectData } from "../utils/projectStorage.js";
import { BrandLogo } from "./BrandLogo.jsx";

function safeModeUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("safeMode", "1");
  return url.toString();
}

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("Voltflow stopped after an unexpected render error.", error);
  }

  restartSafeMode = () => {
    window.location.replace(safeModeUrl());
  };

  clearAndRestart = () => {
    const confirmed = window.confirm(
      "Clear projects, assistant history, and local demo workflow data from this browser? Tester feedback will be kept.",
    );
    if (!confirmed) return;
    clearLocalProjectData();
    window.location.replace(safeModeUrl());
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="vf-crash-fallback" role="alert">
        <div className="vf-crash-fallback-panel">
          <BrandLogo style={{ height: "42px" }} />
          <h1>Voltflow could not finish loading</h1>
          <p>The page stopped safely. Saved browser data has not been deleted.</p>
          <div className="vf-crash-fallback-actions">
            <button className="btn btn-primary" type="button" onClick={this.restartSafeMode}>Restart in Safe Mode</button>
            <button className="btn btn-secondary" type="button" onClick={this.clearAndRestart}>Clear local demo data</button>
          </div>
          <small>Internal Alpha / Controlled EPC Staging Build. No cloud submission occurred.</small>
        </div>
      </main>
    );
  }
}

import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { DeferredWorkspace } from "../src/components/DeferredWorkspace.jsx";
import { createWorkspaceLoader } from "../src/utils/workspaceLoader.js";
import "../src/index.css";

let attempts = 0;
let finish = null;
const recoveredModule = { default: () => <main><h1>Synthetic workspace opened</h1><p>Retry attempts: {attempts}</p><p>No real projects or authentication were used.</p></main> };
const retryLoader = createWorkspaceLoader(() => {
  attempts += 1;
  return attempts === 1 ? Promise.reject(new Error("Synthetic chunk download failure")) : Promise.resolve(recoveredModule);
});
const heldLoader = createWorkspaceLoader(() => new Promise((resolve) => { finish = () => resolve(recoveredModule); }));

function RecoveryHarness() {
  const [scenario, setScenario] = useState(null);
  const [reloads, setReloads] = useState(0);
  return <>
    <header style={{ padding: "1rem", background: "#fff", borderBottom: "1px solid #cbd5e1" }}>
      <strong>Loading recovery QA — synthetic only</strong>
      <p>This page exercises the real loading component, not live cloud accounts or client projects.</p>
      {!scenario && <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <button onClick={() => setScenario("retry")}>Simulate failed download</button>
        <button onClick={() => setScenario("held")}>Simulate pending download</button>
      </div>}
      {scenario === "held" && <button onClick={() => finish?.()}>Complete synthetic download</button>}
      <p role="status">Reload requests: {reloads}</p>
    </header>
    {scenario && <DeferredWorkspace loadWorkspace={scenario === "retry" ? retryLoader : heldLoader} onReload={() => setReloads((count) => count + 1)} />}
  </>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><RecoveryHarness /></React.StrictMode>);

import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Storage } from "../src/App.jsx";
import "../src/index.css";

function SaveRecoveryFixture() {
  const [scenario, setScenario] = useState("refresh-failure");
  const [viewMode, setViewMode] = useState("engineer");
  const [role, setRole] = useState("engineer");
  const [generation, setGeneration] = useState(0);
  const [project, setProject] = useState({ client: "Synthetic recovery project", viewMode: "engineer" });
  const [savedProjects, setSavedProjects] = useState([]);
  const [cloudRecord, setCloudRecord] = useState(null);
  const [counts, setCounts] = useState({ creates: 0, updates: 0, lists: 0 });
  const [message, setMessage] = useState("");
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;
  const platform = useMemo(() => ({ projects: {
    async createProject({ record }) {
      setCounts((current) => ({ ...current, creates: current.creates + 1 }));
      if (scenarioRef.current === "write-failure") throw new Error("Simulated network rejection; no real provider called.");
      if (scenarioRef.current === "conflict") throw Object.assign(new Error("Simulated revision conflict"), { code: "CONFLICT" });
      return { ...record, id: "synthetic-project-1", revisionNo: 1 };
    },
    async updateProject({ record, projectId, expectedRevisionNo }) {
      setCounts((current) => ({ ...current, updates: current.updates + 1 }));
      if (scenarioRef.current === "write-failure") throw new Error("Simulated network rejection");
      if (scenarioRef.current === "conflict") throw Object.assign(new Error("Simulated revision conflict"), { code: "CONFLICT" });
      return { ...record, id: projectId, revisionNo: Number(expectedRevisionNo) + 1 };
    },
    async listProjects() {
      setCounts((current) => ({ ...current, lists: current.lists + 1 }));
      if (scenarioRef.current === "refresh-failure") throw new Error("Simulated list refresh failure");
      return [];
    },
  } }), []);
  return <main style={{ padding: "1.5rem", maxWidth: "1100px", margin: "auto" }}>
    <h1>Save recovery — synthetic QA only</h1>
    <p>No Catalyst calls, real customers, cloud writes or runtime security proofs. This exercises the actual Storage component against a simulated provider.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", margin: "1rem 0" }}>
      <label>Scenario <select value={scenario} onChange={(event) => setScenario(event.target.value)}>
        <option value="refresh-failure">Save succeeds, list refresh fails</option><option value="write-failure">Write rejected</option><option value="conflict">Revision conflict</option><option value="success">Success</option>
      </select></label>
      <label>View mode <select value={viewMode} onChange={(event) => setViewMode(event.target.value)}><option value="engineer">Engineer</option><option value="bank">Bank</option></select></label>
      <label>Member role <select value={role} onChange={(event) => setRole(event.target.value)}><option value="engineer">Engineer</option><option value="bank">Bank</option></select></label>
      <button type="button" onClick={() => { setCloudRecord(null); setSavedProjects([]); setCounts({ creates: 0, updates: 0, lists: 0 }); setMessage(""); setGeneration((current) => current + 1); }}>Reset synthetic fixture</button>
    </div>
    <p aria-label="Provider counters">Creates: {counts.creates} · Updates: {counts.updates} · Lists: {counts.lists}</p>
    <Storage key={generation} project={project} setProject={setProject} loadItemsV2={[]} loadAssessmentMode="Residential"
      accessoriesAssumptions={{}} accessoryOverrides={{}} accessoriesCatalogue={[]} projectRef="SYNTHETIC-QA"
      copilotHistory={[]} copilotLastReview={null} survey={{}} simulation={{}}
      savedProjects={savedProjects} setSavedProjects={setSavedProjects} showToast={setMessage}
      viewMode={viewMode} platform={platform} activeMembership={{ organisationId: "synthetic-org", role }} cloudEnabled
      cloudProjectId={cloudRecord?.id} cloudRevisionNo={cloudRecord?.revisionNo} onCloudProjectChanged={setCloudRecord} />
    <p aria-label="Last notification">{message}</p>
  </main>;
}
createRoot(document.getElementById("root")).render(<SaveRecoveryFixture />);

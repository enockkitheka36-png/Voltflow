import React, { useEffect, useMemo, useState } from "react";
import { useVoltflowPlatform } from "./PlatformContext.jsx";
import { checksumEvidenceFile } from "./evidenceAuthorization.js";
import { BrandLogo } from "../components/BrandLogo.jsx";

const page = {
  minHeight: "100vh",
  background: "#f6f8fb",
  color: "#172033",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
};
const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  padding: "0.8rem 1.25rem",
  background: "#14213d",
  color: "#fff",
};
const section = {
  background: "#fff",
  border: "1px solid #d9e0ea",
  borderRadius: "6px",
  padding: "1rem",
};

function SignInPanel() {
  const { signIn, loading, error } = useVoltflowPlatform();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    try {
      await signIn({ email, password });
    } catch { /* surfaced by provider */ }
  };
  const sendLink = async () => {
    try {
      const result = await signIn({ email, useOtp: true });
      setOtpSent(!!result?.otpSent);
    } catch { /* surfaced by provider */ }
  };
  return (
    <main style={{ ...page, display: "grid", placeItems: "center", padding: "1rem" }}>
      <form onSubmit={submit} style={{ ...section, width: "min(420px, 100%)" }}>
        <BrandLogo style={{ height: "44px", marginBottom: "1rem" }} />
        <h1 style={{ fontSize: "1.35rem", margin: "0 0 0.3rem" }}>Sign in to Voltflow</h1>
        <p style={{ margin: "0 0 1rem", color: "#526079", fontSize: "0.88rem" }}>Use your organisation account.</p>
        <label style={{ display: "grid", gap: "0.3rem", marginBottom: "0.75rem", fontSize: "0.82rem", fontWeight: 700 }}>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required
            style={{ minHeight: "42px", border: "1px solid #b8c3d3", borderRadius: "5px", padding: "0 0.7rem" }} />
        </label>
        <label style={{ display: "grid", gap: "0.3rem", marginBottom: "0.75rem", fontSize: "0.82rem", fontWeight: 700 }}>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password"
            style={{ minHeight: "42px", border: "1px solid #b8c3d3", borderRadius: "5px", padding: "0 0.7rem" }} />
        </label>
        {error && <div role="alert" style={{ color: "#9f1239", background: "#fff1f2", padding: "0.65rem", borderRadius: "5px", marginBottom: "0.75rem", fontSize: "0.82rem" }}>{error.message}</div>}
        {otpSent && <div role="status" style={{ color: "#166534", background: "#f0fdf4", padding: "0.65rem", borderRadius: "5px", marginBottom: "0.75rem", fontSize: "0.82rem" }}>Sign-in link sent.</div>}
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button disabled={loading} type="submit" style={{ minHeight: "42px", border: 0, borderRadius: "5px", background: "#1d4ed8", color: "#fff", padding: "0 1rem", fontWeight: 700 }}>Sign in</button>
          <button disabled={loading || !email} type="button" onClick={sendLink} style={{ minHeight: "42px", border: "1px solid #9aa9be", borderRadius: "5px", background: "#fff", padding: "0 1rem", fontWeight: 700 }}>Email link</button>
        </div>
      </form>
    </main>
  );
}

function PortalHeader() {
  const { authorization, activeMembership, selectOrganisation, signOut } = useVoltflowPlatform();
  return (
    <header style={header}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
        <BrandLogo style={{ height: "34px" }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeMembership?.organisationName || "Voltflow"}</div>
          <div style={{ fontSize: "0.72rem", opacity: 0.75, textTransform: "capitalize" }}>{activeMembership?.role || "member"}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {(authorization?.memberships?.length || 0) > 1 && (
          <select aria-label="Organisation" value={activeMembership?.id || ""} onChange={(event) => selectOrganisation(event.target.value)}
            style={{ minHeight: "36px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.35)", background: "#fff", color: "#172033" }}>
            {authorization.memberships.map((membership) => <option key={membership.id} value={membership.id}>{membership.organisationName}</option>)}
          </select>
        )}
        <button onClick={signOut} style={{ minHeight: "36px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.5)", background: "transparent", color: "#fff", padding: "0 0.75rem", fontWeight: 700 }}>Sign out</button>
      </div>
    </header>
  );
}

function TechnicianEvidenceUpload({ projectId, onUploaded }) {
  const { platform, activeMembership } = useVoltflowPlatform();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setStatus("");
    try {
      const checksumSha256 = await checksumEvidenceFile(file);
      const prepared = await platform.evidence.prepareUpload({
        organisationId: activeMembership.organisationId,
        projectId,
        kind: file.type.startsWith("image/") ? "site_photo" : "field_document",
        title: file.name,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        deviceCapturedAt: new Date(file.lastModified || Date.now()).toISOString(),
        requestId: crypto.randomUUID(),
      });
      await platform.evidence.uploadPreparedFile({ storagePath: prepared.storagePath, signedToken: prepared.signedToken, file });
      await platform.evidence.completeUpload({
        organisationId: activeMembership.organisationId,
        evidenceId: prepared.evidenceId,
        checksumSha256,
        sizeBytes: file.size,
        requestId: crypto.randomUUID(),
      });
      setStatus("Uploaded for review");
      onUploaded?.();
    } catch (error) {
      setStatus(error?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
      <label style={{ minHeight: "36px", display: "inline-flex", alignItems: "center", borderRadius: "4px", background: "#1d4ed8", color: "#fff", padding: "0 0.75rem", fontWeight: 700, fontSize: "0.78rem", cursor: busy ? "wait" : "pointer" }}>
        {busy ? "Uploading..." : "Upload evidence"}
        <input type="file" disabled={busy} accept="image/jpeg,image/png,image/webp,application/pdf,text/csv,.xlsx,.xls" style={{ display: "none" }} onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ""; }} />
      </label>
      {status && <span role="status" style={{ fontSize: "0.76rem", color: status === "Uploaded for review" ? "#166534" : "#9f1239" }}>{status}</span>}
    </div>
  );
}

function TechnicianPortal() {
  const { platform, activeMembership } = useVoltflowPlatform();
  const [home, setHome] = useState({ projects: [], syncStatus: "loading" });
  const [error, setError] = useState(null);
  useEffect(() => {
    let active = true;
    setError(null);
    platform.projects.getTechnicianHome({ organisationId: activeMembership.organisationId })
      .then((value) => { if (active) setHome(value || { projects: [], syncStatus: "cloud" }); })
      .catch((nextError) => { if (active) setError(nextError); });
    return () => { active = false; };
  }, [platform, activeMembership]);
  return (
    <main style={{ padding: "1rem", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.3rem", margin: 0 }}>Assigned field work</h1>
        <span style={{ fontSize: "0.78rem", color: "#526079" }}>Sync: {home.syncStatus || "cloud"}</span>
      </div>
      {error && <div role="alert" style={{ ...section, borderColor: "#fda4af", color: "#9f1239" }}>{error.message}</div>}
      {!error && (home.projects || []).length === 0 && <div style={section}>No assigned projects.</div>}
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {(home.projects || []).map((project) => (
          <section key={project.id} style={section}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div><strong>{project.name || project.client || "Project"}</strong><div style={{ color: "#526079", fontSize: "0.82rem" }}>{project.location || "Location pending"}</div></div>
              <span style={{ fontSize: "0.78rem", color: "#526079" }}>{project.projectRef || ""}</span>
            </div>
            <div style={{ marginTop: "0.8rem", display: "grid", gap: "0.4rem" }}>
              {(project.tasks || []).length === 0 ? <span style={{ fontSize: "0.82rem", color: "#526079" }}>No assigned tasks.</span> : project.tasks.map((task) => (
                <div key={task.id || task.title} style={{ display: "flex", justifyContent: "space-between", gap: "0.7rem", paddingTop: "0.4rem", borderTop: "1px solid #e5eaf1", fontSize: "0.82rem" }}>
                  <span>{task.title}</span><strong>{task.status || "todo"}</strong>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "#526079" }}>Evidence: {project.evidenceCount || 0} item(s)</div>
            <TechnicianEvidenceUpload projectId={project.id} onUploaded={() => setHome((current) => ({
              ...current,
              projects: (current.projects || []).map((item) => item.id === project.id ? { ...item, evidenceCount: (item.evidenceCount || 0) + 1 } : item),
            }))} />
          </section>
        ))}
      </div>
    </main>
  );
}

function SharedVersionPortal({ audience }) {
  const { platform, activeMembership } = useVoltflowPlatform();
  const [versions, setVersions] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => {
    let active = true;
    platform.projects.listSharedVersions({ organisationId: activeMembership.organisationId, audience })
      .then((value) => { if (active) setVersions(value || []); })
      .catch((nextError) => { if (active) setError(nextError); });
    return () => { active = false; };
  }, [platform, activeMembership, audience]);
  return (
    <main style={{ padding: "1rem", maxWidth: "1100px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.3rem", margin: "0 0 1rem" }}>{audience === "bank" ? "Shared bank packages" : "Shared project packages"}</h1>
      {error && <div role="alert" style={{ ...section, borderColor: "#fda4af", color: "#9f1239" }}>{error.message}</div>}
      {!error && versions.length === 0 && <div style={section}>No issued project versions have been shared with this account.</div>}
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {versions.map((row) => {
          const snapshot = row.snapshot || row.public_snapshot || {};
          const project = snapshot.project || {};
          const sizing = snapshot.sizing || {};
          return (
            <section key={row.project_version_id || row.id} style={section}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <div><strong>{project.client || row.project_name || "Project package"}</strong><div style={{ color: "#526079", fontSize: "0.82rem" }}>{project.location || ""}</div></div>
                <span style={{ fontSize: "0.78rem", color: "#526079" }}>Version {row.version_no || ""}</span>
              </div>
              <div style={{ marginTop: "0.8rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.6rem" }}>
                <div><small>PV</small><div>{sizing.actualKwp ?? "Pending"} kWp</div></div>
                <div><small>Battery</small><div>{sizing.batteryKwh ?? "Pending"} kWh</div></div>
                <div><small>Investment</small><div>{Number.isFinite(Number(sizing.totalCost)) ? `KES ${Number(sizing.totalCost).toLocaleString()}` : "Pending"}</div></div>
                <div><small>Issued</small><div>{row.issued_at ? new Date(row.issued_at).toLocaleDateString() : "Pending"}</div></div>
              </div>
              {snapshot.billLoadReconciliation?.message && <div style={{ marginTop: "0.8rem", fontSize: "0.8rem", color: "#526079" }}>{snapshot.billLoadReconciliation.message}</div>}
            </section>
          );
        })}
      </div>
    </main>
  );
}

export function SecureApplicationBoundary({ children }) {
  const context = useVoltflowPlatform();
  const role = context.activeMembership?.role;
  if (context.mode === "configuration-error") {
    return <main style={{ ...page, padding: "2rem" }}><div role="alert" style={{ ...section, borderColor: "#fda4af" }}><h1 style={{ fontSize: "1.2rem" }}>Platform configuration blocked</h1><p>{context.error?.message || "Invalid provider configuration."}</p></div></main>;
  }
  if (context.mode === "local-demo") return children;
  if (context.loading && !context.session) return <main style={{ ...page, display: "grid", placeItems: "center" }}>Loading secure session...</main>;
  if (!context.session) return <SignInPanel />;
  if (!context.activeMembership) {
    return <main style={{ ...page }}><PortalHeader /><div style={{ padding: "1rem" }}><div role="alert" style={section}>This account has no active organisation membership.</div></div></main>;
  }
  const restricted = role === "technician" || role === "client" || role === "bank";
  return (
    <div style={page}>
      <PortalHeader />
      {role === "technician" ? <TechnicianPortal /> : role === "client" ? <SharedVersionPortal audience="client" /> : role === "bank" ? <SharedVersionPortal audience="bank" /> : children}
      {!restricted && null}
    </div>
  );
}

export function useRestrictedRole() {
  const { activeMembership } = useVoltflowPlatform();
  return useMemo(() => activeMembership?.role || null, [activeMembership]);
}

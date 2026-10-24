import React from "react";

export function SaveFeedback({ state, canExport, onRetry, onRefresh, onExport }) {
  if (state.status === "idle") return null;
  if (["saving", "refreshing"].includes(state.status)) return <p role="status" aria-live="polite">{state.status === "saving" ? "Saving project…" : "Refreshing saved projects…"}</p>;
  const saved = state.status === "refresh-error";
  return (
    <div role={saved ? "status" : "alert"} style={{ marginBottom: "1rem", padding: "0.75rem 0.9rem", background: saved ? "#eff6ff" : "#fef2f2", border: `1px solid ${saved ? "#93c5fd" : "#fca5a5"}`, borderRadius: "var(--radius-md)", fontSize: "0.82rem", color: saved ? "#1e3a8a" : "#7f1d1d", lineHeight: 1.55 }}>
      <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>{saved ? "Project saved — the project list could not refresh." : "Save not confirmed — your work is still here."}</div>
      <div style={{ marginBottom: "0.6rem" }}>{state.message}</div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {saved ? <button type="button" onClick={onRefresh} className="btn btn-secondary">Refresh project list</button>
          : !state.conflict && <button type="button" onClick={onRetry} className="btn btn-secondary">Try saving again</button>}
        {canExport && <button type="button" onClick={onExport} className="btn btn-secondary">Export JSON backup</button>}
      </div>
    </div>
  );
}

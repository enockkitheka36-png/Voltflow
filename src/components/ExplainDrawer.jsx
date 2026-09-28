/**
 * ExplainDrawer.jsx — Voltflow 11.7 (Studio: "Explain this")
 *
 * A right-side drawer that renders an explanation object from utils/explainers.js
 * (plain language + formula + inputs + assumptions + warnings + what to verify).
 * Presentation only — it explains deterministic outputs, never recomputes them.
 */
import React from "react";

export function ExplainButton({ onClick, label = "Explain this", compact = false }) {
  return (
    <button type="button" className="vf-explain-btn" onClick={onClick} title={label} aria-label={label}>
      {compact ? "ⓘ" : <>ⓘ <span className="vf-explain-btn-label">Explain</span></>}
    </button>
  );
}

export function ExplainDrawer({ open, explanation, onClose }) {
  React.useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !explanation) return null;
  const e = explanation;
  const Section = ({ title, items, kind }) => (
    !items || items.length === 0 ? null : (
      <div className="vf-explain-sec">
        <div className="vf-explain-sec-title">{title}</div>
        {kind === "kv" ? (
          <div className="vf-explain-kv">
            {items.map((row, i) => <React.Fragment key={i}><span>{row[0]}</span><strong>{row[1]}</strong></React.Fragment>)}
          </div>
        ) : (
          <ul className="vf-explain-list">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
        )}
      </div>
    )
  );
  return (
    <>
      <div className="vf-explain-overlay" onClick={onClose} />
      <aside className="vf-explain-drawer" role="dialog" aria-label={`Explain: ${e.title}`}>
        <div className="vf-explain-head">
          <div>
            <div className="vf-explain-eyebrow">Explain this</div>
            <div className="vf-explain-title">{e.title}</div>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: "0.3rem 0.7rem" }}>✕</button>
        </div>
        <div className="vf-explain-body">
          <p className="vf-explain-plain">{e.plain}</p>
          {e.formula && (
            <div className="vf-explain-formula"><span>How it's worked out</span><code>{e.formula}</code></div>
          )}
          <Section title="Key inputs" items={e.inputs} kind="kv" />
          <Section title="Assumptions" items={e.assumptions} />
          <Section title="Warnings" items={e.warnings} />
          <Section title="What to verify" items={e.verify} />
          {e.disclaimer && <div className="vf-explain-disclaimer">{e.disclaimer}</div>}
        </div>
      </aside>
    </>
  );
}

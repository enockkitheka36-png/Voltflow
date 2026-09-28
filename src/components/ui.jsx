/**
 * ui.jsx — Voltflow 11.4 design-system primitives
 *
 * Reusable layout/table/state components shared across App.jsx. All styling
 * leans on the existing CSS variables in index.css and the `vf-*` classes in
 * App.css — no new dependencies, no visual rewrite of existing screens.
 *
 * These are additive: existing markup keeps working, screens adopt them
 * incrementally.
 */
import React from "react";
import "./ui.css";

/* ─── Page / section structure ─────────────────────────────────────────── */

/** Top-of-page title block with optional eyebrow, description and right-side actions. */
export function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <div className="vf-page-header">
      <div className="vf-page-header-text">
        {eyebrow && <div className="vf-eyebrow">{eyebrow}</div>}
        <h1 className="vf-page-title">{title}</h1>
        {description && <p className="vf-page-desc">{description}</p>}
        {children}
      </div>
      {actions && <div className="vf-page-header-actions">{actions}</div>}
    </div>
  );
}

/** Lightweight heading used inside cards/sections (smaller than PageHeader). */
export function SectionHeader({ title, subtitle, actions, level = 2 }) {
  const Tag = `h${Math.min(Math.max(level, 2), 5)}`;
  return (
    <div className="vf-section-header">
      <div>
        <Tag className="vf-section-title">{title}</Tag>
        {subtitle && <div className="vf-section-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="vf-section-actions">{actions}</div>}
    </div>
  );
}

/** Responsive card grid. `min` controls the smallest comfortable column width. */
export function CardGrid({ children, min = 260, gap = "1.25rem", style }) {
  return (
    <div
      className="vf-card-grid"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap, ...style }}
    >
      {children}
    </div>
  );
}

/** Form field grid with comfortable breathing room; stacks on mobile. */
export function FormGrid({ children, min = 200, gap = "0.85rem", style }) {
  return (
    <div
      className="vf-form-grid"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap, ...style }}
    >
      {children}
    </div>
  );
}

/** Row of buttons/controls with consistent spacing and wrapping. */
export function ActionBar({ children, align = "left", style }) {
  return (
    <div className="vf-action-bar" style={{ justifyContent: align === "right" ? "flex-end" : align === "between" ? "space-between" : "flex-start", ...style }}>
      {children}
    </div>
  );
}

/** Sticky summary rail — keeps key totals visible while scrolling long pages. */
export function StickySummaryPanel({ title, children, top = "1rem", style }) {
  return (
    <div className="vf-sticky-summary" style={{ top, ...style }}>
      {title && <div className="vf-sticky-summary-title">{title}</div>}
      {children}
    </div>
  );
}

/* ─── State / status ───────────────────────────────────────────────────── */

const PILL_TONES = {
  neutral: ["#f1f5f9", "#cbd5e1", "#475569"],
  success: ["#ecfdf5", "#6ee7b7", "#065f46"],
  warning: ["#fffbeb", "#fcd34d", "#78350f"],
  danger:  ["#fef2f2", "#fca5a5", "#7f1d1d"],
  info:    ["#eff6ff", "#93c5fd", "#1e40af"],
  premium: ["#f5f3ff", "#c4b5fd", "#5b21b6"],
};

/** Compact status chip. tone: neutral | success | warning | danger | info | premium */
export function StatusPill({ tone = "neutral", children, icon, title }) {
  const [bg, border, color] = PILL_TONES[tone] || PILL_TONES.neutral;
  return (
    <span className="vf-status-pill" title={title} style={{ background: bg, border: `1px solid ${border}`, color }}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}

/** Empty-state block for lists/tables with nothing to show yet. */
export function EmptyState({ icon = "📄", title, description, action }) {
  return (
    <div className="vf-empty-state">
      <div className="vf-empty-icon" aria-hidden="true">{icon}</div>
      <div className="vf-empty-title">{title}</div>
      {description && <div className="vf-empty-desc">{description}</div>}
      {action && <div className="vf-empty-action">{action}</div>}
    </div>
  );
}

/** Prominent warning/notice panel. tone matches StatusPill tones. */
export function WarningPanel({ tone = "warning", title, children, icon, style }) {
  const [bg, border, color] = PILL_TONES[tone] || PILL_TONES.warning;
  const defaultIcon = { danger: "⛔", warning: "⚠", info: "ℹ", success: "✓" }[tone] || "•";
  return (
    <div className="vf-warning-panel" style={{ background: bg, borderColor: border, color, ...style }}>
      <span className="vf-warning-icon" aria-hidden="true">{icon || defaultIcon}</span>
      <div className="vf-warning-body">
        {title && <div className="vf-warning-title">{title}</div>}
        <div className="vf-warning-text">{children}</div>
      </div>
    </div>
  );
}

/* ─── Tables ───────────────────────────────────────────────────────────── */

/**
 * Wrapper for EXISTING custom <table> markup (rows with inputs/selects).
 * Adds the scroll container, mobile scroll hint, sticky header and zebra rows
 * without forcing a rewrite of the table body.
 *
 *   <ResponsiveTable stickyHeader compact>
 *     <table className="table vf-table">…</table>
 *   </ResponsiveTable>
 */
export function ResponsiveTable({ children, stickyHeader = true, compact = false, zebra = true, hint = true, style }) {
  const cls = [
    "vf-table-wrap",
    stickyHeader ? "vf-sticky-head" : "",
    compact ? "vf-table-compact" : "",
    zebra ? "vf-table-zebra" : "",
  ].filter(Boolean).join(" ");
  return (
    <div className="vf-table-outer">
      <div className={cls} style={style}>{children}</div>
      {hint && <div className="vf-scroll-hint" aria-hidden="true">↔ Scroll sideways to see all columns</div>}
    </div>
  );
}

/**
 * Data-driven table for read-only/simple tables.
 *
 * columns: [{ key, label, align, bold, render, hideOnMobile, width }]
 * rows:    array of objects
 * totals:  { label, values: { [key]: node } }  — rendered as a bold footer row
 */
export function ResponsiveDataTable({
  columns = [],
  rows = [],
  getRowKey,
  totals = null,
  compact = false,
  stickyHeader = true,
  zebra = true,
  emptyState = null,
  caption,
  onRowClick,
}) {
  if (rows.length === 0 && emptyState) return emptyState;

  const alignOf = (c) => (c.align === "right" ? "right" : c.align === "center" ? "center" : "left");

  return (
    <ResponsiveTable stickyHeader={stickyHeader} compact={compact} zebra={zebra} hint={columns.length > 4}>
      <table className="table vf-table">
        {caption && <caption className="vf-table-caption">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}
                className={c.hideOnMobile ? "vf-hide-mobile" : undefined}
                style={{ textAlign: alignOf(c), width: c.width }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={getRowKey ? getRowKey(row, i) : (row.id ?? i)}
              onClick={onRowClick ? () => onRowClick(row, i) : undefined}
              style={onRowClick ? { cursor: "pointer" } : undefined}>
              {columns.map((c) => (
                <td key={c.key}
                  className={[c.hideOnMobile ? "vf-hide-mobile" : "", c.bold ? "vf-num-strong" : ""].filter(Boolean).join(" ") || undefined}
                  style={{ textAlign: alignOf(c) }}>
                  {c.render ? c.render(row, i) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr className="vf-table-totals">
              {columns.map((c, idx) => (
                <td key={c.key}
                  className={c.hideOnMobile ? "vf-hide-mobile" : undefined}
                  style={{ textAlign: alignOf(c) }}>
                  {idx === 0 ? (totals.label || "Total") : (totals.values?.[c.key] ?? "")}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </ResponsiveTable>
  );
}

/* ─── Readiness ring + progress card (v11.5.2) ─────────────────────────── */

export function ReadinessRing({ score = 0, size = 96, stroke = 9, label }) {
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  const colour = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="vf-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colour} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.4s ease" }} />
      </svg>
      <div className="vf-ring-label">
        <div style={{ fontSize: size * 0.28, fontWeight: 900, color: "var(--text-main)", lineHeight: 1 }}>{Math.round(pct)}</div>
        {label && <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.04em" }}>{label}</div>}
      </div>
    </div>
  );
}

const PROGRESS_TONE = {
  complete: ["#10b981", "success", "Complete"],
  needs_review: ["#f59e0b", "warning", "Needs review"],
  incomplete: ["#f59e0b", "warning", "In progress"],
  not_started: ["#cbd5e1", "neutral", "Not started"],
};

/** Clickable section progress card driven by a readinessEngine section. */
export function ProgressCard({ sectionData, onClick, highlighted }) {
  if (!sectionData) return null;
  const [colour, pillTone, defaultLabel] = PROGRESS_TONE[sectionData.status] || PROGRESS_TONE.not_started;
  const statusLabel = sectionData.critical ? "Critical" : defaultLabel;
  const tone = sectionData.critical ? "danger" : pillTone;
  const cls = ["vf-progress-card", onClick ? "vf-clickable" : "", sectionData.critical ? "vf-glow-warn" : "", highlighted ? "vf-highlight" : ""].filter(Boolean).join(" ");
  return (
    <div className={cls} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={sectionData.critical ? { borderColor: "#fca5a5" } : undefined}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>{sectionData.label}</span>
        <StatusPill tone={tone}>{statusLabel}</StatusPill>
      </div>
      <div className="vf-progress-track"><div className="vf-progress-fill" style={{ width: `${sectionData.score}%`, background: colour }} /></div>
      {sectionData.note && <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", lineHeight: 1.4 }}>{sectionData.note}</div>}
      {sectionData.missingItems.length > 0 && !sectionData.note && (
        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{sectionData.missingItems.length} item(s) remaining</div>
      )}
      {onClick && <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-primary)" }}>{sectionData.actionLabel} →</div>}
    </div>
  );
}

/* ─── SmartNumberField (v11.5.1) ───────────────────────────────────────────
   Numeric input that respects the person typing:
   - can be cleared and shown empty (no forced 0)
   - accepts partial input: "", ".", "0", "0.", "0.5", "585", "1000"
   - never resets the caret mid-type (text buffer is the source of truth
     while focused; parent value re-syncs only when blurred)
   - feeds calculations a finite fallback (emptyValue) while blank, so nothing
     ever sees NaN and nothing crashes
   - clamps to [min,max] on BLUR, not on every keystroke (unless clampLive)
   The onChange contract is onChange(number) — a drop-in for existing callers. */
export function SmartNumberField({
  value, onChange, min, max, step, emptyValue = 0, clampLive = false,
  className = "field-input", style, placeholder, id, disabled, ariaLabel,
}) {
  const [focused, setFocused] = React.useState(false);
  const toText = (v) => (v === "" || v === null || v === undefined || (typeof v === "number" && Number.isNaN(v)) ? "" : String(v));
  const [text, setText] = React.useState(() => toText(value));

  // Re-sync from the parent only when NOT focused, and only when the parent's
  // number differs from what the buffer already represents (so a blank field
  // whose fallback value is 0 is not force-filled with "0").
  React.useEffect(() => {
    if (focused) return;
    const cur = text === "" ? emptyValue : Number(text);
    if (cur !== value) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);

  const commit = (rawText) => {
    if (rawText === "" || rawText === "." || rawText === "-" || rawText === "-.") {
      onChange(emptyValue);
      return;
    }
    const n = Number(rawText);
    if (Number.isFinite(n)) {
      if (clampLive) {
        let c = n;
        if (min !== undefined && min !== null) c = Math.max(min, c);
        if (max !== undefined && max !== null) c = Math.min(max, c);
        onChange(c);
      } else {
        onChange(n);
      }
    }
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    // Allow only number-shaped input; reject anything else WITHOUT moving the
    // caret (we simply don't accept the keystroke).
    if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return;
    setText(raw);
    commit(raw);
  };

  const handleBlur = () => {
    setFocused(false);
    if (text === "") { onChange(emptyValue); return; } // left blank → stays visually blank, calc uses fallback
    let n = Number(text);
    if (!Number.isFinite(n)) { setText(""); onChange(emptyValue); return; }
    if (min !== undefined && min !== null) n = Math.max(min, n);
    if (max !== undefined && max !== null) n = Math.min(max, n);
    setText(String(n));
    onChange(n);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      id={id}
      aria-label={ariaLabel}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      style={style}
      value={text}
      step={step}
      onFocus={() => setFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}

/* ─── PresetChips (v11.5.1) ─────────────────────────────────────────────────
   Non-forcing suggestion chips. Clicking one sets the value; manual entry via
   the adjacent field always still works. The chip matching the current value
   is highlighted. */
export function PresetChips({ options = [], value, onSelect, suffix = "", format }) {
  if (!options.length) return null;
  return (
    <div className="vf-preset-chips">
      {options.map((opt) => {
        const v = typeof opt === "object" ? opt.value : opt;
        const label = typeof opt === "object" ? opt.label : `${opt}${suffix}`;
        const active = Number(value) === Number(v);
        return (
          <button key={v} type="button" onClick={() => onSelect(v)}
            className={`vf-preset-chip ${active ? "active" : ""}`}
            title={`Use ${format ? format(v) : label}`}>
            {format ? format(v) : label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Loading / skeleton ───────────────────────────────────────────────── */

/** Inline spinner for buttons and loading rows. */
export function Spinner({ size = 14, color = "currentColor" }) {
  return (
    <span
      className="vf-spinner"
      aria-hidden="true"
      style={{ width: size, height: size, borderColor: `${color} transparent ${color} transparent` }}
    />
  );
}

/** Simple skeleton placeholder block. */
export function Skeleton({ height = 16, width = "100%", radius = 6, style }) {
  return <div className="vf-skeleton" style={{ height, width, borderRadius: radius, ...style }} />;
}

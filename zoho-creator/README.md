# Voltflow — Zoho Creator rewrite

A rewrite of Voltflow as a **Zoho Creator** app in **Deluge**. The React/JS app in this
repo (`src/`) is the **reference implementation** we port from — keep it for the formulas,
test vectors and UX, even though the runtime target is now Creator.

## Why this folder exists
Creator apps are authored and run inside Zoho's cloud (Creator builder + Deluge editor).
There is no local Deluge runtime. So this folder holds **source we author locally and then
import/paste into Creator**:

- `DATA_MODEL.md` — Forms (tables) + fields + relationships → build these in Creator first.
- `deluge/*.dg` — Deluge functions ported from the JS engines. Paste into Creator as
  **standalone functions** (Settings → Functions) or workflow scripts.
- `PAGES.md` — UI pages/reports plan (wizard, dashboard, proposal).
- `PORTING_MAP.md` — which JS module maps to which Deluge function / Form.

## Hard truths carried over from the audit (do not lose these)
- This is a **feasibility tool, not certified engineering approval** — keep that disclaimer
  on every proposal/output.
- Dummy data only during build.
- The Supabase trust platform (RLS, pgTAP, tenant isolation) does **not** port — Creator has
  its own users/roles/permissions model. Re-establish access control with Creator roles +
  field/section permissions; treat that as unproven until tested in Creator.

## Build order (incremental, verifiable)
1. **Data model** — create Forms from `DATA_MODEL.md`.
2. **Sizing function** — paste `deluge/sizing.dg`; verify against the test vectors in that file.
3. Load capture + classification function.
4. Quote/VAT function.
5. Bill-vs-load reconciliation function.
6. Pages: New Project wizard → Project dashboard → Proposal.
7. Workflows: on-create audit entry, stale-design flag.

## Status
- [x] Workspace scaffold
- [x] Data model (v1 draft)
- [x] Sizing function ported (PV + battery + inverter) with test vectors
- [x] Load aggregation + classification (SOLAR/BACKUP/GRID_ONLY/EXCLUDED) ported; sizing consumes it
- [ ] Quote/VAT, reconciliation
- [ ] Pages / UI
- [ ] Creator roles & permissions

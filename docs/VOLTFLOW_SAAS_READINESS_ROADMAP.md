# Voltflow — SaaS Readiness Roadmap

Where Voltflow is (11.6 Internal Alpha) and what's between here and production SaaS. **Not production SaaS yet.**

## Now (11.6) — done
- Clean startup, view modes, readiness engine, Action Center, Project Advisor, night autonomy, proposal gate.
- **Calculation coherence** (inverter/PV ratio, load diversity, string clarity) with explanations.
- **Solar Borehole** water-first module (engine + UI + BoQ + proposal + readiness integration).
- Safe assistant fallback (no key/env leakage), Help dock, env hygiene, 189 automated tests.

## Near term (next 1–2 sprints)
1. **Three-mode PDF** — Client / Engineer / Technician exports (client-clean; engineer technical basis + formulas; technician checklists incl. borehole).
2. **Cloud storage (Supabase)** — remove the browser-only limitation; multi-device projects; **requires explicit approval before starting**.
3. **Full Technical-Basis "Explain this" drawers** for every metric (PV, battery, cold Voc, cable drop, payback, carbon, borehole TDH/pump/PV/tank).
4. **Borehole pump-curve import** — validate pump selection against a real curve.

## Mid term
- Accounts, roles & sharing; audit trail; org-level templates & price books.
- Reviewer sign-off workflow (engineer stamp) distinct from feasibility.
- Regional data packs (PSH, tariffs) beyond Kenya.
- Offline-first field mode for technicians.

## Guardrails that must persist
- Never claim certified engineering or hydraulic approval.
- Never expose API keys or env-var names in the UI.
- Never auto-load demos; never lose local data silently.
- Feasibility framing stays until a qualified-review workflow exists.

## Definition of "production SaaS ready"
Cloud persistence + accounts + roles; reviewer sign-off; three-mode PDF; billing/support; SLA + backups; security review; and documented accuracy bounds for every calculation.

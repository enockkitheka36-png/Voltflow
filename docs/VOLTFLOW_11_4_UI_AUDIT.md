# Voltflow 11.4 — Client-Perspective UI/UX Audit

**Audited build:** Voltflow 11.3 live at https://voltflow-alpha.vercel.app
**Perspective:** what a client, a technician in the field, and an engineer each experience.
**Classification:** Voltflow Internal Alpha — controlled testing and development, not production SaaS.

Findings marked ✅ were addressed in 11.4; ⏭ are deferred with a reason.

---

## Cross-cutting findings

| Theme | Finding | Action |
|---|---|---|
| Visual hierarchy | Every screen opened with a `Card` — no page-level title, so tabs felt identical | ✅ `PageHeader` / `SectionHeader` primitives added |
| Spacing | Cards sat close together; inputs and table rows were cramped on laptops | ✅ Card gap, section padding, row height and input line-height increased |
| Tables | No zebra striping, no sticky headers, headers wrapped, numbers not aligned | ✅ Global `.table-container` upgrade + `ResponsiveDataTable` |
| Mobile | Wide tables silently clipped with no scroll affordance | ✅ Scroll hint + reduced padding + `vf-hide-mobile` for secondary columns |
| Motion | No feedback on click; PDF generation froze with no indication | ✅ Button press states, page transitions, PDF spinner + toast |
| Audience mixing | Clients saw cold-Voc, DSCR, BMS limits — alarming and meaningless to them | ✅ View modes (Engineer / Client / Technician) |
| Trust | No single "what does this cost and what do I get" summary for a client | ✅ Client dashboard + proposal investment/exclusions/next-steps block |

---

## Page-by-page

### Field Survey Dashboard
- **Works:** clear checklist, progress %, obvious next action.
- **Confusing:** "No active project" reads like an error on first load.
- **Layout:** ✅ benefits from global spacing; checklist rows now breathe.
- **Hide from clients:** whole page (internal field tool) — ✅ replaced by Client dashboard in client view.
- **Internal:** yes, technician/engineer only.

### Sizing Overview (Dashboard)
- **Works:** governance strip (status / next action / top blocker) is genuinely useful.
- **Confusing:** 12+ metrics at once; LCOE and DSCR mean nothing to a client.
- **Layout:** ✅ metric grid spacing improved.
- **Hide from clients:** LCOE, DSCR, PR, engineering flags — ✅ client view shows a 4+4 metric summary instead.
- **Internal:** PR, P50/P90, DSCR, engineering flags.

### Load Assessment
- **Works:** draft/commit banner is clear; validation errors are specific.
- **Confusing:** the widest table in the app (11 columns) — hard to scan on a laptop, unusable on a phone.
- **Layout:** ✅ zebra + sticky header + tighter mobile padding; ⏭ column virtualisation deferred (would need a table rewrite).
- **Hide from clients:** entire tab — ✅ hidden in client view.
- **Internal:** yes, engineer tool.

### Energy Data Import
- **Works:** quality score and charts are strong; the "what the data shows" story lands.
- **Confusing:** column-mapping selects appear before any explanation of why mapping matters.
- **Layout:** ✅ card grid spacing; charts already responsive.
- **Hide from clients:** yes — ✅ engineer-only.
- **Internal:** yes.

### Engineering Compliance
- **Works:** pass/fail rows are unambiguous.
- **Confusing:** dense acronyms (Voc, SPD, BMS, ampacity) with no plain-language layer.
- **Layout:** ✅ spacing; ⏭ per-row "what this means" tooltips deferred to 11.5.
- **Hide from clients:** entirely — red ❌ marks alarm clients out of context.
- **Internal:** yes, and it should stay technical.

### Installer Simulation
- **Works:** roof canvas, string colours and the tab structure are excellent.
- **Confusing:** 8 sub-tabs is a lot; as-built is buried.
- **Layout:** ✅ table upgrades apply to string/commissioning tables.
- **Hide from clients:** yes.
- **Internal:** technician-primary — ✅ foregrounded in Technician view.

### System Options
- **Works:** three-card comparison is the most client-ready screen in the app.
- **Confusing:** roof-fit badge wording is long; pros/cons lists can run past the fold.
- **Layout:** ✅ card grid spacing.
- **Hide from clients:** nothing — this is good client material. ⏭ Adding it to client view deferred (proposal already summarises it).
- **Internal:** none.

### BoQ
- **Works:** itemisation is thorough and credible.
- **Confusing:** "(incl. in system cost)" markers read as double-counting to a non-accountant.
- **Layout:** ✅ zebra rows and tabular numerals make totals scannable.
- **Hide from clients:** raw internal cost lines; a client should see the proposal investment block instead.
- **Internal:** unit costs and margin-relevant lines.

### Proposal
- **Works:** metrics, client explanation and compliance summary are all present.
- **Confusing:** engineering disclaimers and compliance ticks sat between client content; no investment/exclusions/next-steps section.
- **Layout:** ✅ added Investment & next steps block (investment, payment terms placeholder, validity, exclusions, next steps) and the feasibility-quotation line.
- **Hide from clients:** nothing — but ordering now puts client content first.
- **Internal:** compliance tick row stays for the engineer.

### Save / Load
- **Works:** browser-only warning and staged import review are clear and safe.
- **Confusing:** saved projects were stacked cards with no metadata (which version? how many loads?).
- **Layout:** ✅ converted to `ResponsiveDataTable` with client, load count, app version and timestamp + `EmptyState`.
- **Hide from clients:** yes.
- **Internal:** yes.

### Feedback panel
- **Works:** form is complete and the snapshot option is valuable.
- **Confusing:** nothing significant.
- **Layout:** ✅ `EmptyState` replaces the bare "no feedback" line.
- **Hide from clients:** yes — ✅ hidden in client view (testers only).
- **Internal:** yes.

---

## Deferred to 11.5

- Plain-language tooltips on compliance rows.
- Column virtualisation / column-picker for the 11-column load table.
- Mobile bottom-nav for the most-used tabs (sidebar is long on phones).
- Bringing System Options into client view as a "choose your option" step.
- Print-optimised client proposal stylesheet (separate from PDF export).

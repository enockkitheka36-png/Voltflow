# Voltflow 11.7 — Proposal Studio

`src/utils/proposalStudio.js` · tests `scripts/proposal-studio-regression.mjs` (5) · UI: Proposal tab → "Proposal Studio" panel.

## Purpose
Compose a proposal like a document, not a fixed template: pick the **audience mode** and
**choose + reorder the sections**. Stored in project state as an export-ready structure.

## Modes
Simple Client Proposal · Engineer Review Report · Technician Handover Report ·
Lender / Grant Readiness Report.

## The 17 sections
Cover page · Client problem · Recommended solution · System summary · Benefits · Savings ·
Backup expectation · Borehole water output · BoQ summary · Assumptions · Exclusions ·
Warnings · Warranty · Next steps · Payment terms · Photos · Company profile.
(Payment terms / Photos / Company profile default **off**.)

## API (pure)
```js
createDefaultProposalStudioConfig()          // { mode:"client", sections:[{id,label,enabled}] }
normalizeProposalStudioConfig(cfg)           // repair + migrate (drops unknown, appends new)
reorderSection(cfg, id, "up"|"down")         // move a section
toggleSection(cfg, id)                        // enable/disable
setProposalMode(cfg, mode)                    // switch audience
enabledSectionIds(cfg)                        // ordered enabled ids → export-ready
```

## Persistence
`project.proposalStudioConfig`. Round-trips through Save/Load + Export/Import; old projects get
the default via `normalizeProposalStudioConfig`.

## Scope this sprint
The **config UI + data structure** are complete. The existing report generator / PDF path is
unchanged; it can read `enabledSectionIds(config)` + `config.mode` to honour the composition.
A fully section-driven PDF layout is a later, lower-risk polish. The feasibility disclaimer is
always retained regardless of section choices.

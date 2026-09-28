# Voltflow Delivery — Solar EPC Project Management Layer

**App version:** Voltflow 11.5 · **Schema version:** 11.5 (adds `project.delivery`; older saves migrate automatically)
**Classification:** Voltflow Internal Alpha — controlled testing and development, **not production SaaS**.

---

## 1. What Voltflow Delivery is

Voltflow already sized systems and produced proposals. Delivery adds the layer that runs the job *after* the quote: stages, tasks, procurement, installation sign-off, issues and approval gates — all attached to the same project, so nothing is re-entered.

It is deliberately **solar-EPC specific**, not a generic kanban: the stages, default tasks, checklist and gates follow how a Kenyan solar installation actually runs.

It supports **coordination**. It is **not a certified engineering approval system** — recording an approval logs that a person signed off, it does not itself approve anything.

## 2. Project stages (15)

`lead → survey_scheduled → survey_done → sizing_in_progress → proposal_draft → proposal_sent → client_approved → procurement → installation_scheduled → installation_in_progress → commissioning → handover_done → om_monitoring`, plus terminal `lost` and `cancelled`.

Stages roll up into 7 board columns: **Survey · Design · Proposal · Procurement · Installation · Handover · O&M**.

## 3. Task manager

Tasks carry title, category, owner, due date, status (`todo / in_progress / blocked / done`), priority (`low → urgent`), notes and timestamps. Categories follow the workflow: sales, survey, design, proposal, procurement, installation, commissioning, handover, om.

**A starter task list is generated automatically** (17 tasks) and adapts to the project:
- Genset hybrid → ATS interface, minimum-loading verification
- EV charging → charger model / OCPP, supply capacity
- Mini-grid → customer connection list, distribution permits
- Off-grid → autonomy expectation and generator backup
- Blueprint projects → obtain equipment schedule, re-verify sizing

Filter by status and category; blocked and overdue tasks surface as blockers on the dashboard.

## 4. Procurement tracker

Generated from the **current BoQ plus the accessories/BOS list** — one click produces the full purchase list (62 lines on a typical hybrid project). Tracks required / ordered / received quantities, supplier, unit cost, line value and status (`needed → quoted → ordered → received → installed`).

**Manual edits are never silently overwritten.** Regenerating shows a confirmation first: how many lines would be added, how many untouched lines refreshed, and how many manually-edited or hand-added lines are kept exactly as they are.

Shortages (received < required) are highlighted and become delivery blockers. Export to CSV for suppliers.

## 5. Installation checklist

A 16-item sign-off record grouped into Preparation / Mechanical / Electrical / Commissioning / Handover, each with a tick, signed-off-by, date and notes.

This **complements** the 19-step sequence tick-list in Installer Simulation — that one is the on-site running order, this one is the handover audit trail. Both are kept.

## 6. Issue / snag tracker

Issues carry severity (`low → critical`), owner, status (`open / in_progress / resolved`), notes, resolution notes and resolved date. Critical and high open issues automatically appear as delivery blockers.

Each issue has a **"Share with client"** flag — unshared issues never appear in Client View.

## 7. Approval gates

Seven gates, each recording approver name, date and notes: Proposal ready · Client approved · Deposit received · Procurement approved · Installation ready · Commissioning passed · Handover signed.

Gates are **advisory, not locking** — moving a stage shows what is missing and lets the user proceed deliberately:
- → Procurement without client approval → **danger**: do not commit purchase orders
- → Procurement without deposit → warning
- → Installation with procurement shortages → **danger**: installation may stall on site
- → Handover with incomplete checklist or unsigned commissioning → **danger**
- → O&M without a signed handover → warning

## 8. View mode differences

| | Engineer | Technician | Client |
|---|---|---|---|
| Tab name | Project Delivery | Project Delivery | **Project Progress** |
| Overview + stage control | ✅ full | ✅ read-only stage | ❌ |
| Stage board | ✅ | ❌ | ❌ |
| Tasks | ✅ all | ✅ | ❌ |
| Procurement + costs | ✅ | ❌ | ❌ |
| Installation checklist | ✅ | ✅ | ❌ |
| Issues | ✅ all | ✅ all | only issues flagged "share with client" |
| Approvals | ✅ | ❌ | ❌ |
| Timeline | — | — | ✅ simplified 8-milestone timeline |

Client View carries **no costs, no procurement, no internal issues** — verified by test.

## 9. Storage

`delivery` lives on `project`, so it flows through save, load, export and import automatically. Old projects without it get a default delivery (stage `lead`) via `normalizeLoadedRecord`. The import review screen now reports whether a file carries delivery data, its stage and task count.

## 10. Limitations

- **One project at a time.** The stage board shows the active project only; multi-project pipeline needs cloud storage.
- No user accounts — "owner" is a free-text field, not an assignment to a real user.
- No notifications, reminders or calendar integration.
- Procurement has no supplier catalogue or PO numbering; it is a tracking list, not an ERP.
- Delivery data is browser-local like the rest of the project (export to share).
- View modes are presentation, not access control — a client-mode device can still switch back.
- Approval gates are advisory records, **not** engineering, structural, protection-coordination or KPLC/EPRA approval.

## 11. Future cloud roadmap

1. **Cloud storage** (Supabase/Firebase) behind the existing `projectStorage.js` seams → the board becomes a real multi-project pipeline.
2. **Accounts and roles** → owners become real assignees; Client View becomes enforced permission.
3. **Notifications** on overdue tasks, shortages and gate blockers.
4. **Supplier records and PO numbers** on procurement lines.
5. **Mobile-first technician mode** for on-site checklist and snag capture with photos.

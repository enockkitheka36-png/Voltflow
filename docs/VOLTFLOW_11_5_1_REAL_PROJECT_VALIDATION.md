# Voltflow 11.5.1 — Real-Project Validation Report

**Build tested:** Voltflow 11.5 (schema 11.5), local dev + production parity
**Date:** 2026-07-22
**Classification:** Voltflow Internal Alpha — controlled testing and development, not production SaaS.

## Test subject

**Riverside Estate — perimeter flood lighting & security power**, Riverside Drive, Westlands, Nairobi.
Three-phase commercial estate, hybrid system, manual load assessment.

> **Data caveat:** no actual Solarise project records exist in this repo, so the figures below are a *representative* Riverside-type project built for validation — not your real Riverside file. The workflow findings are real; the numbers are constructed.

This project type was chosen deliberately: flood lighting is a **night-dominant load** (89% of energy after dark), which none of the six demo projects exercise. That is where the most important finding came from.

**Load profile entered:** 12 × 150 W flood lights (11 h night), 20 × 30 W bollards (11 h night), 2 × 400 W gate motors, CCTV + NVR 180 W (24 h), 1.5 kW guard-house sockets.
**Result:** 4.88 kW connected, **34.2 kWh/day — Day 3.9 / Night 30.3**.

---

## 1. Validation results

| # | Check | Result |
|---|---|---|
| 1 | Create real project via wizard | ✅ Pass — 5 steps, landed on Load Assessment as chosen |
| 2 | Generate BoQ and accessories | ✅ Pass — quantities and costs verified by hand |
| 3 | Generate procurement from BoQ/accessories | ✅ Pass — 59 lines, KES 1,026,914 |
| 4 | Quantities / totals / descriptions accurate | ✅ Pass — see §2 |
| 5 | Manual procurement edits not overwritten | ✅ **Pass — the standout feature** |
| 6 | Stage movement + approval gates | ⚠️ Partial — gates fire, but skipped stages aren't checked |
| 7 | Client View exposes no costs/margins/internal notes | ✅ Pass |
| 8 | Technician View shows only field-execution info | ✅ Pass |
| 9 | Save / load / export / import with delivery | ✅ Pass — full fidelity |
| 10 | Workflow gaps documented | See §3–§5 |

### 2. Accuracy spot-checks (hand-verified)

- Daily energy: 19.8 + 6.6 + 0.48 + 4.32 + 3.0 = **34.2 kWh ✓**
- BoQ: 12 panels × KES 23,000 = **276,000 ✓**; 4 battery modules × 72,000 = **288,000 ✓**
- Advisory carbon rows (8.1–8.3) correctly show “—” and are **excluded from the grand total** ✓
- Procurement quantities match BoQ exactly for all six major-equipment lines ✓
- Sizing: 34.2 kWh × 0.85 coverage ÷ (5.6 PSH × 0.77 PR) = 6.74 kWp → **12 × 600 W = 7.2 kWp ✓**
- Governance: KES 1.16 M correctly triggered **“Manager review required”** ✓

---

## 3. Bugs found

### BUG-1 — Wizard phase selection is silently overwritten (HIGH)
**Selected “Three Phase (400V)” in the wizard; the project came out “Single Phase (230V)”.**

Root cause: `defaultSurvey.phaseType` is `"Single Phase (230V)"` (App.jsx:495), and the survey→project sync effect runs `if (survey.phaseType) mapped.phase = survey.phaseType` (App.jsx:8222) unconditionally. The survey default always beats the wizard's answer.

**Why it matters commercially:** phase drives inverter selection, AC cable sizing and the BoQ. A three-phase commercial estate silently quoted as single-phase is a real mis-quote risk — and nothing warns the user.

Severity mitigated by: setting phase manually in Project Setup **does** stick (the effect only re-runs when `survey.phaseType` changes). So it is recoverable — but silent, and the user has no reason to re-check.

**Fix:** only sync survey → project when the survey field was actually touched, or make `defaultSurvey.phaseType` empty (matching the 11.4.1 clean-startup approach for `county`). Recommend the latter — it is one line and consistent with the existing pattern.

### BUG-2 — Import review doesn't display delivery data (LOW)
`importProjectJson` computes `hasDelivery`, `deliveryStage` and `deliveryTaskCount` (asserted by `delivery-regression` test 13), but the review card renders Simulation and Energy-import rows only. The user importing a project cannot see that it carries delivery state.

**Fix:** add one row to the review grid. ~3 lines.

### BUG-3 — Stage gates only check the target stage (MEDIUM)
Jumping `lead → installation_scheduled` warned about procurement, but **never mentioned that client approval and deposit were never recorded** — because those gates belong to the skipped `procurement` stage.

**Why it matters:** the most dangerous move in EPC is exactly this — skipping ahead. A PM can reach “installation scheduled” with no recorded client approval and no warning.

**Fix:** `getStageGateWarnings` should evaluate all gates for stages between current and target, not just the target.

---

## 4. Risky assumptions (most important finding)

### RISK-1 — Battery autonomy is overstated for night-dominant loads (HIGH)

For this flood-lighting project the app reported:

| Figure shown | Value |
|---|---|
| Critical night load | 30.3 kWh |
| Backup energy needed | 14.25 kWh |
| Actual battery | 20.48 kWh |
| **Estimated autonomy** | **11.8 hrs** |

But the real numbers:
- Usable energy = 20.48 × 0.87 DoD × 0.94 eff = **16.75 kWh**
- Night energy required = **30.3 kWh** → the battery covers **55% of the night**
- Sustained night demand = (12×150 + 20×30 + 180) = **2.58 kW**
- Real runtime on the actual load = 16.75 ÷ 2.58 = **≈ 6.5 hours**, not 11.8

The formula isn't wrong — it is doing what it documents: `backupNeed = criticalDailyKwh × (backupHours/24)`, then autonomy = usable ÷ (backupNeed/backupHours), i.e. against a **1.43 kW averaged** reference. But for a load that is concentrated in an 11-hour window at 2.58 kW, averaging across 24 hours understates demand by ~1.8×.

**Consequence:** quote the client "11.8 hours backup" on a flood-lighting job and the lights die around 01:00. This is precisely the project type where that happens.

**Recommended fix (11.5.1):** where night energy > day energy, size and report against the **actual night window** rather than a 24-hour average, and show a "battery covers X% of the night load" line next to autonomy. At minimum, add a warning when `usableKwh < nightKwh`.

### RISK-2 — All loads default to critical/backup
Every added load defaults to `essential: true`, so critical kWh equalled total kWh (34.2 = 34.2). For flood lights that happens to be right, but on a mixed commercial site it silently oversizes the battery. Worth a "review which loads truly need backup" prompt.

---

## 5. Missing fields / workflow gaps

1. **No procurement line for services.** BoQ 10.1 “Installation, commissioning, SLD & training” (KES 108,000) is excluded from procurement. Defensible (it isn't *procured*), but the EPC still has to track it — procurement value (1.03 M) therefore doesn't reconcile to project value (1.16 M) and nothing explains the gap.
2. **No lead time / expected delivery date** on procurement lines — the single most useful field for chasing suppliers.
3. **No PO number / invoice reference** field.
4. **Task owner is free text**, so there is no "my tasks" filter for a named technician (waits for accounts).
5. **No photo attachment** on issues/snags — field teams will want this.
6. **Delivery has no link to as-built data** already captured in Installer Simulation (Voc/Isc, cable lengths); the two live side by side.
7. **Procurement has no "partially received" state** between `ordered` and `received` — real deliveries arrive split.
8. **No stage-change history**, so there is no audit trail of who moved the project and when.

## 6. UI pain points

- The Delivery **procurement table at 59 rows is heavy** — needs category grouping or a filter (BOS consumables dominate the list and bury the major equipment).
- Stage moves happen via a dropdown; a visual stage stepper would read better and make skipping obvious.
- Clicking Generate from BoQ twice is the only way to discover the merge-confirmation behaviour; a hint would help.
- Some React state updates need a render tick before the next control enables (noticed when driving the wizard programmatically). Not user-visible at human speed.

---

## 7. Recommended 11.5.1 fixes (small, safe, high value)

| Priority | Fix | Effort |
|---|---|---|
| 1 | **BUG-1** — stop survey defaults overwriting wizard phase (blank `defaultSurvey.phaseType`) | 1 line |
| 2 | **RISK-1** — night-load battery coverage warning + "% of night covered" figure | ~20 lines, engine + Battery tab |
| 3 | **BUG-3** — gates evaluate skipped intermediate stages | ~10 lines in `getStageGateWarnings` |
| 4 | **BUG-2** — show delivery data in import review | ~3 lines |
| 5 | Procurement: add `leadTimeDays` + `expectedDelivery` + `poNumber` fields | ~15 lines |
| 6 | Procurement: category grouping/filter for long lists | ~25 lines |
| 7 | Add "review which loads need backup" prompt when critical = 100% of load | ~10 lines |

All are contained changes to existing pure functions and one UI card — no architectural work.

## 8. What should wait for 11.6 Cloud Backend

- Real task assignment to named users ("my tasks") and enforced Client View permissions.
- Multi-project pipeline board (the whole point of the stage board).
- Stage-change history / audit trail with attribution.
- Photo attachments on issues (needs blob storage).
- Supplier records, PO numbering and cross-project procurement consolidation.
- Notifications for overdue tasks and shortages.

## 9. Verdict: is Voltflow 11.5 ready for internal Solarise testing?

**Yes — with one fix first.**

The delivery layer held up well on a real-shaped project: BoQ and procurement quantities were accurate, the manual-edit protection worked exactly as designed (a negotiated panel price and supplier survived regeneration *and* a full export/import round-trip), Client View leaked nothing, and Technician View stayed practical.

**Ship BUG-1 (the phase overwrite) before putting it in front of Solarise engineers** — it is a one-line fix and a silent mis-quote risk on exactly the commercial three-phase jobs this tool is for.

**RISK-1 (battery autonomy on night loads) should be fixed before any flood-lighting or security-lighting quote goes to a client.** It won't corrupt data, but it will overstate backup to a client by roughly 1.8× on that project shape.

With BUG-1 fixed, 11.5 is suitable for **internal testing on real projects, with engineer review of every number before anything reaches a client** — which is the standing rule for this alpha anyway.

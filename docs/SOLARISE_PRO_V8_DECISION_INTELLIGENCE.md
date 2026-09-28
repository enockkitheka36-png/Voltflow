# Solarise Pro v8 — Decision Intelligence + Quote Governance Build

**Version:** v8  
**Date:** 2026-06-02  
**Status:** Production-ready for internal field and sales engineering use

---

## What Problem This Version Solves

Previous versions (v6–v7) answered: *"What is the right system for this client?"*

v8 now also answers:
1. **Is this project ready to propose?** (Readiness Score)
2. **What risks must be resolved before sending?** (Blockers, Governance)
3. **Is this commercially viable?** (Financial viability checks)
4. **What should we recommend to the client?** (Advisory Engine)
5. **Which system option best fits this client?** (Good / Better / Best)
6. **How reliable is the data behind this quote?** (Assumption Confidence)
7. **What quick wins can we offer before solar?** (Quick Wins Generator)
8. **How do we explain this simply to the client?** (Client Explanation)

---

## New Features

### 1. Project Readiness Score (0–100)

**Location:** `src/utils/readiness.js` — `calculateReadiness()`

Five scoring categories:

| Category | Max | What is checked |
|---|---|---|
| Survey Completeness | 20 | Client name, phone, address, earthing, photos, objectives |
| Load Quality | 15 | Load count, day/night split, critical loads, surge loads |
| Engineering Safety | 25 | Cold Voc, cable drops, BMS current, ampacity, earthing |
| Financial Viability | 20 | Payback, NPV, DSCR, carbon exclusion |
| Proposal Readiness | 20 | Client name, engineering pass, financial pass, no blockers |

**Readiness Status values:**
- `Ready to propose` — all checks pass, no blockers
- `Ready with engineer review` — viable but needs sign-off
- `Engineering review required` — unresolved engineering flags
- `Incomplete survey` — insufficient site data
- `Commercially weak` — payback too long or no net benefit
- `High risk — do not send` — critical safety or structural issue

**Important:** Any blocker (earthing missing, cold Voc failure, BMS exceeded, asbestos, etc.) prevents the `Ready to propose` status regardless of other scores.

---

### 2. Quote Governance System

**Location:** `src/utils/readiness.js` — `computeGovernanceStatus()`

Produces a governance status and required approvals:

| Condition | Status | Who approves |
|---|---|---|
| Cold Voc failure or BMS exceeded | Engineering review required | Design Engineer |
| Survey incomplete | Survey incomplete | Sales Engineer |
| Cost > KES 1,000,000 | Manager review required | Manager |
| Payback > 8 years | Commercial review required | Manager / Finance |
| All clear | Ready to send | — |

**Shown in:** Dashboard (readiness badge), Project Readiness tab.

---

### 3. Good / Better / Best System Options

**Location:** `computeOptionSizing()` in `App.jsx`, rendered in `SystemOptionsTab`

Three variants generated from the current project with adjusted parameters:

| Option | Coverage | Backup | Autonomy | Best for |
|---|---|---|---|---|
| Essential Backup | 55% | 4 hrs | 0.75 days | Budget clients, backup focus |
| Balanced Solar Saver | Base | Base | Base | Most clients — recommended |
| Premium Energy Security | 100% | 14 hrs | 2.5 days | Reliability-first clients |

Each option shows: PV kWp, panels, battery kWh, inverter kW, estimated cost, payback, autonomy, pros/cons, best-fit description.

**Available for:** Solar PV Hybrid, Off-grid, Genset Hybrid system types.

---

### 4. Solarise Advisory Engine

**Location:** `src/utils/advisory.js` — `generateAdvisory()`

Deterministic rule-based advisory — no external AI.

Four advice categories:
- **Engineering:** Cable sizing, BMS limits, cold Voc, earthing, ventilation
- **Commercial:** Bill-to-cost ratio, payback position, day/night load balance
- **Sales:** Which option to lead with, surge load education, backup expectations
- **Operations:** Photo completion, DB upgrade, data logging, manager approval

---

### 5. Assumption Confidence Score

**Location:** `src/utils/readiness.js` — `computeAssumptionConfidence()`

Rates confidence in the data behind the quote:

| Source | Confidence |
|---|---|
| Data logger / KPLC bill / measured | High (85–100%) |
| Supplier quote / approved price list | High (80–90%) |
| Client estimate / default pricing | Low (35–45%) |

New project fields: `billSource`, `loadSource`, `pricingSource` (in `defaultProject`).

---

### 6. Quick Wins Before Solar

**Location:** `src/utils/advisory.js` — `generateQuickWins()`

Load-table and survey-driven efficiency recommendations:
- Replace halogen lights with LED
- Shift kettle/iron/cooking to solar hours
- Schedule pump operation in daytime
- Check fridge/freezer energy rating
- Motion sensors for security lights
- Stagger high-surge motor starts
- Data logging for commercial sites
- DB fix before solar installation

Each win shows: Recommendation, Detail, Impact (Low/Medium/High), Cost, Priority.

---

### 7. Client-Friendly Explanation

**Location:** `src/utils/advisory.js` — `generateClientExplanation()`

Generates simple Kenyan-market-friendly language for:
- What we found at your site
- What we recommend
- What this system will do
- What it will not do
- Expected savings
- Key assumptions
- Next steps

**Shown in:** Proposal tab.

---

## Recommended Internal Workflow (Solarise Team)

```
1. Create project       → New Project tab
2. Field survey         → Site Survey, Roof & Shading, Electrical, Photos, Safety
3. Load assessment      → Load Assessment tab
4. Review sizing        → Dashboard, PV + PR, Battery, Inverter + Safety
5. Engineering check    → Engineering Compliance tab
6. Readiness score      → Project Readiness tab
7. System options       → System Options tab
8. Quick wins           → Project Readiness → Quick Wins section
9. Advisory review      → Project Readiness → Advisory Engine section
10. Manager/Eng approval → Quote Governance status (if required)
11. Generate proposal    → Proposal tab (includes client explanation)
12. Save/export          → Save / Load tab
```

---

## Files Added in v8

| File | Purpose |
|---|---|
| `src/utils/readiness.js` | calculateReadiness, computeAssumptionConfidence, computeGovernanceStatus |
| `src/utils/advisory.js` | generateAdvisory, generateClientExplanation, generateQuickWins |
| `scripts/decision-regression.js` | 20 tests, 39 checks for decision intelligence |
| `docs/SOLARISE_PRO_V8_DECISION_INTELLIGENCE.md` | This document |

## Files Modified in v8

| File | Changes |
|---|---|
| `src/App.jsx` | Added imports, new defaultProject fields, computeOptionSizing(), 3 new components, updated Sidebar, Dashboard, Proposal |

---

## Test Results

| Suite | Checks | Pass | Fail | Score |
|---|---|---|---|---|
| `calculation-regression.js` (v6–v7) | 102 | 102 | 0 | 100/100 |
| `decision-regression.js` (v8) | 39 | 39 | 0 | 100/100 |

---

## Known Limitations

| Limitation | Status |
|---|---|
| Readiness scoring uses rule-based heuristics — not a licensed audit | Advisory only |
| System options compute a simplified sizing (not the full financial model) | Indicative costs |
| Advisory engine is deterministic — not conversational AI | By design |
| Assumption confidence relies on user-declared source fields | User must set billSource etc. |
| Client explanation is template-based — review before sending to client | Human review required |
| Quick wins are load-table-based — no energy measurement | Advisory only |
| Governance is advisory — does not enforce workflow approval | User discipline required |
| Carbon revenue remains excluded from base cashflow by default | Intentional — per audit |
| Tool remains feasibility / proposal support — not licensed engineering design | Always |

---

## What Solarise Pro v8 Is

✅ A field survey, engineering review, and proposal support tool  
✅ A decision intelligence layer for Solarise sales engineers  
✅ A quote governance and escalation guide  
✅ A client-friendly explanation generator  
✅ A commercial viability checker  
✅ An engineering safety reviewer (advisory level)

## What Solarise Pro v8 Is NOT

❌ Final licensed engineering design software  
❌ A replacement for a qualified electrical engineer's sign-off  
❌ A formal carbon credit registration tool  
❌ A grid interconnection approval application  
❌ A legal or financial advice tool  

> **Solarise Insight Limited — Solarise Pro v8 is a decision support and proposal tool for field and engineering teams. All engineering designs must be independently reviewed and signed off by a qualified licensed electrical engineer before installation.**

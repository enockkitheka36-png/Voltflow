# Voltflow — Bank Pilot UAT Test Plan

**Build:** 11.7 · **Classification:** Internal Alpha / Bank Pilot Readiness.
Run before any bank user touches the app. Record pass/fail + severity for each scenario.

## Test users
| Role | Who | Focus |
|---|---|---|
| Founder | Me | Every path, smoke |
| Product owner | Mary | Client proposal + Bank Pilot Mode |
| Sales | 1 Solarize sales user | Lead → quote → proposal |
| Operations | 1 Solarize ops user | Tasks/stages, export, tracking |
| Security | Vincent | Access, data, error handling |
| Bank-like | 1 non-technical tester | Bank Pilot Mode without training |

## Severity
**S1** blocker (stop pilot) · **S2** major (fix before pilot) · **S3** minor (fix soon) · **S4** cosmetic.

## Scenarios (steps → expected → result)
| # | Scenario | Steps | Expected | Pass/Fail | Sev |
|---|---|---|---|---|---|
| 1 | Create bank lead | Bank Pilot Mode → Start bank lead → enter client | Lead created; guided next step shown | | |
| 2 | Select standard package | Choose a standard package/template | Package preloads typical loads/assumptions | | |
| 3 | Enter basic customer/site | Fill required site + bill/load fields | Validation on required fields; can proceed | | |
| 4 | Generate 2–3 quote variants | Open scenario cards (Good/Better/Best) | 2–3 variants with PV/inverter/battery/cost | | |
| 5 | Choose recommended quote | Select a variant → "Use this design" | Design applied; summary updates | | |
| 6 | Generate proposal/report | Generate Client Proposal PDF | Clean client PDF; no internal detail; disclaimer present | | |
| 7 | Submit for Solarize review | Mark "submit for review" / set stage | Status changes to submitted/for-review | | |
| 8 | Track task/status | View dashboard/stage | Current stage + next action visible | | |
| 9 | Export project | Export Project JSON | File downloads; project data only, no secrets | | |
| 10 | Import project | Import the JSON on a clean browser | Staged review → apply; project restored | | |
| 11 | Client View | Switch to Client view | Simple, benefits-focused; internal detail hidden | | |
| 12 | Bank Pilot Mode | Switch to Bank Pilot Mode | Only simplified steps; engineering/procurement hidden; banner + data warning visible | | |
| 13 | Error cases | Blank fields, huge numbers, no loads | Friendly validation; no NaN; no stack traces/env names | | |
| 14 | Mobile/tablet | Open on phone + tablet | Usable; buttons don't cover inputs; readable | | |
| 15 | Access & confidentiality | Check what a user can see; inspect export/console | No cross-user isolation today (browser-only) → confirm the pilot data rules are acceptable | | |

## Exit criteria
- **All S1/S2 resolved.** No S1 open.
- Scenarios 1–10 pass end-to-end for sales + ops users.
- Scenario 12 (Bank Pilot Mode) passes for the non-technical bank-like tester **without training**.
- Scenario 15: data-storage/confidentiality position is **explicitly accepted** by Mary + Vincent
  for the pilot (test data, agreed browser), or a mitigation is in place.
- Results recorded and attached to the go/no-go decision.

## Notes on confidentiality during UAT
Use **test / non-sensitive** data. Do not enter real IDs, financial account numbers or
confidential bank records until cloud auth + isolation exist (see data-protection note).

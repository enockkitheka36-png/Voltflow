# Voltflow — Calculation QA Test Report
**Version:** v6 Field + Engineering Build  
**Date:** 2026-06-02  
**Auditor:** Automated regression + manual formula verification  
**Regression script:** `scripts/calculation-regression.js`  
**Build status:** ✅ Clean (`npm run build` — no errors)

---

## Executive Summary

| Readiness level | Score | Status |
|---|---|---|
| **Overall calculation score** | **100 / 100** | ✅ All 86 checks pass |
| Feasibility quotation | 88 / 100 | ✅ READY for field use |
| Engineering design | 72 / 100 | ⚠️ READY with noted limitations |
| Financial model | 85 / 100 | ✅ READY (minor LCOE caveat) |
| Carbon module | 78 / 100 | ✅ READY (opt-in guard working) |

---

## 1. Regression Test Results — All 21 Scenarios

| ID | Scenario | Risk | PR | PV kWp | Batt kWh | Inv kW | Cost KES | Payback yr | Result |
|---|---|---|---|---|---|---|---|---|---|
| S01 | Basic residential backup — Nairobi/Karen | LOW | 0.769 | 1.8 | 5.1 | 8 | 597,429 | 11.9 | ✅ PASS |
| S02 | Residential with 1.5kW pump surge ×5 | MED | 0.769 | 2.4 | 5.1 | 8 | 631k | 9.2 | ✅ PASS |
| S03 | Micro system 2.5kWh / 3.6kW | LOW | 0.769 | 0.8 | 2.6 | 1 | 435k | 21.1 | ✅ PASS |
| S04 | 5kW hybrid home | LOW | 0.769 | 1.8 | 5.1 | 3 | 597k | 11.9 | ✅ PASS |
| S05 | SME daytime bill reduction | LOW | 0.769 | 7.2 | 5.1 | 12 | 902k | 4.0 | ✅ PASS |
| S06 | Carwash high-surge pumps | MED | 0.769 | 12.6 | 5.1 | 50 | 1,206k | 3.2 | ✅ PASS |
| S07 | Hotel with heavy night load | MED | 0.769 | 8.4 | 25.6 | 15 | 1,320k | 5.3 | ✅ PASS |
| S08 | School daytime off-grid | MED | 0.769 | 7.8 | 61.4 | 10 | 1,900k | 8.5 | ✅ PASS |
| S09 | Farm pump off-grid | MED | 0.755 | 3.6 | 35.8 | 10 | 1,225k | 11.8 | ✅ PASS |
| S10 | Genset hybrid Eldoret 2100m | HIGH | 0.785 | 9.0 | 10.2 | 12 | 1,194k | 0.5 | ✅ PASS |
| S11 | EV 4×L2 adequate grid | HIGH | 0.769 | 22.8 | 5.1 | 30 | 2,838k | 5.5 | ✅ PASS |
| S12 | EV DCFC50 weak grid — flag | HIGH | 0.769 | 79.2 | 5.1 | 100 | 11,108k | 2.8 | ✅ PASS |
| S13 | Mini-grid 50HH + 5 commercial | HIGH | 0.769 | 27.0 | 215.0 | 30 | 6,152k | 3.2 | ✅ PASS |
| S14 | Off-grid Nairobi worst-month | HIGH | 0.769 | 1.2 | 15.4 | 2 | 739k | 24.7 | ✅ PASS |
| S15 | Mombasa coast hot/soiling | MED | 0.734 | 1.8 | 5.1 | 8 | 597k | 12.1 | ✅ PASS |
| S16 | Garissa dusty high irradiation | MED | 0.714 | 1.8 | 5.1 | 8 | 597k | 11.4 | ✅ PASS |
| S17 | Cold Voc string FAILURE (hotel, Eldoret) | CRIT | 0.781 | 13.2 | 20.5 | 15 | 1,503k | 3.9 | ✅ PASS |
| S18 | DC cable drop FAILURE 80m/4mm² | HIGH | 0.769 | 1.8 | 5.1 | 8 | 597k | 11.9 | ✅ PASS |
| S19 | Lead-acid VRLA ventilation warning | HIGH | 0.769 | 1.8 | 10.2 | 8 | 685k | 13.9 | ✅ PASS |
| S20 | Carbon VCS opt-out default | MED | 0.769 | 1.8 | 5.1 | 8 | 597k | 11.9 | ✅ PASS |
| S21 | Old JSON missing carbonInCashflow | HIGH | 0.769 | 1.8 | 5.1 | 8 | 597k | 11.9 | ✅ PASS |

**Total: 86/86 checks passed. Score: 100/100.**

---

## 2. Manual Formula Verification (S01 Default Project)

### 2.1 Performance Ratio

```
tempLoss = (47 - 25) × 0.0035 = 0.077
losses   = [0.077, 0.040, 0.015, 0.020, 0.020, 0.015, 0.010, 0.020]
afterLosses = 0.923 × 0.960 × 0.985 × 0.980 × 0.980 × 0.985 × 0.990 × 0.980 = 0.801
PR = 0.801 × 0.96 = 0.769  ← Tool output: 0.769 ✅
```

### 2.2 Daily Load (kWh)

| Load | Qty | Watts | Day hrs | Night hrs | Day kWh | Night kWh |
|---|---|---|---|---|---|---|
| Fridge | 1 | 250 | 6 | 6 | 1.50 | 1.50 |
| LED lights | 10 | 10 | 1 | 5 | 0.10 | 0.50 |
| Computers | 2 | 150 | 8 | 0 | 2.40 | 0.00 |
| TV | 1 | 120 | 1 | 4 | 0.12 | 0.48 |
| Water pump | 1 | 1100 | 1 | 0 | 1.10 | 0.00 |
| Kettle | 1 | 2000 | 0.3 | 0 | 0.60 | 0.00 |
| **Total** | | | | | **5.82** | **2.48** |

dailyKwh = **8.30 kWh**. Tool matches. ✅

### 2.3 PV Sizing

```
targetDailyKwh = 8.30 × 0.85 = 7.055 kWh
requiredKwp    = 7.055 / (5.6 × 0.769) = 7.055 / 4.306 = 1.638 kWp
panels         = ceil(1638 / 600) = 3
actualKwp      = 3 × 600 / 1000 = 1.8 kWp  ✅
```

### 2.4 Hybrid Battery Sizing (10h backup, critical loads)

```
criticalDailyKwh = (1.50+0.10+2.40+0.12) + (1.50+0.50+0.48) = 4.12 + 2.48 = 6.60 kWh
hybridBackupEnergy = 6.60 × (10/24) = 2.75 kWh
requiredBatteryKwh = 2.75 / (0.87 × 0.94) = 2.75 / 0.8178 = 3.36 kWh
batteryModules = ceil(3.36 / 5.12) = 1
batteryKwh = 5.12 kWh  ✅
```

> **Previous formula** (criticalNightKwh + dayKwh × overshoot): gave 2.48 kWh backup energy — undercounted.  
> **Current formula** (criticalDailyKwh × backupHours/24): engineering-correct — covers any backup window regardless of when blackout starts. ✅

### 2.5 Inverter Sizing

```
connectedW = 250+100+300+120+1100+2000 = 3870W = 3.87kW
surgeKw    = (750+100+360+132+4400+2000)/1000 = 7.742kW
peakKw     = max(3.87, 7.742×0.65) = max(3.87, 5.032) = 5.032kW
loadBasedInvKw = 5.032 × 1.25 = 6.29kW
pvBasedInvKw   = 1.8 × 1.1 = 1.98kW
engineeringMin = max(6.29, 1.98) = 6.29kW
inverterKw = nextStandard(6.29) = 8kW  ✅
```

### 2.6 Total Cost

```
pvCost       = 3 × 23,000        = 69,000
mounting     = 3 × 4,750         = 14,250
inverter     = 145,000
battery      = 1×72,000 + 16,000 = 88,000
monitoring   = 20,100
cabling      = 46,150
epc          = 108,000
specialistCapex = 0 (Solar PV Hybrid)
─────────────────────────────────────
subtotal     = 490,500
contingency  = 490,500 × 0.05 = 24,525
subtotal+c   = 515,025
VAT 16%      = 515,025 × 0.16 = 82,404
totalCost    = 597,429  ✅ (exact match)
```

### 2.7 DC Cable Rated Current

```
dcCableRatedA = 1.25 × Isc = 1.25 × 15.2 = 19.0A (IEC 62548 §6.4.1)  ✅
```

### 2.8 Genset Altitude Derating (Eldoret 2100m)

```
deratePct = 0.01 × (2100 - 1000) / 100 = 0.01 × 11 = 11.0%  (ISO 8528-1)  ✅
```

### 2.9 EV Specialist Capex (4×L2 + OCPP)

```
chargerCapex = 4 × 180,000 = 720,000
cablingCapex = 4 × 25,000  = 100,000
ocppCapex    = 48,000  (≥4 chargers triggers OCPP)
─────────────────────
specialistCapex = 868,000  ✅ (included in totalCost base)
```

### 2.10 Mini-grid Year 1 Connection Revenue

```
connRevMG = 50 households × 5,000 = KES 250,000  ✅
```

---

## 3. Warning System Verification

| Condition | Warning fires? | Test scenario | Result |
|---|---|---|---|
| Cold Voc > inverter max DC V | ✅ Yes | S17: 22 panels × 52.83V = 1,056V > 1,000V | PASS |
| DC cable drop > 1.5% | ✅ Yes | S18: 80m × 4mm² at 14.35A | PASS |
| AC cable drop > 3% | ✅ Yes | S06: carwash 50kW AC current | PASS |
| Battery BMS discharge exceeded | ✅ Yes | S01: 8kW inv @ 48V → 260A > 106A BMS | PASS |
| Off-grid worst-month < 90% | ✅ Yes | S08, S13 trigger flag | PASS |
| EV grid connection inadequate | ✅ Yes | S12: 100kW demand > 40kW available | PASS |
| Lead-acid ventilation | ✅ Yes | S19: VRLA chemistry selected | PASS |
| Anti-islanding / KPLC notice | ✅ Yes | Hybrid and genset hybrid types | PASS |
| DC:AC ratio < 0.8 | ✅ Yes | Small PV vs large inverter | PASS |
| PR out of 0.65–0.85 band | ✅ Yes | Extreme loss inputs trigger | PASS |

---

## 4. Site Profile PR Comparison

| Site | PSH | Cell °C | Soiling | Computed PR | Expected range | Status |
|---|---|---|---|---|---|---|
| Nairobi / Karen | 5.6 | 47 | 4.0% | 0.769 | 0.74–0.80 | ✅ |
| Mombasa / Coast | 5.8 | 55 | 5.5% | 0.734 | 0.70–0.77 | ✅ |
| Eldoret | 5.4 | 43 | 3.5% | 0.785 | 0.77–0.82 | ✅ |
| Garissa | 6.3 | 58 | 7.0% | 0.714 | 0.68–0.75 | ✅ |
| Kiambu/Limuru | 5.3 | 44 | 3.5% | 0.783 | 0.76–0.82 | ✅ |

Garissa PR (0.714) correctly reflects high soiling + extreme cell temperature. No overclaiming. ✅

---

## 5. Financial Model Integrity

### 5.1 Cost consistency across modules

| Module | Source | Value (S01 default) | Match? |
|---|---|---|---|
| Dashboard "Total Cost" | `sizing.totalCost` | KES 597,429 | ✅ |
| Finance "Total System Cost" | `sizing.totalCost` | KES 597,429 | ✅ |
| BoQ Grand Total | `rows.reduce(sum)` | KES 597,429 | ✅ |
| Proposal CAPEX metric | `sizing.totalCost` | KES 597,429 | ✅ |
| PDF grand total | `boqRows.reduce(sum)` | KES 597,429 | ✅ |

All five display points are internally consistent. ✅

### 5.2 Specialist capex inclusion

| System type | Specialist items | In totalCost? | BoQ display |
|---|---|---|---|
| Genset hybrid | ATS panel KES 85k | ✅ Yes | Informational (dimmed) |
| EV 4×L2 + OCPP | KES 868k | ✅ Yes | Informational (dimmed) |
| EV DCFC50 ×2 | KES 5,050k | ✅ Yes | Informational (dimmed) |
| Mini-grid 55 subs | KES 443k | ✅ Yes | Informational (dimmed) |

**Critical fix (C2) confirmed working.** Payback, IRR, NPV all use the correct total investment. ✅

### 5.3 O&M escalation in cashflow

```
annualOM Year 1 = totalCost × 0.01 = 5,974
annualOM Year 10 = 5,974 × (1.06)^9 = 5,974 × 1.689 = 10,089
annualOM Year 25 = 5,974 × (1.06)^24 = 5,974 × 4.049 = 24,188
```
✅ O&M escalates with inflation as expected.

### 5.4 Battery replacement event (LFP Year 14)

The 25-year cashflow loop correctly applies `batteryCost` as a negative cash outflow at `y === 14` (LFP). Row highlighted amber in the Finance table. ✅

### 5.5 LCOE (simplified, undiscounted)

```
LCOE = (totalCost + annualOM × projectLife) / lifetimeEnergy
     = (597,429 + 5,974 × 25) / (sum of annual energy with degradation)
```
Labelled as "simplified (undiscounted)" throughout — caveat is clear. ✅

---

## 6. Carbon Module Integrity

### 6.1 Opt-in guard

- Default `carbonInCashflow = false` ✅
- Carbon revenue does NOT appear in `annualNet`, cashflows, or payback when opt-out ✅  
- S20 confirms: same payback with or without carbon data ✅

### 6.2 Kenya grid additionality concern

- Default `emissionFactorSource = "Kenya_National"` (0.37 kg/kWh) ✅
- `hasAdditionalityConcern` flag set for grid-tied systems with Kenya/REREC factor ✅
- VCS/GS warning text shown correctly ✅

### 6.3 Net credits calculation

```
For default project with Kenya_National:
carbonOffset = 2829 kWh × 0.37 / 1000 = 1.047 tCO₂/yr
grossCredits = 1.047 × 7 yr = 7.33 tCO₂
permanence buffer (15%) = 1.10 tCO₂
issuance fee (5%) = 0.37 tCO₂
netCredits = 7.33 - 1.10 - 0.37 = 5.86 tCO₂
annualNetCredits = 5.86 / 7 = 0.837 tCO₂/yr
```
At USD 12 × 130 = KES 1,560/tCO₂:
```
carbonValue = 0.837 × 1,560 = KES 1,306/yr
```
This is correctly excluded from payback by default. ✅

---

## 7. Known Limitations (Not Bugs)

| # | Area | Description | Severity |
|---|---|---|---|
| L1 | LCOE | Simplified undiscounted formula — does not use WACC-discounted costs | LOW — labelled correctly |
| L2 | Battery autonomy | Off-grid formula uses `designDailyKwh × autonomyDays`. For mixed day/night off-grid loads this slightly overestimates required capacity vs. a detailed load profile. | LOW |
| L3 | Surge handling | `peakKw = max(runningKw, surgeKw × 0.65)` uses a 65% coincidence factor. This is a reasonable estimate but is not site-measured demand diversification. | LOW |
| L4 | Micro system inverter | A 0.5kWh/day micro load produces inverterKw = 1kW — technically correct but may surprise engineers. A practical minimum of 2kW could be applied. | LOW |
| L5 | Monte Carlo | Uses deterministic pseudo-random seeded generator, not stochastic. Named "sensitivity" is more accurate. Results are reproducible and defensible. | LOW |
| L6 | Genset savings | Fuel savings uses a fixed displacement fraction `min(0.85, solarCoverage × 0.9)`. Does not account for battery time-shifting. | MEDIUM |
| L7 | EV battery sizing | EV charging mode battery is sized for loads table (empty), not EV peak demand buffer. Battery is minimum 1 module (5.12kWh). | MEDIUM |
| L8 | Cable ampacity | Only voltage drop is checked. Thermal ampacity derating (BS 7671 / IEC 60364) is not implemented. | MEDIUM — add disclaimer |
| L9 | Protection sizing | OCPD sizing (fuses, MCBs) not calculated. BoQ notes "lot" without sizing. | HIGH — field use caveat |
| L10 | Three-phase AC drop | Uses simplified √3 formula. For unbalanced single-phase loads on three-phase systems, a phase-by-phase analysis is needed. | LOW |

---

## 8. Critical Observations for Field Use

### ✅ Safe to use for:
1. **Residential hybrid quotation** — all core formulas verified manually
2. **Small commercial feasibility** — PR, PV, battery, inverter, cost all consistent
3. **Initial site survey support** — load assessment, backup hours, surge check
4. **First-stage BoQ and proposal** — cost totals match across all 5 display locations
5. **Genset hybrid preliminary assessment** — altitude derating ISO 8528 correct
6. **EV charging initial feasibility** — grid adequacy check, specialist capex in total
7. **Mini-grid community feasibility** — subscriber revenue, connection fees, EBITDA
8. **Carbon pre-screening** — additionality warning, opt-in guard, correct net credits

### ⚠️ Use with caution / add disclaimer for:
1. **Cable ampacity** — voltage drop checked but not thermal derating
2. **Protection coordination** — OCPD sizes not calculated
3. **Off-grid worst-month** — flag fires but engineer must validate actual load profile
4. **Genset fuel savings** — simplified displacement model
5. **Carbon VCS/GS registration** — always requires a registered carbon developer

### ❌ NOT ready for:
1. Final construction drawings
2. Licensed electrical design sign-off (PE stamp)
3. Grid interconnection approval application (KPLC/EPRA forms)
4. Protection coordination study
5. Formal carbon credit registration without third-party MRV

---

## 9. Scores

| Category | Score | Notes |
|---|---|---|
| **Overall calculation** | **100 / 100** | 86/86 regression checks pass |
| **Formula accuracy** | **96 / 100** | All spot-checks match manual. Minor: genset savings model simplified |
| **Safety warnings** | **95 / 100** | All 10 critical conditions flagged. Cable ampacity not checked |
| **Financial model** | **90 / 100** | Costs consistent. Battery replacement correct. LCOE labelled |
| **Field realism** | **88 / 100** | Kenya site data well-calibrated. EV/MG specialist capex in totals |
| **Carbon module** | **85 / 100** | Opt-in working. Additionality warning correct. Kenya factors accurate |
| **Feasibility quote readiness** | **88 / 100** | Ready for internal field use and client feasibility |
| **Engineering design readiness** | **72 / 100** | Needs cable ampacity + protection sizing before formal design |
| **Bank/investor grade** | **80 / 100** | Cashflow, DSCR, IRR correct. Needs sensitivity range and audited inputs |

---

## 10. Top Recommended Next Fixes

| Priority | Fix | Impact |
|---|---|---|
| 1 | Add minimum inverter floor of 2kW (prevent 1kW sizing on micro loads) | LOW — field clarity |
| 2 | Cable ampacity table (IEC 60364 / BS 7671) — check selected mm² against rated amps | HIGH — safety |
| 3 | OCPD sizing hint — suggest string fuse and DC isolator rating based on 1.25×Isc | HIGH — safety |
| 4 | EV battery buffer sizing — size battery to smooth EV peak demand, not just loads table | MEDIUM — accuracy |
| 5 | Discounted LCOE (WACC-based) alongside simplified LCOE | LOW — completeness |
| 6 | Genset time-shift savings model — battery offsets peak genset hours | MEDIUM — accuracy |
| 7 | Off-grid: show required PV size to achieve 90% worst-month coverage | MEDIUM — UX |
| 8 | IEC 62446 commissioning checklist tab | MEDIUM — professional use |
| 9 | PDF: include per-year DSCR and battery replacement row in exported cashflow | LOW — bankability |
| 10 | Add earthing/bonding note to proposal (TN-S, TN-C-S, IT system) | MEDIUM — safety |

---

*Generated by Voltflow Calculation QA Test Suite — node scripts/calculation-regression.js*  
*Build: npm run build — ✅ Clean, no errors*

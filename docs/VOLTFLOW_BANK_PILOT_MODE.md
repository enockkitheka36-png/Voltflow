# Voltflow — Bank Pilot Mode (Phase 3)

**Build:** 11.7.1 · **Classification:** Internal Alpha / Controlled Bank Pilot Build.
A simplified, guided view mode so bank staff can request a standard solar quote **without solar
engineering knowledge**. It **hides** the engineering workspace; it does **not** remove it —
Engineer, Technician, Client views and Voltflow Studio all remain for Solarise.

## How to enter
Sidebar → **View mode → 🏦 Bank**. (Bank staff would be defaulted into this mode.) Switching
back to **⚙ Engineer** restores the full workspace — view modes are presentation only.

## The guided flow (`bank-flow`)
1. **Start bank lead** — client/lead name.
2. **Site location.**
3. **Basic load/bill info** — approximate monthly bill; a standard package preloads typical loads.
4. **Choose a standard package** — Good / Better / Best cards (PV, inverter, battery, cost, payback, confidence).
5. **Review the quote** — indicative system + investment + payback + status.
6. **Generate proposal** → opens the client Proposal. **Submit for Solarise review** → status = Submitted.
A **progress checklist** + a **next-action** line guide the user at every step.

## What Bank Pilot Mode shows
Simple instructions, standard package options, required fields, a progress indicator, the quote
summary + status, the next action, and clear **pilot + data-risk disclaimers**.

## What Bank Pilot Mode hides
Raw engineering formulas, inverter/string/DC:AC settings, the full load engine, procurement/BoQ
and margins, internal engineering warnings, and unrelated specialist modules. Nav is limited to:
**Bank Lead & Quote · Dashboard · Proposal · Save/Load** (enforced by `BANK_SAFE_TABS` +
`isTabAllowedInView`).

## Safety framing (always visible)
- A top banner: **"Voltflow Internal Alpha / Controlled Bank Pilot Build."**
- A bank-flow notice: projects are **stored locally in this browser**; **do not enter highly
  sensitive customer data** until cloud access control is enabled.
- Every quote is **indicative** and requires **Solarise engineering review** — not a certified
  design or final price.

## Important limitation
View modes are **UI-level**, not access control. A bank user in Bank Pilot Mode can still switch
to Engineer view. **Real per-user restriction requires authentication** (see the security doc).
For the pilot, Bank Pilot Mode is a *usability* simplification under supervised, test-data
conditions — not a security boundary.

## Tests
`scripts/bank-pilot-readiness-regression.mjs` (8) + `security-pilot` (5) + `uAT-flow` (6).
Browser-verified: minimal nav, guided steps, package apply, quote summary, submit-for-review,
banner + data warning, zero console errors.

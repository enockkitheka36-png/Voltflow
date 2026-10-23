# Kenya electricity-cost evidence and Stima Tracker integration

Status: proposed integration, not implemented or connected. Reviewed on 23 October 2026.

## Purpose and limits

Use source-backed tariffs to improve electricity-cost and solar-savings estimates. Stima Tracker calculates current and historical Kenyan electricity costs; it is not a meter or a source of a customer's measured load profile. It also disclaims guaranteed accuracy and recommends checking important values with KPLC.

References checked:
- [Stima Tracker calculator and explanation](https://www.stimatracker.com/)
- [Stima Tracker historical tariff information](https://www.stimatracker.com/historic)
- [EPRA electricity tariff overview](https://www.epra.go.ke/electricity-tariff-overview)

No documented public Stima Tracker API, embedding permission, reuse licence or service-level agreement was confirmed in this review. Do not invent an endpoint, describe an active partnership, or silently scrape/republish the service. Confirm the integration and reuse terms with its maintainer before building an automated connector. A link to the original calculator can provide an immediate independent cross-check.

## Existing Voltflow integration points

- `src/utils/energyImportEngine.js` already accepts energy-data rows and derives a suggested sizing basis through the existing draft-load / Update Sizing workflow. Keep measured consumption separate from tariff information.
- `src/App.jsx` currently uses an editable `project.gridTariff` in a simplified, capped annual-savings calculation. A flat rate is not a full Kenyan electricity-bill reconstruction.
- Keep the existing sizing engine, equipment matching and qualified-review gates. Tariff accuracy alone does not validate inverter selection, battery runtime, roof structure or an installation design.

## First development slice: Electricity bill and tariff evidence

1. Capture the customer's utility, tariff category, billing period, measured kWh and billed amount. Allow an actual bill as supporting evidence through the existing protected evidence workflow. Account numbers and customer identities must not be sent to a third-party calculator.
2. Capture an itemised tariff snapshot: country, utility, category, effective period, currency, base energy rate, monthly adjustments, applicable taxes/levies and their taxable bases, fixed charges, demand charges, and eligible time-of-use rules.
3. Record source URLs, source/effective dates, reviewer, review time, verification status and snapshot version. Label missing, stale or unverified information visibly. Do not silently reuse another month's charges.
4. Reconstruct the reference bill and compare it to the actual bill, showing the difference and any unexplained component. Credits, arrears, payment fees and one-off items must not be treated as electricity consumption.
5. Require a deliberate review/apply action. Save the tariff version with the design/proposal so later updates cannot silently alter an already issued proposal.

Suggested user-facing location: Plan / Energy data for bill evidence, and Finance / Tariff & savings for the reviewed cost breakdown. This is a proposal, not an existing screen.

## Savings calculation

Calculate avoided cost as:

`modelled bill before solar - modelled bill after solar`

Evaluate both bills using the same applicable tariff rules, metered/assumed load basis and explicit solar/battery scenario. Itemise assumptions rather than calling the result a guaranteed saving.

- Do not assume fixed charges disappear after solar installation.
- Do not assume demand charges fall in proportion to solar kWh; require a supported model of the relevant billing peak and demand rules.
- Apply time-of-use rates only where the customer's eligibility and relevant consumption periods are supported.
- Model battery losses, charge source and operating strategy explicitly.
- Do not value exports at the retail import tariff by default. Keep export credit and any interconnection/net-metering eligibility explicit and separately verified.
- Separate measured facts, sourced tariff inputs and forecast assumptions. Annual future savings remain forecasts even when the reference month's bill is reproduced correctly.

## Automated connector, after permission and API validation

Use a server-side provider adapter with a documented schema, validation, source/version metadata, expiry controls and a last-reviewed snapshot. Do not expose API credentials in the browser. Reject invalid units, categories, dates, missing components and unsupported rules. On provider failure, show the last snapshot's date and stale state; do not silently substitute a live tariff or mark stale data verified.

Stima Tracker is Kenya-specific. Other East African and South African utilities need separate, locally sourced tariff adapters rather than reusing Kenyan charges.

## Acceptance checks before use in proposals

- Bill-category and effective-date boundaries, historical months and invalid/stale snapshots.
- Taxes and levies on the correct component bases, rounding, adjustments and credits.
- Fixed and demand charges retained where applicable, and supported time-of-use eligibility.
- Zero solar, partial solar, retained grid imports, battery losses and no unverified export credit.
- Cross-check representative authorised, redacted bills against the model and an independent tariff calculation, documenting any tolerance and discrepancy.
- Permission boundaries for bill attachments and proposal snapshots; no customer identifiers in logs, third-party requests or GitHub fixtures.
- Reproducible quote versions after a later tariff update, provider outage and retry.

Implementation of this plan needs its own code changes and tests. The current GitHub publication does not add a live Stima Tracker connection, change electricity rates, or grant launch approval.

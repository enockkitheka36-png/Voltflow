# Field planning: first implementation slice

Review date: 24 October 2026. Review-branch work only; this document is not a deployment or engineering approval.

## Where to find the changes

| Workflow | First slice | Boundaries |
| --- | --- | --- |
| Plan → Site photos | Upload, preview, caption, replace and unlink images in each of ten named slots | An attachment is not verified evidence or proof that a scene is relevant. Legacy ticks no longer count as images. |
| Plan → Load assessment | Home + EV charging planner that prepares one draft load | Requires the existing **Update Sizing** action; does not turn a home into a commercial charging business. |
| Quote → Carbon credits | Avoided-emissions explanation and illustrative annual tree-uptake equivalent | Not trees saved, corals saved, issued credits or a Kenyan forestry methodology. |
| Deliver → Project delivery → Overview | Installed Asset Passport: serial, model, dates, reviewer/reference and lifecycle notes | Human-recorded inputs; not automatic commissioning approval, verified warranty coverage or a recycling certificate. |
| Mini-grid project → Mini-grid planner | Explicit anchor operating hours, defaulting to the legacy 12 hours/day | Still an aggregate planning model, not a distribution-network or dispatch study. |

## Site image handling and privacy

- Input is JPEG, PNG or WebP, up to 25 MB and 50 megapixels. Unsupported formats and decoding failures leave the previous attachment in place.
- Browser-local projects retain optimised JPEG copies, at most 48 KiB per slot and a 1,280-pixel long edge. They travel with local save/export; they are **not a cloud backup**. Keep originals separately for detailed inspection or formal evidence.
- Cloud mode prepares JPEGs up to 2 MiB with a 2,048-pixel long edge and calls the existing protected evidence prepare/upload/complete flow. An active organisation and saved project are required. Slot links are accepted only after an evidence ID and a parseable server receipt are returned.
- Cloud project records retain identifiers, scope, caption and timestamps, not image data or upload/download tokens. Private preview URLs are temporary and can be refreshed. A server receipt does not set engineering verification.
- Preparation re-renders pixels, stripping source metadata. It does not anonymise visible faces, addresses, meter numbers or other content. Treat projects and exports as potentially private.
- Unlinking removes the survey attachment only; it does not delete originals or private evidence. Interrupted cloud uploads may leave an evidence record: inspect Evidence before retrying if the server receipt is missing.
- File decoding is tested in the browser. The pure attachment-record validator checks bounded structure, not photographic authenticity or a full JPEG decode of imported records. Server authorisation remains authoritative for private evidence.
- Never open energised electrical equipment solely to fill a photo slot; use qualified personnel and the site's safe-working procedure.

## Residential EV arithmetic

Use documented or measured vehicle/charger inputs, not an invented vehicle default.

- Battery-side consumption: `wall kWh/day = daily km × kWh/100 km ÷ 100 ÷ charging efficiency`.
- Wall-metered consumption: use the measured consumption directly; do not apply charging losses again. See the [EPA explanation of EV energy-consumption measurement](https://www.epa.gov/greenvehicles/fuel-economy-and-ev-range-testing).
- `charging hours/day = wall kWh/day ÷ AC charger kW`; annual illustration uses 365 days.
- Example: 60 km/day, 18 kWh/100 km, 90% efficiency and 7.2 kW gives 12 kWh/day, 1.6667 hours/day and 4,380 kWh/year. These are synthetic inputs, not a vehicle performance claim.
- An infeasible charging window blocks preparation. Night charging cannot be labelled direct-solar-only. Grid-only is the default and is excluded from solar/battery energy by the existing supply-scope logic.
- Re-preparing replaces the stable residential EV row rather than adding a duplicate. The row initially has unknown phase and an explicit assumed 0.95 power factor; service capacity, simultaneous household demand, protection and backup suitability need qualified review.
- Preparing a row does not commit sizing. Review the draft, then use **Update Sizing**. Committed loads and their planning inputs are included in project save/export. This is not smart-charger dispatch or an electrical service approval.

## Environmental comparisons, not carbon issuance

The new comparison consumes the existing design's modelled avoided emissions and selected emission-factor assumption. It does not establish that the factor is current, measured, approved or additional.

Method `VF-ILLUSTRATIVE-URBAN-TREE-1` divides annual avoided tonnes by **0.060 tCO₂ per urban tree per year**. This is the annual uptake equation in the [EPA calculations and references](https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator-calculations-and-references), using US urban-tree early-growth assumptions. The output is labelled **illustrative tree-years of annual uptake**, not trees planted, saved or protected, and not a local forestry estimate.

The coral count and issued-credit count are deliberately `null`. No project-specific ecological evidence or defensible universal CO₂-to-coral-count method is supplied. [NOAA describes several interacting climate stresses on coral reefs](https://oceanservice.noaa.gov/facts/coralreef-climate.html); the app must not turn modelled solar reductions into a factual count of corals saved.

Existing carbon financial outputs remain explicitly modelled scenarios, not issuance. The tree comparison adds no revenue. Additionality, eligible methodology, monitoring, independent validation/verification and registry issuance are separate processes. Kenyan project requirements must be checked against current official guidance, including the [Carbon Markets Regulations, 2024](https://nema.go.ke/wp-content/uploads/2025/08/Climate-Change_Carbon-Market-Regulations-2024.pdf); this screen is not a compliance determination.

## Installed equipment and mini-grids

The asset register stores physical units separately from quoted equipment. Manufacturer/model/serial are required; project serials are case-insensitively unique. Dates must be valid and chronological. Recorded commissioning needs installation/commissioning dates, reviewer and evidence reference. Retirement needs a reason and intended repair/take-back/recycling route. These inputs do not modify BoQ, design hashes or existing delivery approvals. An evidence reference is not itself a verified evidence binding.

For mini-grids, `anchor energy = anchor kW × anchor hours/day`. Hours are bounded to 0–24, with 12 retained for old projects. Main community-demand planning, option comparison and anchor-revenue calculations use the same hours. Changing a non-default mini-grid hour assumption changes the design revision. The existing committed-load `dailyKwh` field is not repurposed; specialist community demand remains `communityDailyKwh`.

Deferred work includes interval dispatch, losses, demand coincidence, growth, voltage drop, protection, metering, approved local tariffs, a complete service-job workflow and independently reviewed lifecycle/repair procedures. Do not represent an EPRA draft mini-grid document as enacted law.

## Validation and launch boundaries

`npm run test:field-planning` adds 11 grouped checks to the existing suite, covering record validation, private-upload contract/order, environmental arithmetic, EV energy/scopes/window errors, serial/date rules, readiness, mini-grid consistency, save/import and audience privacy.

Browser QA used a labelled synthetic project and an already-public Voltflow logo solely as an attachment-test image, captioned **not a real site photograph**. Observed: actual image decode/preview, invalid-file rejection retaining the image, modal Escape, one EV row after re-preparation, no sizing change until Update Sizing, 15 kWh/day after committing the 12 kWh EV addition to a 3 kWh baseline, duplicate-serial prevention, and saved image/caption/EV/asset restoration after reload.

No customer photographs, bills, serial numbers or credentials are test fixtures for publication. Automated private-upload tests use mocks; they do **not** establish real Catalyst upload success, A/B ownership isolation, signed-out denial, cloud recovery or production readiness. Those Development proofs and qualified engineering benchmarks remain launch gates. No production deployment or PR merge is part of this slice.

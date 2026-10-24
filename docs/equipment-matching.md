# Documented equipment matching — local first slice

Open **Asset library → Match your equipment** in Engineer view. Existing projects remain assumption-based unless explicitly opted in. Nothing here deploys or changes Catalyst settings.

## Supported records

- GoodWe GW5000-ES-20 and GW6000-ES-20, non-M single-phase ES G2 models.
- GoodWe LX U5.4-20, 1–6 identical units. Its published 5.4 kWh is usable energy; the engine does not apply DoD a second time. The project efficiency remains an explicit planning allowance, not a measured site value.
- LONGi LR5-54HTH-430M and LR5-54HTH-440M.

The existing asset library contains these five documented records alongside clearly described generic examples. Manufacturer source URLs, revision, region and review date live in `src/utils/equipmentCatalogue.js` and are visible in the matching panel. No manufacturer prices, inventory availability, local warranty eligibility or country grid approvals are invented.

## Matching and calculation contract

Exact models, ARM firmware with check reference, CAN communication, phase, bank quantity, site envelope, string topology, tolerance-adjusted cold Voc/current/power, MPPT window, required PV energy and battery energy/power are rechecked on every change. Worst-case hot-module Vmp needs an explicit reviewed value and method reference; it is not guessed from STC Vmp. References entered by a user are recorded inputs, not independently authenticated evidence.

Statuses are Verified, Conditional, Unverified and Incompatible. Verified means only that the implemented documented checks pass for the recorded inputs. It is not engineering certification, commissioning proof or a performance guarantee. A failed check takes precedence over unknowns; unknowns never become green. A source-set revision invalidates old confirmation.

One equal-length string per MPPT, at most two MPPTs, is supported for a grid-connected residential hybrid with backup. Nominal AC voltage is checked against 220/230/240 V, and peak load including headroom divided by a recorded reviewed power factor must fit the inverter's backup apparent-power rating. Other system topologies, South Africa and other regional settings stay Conditional pending separate manufacturer/regional/export-limit work. Mixed battery models, parallel inverters, partial strings, three-phase systems and arbitrary equipment families are outside this slice. Temperature/SOC derating curves, motor start duration, protection coordination, structure, cables, local approvals and final engineering remain review work.

The two model-linked sizing paths use the selected module count, battery count and exact inverter rating; they do not silently add hardware. Two to six battery units share a 100 A / 5.12 kW nominal bank cap. Design-peak battery power includes the project's inverter headroom and efficiency allowance. Hardware inputs are pinned; change them in Asset library. Site/efficiency/diversity assumptions still require qualified review.

Positive KES unit prices are required (maximum 1 billion per unit). Unknown prices are not an offer for free equipment. A supplier-quote basis requires a reference. Other project allowances and tax remain separately calculated assumptions. Model names, quantities, pricing basis and source versions feed the quote/reports and stable design fingerprint. Commercial exports are held on incomplete or incompatible matching. Diagnostic engineer reports remain available through the report builder.

Save/import preserves the selection and provenance version, then resolves physical specifications from the catalogue again. Returning to assumption-based sizing keeps current numeric values and clears model locks; it does not restore an earlier project. Save/export a copy before comparing workflows.

## Validation

`npm run test:equipment` exercises the actual production sizing hook through the existing SSR audit runtime, its option engine, matching boundaries, malformed inputs, round trips, design hashes and shared readiness. Fixtures are synthetic; do not treat them as manufacturer calculations, site evidence or an independently reviewed engineering benchmark.

`npm run test:all` includes the equipment suite. Live A/B ownership/security proofs, engineering benchmark cases, supplier confirmation and country compliance remain separate release gates. No deployment is authorised by passing these software tests.

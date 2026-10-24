# Kenya tariff calculator: software validation

Reviewed: 23 October 2026. Method: `VF-KE-FLAT-1`. This is software QA, not an approved live tariff, engineering certification or launch approval.

## Automated evidence

- All 40 local regression suites pass, including 15 grouped tariff checks and the existing sizing, equipment, saving/recovery, security-gate and proposal-action regressions.
- Independent synthetic hand calculation: 100 kWh reconstructs KES 1,850; reducing imports to 50 kWh gives KES 1,033; avoided cost is KES 817/month or KES 9,804/year. Zero imported kWh still costs KES 216 because fixed/demand charges and their selected VAT remain.
- Missing or malformed components, unsupported structures, tax-base selection, signed adjustments, monetary precision, invalid official links, review dates, month boundaries and bill differences are checked.
- Main and option sizing agree on tariff-based savings. Draft edits do not replace the applied snapshot. Save/load retains it; changing the applied basis changes the design hash. Legacy disabled-mode results are unchanged.
- Invalid/stale applied models hold savings, shared readiness and commercial exports. Direct exporters reject stale or mismatched sizing. Audience projection excludes drafts, reviewer details and private source-query strings.
- Local production build passes; the existing large-chunk warning remains.

Fixture rates are deliberately invented for arithmetic testing. Generated fixtures, reports, PDF and render images are excluded from GitHub publication.

## Browser and PDF checks

The local production preview was exercised through the normal UI: import and review a labelled synthetic project, apply the tariff, confirm changed financial results, edit a draft without changing applied savings, reject unsupported time-of-use, restore reviewed inputs, explicitly switch to flat-rate estimation and reapply.

Saving, reloading the browser and opening the saved project retained the reviewed snapshot and savings. The desktop Finance grid overflow found during QA was corrected. Desktop and 390-pixel mobile checks showed no document-level horizontal overflow. No browser console errors were recorded during this workflow.

Both pages of a generated synthetic quotation PDF were rendered and visually inspected: tariff month/version, wrapped metadata, warnings, forecast limitation and signature areas remained legible and separated.

## Still required before launch

- Independent reconciliation against representative, authorised and redacted real bills and the applicable official monthly notices. A manually entered official URL does not verify its rates.
- Qualified review of supported component and tax-base assumptions for each account. Exclude time-of-use, progressive blocks, power-factor surcharges and other unsupported charges.
- Live Development tenant/user-A/user-B/signed-out access, ownership, evidence, saved-version and recovery proofs under the deployed configuration.
- Real-device performance, customer usability acceptance and regional tariff adapters before expanding beyond this Kenya/KES slice.

No Catalyst deployment or production change was performed for this feature. No live Stima API, scraping, embedding agreement or partnership is asserted.

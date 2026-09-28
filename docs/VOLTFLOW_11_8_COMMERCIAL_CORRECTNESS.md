# Voltflow 11.8 Commercial Correctness

Date: 2026-08-10

Baseline: Voltflow 11.7.2b, local export schema 11.7, with the Voltflow 11.8
Secure Trust Foundation provider architecture already present.

## Decision

This increment implements the P0 "make Mary trust the workflow" slice from the
developer implementation brief. It preserves the 11.7.2b calculation and
pilot-safety regression floor. It does not deploy production, connect live Zoho,
add portfolios, add commissioning/telemetry, or create funding packs.

The local export schema remains 11.7 because the 11.7.2b compatibility suites
explicitly require that version. New local project fields are optional and are
backfilled by normalization. New authoritative cloud records are introduced by
the 11.8 SQL migration.

## Detected Stack

- React 18 single-page application built by Vite 5.
- JavaScript ES modules; no TypeScript or application test framework.
- Deterministic Node regression scripts under `scripts/`.
- Vercel serverless API plus a small self-hosted Node HTTP wrapper.
- Provider interfaces with LocalDemo and Supabase implementations.
- Supabase Auth, Postgres, RLS and private Storage as the cloud adapter.
- No Git metadata in this unpacked working tree.

## Implemented Scope

### Reactive design identity

- Canonical design inputs include all calculation-driving loads, supply scopes,
  roof faces, modules, battery/inverter selections, generator/grid settings,
  specialist-system inputs, design assumptions and option-pricing inputs.
- SHA-256 creates deterministic `revision_id` and `inputs_hash` values.
- Every option records `calculation_version`, `revision_id` and `inputs_hash`.
- A selected option is stored against its input hash and cleared after an input
  change.
- Report/version generation rejects an imported or otherwise stale selection.
- Cloud quote creation independently rejects stale hashes with `VF409 /
  STALE_DESIGN`.

Calculation version for this engine: `11.8.0`.

### Explicit load supply classification

Loads now carry independent phase, supply scope and criticality fields:

- Phase: `SINGLE_PHASE`, `THREE_PHASE`, `DC`, `UNKNOWN`.
- Supply: `SOLAR`, `BACKUP`, `GRID_ONLY`, `EXCLUDED`.
- Criticality: `CRITICAL`, `ESSENTIAL`, `NON_CRITICAL`.
- Grid-only and excluded rows require an exclusion reason.

The engine reports site, solar, backup and three-phase energy/peak totals.
Grid-only rows remain in the survey and site total but do not size PV/BESS.
Excluded rows remain in the survey and do not drive active-design totals.
Three-phase solar/backup demand remains included and produces an independent
phase-capability warning when the selected system is not three-phase.

### Battery selection

- `AUTO` selects from calculation assumptions.
- `MANUAL` locks only the battery asset; quantity and performance stay reactive.
- Checks cover nominal voltage, BMS/inverter pairing, usable DoD, maximum
  parallel units, required usable energy and continuous discharge power/current.
- Failed compatibility returns structured issues and a logical 422 response.

### Multi-facing roofs

Each roof face now normalizes to the 11.8 contract with azimuth, tilt, gross and
usable area, shading, PV selection, module count, MPPT assignment and photo IDs.
Validation rejects invalid compass/tilt values, usable area above gross area and
module area above usable area. Old single-roof records normalize into one face.
Existing string-plan checks continue to warn when orientations should not be
silently combined on an MPPT.

### Single quote and VAT engine

`calculateQuote()` is the single source for UI, BoQ headline, financials,
proposal and PDF totals. It supports:

- `VAT_STANDARD`, `VAT_ZERO` and `VAT_EXEMPT`.
- Mixed treatments, line discounts, deterministic two-decimal rounding and
  policy-generated contingency.
- Equipment, labour, transport and other category totals.
- Pricing-policy and tax-rule versions.
- Rejection of invalid or non-positive quantities and negative values.

The default configurable Kenya policy is version `KE-2026-01`, with a 16%
standard rate. The applied project rate is passed into the engine; equipment
classes are not assigned legal tax meaning by hard-coded category rules.

### Photo evidence

- Categories: `SITE_OVERVIEW`, `ROOF`, `POWER_BOX`, `METER`,
  `INVERTER_LOCATION`, `BATTERY_LOCATION`, `EARTHING`, `OTHER`.
- JPEG, PNG and WebP only; maximum 25 MiB.
- Private key format: `<organisation>/<project>/photos/<uuid>.<ext>`.
- Optional roof-face association, caption, uploader, device/server timestamps,
  GPS metadata and SHA-256 checksum.
- Short-lived Supabase signed upload token; no cloud secret in the browser.
- Progress, exponential retry, signed thumbnail/download and authorized delete.
- Delete removes the private object first, then soft-records metadata deletion
  and an audit event. Direct finalization is rejected while the object exists.
- Old evidence object paths remain authorized for backward compatibility.

LocalDemo stores metadata only and explicitly says no cloud upload occurred.

### Catalog versus inventory

Engineering assets remain usable independently of inventory. Optional
`InventoryLink` records can represent manual or future Zoho mappings. The UI
separates Technical Catalog, Available Inventory and All Assets and displays:

- `CATALOG_ONLY`, `AVAILABLE`, `LOW_STOCK`, `OUT_OF_STOCK`,
  `INVENTORY_STALE`, `UNLINKED`.

BoQ and Engineer Proposal display a procurement-readiness warning when selected
assets lack current confirmed availability. Historical selections retain a
technical snapshot if an inventory mapping is removed or inactivated.

## Provider And Endpoint Contracts

The existing architecture uses Supabase RPC plus Storage rather than adding a
parallel REST persistence service.

### Quote calculation

`POST /api/quotes/calculate`

- Accepts `organisationId`, `currency`, `lines`, `pricingPolicy`, `taxPolicy`.
- Uses the same `calculateQuote()` module as the browser.
- Existing membership authentication is required when cloud auth is configured.
- Returns 405 for wrong method, 400 for malformed JSON, 401/403 for auth, 422
  for invalid quote input and a generic 500 for unexpected errors.

The self-hosted Node wrapper exposes the same route.

### Design and quote persistence

`QuoteRepository` maps the requested persistence operations as follows:

| Logical operation | Supabase implementation |
| --- | --- |
| Record design revision | `record_design_revision(...)` RPC |
| Create draft quote | `create_project_quote(..., 'DRAFT', ...)` RPC |
| Issue quote revision | `create_project_quote(..., 'ISSUED', ...)` RPC |
| List/get quote | RLS-protected `quotes` select |

Issued and draft quote rows are immutable revisions. A changed quote is a new
revision, not an update.

### Photo persistence

| Requested REST contract | Supabase implementation |
| --- | --- |
| Presign | `prepare_project_photo_upload(...)` + signed Storage upload |
| Complete | `complete_evidence_upload(...)` |
| List | RLS-protected `evidence_items` select |
| Signed read | `authorize_evidence_download(...)` + signed Storage URL |
| Delete | `authorize_evidence_delete(...)`, Storage remove, `complete_evidence_delete(...)` |

No public evidence URL is generated.

### Inventory provider

`InventoryProvider` defines `listItems`, `getItem`, `getAvailability`,
`getPrice` and `syncItems`. The provider is intentionally not connected to live
Zoho in this P0 increment. No OAuth tokens, refresh tokens or inventory writes
were added.

## Schema Migration

Migration: `supabase/migrations/202608100001_commercial_correctness.sql`

New tenant-owned tables:

- `design_revisions`: deterministic, immutable normalized design inputs/options.
- `quotes`: immutable quote revisions tied to one design hash.
- `inventory_links`: optional tenant asset-to-provider mapping and cached state.

Evidence additions:

- `photo_type`, `roof_face_id`, `caption`.
- `deleted_at`, `deleted_by`, `delete_reason`.

All new tenant tables have UUID primary keys, `organisation_id`, explicit
foreign keys, UTC timestamps, enabled and forced RLS. Direct writes are revoked;
narrow security-definer RPCs validate role, project tenancy and revision state.
Client and Bank roles cannot query quote or inventory tables. Technicians may
read assigned technical design revisions but cannot read quotes.

## Files Changed

- `src/App.jsx`
- `src/App.css`
- `src/components/ui.css`
- `src/utils/loadEngine.js`
- `src/utils/multiRoofLayout.js`
- `src/utils/assetLibrary.js`
- `src/utils/designRevision.js`
- `src/utils/batterySelection.js`
- `src/utils/quoteEngine.js`
- `src/utils/photoEvidence.js`
- `src/utils/inventoryAvailability.js`
- `src/utils/pdfGenerator.js`
- `src/platform/contracts.js`
- `src/platform/localDemoAdapter.js`
- `src/platform/supabaseAdapter.js`
- `src/platform/projectSnapshot.js`
- `api/quotes/calculate.js`
- `server/index.js`
- `supabase/migrations/202608100001_commercial_correctness.sql`
- `supabase/tests/commercial_correctness_rls.sql`
- `scripts/commercial-correctness-regression.mjs`
- `package.json`
- `docs/VOLTFLOW_11_8_COMMERCIAL_CORRECTNESS.md`

## Verification

### Runnable on this host

- `npm.cmd run build`: PASS, 495 modules transformed.
- `npm.cmd run test:commercial`: PASS, 14 checks.
- `npm.cmd run test:all`: PASS in the final run, 28 suites and 303 checks after
  including the commercial suite.
- Browser QA at 894x487: PASS for compact dashboard, drawer scroll/close,
  Escape, destination navigation, Evidence, Asset Library and Battery views.
- Client/Bank proposal spot checks exposed no internal blockers, raw engineering,
  supplier cost, margin, authoring tools or JSON export. Technician exposed no
  commercial totals or margin-sensitive data.

The build retains the existing warning that the main JavaScript chunk is above
500 kB after minification.

Current `npm audit` result: seven findings (two moderate, four high and one
critical). They are inherited dependency risks and remain a staging gate; no
breaking automatic upgrade was applied in this feature sprint.

### Supabase integration tests

`supabase/tests/commercial_correctness_rls.sql` adds 25 pgTAP assertions for
tenant isolation, role access, immutability, storage paths, checksums, deletion
and stale quote rejection.

`npm.cmd run test:rls` could not execute because local Postgres was not running
at `127.0.0.1:54322`. Docker is not installed on this host. No remote database
was contacted.

## Security And Error Handling

- No service-role key is accepted by browser configuration.
- No Zoho/AWS/Supabase privileged credential was added.
- Evidence bucket remains private and signed URLs expire.
- Tenant and project membership are checked before photo/design/quote RPCs.
- Commercial quote and inventory records are not selectable by Client, Bank or
  Technician roles.
- Evidence checksums are fixed at authorization and compared at completion. If
  the Storage provider preserves custom checksum metadata, that metadata is
  compared too. This is not a server-side re-read and re-hash of the full object.
- API errors return bounded messages and never return stacks, headers or secrets.

## Backward Compatibility

- Existing 11.7.2b local exports still import under schema 11.7.
- Legacy phase strings and essential/backup booleans normalize to the new enums.
- Legacy single-roof data becomes one normalized roof face.
- Historic asset selections retain model/capacity snapshots.
- Existing generic evidence upload RPC and old object key layout remain valid.
- Existing pilot warnings, proposal sanitization, zero-load gating, financial
  consistency and AI privacy behavior remain covered by the full suite.

Risk: old project records did not capture all new supply, inventory and hardware
fields. Migration necessarily derives defaults and should be reviewed before a
legacy design is issued.

## Deferred V1 And V2 Scope

Not implemented in this P0 increment:

- Zoho OAuth, encrypted refresh-token storage, pagination, rate-limit handling,
  live item sync or stock writes.
- CSV inventory import/export fallback.
- Commissioning tests, serial-number records and as-built asset lifecycle.
- Ten-site portfolios and aggregate investment metrics.
- Versioned debt/equity cashflows, DSCR/NPV/IRR finance module.
- KCIC/ASCENT evidence-pack generation.
- Operations telemetry, MRV, AI intervention records or investor dashboards.

These remain V1/V2 work. Voltflow must not claim live inventory, bank
certification, finance-grade approval or cloud evidence durability until their
corresponding provider and staging tests pass.

## Deployment Posture

Internal development/demo: GO.

Isolated EPC staging: CONDITIONAL GO only after Vincent runs all migrations and
both pgTAP files on local Supabase or a disposable staging project, verifies
private Storage upload/download/delete, confirms backup/restore, and reviews the
known dependency advisories.

Controlled external EPC staging: NO-GO today because executable RLS/storage
tests and real cloud photo recovery have not run, and baseline dependency
security findings remain unresolved.

Production: NO-GO. No deployment was performed.

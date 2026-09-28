# Voltflow 11.8 Secure Trust Foundation Baseline

Date: 2026-08-07

Source baseline: Voltflow 11.7.2b, local project schema 11.7

## Scope

This baseline was recorded before implementing the 11.8 trust foundation. The
sprint adds authenticated provider boundaries, tenant isolation, durable project
records, immutable versions, server audit records, private evidence metadata and
revision-bound review workflow. It does not add or redesign solar calculation
modules.

The existing zero-load, load validation, proposal sanitization, assumption
labelling, AI privacy, BoQ integrity, financial consistency and pilot-safety
behavior is a required compatibility boundary.

## Repository State

- Working tree: `work/voltflow_unpacked`
- Git metadata: absent; this source cannot produce a Git branch or native diff.
- Existing build output and dependencies were present before the clean install.
- Environment files: only `.env.local.example`; no `.env` or `.env.local`.
- Existing server surface: assistant-only Vercel handler and Node wrapper.
- Existing cloud project methods: deliberate throwing placeholders.
- Existing project authority: browser localStorage and in-memory React state.
- Existing audit authority: mutable, clearable localStorage activity list.
- Existing roles: presentation modes only; no authenticated authorization.

A file manifest and content hashes must be used for handoff because Git history
is unavailable.

## Files Inspected

- `src/utils/projectStorage.js`
- `src/utils/auditLog.js`
- `src/utils/projectEvidence.js`
- `src/utils/schemaMigration.js`
- `src/App.jsx` storage, normalization, proposal, assistant and role paths
- `api/assistant.js`
- `server/index.js`
- all 26 `scripts/*regression*.mjs` suites and their imported production modules
- `package.json`, `package-lock.json`, `.env.local.example` and `.gitignore`

## Environment

| Component | Result |
| --- | --- |
| OS shell | Windows PowerShell |
| Node.js | 26.2.0 |
| npm | 11.16.0 |
| Supabase CLI | 2.112.0 available through `npx.cmd` |
| Docker | Not installed/available |
| `psql` | Not installed/available |
| PowerShell script policy | Blocks `npm.ps1`/`npx.ps1`; use `npm.cmd`/`npx.cmd` |

Because Docker is unavailable, `supabase start`, local Postgres and executable
pgTAP/RLS integration tests cannot run on this host. This sprint can still ship
SQL migrations, pgTAP tests and deterministic authorization-model tests. Vincent
must run the SQL tests in Supabase local development or an isolated staging
project before external use.

## Baseline Commands

### Clean install

Command: `npm.cmd ci --cache .npm-cache --prefer-offline`

Result: PASS

- 102 packages installed.
- 103 packages audited by the install command.
- Duration: approximately 48 seconds.

### Production build

Command: `npm.cmd run build`

Result: PASS

- Vite 5.4.21
- 431 modules transformed.
- Duration: approximately 12 seconds.
- Existing warning: main application chunk exceeds 500 kB after minification.

### Full regression suite

Command: `npm.cmd run test:all`

Result: PASS

- 26 suites passed.
- 276 checks passed.
- 0 checks failed.
- Duration: approximately 23 seconds.

This is the required 11.7.2b regression floor for every 11.8 change.

## Dependency Security Baseline

`npm audit` reports six vulnerable dependency nodes: two moderate, three high
and one critical.

| Dependency path | Baseline severity | Notes |
| --- | --- | --- |
| `jspdf` | Critical | Direct dependency; current advisory set includes injection, path traversal and denial-of-service findings; available fix is a semver-major upgrade |
| `xlsx` | High | Direct dependency; reported prototype-pollution and ReDoS advisories; npm reports no registry fix for the installed package line |
| `vite` / `esbuild` | High / moderate | Development-server and source-map/path handling advisories; major Vite upgrade offered |
| `postcss` | High | Transitive source-map path handling advisory |
| `dompurify` via `jspdf` | Moderate | Multiple sanitization advisories; major jsPDF upgrade offered |

These advisories predate 11.8 implementation. They are not silently auto-fixed
because the available jsPDF/Vite remediations are breaking upgrades and `xlsx`
requires a replacement/version-source decision. They remain staging security
review items. Production deployment is not approved.

## Current Persistence And Identity Assumptions

1. Local records use schema 11.7 and may originate from earlier schemas.
2. A local saved-record `id` is a timestamp and is not a durable project ID.
3. A local save currently replaces another record with the same display name.
4. `projectRef` is a human reference, not a globally unique database key.
5. `normalizeLoadedRecord` currently lives in `App.jsx`; migration needs a pure,
   shared normalizer or a lossless legacy wrapper.
6. Legacy evidence status, audit events and delivery approvals are mutable client
   metadata. Migration must preserve them as provenance but cannot treat them as
   authenticated approvals.
7. The existing local/demo adapter remains available for development and demos.
   It must continue to state that no cloud submission occurred.

## Provider Assumptions

1. Provider selection is explicit through environment feature flags.
2. Default development mode is `local-demo` unless cloud mode is deliberately
   configured.
3. Browser Supabase configuration may contain only the project URL and
   publishable/anonymous key. These identify the project but do not bypass RLS.
4. A Supabase service-role/secret key is never accepted by browser configuration,
   never uses a `VITE_` prefix and never appears in client code or output.
5. Privileged writes use RLS-protected tables or narrowly scoped database RPCs.
6. Every cloud operation requires an authenticated session and active
   organisation membership.
7. No cloud-to-local fallback occurs after cloud mode is selected; failures are
   visible and retryable.
8. Evidence uses a private bucket only. Public evidence URLs are prohibited.
9. UTC timestamps are generated or confirmed by the database for authoritative
   records.

## Database And Migration Assumptions

1. Supabase/Postgres is the first adapter target, but repository interfaces stay
   provider-neutral.
2. Every tenant-owned row carries `organisation_id` and an explicit foreign key.
3. UUIDs are generated by Postgres or a standards-compliant client UUID helper.
4. Existing calculation payloads are preserved as normalized JSON snapshots;
   this sprint does not normalize every solar input into relational columns.
5. Project updates use optimistic concurrency with `revision_no` and
   `updated_at` preconditions.
6. Issued project versions, audit events and approval decisions are append-only.
7. Migration is explicit, idempotent and backup-first. It records source schema,
   app version, local record ID/reference, source timestamps and a deterministic
   payload hash.
8. Duplicate display names never auto-merge. Project references are made unique
   within the destination organisation without discarding the original value.
9. Local data is not automatically deleted after migration.
10. Database backup does not by itself restore evidence object bytes; staging
    requires an object-storage retention and recovery procedure.

## Bill-Load Reconciliation Assumptions

- Bill-implied energy is calculable only when bill amount and energy tariff are
  both positive and the bill is predominantly an energy charge.
- Missing tariff or known non-energy charges produce an unresolved warning, not
  a fabricated kWh estimate.
- Itemized load energy remains the engineering load inventory basis.
- Captured-load coverage (`itemized kWh / bill-implied kWh`) is separate from
  savings as a percentage of bill.
- Client/Bank claims that imply full bill coverage are blocked while a material
  mismatch remains unresolved.

## Pre-Implementation Go/No-Go

GO for local source implementation and non-production migration/RLS artifacts.

NO-GO for controlled external EPC staging until:

- executable RLS/storage tests pass against local Supabase or isolated staging;
- dependency advisories are reviewed and accepted/remediated;
- an approved Supabase region and project configuration are supplied;
- backup/restore, evidence recovery and secret handling are verified;
- all existing and new regression suites pass.

# Voltflow 11.8 Secure Trust Foundation - Implementation Report

Date: 2026-08-07  
Baseline: Voltflow 11.7.2b, persisted schema 11.7  
Trust architecture label: Voltflow 11.8  
Deployment: none

## Baseline

- `npm ci`: passed (102 packages installed).
- Baseline `npm run build`: passed.
- Baseline `npm run test:all`: passed, 26 suites / 276 checks.
- The source folder has no Git metadata, so this work is an isolated planning/implementation folder rather than a Git branch.
- Docker and `psql` are unavailable on this workstation. Supabase CLI 2.112.0 is available through `npx`, but the local Supabase stack could not be started or tested here.
- No `.env`, `.env.local`, or `.vercel` path was present. `.env.local.example` is placeholder-only.

## Architecture Delivered

- Explicit `AuthProvider`, `ProjectRepository`, `EvidenceRepository`, `AuditRepository`, and `ReviewRepository` contracts.
- `LocalDemo` remains the default adapter. The Supabase adapter is enabled only by explicit environment configuration and never falls back silently.
- Browser configuration accepts only a Supabase URL and publishable/anon key. Privileged JWT roles such as `service_role` and `supabase_admin` are rejected.
- Cloud mode requires an authenticated user and active organisation membership.
- Client, Bank, and Technician sessions use restricted portals and never mount the full engineering application.
- Durable cloud project CRUD uses revision-based optimistic concurrency.
- Legacy 11.7 exports import idempotently with a deterministic provenance fingerprint and a migration audit event.
- Proposal preparation and issue create canonical, immutable project-version snapshots with deterministic hashes.
- Audit events are server-owned, append-only, hash chained, role checked, and bounded against oversized or secret-like payloads.
- Bill-load reconciliation separates bill-implied energy, captured-load coverage, and savings percentage. Unresolved mismatches block client-facing claims.
- Evidence uses private tenant/project object paths, signed transfers, byte checksums, metadata, and server-side authorization.
- Review workflow is `draft -> review_ready -> submitted -> in_review -> approved/rejected`; approvals bind to an immutable version hash.
- Local review actions retain explicit wording that no cloud submission occurred.

## Database And RLS

The migrations create `organisations`, `organisation_memberships`, `profiles`, `projects`, `project_members`, `project_versions`, `audit_events`, `evidence_items`, `review_submissions`, `approvals`, `boq_revisions`, and `project_shares` with UUID keys, UTC timestamps, explicit foreign keys, and `organisation_id` on tenant-owned records.

RLS is enabled and forced. Policies and RPCs deny by default, isolate organisations, restrict technicians to assigned projects and field-safe records, expose only explicitly shared issued projections to Client/Bank users, and prevent Client/Bank access to supplier cost and margin data. Evidence storage is private; no public evidence URL path is implemented. Immutable tables reject updates and deletes by ordinary application roles.

## Files Changed

- Application integration: `src/main.jsx`, `src/App.jsx`, `.env.local.example`.
- Platform contracts and adapters: `src/platform/`.
- Trust utilities: `src/utils/billLoadReconciliation.js` and `api/assistantAuth.js`.
- Assistant gate: `api/assistant.js`.
- Database: `supabase/config.toml`, three migrations, seed data, and pgTAP RLS tests.
- Tests: `scripts/trust-foundation-regression.mjs`, the responsive drawer regression, and package scripts.
- Dependencies: `package.json`, `package-lock.json`.
- Documentation: baseline, architecture, Vincent staging runbook, and this report.

## Final Verification

- `npm run build`: passed; Vite 5.4.21, 490 modules transformed. A pre-existing large-chunk warning remains (main chunk 1,491.52 kB, 447.15 kB gzip).
- `npm run test:all`: passed, 27 suites / 289 checks, including all 276 retained 11.7.2b checks and 13 trust-foundation checks.
- `npm run test:data-integrity`: passed, 11/11.
- `npm run test:pilot`: passed, 5/5.
- Browser smoke at 894x487: passed; no horizontal overflow, Escape closes the responsive menu, and no console errors were observed.
- Secret signature scan: zero candidate files after excluding dependency/build caches; no `.env`, `.env.local`, or `.vercel` path.
- `npm audit`: 0 low, 2 moderate, 3 high, 1 critical. These dependency findings remain unresolved.
- `npm run test:rls`: not executed successfully because no local Supabase/Postgres service was listening at `127.0.0.1:54322`. The 19 pgTAP assertions are present but are not claimed as passed.

## Migration Limits And Security Gaps

- Live database migration, pgTAP RLS execution, storage-policy testing, and adversarial HTTP testing still require Vincent's isolated Supabase staging project or a Docker-capable local host.
- Existing local browser records are untrusted input. Import preserves provenance, but no automatic bulk upload is performed.
- Identity invitation, account recovery, MFA policy, backup/restore, key rotation, retention, and production monitoring are operational staging decisions, not completed code claims.
- The current dependency audit includes one critical and three high findings; production release must wait for remediation or formally documented compensating controls.
- The main bundle should be split before broad rollout, but that warning is not an auth or tenant-isolation bypass.

## Recommendation

**No-go for controlled external EPC staging today.** The code is ready for Vincent to deploy into an isolated, non-production Supabase staging project and run the runbook gates. External EPC users should not be admitted until pgTAP RLS, storage authorization, cross-tenant API probes, migration rehearsal, and dependency-risk disposition all pass. Internal local/demo UAT may continue with non-sensitive data.

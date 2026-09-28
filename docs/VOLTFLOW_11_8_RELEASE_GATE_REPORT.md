# Voltflow 11.8 Release Gate Report

Date: 2026-08-10

Baseline: Voltflow 11.7.2b, local schema 11.7, 11.8 trust foundation and
commercial-correctness P0 implemented. No production deployment was performed.

## Decision

The renewable-industry research correctly places security proof, dependency
remediation and bundle boundaries ahead of commissioning, offline field work,
IoT, O&M, portfolios or finance expansion.

This increment addresses the two release gates that can be completed on this
host:

1. Dependency advisory remediation and exploitability reduction.
2. Initial bundle isolation for PDF/report and spreadsheet tooling.

The Supabase execution gate remains open because this host has no Docker or
running local Postgres/Supabase instance. Existing SQL and pgTAP files were not
run against a remote environment.

## Dependency Triage

### jsPDF

- Previous: `jspdf@2.5.2`, reported through npm audit with critical and high
  advisories.
- Current: `jspdf@4.2.1`.
- Runtime smoke test creates and parses the header of a real PDF byte buffer.
- Voltflow does not call `addJS`, AcroForm or `loadFile`.
- PDF modules are now dynamically imported only after an authorized user asks
  to generate a report.

The old local-file advisory affected Node builds through file-loading APIs. The
browser still needed the upgrade because newer jsPDF advisories affected other
optional paths and the package was outside its patched range.

Reference: https://github.com/advisories/GHSA-f8cm-6447-x5h2

### SheetJS

- Previous: registry package `xlsx@0.18.5`, reported for prototype-pollution
  and regular-expression denial-of-service advisories.
- Current: official SheetJS CE `0.20.3` tarball.
- The package remains dynamically loaded only for XLS/XLSX imports.
- Energy import rejects files above 10 MiB before parsing.
- Workbook reads are capped at 100,000 data rows and reject over-limit input.
- A runtime regression writes and reads an XLSX workbook.

Official installation source:
https://docs.sheetjs.com/docs/getting-started/installation/nodejs/

### Vite toolchain

- Previous: unsupported `vite@5.4.21` with vulnerable development-server
  dependencies.
- Current: `vite@8.2.1` and `@vitejs/plugin-react@6.0.5`.
- The production build passes on Node 26.2.0.
- Vite is a development/build dependency and must not be exposed as the
  production application server.

Vite support policy: https://vite.dev/releases

### Transitive findings

The Vite/jsPDF upgrades removed the affected esbuild and DOMPurify chains and
updated PostCSS and Nano ID resolution. Final `npm audit` result: zero known
vulnerabilities across the installed dependency graph.

## Bundle Result

Before:

- Main JavaScript: 1,537.17 kB, 461.34 kB gzip.
- PDF/report modules were statically reachable from the initial application.

After:

- Main JavaScript: 1,148.23 kB, 325.52 kB gzip.
- Main reduction: 388.94 kB (25.3 percent).
- Gzip reduction: 135.82 kB (29.4 percent).
- `reportPdf`: 2.12 kB lazy chunk.
- `pdfGenerator`: 18.51 kB lazy chunk.
- jsPDF: 399.15 kB lazy chunk.
- XLSX: 492.52 kB lazy chunk, loaded only for spreadsheet import.

The main bundle still exceeds 500 kB. This is a performance and maintainability
gate, not a calculation-integrity failure. The remaining concentration is the
11,000-line application shell. Further reduction requires extracting route
surfaces into independently imported modules; it should be done incrementally
with browser and regression coverage rather than by arbitrary vendor chunking.

Recommended next boundaries:

1. Proposal Studio and formal report UI.
2. Engineering and installer simulation workspaces.
3. Delivery/evidence workspace.
4. Asset catalog and commercial workspace.
5. Bank and restricted external portals.

## Supabase Security Gate

Two executable suites remain present:

- `trust_foundation_rls.sql`: 19 pgTAP assertions.
- `commercial_correctness_rls.sql`: 25 pgTAP assertions.

They cover policy structure, tenant boundaries, commercial-record restrictions,
immutable revisions, evidence authorization, checksums, storage paths, deletion
and stale-quote behavior. Static source checks pass, but static checks do not
prove runtime RLS.

Vincent must provide either:

1. Docker Desktop plus a local Supabase stack; or
2. A disposable, non-production Supabase project with CLI access and secrets
   supplied through the local environment, never committed to the repository.

Required execution sequence:

1. Back up the disposable database.
2. Apply every migration in timestamp order.
3. Seed two organizations and all application roles.
4. Run both pgTAP suites.
5. Exercise actual JWT claims for Manager, Engineer, Technician, Sales, Client
   and Bank users.
6. Attempt cross-tenant select, insert, update, delete and Storage operations.
7. Verify Client/Bank cannot retrieve internal costs even with direct API calls.
8. Verify Technician access is limited to assigned projects and field-safe data.
9. Verify signed evidence URLs expire and no public bucket/object exists.
10. Destroy the disposable environment after recording sanitized results.

No service-role credential may enter browser configuration or test fixtures.

## Next Product Phase

Do not start IoT or new calculation breadth yet. After the security gate passes,
the next coherent P1 is installation truth:

1. `CommissioningRecord` tied to DesignRevision and QuoteRevision.
2. Immutable `AsBuiltRevision` with explicit deviations from design.
3. Installed asset/serial registry and evidence-linked commissioning checks.
4. Engineer and installer sign-off with append-only audit events.
5. IndexedDB field queue with explicit pending/synced/failed states.
6. Resumable private evidence upload with idempotent server completion.

Read-only telemetry comes only after installed assets have stable IDs and an
approved as-built record. Remote device control is explicitly out of scope.

## Verification

- `npm run test:release-gates`: PASS, 6 checks.
- `npm run test:all`: PASS, 29 suites and 309 checks.
- Focused PDF proposal suite: PASS, 7 checks.
- Focused formal report suite: PASS, 9 checks.
- Focused energy import suite: PASS, 13 checks.
- Vite 8 production build: PASS.
- `npm audit`: PASS, zero findings.

The full regression suite passed after a clean `npm ci` install.

## Deployment Posture

- Internal development/demo: GO.
- Disposable security staging: GO once Vincent supplies the environment.
- Controlled external EPC staging: NO-GO until all 44 pgTAP assertions and JWT
  abuse tests pass and the remaining bundle extraction is reviewed.
- Production: NO-GO.

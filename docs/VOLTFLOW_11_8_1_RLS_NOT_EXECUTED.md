# Voltflow 11.8.1 — RLS / Storage Security Tests: NOT EXECUTED

**Status: NOT EXECUTED (not PASS, not FAIL).** Skipped security tests must never be reported as green.

## Why
- `npm run test:rls` (`npx supabase test db`) fails at connection:
  `failed to connect to postgres … host=127.0.0.1 … 54322 … Make sure Docker is running, then run: supabase start`
- **Docker is not installed / not running** in this environment, so the Supabase local stack cannot start.
- The four DB-backed suites (`tenant-attack`, `revision-db`, `evidence-security`, `audit-db`) therefore record `NOT_EXECUTED`.

## What DOES exist (code-level, IMPLEMENTED)
- `supabase/migrations/202608070001_core_schema.sql` — 15 tenant tables.
- `202608070002_rls_and_storage.sql` — **RLS enabled on every table**, organisation-scoped policies, storage policies.
- `202608070003_trust_rpcs_and_immutability.sql` — immutability RPCs / append-only ledgers.
- `202608100001_commercial_correctness.sql` — commercial correctness constraints.
- `supabase/tests/trust_foundation_rls.sql`, `supabase/tests/commercial_correctness_rls.sql` — pgTAP assertions (written, not run).

## Blocking checklist for Vincent (to convert NOT EXECUTED → PASS)
1. Install **Docker Desktop** (or a Docker engine) and start it.
2. `supabase start` (spins up local Postgres + Storage on 127.0.0.1:54322).
3. `supabase db reset` (applies migrations + `seed.sql`).
4. `npm run test:rls` → the 25 pgTAP RLS/storage assertions must all pass.
5. Seed two tenants (A/B) + two users, set `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, `TENANT_A_*`, `TENANT_B_*` (no secrets committed).
6. `npm run test:security-suites` → tenant-attack, revision-db, evidence-security, audit-db.
7. `npm run test:security-gate` → must report `releaseAllowed: true`, `allowedUse: staging-review`.

Until steps 1–7 pass, **tenant isolation = IMPLEMENTED / NOT SECURITY-VERIFIED**, and no use beyond internal-demo is permitted.

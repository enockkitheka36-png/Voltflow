# Voltflow 11.8.1 — Supabase Setup & Security Proof (for Vincent)

Goal: move the trust platform from **IMPLEMENTED (code)** to **CONNECTED + SECURITY-VERIFIED (proven)**. Everything below uses dummy data only. Never commit `.env.local`. Never put a service-role key in the browser.

## One-command option (recommended)
On a machine with Docker Desktop (or Podman) running:
```
npm run proof:supabase          # or: ./scripts/run-supabase-security-proof.ps1  (Windows)
                                 #     ./scripts/run-supabase-security-proof.sh   (Linux/macOS)
```
It auto-runs the whole chain below (checks → build → JS tests → `supabase start`/`db reset` → pgTAP RLS → tenant/evidence/revision/audit suites → release gate), auto-wires the deterministic dummy fixtures from `supabase/seed.sql`, prints no secrets, and writes:
- `docs/generated/vincent-supabase-security-proof-result.json`
- `docs/VOLTFLOW_11_8_2_VINCENT_SECURITY_PROOF_RESULT.md`

It exits 0 **only** on `PASS_STAGING_REVIEW_GATE`; otherwise it records an honest blocked/fail code and permits nothing above `internal-demo`. Note: the `revision-db` and `audit-db` suites need issued-revision/audit fixtures that `seed.sql` does not yet create, so a first run reports `BLOCKED_MISSING_REVISION_AUDIT_FIXTURES` for those two — add seed rows (or env ids) to complete them. The manual steps below remain available.


## 1. Prerequisites
- Docker Desktop running.
- Supabase CLI (already present: 2.113.0).

## 2. Start local stack
```
supabase start
supabase db reset          # applies migrations 202608070001..202608100001 + seed.sql
```

## 3. Run the written security tests
```
npm run test:rls           # 25 pgTAP RLS/storage assertions — must all PASS
```

## 4. Connect the frontend (staging)
Create `.env.local` (git-ignored) from `.env.local.example`:
```
VITE_VOLTFLOW_PROVIDER=supabase
VITE_SUPABASE_URL=http://127.0.0.1:54321      # or your staging https URL
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable/anon key ONLY>
```
The app’s `resolvePlatformConfig` rejects service-role keys and non-HTTPS non-local URLs.

## 5. Seed two tenants for the attack tests
Create Org A (Solarise Demo EPC) + user `engineer-a@test.invalid`, Org B (Kifaru EPC Demo) + user `engineer-b@test.invalid`, one project + one private evidence object each. Export the ids/paths into env:
```
SUPABASE_TEST_URL=...          SUPABASE_TEST_ANON_KEY=...
TENANT_A_EMAIL=...  TENANT_A_PASSWORD=...  TENANT_A_EVIDENCE_PATH=...
TENANT_B_EMAIL=...  TENANT_B_PASSWORD=...  TENANT_B_PROJECT_ID=...  TENANT_B_EVIDENCE_PATH=...
ISSUED_DESIGN_REVISION_ID=...  ISSUED_QUOTE_REVISION_ID=...  AUDIT_EVENT_ID=...
```

## 6. Run the runtime security proof
```
npm run test:security-suites   # tenant-attack, revision-db, evidence-security, audit-db
npm run test:security-gate     # aggregates -> docs/generated/security-test-status.json
node scripts/release-security-gate.mjs --require staging-review   # must exit 0
```

## 7. Acceptance to unlock "external EPC staging"
All of: pgTAP PASS, tenant attack all-DENIED (both directions), evidence signed-URL/private-bucket PASS, revision immutability DENY on UPDATE/DELETE of issued revisions, audit append-only DENY on edit/delete. The gate then reports `allowedUse: staging-review`.

Real client/bank data and production remain **NO-GO** until a separate security + backup/recovery review signs off the connected platform.

# Voltflow 11.8.2 — Security-Proof Fixtures

**File:** `supabase/fixtures/security-proof-fixtures.sql` · **Dummy data only** · applied by the one-shot runner after `supabase db reset`.

## Why a separate fixture file
`supabase/seed.sql` provisions the orgs/users/projects/evidence the tenant-attack and evidence-storage suites need, but it deliberately does **not** create issued design revisions, issued quotes, or audit events. Those are the rows the *revision-immutability* and *audit append-only* suites mutate. Keeping them out of `seed.sql` keeps the base seed clean; they live in an isolated, idempotent fixture file that only the security proof applies.

## Deterministic dependencies (from seed.sql)
| Entity | ID |
|---|---|
| Org A | `10000000-0000-4000-8000-000000000001` |
| Org B | `20000000-0000-4000-8000-000000000002` |
| Project A | `10000000-1000-4000-8000-000000000001` |
| Project B | `20000000-1000-4000-8000-000000000002` |
| engineer.a@voltflow.local | `11000000-0000-4000-8000-000000000102` |
| engineer.b@voltflow.local | `22000000-0000-4000-8000-000000000202` |

## Rows created (deterministic IDs the runner passes as env)
| Fixture | ID | Notes |
|---|---|---|
| Issued design revision A | `10000000-4000-4000-8000-000000000001` | `revision_id`/`inputs_hash` computed via `encode(digest(…,'sha256'),'hex')` to satisfy the `rev_…`/`sha256:…` constraints |
| Issued design revision B | `20000000-4000-4000-8000-000000000002` | |
| Issued quote A | `10000000-5000-4000-8000-000000000001` | `status='ISSUED'`, `issued_at=now()`, references design revision A |
| Issued quote B | `20000000-5000-4000-8000-000000000002` | |
| Audit event A (design_revision_issued) | `10000000-7000-4000-8000-000000000003` | target for the audit tamper test |
| Audit events A (7 total) | `…7000…0001–0007` | `project_created, load_committed, design_revision_issued, quote_revision_issued, evidence_added, review_package_created, project_exported` |
| Audit events B (2) | `20000000-7000-…0001–0002` | for cross-tenant coverage |

**Schema honoured exactly:** `audit_events.action` is lowercase (`^[a-z0-9_.-]{3,100}$`); `event_hash` is 64-hex; `actor_role='engineer'` (enum `manager|engineer|sales|technician|client|bank`); quote `status`∈`DRAFT|ISSUED|VOID` with the `issued_at` CHECK; composite FKs `(project_id, organisation_id)` and `(design_revision_id, organisation_id)` all reference seeded rows. No status column exists on `design_revisions` — issuance = the row existing; immutability is enforced by the `*_append_only` triggers (`vf_reject_immutable_change()` on `before update or delete`).

## How Vincent runs it
`npm run proof:supabase` applies it automatically (psql → node-`pg` → documented fallback), or manually:
```
psql "<DB_URL from: supabase status -o env>" -v ON_ERROR_STOP=1 -f supabase/fixtures/security-proof-fixtures.sql
```
Never print the DB URL/password; the runner masks them.

## PASS / FAIL / BLOCKED for the dependent suites
- **PASS** — fixture rows exist and every UPDATE/DELETE on issued revisions / audit events is denied.
- **FAIL** — a mutation succeeded (maps to `FAIL_REVISION_IMMUTABILITY` / `FAIL_AUDIT_APPEND_ONLY`).
- **BLOCKED** — fixture rows not found (suites report `NOT_EXECUTED`; runner → `BLOCKED_MISSING_REVISION_AUDIT_FIXTURES`). If the fixture SQL itself fails to apply → `FAIL_FIXTURE_SEED`.

## Validation status
The fixture SQL is **statically validated** here (table names, column names, deterministic IDs, lowercase actions, no secrets, dummy-only). It is **not runtime-validated** — no Postgres/Docker is available in this environment, so it has never actually executed. First real run on Vincent's machine is also its first execution.

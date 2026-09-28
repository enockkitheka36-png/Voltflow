# Voltflow 11.8.2 — Supabase Connected Staging Proof

**Outcome: BLOCKED — NOT EXECUTED. No Supabase connection was achieved, so no security capability was verified.**

This sprint's mission was to connect and prove the Supabase path. It could not start because **no container runtime is available in this environment.** Nothing below is marked as proven that was not actually run.

## Update — security-proof fixtures added (still Docker-blocked)
Deterministic issued design-revision, issued-quote and audit-event fixtures were added in
`supabase/fixtures/security-proof-fixtures.sql` and wired into the one-shot runner (applied
after `supabase db reset`; new result code `FAIL_FIXTURE_SEED`; report now carries
`fixtureSeedExecuted/Passed/Error`). `revision-db` and `audit-db` now precheck the fixture rows
and only run when present — so with Docker they become turnkey. **Still not runtime-validated:**
Docker remains absent here, so the fixtures and connected-mode suites have never executed. See
`VOLTFLOW_11_8_2_SECURITY_FIXTURES.md`.

**Pre-existing test flake — FIXED (test-only):** `commercial-correctness` test #10 called
`listAssets(…, "AVAILABLE_INVENTORY", …)` without a pinned `nowMs`, so it used the real clock;
once the fixture `synced_at` passed 24h the item read INVENTORY_STALE and the test failed `0 !== 1`.
Fix: pass `{ nowMs }` as the 4th (`options`) arg to that `listAssets` call, matching its sibling
assertions. **No product logic changed** — `catalogue.js`/`assetLibrary.js` untouched. `test:all`
is green again (deterministic regardless of clock).

## Environment (Phase 0)
| Item | Value |
|---|---|
| Repo | `…/work/voltflow_unpacked/` (real repo) |
| APP_VERSION | **Voltflow 11.8.1** (deliberately NOT bumped to 11.8.2 — see note) |
| SCHEMA_VERSION | 11.7 |
| Node / npm | v26.2.0 / 11.16.0 |
| Supabase CLI | 2.113.0 (present) |
| Docker binary | **ABSENT** |
| Docker daemon | **NOT RUNNING** |
| Podman | ABSENT |
| Ports 54321 / 54322 | CLOSED |

## The blocker (Phase 1, hard evidence)
`npx supabase start` →
```
LegacyDockerLifecycleInspectError: failed to inspect container health:
docker: command not found (podman also not found) —
install Docker Desktop or Podman and ensure it is on PATH
```
Supabase local requires Docker/Podman. Without it, `supabase start`, `supabase db reset`, `supabase test db`, auth, storage, and every connected-mode test are impossible.

## Phase-by-phase result

| Phase | Capability | Result |
|---|---|---|
| 2 | pgTAP RLS / storage | **NOT EXECUTED** (no DB) |
| 3 | Auth flow (sign-in/session/logout/membership) | **NOT EXECUTED** |
| 4 | Tenant isolation attack | **NOT EXECUTED** |
| 5 | Revision immutability (DB) | **NOT EXECUTED** |
| 6 | Evidence storage security | **NOT EXECUTED** |
| 7 | Audit trail append-only (DB) | **NOT EXECUTED** |
| 8 | Connected cloud project flow | **NOT EXECUTED** |
| 9 | Release gate | **RAN — correctly BLOCKS** (see below) |

## What DID run (and passed) — non-DB only
- `npm run build` — PASS.
- `npm run test:all` — PASS (exit 0).
- Release security gate:
  - `--require internal-demo` → exit 0
  - `--require staging-review` → **exit 1**
  - `--require external-staging` → **exit 1**
  - `--require production` → **exit 1**
- `docs/generated/security-test-status.json` → `releaseAllowed: false`, `allowedUse: internal-demo`.

This is the intended behaviour: **skipped security tests cannot look green, and no stage above internal-demo can be claimed.**

## Change made this sprint
Only one code change, and it is gate tooling (not a product feature): the release gate's `--require` levels were made explicit (`internal-demo` < `staging-review`/`vincent-staging` < `external-staging` < `real-client-data`/`real-bank-data` < `production`), and an unknown level now defaults to the **highest** bar so the gate can never under-block by accident.

## Note on the version number
APP_VERSION was **left at 11.8.1 on purpose.** Bumping to "11.8.2 — Supabase Connected Staging Proof" would imply a connected/proven staging path that does not exist. The version should move to 11.8.2 only once the connected-mode suites actually execute and pass.

## Capability maturity (unchanged from 11.8.1)
| Capability | Maturity |
|---|---|
| Design revisions / load classification / battery / roof / quote engine | IMPLEMENTED + WIRED (local); code-tested |
| Supabase auth | IMPLEMENTED; **not CONNECTED**; not SECURITY-VERIFIED |
| Tenant isolation / RLS (15 tables) | IMPLEMENTED (migrations+pgTAP); **NOT SECURITY-VERIFIED** |
| Evidence storage access control | IMPLEMENTED; **not CONNECTED/VERIFIED** |
| Revision/quote DB immutability | IMPLEMENTED; **not VERIFIED** |
| Server audit append-only | IMPLEMENTED; **not VERIFIED** |
| Offline / IoT | ABSENT |

## The single unblock action
Install Docker Desktop (or Podman) on the machine that will run this, then follow `docs/VOLTFLOW_11_8_1_SUPABASE_SETUP_FOR_VINCENT.md`:
`supabase start` → `supabase db reset` → `npm run test:rls` → seed tenants A/B → `npm run test:security-suites` → `npm run test:security-gate -- --require staging-review`. Only then is 11.8.2 achievable.

## Go / Hold / No-Go (unchanged — nothing new was proven)
| Stage | Decision |
|---|---|
| Solarise internal development | **GO** |
| Dummy-data demo | **GO** |
| Vincent isolated staging | **HOLD** (blocked only by Docker availability) |
| External EPC staging | **NO-GO** |
| Real client data | **NO-GO** |
| Real bank data | **NO-GO** |
| Production | **NO-GO** |

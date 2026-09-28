# Voltflow 11.8.1 — Executive Status (Runtime Trust Wiring & Proof)

*Readable without source code. Dummy data only. No production deploy. No secrets.*

> **11.8.2 update (Supabase Connected Staging Proof attempt):** connection was **BLOCKED — no container runtime.** `supabase start` failed with `docker: command not found (podman also not found)`. All connected-mode security phases remain **NOT EXECUTED**; the release gate still reports `allowedUse: internal-demo` and blocks staging/production. APP_VERSION intentionally stays **11.8.1** (11.8.2 is not claimable until Supabase actually connects). See `VOLTFLOW_11_8_2_SUPABASE_CONNECTED_STAGING_PROOF.md`. The status below is unchanged.

## One-paragraph truth
The 11.8 trust platform is **real in code and green in JS tests**, but its security guarantees are **not yet proven at runtime** because no live database could be started in this environment (Docker absent). 11.8.1 makes that honesty enforceable: the version is corrected to 11.8.1, the runtime clearly reports which mode it is in, DB-security test scripts now exist and **report NOT_EXECUTED instead of passing silently**, and a **release gate blocks any use beyond internal-demo until the security suites actually run and pass.**

## Status by layer

| Capability | Implemented in code | Connected at runtime | Security verified | 
|---|---|---|---|
| Design revisions (SHA-256, stale rejection) | ✅ | ✅ local | n/a (local) |
| Load classification / battery / roof / quote engine | ✅ | ✅ | code-tested (not independently recomputed live) |
| Supabase auth | ✅ | ❌ (local-demo only) | ❌ |
| Tenant isolation / RLS (15 tables) | ✅ (migrations+pgTAP) | ❌ | ❌ **NOT EXECUTED** (no Docker) |
| Evidence storage access control | ✅ | ❌ | ❌ |
| Revision/quote DB immutability | ✅ (RPCs) | ❌ | ❌ |
| Server audit append-only | ✅ | ❌ | ❌ |
| Offline / IoT | ❌ ABSENT | — | — |

## What 11.8.1 changed (this sprint)
- **Version:** APP_VERSION 11.7.2b → **11.8.1** (+ release note; schema stays 11.7). Version-pinned tests updated; `test:all` still green.
- **Honest runtime mode:** config resolver already distinguishes local-demo vs supabase and rejects service-role keys in the browser; documented the four intended states (Local Demo / Supabase Connected / Cloud Disabled / Cloud Error).
- **Security test scripts (new):** `tenant-isolation-attack-test`, `revision-immutability-db-test`, `evidence-storage-security-test`, `audit-trail-db-test` — each runs against a live Supabase or records `NOT_EXECUTED`.
- **Release gate (new):** `release-security-gate.mjs` writes `docs/generated/security-test-status.json` and fails `--require staging-review` until security is proven.
- **Docs:** baseline, RLS-not-executed + Vincent checklist, role authorization matrix, offline/IoT deferred, release gate, this status.

## Test evidence (this environment)
- Build PASS. `test:all` PASS (exit 0). `test:commercial` 14/14, `test:trust` 13/13, `test:release-gates` 6/6.
- `test:rls` **NOT EXECUTED** (ECONNREFUSED 54322 — Docker absent). Four security suites **NOT_EXECUTED**. Gate → `allowedUse: internal-demo`, `--require staging-review` exit 1.

## Go / Hold / No-Go

| Stage | Decision | Rationale |
|---|---|---|
| Solarise internal development | **GO** | Green codebase; safe to keep building |
| Dummy-data demo | **GO** | local-demo runtime is honest about limits |
| Vincent isolated staging | **HOLD** | Ready to attempt once Docker + `supabase start` + pgTAP pass |
| External EPC staging | **NO-GO** | Requires connected Supabase, auth, tenant isolation PASS, storage PASS, revision immutability PASS, audit append-only PASS, gate PASS — none proven yet |
| Real client data | **NO-GO** | Needs the above + Vincent/security sign-off |
| Real bank data | **NO-GO** | Same |
| Production | **NO-GO** | No connected DB, no proven RLS, no backup/recovery/monitoring, no security verification |

**Strict rule applied:** external EPC staging is NOT marked GO because the connected path, auth, tenant isolation, storage access, revision immutability, audit append-only and the release gate are not all proven.

## P0 gaps (top 5)
1. No live DB in the audited env → tenant isolation, RLS, storage, immutability, audit all UNPROVEN.
2. Supabase not connected at runtime (no env) — app runs local-demo.
3. Auth flow not exercised (no login/session demonstrated).
4. Evidence access control unproven against real Storage.
5. DB-enforced revision/quote immutability unproven.

## P1 gaps (top 5)
1. No live login UI wired for supabase mode (only adapters + config).
2. Independent numerical recompute of battery/quote/VAT not done live.
3. Cross-surface quote equality (UI/PDF/API) verified by code test only.
4. No "Cloud Error" runtime state surfaced (only local vs connected).
5. `npm ci` not re-run in this env (existing tree used).

## Do NOT build yet (top 5)
Offline/PWA · IoT/device telemetry · M-PESA/payments · Atlas/GIS · marketplace / full O&M.

## Next action
Stand up Docker + `supabase start` + `supabase db reset`, then run `npm run test:rls` and `npm run test:security-suites` → `npm run test:security-gate --require staging-review`. That single sequence converts the biggest NOT-VERIFIED items into real evidence and is the gate to external staging.

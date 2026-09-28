# Voltflow 11.8 — Executive Status & Runtime Truth

*Understandable without reading source code. Dummy data only. No deploy. No secrets exposed.*

## 0. The most important finding first: two repositories

This audit began against a **stale snapshot** (the `voltflow-11.7.2b-…` zip) and then located the **actual four-day development repository** on this machine:

`…/use-my-current-chatgpt-account-i/work/voltflow_unpacked/`

The real repo genuinely contains the reported 11.8 work. The three sets of observations you asked me to reconcile are **not contradictory** — they describe **different layers at different maturity stages of the same repo**:

| Observation | Verdict |
|---|---|
| Older 11.7.2b verified position | True — still the runtime baseline |
| Latest 11.8 development report (design revisions, quote engine, Supabase RLS…) | **True at the CODE level** — the modules, migrations, policies and pgTAP tests exist and the JS test suites pass |
| Latest live "no auth / no tenant isolation / no DB / no offline" | **True at the RUNTIME level** — the audited environment runs the *local-demo* adapter with no Supabase configured |

**In one line:** the trust/tenancy platform is **IMPLEMENTED and code-tested, WIRED behind a provider switch, but NOT CONNECTED to a live backend in this environment and NOT security-verified.**

## 1. Version / build / tests (real repo)
- APP_VERSION `Voltflow 11.7.2b`, SCHEMA_VERSION `11.7` (note: **version string was not bumped** despite four days of work).
- Dependencies include `@supabase/supabase-js`. Node test suites: **`test:all` all-green**, `test:commercial` 14/14, `test:trust` 13/13, `test:release-gates` 6/6.
- `test:rls` (**pgTAP**) **could not run**: `failed to connect to postgres … Make sure Docker is running`. The 25 RLS/storage assertions exist but are **NOT EXECUTED** — matching the dev report's own admission.
- Runtime provider: only `.env.local.example` exists (no Supabase URL/key), so `createPlatform` returns the **local-demo** adapter → browser-only, client-side role.

## 2. Capability maturity (the main deliverable)

Labels: ABSENT · SCAFFOLDED · IMPLEMENTED · WIRED · CONNECTED · SECURITY-VERIFIED · PILOT-VERIFIED · PRODUCTION-CANDIDATE

| Capability | Code maturity | Runtime (this env) | Backend connected? | Security-verified? | Evidence |
|---|---|---|---|---|---|
| Deterministic design revisions (SHA-256 canonical hash, stale rejection) | IMPLEMENTED | **WIRED** (local) | n/a (local persistence) | — | `designRevision.js` `hashCanonicalJson`→`sha256:`, `isCurrent`/`staleDesignResult`; test:commercial |
| Load classification SOLAR/BACKUP/GRID_ONLY/EXCLUDED | IMPLEMENTED | **WIRED** | n/a | — | `loadEngine.js` enum used in `App.jsx` |
| Battery selection AUTO/MANUAL + energy/voltage/power/BMS checks | IMPLEMENTED | WIRED | n/a | — (independent recompute deferred) | `batterySelection.js`; test:commercial |
| Multi-face roof + legacy single-roof migration | IMPLEMENTED (PARTIAL verify) | WIRED | n/a | — | `multiRoofLayout.js` + migration path |
| Shared quote/VAT engine, cross-surface consistency | IMPLEMENTED | WIRED | n/a | — (live UI/PDF/API cross-check deferred) | `quoteEngine.js`; test:commercial 14/14 |
| Immutable design/quote revisions | IMPLEMENTED (app + SQL) | WIRED (app); DB rule **not run** | NOT CONNECTED | **NOT VERIFIED** | app repo + `202608070003_trust_rpcs_and_immutability.sql` |
| Authentication (Supabase) | IMPLEMENTED | **local-demo only** | **NOT CONNECTED** | NOT VERIFIED | `createPlatform.js`, `supabaseAdapter.js`; no env |
| Tenant isolation / RLS policies | IMPLEMENTED (migrations+policies+pgTAP written) | NOT active | **NOT CONNECTED** | **NOT SECURITY-VERIFIED** (pgTAP can't run) | `202608070002_rls_and_storage.sql`, `supabase/tests/*.sql` |
| Signed cloud evidence storage + checksums | IMPLEMENTED | NOT active (local evidence) | NOT CONNECTED | NOT VERIFIED | `supabaseAdapter.js`, `evidenceAuthorization.js` |
| Server audit trail | IMPLEMENTED | local convention | NOT CONNECTED | NOT VERIFIED | app audit + SQL ledgers |
| Offline / field (SW, PWA, outbox, sync) | **ABSENT** | ABSENT | — | — | no service worker / manifest / PWA plugin |
| Role UX (Engineer/Client/Bank/Technician…) | IMPLEMENTED | WIRED | — | **UI-SANITIZED, not authorized** | view-mode is client-side; no server enforcement in local mode |

## 3. What is genuinely new vs 11.7.2b
Real, code-level additions: canonical-JSON SHA-256 **design revisions with stale rejection**; **load energy-role classification**; **AUTO/MANUAL battery engine** with BMS/voltage/power checks; **multi-face roof**; a **single shared quote/VAT engine**; a **platform adapter layer** (local-demo ↔ Supabase) with `cloudEnabled` gating in the app; **Supabase migrations** (core schema, RLS + storage, immutability RPCs, commercial correctness) and **pgTAP** suites; evidence checksums + signed-URL flow (code). This is substantial and well-tested at the JS level.

## 4. What is NOT yet true (runtime reality)
- No live login/session in this environment; **role is a local switch**, not authentication.
- **Tenant isolation is unproven** — RLS is written but never executed (no Postgres/Docker).
- No active database boundary, no multi-org shares, no durable server persistence in the audited runtime.
- **No offline capability at all.**
- Immutability/audit are app-level in local mode; DB-enforced guarantees are unverified.

## 5. Go / Hold / No-Go

| Stage | Decision | Why |
|---|---|---|
| Solarise internal development | **GO** | Rich, tested codebase; safe to keep building |
| Dummy-data demo | **GO** | Local-demo runtime is stable and honest about its limits |
| Vincent isolated staging | **HOLD → GO once** Supabase env is configured and `supabase start` + pgTAP pass | Code is ready; needs a real instance stood up |
| External EPC staging | **HOLD** | Requires connected DB + passing RLS + basic auth UX |
| Real client data | **NO-GO** | Auth not connected; tenant isolation not security-verified |
| Real bank data | **NO-GO** | Same, plus audit/immutability unproven against a live DB |
| Production | **NO-GO** | None of: connected DB, proven RLS, backup/recovery, monitoring, security verification |

**Production remains NO-GO** until real auth works, tenant isolation is runtime-proven, RLS/pgTAP pass on a live DB, durable persistence is active, evidence access control is proven, and backup/recovery + security verification exist.

## 6. Top 5 P0 gaps
1. **Tenant isolation is unverified** — stand up Supabase (Docker) and execute the 25 pgTAP RLS/storage assertions; today they cannot run.
2. **No connected backend in runtime** — Supabase adapter exists but env is absent; the app silently runs local-demo. Configure and prove the connected path end-to-end.
3. **Authentication not exercised** — no login/session/JWT flow demonstrated; role is a client switch. Prove real sign-in + membership lookup.
4. **DB-enforced immutability/audit unproven** — revision/quote immutability is app-level locally; verify the SQL RPCs actually reject tampering on a live DB.
5. **Evidence access control unproven** — signed-URL + checksum flow is code-only; verify private bucket + cross-tenant denial against real Storage.

## 7. Top 5 P1 gaps
1. Version string not bumped (still 11.7.2b) — misleading provenance for a large delta.
2. Independent numerical re-verification of battery + quote/VAT (Phase S/H) not yet done live.
3. Cross-surface quote equality (UI/BoQ/Financials/Proposal/PDF/API) verified only by code test, not live.
4. Multi-face roof migration from legacy single-roof needs a live round-trip test.
5. No CI gate that fails when `test:rls` is skipped — a skipped security suite currently looks "green".

## 8. Top 5 things NOT to build yet
1. IoT/device telemetry (identity, credentials, firmware) — out of scope until platform is connected.
2. M-PESA / payments.
3. Atlas/GIS.
4. Marketplace.
5. Full O&M module.

## 9. Recommended next sprint
**Voltflow 11.8.1 — Runtime Trust Wiring & Proof** (your title fits the evidence). Scope: configure Supabase env; `supabase start`; execute pgTAP RLS/storage suites to green; demonstrate one real login + one cross-tenant denial live; prove revision/quote immutability and evidence access control against the live DB; add a CI gate that fails if `test:rls` is skipped; bump APP_VERSION.

## 10. Phases deferred (need a live DB or more runtime time)
Live multi-org RLS attack (Phase J), pgTAP execution (needs Docker/Postgres), full live browser E2E (Phase O), independent calculation-vector recomputation (Phase S), and the remaining detail docs (development-delta, runtime-architecture, security-and-tenancy, calc-verification, renewable-gap-matrix, next-sprint). These are ready to run once Supabase/Docker is available and can proceed phase-by-phase.

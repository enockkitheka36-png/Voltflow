# Voltflow 11.8.1 — Baseline (Runtime Trust Wiring & Proof)

## Repo provenance
- **Path:** `…/use-my-current-chatgpt-account-i/work/voltflow_unpacked/` — the **real four-day development repo** (NOT the stale 11.7.2b zip).
- **Git:** none (no `.git`); provenance tracked by these docs.
- **This is the real 11.8 development repo:** confirmed by presence of `src/platform/*`, `designRevision.js`, `quoteEngine.js`, `batterySelection.js`, `@supabase/supabase-js`, and `supabase/migrations/*`.

## Versions
| Field | Before | After |
|---|---|---|
| APP_VERSION | Voltflow 11.7.2b | **Voltflow 11.8.1** |
| SCHEMA_VERSION | 11.7 | 11.7 (unchanged — no schema churn) |
| package version | 1.0.0 | 1.0.0 |
| @supabase/supabase-js | ^2.112.2 | ^2.112.2 |

11.8.1 is a **runtime-trust proof release, not a feature-breadth release.** No new product modules.

## Baseline commands (this environment)
| Command | Result |
|---|---|
| `npm run build` | **PASS** (~3.3s) |
| `npm run test:all` | **PASS** — exit 0, all suites 0 failed |
| `npm run test:commercial` | **PASS** 14/14 |
| `npm run test:trust` | **PASS** 13/13 |
| `npm run test:release-gates` | **PASS** 6/6 |
| `npm run test:rls` (pgTAP) | **NOT EXECUTED** — `ECONNREFUSED 127.0.0.1:54322`; Docker absent |
| new security suites | **NOT_EXECUTED** — no live Supabase (see release gate) |

`npm ci` was **not** re-run: the existing `node_modules` builds and tests green, and a clean reinstall risks breaking a working offline tree. Recommend running `npm ci` in CI.

## Environment / tool availability
- Node present; Vite build works.
- **Docker: ABSENT** (daemon not running; port 54322 closed).
- Supabase CLI: present (2.113.0) but unusable without Docker.
- Runtime provider: `local-demo` (no Supabase env configured).

## Scope guardrails honoured
No new product modules, IoT, M-PESA, Atlas/GIS, marketplace, or O&M. No production deploy. No secrets printed. `.env.local` not created/committed. Dummy data only.

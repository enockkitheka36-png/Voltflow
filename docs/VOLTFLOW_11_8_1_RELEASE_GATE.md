# Voltflow 11.8.1 — Release Security Gate

## What it does
`scripts/release-security-gate.mjs` aggregates every DB-backed security suite, probes for a live Supabase, and writes `docs/generated/security-test-status.json`. It **refuses to permit any use beyond `internal-demo`** unless all security suites executed **and** passed.

## Enforcement
```
node scripts/release-security-gate.mjs                      # report, exit 0
node scripts/release-security-gate.mjs --require staging-review    # exit 1 unless proven
```
`npm run test:security-gate` runs the report form.

## Current machine-readable status (this environment)
```json
{
  "appVersion": "Voltflow 11.8.1",
  "runtimeMode": "local-demo",
  "liveSupabaseReachable": false,
  "rlsTestsExecuted": false,
  "rlsTestsPassed": false,
  "storageTestsExecuted": false,
  "tenantAttackTested": false,
  "revisionImmutabilityTested": false,
  "auditAppendOnlyTested": false,
  "authFlowTested": false,
  "evidenceAccessTested": false,
  "releaseAllowed": false,
  "allowedUse": "internal-demo"
}
```
`--require staging-review` currently **exits 1 (GATE FAIL)** — exactly the intended behaviour: skipped security tests cannot masquerade as green.

## Suggested CI wiring
- PR/dev: `npm run test:all` (JS suites) — green today.
- Staging release job: `npm run test:security-gate -- --require staging-review` — will FAIL until Docker + Supabase + the security suites pass. This blocks external staging until the platform is proven.

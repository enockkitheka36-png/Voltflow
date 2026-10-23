# Catalyst release gate

The gate aggregates recorded runtime evidence. It does not execute sign-ins or prove server security by itself. Local regression fixtures are never live proof records. No production approval is granted by this gate.

## Fail-closed rules

- A missing, malformed, contradictory, future-dated, stale, wrong-project, wrong-environment or wrong-build proof cannot pass.
- Execution/pass flags must be actual JSON booleans and agree with the exact status.
- All eight proofs must match the current build fingerprint, app origin, project ID and environment. They require evidence references and non-admin test-user identities; cross-user suites require two distinct users.
- Pending/invalid/stale evidence permits only an internal demo with synthetic data, even when the app is configured for Catalyst. A recorded failure blocks the gate entirely.
- All valid proofs can authorize at most `controlled-pilot`. Production and real-client/bank-data requirements remain blocked.

## Run

Build the real source with its existing, reviewed provider settings. The gate fingerprints the files in `dist/`; changing any artifact invalidates old proofs. Do not deploy a local-demo preview build to Catalyst.

For this Development project, set these non-secret environment values in the gate's shell:

```powershell
$env:CATALYST_APP_URL = 'https://project-rainfall-941921258.development.catalystserverless.com'
$env:CATALYST_PROJECT_ID = '131106000000014024'
$env:CATALYST_ENVIRONMENT = 'Development'
$env:VITE_VOLTFLOW_PROVIDER = 'catalyst'
npm run build
npm run test:catalyst-gate
npm run test:catalyst-gate -- --require controlled-pilot
```

The first command is report-only (exit 0). The second exits 1 until the requested level is proven. Unknown/missing release-level arguments exit 2. Explicit shell environment is required; the gate does not silently infer an environment from a URL substring or load Vite environment files.

The generated `docs/generated/catalyst-release-status.json` includes the expected proof context. Before recording actual passes, the runtime test runner/reviewer must verify that the hosted client corresponds to this exact build, then run the tests against that app and environment. Local file metadata alone is not proof of a deployment or of server settings.

## Runtime proof records

Each suite uses `docs/generated/catalyst-<suite>.json`. The eight suite names are defined in `scripts/lib/catalystReleaseStatus.mjs`.

A record that has not run may contain:

```json
{
  "schemaVersion": 1,
  "suite": "project-isolation",
  "executed": false,
  "passed": false,
  "status": "NOT_EXECUTED"
}
```

A completed proof also requires `context` exactly matching the generated report, `writtenAt` as a canonical UTC ISO timestamp no older than six hours, `testUsers` containing `{ "id": "...", "role": "App User" }` records, and a nonempty `evidence` reference to reviewable test observations. `PASS` requires executed/passed both true; `FAIL` requires executed true and passed false. The signed-out function suite may use an empty test-user array. Administrators/managers do not establish end-user isolation.

These are local evidence records, not cryptographically trusted attestations. The collector/reviewer must retain and inspect the underlying evidence; the gate cannot independently certify the truth of a hand-edited file. No PASS records are created by the regression suite or this UI work.

## Save recovery verification

`npm run test:save-recovery` exercises the write/refresh separation with synthetic providers. A successful write updates the active cloud identity before refreshing the list; refresh failure offers only a list refresh, not a create retry. Backup/export is checked both in the UI and in the export handler, and requires Engineer View plus full-project capability in cloud mode.

The development-only page `/qa/save-recovery.html`, served by the normal Vite dev server, exercises the actual Storage component with deliberately failing synthetic providers. It is not a production build entry, does not contact Catalyst, and is not live security evidence.

Network failures where the server accepted a write but its response was lost remain an inconclusive outcome, not a confirmed failure. The UI says "Save not confirmed"; a server-enforced idempotency guarantee is not claimed by this patch. Check saved projects before retrying an ambiguous create.

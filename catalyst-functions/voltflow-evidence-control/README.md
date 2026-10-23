# voltflow-evidence-control (Catalyst Advanced I/O function)

Privileged evidence-lifecycle operations that must not run in the browser:
`VERIFY_EVIDENCE`, `REJECT_EVIDENCE`, `DELETE_DRAFT`, `GET_VERSION_DETAILS`.

The client (`CatalystEvidenceRepository`) calls it via
`POST /server/voltflow-evidence-control/` with `{ action, evidenceId, ... }` and
`credentials: "include"` (the Catalyst session cookie authenticates the caller).

## Status: DRAFT — not deployed
Per GPT's gate, nothing deploys until the Stratus implementation + schema + permissions
are reviewed. This folder lives in the repo for review/version control; it is **not**
inside the Catalyst project at `C:\Users\Administrator` yet.

## Deploy steps (Phase E, after review) — Enock runs these
1. In `C:\Users\Administrator` (the Catalyst project root), scaffold a function so the
   CLI writes a `catalyst-config.json` matching your CLI version:
   ```
   catalyst.cmd functions:add
   ```
   Choose: Advanced I/O, Node, name `voltflow-evidence-control`.
2. Replace the scaffolded `index.js` and `package.json` with the files in this folder.
3. Install deps inside the function dir: `npm install`.
4. Deploy only the function: `catalyst.cmd deploy --only functions`.
5. The client already targets `/server/voltflow-evidence-control/`
   (`EVIDENCE_CONTROL_FN` in `src/platform/catalystAdapter.js`); adjust that constant if
   your function's invoke path differs.

## SDK contexts (explicit — no inheritance)
- `baseApp  = catalystSDK.initialize(req)` → `userManagement().getCurrentUser()`.
- `userApp  = catalystSDK.initialize(req, { scope: "user" })` → Evidence DataStore insert/update,
  ZCQL, and audit writes (so rows are owned by the App User under User scope).
- `adminApp = catalystSDK.initialize(req, { scope: "admin" })` → `new Stratus(adminApp).bucket()`
  for all Stratus object ops (copy/get/head/delete).

## ⚠️ Verify before deploy (do not guess)
Confirm these `zcatalyst-sdk-node` calls against the installed SDK version:
`catalystSDK.initialize(req)`, `app.userManagement().getCurrentUser()`,
`app.zcql().executeZCQLQuery(...)`, `app.datastore().table(name).updateRow/deleteRow/insertRow`,
`app.stratus().bucket(name).deleteObject(key)` / `listObjectVersions(key)`.

## Function security (enforce at Catalyst level — not just code)
Set in the console: **Compute → Security Rules**, for `advancedio` function
`voltflow-evidence-control`:
- **authentication: `required`** (Catalyst runs an auth check before the function; an
  unauthenticated call is rejected). NOTE: without this, `getCurrentUser()` runs as admin
  and returns null — so rule-level enforcement is essential, not optional.
- **methods: `["POST"]` only** (do NOT omit methods — omitting makes the URL globally
  accessible). All other methods rejected by the platform.

The code keeps defense-in-depth: 405 for non-POST, 401 when `getCurrentUser()` yields no
authenticated caller, and it never trusts identity/status fields from the request body.

## Schema dependency
`VERIFY_EVIDENCE` writes `VerifiedBy` and `VerifiedAt` — add those two columns
(Var Char) to the Evidence DataStore table before enabling verification.

# Catalyst SDK direction & File Store → Stratus migration note

_Status: 2026-10-12. Written during the Evidence slice when Catalyst File Store was found deprecated._

## 1. Why this note exists
- **Catalyst File Store is deprecated** (deprecation began 27 Aug 2025; sunset **31 Oct 2026**). After
  sunset it disappears from the console and any logic built on it breaks. It is not offered on new
  projects. Source: docs.catalyst.zoho.com/en/announcements/2026/filestore-sunset.
- The **Catalyst Web SDK v4** (what Voltflow loads today, `catalystWebSDK.js` **4.6.2** from the Zoho
  CDN, exposed as `window.catalyst`) is itself in deprecation; Zoho points to the newer **modular
  JavaScript SDK** (`@zcatalyst/*` npm packages). We are NOT rewriting the whole adapter now — the
  working **Projects / AuditEvents / ProjectVersions** repositories must not be destabilised to
  modernise the SDK. We only replace the Evidence **binary-storage** layer (File Store → Stratus).

## 2. Current SDK state in this repo
- No `@zcatalyst/*` npm package is installed. The SDK is the CDN Web SDK 4.6.2, loaded by the auth
  gate in `index.html`. Stratus requires Web SDK **≥ 4.5.0-beta**, so 4.6.2 is new enough.
- `init.js` already provisions Stratus for this project: `stratus_domain: "-development.zohostratus.com"`.

## 3. Stratus Web SDK v4 — browser method/scope matrix (verified from docs)
| Operation | Method | Scope | Browser-capable? |
|---|---|---|---|
| Upload object | `bucket.putObject(key, file, {overwrite,ttl,type,meta}).start()` | none | ✅ yes |
| Download object | `bucket.getObject(key, {versionId,range,signed,signedUrlFn,expiryInSeconds}).start()` → `content` is a **Blob** | none | ✅ yes |
| Delete object | Delete Object (by name / name+versionId) | **Admin** | ❌ server only |
| Get object details / metadata | Get Object Details | **Admin** | ❌ server only |
| List object versions | List Object Versions | **Admin** | ❌ server only |
| Generate presigned URL (up/download) | Generate Presigned URL | **Admin** | ❌ server only |
| Check object availability | Check Object Availability (±versionId) | (unconfirmed) | ? |

Notes:
- `putObject` resolves to `{status, content:true|false, message}` — it does **NOT** return the
  object key or versionId. Capturing `ObjectVersionId` therefore needs List Object Versions (Admin) →
  server side.
- Object **key/path cannot contain** `"`  `<`  `>`  `#`  `\`  `|`  or **space** → filenames must be sanitised.
- Bucket **permission rules** (`auth_type:"authenticated"`, `zuid:"*"` or a specific zuid, allowing
  GetObject/PutObject/DeleteObject on paths) apply to **project end-users, NOT admins/collaborators**.
  So isolation cannot be proven while signed in as an **App Administrator** — a non-admin App User is
  required for the isolation test.
- **CORS**: the bucket must whitelist the app origin (and `http://localhost:<port>` for dev) under the
  bucket's Configurations → CORS, with the needed methods (GET/PUT/DELETE/HEAD).

## 4. Recommended architecture (secure, minimal)
Browser (Web SDK) does the two no-scope operations; a **Catalyst serverless (Node) function** does the
privileged/secure ones:
- **Browser:** `putObject` (upload) and `getObject` (download → Blob → `URL.createObjectURL`).
- **Serverless function `evidence-access`:** issue scoped **presigned upload/download URLs**, capture
  **versionId**, **delete** objects by lifecycle rule, and enforce the per-user path server-side
  (reject any key whose `<ZUID>` segment ≠ the caller's ZUID). This is the only way to get true
  per-user isolation + delete + versionId with Stratus, because those are Admin-scope.
- Object key (no PII): `<ZUID>/projects/<ProjectKey>/evidence/<EvidenceKey>/<sanitizedFileName>`.

A browser-only MVP (admin user, no function) can demonstrate upload/download but **cannot prove
end-user isolation, delete-as-end-user, or versionId capture** — so it is a demo, not the secure slice.

## 5. Metadata model (additions, non-destructive)
Keep existing Evidence columns. Add (console): `StorageProvider` (=`STRATUS`), `ObjectKey`,
`ObjectVersionId`, `BucketName` (=`voltflow-evidence`). Leave `FileStoreId` present but **deprecated/
unused** (documented, not repurposed).

## 6. Modular JS SDK — future, not now
Full migration to `@zcatalyst/*` modular SDK is a separate, larger effort. Do it only when there is
time to re-verify Projects/Audit/Versions against the new SDK. For this slice, stay on Web SDK 4.6.2
and add a serverless function for the Stratus privileged ops.

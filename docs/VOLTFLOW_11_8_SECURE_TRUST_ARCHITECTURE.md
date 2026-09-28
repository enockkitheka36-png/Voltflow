# Voltflow 11.8 Secure Trust Foundation

Date: 2026-08-07

Status: implemented in source; database execution and external staging approval pending

## Decision

Voltflow 11.8 adds a trust platform around the unchanged 11.7.2b calculation
application. Solar calculations, the persisted 11.7 schema, zero-load gates,
proposal sanitization, financial consistency and pilot-safety behavior remain the
compatibility boundary.

The provider is selected explicitly:

- `local-demo`: default, browser-only, no cloud submission claim.
- `supabase`: authenticated sessions, tenant repositories, RLS, private object
  storage and server-authoritative audit/review operations.

Cloud mode never silently falls back to local storage after a provider error.

## Provider Contracts

The interfaces live in `src/platform/contracts.js`:

| Contract | Responsibility |
| --- | --- |
| `AuthProvider` | Session, sign-in/out and active organisation memberships |
| `ProjectRepository` | Tenant project CRUD, archive, immutable versions, legacy import and shares |
| `EvidenceRepository` | Private signed upload/download, checksum finalization and review |
| `AuditRepository` | Server event reads and controlled event append |
| `ReviewRepository` | Version-bound submission creation and state transitions |

`createVoltflowPlatform` builds one coherent provider. The app consumes only
repository methods; Supabase details stay in `supabaseAdapter.js`.

## Current Persistence Map

### Cloud mode authority

| Data | Authority |
| --- | --- |
| Projects and revisions | `projects` |
| Proposal snapshots | `project_versions` |
| Audit history | `audit_events` |
| Evidence metadata | `evidence_items` |
| Evidence bytes | private `project-evidence` bucket |
| Review state and decisions | `review_submissions`, `approvals` |
| Internal BoQ history | `boq_revisions` |
| Client/bank access | `project_shares` |

Cloud mode does not read the local project list or local assistant chat. Working
form edits remain in React memory until Save. A save persists the complete 11.7
record with a revision precondition and records a server event.

### Local/demo browser keys

| Key | Purpose | Authority |
| --- | --- | --- |
| `voltflowProProjects` | Legacy/local projects | Local/demo only |
| `voltflowLastSession` | Resume pointer | Local/demo convenience only |
| `voltflowAuditLog` | Legacy activity rendering | Local/demo only, mutable |
| `voltflowAssistantChat` | Local assistant transcript | Local/demo only |
| `voltflowFeedback` | Tester feedback | Local/demo only |
| `voltflowDemoChecklist` | Demo-readiness checklist | Local UI preference |
| `voltflow11_8LocalDemoVersions` | Local immutable-copy simulation | Local/demo only |
| `voltflow11_8LocalDemoEvidence` | Local evidence metadata simulation | Local/demo only |
| `voltflow11_8LocalDemoReviews` | Local review simulation | Local/demo only |

Local approvals, audit entries and evidence reviews are explicitly
non-authoritative. They are not migrated as trusted decisions.

## Role And Access Map

| Role | Project API | Commercial data | Evidence | Review | Shared package |
| --- | --- | --- | --- | --- | --- |
| Manager | Full tenant CRUD/archive | Full | Upload/read/review | Full decision | Create/revoke |
| Engineer | Full tenant CRUD | Full read | Upload/read/review | Full decision | No direct share grant |
| Sales | Tenant CRUD and proposal versions | Full | No raw metadata | Prepare/submit | Create/revoke |
| Technician | Assigned field-safe RPC only | None | Assigned upload/read | None | None |
| Client | No mutable project rows | None | Verified shared download only | None | Client projection only |
| Bank | No mutable project rows | None | Verified shared download only | None | Bank projection only |

Technician, Client and Bank roles never mount the full application workspace.
They use restricted API-driven portals. Internal navigation also uses explicit
role allow-lists, but RLS and RPC checks are the security authority.

## Data Model

All tenant-owned records use UUID keys, `timestamptz` UTC timestamps, explicit
foreign keys and `organisation_id`:

| Table | Purpose |
| --- | --- |
| `organisations` | Tenant root |
| `profiles` | Global auth-user display profile for multi-org membership |
| `organisation_memberships` | One active role per user and organisation |
| `projects` | Mutable current record plus `revision_no` and migration provenance |
| `project_members` | Explicit field assignment |
| `project_versions` | Immutable full and audience-specific snapshots with hashes |
| `audit_events` | Append-only, hash-linked server event ledger |
| `evidence_items` | Private object metadata, checksum, timestamps, GPS and review state |
| `review_submissions` | Version-bound workflow state |
| `approvals` | Append-only approved/rejected decisions and snapshot hash |
| `boq_revisions` | Append-only internal lines/totals plus public headline |
| `project_shares` | Expiring, revocable, user-specific issued-version access |

`profiles` is intentionally global because one authenticated user may belong to
multiple organisations. Tenant relationship and authorization always come from
`organisation_memberships`.

## RLS Model

Every application table has RLS enabled and forced. Table privileges are
revoked, then only required `SELECT` privileges and narrow RPC execution are
granted to `authenticated`. Mutations occur through security-definer functions
that validate `auth.uid()`, organisation membership, role, project ownership and
request inputs.

Important controls:

- Cross-tenant IDs fail membership and composite foreign-key checks.
- Technician project reads use `get_technician_home`; full `projects` and BoQ
  rows are not selectable.
- Client/Bank users cannot select mutable projects, full versions, BoQ, review
  reasons, approvals, audit rows or evidence GPS/uploader metadata.
- Shared package RPCs return only the audience snapshot of an unexpired,
  unrevoked, explicitly shared issued version.
- Audience snapshots pass both browser and database key allow-lists.
- Shares require an approval for the exact issued version.
- No policy permits ordinary users to update/delete storage objects, versions,
  audit events, approvals or BoQ revisions.

## Project Persistence And Concurrency

Project create/update/archive operations are transactional RPCs. Update requires
the loaded `revision_no` and optionally `updated_at`. A stale request receives a
conflict and must reload; last-write-wins is prohibited.

Cloud project IDs are database UUIDs. Legacy timestamp IDs and display names are
preserved only in the imported payload/provenance and never become tenant keys.

## Immutable Versions

Proposal preparation creates a canonical snapshot containing:

- recorded inputs and assumptions;
- calculation and app versions;
- sizing and financial outputs;
- full internal BoQ and evidence status;
- bill-load reconciliation;
- report metadata and provenance.

Canonical JSON is deterministically hashed in the browser for preview and again
from Postgres `jsonb` for server authority. Client projection hashes are also
server-generated. All project versions are append-only. Any change requires a
new version number.

## Audit Ledger

Server events include actor user, actor role, action, organisation, project,
version, UTC time, changed-field metadata, request ID and reason. Events are
hash-linked per project (or organisation scope) under an advisory transaction
lock.

Audit payloads are size-limited and reject secret-like keys. Technician events
require assignment and field actions. Client/Bank access events require an
active share and accept no caller-supplied old/new payload. Ordinary roles have
no update/delete privilege and an immutable trigger is defense in depth.

The legacy local audit log is rendered only in local/demo mode. It is not cloud
authority.

## Bill-Load Reconciliation

The model stores bill-implied monthly kWh, itemized daily/monthly kWh, captured
load coverage, mismatch status, non-energy charges and savings as a separate
percentage of bill.

Missing tariff, unresolved non-energy charges, under-capture and over-capture
block unqualified client savings wording. They do not change the existing load
inventory calculation engine.

## Evidence Model

Evidence objects use this private path:

`organisation UUID/project UUID/evidence UUID/safe filename`

The sequence is:

1. Authorize metadata and path via RPC.
2. Obtain a short-lived signed upload token.
3. Upload directly to the private bucket.
4. Calculate SHA-256 from the file bytes.
5. Finalize only after the object exists and size matches.
6. Manager/Engineer records `verified` or `rejected` review.
7. Generate a short-lived signed download only after authorization.

There are no public evidence URLs. Metadata records MIME type, bytes, checksum,
device timestamp, server timestamp, GPS JSON, uploader and reviewer status.

## Review Workflow

Allowed transitions are:

`draft -> review_ready -> submitted -> in_review -> approved/rejected`

`review_ready -> draft` and `rejected -> draft` support correction. A submission
is bound to an immutable version. Manager/Engineer alone can take a submission
into review or decide it. Decisions require a reason and create an append-only
approval tied to the snapshot hash.

Local mode uses the same state model but always states that no cloud or external
submission occurred.

## Legacy Migration

Import is explicit and idempotent:

1. Validate an object with a project payload.
2. Canonicalize the complete source record without dropping unknown fields.
3. Hash it to a source fingerprint.
4. Create a new tenant project, preserving source ID/reference/version/times.
5. Mark legacy evidence and approvals untrusted.
6. Record `project.migrated` in the server ledger.

Duplicate fingerprints return the existing migration. Duplicate names never
merge projects. Original local data is not deleted automatically.

## Supabase Recommendation

Use Supabase for the controlled EPC staging phase. It provides Auth, Postgres,
RLS, transactional RPCs and private object storage with less custom security
surface than a new Node backend. The provider interfaces preserve an exit path
to a custom service if scale, residency or workflow requirements later justify
it.

Do not introduce a custom backend now. Reassess only after measured pilot needs
show a concrete limitation in Supabase.

## Known Limitations

- Database migrations and pgTAP tests have not executed on this Windows host
  because Docker/Postgres is unavailable.
- Offline technician queue/sync is not implemented; uploads need connectivity.
- Organisation invitations, membership administration and account recovery UI
  are not implemented.
- Share administration has repository/RPC support but no polished recipient UI.
- Full database and object-storage backup/restore has not been rehearsed.
- Data region, retention, DPA and breach-response decisions remain external.
- Baseline dependency advisories in jsPDF, xlsx, Vite/esbuild, PostCSS and
  DOMPurify remain unresolved.
- Audit captures authoritative saves and workflow operations, not every
  transient keystroke before Save.

These limitations prohibit production and real bank/customer data approval.

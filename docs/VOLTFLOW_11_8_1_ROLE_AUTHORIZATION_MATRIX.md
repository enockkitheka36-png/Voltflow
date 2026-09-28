# Voltflow 11.8.1 — Role Authorization Matrix

**Critical distinction:** *UI view mode* changes presentation only. *Authorization* is only real when enforced beyond the browser (API / database RLS / storage RLS).

## Enforcement layers present
- **UI only:** view-mode buttons (Engineer/Client/Bank/Technician) in `App.jsx` — presentation.
- **App logic:** `navigationPermissions`, sanitization, `cloudEnabled` gating.
- **Database/RLS (code, NOT yet runtime-proven):** RLS enabled on all 15 tables in `202608070002_rls_and_storage.sql`, organisation-scoped by `organisation_id` + `organisation_memberships.role`.
- **Storage RLS (code, NOT yet runtime-proven):** policies on `project-evidence` bucket.

## Runtime reality in THIS environment (local-demo)
There is **no server enforcement active** — the app runs the local-demo adapter with a client-side role (`VITE_VOLTFLOW_LOCAL_ROLE`, default engineer). So in the audited runtime, **every role distinction is UI-SANITIZED, not AUTHORIZED.**

## Matrix (roles per `organisation_memberships` + design)

| Capability | owner | manager | engineer | sales | technician | client_viewer | bank_viewer | Enforcement layer |
|---|---|---|---|---|---|---|---|---|
| Read project | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (sanitized) | ✓ (sanitized) | DB/RLS *(designed)* |
| Edit project / loads | ✓ | ✓ | ✓ | ✓ (basic) | — | — | — | DB/RLS *(designed)* |
| Generate design / issue quote | ✓ | ✓ | ✓ | — | — | — | — | app + DB immutability *(designed)* |
| Approve review | ✓ | ✓ | — | — | — | — | — | DB/RLS *(designed)* |
| See internal cost / EPC margin | ✓ | ✓ | ✓ | — | — | — | — | UI today; DB/RLS *(designed)* |
| Export JSON / download proposal | ✓ | ✓ | ✓ | ✓ | proposal only | proposal only | proposal only | UI today |
| View evidence | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | storage RLS *(designed)* |
| Upload evidence / request signed URL | ✓ | ✓ | ✓ | — | ✓ | — | — | storage RLS *(designed)* |
| Delete project | ✓ | ✓ | — | — | — | — | — | DB/RLS *(designed)* |
| Modify issued revision | — | — | — | — | — | — | — | DB immutability *(designed)* |
| View audit | ✓ | ✓ | ✓ | — | — | — | — | DB/RLS *(designed)* |

*"designed"* = the RLS/immutability policy exists in migrations but is **NOT runtime-proven** (no live DB; see RLS_NOT_EXECUTED). Do not describe any role above as *secure* until the tenant-attack + RLS suites pass.

## Required in-app copy (add to cloud-mode banner)
> "View mode changes presentation only. Access control is enforced by authenticated organisation membership in cloud mode."

# Voltflow 11.8 Vincent Staging Runbook

Date: 2026-08-07

This runbook is for an isolated non-production Supabase/EPC staging environment.
It does not approve production deployment.

## Required From Vincent

1. A Docker-capable development machine for Supabase CLI tests.
2. An isolated Supabase staging project in an approved region.
3. Staging URL and publishable key only for browser configuration.
4. Confirmation that no service-role key will use a `VITE_` variable or enter a
   frontend/deployment package.
5. A staging domain with HTTPS and restricted tester access.
6. Named test users for Manager, Engineer, Sales, Technician, Client and Bank.
7. Backup/restore and private object-storage retention decisions.
8. Data handling approval defining permitted dummy/pseudonymous staging data.
9. Review of current dependency advisories and written staging risk acceptance
   or remediation plan.

## Local Supabase Validation

From the repository root:

```powershell
npm.cmd ci
npx.cmd supabase start
npx.cmd supabase db reset
npm.cmd run test:rls
npm.cmd run test:all
npm.cmd run build
```

Expected database fixtures:

- two organisations;
- all six roles in each organisation;
- one assigned technician/project in each tenant;
- issued client/bank-safe snapshots;
- private evidence metadata;
- approved review records and explicit shares.

Fixture identities end in `@voltflow.local` and use the local-only password
documented in `supabase/seed.sql`. They must never be copied to hosted staging.

## Hosted Staging Setup

1. Create an empty Supabase staging project.
2. Apply migrations in filename order from `supabase/migrations`.
3. Do not apply `supabase/seed.sql` to a real or production project.
4. Confirm RLS is enabled and forced on every application table.
5. Confirm the `project-evidence` bucket exists and `public = false`.
6. Create named staging users through approved Auth administration.
7. Create organisation memberships with least-privilege roles.
8. Assign Technician users to explicit projects.
9. Configure only the publishable browser credentials.
10. Run tenant-isolation tests with two real staging organisations before user
    acceptance testing.

Frontend staging variables:

```text
VITE_VOLTFLOW_PROVIDER=supabase
VITE_SUPABASE_URL=https://STAGING_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=STAGING_PUBLISHABLE_KEY
```

Assistant server variables, only if AI is explicitly approved for staging:

```text
VOLTFLOW_REQUIRE_AUTH=true
SUPABASE_URL=https://STAGING_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=STAGING_PUBLISHABLE_KEY
ANTHROPIC_API_KEY=SERVER_SECRET_ONLY
```

Do not configure `ANTHROPIC_API_KEY` to keep all external AI calls disabled.
Bank Mode remains disabled regardless.

## Acceptance Tests

### Tenant isolation

- Manager A cannot read/write Organisation B IDs.
- Project references may repeat across organisations without row leakage.
- Suspended/revoked memberships lose access immediately.

### Roles

- Technician sees assigned tasks and field evidence only.
- Client/Bank sees only explicitly shared issued versions.
- Client/Bank cannot select projects, full versions, BoQ revisions, audit rows,
  approval actors, review reasons or raw evidence metadata.
- Sales cannot take a submission into review or approve it.

### Concurrency and versions

- Two sessions load the same revision.
- First save succeeds; second save receives conflict.
- Proposal preparation creates a new immutable version and hash.
- Direct update/delete of versions, approvals, audit and BoQ revisions fails.

### Evidence

- Cross-tenant and unassigned uploads fail.
- Allowed MIME/size upload succeeds through a signed token.
- Finalization rejects wrong size/checksum format.
- Bucket/object is not public.
- Download URL expires and every request rechecks authorization.

### Review and sharing

- Required state order is enforced.
- Submission remains bound to one immutable version.
- Manager/Engineer decision requires a reason.
- Unapproved or prepared-only versions cannot be shared.
- Revoked/expired shares stop package and evidence access.

### 11.7.2b compatibility

- Zero-load, invalid-load, proposal sanitization, assumption labeling, AI
  privacy, bank honesty, BoQ and finance regressions all pass.

## Secret And Deployment Rules

- Never commit `.env`, `.env.local`, Supabase access tokens or AI keys.
- Never use service-role credentials in browser code, Vite variables or logs.
- Do not log Authorization headers, signed URLs or full provider errors.
- Keep evidence private; do not create public buckets or public object URLs.
- Do not deploy production from this sprint without separate approval.

## Vincent Review Checklist

- [ ] Local migrations and seed reset complete without SQL errors.
- [ ] All pgTAP RLS/storage tests pass.
- [ ] All JavaScript regressions and production build pass.
- [ ] Hosted RLS policies match source migrations.
- [ ] Two-tenant manual red-team checks pass.
- [ ] Publishable key confirmed; no service-role material in frontend.
- [ ] Auth redirect URLs and email templates use staging domains.
- [ ] Evidence bucket private and signed URL expiry tested.
- [ ] Backup and restore rehearsed for database and evidence bytes.
- [ ] Logging/monitoring excludes tokens and signed URLs.
- [ ] Dependency advisory posture accepted or remediated.
- [ ] No production deployment performed.

## Mary Decision Checklist

- [ ] Approve the external EPC staging objective and named pilot EPC.
- [ ] Approve data region, staging data classification and retention.
- [ ] Approve roles and who may issue/share a proposal.
- [ ] Approve whether AI is disabled or enabled for internal staging users.
- [ ] Accept that offline field sync, invitations and polished share admin are
      outside this sprint.
- [ ] Approve dependency-risk treatment before any real customer data.
- [ ] Require a successful security/UAT review before bank-facing use.

## Current Recommendation

NO-GO for controlled external EPC staging until the migrations and pgTAP suite
pass on a real local Supabase stack and the hosted two-tenant checks are signed
off. After those gates, proceed only with dummy or explicitly approved staging
data. Production and real bank/customer data remain NO-GO.

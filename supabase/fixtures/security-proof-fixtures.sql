-- Voltflow 11.8.2 — Security-proof fixtures (DUMMY DATA ONLY).
-- Deterministic issued design revisions, issued quotes and append-only audit
-- events for the revision-immutability and audit append-only proof tests.
--
-- Kept OUT of seed.sql on purpose: these exist only to give the security suites
-- concrete rows to attack. They reuse the deterministic orgs/projects/users from
-- seed.sql. Never reuse outside a reset local/staging stack. No real data.
--
-- Idempotent (ON CONFLICT DO NOTHING). Hashes are computed with the same
-- extensions.digest(...,'sha256') pattern seed.sql uses, so they satisfy the
-- '^sha256:[0-9a-f]{64}$' / '^rev_[0-9a-f]{16}$' / '^[0-9a-f]{64}$' constraints.

begin;

-- Deterministic IDs (also referenced by the runner env):
--   design revision A : 10000000-4000-4000-8000-000000000001
--   design revision B : 20000000-4000-4000-8000-000000000002
--   quote A           : 10000000-5000-4000-8000-000000000001
--   quote B           : 20000000-5000-4000-8000-000000000002
--   audit A (issued)  : 10000000-7000-4000-8000-000000000003 (design_revision_issued)

-- A. Issued design revisions (immutable: no status column; append-only trigger blocks UPDATE/DELETE)
insert into public.design_revisions (
  id, organisation_id, project_id, revision_id, inputs_hash, calculation_version,
  project_revision_no, normalized_inputs, sizing_options, created_by
)
select
  d.id, d.organisation_id, d.project_id,
  'rev_' || substr(encode(extensions.digest(convert_to(d.normalized_inputs::text, 'UTF8'), 'sha256'), 'hex'), 1, 16),
  'sha256:' || encode(extensions.digest(convert_to(d.normalized_inputs::text, 'UTF8'), 'sha256'), 'hex'),
  'fixture-calc-1', 1, d.normalized_inputs, '[]'::jsonb, d.created_by
from (values
  ('10000000-4000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000001'::uuid, '10000000-1000-4000-8000-000000000001'::uuid, '11000000-0000-4000-8000-000000000102'::uuid, '{"fixture":"A","kwp":18,"batteryKwh":24,"loads":"itemised"}'::jsonb),
  ('20000000-4000-4000-8000-000000000002'::uuid, '20000000-0000-4000-8000-000000000002'::uuid, '20000000-1000-4000-8000-000000000002'::uuid, '22000000-0000-4000-8000-000000000202'::uuid, '{"fixture":"B","kwp":22,"batteryKwh":30,"loads":"itemised"}'::jsonb)
) as d(id, organisation_id, project_id, created_by, normalized_inputs)
on conflict (id) do nothing;

-- B. Issued quotes (status ISSUED requires issued_at not null; composite FK to design revision)
insert into public.quotes (
  id, organisation_id, project_id, design_revision_id, quote_ref, revision_no, status,
  currency, line_items, pricing_policy_version, tax_rule_version, totals, inputs_hash, created_by, issued_at
)
select
  q.id, q.organisation_id, q.project_id, q.design_revision_id, q.quote_ref, 1, 'ISSUED',
  'KES', q.line_items, 'pp-fixture-1', 'vat16-fixture-1', q.totals,
  'sha256:' || encode(extensions.digest(convert_to(q.totals::text, 'UTF8'), 'sha256'), 'hex'),
  q.created_by, now()
from (values
  ('10000000-5000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000001'::uuid, '10000000-1000-4000-8000-000000000001'::uuid, '10000000-4000-4000-8000-000000000001'::uuid, 'Q-FIXTURE-A',
    '[{"item":"PV module 550W","qty":30,"unit":45000},{"item":"Hybrid inverter","qty":1,"unit":320000},{"item":"LFP battery 24kWh","qty":1,"unit":480000}]'::jsonb,
    '{"supplierCost":1300000,"marginPct":18,"margin":234000,"labour":90000,"transport":40000,"contingency":55000,"subtotal":1534000,"vat":245440,"clientPrice":1779440}'::jsonb,
    '11000000-0000-4000-8000-000000000102'::uuid),
  ('20000000-5000-4000-8000-000000000002'::uuid, '20000000-0000-4000-8000-000000000002'::uuid, '20000000-1000-4000-8000-000000000002'::uuid, '20000000-4000-4000-8000-000000000002'::uuid, 'Q-FIXTURE-B',
    '[{"item":"PV module 550W","qty":40,"unit":45000}]'::jsonb,
    '{"supplierCost":1800000,"marginPct":18,"margin":324000,"subtotal":2124000,"vat":339840,"clientPrice":2463840}'::jsonb,
    '22000000-0000-4000-8000-000000000202'::uuid)
) as q(id, organisation_id, project_id, design_revision_id, quote_ref, line_items, totals, created_by)
on conflict (id) do nothing;

-- C. Append-only audit events (action must be lowercase per '^[a-z0-9_.-]{3,100}$'; event_hash 64-hex)
insert into public.audit_events (
  id, organisation_id, project_id, actor_user_id, actor_role, action,
  old_fields, new_fields, occurred_at, event_hash
)
select
  a.id, a.organisation_id, a.project_id, a.actor, 'engineer'::public.organisation_role, a.action,
  '{}'::jsonb, a.new_fields, now(),
  encode(extensions.digest(convert_to(a.id::text || ':' || a.action, 'UTF8'), 'sha256'), 'hex')
from (values
  ('10000000-7000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000001'::uuid, '10000000-1000-4000-8000-000000000001'::uuid, '11000000-0000-4000-8000-000000000102'::uuid, 'project_created', '{"client":"Fixture A Client"}'::jsonb),
  ('10000000-7000-4000-8000-000000000002'::uuid, '10000000-0000-4000-8000-000000000001'::uuid, '10000000-1000-4000-8000-000000000001'::uuid, '11000000-0000-4000-8000-000000000102'::uuid, 'load_committed', '{"dailyKwh":420}'::jsonb),
  ('10000000-7000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000001'::uuid, '10000000-1000-4000-8000-000000000001'::uuid, '11000000-0000-4000-8000-000000000102'::uuid, 'design_revision_issued', '{"designRevisionId":"10000000-4000-4000-8000-000000000001"}'::jsonb),
  ('10000000-7000-4000-8000-000000000004'::uuid, '10000000-0000-4000-8000-000000000001'::uuid, '10000000-1000-4000-8000-000000000001'::uuid, '11000000-0000-4000-8000-000000000102'::uuid, 'quote_revision_issued', '{"quoteId":"10000000-5000-4000-8000-000000000001"}'::jsonb),
  ('10000000-7000-4000-8000-000000000005'::uuid, '10000000-0000-4000-8000-000000000001'::uuid, '10000000-1000-4000-8000-000000000001'::uuid, '11000000-0000-4000-8000-000000000102'::uuid, 'evidence_added', '{"evidenceId":"10000000-6000-4000-8000-000000000001"}'::jsonb),
  ('10000000-7000-4000-8000-000000000006'::uuid, '10000000-0000-4000-8000-000000000001'::uuid, '10000000-1000-4000-8000-000000000001'::uuid, '11000000-0000-4000-8000-000000000102'::uuid, 'review_package_created', '{"reviewId":"fixture-a-review"}'::jsonb),
  ('10000000-7000-4000-8000-000000000007'::uuid, '10000000-0000-4000-8000-000000000001'::uuid, '10000000-1000-4000-8000-000000000001'::uuid, '11000000-0000-4000-8000-000000000102'::uuid, 'project_exported', '{"format":"json"}'::jsonb),
  ('20000000-7000-4000-8000-000000000001'::uuid, '20000000-0000-4000-8000-000000000002'::uuid, '20000000-1000-4000-8000-000000000002'::uuid, '22000000-0000-4000-8000-000000000202'::uuid, 'project_created', '{"client":"Fixture B Client"}'::jsonb),
  ('20000000-7000-4000-8000-000000000002'::uuid, '20000000-0000-4000-8000-000000000002'::uuid, '20000000-1000-4000-8000-000000000002'::uuid, '22000000-0000-4000-8000-000000000202'::uuid, 'design_revision_issued', '{"designRevisionId":"20000000-4000-4000-8000-000000000002"}'::jsonb)
) as a(id, organisation_id, project_id, actor, action, new_fields)
on conflict (id) do nothing;

commit;

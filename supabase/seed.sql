-- Local development fixtures only. Never reuse these accounts or passwords outside a reset local stack.
begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  fixture.id,
  'authenticated',
  'authenticated',
  fixture.email,
  extensions.crypt('Voltflow-Local-Only-2026!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', fixture.display_name),
  now(), now(), '', '', '', ''
from (values
  ('11000000-0000-4000-8000-000000000101'::uuid, 'manager.a@voltflow.local', 'Amina Manager'),
  ('11000000-0000-4000-8000-000000000102'::uuid, 'engineer.a@voltflow.local', 'Eliud Engineer'),
  ('11000000-0000-4000-8000-000000000103'::uuid, 'sales.a@voltflow.local', 'Salma Sales'),
  ('11000000-0000-4000-8000-000000000104'::uuid, 'technician.a@voltflow.local', 'Tito Technician'),
  ('11000000-0000-4000-8000-000000000105'::uuid, 'client.a@voltflow.local', 'Caro Client'),
  ('11000000-0000-4000-8000-000000000106'::uuid, 'bank.a@voltflow.local', 'Bina Bank'),
  ('11000000-0000-4000-8000-000000000107'::uuid, 'revokee.a@voltflow.local', 'Ravi Revocation Fixture'),
  ('22000000-0000-4000-8000-000000000201'::uuid, 'manager.b@voltflow.local', 'Musa Manager'),
  ('22000000-0000-4000-8000-000000000202'::uuid, 'engineer.b@voltflow.local', 'Eva Engineer'),
  ('22000000-0000-4000-8000-000000000203'::uuid, 'sales.b@voltflow.local', 'Sofia Sales'),
  ('22000000-0000-4000-8000-000000000204'::uuid, 'technician.b@voltflow.local', 'Theo Technician'),
  ('22000000-0000-4000-8000-000000000205'::uuid, 'client.b@voltflow.local', 'Chao Client'),
  ('22000000-0000-4000-8000-000000000206'::uuid, 'bank.b@voltflow.local', 'Bella Bank')
) as fixture(id, email, display_name)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  extensions.gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now(), now()
from auth.users u
where u.email like '%.%@voltflow.local'
on conflict (provider_id, provider) do nothing;

insert into public.profiles (user_id, display_name, status)
select id, raw_user_meta_data ->> 'display_name', 'active'
from auth.users
where email like '%.%@voltflow.local'
on conflict (user_id) do update set display_name = excluded.display_name;

insert into public.organisations (id, name, slug, status, data_region, created_by)
values
  ('10000000-0000-4000-8000-000000000001', 'Voltflow Fixture EPC A', 'voltflow-fixture-a', 'active', 'local', '11000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000002', 'Voltflow Fixture EPC B', 'voltflow-fixture-b', 'active', 'local', '22000000-0000-4000-8000-000000000201')
on conflict (id) do nothing;

insert into public.organisation_memberships (
  id, organisation_id, user_id, role, status, accepted_at
)
values
  ('11100000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000101', 'manager', 'active', now()),
  ('11100000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000102', 'engineer', 'active', now()),
  ('11100000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000103', 'sales', 'active', now()),
  ('11100000-0000-4000-8000-000000000104', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000104', 'technician', 'active', now()),
  ('11100000-0000-4000-8000-000000000105', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000105', 'client', 'active', now()),
  ('11100000-0000-4000-8000-000000000106', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000106', 'bank', 'active', now()),
  ('11100000-0000-4000-8000-000000000107', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000107', 'engineer', 'active', now()),
  ('22200000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000201', 'manager', 'active', now()),
  ('22200000-0000-4000-8000-000000000202', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000202', 'engineer', 'active', now()),
  ('22200000-0000-4000-8000-000000000203', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000203', 'sales', 'active', now()),
  ('22200000-0000-4000-8000-000000000204', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000204', 'technician', 'active', now()),
  ('22200000-0000-4000-8000-000000000205', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000205', 'client', 'active', now()),
  ('22200000-0000-4000-8000-000000000206', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000206', 'bank', 'active', now())
on conflict (organisation_id, user_id) do nothing;

insert into public.projects (
  id, organisation_id, project_ref, name, client_name, location, status,
  current_record, revision_no, created_by, updated_by
)
values
  (
    '10000000-1000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'FIX-A-001', 'Fixture A Workshop', 'Fixture A Client', 'Nairobi', 'active',
    '{"name":"Fixture A Workshop","schemaVersion":"11.7","appVersion":"Voltflow 11.7.2b","project":{"client":"Fixture A Client","location":"Nairobi","monthlyBill":120000,"siteType":"commercial","objective":"bill_savings","loadSource":"itemized","delivery":{"tasks":[{"id":"survey-a","title":"Complete field survey","status":"todo","ownerUserId":"11000000-0000-4000-8000-000000000104"}]}},"loads":[{"name":"Workshop motors","qty":2,"watts":2200,"dayHours":5,"nightHours":0}]}'::jsonb,
    1, '11000000-0000-4000-8000-000000000101', '11000000-0000-4000-8000-000000000101'
  ),
  (
    '20000000-1000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'FIX-B-001', 'Fixture B Cold Store', 'Fixture B Client', 'Mombasa', 'active',
    '{"name":"Fixture B Cold Store","schemaVersion":"11.7","appVersion":"Voltflow 11.7.2b","project":{"client":"Fixture B Client","location":"Mombasa","monthlyBill":90000,"siteType":"commercial","objective":"resilience","loadSource":"itemized","delivery":{"tasks":[{"id":"survey-b","title":"Verify cold-room loads","status":"todo","ownerUserId":"22000000-0000-4000-8000-000000000204"}]}},"loads":[{"name":"Cold room","qty":1,"watts":3500,"dayHours":10,"nightHours":10}]}'::jsonb,
    1, '22000000-0000-4000-8000-000000000201', '22000000-0000-4000-8000-000000000201'
  )
on conflict (id) do nothing;

insert into public.project_members (
  id, organisation_id, project_id, user_id, role, assigned_by
)
values
  ('10000000-2000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '10000000-1000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000104', 'technician', '11000000-0000-4000-8000-000000000101'),
  ('20000000-2000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '20000000-1000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000204', 'technician', '22000000-0000-4000-8000-000000000201')
on conflict (organisation_id, project_id, user_id) do nothing;

insert into public.project_versions (
  id, organisation_id, project_id, version_no, lifecycle, snapshot,
  client_snapshot, bank_snapshot, field_snapshot, snapshot_hash,
  client_snapshot_hash, schema_version, app_version, calculation_version,
  report_metadata, created_by, issued_at
)
select
  fixture.version_id, fixture.organisation_id, fixture.project_id, 1, 'issued',
  fixture.full_snapshot, fixture.client_snapshot, fixture.bank_snapshot,
  fixture.field_snapshot,
  encode(extensions.digest(convert_to(fixture.full_snapshot::text, 'UTF8'), 'sha256'), 'hex'),
  encode(extensions.digest(convert_to(fixture.client_snapshot::text, 'UTF8'), 'sha256'), 'hex'),
  '11.7', 'Voltflow 11.7.2b', 'Voltflow 11.7.2b',
  '{"fixture":true,"trustFoundation":"Voltflow 11.8"}'::jsonb,
  fixture.created_by, now()
from (values
  (
    '10000000-3000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000001'::uuid,
    '10000000-1000-4000-8000-000000000001'::uuid,
    '11000000-0000-4000-8000-000000000102'::uuid,
    '{"schemaVersion":"11.7","appVersion":"Voltflow 11.7.2b","project":{"client":"Fixture A Client","location":"Nairobi"},"sizing":{"actualKwp":18,"batteryKwh":24},"financials":{"investment":2100000},"boq":{"supplierCost":1300000,"marginPct":18},"billLoadReconciliation":{"status":"matched"}}'::jsonb,
    '{"project":{"client":"Fixture A Client","location":"Nairobi"},"sizing":{"actualKwp":18,"batteryKwh":24,"totalCost":2100000},"billLoadReconciliation":{"status":"matched","message":"Itemized energy is consistent with the bill estimate."}}'::jsonb,
    '{"project":{"client":"Fixture A Client","location":"Nairobi"},"sizing":{"actualKwp":18,"batteryKwh":24,"totalCost":2100000},"financials":{"debtCase":"subject_to_review"},"billLoadReconciliation":{"status":"matched","message":"Itemized energy is consistent with the bill estimate."}}'::jsonb,
    '{"project":{"client":"Fixture A Client","location":"Nairobi"},"field":{"tasks":["Complete field survey"],"syncStatus":"cloud"}}'::jsonb
  ),
  (
    '20000000-3000-4000-8000-000000000002'::uuid,
    '20000000-0000-4000-8000-000000000002'::uuid,
    '20000000-1000-4000-8000-000000000002'::uuid,
    '22000000-0000-4000-8000-000000000202'::uuid,
    '{"schemaVersion":"11.7","appVersion":"Voltflow 11.7.2b","project":{"client":"Fixture B Client","location":"Mombasa"},"sizing":{"actualKwp":22,"batteryKwh":40},"financials":{"investment":2850000},"boq":{"supplierCost":1700000,"marginPct":19},"billLoadReconciliation":{"status":"under_captured"}}'::jsonb,
    '{"project":{"client":"Fixture B Client","location":"Mombasa"},"sizing":{"actualKwp":22,"batteryKwh":40,"totalCost":2850000},"billLoadReconciliation":{"status":"under_captured","message":"Bill and captured loads require reconciliation before claims are issued."}}'::jsonb,
    '{"project":{"client":"Fixture B Client","location":"Mombasa"},"sizing":{"actualKwp":22,"batteryKwh":40,"totalCost":2850000},"financials":{"debtCase":"subject_to_review"},"billLoadReconciliation":{"status":"under_captured","message":"Bill and captured loads require reconciliation before claims are issued."}}'::jsonb,
    '{"project":{"client":"Fixture B Client","location":"Mombasa"},"field":{"tasks":["Verify cold-room loads"],"syncStatus":"cloud"}}'::jsonb
  )
) as fixture(version_id, organisation_id, project_id, created_by, full_snapshot, client_snapshot, bank_snapshot, field_snapshot)
on conflict (id) do nothing;

update public.projects p
set latest_version_id = fixture.version_id
from (values
  ('10000000-1000-4000-8000-000000000001'::uuid, '10000000-3000-4000-8000-000000000001'::uuid),
  ('20000000-1000-4000-8000-000000000002'::uuid, '20000000-3000-4000-8000-000000000002'::uuid)
) as fixture(project_id, version_id)
where p.id = fixture.project_id;

insert into public.boq_revisions (
  id, organisation_id, project_id, project_version_id, revision_no,
  lines, internal_totals, public_headline, created_by
)
values
  ('10000000-4000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '10000000-1000-4000-8000-000000000001', '10000000-3000-4000-8000-000000000001', 1, '[{"description":"PV modules","qty":32}]', '{"supplierCost":1300000,"marginPct":18}', '{"investment":2100000}', '11000000-0000-4000-8000-000000000102'),
  ('20000000-4000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '20000000-1000-4000-8000-000000000002', '20000000-3000-4000-8000-000000000002', 1, '[{"description":"PV modules","qty":40}]', '{"supplierCost":1700000,"marginPct":19}', '{"investment":2850000}', '22000000-0000-4000-8000-000000000202')
on conflict (id) do nothing;

insert into public.review_submissions (
  id, organisation_id, project_id, project_version_id, status,
  requested_reviewer_id, submitted_by, submitted_at, reviewed_at,
  reason, created_by
)
values
  ('10000000-4500-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '10000000-1000-4000-8000-000000000001', '10000000-3000-4000-8000-000000000001', 'approved', '11000000-0000-4000-8000-000000000102', '11000000-0000-4000-8000-000000000103', now(), now(), 'Local fixture engineering review complete', '11000000-0000-4000-8000-000000000103'),
  ('20000000-4500-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '20000000-1000-4000-8000-000000000002', '20000000-3000-4000-8000-000000000002', 'approved', '22000000-0000-4000-8000-000000000202', '22000000-0000-4000-8000-000000000203', now(), now(), 'Local fixture engineering review complete', '22000000-0000-4000-8000-000000000203')
on conflict (id) do nothing;

insert into public.approvals (
  id, organisation_id, project_id, project_version_id,
  review_submission_id, decision, reason, actor_user_id, actor_role,
  snapshot_hash
)
select
  fixture.approval_id, fixture.organisation_id, fixture.project_id,
  fixture.version_id, fixture.submission_id, 'approved',
  'Local fixture engineering review complete', fixture.actor_user_id,
  'engineer', pv.snapshot_hash
from (values
  ('10000000-4600-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000001'::uuid, '10000000-1000-4000-8000-000000000001'::uuid, '10000000-3000-4000-8000-000000000001'::uuid, '10000000-4500-4000-8000-000000000001'::uuid, '11000000-0000-4000-8000-000000000102'::uuid),
  ('20000000-4600-4000-8000-000000000002'::uuid, '20000000-0000-4000-8000-000000000002'::uuid, '20000000-1000-4000-8000-000000000002'::uuid, '20000000-3000-4000-8000-000000000002'::uuid, '20000000-4500-4000-8000-000000000002'::uuid, '22000000-0000-4000-8000-000000000202'::uuid)
) as fixture(approval_id, organisation_id, project_id, version_id, submission_id, actor_user_id)
join public.project_versions pv on pv.id = fixture.version_id
on conflict (id) do nothing;

insert into public.project_shares (
  id, organisation_id, project_id, project_version_id, shared_with_user_id,
  audience, created_by, expires_at
)
values
  ('10000000-5000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '10000000-1000-4000-8000-000000000001', '10000000-3000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000105', 'client', '11000000-0000-4000-8000-000000000103', now() + interval '30 days'),
  ('10000000-5000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '10000000-1000-4000-8000-000000000001', '10000000-3000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000106', 'bank', '11000000-0000-4000-8000-000000000103', now() + interval '30 days'),
  ('20000000-5000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '20000000-1000-4000-8000-000000000002', '20000000-3000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000205', 'client', '22000000-0000-4000-8000-000000000203', now() + interval '30 days'),
  ('20000000-5000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '20000000-1000-4000-8000-000000000002', '20000000-3000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000206', 'bank', '22000000-0000-4000-8000-000000000203', now() + interval '30 days')
on conflict (id) do nothing;

insert into public.evidence_items (
  id, organisation_id, project_id, project_version_id, kind, title,
  storage_path, mime_type, size_bytes, checksum_sha256, device_captured_at,
  server_received_at, gps_metadata, uploader_user_id, review_status
)
values
  ('10000000-6000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '10000000-1000-4000-8000-000000000001', '10000000-3000-4000-8000-000000000001', 'site_photo', 'Fixture private site photo', '10000000-0000-4000-8000-000000000001/10000000-1000-4000-8000-000000000001/10000000-6000-4000-8000-000000000001/site.jpg', 'image/jpeg', 1024, repeat('a', 64), now(), now(), '{"latitude":-1.2864,"longitude":36.8172,"accuracyMetres":12}', '11000000-0000-4000-8000-000000000104', 'verified'),
  ('20000000-6000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '20000000-1000-4000-8000-000000000002', '20000000-3000-4000-8000-000000000002', 'site_photo', 'Fixture private site photo', '20000000-0000-4000-8000-000000000002/20000000-1000-4000-8000-000000000002/20000000-6000-4000-8000-000000000002/site.jpg', 'image/jpeg', 1024, repeat('b', 64), now(), now(), '{"latitude":-4.0435,"longitude":39.6682,"accuracyMetres":15}', '22000000-0000-4000-8000-000000000204', 'verified')
on conflict (id) do nothing;

commit;

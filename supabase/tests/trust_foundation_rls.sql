begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

-- Manager A can see only Organisation A projects.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000101","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.projects where organisation_id = '10000000-0000-4000-8000-000000000001'),
  1,
  'manager sees own organisation project'
);
select is(
  (select count(*)::integer from public.projects where organisation_id = '20000000-0000-4000-8000-000000000002'),
  0,
  'manager cannot read another organisation project'
);
select throws_ok(
  $$select public.create_cloud_project('20000000-0000-4000-8000-000000000002', 'Cross tenant', null, '{}'::jsonb, '90000000-0000-4000-8000-000000000001')$$,
  '42501',
  'Active organisation membership required',
  'manager cannot create in another organisation'
);

-- Technician gets an assigned field-safe home, not the full project record or BoQ.
select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000104","role":"authenticated"}', true);
select is((select count(*)::integer from public.projects), 0, 'technician cannot select full projects');
select is(
  jsonb_array_length(public.get_technician_home('10000000-0000-4000-8000-000000000001') -> 'projects'),
  1,
  'technician home contains only assigned work'
);
select is((select count(*)::integer from public.boq_revisions), 0, 'technician cannot read commercial BoQ revisions');
select throws_ok(
  $$select public.prepare_evidence_upload('20000000-0000-4000-8000-000000000002', '20000000-1000-4000-8000-000000000002', null, 'site_photo', 'Cross tenant', 'photo.jpg', 'image/jpeg', 1000, now(), '{}'::jsonb, '90000000-0000-4000-8000-000000000002')$$,
  '42501',
  'Evidence upload is not authorized',
  'technician cannot authorize cross-tenant evidence upload'
);

-- Client sees only an explicitly shared, issued, sanitized projection.
select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000105","role":"authenticated"}', true);
select is((select count(*)::integer from public.projects), 0, 'client cannot select mutable project rows');
select is((select count(*)::integer from public.project_versions), 0, 'client cannot select full project versions');
select is((select count(*)::integer from public.boq_revisions), 0, 'client cannot read internal BoQ revisions');
select is(
  (select count(*)::integer from public.list_shared_project_versions('10000000-0000-4000-8000-000000000001', 'client')),
  1,
  'client receives one explicitly shared issued version'
);
select ok(
  not exists (
    select 1
    from public.list_shared_project_versions('10000000-0000-4000-8000-000000000001', 'client') shared
    where public.vf_snapshot_has_commercial_internals(shared.snapshot)
  ),
  'client projection contains no commercial internals'
);
select throws_ok(
  $$select * from public.list_shared_project_versions('10000000-0000-4000-8000-000000000001', 'bank')$$,
  '42501',
  'Shared package audience is not authorized',
  'client cannot request bank projection'
);

-- Manager writes use RPC concurrency and ordinary roles cannot mutate append-only ledgers.
select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000101","role":"authenticated"}', true);
select lives_ok(
  $$select public.update_cloud_project('10000000-0000-4000-8000-000000000001', '10000000-1000-4000-8000-000000000001', 1, null, '{"name":"Fixture A revision 2","project":{"client":"Fixture A Client","location":"Nairobi"}}'::jsonb, 'pgTAP concurrency update', '90000000-0000-4000-8000-000000000003')$$,
  'matching project revision can update'
);
select throws_ok(
  $$select public.update_cloud_project('10000000-0000-4000-8000-000000000001', '10000000-1000-4000-8000-000000000001', 1, null, '{"name":"stale"}'::jsonb, 'stale update', '90000000-0000-4000-8000-000000000004')$$,
  'VF409',
  'Project changed since it was loaded',
  'stale project revision is rejected'
);
select throws_ok(
  $$update public.project_versions set report_metadata = '{"tampered":true}'::jsonb where id = '10000000-3000-4000-8000-000000000001'$$,
  '42501',
  null,
  'ordinary manager cannot update immutable project versions'
);
select throws_ok(
  $$delete from public.audit_events where organisation_id = '10000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'ordinary manager cannot delete audit events'
);

-- Storage object paths are tenant/project/evidence scoped and have no public bucket.
select is(
  (select public from storage.buckets where id = 'project-evidence'),
  false,
  'evidence bucket is private'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('project-evidence', '20000000-0000-4000-8000-000000000002/20000000-1000-4000-8000-000000000002/20000000-6000-4000-8000-000000000002/cross-tenant.jpg')$$,
  '42501',
  null,
  'storage RLS rejects a cross-tenant object path'
);

select * from finish();
rollback;

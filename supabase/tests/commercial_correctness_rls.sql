begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000101","role":"authenticated"}', true);

select lives_ok(
  $$select public.update_cloud_project(
    '10000000-0000-4000-8000-000000000001',
    '10000000-1000-4000-8000-000000000001',
    1,
    null,
    '{"name":"Fixture A commercial","project":{"client":"Fixture A Client","location":"Nairobi","designRevision":{"inputs_hash":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}}'::jsonb,
    'commercial fixture',
    '91000000-0000-4000-8000-000000000001'
  )$$,
  'manager can save the current design hash'
);

select lives_ok(
  $$select public.record_design_revision(
    '10000000-0000-4000-8000-000000000001',
    '10000000-1000-4000-8000-000000000001',
    2,
    'rev_aaaaaaaaaaaaaaaa',
    'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '11.8.0',
    '{"loads":[],"roofFaces":[]}'::jsonb,
    '[{"id":"balanced"}]'::jsonb,
    '91000000-0000-4000-8000-000000000002'
  )$$,
  'manager can record a deterministic design revision'
);

select lives_ok(
  $$select public.create_project_quote(
    '10000000-0000-4000-8000-000000000001',
    '10000000-1000-4000-8000-000000000001',
    (select id from public.design_revisions where revision_id = 'rev_aaaaaaaaaaaaaaaa'),
    'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'Q-FIXTURE-A',
    1,
    'DRAFT',
    'KES',
    '[{"sku":"PV","qty":1,"unit_price":100,"tax_code":"VAT_STANDARD"}]'::jsonb,
    'VF-11.8-01',
    'KE-2026-01',
    '{"subtotal_net":100,"tax":16,"total_gross":116}'::jsonb,
    '91000000-0000-4000-8000-000000000003'
  )$$,
  'manager can record a quote tied to the current design hash'
);

select is((select count(*)::integer from public.design_revisions), 1, 'manager reads own organisation design revisions');
select is((select count(*)::integer from public.quotes), 1, 'manager reads own organisation quotes');

select throws_ok(
  $$select public.record_design_revision(
    '20000000-0000-4000-8000-000000000002',
    '20000000-1000-4000-8000-000000000002',
    1,
    'rev_bbbbbbbbbbbbbbbb',
    'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '11.8.0', '{}'::jsonb, '[]'::jsonb, null
  )$$,
  '42501',
  'Required organisation role is missing',
  'manager cannot record a cross-tenant design revision'
);

select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000104","role":"authenticated"}', true);
select is((select count(*)::integer from public.design_revisions), 1, 'assigned technician can read technical design revision');
select is((select count(*)::integer from public.quotes), 0, 'technician cannot read commercial quotes');

select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000105","role":"authenticated"}', true);
select is((select count(*)::integer from public.design_revisions), 0, 'client cannot read internal design revisions');
select is((select count(*)::integer from public.quotes), 0, 'client cannot read commercial quotes');

select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000101","role":"authenticated"}', true);
select throws_ok(
  $$update public.design_revisions set calculation_version = 'tampered'$$,
  '42501', null, 'design revisions are immutable'
);
select throws_ok(
  $$delete from public.quotes$$,
  '42501', null, 'quote revisions are immutable'
);

select throws_ok(
  $$select public.prepare_project_photo_upload(
    '10000000-0000-4000-8000-000000000001',
    '10000000-1000-4000-8000-000000000001',
    'INVALID', 'Invalid', 'invalid.pdf', 'application/pdf', 1024,
    null, null, null, null, now(), '{}'::jsonb, null
  )$$,
  'VF422', 'Invalid photo type', 'invalid photo type is rejected'
);

select lives_ok(
  $$select public.prepare_project_photo_upload(
    '10000000-0000-4000-8000-000000000001',
    '10000000-1000-4000-8000-000000000001',
    'ROOF', 'East roof', 'east.jpg', 'image/jpeg', 1024,
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    null, 'rf_east', 'East roof before installation', now(), '{}'::jsonb,
    '91000000-0000-4000-8000-000000000004'
  )$$,
  'authorized editor can prepare a typed private photo'
);

select like(
  (select storage_path from public.evidence_items where photo_type = 'ROOF' limit 1),
  '10000000-0000-4000-8000-000000000001/10000000-1000-4000-8000-000000000001/photos/%.jpg',
  'photo object path is tenant/project scoped'
);

select throws_ok(
  $$select public.complete_evidence_upload(
    '10000000-0000-4000-8000-000000000001',
    (select id from public.evidence_items where photo_type = 'ROOF' limit 1),
    'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    1024, null
  )$$,
  'VF422', 'Evidence checksum does not match upload authorization', 'checksum mismatch is rejected'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, metadata)
    select storage_bucket, storage_path, '{"size":"1024","checksum_sha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}'::jsonb
    from public.evidence_items where photo_type = 'ROOF' limit 1$$,
  'matching private storage object can be uploaded'
);

select lives_ok(
  $$select public.complete_evidence_upload(
    '10000000-0000-4000-8000-000000000001',
    (select id from public.evidence_items where photo_type = 'ROOF' limit 1),
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    1024,
    '91000000-0000-4000-8000-000000000005'
  )$$,
  'matching photo checksum and size finalize metadata'
);

select lives_ok(
  $$select * from public.authorize_evidence_delete(
    '10000000-0000-4000-8000-000000000001',
    (select id from public.evidence_items where photo_type = 'ROOF' limit 1),
    'Duplicate survey photo'
  )$$,
  'editor can authorize evidence deletion'
);

select lives_ok(
  $$delete from storage.objects
    where bucket_id = 'project-evidence'
      and name = (select storage_path from public.evidence_items where photo_type = 'ROOF' limit 1)$$,
  'authorized editor can remove private object'
);

select lives_ok(
  $$select public.complete_evidence_delete(
    '10000000-0000-4000-8000-000000000001',
    (select id from public.evidence_items where photo_type = 'ROOF' limit 1),
    'Duplicate survey photo',
    '91000000-0000-4000-8000-000000000006'
  )$$,
  'evidence deletion is soft-recorded after object removal'
);

select is(
  (select count(*)::integer from public.evidence_items where photo_type = 'ROOF'),
  0,
  'soft-deleted photo is hidden by RLS'
);

select throws_ok(
  $$select public.prepare_project_photo_upload(
    '20000000-0000-4000-8000-000000000002',
    '20000000-1000-4000-8000-000000000002',
    'ROOF', 'Cross tenant', 'cross.jpg', 'image/jpeg', 1024,
    null, null, null, null, now(), '{}'::jsonb, null
  )$$,
  '42501', 'Active organisation membership required', 'cross-tenant photo authorization is denied'
);

select throws_ok(
  $$select public.create_project_quote(
    '10000000-0000-4000-8000-000000000001',
    '10000000-1000-4000-8000-000000000001',
    (select id from public.design_revisions where revision_id = 'rev_aaaaaaaaaaaaaaaa'),
    'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    'Q-STALE', 1, 'DRAFT', 'KES', '[{"qty":1}]'::jsonb,
    'VF-11.8-01', 'KE-2026-01', '{"total_gross":1}'::jsonb, null
  )$$,
  'VF409', 'STALE_DESIGN', 'quote creation rejects a stale design hash'
);

select throws_ok(
  $$select public.complete_evidence_upload(
    '10000000-0000-4000-8000-000000000001',
    '10000000-6000-4000-8000-000000000099',
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    1024, null
  )$$,
  'P0002', 'Evidence item not found', 'missing evidence completion returns not found'
);

select * from finish();
rollback;

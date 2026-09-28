begin;

alter table public.evidence_items
  add column photo_type text,
  add column roof_face_id text,
  add column caption text,
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id) on delete restrict,
  add column delete_reason text;

alter table public.evidence_items
  add constraint evidence_items_photo_type_check check (
    photo_type is null or photo_type in (
      'SITE_OVERVIEW', 'ROOF', 'POWER_BOX', 'METER', 'INVERTER_LOCATION',
      'BATTERY_LOCATION', 'EARTHING', 'OTHER'
    )
  ),
  add constraint evidence_items_roof_face_check check (
    roof_face_id is null or photo_type = 'ROOF'
  ),
  add constraint evidence_items_caption_check check (
    caption is null or length(caption) <= 1000
  );

create table public.design_revisions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  project_id uuid not null,
  revision_id text not null check (revision_id ~ '^rev_[0-9a-f]{16}$'),
  inputs_hash text not null check (inputs_hash ~ '^sha256:[0-9a-f]{64}$'),
  calculation_version text not null check (length(trim(calculation_version)) between 1 and 40),
  project_revision_no integer not null check (project_revision_no > 0),
  normalized_inputs jsonb not null,
  sizing_options jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, organisation_id),
  unique (organisation_id, project_id, revision_id),
  unique (organisation_id, project_id, inputs_hash),
  foreign key (project_id, organisation_id)
    references public.projects(id, organisation_id) on delete restrict
);

create index design_revisions_project_idx
  on public.design_revisions (organisation_id, project_id, created_at desc);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  project_id uuid not null,
  design_revision_id uuid not null,
  quote_ref text not null check (length(trim(quote_ref)) between 3 and 80),
  revision_no integer not null check (revision_no > 0),
  status text not null check (status in ('DRAFT', 'ISSUED', 'VOID')),
  currency text not null default 'KES' check (currency ~ '^[A-Z]{3}$'),
  line_items jsonb not null,
  pricing_policy_version text not null,
  tax_rule_version text not null,
  totals jsonb not null,
  inputs_hash text not null check (inputs_hash ~ '^sha256:[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  issued_at timestamptz,
  unique (id, organisation_id),
  unique (organisation_id, quote_ref, revision_no),
  foreign key (project_id, organisation_id)
    references public.projects(id, organisation_id) on delete restrict,
  foreign key (design_revision_id, organisation_id)
    references public.design_revisions(id, organisation_id) on delete restrict,
  check ((status = 'ISSUED' and issued_at is not null) or (status <> 'ISSUED' and issued_at is null))
);

create index quotes_project_idx
  on public.quotes (organisation_id, project_id, created_at desc);

create table public.inventory_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  asset_id text not null check (length(trim(asset_id)) between 2 and 120),
  provider text not null check (provider in ('MANUAL', 'ZOHO_INVENTORY')),
  external_item_id text,
  sku text,
  warehouse_id text,
  qty_available numeric(18, 4),
  sales_rate numeric(18, 4),
  purchase_rate numeric(18, 4),
  synced_at timestamptz,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, asset_id, provider, warehouse_id)
);

create index inventory_links_asset_idx
  on public.inventory_links (organisation_id, asset_id, active);

alter table public.design_revisions enable row level security;
alter table public.quotes enable row level security;
alter table public.inventory_links enable row level security;
alter table public.design_revisions force row level security;
alter table public.quotes force row level security;
alter table public.inventory_links force row level security;

create policy design_revisions_internal_select
on public.design_revisions for select to authenticated
using (
  public.vf_has_role(
    organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  )
  or public.vf_is_project_assignee(organisation_id, project_id)
);

create policy quotes_internal_select
on public.quotes for select to authenticated
using (
  public.vf_has_role(
    organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  )
);

create policy inventory_links_internal_select
on public.inventory_links for select to authenticated
using (
  public.vf_has_role(
    organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  )
);

revoke all on table public.design_revisions from anon, authenticated;
revoke all on table public.quotes from anon, authenticated;
revoke all on table public.inventory_links from anon, authenticated;
grant select on table public.design_revisions to authenticated;
grant select on table public.quotes to authenticated;
grant select on table public.inventory_links to authenticated;

create trigger design_revisions_append_only
before update or delete on public.design_revisions
for each row execute function public.vf_reject_immutable_change();

create trigger quotes_append_only
before update or delete on public.quotes
for each row execute function public.vf_reject_immutable_change();

create or replace function public.record_design_revision(
  p_organisation_id uuid,
  p_project_id uuid,
  p_project_revision_no integer,
  p_revision_id text,
  p_inputs_hash text,
  p_calculation_version text,
  p_normalized_inputs jsonb,
  p_sizing_options jsonb default '[]'::jsonb,
  p_request_id uuid default null
)
returns public.design_revisions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.projects;
  v_revision public.design_revisions;
begin
  perform public.vf_assert_role(
    p_organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  );
  select * into v_project from public.projects
  where id = p_project_id and organisation_id = p_organisation_id and archived_at is null;
  if not found then raise exception using errcode = 'P0002', message = 'Project not found'; end if;
  if v_project.revision_no <> p_project_revision_no then
    raise exception using errcode = 'VF409', message = 'STALE_PROJECT';
  end if;
  if p_inputs_hash !~ '^sha256:[0-9a-f]{64}$' or p_revision_id !~ '^rev_[0-9a-f]{16}$' then
    raise exception using errcode = 'VF422', message = 'Invalid deterministic design identity';
  end if;
  insert into public.design_revisions (
    organisation_id, project_id, revision_id, inputs_hash, calculation_version,
    project_revision_no, normalized_inputs, sizing_options, created_by
  ) values (
    p_organisation_id, p_project_id, p_revision_id, p_inputs_hash,
    p_calculation_version, p_project_revision_no, p_normalized_inputs,
    coalesce(p_sizing_options, '[]'::jsonb), auth.uid()
  )
  on conflict (organisation_id, project_id, inputs_hash) do nothing
  returning * into v_revision;
  if v_revision.id is null then
    select * into v_revision from public.design_revisions
    where organisation_id = p_organisation_id
      and project_id = p_project_id
      and inputs_hash = p_inputs_hash;
  else
    perform public.append_audit_event(
      p_organisation_id, p_project_id, null, 'design.revision_recorded',
      '{}'::jsonb,
      jsonb_build_object('design_revision_id', v_revision.id, 'revision_id', p_revision_id, 'inputs_hash', p_inputs_hash, 'calculation_version', p_calculation_version),
      p_request_id, 'Deterministic design revision recorded'
    );
  end if;
  return v_revision;
end;
$$;

create or replace function public.create_project_quote(
  p_organisation_id uuid,
  p_project_id uuid,
  p_design_revision_id uuid,
  p_expected_inputs_hash text,
  p_quote_ref text,
  p_revision_no integer,
  p_status text,
  p_currency text,
  p_line_items jsonb,
  p_pricing_policy_version text,
  p_tax_rule_version text,
  p_totals jsonb,
  p_request_id uuid default null
)
returns public.quotes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.projects;
  v_design public.design_revisions;
  v_quote public.quotes;
  v_current_hash text;
begin
  perform public.vf_assert_role(
    p_organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  );
  select * into v_project from public.projects
  where id = p_project_id and organisation_id = p_organisation_id and archived_at is null;
  if not found then raise exception using errcode = 'P0002', message = 'Project not found'; end if;
  select * into v_design from public.design_revisions
  where id = p_design_revision_id and project_id = p_project_id and organisation_id = p_organisation_id;
  if not found then raise exception using errcode = 'VF422', message = 'Design revision does not belong to project'; end if;
  v_current_hash := v_project.current_record #>> '{project,designRevision,inputs_hash}';
  if v_design.inputs_hash <> p_expected_inputs_hash
     or v_current_hash is distinct from p_expected_inputs_hash then
    raise exception using errcode = 'VF409', message = 'STALE_DESIGN';
  end if;
  if p_status not in ('DRAFT', 'ISSUED', 'VOID') then
    raise exception using errcode = 'VF422', message = 'Invalid quote status';
  end if;
  if jsonb_typeof(p_line_items) <> 'array' or jsonb_array_length(p_line_items) = 0 then
    raise exception using errcode = 'VF422', message = 'Quote requires line items';
  end if;
  insert into public.quotes (
    organisation_id, project_id, design_revision_id, quote_ref, revision_no,
    status, currency, line_items, pricing_policy_version, tax_rule_version,
    totals, inputs_hash, created_by, issued_at
  ) values (
    p_organisation_id, p_project_id, p_design_revision_id, trim(p_quote_ref), p_revision_no,
    p_status, upper(p_currency), p_line_items, p_pricing_policy_version, p_tax_rule_version,
    p_totals, p_expected_inputs_hash, auth.uid(), case when p_status = 'ISSUED' then now() else null end
  ) returning * into v_quote;
  perform public.append_audit_event(
    p_organisation_id, p_project_id, null,
    case when p_status = 'ISSUED' then 'quote.issued' else 'quote.created' end,
    '{}'::jsonb,
    jsonb_build_object('quote_id', v_quote.id, 'quote_ref', v_quote.quote_ref, 'revision_no', v_quote.revision_no, 'status', v_quote.status, 'inputs_hash', v_quote.inputs_hash),
    p_request_id, 'Versioned project quote recorded'
  );
  return v_quote;
end;
$$;

create or replace function public.prepare_project_photo_upload(
  p_organisation_id uuid,
  p_project_id uuid,
  p_photo_type text,
  p_title text,
  p_filename text,
  p_mime_type text,
  p_size_bytes bigint,
  p_expected_checksum_sha256 text default null,
  p_project_version_id uuid default null,
  p_roof_face_id text default null,
  p_caption text default null,
  p_device_captured_at timestamptz default null,
  p_gps_metadata jsonb default '{}'::jsonb,
  p_request_id uuid default null
)
returns public.evidence_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.organisation_role;
  v_evidence public.evidence_items;
  v_id uuid := gen_random_uuid();
  v_extension text;
  v_path text;
begin
  v_role := public.vf_current_role(p_organisation_id);
  if v_role is null then raise exception using errcode = '42501', message = 'Active organisation membership required'; end if;
  if v_role not in ('manager', 'engineer')
     and not (v_role = 'technician' and public.vf_is_project_assignee(p_organisation_id, p_project_id)) then
    raise exception using errcode = '42501', message = 'Photo upload is not authorized';
  end if;
  if not exists (select 1 from public.projects where id = p_project_id and organisation_id = p_organisation_id and archived_at is null) then
    raise exception using errcode = 'P0002', message = 'Project not found';
  end if;
  if p_project_version_id is not null and not exists (
    select 1 from public.project_versions
    where id = p_project_version_id and project_id = p_project_id and organisation_id = p_organisation_id
  ) then
    raise exception using errcode = 'VF422', message = 'Evidence version does not belong to project';
  end if;
  if p_photo_type not in (
    'SITE_OVERVIEW', 'ROOF', 'POWER_BOX', 'METER', 'INVERTER_LOCATION',
    'BATTERY_LOCATION', 'EARTHING', 'OTHER'
  ) then raise exception using errcode = 'VF422', message = 'Invalid photo type'; end if;
  if p_photo_type <> 'ROOF' and p_roof_face_id is not null then
    raise exception using errcode = 'VF422', message = 'Roof face can only be assigned to a roof photo';
  end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception using errcode = 'VF422', message = 'Photo MIME type is not allowed';
  end if;
  if p_size_bytes < 1 or p_size_bytes > 26214400 then
    raise exception using errcode = 'VF422', message = 'Photo file size is outside the allowed range';
  end if;
  if p_expected_checksum_sha256 is not null and p_expected_checksum_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'VF422', message = 'Expected photo checksum must be SHA-256 hex';
  end if;
  if length(coalesce(p_caption, '')) > 1000 then
    raise exception using errcode = 'VF422', message = 'Photo caption is too long';
  end if;
  v_extension := case p_mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else 'webp' end;
  v_path := p_organisation_id::text || '/' || p_project_id::text || '/photos/' || v_id::text || '.' || v_extension;
  insert into public.evidence_items (
    id, organisation_id, project_id, project_version_id, kind, title,
    storage_path, mime_type, size_bytes, device_captured_at, gps_metadata,
    uploader_user_id, review_status, photo_type, roof_face_id, caption, checksum_sha256
  ) values (
    v_id, p_organisation_id, p_project_id, p_project_version_id, 'site_photo',
    coalesce(nullif(trim(p_title), ''), public.vf_safe_filename(p_filename)),
    v_path, p_mime_type, p_size_bytes, p_device_captured_at,
    coalesce(p_gps_metadata, '{}'::jsonb), auth.uid(), 'pending_upload',
    p_photo_type, nullif(trim(p_roof_face_id), ''), nullif(trim(p_caption), ''), p_expected_checksum_sha256
  ) returning * into v_evidence;
  perform public.append_audit_event(
    p_organisation_id, p_project_id, p_project_version_id, 'photo.upload_authorized',
    '{}'::jsonb,
    jsonb_build_object('evidence_id', v_id, 'photo_type', p_photo_type, 'roof_face_id', p_roof_face_id, 'size_bytes', p_size_bytes, 'mime_type', p_mime_type),
    p_request_id, 'Private project photo upload authorized'
  );
  return v_evidence;
end;
$$;

create or replace function public.complete_evidence_upload(
  p_organisation_id uuid,
  p_evidence_id uuid,
  p_checksum_sha256 text,
  p_size_bytes bigint,
  p_request_id uuid default null
)
returns public.evidence_items
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_evidence public.evidence_items;
  v_object_size bigint;
  v_object_checksum text;
  v_expected_checksum text;
begin
  select * into v_evidence from public.evidence_items
  where id = p_evidence_id and organisation_id = p_organisation_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Evidence item not found'; end if;
  if v_evidence.review_status <> 'pending_upload' then
    raise exception using errcode = 'VF409', message = 'Evidence upload is already finalized';
  end if;
  if auth.uid() <> v_evidence.uploader_user_id
     and not public.vf_has_role(p_organisation_id, array['manager', 'engineer']::public.organisation_role[]) then
    raise exception using errcode = '42501', message = 'Evidence finalization is not authorized';
  end if;
  if p_checksum_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'VF422', message = 'Evidence checksum must be SHA-256 hex';
  end if;
  v_expected_checksum := v_evidence.checksum_sha256;
  if v_expected_checksum is not null and v_expected_checksum <> p_checksum_sha256 then
    raise exception using errcode = 'VF422', message = 'Evidence checksum does not match upload authorization';
  end if;
  select
    nullif(metadata ->> 'size', '')::bigint,
    coalesce(metadata ->> 'checksum_sha256', metadata #>> '{metadata,checksum_sha256}')
  into v_object_size, v_object_checksum
  from storage.objects
  where bucket_id = 'project-evidence' and name = v_evidence.storage_path
  limit 1;
  if not found then raise exception using errcode = 'VF409', message = 'Evidence object has not been uploaded'; end if;
  if p_size_bytes <> v_evidence.size_bytes
     or (v_object_size is not null and v_object_size <> v_evidence.size_bytes) then
    raise exception using errcode = 'VF422', message = 'Evidence size does not match upload authorization';
  end if;
  if v_object_checksum is not null and v_object_checksum <> p_checksum_sha256 then
    raise exception using errcode = 'VF422', message = 'Uploaded object checksum does not match completion request';
  end if;
  update public.evidence_items set
    checksum_sha256 = p_checksum_sha256,
    server_received_at = now(),
    review_status = 'submitted',
    updated_at = now()
  where id = p_evidence_id and organisation_id = p_organisation_id
  returning * into v_evidence;
  perform public.append_audit_event(
    p_organisation_id, v_evidence.project_id, v_evidence.project_version_id,
    'evidence.upload_completed',
    jsonb_build_object('review_status', 'pending_upload'),
    jsonb_build_object('evidence_id', p_evidence_id, 'review_status', 'submitted', 'checksum_sha256', p_checksum_sha256),
    p_request_id, 'Evidence upload finalized'
  );
  return v_evidence;
end;
$$;

create or replace function public.authorize_evidence_delete(
  p_organisation_id uuid,
  p_evidence_id uuid,
  p_reason text default null
)
returns table (id uuid, storage_path text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_evidence public.evidence_items;
begin
  select * into v_evidence from public.evidence_items
  where evidence_items.id = p_evidence_id
    and evidence_items.organisation_id = p_organisation_id
    and deleted_at is null;
  if not found then raise exception using errcode = 'P0002', message = 'Active evidence item not found'; end if;
  if not public.vf_has_role(p_organisation_id, array['manager', 'engineer']::public.organisation_role[])
     and not (
       v_evidence.uploader_user_id = auth.uid()
       and v_evidence.review_status in ('pending_upload', 'submitted', 'rejected')
       and v_evidence.project_version_id is null
     ) then
    raise exception using errcode = '42501', message = 'Evidence deletion is not authorized';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception using errcode = 'VF422', message = 'Evidence deletion requires a reason';
  end if;
  if v_evidence.project_version_id is not null and exists (
    select 1 from public.project_versions pv
    where pv.id = v_evidence.project_version_id
      and pv.organisation_id = p_organisation_id
      and pv.lifecycle = 'issued'
  ) then
    raise exception using errcode = 'VF409', message = 'Evidence attached to an issued version cannot be deleted';
  end if;
  return query select v_evidence.id, v_evidence.storage_path;
end;
$$;

create or replace function public.complete_evidence_delete(
  p_organisation_id uuid,
  p_evidence_id uuid,
  p_reason text,
  p_request_id uuid default null
)
returns public.evidence_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_evidence public.evidence_items;
  v_old_status public.evidence_review_status;
begin
  perform * from public.authorize_evidence_delete(p_organisation_id, p_evidence_id, p_reason);
  if exists (
    select 1 from storage.objects o
    join public.evidence_items e on e.storage_path = o.name and e.storage_bucket = o.bucket_id
    where e.id = p_evidence_id and e.organisation_id = p_organisation_id
  ) then
    raise exception using errcode = 'VF409', message = 'Private evidence object must be removed before deletion is finalized';
  end if;
  select review_status into v_old_status from public.evidence_items
  where id = p_evidence_id and organisation_id = p_organisation_id;
  update public.evidence_items set
    deleted_at = now(),
    deleted_by = auth.uid(),
    delete_reason = trim(p_reason),
    review_status = 'superseded',
    updated_at = now()
  where id = p_evidence_id and organisation_id = p_organisation_id and deleted_at is null
  returning * into v_evidence;
  perform public.append_audit_event(
    p_organisation_id, v_evidence.project_id, v_evidence.project_version_id, 'evidence.deleted',
    jsonb_build_object('evidence_id', p_evidence_id, 'review_status', v_old_status),
    jsonb_build_object('evidence_id', p_evidence_id, 'deleted_at', v_evidence.deleted_at),
    p_request_id, p_reason
  );
  return v_evidence;
end;
$$;

create or replace function public.vf_storage_photo_id(p_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_part text;
begin
  v_part := split_part((string_to_array(p_name, '/'))[4], '.', 1);
  if v_part is null or v_part !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_part::uuid;
end;
$$;

drop policy evidence_items_authorized_select on public.evidence_items;
create policy evidence_items_authorized_select
on public.evidence_items for select to authenticated
using (
  deleted_at is null
  and (
    public.vf_has_role(
      organisation_id,
      array['manager', 'engineer']::public.organisation_role[]
    )
    or public.vf_is_project_assignee(organisation_id, project_id)
  )
);

drop policy evidence_objects_insert on storage.objects;
create policy evidence_objects_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-evidence'
  and public.vf_is_active_member(public.vf_storage_path_uuid(name, 1))
  and (
    public.vf_has_role(
      public.vf_storage_path_uuid(name, 1),
      array['manager', 'engineer']::public.organisation_role[]
    )
    or public.vf_is_project_assignee(
      public.vf_storage_path_uuid(name, 1),
      public.vf_storage_path_uuid(name, 2)
    )
  )
  and exists (
    select 1 from public.evidence_items e
    where e.id = coalesce(public.vf_storage_path_uuid(name, 3), public.vf_storage_photo_id(name))
      and e.organisation_id = public.vf_storage_path_uuid(name, 1)
      and e.project_id = public.vf_storage_path_uuid(name, 2)
      and e.storage_path = name
      and e.review_status = 'pending_upload'
      and e.deleted_at is null
  )
);

drop policy evidence_objects_select on storage.objects;
create policy evidence_objects_select
on storage.objects for select to authenticated
using (
  bucket_id = 'project-evidence'
  and exists (
    select 1 from public.evidence_items e
    where e.storage_path = name
      and e.deleted_at is null
      and e.organisation_id = public.vf_storage_path_uuid(name, 1)
      and e.project_id = public.vf_storage_path_uuid(name, 2)
      and (
        public.vf_has_role(
          e.organisation_id,
          array['manager', 'engineer']::public.organisation_role[]
        )
        or public.vf_is_project_assignee(e.organisation_id, e.project_id)
        or (
          e.review_status = 'verified'
          and e.project_version_id is not null
          and public.vf_has_active_share(e.organisation_id, e.project_version_id, null)
        )
      )
  )
);

create policy evidence_objects_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'project-evidence'
  and exists (
    select 1 from public.evidence_items e
    where e.storage_path = name
      and e.deleted_at is null
      and (
        public.vf_has_role(e.organisation_id, array['manager', 'engineer']::public.organisation_role[])
        or (
          e.uploader_user_id = auth.uid()
          and e.review_status in ('pending_upload', 'submitted', 'rejected')
          and e.project_version_id is null
        )
      )
  )
);

revoke all on function public.record_design_revision(uuid, uuid, integer, text, text, text, jsonb, jsonb, uuid) from public, anon;
revoke all on function public.create_project_quote(uuid, uuid, uuid, text, text, integer, text, text, jsonb, text, text, jsonb, uuid) from public, anon;
revoke all on function public.prepare_project_photo_upload(uuid, uuid, text, text, text, text, bigint, text, uuid, text, text, timestamptz, jsonb, uuid) from public, anon;
revoke all on function public.authorize_evidence_delete(uuid, uuid, text) from public, anon;
revoke all on function public.complete_evidence_delete(uuid, uuid, text, uuid) from public, anon;
revoke all on function public.vf_storage_photo_id(text) from public, anon;

grant execute on function public.record_design_revision(uuid, uuid, integer, text, text, text, jsonb, jsonb, uuid) to authenticated;
grant execute on function public.create_project_quote(uuid, uuid, uuid, text, text, integer, text, text, jsonb, text, text, jsonb, uuid) to authenticated;
grant execute on function public.prepare_project_photo_upload(uuid, uuid, text, text, text, text, bigint, text, uuid, text, text, timestamptz, jsonb, uuid) to authenticated;
grant execute on function public.authorize_evidence_delete(uuid, uuid, text) to authenticated;
grant execute on function public.complete_evidence_delete(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.vf_storage_photo_id(text) to authenticated;

commit;

begin;

create or replace function public.vf_assert_role(
  p_organisation_id uuid,
  p_roles public.organisation_role[]
)
returns public.organisation_role
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.organisation_role;
begin
  v_role := public.vf_current_role(p_organisation_id);
  if v_role is null then
    raise exception using errcode = '42501', message = 'Active organisation membership required';
  end if;
  if not (v_role = any(p_roles)) then
    raise exception using errcode = '42501', message = 'Organisation role is not authorized for this action';
  end if;
  return v_role;
end;
$$;

create or replace function public.vf_changed_top_keys(p_old jsonb, p_new jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(key order by key), '[]'::jsonb)
  from (
    select key from jsonb_object_keys(coalesce(p_old, '{}'::jsonb)) key
    union
    select key from jsonb_object_keys(coalesce(p_new, '{}'::jsonb)) key
  ) keys
  where coalesce(p_old, '{}'::jsonb) -> key is distinct from coalesce(p_new, '{}'::jsonb) -> key
$$;

create or replace function public.vf_snapshot_has_commercial_internals(p_snapshot jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(coalesce(p_snapshot, '{}'::jsonb)::text) ~
    '"(supplier_cost|suppliercost|internal_cost|internalcost|margin_pct|marginpct|markup_pct|markuppct|cost_breakdown|costbreakdown|bos_breakdown|bosbreakdown)"[[:space:]]*:'
$$;

create or replace function public.vf_json_has_secret_keys(p_value jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(coalesce(p_value, '{}'::jsonb)::text) ~
    '"(password|passwd|authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|secret|private[_-]?key)"[[:space:]]*:'
$$;

create or replace function public.vf_json_keys_allowed(p_value jsonb, p_allowed text[])
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_value is null or p_value = 'null'::jsonb then true
    when jsonb_typeof(p_value) <> 'object' then false
    else not exists (
      select 1 from jsonb_object_keys(p_value) key
      where not (key = any(p_allowed))
    )
  end
$$;

create or replace function public.vf_audience_snapshot_is_safe(
  p_snapshot jsonb,
  p_audience text
)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_fact record;
  v_load jsonb;
begin
  if jsonb_typeof(p_snapshot) <> 'object'
     or public.vf_snapshot_has_commercial_internals(p_snapshot)
     or p_snapshot ->> 'audience' is distinct from p_audience then
    return false;
  end if;

  if p_audience = 'technician' then
    if not public.vf_json_keys_allowed(p_snapshot, array[
      'snapshotSchema', 'projectRef', 'audience', 'project', 'survey',
      'loads', 'delivery', 'evidenceStatus'
    ])
    or not public.vf_json_keys_allowed(p_snapshot -> 'project', array[
      'client', 'location', 'county', 'siteType', 'systemType', 'phase'
    ])
    or not public.vf_json_keys_allowed(p_snapshot -> 'survey', array[
      'siteAddress', 'county', 'roofType', 'roofAreaM2', 'roofCondition',
      'mainBreakerA', 'earthingAvailable', 'siteNotes', 'photos',
      'assumptionStatus', 'confirmedFields'
    ])
    or not public.vf_json_keys_allowed(p_snapshot -> 'delivery', array[
      'stage', 'expectedStartDate', 'expectedCompletionDate', 'tasks', 'checklist'
    ]) then
      return false;
    end if;
    if jsonb_typeof(coalesce(p_snapshot -> 'loads', '[]'::jsonb)) <> 'array' then return false; end if;
    for v_load in select value from jsonb_array_elements(coalesce(p_snapshot -> 'loads', '[]'::jsonb)) loop
      if not public.vf_json_keys_allowed(v_load, array[
        'id', 'name', 'category', 'qty', 'ratedW', 'phase', 'dayHours',
        'nightHours', 'essential', 'backupRequired'
      ]) then return false; end if;
    end loop;
    return true;
  end if;

  if p_audience not in ('client', 'bank')
     or not public.vf_json_keys_allowed(p_snapshot, array[
       'snapshotSchema', 'projectRef', 'versionLabel', 'issuedAt', 'audience',
       'project', 'survey', 'sizing', 'financials', 'boq', 'evidenceStatus',
       'reportMetadata', 'billLoadReconciliation'
     ])
     or not public.vf_json_keys_allowed(p_snapshot -> 'project', array[
       'client', 'location', 'county', 'siteType', 'systemType', 'phase',
       'designStage', 'objective', 'monthlyBill', 'preparedBy'
     ])
     or not public.vf_json_keys_allowed(p_snapshot -> 'survey', array[
       'clientName', 'siteAddress', 'county', 'siteType', 'phaseType',
       'facts'
     ])
     or not public.vf_json_keys_allowed(p_snapshot -> 'sizing', array[
       'panels', 'actualKwp', 'batteryKwh', 'batteryModules', 'inverterKw',
       'annualEnergy', 'annualEnergyP90', 'autonomyHours', 'totalCost',
       'annualSavings', 'annualSavingsP90', 'monthlySavings', 'payback', 'lcoe'
     ])
     or not public.vf_json_keys_allowed(p_snapshot -> 'financials', array[
       'totalInvestment', 'annualSavings', 'paybackYears', 'lcoeKesPerKwh'
     ])
     or not public.vf_json_keys_allowed(p_snapshot -> 'boq', array['headline'])
     or not public.vf_json_keys_allowed(p_snapshot #> '{boq,headline}', array[
       'totalInvestment', 'investment', 'total', 'currency', 'summary'
     ])
     or not public.vf_json_keys_allowed(p_snapshot -> 'evidenceStatus', array[
       'status', 'verifiedCount', 'requiredCount', 'missingCount'
     ])
     or not public.vf_json_keys_allowed(p_snapshot -> 'reportMetadata', array[
       'reportType', 'generatedAt', 'methodologyVersion', 'disclaimer'
     ])
     or not public.vf_json_keys_allowed(p_snapshot -> 'billLoadReconciliation', array[
       'status', 'mismatchResolved', 'capturedLoadCoveragePct',
       'savingsPctOfBill', 'message'
     ]) then
    return false;
  end if;

  if jsonb_typeof(coalesce(p_snapshot #> '{survey,facts}', '{}'::jsonb)) <> 'object' then return false; end if;
  for v_fact in select key, value from jsonb_each(coalesce(p_snapshot #> '{survey,facts}', '{}'::jsonb)) loop
    if not (v_fact.key = any(array['roofType', 'roofAreaM2', 'roofCondition', 'mainBreakerA', 'earthingAvailable']))
       or not public.vf_json_keys_allowed(v_fact.value, array['value', 'status', 'label'])
       or coalesce(v_fact.value ->> 'status', '') not in ('confirmed', 'assumption') then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.vf_safe_filename(p_filename text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select left(
    coalesce(
      nullif(
        regexp_replace(
          regexp_replace(regexp_replace(replace(coalesce(p_filename, 'evidence.bin'), E'\\', '/'), '^.*/', ''), '^\.+', ''),
          '[^a-zA-Z0-9._-]+', '_', 'g'
        ),
        ''
      ),
      'evidence.bin'
    ),
    120
  )
$$;

create or replace function public.append_audit_event(
  p_organisation_id uuid,
  p_project_id uuid,
  p_project_version_id uuid,
  p_action text,
  p_old_fields jsonb default '{}'::jsonb,
  p_new_fields jsonb default '{}'::jsonb,
  p_request_id uuid default null,
  p_reason text default null
)
returns public.audit_events
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_role public.organisation_role;
  v_event public.audit_events;
  v_existing public.audit_events;
  v_previous_hash text;
  v_event_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_material text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  v_role := public.vf_current_role(p_organisation_id);
  if v_role is null then
    raise exception using errcode = '42501', message = 'Active organisation membership required';
  end if;
  if length(coalesce(p_action, '')) < 3 or p_action !~ '^[a-z0-9_.-]{3,100}$' then
    raise exception using errcode = 'VF422', message = 'Invalid audit action';
  end if;
  if v_role = 'technician' and p_action !~ '^(evidence|field|task)\.' then
    raise exception using errcode = '42501', message = 'Technician audit action is outside field scope';
  end if;
  if v_role in ('client', 'bank') and p_action !~ '^package\.(accessed|downloaded)$' then
    raise exception using errcode = '42501', message = 'External viewer audit action is not allowed';
  end if;
  if p_project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.organisation_id = p_organisation_id
  ) then
    raise exception using errcode = 'VF422', message = 'Project does not belong to organisation';
  end if;
  if p_project_version_id is not null and not exists (
    select 1 from public.project_versions pv
    where pv.id = p_project_version_id
      and pv.organisation_id = p_organisation_id
      and (p_project_id is null or pv.project_id = p_project_id)
  ) then
    raise exception using errcode = 'VF422', message = 'Project version does not belong to project';
  end if;
  if v_role = 'technician' and (
    p_project_id is null
    or not public.vf_is_project_assignee(p_organisation_id, p_project_id)
  ) then
    raise exception using errcode = '42501', message = 'Technician audit event requires an assigned project';
  end if;
  if v_role in ('client', 'bank') and (
    p_project_version_id is null
    or not public.vf_has_active_share(
      p_organisation_id,
      p_project_version_id,
      v_role::text::public.share_audience
    )
    or coalesce(p_old_fields, '{}'::jsonb) <> '{}'::jsonb
    or coalesce(p_new_fields, '{}'::jsonb) <> '{}'::jsonb
  ) then
    raise exception using errcode = '42501', message = 'External access event requires an active share and empty field payloads';
  end if;
  if pg_column_size(coalesce(p_old_fields, '{}'::jsonb)) > 32768
     or pg_column_size(coalesce(p_new_fields, '{}'::jsonb)) > 32768 then
    raise exception using errcode = 'VF422', message = 'Audit field payload is too large';
  end if;
  if public.vf_json_has_secret_keys(p_old_fields)
     or public.vf_json_has_secret_keys(p_new_fields) then
    raise exception using errcode = 'VF422', message = 'Audit fields contain a prohibited secret-like key';
  end if;

  if p_request_id is not null then
    select * into v_existing
    from public.audit_events ae
    where ae.organisation_id = p_organisation_id
      and ae.request_id = p_request_id
      and ae.action = p_action
    limit 1;
    if found then return v_existing; end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_organisation_id::text || ':' || coalesce(p_project_id::text, 'organisation'), 0
  ));
  select ae.event_hash into v_previous_hash
  from public.audit_events ae
  where ae.organisation_id = p_organisation_id
    and ae.project_id is not distinct from p_project_id
  order by ae.created_at desc, ae.id desc
  limit 1;

  v_material := concat_ws('|',
    coalesce(v_previous_hash, ''), v_event_id::text, p_organisation_id::text,
    coalesce(p_project_id::text, ''), coalesce(p_project_version_id::text, ''),
    auth.uid()::text, v_role::text, p_action, coalesce(p_old_fields, '{}'::jsonb)::text,
    coalesce(p_new_fields, '{}'::jsonb)::text, coalesce(p_request_id::text, ''),
    coalesce(p_reason, ''), v_now::text
  );

  insert into public.audit_events (
    id, organisation_id, project_id, project_version_id, actor_user_id,
    actor_role, action, old_fields, new_fields, request_id, reason,
    occurred_at, created_at, previous_event_hash, event_hash
  ) values (
    v_event_id, p_organisation_id, p_project_id, p_project_version_id, auth.uid(),
    v_role, p_action, coalesce(p_old_fields, '{}'::jsonb),
    coalesce(p_new_fields, '{}'::jsonb), p_request_id, nullif(trim(p_reason), ''),
    v_now, v_now, v_previous_hash,
    encode(digest(convert_to(v_material, 'UTF8'), 'sha256'), 'hex')
  ) returning * into v_event;
  return v_event;
end;
$$;

create or replace function public.create_cloud_project(
  p_organisation_id uuid,
  p_name text,
  p_project_ref text,
  p_record jsonb,
  p_request_id uuid default null
)
returns public.projects
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_project public.projects;
  v_existing_id uuid;
  v_base_ref text;
  v_ref text;
  v_suffix integer := 1;
begin
  perform public.vf_assert_role(
    p_organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  );
  if jsonb_typeof(p_record) <> 'object' then
    raise exception using errcode = 'VF422', message = 'Project record must be a JSON object';
  end if;
  if p_request_id is not null then
    select (ae.new_fields ->> 'project_id')::uuid into v_existing_id
    from public.audit_events ae
    where ae.organisation_id = p_organisation_id
      and ae.request_id = p_request_id
      and ae.action = 'project.created'
    limit 1;
    if v_existing_id is not null then
      select * into v_project from public.projects where id = v_existing_id;
      return v_project;
    end if;
  end if;

  v_base_ref := upper(regexp_replace(coalesce(nullif(trim(p_project_ref), ''), 'SOL-' || substr(gen_random_uuid()::text, 1, 8)), '[^A-Z0-9-]+', '-', 'g'));
  v_base_ref := left(trim(both '-' from v_base_ref), 70);
  if length(v_base_ref) < 3 then v_base_ref := 'SOL-' || upper(substr(gen_random_uuid()::text, 1, 8)); end if;
  v_ref := v_base_ref;
  while exists (select 1 from public.projects where organisation_id = p_organisation_id and project_ref = v_ref) loop
    v_suffix := v_suffix + 1;
    v_ref := left(v_base_ref, 70 - length(v_suffix::text)) || '-' || v_suffix::text;
  end loop;

  insert into public.projects (
    organisation_id, project_ref, name, client_name, location, status,
    current_record, revision_no, created_by, updated_by
  ) values (
    p_organisation_id, v_ref, coalesce(nullif(trim(p_name), ''), 'Untitled project'),
    nullif(p_record #>> '{project,client}', ''),
    nullif(p_record #>> '{project,location}', ''),
    'draft', p_record, 1, auth.uid(), auth.uid()
  ) returning * into v_project;

  perform public.append_audit_event(
    p_organisation_id, v_project.id, null, 'project.created', '{}'::jsonb,
    jsonb_build_object('project_id', v_project.id, 'project_ref', v_project.project_ref, 'revision_no', 1),
    p_request_id, 'Cloud project created'
  );
  return v_project;
end;
$$;

create or replace function public.update_cloud_project(
  p_organisation_id uuid,
  p_project_id uuid,
  p_expected_revision_no integer,
  p_expected_updated_at timestamptz,
  p_record jsonb,
  p_reason text default 'Project saved',
  p_request_id uuid default null
)
returns public.projects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.projects;
  v_updated public.projects;
  v_changed jsonb;
begin
  perform public.vf_assert_role(
    p_organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  );
  if jsonb_typeof(p_record) <> 'object' then
    raise exception using errcode = 'VF422', message = 'Project record must be a JSON object';
  end if;
  select * into v_old from public.projects
  where id = p_project_id and organisation_id = p_organisation_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Project not found'; end if;
  if v_old.archived_at is not null then raise exception using errcode = 'VF409', message = 'Archived project cannot be edited'; end if;
  if v_old.revision_no <> p_expected_revision_no
     or (p_expected_updated_at is not null and v_old.updated_at <> p_expected_updated_at) then
    raise exception using errcode = 'VF409', message = 'Project changed since it was loaded';
  end if;
  v_changed := public.vf_changed_top_keys(v_old.current_record, p_record);
  update public.projects set
    name = coalesce(nullif(trim(p_record ->> 'name'), ''), nullif(p_record #>> '{project,client}', ''), name),
    client_name = nullif(p_record #>> '{project,client}', ''),
    location = nullif(p_record #>> '{project,location}', ''),
    current_record = p_record,
    revision_no = revision_no + 1,
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_project_id and organisation_id = p_organisation_id
  returning * into v_updated;

  perform public.append_audit_event(
    p_organisation_id, p_project_id, null, 'project.updated',
    jsonb_build_object('revision_no', v_old.revision_no, 'updated_at', v_old.updated_at),
    jsonb_build_object('revision_no', v_updated.revision_no, 'updated_at', v_updated.updated_at, 'changed_fields', v_changed),
    p_request_id, p_reason
  );
  return v_updated;
end;
$$;

create or replace function public.archive_cloud_project(
  p_organisation_id uuid,
  p_project_id uuid,
  p_expected_revision_no integer,
  p_reason text default 'Project archived',
  p_request_id uuid default null
)
returns public.projects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.projects;
begin
  perform public.vf_assert_role(
    p_organisation_id,
    array['manager']::public.organisation_role[]
  );
  select * into v_project from public.projects
  where id = p_project_id and organisation_id = p_organisation_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Project not found'; end if;
  if v_project.revision_no <> p_expected_revision_no then
    raise exception using errcode = 'VF409', message = 'Project changed since it was loaded';
  end if;
  update public.projects set
    status = 'archived', archived_at = now(), archived_by = auth.uid(),
    revision_no = revision_no + 1, updated_at = now(), updated_by = auth.uid()
  where id = p_project_id and organisation_id = p_organisation_id
  returning * into v_project;
  perform public.append_audit_event(
    p_organisation_id, p_project_id, null, 'project.archived',
    jsonb_build_object('status', 'active'),
    jsonb_build_object('status', 'archived', 'revision_no', v_project.revision_no),
    p_request_id, p_reason
  );
  return v_project;
end;
$$;

create or replace function public.import_legacy_project(
  p_organisation_id uuid,
  p_name text,
  p_requested_project_ref text,
  p_current_record jsonb,
  p_source_fingerprint text,
  p_provenance jsonb,
  p_request_id uuid default null
)
returns public.projects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.projects;
begin
  perform public.vf_assert_role(
    p_organisation_id,
    array['manager', 'engineer']::public.organisation_role[]
  );
  if p_source_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'VF422', message = 'Invalid migration fingerprint';
  end if;
  select * into v_project from public.projects
  where organisation_id = p_organisation_id and migration_fingerprint = p_source_fingerprint
  limit 1;
  if found then return v_project; end if;

  v_project := public.create_cloud_project(
    p_organisation_id, p_name, p_requested_project_ref, p_current_record, null
  );
  update public.projects set
    migration_fingerprint = p_source_fingerprint,
    migration_provenance = coalesce(p_provenance, '{}'::jsonb),
    updated_at = now(), updated_by = auth.uid()
  where id = v_project.id and organisation_id = p_organisation_id
  returning * into v_project;
  perform public.append_audit_event(
    p_organisation_id, v_project.id, null, 'project.migrated', '{}'::jsonb,
    jsonb_build_object(
      'source_fingerprint', p_source_fingerprint,
      'source_schema_version', p_provenance ->> 'sourceSchemaVersion',
      'legacy_approvals_trusted', false,
      'legacy_evidence_trusted', false
    ),
    p_request_id, '11.7 local export migrated without trusting legacy approvals'
  );
  return v_project;
end;
$$;

create or replace function public.create_project_version(
  p_organisation_id uuid,
  p_project_id uuid,
  p_lifecycle public.version_lifecycle,
  p_snapshot jsonb,
  p_client_snapshot jsonb,
  p_bank_snapshot jsonb,
  p_field_snapshot jsonb,
  p_report_metadata jsonb default '{}'::jsonb,
  p_boq_revision jsonb default null,
  p_reason text default 'Proposal version prepared',
  p_request_id uuid default null
)
returns public.project_versions
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_project public.projects;
  v_version public.project_versions;
  v_version_no integer;
  v_hash text;
  v_boq_revision_no integer;
begin
  perform public.vf_assert_role(
    p_organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  );
  if jsonb_typeof(p_snapshot) <> 'object'
     or jsonb_typeof(p_client_snapshot) <> 'object'
     or jsonb_typeof(p_bank_snapshot) <> 'object'
     or jsonb_typeof(p_field_snapshot) <> 'object' then
    raise exception using errcode = 'VF422', message = 'Version snapshots must be JSON objects';
  end if;
  if not public.vf_audience_snapshot_is_safe(p_client_snapshot, 'client')
     or not public.vf_audience_snapshot_is_safe(p_bank_snapshot, 'bank')
     or not public.vf_audience_snapshot_is_safe(p_field_snapshot, 'technician') then
    raise exception using errcode = 'VF422', message = 'Audience snapshot is outside the server allow-list';
  end if;
  select * into v_project from public.projects
  where id = p_project_id and organisation_id = p_organisation_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Project not found'; end if;
  if v_project.archived_at is not null then raise exception using errcode = 'VF409', message = 'Archived project cannot create versions'; end if;

  select coalesce(max(version_no), 0) + 1 into v_version_no
  from public.project_versions where project_id = p_project_id;
  v_hash := encode(digest(convert_to(p_snapshot::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.project_versions (
    organisation_id, project_id, version_no, lifecycle, snapshot, client_snapshot,
    bank_snapshot, field_snapshot, snapshot_hash, client_snapshot_hash,
    schema_version, app_version, calculation_version, report_metadata,
    created_by, issued_at
  ) values (
    p_organisation_id, p_project_id, v_version_no, p_lifecycle, p_snapshot,
    p_client_snapshot, p_bank_snapshot, p_field_snapshot, v_hash,
    encode(digest(convert_to(p_client_snapshot::text, 'UTF8'), 'sha256'), 'hex'),
    coalesce(nullif(p_snapshot ->> 'schemaVersion', ''), '11.7'),
    coalesce(nullif(p_snapshot ->> 'appVersion', ''), 'Voltflow 11.7.2b'),
    coalesce(nullif(p_snapshot ->> 'calculationVersion', ''), 'Voltflow 11.7.2b'),
    coalesce(p_report_metadata, '{}'::jsonb), auth.uid(),
    case when p_lifecycle = 'issued' then now() else null end
  ) returning * into v_version;

  update public.projects set
    latest_version_id = v_version.id,
    status = case when p_lifecycle = 'issued' then 'in_review' else status end
  where id = p_project_id and organisation_id = p_organisation_id;

  if p_boq_revision is not null then
    if jsonb_typeof(p_boq_revision) <> 'object'
       or jsonb_typeof(coalesce(p_boq_revision -> 'lines', '[]'::jsonb)) <> 'array' then
      raise exception using errcode = 'VF422', message = 'BoQ revision must contain a lines array';
    end if;
    select coalesce(max(revision_no), 0) + 1 into v_boq_revision_no
    from public.boq_revisions where project_id = p_project_id;
    insert into public.boq_revisions (
      organisation_id, project_id, project_version_id, revision_no, lines,
      internal_totals, public_headline, created_by
    ) values (
      p_organisation_id, p_project_id, v_version.id, v_boq_revision_no,
      coalesce(p_boq_revision -> 'lines', '[]'::jsonb),
      coalesce(p_boq_revision -> 'internalTotals', '{}'::jsonb),
      coalesce(p_boq_revision -> 'publicHeadline', '{}'::jsonb),
      auth.uid()
    );
  end if;

  perform public.append_audit_event(
    p_organisation_id, p_project_id, v_version.id,
    case when p_lifecycle = 'issued' then 'project.version_issued' else 'project.version_prepared' end,
    '{}'::jsonb,
    jsonb_build_object('version_no', v_version.version_no, 'snapshot_hash', v_hash, 'lifecycle', p_lifecycle),
    p_request_id, p_reason
  );
  return v_version;
end;
$$;

create or replace function public.get_technician_home(p_organisation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.organisation_role;
  v_result jsonb;
begin
  v_role := public.vf_assert_role(
    p_organisation_id,
    array['technician']::public.organisation_role[]
  );
  select jsonb_build_object(
    'syncStatus', 'cloud',
    'projects', coalesce(jsonb_agg(project_row order by project_row ->> 'name'), '[]'::jsonb)
  ) into v_result
  from (
    select jsonb_build_object(
      'id', p.id,
      'projectRef', p.project_ref,
      'name', p.name,
      'location', coalesce(p.location, ''),
      'status', p.status,
      'tasks', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', task ->> 'id',
          'title', task ->> 'title',
          'category', task ->> 'category',
          'status', task ->> 'status',
          'priority', task ->> 'priority',
          'dueDate', task ->> 'dueDate'
        ))
        from jsonb_array_elements(coalesce(p.current_record #> '{project,delivery,tasks}', '[]'::jsonb)) task
        where coalesce(task ->> 'ownerUserId', auth.uid()::text) = auth.uid()::text
      ), '[]'::jsonb),
      'evidenceCount', (
        select count(*) from public.evidence_items e
        where e.organisation_id = p.organisation_id and e.project_id = p.id
      )
    ) project_row
    from public.project_members pm
    join public.projects p
      on p.id = pm.project_id and p.organisation_id = pm.organisation_id
    where pm.organisation_id = p_organisation_id
      and pm.user_id = auth.uid()
      and pm.revoked_at is null
      and p.archived_at is null
  ) rows;
  return coalesce(v_result, jsonb_build_object('syncStatus', 'cloud', 'projects', '[]'::jsonb));
end;
$$;

create or replace function public.list_shared_project_versions(
  p_organisation_id uuid,
  p_audience public.share_audience
)
returns table (
  share_id uuid,
  project_id uuid,
  project_version_id uuid,
  project_name text,
  project_ref text,
  version_no integer,
  issued_at timestamptz,
  expires_at timestamptz,
  snapshot jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.organisation_role;
begin
  v_role := public.vf_current_role(p_organisation_id);
  if v_role is null or v_role::text <> p_audience::text then
    raise exception using errcode = '42501', message = 'Shared package audience is not authorized';
  end if;
  return query
  select ps.id, p.id, pv.id, p.name, p.project_ref, pv.version_no, pv.issued_at,
    ps.expires_at,
    case when p_audience = 'bank' then pv.bank_snapshot else pv.client_snapshot end
  from public.project_shares ps
  join public.projects p on p.id = ps.project_id and p.organisation_id = ps.organisation_id
  join public.project_versions pv on pv.id = ps.project_version_id and pv.organisation_id = ps.organisation_id
  where ps.organisation_id = p_organisation_id
    and ps.shared_with_user_id = auth.uid()
    and ps.audience = p_audience
    and ps.revoked_at is null
    and ps.expires_at > now()
    and pv.lifecycle = 'issued'
  order by pv.issued_at desc;
end;
$$;

create or replace function public.prepare_evidence_upload(
  p_organisation_id uuid,
  p_project_id uuid,
  p_project_version_id uuid,
  p_kind text,
  p_title text,
  p_filename text,
  p_mime_type text,
  p_size_bytes bigint,
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
  v_path text;
begin
  v_role := public.vf_current_role(p_organisation_id);
  if v_role is null then raise exception using errcode = '42501', message = 'Active organisation membership required'; end if;
  if v_role not in ('manager', 'engineer')
     and not (v_role = 'technician' and public.vf_is_project_assignee(p_organisation_id, p_project_id)) then
    raise exception using errcode = '42501', message = 'Evidence upload is not authorized';
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
  if p_size_bytes < 1 or p_size_bytes > 26214400 then
    raise exception using errcode = 'VF422', message = 'Evidence file size is outside the allowed range';
  end if;
  if p_mime_type not in (
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) then
    raise exception using errcode = 'VF422', message = 'Evidence MIME type is not allowed';
  end if;
  v_path := p_organisation_id::text || '/' || p_project_id::text || '/' || v_id::text || '/' || public.vf_safe_filename(p_filename);
  insert into public.evidence_items (
    id, organisation_id, project_id, project_version_id, kind, title,
    storage_path, mime_type, size_bytes, device_captured_at, gps_metadata,
    uploader_user_id, review_status
  ) values (
    v_id, p_organisation_id, p_project_id, p_project_version_id,
    lower(regexp_replace(coalesce(p_kind, 'other'), '[^a-z0-9_.-]+', '_', 'g')),
    coalesce(nullif(trim(p_title), ''), public.vf_safe_filename(p_filename)),
    v_path, p_mime_type, p_size_bytes, p_device_captured_at,
    coalesce(p_gps_metadata, '{}'::jsonb), auth.uid(), 'pending_upload'
  ) returning * into v_evidence;
  perform public.append_audit_event(
    p_organisation_id, p_project_id, p_project_version_id, 'evidence.upload_authorized',
    '{}'::jsonb,
    jsonb_build_object('evidence_id', v_id, 'kind', v_evidence.kind, 'size_bytes', p_size_bytes, 'mime_type', p_mime_type),
    p_request_id, 'Private evidence upload authorized'
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
  select nullif(metadata ->> 'size', '')::bigint into v_object_size
  from storage.objects
  where bucket_id = 'project-evidence' and name = v_evidence.storage_path
  limit 1;
  if not found then raise exception using errcode = 'VF409', message = 'Evidence object has not been uploaded'; end if;
  if p_size_bytes <> v_evidence.size_bytes
     or (v_object_size is not null and v_object_size <> v_evidence.size_bytes) then
    raise exception using errcode = 'VF422', message = 'Evidence size does not match upload authorization';
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

create or replace function public.authorize_evidence_download(
  p_organisation_id uuid,
  p_evidence_id uuid
)
returns table (storage_path text, mime_type text, checksum_sha256 text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_evidence public.evidence_items;
  v_role public.organisation_role;
  v_allowed boolean := false;
begin
  select * into v_evidence from public.evidence_items
  where id = p_evidence_id and organisation_id = p_organisation_id;
  if not found then raise exception using errcode = 'P0002', message = 'Evidence item not found'; end if;
  v_role := public.vf_current_role(p_organisation_id);
  if v_role in ('manager', 'engineer') then v_allowed := true; end if;
  if v_role = 'technician' and public.vf_is_project_assignee(p_organisation_id, v_evidence.project_id) then v_allowed := true; end if;
  if v_role in ('client', 'bank')
     and v_evidence.review_status = 'verified'
     and v_evidence.project_version_id is not null
     and public.vf_has_active_share(p_organisation_id, v_evidence.project_version_id, v_role::text::public.share_audience) then
    v_allowed := true;
  end if;
  if not v_allowed then raise exception using errcode = '42501', message = 'Evidence download is not authorized'; end if;
  return query select v_evidence.storage_path, v_evidence.mime_type, v_evidence.checksum_sha256;
end;
$$;

create or replace function public.review_evidence(
  p_organisation_id uuid,
  p_evidence_id uuid,
  p_status public.evidence_review_status,
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
begin
  perform public.vf_assert_role(
    p_organisation_id,
    array['manager', 'engineer']::public.organisation_role[]
  );
  if p_status not in ('verified', 'rejected') then
    raise exception using errcode = 'VF422', message = 'Evidence review must be verified or rejected';
  end if;
  if p_status = 'rejected' and length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception using errcode = 'VF422', message = 'Rejected evidence requires a reason';
  end if;
  select * into v_evidence from public.evidence_items
  where id = p_evidence_id and organisation_id = p_organisation_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Evidence item not found'; end if;
  if v_evidence.review_status <> 'submitted' then
    raise exception using errcode = 'VF409', message = 'Only submitted evidence can be reviewed';
  end if;
  update public.evidence_items set
    review_status = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_reason = nullif(trim(p_reason), ''),
    updated_at = now()
  where id = p_evidence_id and organisation_id = p_organisation_id
  returning * into v_evidence;
  perform public.append_audit_event(
    p_organisation_id, v_evidence.project_id, v_evidence.project_version_id,
    'evidence.' || p_status::text,
    jsonb_build_object('review_status', 'submitted'),
    jsonb_build_object('evidence_id', p_evidence_id, 'review_status', p_status),
    p_request_id, p_reason
  );
  return v_evidence;
end;
$$;

create or replace function public.create_review_submission(
  p_organisation_id uuid,
  p_project_id uuid,
  p_project_version_id uuid,
  p_requested_reviewer_id uuid default null,
  p_reason text default null,
  p_request_id uuid default null
)
returns public.review_submissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission public.review_submissions;
begin
  perform public.vf_assert_role(
    p_organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  );
  if not exists (
    select 1 from public.project_versions
    where id = p_project_version_id and project_id = p_project_id and organisation_id = p_organisation_id
  ) then raise exception using errcode = 'VF422', message = 'Review version does not belong to project'; end if;
  if p_requested_reviewer_id is not null and not exists (
    select 1 from public.organisation_memberships
    where organisation_id = p_organisation_id and user_id = p_requested_reviewer_id
      and status = 'active' and role in ('manager', 'engineer')
  ) then raise exception using errcode = 'VF422', message = 'Requested reviewer is not an active authorized reviewer'; end if;
  insert into public.review_submissions (
    organisation_id, project_id, project_version_id, status,
    requested_reviewer_id, reason, created_by
  ) values (
    p_organisation_id, p_project_id, p_project_version_id, 'draft',
    p_requested_reviewer_id, nullif(trim(p_reason), ''), auth.uid()
  ) returning * into v_submission;
  perform public.append_audit_event(
    p_organisation_id, p_project_id, p_project_version_id, 'review.draft_created',
    '{}'::jsonb, jsonb_build_object('submission_id', v_submission.id, 'status', 'draft'),
    p_request_id, p_reason
  );
  return v_submission;
end;
$$;

create or replace function public.transition_review_submission(
  p_organisation_id uuid,
  p_submission_id uuid,
  p_next_status public.review_status,
  p_reason text default null,
  p_request_id uuid default null
)
returns public.review_submissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission public.review_submissions;
  v_old_status public.review_status;
  v_role public.organisation_role;
  v_hash text;
begin
  v_role := public.vf_current_role(p_organisation_id);
  if v_role is null then raise exception using errcode = '42501', message = 'Active organisation membership required'; end if;
  select * into v_submission from public.review_submissions
  where id = p_submission_id and organisation_id = p_organisation_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Review submission not found'; end if;
  v_old_status := v_submission.status;
  if not (
    (v_old_status = 'draft' and p_next_status = 'review_ready')
    or (v_old_status = 'review_ready' and p_next_status in ('draft', 'submitted'))
    or (v_old_status = 'submitted' and p_next_status = 'in_review')
    or (v_old_status = 'in_review' and p_next_status in ('approved', 'rejected'))
    or (v_old_status = 'rejected' and p_next_status = 'draft')
  ) then raise exception using errcode = 'VF422', message = 'Review status transition is not allowed'; end if;
  if p_next_status = 'in_review' and v_role not in ('manager', 'engineer') then
    raise exception using errcode = '42501', message = 'Taking a submission into review requires Manager or Engineer role';
  end if;
  if p_next_status in ('approved', 'rejected') then
    if v_role not in ('manager', 'engineer') then
      raise exception using errcode = '42501', message = 'Review decision requires Manager or Engineer role';
    end if;
    if v_submission.requested_reviewer_id is not null and v_submission.requested_reviewer_id <> auth.uid() and v_role <> 'manager' then
      raise exception using errcode = '42501', message = 'Review is assigned to another reviewer';
    end if;
    if length(trim(coalesce(p_reason, ''))) < 3 then
      raise exception using errcode = 'VF422', message = 'Approval or rejection requires a reason';
    end if;
  elsif v_role not in ('manager', 'engineer', 'sales') then
    raise exception using errcode = '42501', message = 'Review transition is not authorized';
  end if;

  update public.review_submissions set
    status = p_next_status,
    submitted_by = case when p_next_status = 'submitted' then auth.uid() else submitted_by end,
    submitted_at = case when p_next_status = 'submitted' then now() else submitted_at end,
    reviewed_at = case when p_next_status in ('approved', 'rejected') then now() else reviewed_at end,
    reason = coalesce(nullif(trim(p_reason), ''), reason),
    updated_at = now()
  where id = p_submission_id and organisation_id = p_organisation_id
  returning * into v_submission;

  if p_next_status in ('approved', 'rejected') then
    select snapshot_hash into v_hash from public.project_versions
    where id = v_submission.project_version_id and organisation_id = p_organisation_id;
    insert into public.approvals (
      organisation_id, project_id, project_version_id, review_submission_id,
      decision, reason, actor_user_id, actor_role, snapshot_hash
    ) values (
      p_organisation_id, v_submission.project_id, v_submission.project_version_id,
      v_submission.id, p_next_status::text, trim(p_reason), auth.uid(), v_role, v_hash
    );
    update public.projects set
      status = case when p_next_status = 'approved' then 'approved' else 'active' end
    where id = v_submission.project_id and organisation_id = p_organisation_id;
  elsif p_next_status in ('submitted', 'in_review') then
    update public.projects set status = 'in_review'
    where id = v_submission.project_id and organisation_id = p_organisation_id;
  end if;

  perform public.append_audit_event(
    p_organisation_id, v_submission.project_id, v_submission.project_version_id,
    'review.' || p_next_status::text,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_next_status, 'submission_id', v_submission.id),
    p_request_id, p_reason
  );
  return v_submission;
end;
$$;

create or replace function public.create_project_share(
  p_organisation_id uuid,
  p_project_id uuid,
  p_project_version_id uuid,
  p_shared_with_user_id uuid,
  p_audience public.share_audience,
  p_expires_at timestamptz,
  p_request_id uuid default null
)
returns public.project_shares
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_share public.project_shares;
begin
  perform public.vf_assert_role(
    p_organisation_id,
    array['manager', 'sales']::public.organisation_role[]
  );
  if p_expires_at <= now() or p_expires_at > now() + interval '90 days' then
    raise exception using errcode = 'VF422', message = 'Share expiry must be within 90 days';
  end if;
  if not exists (
    select 1 from public.project_versions
    where id = p_project_version_id and project_id = p_project_id
      and organisation_id = p_organisation_id and lifecycle = 'issued'
  ) then raise exception using errcode = 'VF422', message = 'Only an issued project version can be shared'; end if;
  if not exists (
    select 1 from public.approvals
    where project_version_id = p_project_version_id
      and project_id = p_project_id
      and organisation_id = p_organisation_id
      and decision = 'approved'
  ) then raise exception using errcode = 'VF422', message = 'Only an approved project version can be shared'; end if;
  if not exists (
    select 1 from public.organisation_memberships
    where organisation_id = p_organisation_id and user_id = p_shared_with_user_id
      and status = 'active' and role::text = p_audience::text
  ) then raise exception using errcode = 'VF422', message = 'Share recipient role does not match audience'; end if;
  insert into public.project_shares (
    organisation_id, project_id, project_version_id, shared_with_user_id,
    audience, created_by, expires_at
  ) values (
    p_organisation_id, p_project_id, p_project_version_id,
    p_shared_with_user_id, p_audience, auth.uid(), p_expires_at
  )
  on conflict (project_version_id, shared_with_user_id, audience) where revoked_at is null
  do update set expires_at = excluded.expires_at
  returning * into v_share;
  perform public.append_audit_event(
    p_organisation_id, p_project_id, p_project_version_id, 'share.created',
    '{}'::jsonb,
    jsonb_build_object('share_id', v_share.id, 'audience', p_audience, 'expires_at', p_expires_at),
    p_request_id, 'Issued project version shared'
  );
  return v_share;
end;
$$;

create or replace function public.revoke_project_share(
  p_organisation_id uuid,
  p_share_id uuid,
  p_reason text,
  p_request_id uuid default null
)
returns public.project_shares
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_share public.project_shares;
begin
  perform public.vf_assert_role(
    p_organisation_id,
    array['manager', 'sales']::public.organisation_role[]
  );
  update public.project_shares set revoked_at = now(), revoked_by = auth.uid()
  where id = p_share_id and organisation_id = p_organisation_id and revoked_at is null
  returning * into v_share;
  if not found then raise exception using errcode = 'P0002', message = 'Active share not found'; end if;
  perform public.append_audit_event(
    p_organisation_id, v_share.project_id, v_share.project_version_id, 'share.revoked',
    jsonb_build_object('share_id', p_share_id, 'audience', v_share.audience),
    jsonb_build_object('revoked_at', v_share.revoked_at),
    p_request_id, p_reason
  );
  return v_share;
end;
$$;

create or replace function public.vf_reject_immutable_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception using errcode = '42501', message = format('%I is append-only', tg_table_name);
end;
$$;

create trigger project_versions_append_only
before update or delete on public.project_versions
for each row execute function public.vf_reject_immutable_change();

create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function public.vf_reject_immutable_change();

create trigger approvals_append_only
before update or delete on public.approvals
for each row execute function public.vf_reject_immutable_change();

create trigger boq_revisions_append_only
before update or delete on public.boq_revisions
for each row execute function public.vf_reject_immutable_change();

revoke all on function public.vf_assert_role(uuid, public.organisation_role[]) from public, anon;
revoke all on function public.vf_changed_top_keys(jsonb, jsonb) from public, anon;
revoke all on function public.vf_snapshot_has_commercial_internals(jsonb) from public, anon;
revoke all on function public.vf_json_has_secret_keys(jsonb) from public, anon;
revoke all on function public.vf_json_keys_allowed(jsonb, text[]) from public, anon;
revoke all on function public.vf_audience_snapshot_is_safe(jsonb, text) from public, anon;
revoke all on function public.vf_safe_filename(text) from public, anon;
revoke all on function public.append_audit_event(uuid, uuid, uuid, text, jsonb, jsonb, uuid, text) from public, anon;
revoke all on function public.create_cloud_project(uuid, text, text, jsonb, uuid) from public, anon;
revoke all on function public.update_cloud_project(uuid, uuid, integer, timestamptz, jsonb, text, uuid) from public, anon;
revoke all on function public.archive_cloud_project(uuid, uuid, integer, text, uuid) from public, anon;
revoke all on function public.import_legacy_project(uuid, text, text, jsonb, text, jsonb, uuid) from public, anon;
revoke all on function public.create_project_version(uuid, uuid, public.version_lifecycle, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, uuid) from public, anon;
revoke all on function public.get_technician_home(uuid) from public, anon;
revoke all on function public.list_shared_project_versions(uuid, public.share_audience) from public, anon;
revoke all on function public.prepare_evidence_upload(uuid, uuid, uuid, text, text, text, text, bigint, timestamptz, jsonb, uuid) from public, anon;
revoke all on function public.complete_evidence_upload(uuid, uuid, text, bigint, uuid) from public, anon;
revoke all on function public.authorize_evidence_download(uuid, uuid) from public, anon;
revoke all on function public.review_evidence(uuid, uuid, public.evidence_review_status, text, uuid) from public, anon;
revoke all on function public.create_review_submission(uuid, uuid, uuid, uuid, text, uuid) from public, anon;
revoke all on function public.transition_review_submission(uuid, uuid, public.review_status, text, uuid) from public, anon;
revoke all on function public.create_project_share(uuid, uuid, uuid, uuid, public.share_audience, timestamptz, uuid) from public, anon;
revoke all on function public.revoke_project_share(uuid, uuid, text, uuid) from public, anon;

grant execute on function public.append_audit_event(uuid, uuid, uuid, text, jsonb, jsonb, uuid, text) to authenticated;
grant execute on function public.create_cloud_project(uuid, text, text, jsonb, uuid) to authenticated;
grant execute on function public.update_cloud_project(uuid, uuid, integer, timestamptz, jsonb, text, uuid) to authenticated;
grant execute on function public.archive_cloud_project(uuid, uuid, integer, text, uuid) to authenticated;
grant execute on function public.import_legacy_project(uuid, text, text, jsonb, text, jsonb, uuid) to authenticated;
grant execute on function public.create_project_version(uuid, uuid, public.version_lifecycle, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, uuid) to authenticated;
grant execute on function public.get_technician_home(uuid) to authenticated;
grant execute on function public.list_shared_project_versions(uuid, public.share_audience) to authenticated;
grant execute on function public.prepare_evidence_upload(uuid, uuid, uuid, text, text, text, text, bigint, timestamptz, jsonb, uuid) to authenticated;
grant execute on function public.complete_evidence_upload(uuid, uuid, text, bigint, uuid) to authenticated;
grant execute on function public.authorize_evidence_download(uuid, uuid) to authenticated;
grant execute on function public.review_evidence(uuid, uuid, public.evidence_review_status, text, uuid) to authenticated;
grant execute on function public.create_review_submission(uuid, uuid, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.transition_review_submission(uuid, uuid, public.review_status, text, uuid) to authenticated;
grant execute on function public.create_project_share(uuid, uuid, uuid, uuid, public.share_audience, timestamptz, uuid) to authenticated;
grant execute on function public.revoke_project_share(uuid, uuid, text, uuid) to authenticated;

commit;

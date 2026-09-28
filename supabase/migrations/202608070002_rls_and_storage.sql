begin;

create or replace function public.vf_current_role(p_organisation_id uuid)
returns public.organisation_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.organisation_memberships m
  join public.profiles p on p.user_id = m.user_id and p.status = 'active'
  join public.organisations o on o.id = m.organisation_id and o.status = 'active'
  where m.organisation_id = p_organisation_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1
$$;

create or replace function public.vf_is_active_member(p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.vf_current_role(p_organisation_id) is not null
$$;

create or replace function public.vf_has_role(
  p_organisation_id uuid,
  p_roles public.organisation_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.vf_current_role(p_organisation_id) = any(p_roles)
$$;

create or replace function public.vf_is_project_assignee(
  p_organisation_id uuid,
  p_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.project_members pm
    join public.organisation_memberships om
      on om.organisation_id = pm.organisation_id
     and om.user_id = pm.user_id
     and om.status = 'active'
    where pm.organisation_id = p_organisation_id
      and pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.revoked_at is null
      and om.role = 'technician'
  )
$$;

create or replace function public.vf_has_active_share(
  p_organisation_id uuid,
  p_project_version_id uuid,
  p_audience public.share_audience default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.project_shares ps
    join public.organisation_memberships om
      on om.organisation_id = ps.organisation_id
     and om.user_id = ps.shared_with_user_id
     and om.status = 'active'
    where ps.organisation_id = p_organisation_id
      and ps.project_version_id = p_project_version_id
      and ps.shared_with_user_id = auth.uid()
      and ps.revoked_at is null
      and ps.expires_at > now()
      and (p_audience is null or ps.audience = p_audience)
      and om.role::text = ps.audience::text
  )
$$;

revoke all on function public.vf_current_role(uuid) from public, anon;
revoke all on function public.vf_is_active_member(uuid) from public, anon;
revoke all on function public.vf_has_role(uuid, public.organisation_role[]) from public, anon;
revoke all on function public.vf_is_project_assignee(uuid, uuid) from public, anon;
revoke all on function public.vf_has_active_share(uuid, uuid, public.share_audience) from public, anon;
grant execute on function public.vf_current_role(uuid) to authenticated;
grant execute on function public.vf_is_active_member(uuid) to authenticated;
grant execute on function public.vf_has_role(uuid, public.organisation_role[]) to authenticated;
grant execute on function public.vf_is_project_assignee(uuid, uuid) to authenticated;
grant execute on function public.vf_has_active_share(uuid, uuid, public.share_audience) to authenticated;

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.organisation_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_versions enable row level security;
alter table public.audit_events enable row level security;
alter table public.evidence_items enable row level security;
alter table public.review_submissions enable row level security;
alter table public.approvals enable row level security;
alter table public.boq_revisions enable row level security;
alter table public.project_shares enable row level security;

alter table public.organisations force row level security;
alter table public.profiles force row level security;
alter table public.organisation_memberships force row level security;
alter table public.projects force row level security;
alter table public.project_members force row level security;
alter table public.project_versions force row level security;
alter table public.audit_events force row level security;
alter table public.evidence_items force row level security;
alter table public.review_submissions force row level security;
alter table public.approvals force row level security;
alter table public.boq_revisions force row level security;
alter table public.project_shares force row level security;

create policy organisations_member_select
on public.organisations for select to authenticated
using (public.vf_is_active_member(id));

create policy profiles_self_or_colleague_select
on public.profiles for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.organisation_memberships mine
    join public.organisation_memberships theirs
      on theirs.organisation_id = mine.organisation_id
     and theirs.user_id = profiles.user_id
     and theirs.status = 'active'
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and mine.role in ('manager', 'engineer', 'sales')
  )
);

create policy profiles_self_update
on public.profiles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and status = 'active');

create policy memberships_self_or_manager_select
on public.organisation_memberships for select to authenticated
using (
  user_id = auth.uid()
  or public.vf_has_role(organisation_id, array['manager']::public.organisation_role[])
);

create policy projects_internal_select
on public.projects for select to authenticated
using (
  public.vf_has_role(
    organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  )
);

create policy project_members_internal_or_self_select
on public.project_members for select to authenticated
using (
  user_id = auth.uid()
  or public.vf_has_role(
    organisation_id,
    array['manager', 'engineer']::public.organisation_role[]
  )
);

create policy project_versions_internal_select
on public.project_versions for select to authenticated
using (
  public.vf_has_role(
    organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  )
);

create policy audit_events_authorized_select
on public.audit_events for select to authenticated
using (
  public.vf_has_role(
    organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  )
  or (
    actor_user_id = auth.uid()
    and project_id is not null
    and public.vf_is_project_assignee(organisation_id, project_id)
  )
);

create policy evidence_items_authorized_select
on public.evidence_items for select to authenticated
using (
  public.vf_has_role(
    organisation_id,
    array['manager', 'engineer']::public.organisation_role[]
  )
  or public.vf_is_project_assignee(organisation_id, project_id)
);

create policy review_submissions_authorized_select
on public.review_submissions for select to authenticated
using (
  public.vf_has_role(
    organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  )
  or requested_reviewer_id = auth.uid()
);

create policy approvals_authorized_select
on public.approvals for select to authenticated
using (
  public.vf_has_role(
    organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  )
);

create policy boq_revisions_internal_select
on public.boq_revisions for select to authenticated
using (
  public.vf_has_role(
    organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  )
);

create policy project_shares_owner_or_recipient_select
on public.project_shares for select to authenticated
using (
  shared_with_user_id = auth.uid()
  or public.vf_has_role(
    organisation_id,
    array['manager', 'engineer', 'sales']::public.organisation_role[]
  )
);

revoke all on table public.organisations from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.organisation_memberships from anon, authenticated;
revoke all on table public.projects from anon, authenticated;
revoke all on table public.project_members from anon, authenticated;
revoke all on table public.project_versions from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;
revoke all on table public.evidence_items from anon, authenticated;
revoke all on table public.review_submissions from anon, authenticated;
revoke all on table public.approvals from anon, authenticated;
revoke all on table public.boq_revisions from anon, authenticated;
revoke all on table public.project_shares from anon, authenticated;

grant select on table public.organisations to authenticated;
grant select, update (display_name, updated_at) on table public.profiles to authenticated;
grant select on table public.organisation_memberships to authenticated;
grant select on table public.projects to authenticated;
grant select on table public.project_members to authenticated;
grant select on table public.project_versions to authenticated;
grant select on table public.audit_events to authenticated;
grant select on table public.evidence_items to authenticated;
grant select on table public.review_submissions to authenticated;
grant select on table public.approvals to authenticated;
grant select on table public.boq_revisions to authenticated;
grant select on table public.project_shares to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-evidence',
  'project-evidence',
  false,
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'text/csv', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.vf_storage_path_uuid(p_name text, p_index integer)
returns uuid
language plpgsql
immutable
set search_path = public, storage, pg_temp
as $$
declare
  v_part text;
begin
  v_part := (storage.foldername(p_name))[p_index];
  if v_part is null or v_part !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_part::uuid;
end;
$$;

revoke all on function public.vf_storage_path_uuid(text, integer) from public, anon;
grant execute on function public.vf_storage_path_uuid(text, integer) to authenticated;

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
    where e.id = public.vf_storage_path_uuid(name, 3)
      and e.organisation_id = public.vf_storage_path_uuid(name, 1)
      and e.project_id = public.vf_storage_path_uuid(name, 2)
      and e.storage_path = name
      and e.review_status = 'pending_upload'
  )
);

create policy evidence_objects_select
on storage.objects for select to authenticated
using (
  bucket_id = 'project-evidence'
  and exists (
    select 1
    from public.evidence_items e
    where e.storage_path = name
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

commit;

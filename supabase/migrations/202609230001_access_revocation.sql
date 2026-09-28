begin;

create or replace function public.revoke_organisation_membership(
  p_organisation_id uuid,
  p_membership_id uuid,
  p_reason text,
  p_request_id uuid default null
)
returns public.organisation_memberships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership public.organisation_memberships;
  v_active_manager_count integer;
begin
  perform public.vf_assert_role(
    p_organisation_id,
    array['manager']::public.organisation_role[]
  );

  select * into v_membership
  from public.organisation_memberships
  where id = p_membership_id
    and organisation_id = p_organisation_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Organisation membership not found';
  end if;
  if v_membership.user_id = auth.uid() then
    raise exception using errcode = '42501', message = 'Managers cannot revoke their own membership';
  end if;
  if v_membership.status <> 'active' then
    raise exception using errcode = 'VF409', message = 'Organisation membership is not active';
  end if;

  if v_membership.role = 'manager' then
    select count(*) into v_active_manager_count
    from public.organisation_memberships
    where organisation_id = p_organisation_id
      and role = 'manager'
      and status = 'active';
    if v_active_manager_count <= 1 then
      raise exception using errcode = 'VF409', message = 'The final active manager cannot be revoked';
    end if;
  end if;

  update public.organisation_memberships
  set status = 'revoked', revoked_at = now(), updated_at = now()
  where id = p_membership_id
  returning * into v_membership;

  update public.project_members
  set revoked_at = coalesce(revoked_at, now())
  where organisation_id = p_organisation_id
    and user_id = v_membership.user_id
    and revoked_at is null;

  update public.project_shares
  set revoked_at = coalesce(revoked_at, now()), revoked_by = auth.uid()
  where organisation_id = p_organisation_id
    and shared_with_user_id = v_membership.user_id
    and revoked_at is null;

  perform public.append_audit_event(
    p_organisation_id,
    null,
    null,
    'membership.revoked',
    jsonb_build_object('membership_id', v_membership.id, 'user_id', v_membership.user_id, 'role', v_membership.role, 'status', 'active'),
    jsonb_build_object('membership_id', v_membership.id, 'user_id', v_membership.user_id, 'role', v_membership.role, 'status', 'revoked', 'revoked_at', v_membership.revoked_at),
    p_request_id,
    p_reason
  );

  return v_membership;
end;
$$;

revoke all on function public.revoke_organisation_membership(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.revoke_organisation_membership(uuid, uuid, text, uuid) to authenticated;

commit;

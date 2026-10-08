-- 037: Close three cross-tenant takeover paths found in the 2026-10-08 pentest.
--
-- All three were proven exploitable against prod in a rolled-back transaction:
--
-- 1. handle_invited_user_signup read invite fields from raw_user_meta_data,
--    which any user can set at signUp() or via updateUser(). Migration 026
--    fixed this locally but was never applied to prod. A stranger could sign
--    up with {org_id, invited_to_site, invited_role:'admin'} and join any org.
--    Re-applied here: read from raw_app_meta_data (service-role writable only).
--
-- 2. authenticated held INSERT on user_profiles including org_id/org_role.
--    A profile-less user (trivially obtained: sign up with any org_id in
--    user_metadata, which makes handle_new_user skip) could insert
--    {org_id: victim, org_role: 'owner'}. Profiles are only ever created by
--    SECURITY DEFINER code (handle_new_user, handle_invited_user_signup), so
--    clients need no INSERT at all.
--
-- 3. user_site_roles_insert_admins allowed any org owner/admin to insert a
--    role row for ANY site_id, never checking the site belongs to their org.
--    Every signup owns an org, so anyone could grant themselves admin on any
--    site. It also let site managers grant 'admin'/'site_manager' (incl. to
--    themselves) and add users from other orgs.
--
-- Deployment order (operator):
-- 1. Deploy the invite-user edge function from this repo FIRST. The deployed
--    version (v3) predates 026: it does not stamp app_metadata, so invites sent
--    through it would fail 'Missing invite metadata' once this applies.
-- 2. Apply this migration.
-- (2026-10-08: zero profile-less users in prod, so no pending invites break.)

-- ── 1. Invite RPC reads app_metadata ───────────────────────────────────────
create or replace function public.handle_invited_user_signup(
  p_user_id   uuid,
  p_full_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id  uuid;
  v_site_id uuid;
  v_role    text;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'Can only complete signup for your own account';
  end if;

  select
    (raw_app_meta_data->>'org_id')::uuid,
    (raw_app_meta_data->>'invited_to_site')::uuid,
    raw_app_meta_data->>'invited_role'
  into v_org_id, v_site_id, v_role
  from auth.users
  where id = p_user_id;

  if v_org_id is null or v_site_id is null or v_role is null then
    raise exception 'Missing invite metadata — this account was not created via an invitation';
  end if;

  if v_role not in ('admin', 'site_manager', 'worker', 'viewer') then
    raise exception 'Invalid invited role';
  end if;

  if exists (select 1 from user_profiles where id = p_user_id) then
    raise exception 'Profile already exists for this user';
  end if;

  if not exists (select 1 from organizations where id = v_org_id) then
    raise exception 'Organization not found';
  end if;

  if not exists (select 1 from sites where id = v_site_id and org_id = v_org_id) then
    raise exception 'Site does not belong to the specified organization';
  end if;

  insert into user_profiles (id, org_id, full_name)
  values (p_user_id, v_org_id, p_full_name);

  insert into user_site_roles (user_id, site_id, role)
  values (p_user_id, v_site_id, v_role);
end;
$$;

revoke all on function public.handle_invited_user_signup(uuid, text) from public, anon;
grant execute on function public.handle_invited_user_signup(uuid, text) to authenticated, service_role;

-- ── 2. No client-side profile inserts ──────────────────────────────────────
revoke insert on public.user_profiles from anon, authenticated;
drop policy if exists "users can insert their own profile" on public.user_profiles;

-- ── 3. Site-role grants stay inside the caller's org ───────────────────────
drop policy if exists user_site_roles_insert_admins on public.user_site_roles;
create policy user_site_roles_insert_admins on public.user_site_roles
  for insert to authenticated
  with check (
    -- the site belongs to the caller's org
    exists (select 1 from public.sites s
            where s.id = user_site_roles.site_id and s.org_id = public.current_org_id())
    -- the grantee belongs to the caller's org
    and exists (select 1 from public.user_profiles p
                where p.id = user_site_roles.user_id and p.org_id = public.current_org_id())
    and (
      public.current_org_role() in ('owner', 'admin')
      -- site admins may grant any site role (matches invite-user)
      or exists (select 1 from public.user_site_roles r
                 where r.site_id = user_site_roles.site_id
                   and r.user_id = auth.uid() and r.role = 'admin')
      -- site managers may only add workers/viewers, never elevate
      or (public.is_site_manager(user_site_roles.site_id) and user_site_roles.role in ('worker', 'viewer'))
    )
  );

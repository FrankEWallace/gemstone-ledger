-- 026: Read invite authorization fields from app_metadata, not user_metadata.
--
-- Background: handle_invited_user_signup (migration 025) read
-- org_id/invited_to_site/invited_role from the user-editable metadata column
-- on auth.users, which is user-writable via supabase.auth.updateUser({ data }),
-- and an invited user already holds a session before completing signup (the
-- accept-invite page calls updateUser to set their password). That let an
-- invited viewer rewrite invited_role to admin — keeping the legitimate
-- org_id/invited_to_site so the RPC's consistency checks still pass — and
-- self-provision an admin site role.
--
-- Fix: invited_role/org_id/invited_to_site now read from the app-editable
-- metadata column instead, because that column is writable only via the
-- service-role admin API (supabaseAdmin.auth.admin.updateUserById)
-- and must not carry authorization if sourced from anywhere else. The
-- invite-user edge function now stamps these fields into app_metadata after
-- creating the invite. A role whitelist is added inside the function as
-- defense in depth.

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
  -- The caller may only complete their own signup.
  if p_user_id is distinct from auth.uid() then
    raise exception 'Can only complete signup for your own account';
  end if;

  -- Read invite metadata stored by invite-user edge function
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

  -- Guard: prevent double-invocation
  if exists (select 1 from user_profiles where id = p_user_id) then
    raise exception 'Profile already exists for this user';
  end if;

  -- Validate org exists
  if not exists (select 1 from organizations where id = v_org_id) then
    raise exception 'Organization not found';
  end if;

  -- Validate site belongs to org
  if not exists (select 1 from sites where id = v_site_id and org_id = v_org_id) then
    raise exception 'Site does not belong to the specified organization';
  end if;

  -- Create profile linked to existing org (no new org created)
  insert into user_profiles (id, org_id, full_name)
  values (p_user_id, v_org_id, p_full_name);

  -- Assign the invited role for the site
  insert into user_site_roles (user_id, site_id, role)
  values (p_user_id, v_site_id, v_role);
end;
$$;

revoke all on function public.handle_invited_user_signup(uuid, text) from public, anon;
grant execute on function public.handle_invited_user_signup(uuid, text) to authenticated, service_role;

-- Deployment order (operator):
-- 1. Verify prod's current handle_invited_user_signup matches migration 025
--    (SELECT prosrc FROM pg_proc WHERE proname = 'handle_invited_user_signup').
-- 2. Deploy the updated invite-user edge function FIRST (new invites get app_metadata).
-- 3. Apply this migration (RPC switches to app_metadata).
-- 4. Any invite sent between old-function and migration apply will fail with
--    'Missing invite metadata' — re-send those invites.
-- 5. Audit existing user_site_roles for roles that don't match their invites.

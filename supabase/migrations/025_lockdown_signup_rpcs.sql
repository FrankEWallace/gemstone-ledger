-- 025: Lock down the signup/client RPC surface.
--
-- Background: Postgres grants EXECUTE to PUBLIC on every new function by
-- default. Migration 021 revoked `anon` on get_org_users but the implicit
-- PUBLIC grant survived, so anon still inherited EXECUTE — the same applies
-- to create_site (017) and handle_invited_user_signup (012-era). This
-- migration removes the PUBLIC/anon paths and closes two real holes:
--
--   1. handle_new_user_signup is DEAD CODE. Since migration 019 the
--      on_auth_user_created trigger (handle_new_user) provisions
--      org/profile/site/role; the client no longer calls this RPC
--      (Register.tsx uses signUp metadata only). Yet it remained
--      anon-executable and creates organizations. Dropped.
--
--   2. handle_invited_user_signup accepted an arbitrary p_user_id with no
--      auth.uid() binding while being anon-executable: anyone who learned an
--      invited-but-unregistered user's UUID could complete that profile with
--      an attacker-chosen name. It is only ever called by the invited user
--      with a session (AcceptInvite.tsx), so: bind p_user_id to auth.uid()
--      and restrict EXECUTE to authenticated.
--
-- RLS helper functions (is_org_member, has_site_access, is_site_manager,
-- current_org_id, current_org_role, accessible_site_ids) intentionally keep
-- anon+authenticated EXECUTE — they are referenced by RLS policies applying
-- to `public`, and return empty/false for anon (documented in 024).

-- 1. Drop the superseded signup RPC.
drop function if exists public.handle_new_user_signup(uuid, text, text, text);

-- 2. Bind invited-signup to the calling user and restrict to authenticated.
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
    (raw_user_meta_data->>'org_id')::uuid,
    (raw_user_meta_data->>'invited_to_site')::uuid,
    raw_user_meta_data->>'invited_role'
  into v_org_id, v_site_id, v_role
  from auth.users
  where id = p_user_id;

  if v_org_id is null or v_site_id is null or v_role is null then
    raise exception 'Missing invite metadata — this account was not created via an invitation';
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

-- 3. Remove the lingering PUBLIC/anon EXECUTE from session-only client RPCs.
--    Both already guard internally (auth.uid() / is_org_member), this is
--    defense-in-depth plus clearing the advisor lints.
revoke all on function public.create_site(text, text) from public, anon;
grant execute on function public.create_site(text, text) to authenticated, service_role;

revoke all on function public.get_org_users(uuid) from public, anon;
grant execute on function public.get_org_users(uuid) to authenticated, service_role;

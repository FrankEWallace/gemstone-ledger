-- ============================================================
-- Signup helper RPC — runs as SECURITY DEFINER to bypass RLS.
-- Called from the client immediately after auth.signUp() so it
-- works whether or not email confirmation is enabled (no session
-- required because the auth.users row proves identity).
-- ============================================================

create or replace function handle_new_user_signup(
  p_user_id   uuid,
  p_full_name text,
  p_org_name  text,
  p_org_slug  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id  uuid;
  v_site_id uuid;
begin
  -- Guard: user must exist in auth.users AND have been created within the last
  -- 10 minutes. This closes the anon-callable window to a tight envelope around
  -- the actual signUp() call, making abuse of a leaked UUID impractical.
  if not exists (
    select 1 from auth.users
    where id = p_user_id
      and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'User not found or signup window expired';
  end if;

  -- Guard: prevent double-invocation (e.g. retry after partial failure).
  if exists (select 1 from user_profiles where id = p_user_id) then
    raise exception 'Profile already exists for this user';
  end if;

  -- 1. Create organization
  insert into organizations (name, slug)
  values (p_org_name, p_org_slug)
  returning id into v_org_id;

  -- 2. Create user profile linked to org
  insert into user_profiles (id, org_id, full_name)
  values (p_user_id, v_org_id, p_full_name);

  -- 3. Create default site
  insert into sites (org_id, name)
  values (v_org_id, 'Main Site')
  returning id into v_site_id;

  -- 4. Assign admin role for the default site
  insert into user_site_roles (user_id, site_id, role)
  values (p_user_id, v_site_id, 'admin');
end;
$$;

-- Allow both anon (email-confirmation flow, no session) and authenticated callers.
grant execute on function handle_new_user_signup(uuid, text, text, text) to anon;
grant execute on function handle_new_user_signup(uuid, text, text, text) to authenticated;

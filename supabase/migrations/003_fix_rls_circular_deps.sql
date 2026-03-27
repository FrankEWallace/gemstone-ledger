-- ============================================================
-- Fix: Circular RLS dependency + missing self-read policies
-- current_org_id() and accessible_site_ids() need SECURITY DEFINER
-- so they can read their own tables without being blocked by RLS.
-- ============================================================

-- 1. Make helper functions bypass RLS (security definer)
create or replace function current_org_id()
returns uuid language sql stable security definer as $$
  select org_id from user_profiles where id = auth.uid()
$$;

create or replace function accessible_site_ids()
returns setof uuid language sql stable security definer as $$
  select site_id from user_site_roles where user_id = auth.uid()
$$;

-- 2. Fix user_profiles: add self-read policy (was missing)
create policy "users can read their own profile"
  on user_profiles for select
  using (id = auth.uid());

-- 3. Fix user_site_roles SELECT: was circular (called accessible_site_ids on itself)
drop policy if exists "users can view roles in their org sites" on user_site_roles;
create policy "users can view their own roles"
  on user_site_roles for select
  using (user_id = auth.uid());

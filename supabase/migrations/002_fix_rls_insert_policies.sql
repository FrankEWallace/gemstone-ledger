-- ============================================================
-- Fix: Add missing INSERT policies for the registration flow
-- The initial schema only had SELECT/UPDATE policies, missing INSERT.
-- ============================================================

-- Organizations: allow any authenticated user to create an org during signup
create policy "authenticated users can create org"
  on organizations for insert
  with check (auth.uid() is not null);

-- User profiles: allow users to insert their own profile row
create policy "users can insert their own profile"
  on user_profiles for insert
  with check (id = auth.uid());

-- Sites: allow org members to insert sites (profile must exist first)
create policy "org members can insert sites"
  on sites for insert
  with check (org_id = current_org_id());

-- User site roles: allow users to insert their own role assignments during signup
create policy "users can insert their own site roles"
  on user_site_roles for insert
  with check (user_id = auth.uid());

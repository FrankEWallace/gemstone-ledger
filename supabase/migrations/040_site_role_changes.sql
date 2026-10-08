-- 040: Make site role changes and removals work, under the same rules as
-- adding a role.
--
-- 1. user_site_roles had no UPDATE or DELETE policy, so "change role" and
--    "remove from site" on the Roles page matched zero rows and silently did
--    nothing (#48). Adds both, plus the SELECT policy they need, with the
--    same rules as the insert policy from 037: site and user in the caller's
--    org; org owners/admins and site admins manage any role; site managers
--    manage only worker/viewer rows.
--
-- 2. log_audit_event lost its pinned search_path when 029 recreated it
--    (security advisor WARN).

-- ── 1. Change and remove site roles ───────────────────────────────────────
-- SECURITY DEFINER so it can read other users' role rows; the SELECT policy
-- on user_site_roles only exposes the caller's own.
create or replace function public.can_manage_site_role(
  p_site_id uuid,
  p_user_id uuid,
  p_role    text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from sites s where s.id = p_site_id and s.org_id = current_org_id())
    and exists (select 1 from user_profiles p where p.id = p_user_id and p.org_id = current_org_id())
    and (
      current_org_role() in ('owner', 'admin')
      or exists (
        select 1 from user_site_roles r
        where r.site_id = p_site_id and r.user_id = auth.uid() and r.role = 'admin'
      )
      or (is_site_manager(p_site_id) and p_role in ('worker', 'viewer'))
    );
$$;

revoke all on function public.can_manage_site_role(uuid, uuid, text) from public, anon;
grant execute on function public.can_manage_site_role(uuid, uuid, text) to authenticated, service_role;

-- UPDATE and DELETE also apply SELECT policies to the rows they match, and
-- the existing SELECT policy only shows a user their own rows. Without this,
-- the two policies below would still match nothing.
drop policy if exists user_site_roles_select_managers on public.user_site_roles;
create policy user_site_roles_select_managers on public.user_site_roles
  for select to authenticated
  using (can_manage_site_role(site_id, user_id, role));

-- USING checks the row as it is (a manager can't touch an admin's row);
-- WITH CHECK checks it as it will be (a manager can't promote to admin).
drop policy if exists user_site_roles_update_admins on public.user_site_roles;
create policy user_site_roles_update_admins on public.user_site_roles
  for update to authenticated
  using (can_manage_site_role(site_id, user_id, role))
  with check (can_manage_site_role(site_id, user_id, role));

drop policy if exists user_site_roles_delete_admins on public.user_site_roles;
create policy user_site_roles_delete_admins on public.user_site_roles
  for delete to authenticated
  using (can_manage_site_role(site_id, user_id, role));

-- ── 2. Pin search_path ────────────────────────────────────────────────────
alter function public.log_audit_event() set search_path = public;

-- 024: Harden DB per Supabase security advisors.
--
-- Applied to production via MCP on 2026-06-19; this file mirrors that change
-- for the repo. All statements are idempotent so a CI `supabase db push`
-- re-apply is harmless.
--
-- Cleared by this migration (20 lints):
--   - function_search_path_mutable  x11  -> search_path pinned below
--   - rls_policy_always_true         x3  -> redundant WITH CHECK(true) INSERT
--                                          duplicates dropped; scoped siblings
--                                          remain and now actually govern
--   - {anon,authenticated}_security_definer_function_executable x6 (3 fns)
--                                       -> trigger-only SECURITY DEFINER funcs
--                                          removed from the /rest/v1/rpc surface
--
-- Intentionally NOT changed (documented, accepted):
--   - is_org_member / has_site_access / is_site_manager / current_org_id /
--     current_org_role / accessible_site_ids stay EXECUTE-able by anon &
--     authenticated: they are referenced by `{public}` RLS policies, so the
--     roles need EXECUTE for policy evaluation. They return empty/false for
--     anon and leak no data.
--   - create_site / get_org_users / handle_new_user_signup /
--     handle_invited_user_signup are legitimate client RPCs.
--   - pg_net-in-public: relocating the extension risks breaking the pg_cron
--     HTTP jobs (migration 023); left in place.
--   - auth_leaked_password_protection: an Auth dashboard / Management API
--     setting, not SQL. Enable manually: Dashboard -> Authentication ->
--     Sign In / Providers -> Password -> "Leaked password protection".

-- 1. Pin search_path on all flagged functions.
alter function public.accessible_site_ids()   set search_path = public;
alter function public.current_org_id()         set search_path = public;
alter function public.current_org_role()       set search_path = public;
alter function public.guard_last_owner()       set search_path = public;
alter function public.has_site_access(uuid)    set search_path = public;
alter function public.is_org_member(uuid)      set search_path = public;
alter function public.is_site_manager(uuid)    set search_path = public;
alter function public.log_audit_event()        set search_path = public;
alter function public.notify_low_stock()       set search_path = public;
alter function public.set_updated_at()         set search_path = public;
alter function public.update_updated_at()      set search_path = public;

-- 2. Remove trigger-only SECURITY DEFINER functions from the RPC surface.
--    They fire via triggers (which ignore EXECUTE grants); nothing should
--    reach them through /rest/v1/rpc.
revoke execute on function public.handle_new_user()  from public, anon, authenticated;
revoke execute on function public.log_audit_event()  from public, anon, authenticated;
revoke execute on function public.notify_low_stock() from public, anon, authenticated;

-- 3. Drop redundant permissive INSERT policies (WITH CHECK true). Each table
--    already has a correctly-scoped sibling policy; the `true` duplicate ORs
--    it away and effectively bypasses row-level security.
drop policy if exists org_insert        on public.organizations;
drop policy if exists profile_insert    on public.user_profiles;
drop policy if exists site_roles_insert on public.user_site_roles;

-- 4. Close the user_site_roles self-escalation hole. The remaining sibling
--    allowed `user_id = auth.uid()`, i.e. a signed-in user could grant
--    THEMSELVES any role on any site via a direct REST insert. All legitimate
--    role inserts go through SECURITY DEFINER RPCs (create_site) or the
--    service-role invite-user edge function, which bypass RLS, so the client
--    INSERT path can be restricted to org admins/owners and site managers.
drop policy if exists "users can insert their own site roles" on public.user_site_roles;
drop policy if exists user_site_roles_insert_admins on public.user_site_roles;
create policy user_site_roles_insert_admins
  on public.user_site_roles
  for insert
  to authenticated
  with check (
    public.current_org_role() in ('owner','admin')
    or public.is_site_manager(site_id)
  );

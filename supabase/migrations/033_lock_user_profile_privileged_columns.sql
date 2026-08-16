-- 033: Correctly restrict which user_profiles columns clients may UPDATE.
--
-- Migration 031's `revoke update (org_id, org_role)` was a no-op on databases
-- where `authenticated` already held a TABLE-WIDE update grant: a column-level
-- REVOKE cannot carve columns out of a table-wide grant, so authenticated
-- retained UPDATE on org_role/org_id (self-promotion to owner / tenant-hop by
-- repointing org_id). This migration applies the correct fix and is idempotent.
--
-- Off-limits to clients: id, created_at, org_id, org_role. Those are written
-- only by SECURITY DEFINER signup RPCs / the invite edge function / service_role.

revoke update on public.user_profiles from anon, authenticated;
grant update (full_name, avatar_url, phone, onboarding_completed, notification_prefs)
  on public.user_profiles to authenticated;

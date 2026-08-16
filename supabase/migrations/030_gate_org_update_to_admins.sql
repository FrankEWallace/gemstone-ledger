-- 030: Gate organization updates to org owners/admins.
--
-- Finding 1 (security review): the only UPDATE policy on organizations was
-- migration 001's "admins can update their org", which — despite its name —
-- checked org MEMBERSHIP only (id = current_org_id()) with no org_role gate
-- and no WITH CHECK (so WITH CHECK defaulted to the USING clause). Every
-- authenticated member of the org, including a `member`/`viewer` invited to a
-- single site, could therefore PATCH the organizations row directly via
-- PostgREST.
--
-- Concrete impact: a low-privilege member could set
--   weekly_report_email = attacker@example.com, weekly_report_enabled = true
-- and the scheduled send-weekly-report cron would then email the full
-- multi-site financial digest (revenue, expenses, net, ore tonnes, grades,
-- open incidents, low stock) to an attacker-controlled address — no admin
-- action or manual trigger required. The same policy also allowed tampering
-- with disabled_modules, name, and slug.
--
-- Fix: require org_role owner|admin on both USING and WITH CHECK, mirroring
-- the "org admins manage sites" pattern from migration 017. SELECT is
-- unchanged ("org members can view their org").
--
-- Also closes a cross-tenant SELECT hole found on the live DB (not present in
-- these migration files — prod diverged): a policy `org_select` granted
-- `SELECT ... USING (true)` to `authenticated`, so any signed-in user could
-- read EVERY organization's row (name, slug, weekly_report_email,
-- disabled_modules) across all tenants. The app only ever reads its own org
-- by id, so scoping to `org members can view their org` breaks nothing.

drop policy if exists "admins can update their org" on public.organizations;

create policy "org admins update their org"
  on public.organizations
  for update
  to authenticated
  using (id = current_org_id() and current_org_role() in ('owner', 'admin'))
  with check (id = current_org_id() and current_org_role() in ('owner', 'admin'));

-- Close the cross-tenant read hole. The scoped "org members can view their org"
-- policy (id = current_org_id()) remains and is the only SELECT path.
drop policy if exists "org_select" on public.organizations;

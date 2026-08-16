-- 031: Enforce a real role-based write matrix in RLS.
--
-- Security review findings 2 + a privilege-escalation hole found while
-- auditing prod (which had diverged from these migration files):
--
--   * Many tables kept a broad "... FOR ALL USING (org/site membership)"
--     policy, so role tiers (viewer/worker/member) carried NO server-side
--     authorization. A viewer could edit/delete transactions, inventory,
--     orders, workers, shifts, write-offs, and messages for their site, and
--     any org member could create/delete suppliers, channels, campaigns,
--     expense categories, and read/write integration_configs (which is the
--     intended home for third-party integration secrets).
--
--   * On several tables (campaigns, integration_configs, messages) a newer,
--     tighter policy had been added but the old broad policy was never
--     dropped — and permissive policies OR together, so the broad one still
--     governed. This migration removes the broad siblings.
--
--   * user_profiles' self-update policy (USING id = auth.uid()) had no column
--     restriction, so a user could UPDATE their own org_role to 'owner'
--     (self-promotion) or change org_id to another tenant (cross-tenant
--     access). Fixed with a column-level privilege revoke below.
--
-- Chosen matrix (confirmed with maintainer):
--   * Operational SITE data — workers and up may write; viewers read-only.
--   * Org config (suppliers/channels/campaigns/expense_categories) — org
--     owners/admins AND site managers may manage; all members read.
--   * integration_configs (secrets) — org owners/admins only, read + write.

-- ── 1. Helper functions ───────────────────────────────────────────────────────

-- Worker-and-up on the given site, OR an org owner/admin of the site's org.
create or replace function public.can_write_site_data(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_site_roles
    where site_id = p_site_id
      and user_id = auth.uid()
      and role in ('admin', 'site_manager', 'worker')
  ) or exists (
    select 1 from sites s
    where s.id = p_site_id
      and s.org_id = current_org_id()
      and current_org_role() in ('owner', 'admin')
  );
$$;
revoke all on function public.can_write_site_data(uuid) from public, anon;
grant execute on function public.can_write_site_data(uuid) to authenticated, service_role;

-- Org owner/admin, OR a site admin/site_manager on any site in the caller's org.
create or replace function public.is_org_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_org_role() in ('owner', 'admin')
    or exists (
      select 1 from user_site_roles usr
      join sites s on s.id = usr.site_id
      where usr.user_id = auth.uid()
        and s.org_id = current_org_id()
        and usr.role in ('admin', 'site_manager')
    );
$$;
revoke all on function public.is_org_manager() from public, anon;
grant execute on function public.is_org_manager() to authenticated, service_role;

-- ── 2. Operational site-scoped tables: member-read + worker+-write ─────────────
-- Pattern per table: drop the broad FOR ALL policy, add a SELECT policy for
-- any site member and a FOR ALL write policy gated to writers. (The write
-- policy also covers SELECT, but the read policy ORs in so viewers can read.)

-- transactions
drop policy if exists "users can access transactions for their sites" on public.transactions;
create policy "read transactions" on public.transactions
  for select to authenticated using (has_site_access(site_id));
create policy "write transactions" on public.transactions
  for all to authenticated
  using (can_write_site_data(site_id)) with check (can_write_site_data(site_id));

-- inventory_items
drop policy if exists "users can access inventory for their sites" on public.inventory_items;
create policy "read inventory_items" on public.inventory_items
  for select to authenticated using (has_site_access(site_id));
create policy "write inventory_items" on public.inventory_items
  for all to authenticated
  using (can_write_site_data(site_id)) with check (can_write_site_data(site_id));

-- orders
drop policy if exists "users can access orders for their sites" on public.orders;
create policy "read orders" on public.orders
  for select to authenticated using (has_site_access(site_id));
create policy "write orders" on public.orders
  for all to authenticated
  using (can_write_site_data(site_id)) with check (can_write_site_data(site_id));

-- order_items (scoped via parent order's site)
drop policy if exists "users can access order items via orders" on public.order_items;
create policy "read order_items" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and has_site_access(o.site_id)));
create policy "write order_items" on public.order_items
  for all to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and can_write_site_data(o.site_id)))
  with check (exists (select 1 from public.orders o where o.id = order_id and can_write_site_data(o.site_id)));

-- workers
drop policy if exists "users can access workers for their sites" on public.workers;
create policy "read workers" on public.workers
  for select to authenticated using (has_site_access(site_id));
create policy "write workers" on public.workers
  for all to authenticated
  using (can_write_site_data(site_id)) with check (can_write_site_data(site_id));

-- shift_records
drop policy if exists "users can access shifts for their sites" on public.shift_records;
create policy "read shift_records" on public.shift_records
  for select to authenticated using (has_site_access(site_id));
create policy "write shift_records" on public.shift_records
  for all to authenticated
  using (can_write_site_data(site_id)) with check (can_write_site_data(site_id));

-- inventory_write_offs (was org-wide via a sites/user_profiles join — tighten to site)
drop policy if exists "users can access write-offs for their sites" on public.inventory_write_offs;
create policy "read inventory_write_offs" on public.inventory_write_offs
  for select to authenticated using (has_site_access(site_id));
create policy "write inventory_write_offs" on public.inventory_write_offs
  for all to authenticated
  using (can_write_site_data(site_id)) with check (can_write_site_data(site_id));

-- equipment_maintenance_logs
drop policy if exists "site members can manage maintenance logs" on public.equipment_maintenance_logs;
create policy "read equipment_maintenance_logs" on public.equipment_maintenance_logs
  for select to authenticated using (has_site_access(site_id));
create policy "write equipment_maintenance_logs" on public.equipment_maintenance_logs
  for all to authenticated
  using (can_write_site_data(site_id)) with check (can_write_site_data(site_id));

-- messages: drop the broad FOR ALL (let viewers edit/delete others' messages);
-- keep the existing read policy; re-gate insert to writers + own sender_id.
drop policy if exists "users can access messages for their sites" on public.messages;
drop policy if exists "site_members_insert_messages" on public.messages;
create policy "site_members_insert_messages" on public.messages
  for insert to authenticated
  with check (can_write_site_data(site_id) and sender_id = auth.uid());

-- ── 3. Org-scoped config tables: member-read + manager-write ───────────────────

-- suppliers
drop policy if exists "org members can manage suppliers" on public.suppliers;
drop policy if exists "org members can view suppliers" on public.suppliers;
create policy "read suppliers" on public.suppliers
  for select to authenticated using (is_org_member(org_id));
create policy "manage suppliers" on public.suppliers
  for all to authenticated
  using (is_org_member(org_id) and is_org_manager())
  with check (is_org_member(org_id) and is_org_manager());

-- channels
drop policy if exists "org members can manage channels" on public.channels;
create policy "read channels" on public.channels
  for select to authenticated using (is_org_member(org_id));
create policy "manage channels" on public.channels
  for all to authenticated
  using (is_org_member(org_id) and is_org_manager())
  with check (is_org_member(org_id) and is_org_manager());

-- campaigns (keep org_members_read_campaigns; drop broad + misnamed write)
drop policy if exists "org members can manage campaigns" on public.campaigns;
drop policy if exists "managers_write_campaigns" on public.campaigns;
create policy "manage campaigns" on public.campaigns
  for all to authenticated
  using (is_org_member(org_id) and is_org_manager())
  with check (is_org_member(org_id) and is_org_manager());

-- expense_categories (keep org_members_read; drop broad member-write)
drop policy if exists "org_members_write_expense_categories" on public.expense_categories;
create policy "manage expense_categories" on public.expense_categories
  for all to authenticated
  using (is_org_member(org_id) and is_org_manager())
  with check (is_org_member(org_id) and is_org_manager());

-- integration_configs (secrets): org owners/admins only, read + write
drop policy if exists "org members can manage integrations" on public.integration_configs;
drop policy if exists "managers_write_integrations" on public.integration_configs;
drop policy if exists "org_members_read_integrations" on public.integration_configs;
create policy "read integration_configs" on public.integration_configs
  for select to authenticated
  using (is_org_member(org_id) and current_org_role() in ('owner', 'admin'));
create policy "manage integration_configs" on public.integration_configs
  for all to authenticated
  using (is_org_member(org_id) and current_org_role() in ('owner', 'admin'))
  with check (is_org_member(org_id) and current_org_role() in ('owner', 'admin'));

-- ── 4. Close the user_profiles self-escalation / tenant-hop hole ───────────────
-- The "users can update their own profile" RLS policy is column-agnostic, so a
-- member could set org_role='owner' or repoint org_id at another tenant. These
-- columns are never client-written (profile edits touch full_name/phone/
-- avatar_url/notification_prefs/onboarding_completed only; org membership and
-- roles are set by SECURITY DEFINER signup RPCs and the invite edge function,
-- which run as owner/service_role and bypass column grants).
--
-- NOTE: a column-level REVOKE cannot carve columns out of a pre-existing
-- TABLE-WIDE update grant, so we revoke the table-wide grant and re-grant only
-- the safe client-editable columns. (See migration 033, which applied this
-- corrective to already-migrated databases where the naive revoke was a no-op.)
revoke update on public.user_profiles from anon, authenticated;
grant update (full_name, avatar_url, phone, onboarding_completed, notification_prefs)
  on public.user_profiles to authenticated;

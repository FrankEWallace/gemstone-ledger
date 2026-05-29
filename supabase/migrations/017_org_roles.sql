-- ============================================================
-- 017: Organization-level roles
--
-- Adds an org-level role tier (owner | admin | member) on top of the
-- existing per-site roles in user_site_roles. Real-world multi-tenant
-- apps separate "who owns/administers the tenant" from "what role you
-- have inside a given site". This migration introduces that tier.
--
--   • The user who creates an org becomes its `owner`.
--   • Invited users default to `member`.
--   • Creating / managing sites is gated to org owner|admin.
--   • The last owner of an org cannot be demoted or deleted.
-- ============================================================

-- ── 1. Column ─────────────────────────────────────────────────────────────────
alter table user_profiles
  add column if not exists org_role text not null default 'member'
    check (org_role in ('owner', 'admin', 'member'));

-- ── 2. Backfill ───────────────────────────────────────────────────────────────
-- The earliest-created profile in each org is treated as the founder/owner.
-- Single-user orgs (the common case today) get their creator as owner.
with founders as (
  select distinct on (org_id) id
  from user_profiles
  where org_id is not null
  order by org_id, created_at asc, id asc
)
update user_profiles p
set org_role = 'owner'
from founders f
where p.id = f.id;

-- ── 3. Helper: current user's org role ─────────────────────────────────────────
-- SECURITY DEFINER so it can read user_profiles without being blocked by RLS
-- (mirrors current_org_id() / accessible_site_ids() from migration 003).
create or replace function current_org_role()
returns text language sql stable security definer as $$
  select org_role from user_profiles where id = auth.uid()
$$;

-- ── 4. Signup RPC: org creator becomes owner ────────────────────────────────────
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
  -- Guard: user must exist in auth.users AND have been created recently.
  if not exists (
    select 1 from auth.users
    where id = p_user_id
      and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'User not found or signup window expired';
  end if;

  -- Guard: prevent double-invocation.
  if exists (select 1 from user_profiles where id = p_user_id) then
    raise exception 'Profile already exists for this user';
  end if;

  -- 1. Create organization
  insert into organizations (name, slug)
  values (p_org_name, p_org_slug)
  returning id into v_org_id;

  -- 2. Create user profile linked to org — the creator is the OWNER.
  insert into user_profiles (id, org_id, full_name, org_role)
  values (p_user_id, v_org_id, p_full_name, 'owner');

  -- 3. Create default site
  insert into sites (org_id, name)
  values (v_org_id, 'Main Site')
  returning id into v_site_id;

  -- 4. Assign site-level admin role for the default site
  insert into user_site_roles (user_id, site_id, role)
  values (p_user_id, v_site_id, 'admin');
end;
$$;

grant execute on function handle_new_user_signup(uuid, text, text, text) to anon;
grant execute on function handle_new_user_signup(uuid, text, text, text) to authenticated;

-- ── 5. Gate site management to org owner|admin ──────────────────────────────────
-- Previously "admins can manage sites" only checked org membership (org_id =
-- current_org_id()), and "org members can insert sites" let any member create a
-- site. Replace both with a single role-gated policy. SELECT is unchanged
-- ("users can view their accessible sites").
--
-- Also drop the stray "sites_insert" policy (INSERT for any authenticated user,
-- with_check=true) that existed on the remote DB from diverged migration
-- history — it was a cross-tenant hole. The app never client-inserts sites
-- (creation goes through SECURITY DEFINER RPCs), so removing it is safe.
drop policy if exists "admins can manage sites" on sites;
drop policy if exists "org members can insert sites" on sites;
drop policy if exists "sites_insert" on sites;

create policy "org admins manage sites"
  on sites for all
  using (org_id = current_org_id() and current_org_role() in ('owner', 'admin'))
  with check (org_id = current_org_id() and current_org_role() in ('owner', 'admin'));

-- ── 6. create_site RPC ──────────────────────────────────────────────────────────
-- Atomic: creates the site AND grants the creator site-admin in one transaction,
-- so the new site is immediately visible (accessible_site_ids() reads
-- user_site_roles — a site with no role row would be invisible to its creator).
-- Gated to org owner|admin.
create or replace function create_site(
  p_name     text,
  p_location text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id  uuid;
  v_role    text;
  v_site_id uuid;
begin
  select org_id, org_role into v_org_id, v_role
  from user_profiles where id = auth.uid();

  if v_org_id is null then
    raise exception 'No organization for current user';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'Only organization owners or admins can create sites';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Site name is required';
  end if;

  insert into sites (org_id, name, location)
  values (v_org_id, trim(p_name), nullif(trim(p_location), ''))
  returning id into v_site_id;

  insert into user_site_roles (user_id, site_id, role)
  values (auth.uid(), v_site_id, 'admin');

  return v_site_id;
end;
$$;

grant execute on function create_site(text, text) to authenticated;

-- ── 7. Protect the last owner ───────────────────────────────────────────────────
-- An org must always have at least one owner; otherwise the tenant is orphaned
-- with no one able to administer it. Block demoting/deleting the final owner.
create or replace function guard_last_owner()
returns trigger language plpgsql as $$
declare
  v_org_id uuid;
begin
  if tg_op = 'DELETE' then
    if old.org_role <> 'owner' then return old; end if;
    v_org_id := old.org_id;
  else
    -- UPDATE: only act when an owner is being demoted away from 'owner'.
    if old.org_role <> 'owner' or new.org_role = 'owner' then return new; end if;
    v_org_id := old.org_id;
  end if;

  if v_org_id is not null and not exists (
    select 1 from user_profiles
    where org_id = v_org_id and org_role = 'owner' and id <> old.id
  ) then
    raise exception 'Cannot remove the last owner of an organization';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists trg_guard_last_owner on user_profiles;
create trigger trg_guard_last_owner
  before update or delete on user_profiles
  for each row execute function guard_last_owner();

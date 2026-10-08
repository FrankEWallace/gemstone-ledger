-- Dry-run test for migration 037. Paste into the Supabase SQL editor and Run.
-- It applies 037, runs attacks + normal flows as throwaway fake users, prints
-- the results as an (expected) error, and the error rolls EVERYTHING back.
-- Safe to run before or after 037 is applied (the migration part is idempotent).
-- Every T* line should say "blocked"; every L* line should say "works".

-- 037: Close three cross-tenant takeover paths found in the 2026-10-08 pentest.
--
-- All three were proven exploitable against prod in a rolled-back transaction:
--
-- 1. handle_invited_user_signup read invite fields from raw_user_meta_data,
--    which any user can set at signUp() or via updateUser(). Migration 026
--    fixed this locally but was never applied to prod. A stranger could sign
--    up with {org_id, invited_to_site, invited_role:'admin'} and join any org.
--    Re-applied here: read from raw_app_meta_data (service-role writable only).
--
-- 2. authenticated held INSERT on user_profiles including org_id/org_role.
--    A profile-less user (trivially obtained: sign up with any org_id in
--    user_metadata, which makes handle_new_user skip) could insert
--    {org_id: victim, org_role: 'owner'}. Profiles are only ever created by
--    SECURITY DEFINER code (handle_new_user, handle_invited_user_signup), so
--    clients need no INSERT at all.
--
-- 3. user_site_roles_insert_admins allowed any org owner/admin to insert a
--    role row for ANY site_id, never checking the site belongs to their org.
--    Every signup owns an org, so anyone could grant themselves admin on any
--    site. It also let site managers grant 'admin'/'site_manager' (incl. to
--    themselves) and add users from other orgs.
--
-- Deployment order (operator):
-- 1. Deploy the invite-user edge function from this repo FIRST. The deployed
--    version (v3) predates 026: it does not stamp app_metadata, so invites sent
--    through it would fail 'Missing invite metadata' once this applies.
-- 2. Apply this migration.
-- (2026-10-08: zero profile-less users in prod, so no pending invites break.)

-- ── 1. Invite RPC reads app_metadata ───────────────────────────────────────
begin;

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
  if p_user_id is distinct from auth.uid() then
    raise exception 'Can only complete signup for your own account';
  end if;

  select
    (raw_app_meta_data->>'org_id')::uuid,
    (raw_app_meta_data->>'invited_to_site')::uuid,
    raw_app_meta_data->>'invited_role'
  into v_org_id, v_site_id, v_role
  from auth.users
  where id = p_user_id;

  if v_org_id is null or v_site_id is null or v_role is null then
    raise exception 'Missing invite metadata — this account was not created via an invitation';
  end if;

  if v_role not in ('admin', 'site_manager', 'worker', 'viewer') then
    raise exception 'Invalid invited role';
  end if;

  if exists (select 1 from user_profiles where id = p_user_id) then
    raise exception 'Profile already exists for this user';
  end if;

  if not exists (select 1 from organizations where id = v_org_id) then
    raise exception 'Organization not found';
  end if;

  if not exists (select 1 from sites where id = v_site_id and org_id = v_org_id) then
    raise exception 'Site does not belong to the specified organization';
  end if;

  insert into user_profiles (id, org_id, full_name)
  values (p_user_id, v_org_id, p_full_name);

  insert into user_site_roles (user_id, site_id, role)
  values (p_user_id, v_site_id, v_role);
end;
$$;

revoke all on function public.handle_invited_user_signup(uuid, text) from public, anon;
grant execute on function public.handle_invited_user_signup(uuid, text) to authenticated, service_role;

-- ── 2. No client-side profile inserts ──────────────────────────────────────
revoke insert on public.user_profiles from anon, authenticated;
drop policy if exists "users can insert their own profile" on public.user_profiles;

-- ── 3. Site-role grants stay inside the caller's org ───────────────────────
drop policy if exists user_site_roles_insert_admins on public.user_site_roles;
create policy user_site_roles_insert_admins on public.user_site_roles
  for insert to authenticated
  with check (
    -- the site belongs to the caller's org
    exists (select 1 from public.sites s
            where s.id = user_site_roles.site_id and s.org_id = public.current_org_id())
    -- the grantee belongs to the caller's org
    and exists (select 1 from public.user_profiles p
                where p.id = user_site_roles.user_id and p.org_id = public.current_org_id())
    and (
      public.current_org_role() in ('owner', 'admin')
      -- site admins may grant any site role (matches invite-user)
      or exists (select 1 from public.user_site_roles r
                 where r.site_id = user_site_roles.site_id
                   and r.user_id = auth.uid() and r.role = 'admin')
      -- site managers may only add workers/viewers, never elevate
      or (public.is_site_manager(user_site_roles.site_id) and user_site_roles.role in ('worker', 'viewer'))
    )
  );

create temp table _r(test text, expected text, outcome text) on commit drop;
grant insert, select on _r to authenticated;
do $$
declare
  v uuid := gen_random_uuid(); a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid(); a3 uuid := gen_random_uuid();
  inv uuid := gen_random_uuid(); mem uuid := gen_random_uuid(); mgr uuid := gen_random_uuid();
  v_org uuid; v_site uuid; v_site2 uuid; n int;
  z text := '00000000-0000-0000-0000-000000000000';
begin
  insert into auth.users(id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at) values
   (v,z::uuid,'authenticated','authenticated','v-'||v||'@pentest.invalid','{"org_name":"PENTEST VICTIM"}','{}',now(),now()),
   (a1,z::uuid,'authenticated','authenticated','a1-'||a1||'@pentest.invalid','{}','{}',now(),now());
  select org_id into v_org from user_profiles where id=v;
  select id into v_site from sites where org_id=v_org limit 1;
  insert into sites(org_id,name) values (v_org,'Second') returning id into v_site2;
  insert into auth.users(id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at) values
   (a2,z::uuid,'authenticated','authenticated','a2-'||a2||'@pentest.invalid', jsonb_build_object('org_id',v_org),'{}',now(),now()),
   (a3,z::uuid,'authenticated','authenticated','a3-'||a3||'@pentest.invalid', jsonb_build_object('org_id',v_org,'invited_to_site',v_site,'invited_role','admin'),'{}',now(),now()),
   -- legit invite: user_metadata (makes handle_new_user skip) + app_metadata stamped by edge fn
   (inv,z::uuid,'authenticated','authenticated','inv-'||inv||'@pentest.invalid', jsonb_build_object('org_id',v_org,'invited_to_site',v_site,'invited_role','worker'), jsonb_build_object('org_id',v_org,'invited_to_site',v_site,'invited_role','worker'),now(),now()),
   (mem,z::uuid,'authenticated','authenticated','mem-'||mem||'@pentest.invalid', jsonb_build_object('org_id',v_org),'{}',now(),now()),
   (mgr,z::uuid,'authenticated','authenticated','mgr-'||mgr||'@pentest.invalid', jsonb_build_object('org_id',v_org),'{}',now(),now());
  -- seed same-org members (as service role would)
  insert into user_profiles(id,org_id,full_name) values (mem,v_org,'member'),(mgr,v_org,'manager');
  insert into user_site_roles(user_id,site_id,role) values (mgr,v_site,'site_manager');

  -- ATTACKS
  perform set_config('request.jwt.claims', json_build_object('sub',a1,'role','authenticated')::text, true); perform set_config('role','authenticated', true);
  begin insert into user_site_roles(user_id, site_id, role) values (a1, v_site, 'admin'); insert into _r values ('T1 foreign org owner self-grant','blocked','SUCCEEDED');
  exception when others then insert into _r values ('T1 foreign org owner self-grant','blocked','blocked: '||sqlerrm); end; reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',a2,'role','authenticated')::text, true); perform set_config('role','authenticated', true);
  begin insert into user_profiles(id, org_id, org_role, full_name) values (a2, v_org, 'owner', 'x'); insert into _r values ('T2 self-insert owner profile','blocked','SUCCEEDED');
  exception when others then insert into _r values ('T2 self-insert owner profile','blocked','blocked: '||sqlerrm); end; reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',a3,'role','authenticated')::text, true); perform set_config('role','authenticated', true);
  begin perform handle_invited_user_signup(a3, 'x'); insert into _r values ('T3 forged user_metadata invite','blocked','SUCCEEDED');
  exception when others then insert into _r values ('T3 forged user_metadata invite','blocked','blocked: '||sqlerrm); end; reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',mgr,'role','authenticated')::text, true); perform set_config('role','authenticated', true);
  begin insert into user_site_roles(user_id, site_id, role) values (mem, v_site, 'admin'); insert into _r values ('T5 site manager grants admin','blocked','SUCCEEDED');
  exception when others then insert into _r values ('T5 site manager grants admin','blocked','blocked: '||sqlerrm); end;
  begin insert into user_site_roles(user_id, site_id, role) values (a1, v_site, 'worker'); insert into _r values ('T6 site manager adds foreign-org user','blocked','SUCCEEDED');
  exception when others then insert into _r values ('T6 site manager adds foreign-org user','blocked','blocked: '||sqlerrm); end; reset role;

  -- LEGIT FLOWS
  perform set_config('request.jwt.claims', json_build_object('sub',inv,'role','authenticated')::text, true); perform set_config('role','authenticated', true);
  begin perform handle_invited_user_signup(inv, 'invitee'); select count(*) into n from sites where id=v_site; insert into _r values ('L1 real invite (app_metadata)','works','works; site visible='||n);
  exception when others then insert into _r values ('L1 real invite (app_metadata)','works','FAILED: '||sqlerrm); end; reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',mgr,'role','authenticated')::text, true); perform set_config('role','authenticated', true);
  begin insert into user_site_roles(user_id, site_id, role) values (mem, v_site, 'worker'); insert into _r values ('L2 site manager adds same-org worker','works','works');
  exception when others then insert into _r values ('L2 site manager adds same-org worker','works','FAILED: '||sqlerrm); end; reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',v,'role','authenticated')::text, true); perform set_config('role','authenticated', true);
  begin insert into user_site_roles(user_id, site_id, role) values (mem, v_site2, 'site_manager'); insert into _r values ('L3 org owner assigns member to own site','works','works');
  exception when others then insert into _r values ('L3 org owner assigns member to own site','works','FAILED: '||sqlerrm); end;
  begin perform create_site('Third', null); insert into _r values ('L4 org owner create_site RPC','works','works');
  exception when others then insert into _r values ('L4 org owner create_site RPC','works','FAILED: '||sqlerrm); end; reset role;
end $$;

do $$ declare z uuid := '00000000-0000-0000-0000-000000000000'; nid uuid := gen_random_uuid(); ok boolean; begin
  -- L5: fresh normal signup still provisions org+profile via trigger
  insert into auth.users(id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values (nid,z,'authenticated','authenticated','n-'||nid||'@pentest.invalid','{"full_name":"New"}','{}',now(),now());
  select exists(select 1 from user_profiles where id=nid and org_role='owner') into ok;
  insert into _r values ('L5 normal signup trigger','works', case when ok then 'works' else 'FAILED' end);
end $$;
-- Report results AND undo everything: raising an error aborts the whole
-- script, so none of the test users/orgs (or the migration, on a dry run) persist.
do $$ declare out text; begin
  select string_agg(rpad(test, 42) || ' expect ' || rpad(expected, 8) || ' -> ' || outcome, E'\n' order by test) into out from _r;
  raise exception E'TEST RESULTS (this error is expected; it rolls everything back)\n%', out;
end $$;

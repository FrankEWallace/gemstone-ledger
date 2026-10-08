-- Dry-run test for migration 040. Paste into the Supabase SQL editor and Run.
-- It applies 040, runs attacks + normal flows as throwaway fake users, prints
-- the results as an (expected) error, and the error rolls EVERYTHING back.
-- Safe to run before or after 040 is applied (the migration is idempotent).
-- Every T* line should say "blocked"; every L* line should say "works".
-- RLS-filtered UPDATE/DELETE don't error, they match 0 rows, so those tests
-- report the row count.

begin;

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

create temp table _r(test text, expected text, outcome text) on commit drop;
grant insert, select on _r to authenticated;
do $$
declare
  z uuid := '00000000-0000-0000-0000-000000000000';
  own uuid := gen_random_uuid(); adm uuid := gen_random_uuid(); mgr uuid := gen_random_uuid();
  wk uuid := gen_random_uuid(); vw uuid := gen_random_uuid(); vw2 uuid := gen_random_uuid(); fo uuid := gen_random_uuid();
  v_org uuid; v_site uuid; n int;
begin
  insert into auth.users(id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at) values
   (own,z,'authenticated','authenticated','own-'||own||'@pentest.invalid','{"org_name":"PENTEST 040"}','{}',now(),now()),
   (fo, z,'authenticated','authenticated','fo-'||fo||'@pentest.invalid','{}','{}',now(),now());
  select org_id into v_org from user_profiles where id=own;
  select id into v_site from sites where org_id=v_org limit 1;
  insert into auth.users(id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  select u, z,'authenticated','authenticated', u||'@pentest.invalid', jsonb_build_object('org_id',v_org),'{}',now(),now()
  from unnest(array[adm,mgr,wk,vw,vw2]) u;
  insert into user_profiles(id,org_id,full_name) values (adm,v_org,'adm'),(mgr,v_org,'mgr'),(wk,v_org,'wk'),(vw,v_org,'vw'),(vw2,v_org,'vw2');
  insert into user_site_roles(user_id,site_id,role) values
    (adm,v_site,'admin'),(mgr,v_site,'site_manager'),(wk,v_site,'worker'),(vw,v_site,'viewer'),(vw2,v_site,'viewer');

  -- ATTACKS: viewer
  perform set_config('request.jwt.claims', json_build_object('sub',vw,'role','authenticated')::text, true); perform set_config('role','authenticated', true);
  update user_site_roles set role='admin' where user_id=vw and site_id=v_site; get diagnostics n = row_count;
  insert into _r values ('T1 viewer self-promotes','blocked', case when n=0 then 'blocked' else 'SUCCEEDED' end);
  reset role;

  -- ATTACKS: site manager overreach
  perform set_config('request.jwt.claims', json_build_object('sub',mgr,'role','authenticated')::text, true); perform set_config('role','authenticated', true);
  update user_site_roles set role='viewer' where user_id=adm and site_id=v_site; get diagnostics n = row_count;
  insert into _r values ('T2 manager demotes site admin','blocked', case when n=0 then 'blocked' else 'SUCCEEDED' end);
  delete from user_site_roles where user_id=adm and site_id=v_site; get diagnostics n = row_count;
  insert into _r values ('T3 manager removes site admin','blocked', case when n=0 then 'blocked' else 'SUCCEEDED' end);
  begin update user_site_roles set role='admin' where user_id=wk and site_id=v_site; get diagnostics n = row_count;
    insert into _r values ('T4 manager promotes worker to admin','blocked', case when n=0 then 'blocked' else 'SUCCEEDED' end);
  exception when others then insert into _r values ('T4 manager promotes worker to admin','blocked','blocked: '||sqlerrm); end;
  update user_site_roles set role='admin' where user_id=mgr and site_id=v_site; get diagnostics n = row_count;
  insert into _r values ('T5 manager self-promotes','blocked', case when n=0 then 'blocked' else 'SUCCEEDED' end);
  reset role;

  -- ATTACKS: owner of another org
  perform set_config('request.jwt.claims', json_build_object('sub',fo,'role','authenticated')::text, true); perform set_config('role','authenticated', true);
  update user_site_roles set role='viewer' where site_id=v_site; get diagnostics n = row_count;
  insert into _r values ('T6 foreign owner changes roles','blocked', case when n=0 then 'blocked' else 'SUCCEEDED: '||n end);
  delete from user_site_roles where site_id=v_site; get diagnostics n = row_count;
  insert into _r values ('T7 foreign owner removes users','blocked', case when n=0 then 'blocked' else 'SUCCEEDED: '||n end);
  reset role;

  -- LEGIT FLOWS
  perform set_config('request.jwt.claims', json_build_object('sub',mgr,'role','authenticated')::text, true); perform set_config('role','authenticated', true);
  update user_site_roles set role='viewer' where user_id=wk and site_id=v_site; get diagnostics n = row_count;
  insert into _r values ('L1 manager changes worker to viewer','works', case when n=1 then 'works' else 'FAILED: '||n||' rows' end);
  delete from user_site_roles where user_id=vw and site_id=v_site; get diagnostics n = row_count;
  insert into _r values ('L2 manager removes viewer','works', case when n=1 then 'works' else 'FAILED: '||n||' rows' end);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',own,'role','authenticated')::text, true); perform set_config('role','authenticated', true);
  update user_site_roles set role='admin' where user_id=mgr and site_id=v_site; get diagnostics n = row_count;
  insert into _r values ('L3 org owner promotes manager to admin','works', case when n=1 then 'works' else 'FAILED: '||n||' rows' end);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',adm,'role','authenticated')::text, true); perform set_config('role','authenticated', true);
  delete from user_site_roles where user_id=vw2 and site_id=v_site; get diagnostics n = row_count;
  insert into _r values ('L4 site admin removes viewer','works', case when n=1 then 'works' else 'FAILED: '||n||' rows' end);
  reset role;
end $$;

-- Report results AND undo everything: raising an error aborts the whole
-- script, so none of the test users/orgs (or the migration, on a dry run) persist.
do $$ declare out text; begin
  select string_agg(rpad(test, 42) || ' expect ' || rpad(expected, 8) || ' -> ' || outcome, E'\n' order by test) into out from _r;
  raise exception E'TEST RESULTS (this error is expected; it rolls everything back)\n%', out;
end $$;

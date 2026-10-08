-- Dry-run test for migrations 038 + 039. Paste into the Supabase SQL editor and Run.
-- Applies both, runs checks as throwaway fake users, prints the results as an
-- (expected) error, and the error rolls EVERYTHING back. Safe to run before or
-- after the migrations are applied. Every T* line should say "blocked";
-- every L* line should say "works".

begin;

-- 038 ---------------------------------------------------------------------
drop policy if exists site_members_insert_production_logs on public.production_logs;
create policy site_members_insert_production_logs on public.production_logs
  for insert to authenticated with check (public.can_write_site_data(site_id));
drop policy if exists site_members_insert_incidents on public.safety_incidents;
create policy site_members_insert_incidents on public.safety_incidents
  for insert to authenticated with check (public.can_write_site_data(site_id));
drop policy if exists site_members_insert_documents on public.site_documents;
create policy site_members_insert_documents on public.site_documents
  for insert to authenticated with check (public.can_write_site_data(site_id) and uploaded_by = auth.uid());

-- 039 ---------------------------------------------------------------------
create table if not exists public.rate_limits (
  bucket text not null, subject uuid not null, window_start timestamptz not null,
  hits int not null default 0, primary key (bucket, subject)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
create or replace function public.hit_rate_limit(p_bucket text, p_subject uuid, p_max int, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  insert into rate_limits as r (bucket, subject, window_start, hits)
  values (p_bucket, p_subject, now(), 1)
  on conflict (bucket, subject) do update
    set hits = case when r.window_start < now() - p_window then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - p_window then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end; $$;
revoke all on function public.hit_rate_limit(text, uuid, int, interval) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, uuid, int, interval) to service_role;

-- Checks ------------------------------------------------------------------
create temp table _r(test text, expected text, outcome text) on commit drop;
grant insert, select on _r to authenticated, service_role;

do $$
declare
  z uuid := '00000000-0000-0000-0000-000000000000';
  own uuid := gen_random_uuid(); vw uuid := gen_random_uuid(); wk uuid := gen_random_uuid();
  v_org uuid; v_site uuid; ok boolean; results text := '';
  i int;
begin
  insert into auth.users(id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values (own,z,'authenticated','authenticated','own-'||own||'@pentest.invalid','{"org_name":"PENTEST ORG"}','{}',now(),now());
  select org_id into v_org from user_profiles where id=own;
  select id into v_site from sites where org_id=v_org limit 1;
  insert into auth.users(id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at) values
    (vw,z,'authenticated','authenticated','vw-'||vw||'@pentest.invalid', jsonb_build_object('org_id',v_org),'{}',now(),now()),
    (wk,z,'authenticated','authenticated','wk-'||wk||'@pentest.invalid', jsonb_build_object('org_id',v_org),'{}',now(),now());
  insert into user_profiles(id,org_id,full_name) values (vw,v_org,'viewer'),(wk,v_org,'worker');
  insert into user_site_roles(user_id,site_id,role) values (vw,v_site,'viewer'),(wk,v_site,'worker');

  -- Viewer: all three inserts must be blocked
  perform set_config('request.jwt.claims', json_build_object('sub',vw,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  begin insert into production_logs(site_id, log_date) values (v_site, current_date);
    insert into _r values ('T1 viewer inserts production_log','blocked','SUCCEEDED');
  exception when others then insert into _r values ('T1 viewer inserts production_log','blocked','blocked: '||sqlerrm); end;
  begin insert into safety_incidents(site_id, severity, type, title) values (v_site, 'low', 'near-miss', 'x');
    insert into _r values ('T2 viewer inserts safety_incident','blocked','SUCCEEDED');
  exception when others then insert into _r values ('T2 viewer inserts safety_incident','blocked','blocked: '||sqlerrm); end;
  begin insert into site_documents(site_id, uploaded_by, name, storage_path) values (v_site, vw, 'x', v_site||'/x');
    insert into _r values ('T3 viewer inserts site_document','blocked','SUCCEEDED');
  exception when others then insert into _r values ('T3 viewer inserts site_document','blocked','blocked: '||sqlerrm); end;
  begin perform hit_rate_limit('x', vw, 1, '1 hour');
    insert into _r values ('T4 client calls hit_rate_limit','blocked','SUCCEEDED');
  exception when others then insert into _r values ('T4 client calls hit_rate_limit','blocked','blocked: '||sqlerrm); end;
  begin perform count(*) from rate_limits;
    insert into _r values ('T5 client reads rate_limits','blocked','SUCCEEDED');
  exception when others then insert into _r values ('T5 client reads rate_limits','blocked','blocked: '||sqlerrm); end;
  reset role;

  -- Worker: all three inserts must work
  perform set_config('request.jwt.claims', json_build_object('sub',wk,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  begin insert into production_logs(site_id, log_date) values (v_site, current_date);
    insert into _r values ('L1 worker inserts production_log','works','works');
  exception when others then insert into _r values ('L1 worker inserts production_log','works','FAILED: '||sqlerrm); end;
  begin insert into safety_incidents(site_id, severity, type, title) values (v_site, 'low', 'near-miss', 'x');
    insert into _r values ('L2 worker inserts safety_incident','works','works');
  exception when others then insert into _r values ('L2 worker inserts safety_incident','works','FAILED: '||sqlerrm); end;
  begin insert into site_documents(site_id, uploaded_by, name, storage_path) values (v_site, wk, 'x', v_site||'/x');
    insert into _r values ('L3 worker inserts site_document','works','works');
  exception when others then insert into _r values ('L3 worker inserts site_document','works','FAILED: '||sqlerrm); end;
  begin insert into site_documents(site_id, uploaded_by, name, storage_path) values (v_site, own, 'x', v_site||'/y');
    insert into _r values ('T6 worker spoofs uploaded_by','blocked','SUCCEEDED');
  exception when others then insert into _r values ('T6 worker spoofs uploaded_by','blocked','blocked: '||sqlerrm); end;
  reset role;

  -- Org owner (also site admin via signup): insert works
  perform set_config('request.jwt.claims', json_build_object('sub',own,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  begin insert into safety_incidents(site_id, severity, type, title) values (v_site, 'low', 'near-miss', 'x');
    insert into _r values ('L4 org owner inserts safety_incident','works','works');
  exception when others then insert into _r values ('L4 org owner inserts safety_incident','works','FAILED: '||sqlerrm); end;
  reset role;

  -- Rate limiter as the edge functions call it (service_role): 3 allowed, 4th denied
  perform set_config('role','service_role', true);
  begin
    for i in 1..4 loop
      results := results || case when hit_rate_limit('pentest', own, 3, '1 hour') then 'Y' else 'N' end;
    end loop;
    insert into _r values ('L5 rate limit 3/hour (expect YYYN)','works', case when results = 'YYYN' then 'works ('||results||')' else 'FAILED ('||results||')' end);
  exception when others then insert into _r values ('L5 rate limit 3/hour (expect YYYN)','works','FAILED: '||sqlerrm); end;
  reset role;
end $$;

do $$ declare out text; begin
  select string_agg(rpad(test, 40) || ' expect ' || rpad(expected, 8) || ' -> ' || outcome, E'\n' order by test) into out from _r;
  raise exception E'TEST RESULTS (this error is expected; it rolls everything back)\n%', out;
end $$;

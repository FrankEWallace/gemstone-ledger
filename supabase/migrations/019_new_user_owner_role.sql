-- ============================================================
-- 019: New org creators are owners (auto-provision trigger)
--
-- The real signup path is the on_auth_user_created trigger
-- (public.handle_new_user), which provisions org/profile/site/role from the
-- signup metadata. After migration 017 added user_profiles.org_role, this
-- trigger still inserted the profile WITHOUT org_role, so org creators
-- defaulted to 'member' — and the "org admins manage sites" policy (also from
-- 017) then blocked them from managing sites in their own org.
--
-- Fix: the non-invited creator path inserts org_role = 'owner'. The invited
-- path (handle_invited_user_signup) is unchanged and correctly leaves the
-- 'member' default.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_org_id  uuid;
  v_site_id uuid;
  v_slug    text;
  v_name    text;
begin
  -- Invited users (org_id in metadata) are handled by handle_invited_user_signup.
  if new.raw_user_meta_data ? 'org_id' then
    return new;
  end if;

  -- Idempotency guard — never double-provision.
  if exists (select 1 from user_profiles where id = new.id) then
    return new;
  end if;

  v_name := coalesce(nullif(new.raw_user_meta_data->>'org_name', ''), 'My Organization');
  v_slug := coalesce(nullif(new.raw_user_meta_data->>'org_slug', ''),
                     'org-' || substr(new.id::text, 1, 8));

  -- slug has a UNIQUE index; guarantee uniqueness so a collision can't abort signup.
  if exists (select 1 from organizations where slug = v_slug) then
    v_slug := v_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

  insert into organizations (name, slug)
  values (v_name, v_slug)
  returning id into v_org_id;

  -- The creator of a new org is its owner.
  insert into user_profiles (id, org_id, full_name, org_role)
  values (new.id, v_org_id, new.raw_user_meta_data->>'full_name', 'owner');

  insert into sites (org_id, name)
  values (v_org_id, 'Main Site')
  returning id into v_site_id;

  insert into user_site_roles (user_id, site_id, role)
  values (new.id, v_site_id, 'admin');

  return new;
end;
$function$;

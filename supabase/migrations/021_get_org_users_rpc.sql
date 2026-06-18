-- 021: get_org_users RPC
-- The Roles & Permissions page needs every org member plus their per-site roles.
-- RLS on user_site_roles only exposes a caller's OWN roles, so a plain client
-- query can never assemble other members' roles. This SECURITY DEFINER function
-- bypasses that safely: it returns data only when the caller is a member of the
-- requested org, and pulls email from auth.users (not exposed to the client).

create or replace function public.get_org_users(p_org_id uuid)
returns table (
  id uuid,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz,
  org_role text,
  site_roles json
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    u.email::text,
    p.avatar_url,
    p.created_at,
    p.org_role,
    coalesce(
      (
        select json_agg(
                 json_build_object('site_id', usr.site_id, 'site_name', s.name, 'role', usr.role)
                 order by s.name
               )
        from public.user_site_roles usr
        join public.sites s on s.id = usr.site_id
        where usr.user_id = p.id and s.org_id = p_org_id
      ),
      '[]'::json
    ) as site_roles
  from public.user_profiles p
  left join auth.users u on u.id = p.id
  where p.org_id = p_org_id
    and public.is_org_member(p_org_id)
  order by p.created_at;
$$;

revoke all on function public.get_org_users(uuid) from anon;
grant execute on function public.get_org_users(uuid) to authenticated;

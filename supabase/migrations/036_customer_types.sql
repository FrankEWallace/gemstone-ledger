-- Client types: a per-org, admin-managed lookup that refines "external" clients
-- (e.g. Carbon Pulp). customers.type stays the coarse internal/external flag;
-- Internal Operations remains the only internal client.

create table if not exists public.customer_types (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  sort_order integer not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists customer_types_org_name_key
  on public.customer_types (org_id, lower(name));
create index if not exists customer_types_org_idx on public.customer_types (org_id);

alter table public.customer_types enable row level security;

drop policy if exists "org_members_read_customer_types" on public.customer_types;
create policy "org_members_read_customer_types"
  on public.customer_types for select
  using (org_id in (select up.org_id from public.user_profiles up where up.id = auth.uid()));

drop policy if exists "org_managers_manage_customer_types" on public.customer_types;
create policy "org_managers_manage_customer_types"
  on public.customer_types for all
  using (public.is_org_member(org_id) and public.is_org_manager())
  with check (public.is_org_member(org_id) and public.is_org_manager());

alter table public.customers
  add column if not exists customer_type_id uuid references public.customer_types(id) on delete set null;
create index if not exists customers_customer_type_id_idx on public.customers (customer_type_id);

-- Starter type for every existing org; admins can rename or archive it.
insert into public.customer_types (org_id, name, sort_order)
select id, 'Carbon Pulp', 0 from public.organizations
on conflict do nothing;

-- Reports: the breakdown label is the subtype when set, else the coarse flag.
create or replace function public.report_customer_summaries(p_site_id uuid, p_from date, p_to date)
 returns table(customer_id uuid, customer_name text, customer_type text, total_income numeric, total_expenses numeric, net_profit numeric, transaction_count integer, expenses_by_category jsonb)
 language sql
 stable
 set search_path to 'public'
as $function$
  with base as (
    select
      t.customer_id,
      coalesce(c.name, 'Unknown') as customer_name,
      case when c.type = 'internal' then 'internal'
           else coalesce(ct.name, c.type, 'external') end as customer_type,
      t.type,
      t.unit_price,
      t.quantity,
      coalesce(ec.name, t.category, 'Uncategorized') as expense_category_label
    from transactions t
    left join customers c on c.id = t.customer_id
    left join customer_types ct on ct.id = c.customer_type_id
    left join expense_categories ec on ec.id = t.expense_category_id
    where t.site_id = p_site_id
      and t.status <> 'cancelled'
      and t.customer_id is not null
      and t.transaction_date >= p_from
      and t.transaction_date <= p_to
  ),
  per_customer as (
    select
      customer_id,
      max(customer_name) as customer_name,
      max(customer_type) as customer_type,
      round(coalesce(sum(unit_price * quantity) filter (where type = 'income'), 0)::numeric, 2) as total_income,
      round(coalesce(sum(unit_price * quantity) filter (where type <> 'income'), 0)::numeric, 2) as total_expenses,
      count(*)::int as transaction_count
    from base
    group by customer_id
  ),
  category_totals as (
    select
      customer_id,
      expense_category_label,
      round(sum(unit_price * quantity)::numeric, 2) as cat_total
    from base
    where type <> 'income'
    group by customer_id, expense_category_label
  ),
  category_json as (
    select
      customer_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object('category', expense_category_label, 'total', cat_total)
          order by cat_total desc
        ) filter (where expense_category_label is not null),
        '[]'::jsonb
      ) as expenses_by_category
    from category_totals
    group by customer_id
  )
  select
    pc.customer_id,
    pc.customer_name,
    pc.customer_type,
    pc.total_income,
    pc.total_expenses,
    round((pc.total_income - pc.total_expenses)::numeric, 2) as net_profit,
    pc.transaction_count,
    coalesce(cj.expenses_by_category, '[]'::jsonb) as expenses_by_category
  from per_customer pc
  left join category_json cj on cj.customer_id = pc.customer_id;
$function$;

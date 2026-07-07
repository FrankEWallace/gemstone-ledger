-- 027: Server-side report aggregates.
--
-- Background: every report page and the dashboard fetched every matching
-- transaction row into the browser and reduced them in JS loops (monthly
-- trend, category breakdowns, report summary, per-customer totals, customer
-- summaries). On a busy site this is a multi-megabyte, ever-growing payload
-- per page view. These functions return the aggregates instead of the raw
-- rows; the reduction logic they replace is pinned in
-- src/services/reports.aggregators.ts + reports.aggregators.test.ts, which
-- served as the semantic reference while writing this SQL.
--
-- SECURITY INVOKER: these are read-only aggregate functions, so we run them
-- as the calling user rather than the function owner. RLS on transactions /
-- shift_records (site-scoped, see 001_initial_schema.sql /
-- 005_rls_audit.sql) then applies automatically and no explicit access
-- check is needed inside the function body.
--
-- Semantics preserved exactly from the TS reducers (NOT fixed here, see
-- reports.aggregators.ts header comment for the full rationale):
--   - report_monthly_trend / report_category_breakdown / report_summary
--     do NOT filter by status — cancelled transactions are included.
--   - report_customer_totals / report_customer_summaries DO filter out
--     status = 'cancelled' and require customer_id is not null. This
--     inconsistency predates this migration and is intentionally left
--     as-is; it's a follow-up question for the maintainer, not something
--     to silently unify.
--   - report_category_breakdown falls back to 'Uncategorised' (British
--     spelling) for a null category.
--   - report_customer_summaries falls back to 'Uncategorized' (American
--     spelling with a z) for the expense-category label.
--
-- getProductionByDay (shift_records by day) is deferred — no SQL function
-- here; it continues to run through the TS aggregator.

-- 1. Monthly trend: income/expenses summed per month, no status filter.
create or replace function public.report_monthly_trend(
  p_site_id uuid,
  p_from    date,
  p_to      date
)
returns table (month text, income numeric, expenses numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    to_char(transaction_date, 'YYYY-MM') as month,
    coalesce(sum(unit_price * quantity) filter (where type = 'income'), 0) as income,
    coalesce(sum(unit_price * quantity) filter (where type <> 'income'), 0) as expenses
  from transactions
  where site_id = p_site_id
    and transaction_date >= p_from
    and transaction_date <= p_to
  group by 1
  order by 1;
$$;

revoke all on function public.report_monthly_trend(uuid, date, date) from public, anon;
grant execute on function public.report_monthly_trend(uuid, date, date) to authenticated, service_role;

-- 2. Category breakdown: one function for both expense and income via
--    p_type, matching getExpensesByCategory / getIncomeByCategory. No
--    status filter. Optional customer_id filter (matches the TS signature).
create or replace function public.report_category_breakdown(
  p_site_id     uuid,
  p_from        date,
  p_to          date,
  p_type        text,
  p_customer_id uuid default null
)
returns table (category text, total numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(category, 'Uncategorised') as category,
    sum(unit_price * quantity) as total
  from transactions
  where site_id = p_site_id
    and type = p_type
    and transaction_date >= p_from
    and transaction_date <= p_to
    and (p_customer_id is null or customer_id = p_customer_id)
  group by 1
  order by 2 desc;
$$;

revoke all on function public.report_category_breakdown(uuid, date, date, text, uuid) from public, anon;
grant execute on function public.report_category_breakdown(uuid, date, date, text, uuid) to authenticated, service_role;

-- 3. Report summary: transactions (no status filter) + shift_records,
--    combined via two CTEs into a single row.
create or replace function public.report_summary(
  p_site_id uuid,
  p_from    date,
  p_to      date
)
returns table (
  total_income        numeric,
  total_expenses      numeric,
  net_revenue         numeric,
  transaction_count   integer,
  total_shifts_logged integer,
  total_hours_worked  numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with tx as (
    select
      coalesce(sum(unit_price * quantity) filter (where type = 'income'), 0) as total_income,
      coalesce(sum(unit_price * quantity) filter (where type <> 'income'), 0) as total_expenses,
      count(*) as transaction_count
    from transactions
    where site_id = p_site_id
      and transaction_date >= p_from
      and transaction_date <= p_to
  ),
  shifts as (
    select
      count(*) as total_shifts_logged,
      coalesce(sum(hours_worked), 0) as total_hours_worked
    from shift_records
    where site_id = p_site_id
      and shift_date >= p_from
      and shift_date <= p_to
  )
  select
    tx.total_income,
    tx.total_expenses,
    tx.total_income - tx.total_expenses as net_revenue,
    tx.transaction_count::int,
    shifts.total_shifts_logged::int,
    shifts.total_hours_worked
  from tx, shifts;
$$;

revoke all on function public.report_summary(uuid, date, date) from public, anon;
grant execute on function public.report_summary(uuid, date, date) to authenticated, service_role;

-- 4. Per-customer totals (type-specific): excludes cancelled transactions
--    and requires customer_id is not null, matching getExpensesByCustomer /
--    getIncomeByCustomer.
create or replace function public.report_customer_totals(
  p_site_id uuid,
  p_from    date,
  p_to      date,
  p_type    text
)
returns table (customer_id uuid, customer_name text, total numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.customer_id,
    coalesce(c.name, 'Unknown') as customer_name,
    round(sum(t.unit_price * t.quantity)::numeric, 2) as total
  from transactions t
  left join customers c on c.id = t.customer_id
  where t.site_id = p_site_id
    and t.type = p_type
    and t.status <> 'cancelled'
    and t.customer_id is not null
    and t.transaction_date >= p_from
    and t.transaction_date <= p_to
  group by t.customer_id, c.name
  order by total desc;
$$;

revoke all on function public.report_customer_totals(uuid, date, date, text) from public, anon;
grant execute on function public.report_customer_totals(uuid, date, date, text) to authenticated, service_role;

-- 5. Customer summaries: per-customer income/expenses/net/count plus a
--    nested expenses-by-category breakdown, matching getCustomerSummaries.
--    Excludes cancelled transactions and requires customer_id is not null.
create or replace function public.report_customer_summaries(
  p_site_id uuid,
  p_from    date,
  p_to      date
)
returns table (
  customer_id         uuid,
  customer_name       text,
  customer_type       text,
  total_income        numeric,
  total_expenses      numeric,
  net_profit          numeric,
  transaction_count   integer,
  expenses_by_category jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select
      t.customer_id,
      coalesce(c.name, 'Unknown') as customer_name,
      coalesce(c.type, 'external') as customer_type,
      t.type,
      t.unit_price,
      t.quantity,
      coalesce(ec.name, t.category, 'Uncategorized') as expense_category_label
    from transactions t
    left join customers c on c.id = t.customer_id
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
$$;

revoke all on function public.report_customer_summaries(uuid, date, date) from public, anon;
grant execute on function public.report_customer_summaries(uuid, date, date) to authenticated, service_role;

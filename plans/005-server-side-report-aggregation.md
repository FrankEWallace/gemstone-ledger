# Plan 005: Move report aggregation into Postgres and bound the transactions fetch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 0e0bf99..HEAD -- src/services/reports.service.ts src/services/transactions.service.ts src/pages/Dashboard.tsx supabase/migrations`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (money math moves from TS to SQL — behavior must be preserved exactly)
- **Depends on**: none (but coordinate migration numbering with plans 002/004)
- **Category**: perf
- **Planned at**: commit `0e0bf99`, 2026-07-07

## Why this matters

Every report page and the dashboard currently fetch **every matching
transaction row** into the browser and reduce them in JS loops: monthly trend,
category breakdowns, report summary, per-customer totals, and customer
summaries all scan the full date-range row set. The dashboard additionally
fetches the current period's transactions twice (once raw, once inside
`getCustomerSummaries`) plus the previous period. On a busy site this is a
multi-megabyte, ever-growing payload per page view; the database should return
the aggregates. Separately, `getTransactions` is `select("*")` with no limit —
an unbounded fetch that grows forever.

Strategy — three phases, each independently shippable:

1. **Extract the JS reducers into pure functions and pin them with unit
   tests.** These tests become the oracle for the SQL.
2. **Add one SQL migration with aggregate RPCs** mirroring each reducer, and
   switch `reports.service.ts` to call them.
3. **Bound `getTransactions`** with a default limit and explicit paging.

## Current state

Relevant files:

- `src/services/reports.service.ts` (394 lines) — all report queries. Each
  exported function has three branches, in order: `isDemoMode()` →
  `isRestActive()` (delegates to a REST endpoint) → supabase fetch + JS
  reduce. **Only the third branch changes.**
- `src/services/transactions.service.ts:36-72` — `getTransactions`:
  `select("*")` + filters, no `.range()`/`.limit()`.
- `src/pages/Dashboard.tsx:86-124` — four `useQuery` calls (current
  transactions, previous transactions, customers, customer summaries);
  `sumKpis` recomputed per render (lines 116-124, not memoized — minor).
- `src/lib/formatCurrency.test.ts` — exemplar for a pure-function Vitest
  suite.
- `supabase/migrations/025_lockdown_signup_rpcs.sql` — exemplar migration
  style (SECURITY DEFINER, search_path, revoke/grant).

### The reducer shapes to preserve (read the full file before starting)

`getMonthlyTrend` (`reports.service.ts:36-67`): selects
`type, unit_price, quantity, transaction_date`, groups by `month =
transaction_date.slice(0, 7)`, sums `unit_price * quantity` into
income/expenses, sorts by month ascending. **Includes cancelled
transactions** (no status filter) — preserve that, see "semantic quirks".

`getExpensesByCategory` / `getIncomeByCategory` (69-139): filter
`type = expense|income`, optional `customer_id`, group by `category ?? 
"Uncategorised"`, sort total descending. **No status filter. Note the spelling
"Uncategorised" here.**

`getReportSummary` (141-189): two parallel queries (transactions + 
`shift_records.hours_worked`), returns
`{ totalIncome, totalExpenses, netRevenue, transactionCount, totalShiftsLogged, totalHoursWorked }`.
**No status filter.**

`getExpensesByCustomer` / `getIncomeByCustomer` (224-290): join
`customers(name)`, filter `.neq("status", "cancelled")` and
`customer_id not null`, group by customer, `Math.round(total * 100) / 100`,
sort descending.

`getCustomerSummaries` (311-375): joins `customers(name, type)` and
`expense_categories(name)`, filters `.neq("status", "cancelled")` and
`customer_id not null`, per-customer income/expenses/net/count plus a nested
`expensesByCategory` (category name = `expense_categories.name ?? category ??
"Uncategorized"` — **note the different spelling with a "z"**), all rounded to
2dp, categories sorted by total descending.

`getProductionByDay` (191-220): aggregates `shift_records` by date. Include it
in the extraction/tests, and in SQL only if time permits — it's smaller data;
marking it deferred is acceptable.

`getCustomerDetail` (377-393): supabase path just filters
`getCustomerSummaries` — it inherits the fix automatically.

### Semantic quirks to preserve, NOT fix silently

- Monthly trend / category breakdowns / report summary include cancelled
  transactions; per-customer functions exclude them. This inconsistency is
  suspicious but **intentional-until-decided**: replicate it exactly in SQL so
  totals do not change when this plan ships. Record it in the PR description
  as a follow-up question for the maintainer.
- Two spellings: "Uncategorised" (category breakdowns) vs "Uncategorized"
  (customer summaries). Preserve both.
- Dashboard KPIs (`Dashboard.tsx sumKpis`) count only `status === "success"` —
  a third convention. Out of scope to unify.

### Conventions

- Service triple-branch order: demo → REST → supabase. Don't disturb the first
  two.
- Money rounding: `Math.round(x * 100) / 100` in TS → `round(x::numeric, 2)`
  in SQL.
- Migrations: numbered file, header comment, SECURITY DEFINER +
  `set search_path = public`, revoke/grant (see 025). RPCs must enforce site
  access themselves since SECURITY DEFINER bypasses RLS — use the same
  site-membership check as plans 004 (inline
  `exists (select 1 from user_site_roles where user_id = auth.uid() and site_id = p_site_id)`;
  do not rely on `has_site_access` — it may reference a legacy table).
  Alternatively write the functions as `security invoker` (then RLS applies
  and no explicit check is needed) — **prefer SECURITY INVOKER here**; these
  are read-only aggregates and invoker + RLS is strictly simpler and safer.
- **Migration divergence warning**: you only write the migration file; the
  operator verifies against prod and applies it. Never apply to a remote DB.
- Tests: Vitest; pure-function suites follow `src/lib/formatCurrency.test.ts`.
- No emoji in code, commits, or PR text.

## Commands you will need

| Purpose   | Command                                        | Expected on success |
|-----------|------------------------------------------------|---------------------|
| Typecheck | `npx tsc -p tsconfig.app.json --noEmit`        | exit 0              |
| All tests | `npm run test`                                 | all pass            |
| One file  | `npx vitest run src/services/reports.aggregators.test.ts` | all pass |
| Lint      | `npm run lint`                                 | exit 0, 0 errors    |
| Build     | `npm run build`                                | exit 0              |

## Scope

**In scope** (the only files you should modify/create):

- `src/services/reports.service.ts`
- `src/services/reports.aggregators.ts` (create — extracted pure reducers)
- `src/services/reports.aggregators.test.ts` (create)
- `src/services/transactions.service.ts` (only `getTransactions`)
- `src/pages/Dashboard.tsx` (only the KPI queries/memoization)
- `src/pages/transactions/TransactionsPage.tsx` (only if getTransactions'
  new signature requires it — keep the default such that existing callers
  compile unchanged)
- `supabase/migrations/028_report_aggregates.sql` (create; if 028 is taken,
  use the next free number)

**Out of scope** (do NOT touch):

- The `isDemoMode()` / `isRestActive()` branches and the REST client.
- `kpi.service.ts` and every report PAGE component
  (`src/pages/reports/*`) — they consume the same service functions and must
  keep working unchanged.
- The cancelled-status inconsistency (preserve, document, don't fix).
- `shift_records`-based `getProductionByDay` SQL (extraction+tests yes; SQL
  optional/deferred).
- `RecentTransactions` and other dashboard widgets beyond the KPI queries.

## Git workflow

- Branch: `advisor/005-server-side-report-aggregation` (from `main`).
- Commits per phase (extraction/tests, SQL+switch, pagination), short
  imperative, no emoji.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract pure aggregators with tests (no behavior change)

Create `src/services/reports.aggregators.ts` exporting one pure function per
reducer, taking the raw row arrays the current code gets from supabase, e.g.:

```ts
export function aggregateMonthlyTrend(rows: Array<{ type: string; unit_price: number; quantity: number; transaction_date: string }>): MonthlyTrend[]
export function aggregateCategoryBreakdown(rows: ...): CategoryBreakdown[]
export function aggregateReportSummary(txRows: ..., shiftRows: ...): ReportSummary
export function aggregateCustomerTotals(rows: ...): CustomerTotal[]
export function aggregateCustomerSummaries(rows: ...): CustomerSummary[]
export function aggregateProductionByDay(rows: ...): ProductionSummary[]
```

Move the loop bodies verbatim from `reports.service.ts`; the service functions
now fetch and delegate. Types `MonthlyTrend` etc. stay exported from
`reports.service.ts` (import them, or move them to the new file and re-export —
keep every existing import path in pages compiling).

Create `src/services/reports.aggregators.test.ts` (pattern:
`formatCurrency.test.ts`). Table-driven cases per function:

- happy path with 3-5 rows across groups
- empty input → empty output / zeroed summary
- null `category` → "Uncategorised" (breakdowns) and null
  `expense_categories` + null `category` → "Uncategorized" (summaries)
- rounding: totals land on exactly 2dp (e.g. 0.1 + 0.2 cases)
- cancelled rows: INCLUDED in trend/breakdown/summary aggregators (the fetch
  layer, not the aggregator, applies the customer functions' cancelled
  filter — reflect reality: customer aggregators receive pre-filtered rows,
  so their tests don't include cancelled rows; add a comment saying the filter
  lives in the query)
- sort orders (month asc; totals desc)

**Verify**: `npm run test` → all pass;
`npx tsc -p tsconfig.app.json --noEmit` → exit 0. Report pages behave
identically (pure refactor).

### Step 2: SQL aggregate RPCs

Create `supabase/migrations/028_report_aggregates.sql` with SECURITY INVOKER
functions (RLS applies — no manual access checks needed), one per reducer.
Naming and return shapes mirror the TS types with snake_case columns:

```sql
-- 028: Server-side report aggregates.
-- Report pages previously fetched every matching transaction row and reduced
-- in the browser; these functions return the aggregates instead. SECURITY
-- INVOKER: RLS on transactions/shift_records scopes rows to the caller.

create or replace function public.report_monthly_trend(
  p_site_id uuid, p_from date, p_to date
)
returns table (month text, income numeric, expenses numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select to_char(transaction_date, 'YYYY-MM') as month,
         coalesce(sum(unit_price * quantity) filter (where type = 'income'), 0) as income,
         coalesce(sum(unit_price * quantity) filter (where type <> 'income'), 0) as expenses
  from transactions
  where site_id = p_site_id
    and transaction_date >= p_from
    and transaction_date <= p_to
  group by 1
  order by 1;
$$;
```

Write the remaining functions the same way:

- `report_category_breakdown(p_site_id, p_from, p_to, p_type text, p_customer_id uuid default null)`
  → `(category text, total numeric)`; `coalesce(category, 'Uncategorised')`,
  order by total desc. (One function serving both expense/income via `p_type`.)
- `report_summary(p_site_id, p_from, p_to)` → one row
  `(total_income numeric, total_expenses numeric, net_revenue numeric, transaction_count int, total_shifts_logged int, total_hours_worked numeric)`
  (transactions + shift_records; two CTEs).
- `report_customer_totals(p_site_id, p_from, p_to, p_type text)` →
  `(customer_id uuid, customer_name text, total numeric)`; joins customers,
  `status <> 'cancelled'`, `customer_id is not null`,
  `round(sum(...), 2)`, order desc.
- `report_customer_summaries(p_site_id, p_from, p_to)` → the flat variant:
  `(customer_id uuid, customer_name text, customer_type text, total_income numeric, total_expenses numeric, net_profit numeric, transaction_count int, expenses_by_category jsonb)`
  — build `expenses_by_category` with a lateral/nested
  `jsonb_agg(jsonb_build_object('category', cat, 'total', total) order by total desc)`
  using `coalesce(expense_categories.name, transactions.category, 'Uncategorized')`.

End the file with `revoke all ... from public, anon; grant execute ... to
authenticated, service_role;` per function (match 025's style — even though
invoker functions are safe, the repo convention is explicit grants).

Semantics guard: trend/breakdown/summary have NO status filter; customer
functions filter cancelled — copy from the excerpts, not from intuition.

**Verify**: `grep -c "create or replace function" supabase/migrations/028_report_aggregates.sql` → 5;
`grep -c "security invoker" supabase/migrations/028_report_aggregates.sql` → 5.

### Step 3: Switch reports.service.ts to the RPCs (keep fallback)

For each function, replace the supabase fetch+reduce with the RPC call,
mapping snake_case → the existing return types:

```ts
const { data, error } = await supabase.rpc("report_monthly_trend", {
  p_site_id: siteId, p_from: dateFrom, p_to: dateTo,
});
if (error) throw error;
return (data ?? []).map((r) => ({ month: r.month, income: Number(r.income), expenses: Number(r.expenses) }));
```

- `Number(...)` every numeric — Postgres `numeric` arrives as string via
  PostgREST.
- Until `supabaseTypes.ts` is regenerated (operator does that after applying
  028), the rpc names won't typecheck; use a single
  `supabase.rpc("report_monthly_trend" as never, {...} as never)` cast with a
  `// TODO: regenerate supabaseTypes after migration 028` comment, and type
  the response rows locally.
- Keep the pure aggregators exported and tested — they remain the documented
  reference semantics and are still used by any code path you did NOT switch
  (e.g. `getProductionByDay` if you defer its SQL).
- `getCustomerDetail` needs no change (it delegates to `getCustomerSummaries`).

**Verify**: `npm run test` → all pass;
`npx tsc -p tsconfig.app.json --noEmit` → exit 0;
`grep -c "from(\"transactions\")" src/services/reports.service.ts` → 0.

### Step 4: Dashboard — stop double-fetching and memoize KPIs

In `src/pages/Dashboard.tsx`:

- Wrap the KPI derivations in `useMemo`: `const curr = useMemo(() =>
  sumKpis(filteredTxs), [filteredTxs]); const prev = useMemo(() =>
  sumKpis(prevTxs), [prevTxs]);` (move `sumKpis` above or out of the
  component so it isn't a new function each render).
- Replace the previous-period raw-row query with the new `report_summary` RPC
  via `getReportSummary(activeSiteId, prevFrom, prevTo)` **only if** the trend
  math tolerates it — CAUTION: `sumKpis` counts only `status === "success"`
  rows while `report_summary` has no status filter, so totals could differ. If
  they differ, leave the prev-period query as-is and note it; correctness
  beats the optimization. (This is a judgment gate: prefer no change over
  changed numbers.)
- The current-period `txs` query stays — the dashboard genuinely renders the
  row list (RecentTransactions/customer filter).

**Verify**: `npx tsc -p tsconfig.app.json --noEmit` → exit 0; open the
dashboard in dev (`npm run dev`) if feasible and confirm KPI numbers match the
values before your change for the same data (demo mode works offline:
VITE demo mode — see `src/lib/demo`); otherwise state that manual check is
pending for the operator.

### Step 5: Bound getTransactions

In `transactions.service.ts`, extend the filters type with
`limit?: number; offset?: number` and apply:

```ts
const limit = filters?.limit ?? 500;
const offset = filters?.offset ?? 0;
query = query.range(offset, offset + limit - 1);
```

Default 500 keeps every existing caller working (dashboard periods and the
transactions list render well under that today) while capping the worst case.
Do NOT convert pages to `useInfiniteQuery` in this plan — that UI work is
deferred; the cap is the safety win. Add the defaults to the REST branch too
(`params.set("limit", ...)`) so both providers agree.

**Verify**: `grep -n "range(" src/services/transactions.service.ts` → one
match; `npm run test` → all pass.

### Step 6: Full gate

**Verify**: `npx tsc -p tsconfig.app.json --noEmit` → exit 0; `npm run lint` →
0 errors; `npm run build` → exit 0; `npm run test` → all pass.

## Test plan

Step 1's aggregator suite is the core (≥12 cases across 6 functions; the SQL
oracle). Step 4-5 rely on typecheck + existing e2e smoke. SQL functions have
no local harness — the PR must state that the operator should sanity-compare
one site's report page totals before/after applying 028 (the aggregator tests
define expected semantics).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `src/services/reports.aggregators.ts` + `.test.ts` exist; `npm run test` passes with ≥12 new cases
- [ ] `supabase/migrations/028_report_aggregates.sql` exists; Step 2 greps pass (5 functions, invoker)
- [ ] `grep -c "from(\"transactions\")" src/services/reports.service.ts` → 0
- [ ] `getTransactions` applies `.range()` with a default cap
- [ ] `Dashboard.tsx` memoizes `curr`/`prev` KPI sums
- [ ] Demo-mode and REST branches in `reports.service.ts` byte-identical to before (`git diff` shows no hunks touching those branches)
- [ ] `npx tsc -p tsconfig.app.json --noEmit` exits 0; `npm run lint` 0 errors; `npm run build` exits 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any aggregator's extracted behavior can't be replicated exactly in SQL
  (e.g. a tie-break sort order the test suite pins but SQL can't reproduce
  deterministically) — report the specific function.
- `transactions.unit_price`/`quantity` turn out to be nullable in
  `supabaseTypes.ts` in a way the TS code ignores but SQL must handle —
  decide `coalesce(...,0)` ONLY if the TS behavior is equivalent (NaN
  propagation differs!); otherwise stop and ask.
- The dashboard prev-period switch changes KPI numbers (Step 4 caution) — skip
  that sub-step, note it, continue.
- Migration 028's number collides and renumbering cascades into plans 002/004
  references — coordinate via plans/README.md.
- You are tempted to apply the migration to a remote database — operator step.

## Maintenance notes

- Operator, after applying 028: regenerate `supabaseTypes.ts` and drop the
  `as never` casts.
- Reviewer should scrutinize: status-filter parity per function (the
  cancelled-rows quirk), `Number(...)` coercion of numeric columns, and that
  demo/REST branches are untouched.
- Open product question recorded here on purpose: should trend/breakdown/
  summary exclude cancelled transactions like the customer reports do? A
  one-line SQL change once decided — but decide it, don't drift into it.
- Follow-up deferred: `useInfiniteQuery` pagination UI for the transactions
  page; `getProductionByDay` SQL; unifying the three status conventions
  (success-only vs non-cancelled vs all).

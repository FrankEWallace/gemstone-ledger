// ─── Pure aggregators for report data ────────────────────────────────────────
//
// These functions extract the JS-side reduce logic that used to live inline
// in reports.service.ts. They take the raw row arrays as returned by
// supabase and produce the same shapes the report pages already consume.
// They are the semantic oracle for the SQL aggregate RPCs added in
// migration 026_report_aggregates.sql — the SQL must reproduce these results
// exactly, including the two quirks below.
//
// Quirks preserved intentionally (NOT bugs to fix here):
//   - Monthly trend / category breakdowns / report summary include
//     cancelled transactions (no status filter). Per-customer aggregators
//     (customer totals, customer summaries) exclude cancelled transactions.
//     This inconsistency predates this change and is tracked as a follow-up
//     question for the maintainer, not fixed silently.
//   - Category breakdowns use the fallback label "Uncategorised" (British
//     spelling) while customer summaries use "Uncategorized" (American
//     spelling with a z). Both spellings are preserved as-is.
//
// Customer aggregators (aggregateCustomerTotals, aggregateCustomerSummaries)
// expect the caller to have already applied the "not cancelled" / "customer_id
// not null" filters in the query — these pure functions do not re-filter.

import type { CustomerSummary } from "@/lib/supabaseTypes";

export type MonthlyTrend = { month: string; income: number; expenses: number };
export type CategoryBreakdown = { category: string; total: number };
export type CustomerTotal = { customerId: string; customerName: string; total: number };
export type ReportSummary = {
  totalIncome: number;
  totalExpenses: number;
  netRevenue: number;
  transactionCount: number;
  totalShiftsLogged: number;
  totalHoursWorked: number;
};
export type ProductionSummary = {
  date: string;
  totalHours: number;
  totalOutput: number;
  shiftsLogged: number;
};

// ─── Monthly trend ────────────────────────────────────────────────────────────

export function aggregateMonthlyTrend(
  rows: Array<{ type: string; unit_price: number; quantity: number; transaction_date: string }>
): MonthlyTrend[] {
  const map: Record<string, { income: number; expenses: number }> = {};
  for (const row of rows) {
    const month = row.transaction_date.slice(0, 7);
    if (!map[month]) map[month] = { income: 0, expenses: 0 };
    const amount = row.unit_price * row.quantity;
    if (row.type === "income") map[month].income += amount;
    else map[month].expenses += amount;
  }

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));
}

// ─── Category breakdown (expense / income) ──────────────────────────────────

export function aggregateCategoryBreakdown(
  rows: Array<{ category: string | null; unit_price: number; quantity: number }>
): CategoryBreakdown[] {
  const map: Record<string, number> = {};
  for (const row of rows) {
    const cat = row.category ?? "Uncategorised";
    map[cat] = (map[cat] ?? 0) + row.unit_price * row.quantity;
  }

  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .map(([category, total]) => ({ category, total }));
}

// ─── Report summary ──────────────────────────────────────────────────────────

export function aggregateReportSummary(
  txRows: Array<{ type: string; unit_price: number; quantity: number }>,
  shiftRows: Array<{ hours_worked: number | null }>
): ReportSummary {
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const row of txRows) {
    const amount = row.unit_price * row.quantity;
    if (row.type === "income") totalIncome += amount;
    else totalExpenses += amount;
  }

  const totalShiftsLogged = shiftRows.length;
  const totalHoursWorked = shiftRows.reduce((sum, r) => sum + (r.hours_worked ?? 0), 0);

  return {
    totalIncome,
    totalExpenses,
    netRevenue: totalIncome - totalExpenses,
    transactionCount: txRows.length,
    totalShiftsLogged,
    totalHoursWorked,
  };
}

// ─── Production by day ───────────────────────────────────────────────────────

export function aggregateProductionByDay(
  rows: Array<{ shift_date: string; hours_worked: number | null; output_metric: number | null }>
): ProductionSummary[] {
  const map: Record<string, ProductionSummary> = {};
  for (const row of rows) {
    if (!map[row.shift_date])
      map[row.shift_date] = { date: row.shift_date, totalHours: 0, totalOutput: 0, shiftsLogged: 0 };
    map[row.shift_date].totalHours += row.hours_worked ?? 0;
    map[row.shift_date].totalOutput += row.output_metric ?? 0;
    map[row.shift_date].shiftsLogged += 1;
  }

  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Per-customer totals (type-specific) ─────────────────────────────────────
//
// Caller must pre-filter: status <> 'cancelled' and customer_id is not null.

export function aggregateCustomerTotals(
  rows: Array<{ unit_price: number; quantity: number; customer_id: string | null; customers: { name: string } | null }>
): CustomerTotal[] {
  const map: Record<string, { customerName: string; total: number }> = {};
  for (const row of rows) {
    const cid = row.customer_id as string;
    if (!map[cid]) map[cid] = { customerName: row.customers?.name ?? "Unknown", total: 0 };
    map[cid].total += row.unit_price * row.quantity;
  }

  return Object.entries(map)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([customerId, v]) => ({ customerId, customerName: v.customerName, total: Math.round(v.total * 100) / 100 }));
}

// ─── Customer summaries ───────────────────────────────────────────────────────
//
// Caller must pre-filter: status <> 'cancelled' and customer_id is not null.

export function aggregateCustomerSummaries(
  rows: Array<{
    type: string;
    unit_price: number;
    quantity: number;
    category: string | null;
    customer_id: string | null;
    customers: { name: string; type: string } | null;
    expense_categories: { name: string } | null;
  }>
): CustomerSummary[] {
  const map: Record<string, CustomerSummary> = {};
  for (const row of rows) {
    const cid = row.customer_id as string;
    if (!map[cid]) {
      map[cid] = {
        customerId: cid,
        customerName: row.customers?.name ?? "Unknown",
        customerType: (row.customers?.type ?? "external") as "external" | "internal",
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0,
        transactionCount: 0,
        expensesByCategory: [],
      };
    }
    const amount = row.unit_price * row.quantity;
    const entry = map[cid];
    entry.transactionCount += 1;
    if (row.type === "income") {
      entry.totalIncome += amount;
    } else {
      entry.totalExpenses += amount;
      const catName = row.expense_categories?.name ?? row.category ?? "Uncategorized";
      const catEntry = entry.expensesByCategory.find((c) => c.category === catName);
      if (catEntry) catEntry.total += amount;
      else entry.expensesByCategory.push({ category: catName, total: amount });
    }
  }

  return Object.values(map).map((s) => ({
    ...s,
    totalIncome: Math.round(s.totalIncome * 100) / 100,
    totalExpenses: Math.round(s.totalExpenses * 100) / 100,
    netProfit: Math.round((s.totalIncome - s.totalExpenses) * 100) / 100,
    expensesByCategory: s.expensesByCategory
      .map((c) => ({ ...c, total: Math.round(c.total * 100) / 100 }))
      .sort((a, b) => b.total - a.total),
  }));
}

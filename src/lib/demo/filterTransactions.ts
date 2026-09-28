import type { Transaction } from "@/lib/supabaseTypes";
import type { TransactionFilters } from "@/services/transactions.service";

const DEFAULT_LIMIT = 500;

function matches(value: unknown, filter: string | undefined): boolean {
  return !filter || filter === "all" || value === filter;
}

/** Mirrors the Supabase query in getTransactions so demo mode filters like production. */
export function filterDemoTransactions(rows: Transaction[], filters?: TransactionFilters): Transaction[] {
  const limit = filters?.limit ?? DEFAULT_LIMIT;
  const offset = filters?.offset ?? 0;

  return rows
    .filter(
      (t) =>
        matches(t.type, filters?.type) &&
        matches(t.status, filters?.status) &&
        matches(t.category, filters?.category) &&
        matches(t.customer_id, filters?.customerId) &&
        matches(t.expense_category_id, filters?.expenseCategoryId) &&
        matches(t.phase_id, filters?.phaseId) &&
        matches(t.source, filters?.source) &&
        (!filters?.dateFrom || t.transaction_date >= filters.dateFrom) &&
        (!filters?.dateTo || t.transaction_date <= filters.dateTo),
    )
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
    .slice(offset, offset + limit);
}

/**
 * Mirrors the report_category_breakdown RPC (migration 027): no status filter,
 * null category becomes "Uncategorised", largest total first.
 */
export function demoCategoryBreakdown(
  rows: Transaction[],
  type: "income" | "expense",
  dateFrom: string,
  dateTo: string,
  customerId?: string,
): Array<{ category: string; total: number }> {
  const totals = new Map<string, number>();
  for (const t of filterDemoTransactions(rows, { type, dateFrom, dateTo, customerId, limit: Infinity })) {
    const key = t.category || "Uncategorised";
    totals.set(key, (totals.get(key) ?? 0) + t.quantity * t.unit_price);
  }
  return [...totals].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet } from "@/lib/providers/rest/client";
import { isDemoMode } from "@/lib/demo";
import type { CustomerSummary } from "@/lib/supabaseTypes";
import {
  DEMO_MONTHLY_TREND,
  DEMO_EXPENSES_BY_CATEGORY,
  DEMO_INCOME_BY_CATEGORY,
  DEMO_REPORT_SUMMARY,
  DEMO_PRODUCTION_BY_DAY,
  DEMO_CUSTOMER_SUMMARIES,
  DEMO_EXPENSES_BY_CUSTOMER,
  DEMO_INCOME_BY_CUSTOMER,
} from "@/lib/demo/data";
import {
  aggregateMonthlyTrend,
  aggregateCategoryBreakdown,
  aggregateReportSummary,
  aggregateProductionByDay,
  aggregateCustomerTotals,
  aggregateCustomerSummaries,
} from "@/services/reports.aggregators";
import type {
  MonthlyTrend,
  CategoryBreakdown,
  CustomerTotal,
  ReportSummary,
  ProductionSummary,
} from "@/services/reports.aggregators";

export type { CustomerSummary };
export type { MonthlyTrend, CategoryBreakdown, CustomerTotal, ReportSummary, ProductionSummary };

export async function getMonthlyTrend(
  siteId: string,
  dateFrom: string,
  dateTo: string
): Promise<MonthlyTrend[]> {
  if (isDemoMode()) return DEMO_MONTHLY_TREND;
  if (isRestActive())
    return restGet<MonthlyTrend[]>(
      `/reports/monthly-trend?site_id=${siteId}&from=${dateFrom}&to=${dateTo}`
    );

  const { data, error } = await supabase
    .from("transactions")
    .select("type, unit_price, quantity, transaction_date")
    .eq("site_id", siteId)
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo);
  if (error) throw error;

  return aggregateMonthlyTrend(data ?? []);
}

export async function getExpensesByCategory(
  siteId: string,
  dateFrom: string,
  dateTo: string,
  customerId?: string
): Promise<CategoryBreakdown[]> {
  if (isDemoMode()) return DEMO_EXPENSES_BY_CATEGORY;
  if (isRestActive())
    return restGet<CategoryBreakdown[]>(
      `/reports/expenses-by-category?site_id=${siteId}&from=${dateFrom}&to=${dateTo}${customerId ? `&customer_id=${customerId}` : ""}`
    );

  let query = supabase
    .from("transactions")
    .select("category, unit_price, quantity")
    .eq("site_id", siteId)
    .eq("type", "expense")
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo);

  if (customerId) query = query.eq("customer_id", customerId);

  const { data, error } = await query;
  if (error) throw error;

  return aggregateCategoryBreakdown(data ?? []);
}

export async function getIncomeByCategory(
  siteId: string,
  dateFrom: string,
  dateTo: string,
  customerId?: string
): Promise<CategoryBreakdown[]> {
  if (isDemoMode()) return DEMO_INCOME_BY_CATEGORY;
  if (isRestActive())
    return restGet<CategoryBreakdown[]>(
      `/reports/income-by-category?site_id=${siteId}&from=${dateFrom}&to=${dateTo}${customerId ? `&customer_id=${customerId}` : ""}`
    );

  let query = supabase
    .from("transactions")
    .select("category, unit_price, quantity")
    .eq("site_id", siteId)
    .eq("type", "income")
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo);

  if (customerId) query = query.eq("customer_id", customerId);

  const { data, error } = await query;
  if (error) throw error;

  return aggregateCategoryBreakdown(data ?? []);
}

export async function getReportSummary(
  siteId: string,
  dateFrom: string,
  dateTo: string
): Promise<ReportSummary> {
  if (isDemoMode()) return DEMO_REPORT_SUMMARY;
  if (isRestActive())
    return restGet<ReportSummary>(
      `/reports/summary?site_id=${siteId}&from=${dateFrom}&to=${dateTo}`
    );

  const [{ data: txData }, { data: shiftData }] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, unit_price, quantity")
      .eq("site_id", siteId)
      .gte("transaction_date", dateFrom)
      .lte("transaction_date", dateTo),
    supabase
      .from("shift_records")
      .select("hours_worked")
      .eq("site_id", siteId)
      .gte("shift_date", dateFrom)
      .lte("shift_date", dateTo),
  ]);

  return aggregateReportSummary(txData ?? [], shiftData ?? []);
}

export async function getProductionByDay(
  siteId: string,
  dateFrom: string,
  dateTo: string
): Promise<ProductionSummary[]> {
  if (isDemoMode()) return DEMO_PRODUCTION_BY_DAY;
  if (isRestActive())
    return restGet<ProductionSummary[]>(
      `/reports/production?site_id=${siteId}&from=${dateFrom}&to=${dateTo}`
    );

  const { data, error } = await supabase
    .from("shift_records")
    .select("shift_date, hours_worked, output_metric")
    .eq("site_id", siteId)
    .gte("shift_date", dateFrom)
    .lte("shift_date", dateTo);
  if (error) throw error;

  return aggregateProductionByDay(data ?? []);
}

// ─── Per-customer totals (type-specific) ─────────────────────────────────────

export async function getExpensesByCustomer(
  siteId: string,
  dateFrom: string,
  dateTo: string
): Promise<CustomerTotal[]> {
  if (isDemoMode()) return DEMO_EXPENSES_BY_CUSTOMER;
  if (isRestActive())
    return restGet<CustomerTotal[]>(
      `/reports/expenses-by-customer?site_id=${siteId}&from=${dateFrom}&to=${dateTo}`
    );

  const { data, error } = await supabase
    .from("transactions")
    .select("unit_price, quantity, customer_id, customers(name)")
    .eq("site_id", siteId)
    .eq("type", "expense")
    .neq("status", "cancelled")
    .not("customer_id", "is", null)
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo);
  if (error) throw error;

  return aggregateCustomerTotals(
    (data ?? []) as Array<{ unit_price: number; quantity: number; customer_id: string | null; customers: { name: string } | null }>
  );
}

export async function getIncomeByCustomer(
  siteId: string,
  dateFrom: string,
  dateTo: string
): Promise<CustomerTotal[]> {
  if (isDemoMode()) return DEMO_INCOME_BY_CUSTOMER;
  if (isRestActive())
    return restGet<CustomerTotal[]>(
      `/reports/income-by-customer?site_id=${siteId}&from=${dateFrom}&to=${dateTo}`
    );

  const { data, error } = await supabase
    .from("transactions")
    .select("unit_price, quantity, customer_id, customers(name)")
    .eq("site_id", siteId)
    .eq("type", "income")
    .neq("status", "cancelled")
    .not("customer_id", "is", null)
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo);
  if (error) throw error;

  return aggregateCustomerTotals(
    (data ?? []) as Array<{ unit_price: number; quantity: number; customer_id: string | null; customers: { name: string } | null }>
  );
}

// ─── Customer summary mapping helper ─────────────────────────────────────────

function mapCustomerSummary(raw: Record<string, unknown>): CustomerSummary {
  return {
    customerId:          String(raw.customer_id ?? raw.customerId ?? ""),
    customerName:        String(raw.customer_name ?? raw.customerName ?? "Unknown"),
    customerType:        (raw.customer_type ?? raw.customerType ?? "external") as "external" | "internal",
    totalIncome:         Number(raw.total_income ?? raw.totalIncome ?? 0),
    totalExpenses:       Number(raw.total_expenses ?? raw.totalExpenses ?? 0),
    netProfit:           Number(raw.net_profit ?? raw.netProfit ?? 0),
    transactionCount:    Number(raw.transaction_count ?? raw.transactionCount ?? 0),
    expensesByCategory:  Array.isArray(raw.expenses_by_category ?? raw.expensesByCategory)
      ? (raw.expenses_by_category ?? raw.expensesByCategory) as { category: string; total: number }[]
      : [],
  };
}

// ─── Customer summaries ───────────────────────────────────────────────────────

export async function getCustomerSummaries(
  siteId: string,
  dateFrom: string,
  dateTo: string
): Promise<CustomerSummary[]> {
  if (isDemoMode()) return DEMO_CUSTOMER_SUMMARIES;
  if (isRestActive()) {
    const raw = await restGet<Record<string, unknown>[]>(
      `/reports/customer-summary?site_id=${siteId}&from=${dateFrom}&to=${dateTo}`
    );
    return raw.map(mapCustomerSummary);
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("type, unit_price, quantity, category, customer_id, expense_category_id, customers(name, type), expense_categories(name)")
    .eq("site_id", siteId)
    .neq("status", "cancelled")
    .not("customer_id", "is", null)
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo);
  if (error) throw error;

  return aggregateCustomerSummaries(
    (data ?? []) as Array<{
      type: string;
      unit_price: number;
      quantity: number;
      category: string | null;
      customer_id: string | null;
      customers: { name: string; type: string } | null;
      expense_categories: { name: string } | null;
    }>
  );
}

export async function getCustomerDetail(
  siteId: string,
  customerId: string,
  dateFrom: string,
  dateTo: string
): Promise<CustomerSummary | null> {
  if (isDemoMode()) return DEMO_CUSTOMER_SUMMARIES.find((s) => s.customerId === customerId) ?? null;
  if (isRestActive()) {
    const raw = await restGet<Record<string, unknown>[]>(
      `/reports/customer-summary?site_id=${siteId}&from=${dateFrom}&to=${dateTo}&customer_id=${customerId}`
    );
    return raw.length > 0 ? mapCustomerSummary(raw[0]) : null;
  }

  const results = await getCustomerSummaries(siteId, dateFrom, dateTo);
  return results.find((s) => s.customerId === customerId) ?? null;
}

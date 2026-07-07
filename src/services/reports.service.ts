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
import { aggregateProductionByDay } from "@/services/reports.aggregators";
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

  // TODO: regenerate supabaseTypes after migration 026 — casting rpc name/args as `never`
  // until report_monthly_trend is present in the generated Database type.
  const { data, error } = await supabase.rpc("report_monthly_trend" as never, {
    p_site_id: siteId,
    p_from: dateFrom,
    p_to: dateTo,
  } as never);
  if (error) throw error;

  return ((data ?? []) as Array<{ month: string; income: number | string; expenses: number | string }>).map(
    (r) => ({ month: r.month, income: Number(r.income), expenses: Number(r.expenses) })
  );
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

  // TODO: regenerate supabaseTypes after migration 026 — casting rpc name/args as `never`
  // until report_category_breakdown is present in the generated Database type.
  const { data, error } = await supabase.rpc("report_category_breakdown" as never, {
    p_site_id: siteId,
    p_from: dateFrom,
    p_to: dateTo,
    p_type: "expense",
    p_customer_id: customerId ?? null,
  } as never);
  if (error) throw error;

  return ((data ?? []) as Array<{ category: string; total: number | string }>).map((r) => ({
    category: r.category,
    total: Number(r.total),
  }));
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

  // TODO: regenerate supabaseTypes after migration 026 — casting rpc name/args as `never`
  // until report_category_breakdown is present in the generated Database type.
  const { data, error } = await supabase.rpc("report_category_breakdown" as never, {
    p_site_id: siteId,
    p_from: dateFrom,
    p_to: dateTo,
    p_type: "income",
    p_customer_id: customerId ?? null,
  } as never);
  if (error) throw error;

  return ((data ?? []) as Array<{ category: string; total: number | string }>).map((r) => ({
    category: r.category,
    total: Number(r.total),
  }));
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

  // TODO: regenerate supabaseTypes after migration 026 — casting rpc name/args as `never`
  // until report_summary is present in the generated Database type.
  const { data, error } = await supabase.rpc("report_summary" as never, {
    p_site_id: siteId,
    p_from: dateFrom,
    p_to: dateTo,
  } as never);
  if (error) throw error;

  const row = (data ?? [])[0] as
    | {
        total_income: number | string;
        total_expenses: number | string;
        net_revenue: number | string;
        transaction_count: number;
        total_shifts_logged: number;
        total_hours_worked: number | string;
      }
    | undefined;

  return {
    totalIncome: Number(row?.total_income ?? 0),
    totalExpenses: Number(row?.total_expenses ?? 0),
    netRevenue: Number(row?.net_revenue ?? 0),
    transactionCount: row?.transaction_count ?? 0,
    totalShiftsLogged: row?.total_shifts_logged ?? 0,
    totalHoursWorked: Number(row?.total_hours_worked ?? 0),
  };
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

  // TODO: regenerate supabaseTypes after migration 026 — casting rpc name/args as `never`
  // until report_customer_totals is present in the generated Database type.
  const { data, error } = await supabase.rpc("report_customer_totals" as never, {
    p_site_id: siteId,
    p_from: dateFrom,
    p_to: dateTo,
    p_type: "expense",
  } as never);
  if (error) throw error;

  return ((data ?? []) as Array<{ customer_id: string; customer_name: string; total: number | string }>).map((r) => ({
    customerId: r.customer_id,
    customerName: r.customer_name,
    total: Number(r.total),
  }));
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

  // TODO: regenerate supabaseTypes after migration 026 — casting rpc name/args as `never`
  // until report_customer_totals is present in the generated Database type.
  const { data, error } = await supabase.rpc("report_customer_totals" as never, {
    p_site_id: siteId,
    p_from: dateFrom,
    p_to: dateTo,
    p_type: "income",
  } as never);
  if (error) throw error;

  return ((data ?? []) as Array<{ customer_id: string; customer_name: string; total: number | string }>).map((r) => ({
    customerId: r.customer_id,
    customerName: r.customer_name,
    total: Number(r.total),
  }));
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

  // TODO: regenerate supabaseTypes after migration 026 — casting rpc name/args as `never`
  // until report_customer_summaries is present in the generated Database type.
  const { data, error } = await supabase.rpc("report_customer_summaries" as never, {
    p_site_id: siteId,
    p_from: dateFrom,
    p_to: dateTo,
  } as never);
  if (error) throw error;

  return ((data ?? []) as Array<{
    customer_id: string;
    customer_name: string;
    customer_type: string;
    total_income: number | string;
    total_expenses: number | string;
    net_profit: number | string;
    transaction_count: number;
    expenses_by_category: { category: string; total: number | string }[];
  }>).map((r) => ({
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerType: r.customer_type as "external" | "internal",
    totalIncome: Number(r.total_income),
    totalExpenses: Number(r.total_expenses),
    netProfit: Number(r.net_profit),
    transactionCount: r.transaction_count,
    expensesByCategory: (r.expenses_by_category ?? []).map((c) => ({
      category: c.category,
      total: Number(c.total),
    })),
  }));
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

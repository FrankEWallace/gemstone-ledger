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

export type { CustomerSummary };
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

  const map: Record<string, { income: number; expenses: number }> = {};
  for (const row of data ?? []) {
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

  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    const cat = row.category ?? "Uncategorised";
    map[cat] = (map[cat] ?? 0) + row.unit_price * row.quantity;
  }

  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .map(([category, total]) => ({ category, total }));
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

  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    const cat = row.category ?? "Uncategorised";
    map[cat] = (map[cat] ?? 0) + row.unit_price * row.quantity;
  }

  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .map(([category, total]) => ({ category, total }));
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

  let totalIncome = 0;
  let totalExpenses = 0;
  for (const row of txData ?? []) {
    const amount = row.unit_price * row.quantity;
    if (row.type === "income") totalIncome += amount;
    else totalExpenses += amount;
  }

  const totalShiftsLogged = shiftData?.length ?? 0;
  const totalHoursWorked = (shiftData ?? []).reduce(
    (sum, r) => sum + (r.hours_worked ?? 0),
    0
  );

  return {
    totalIncome,
    totalExpenses,
    netRevenue: totalIncome - totalExpenses,
    transactionCount: txData?.length ?? 0,
    totalShiftsLogged,
    totalHoursWorked,
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

  const map: Record<string, ProductionSummary> = {};
  for (const row of data ?? []) {
    if (!map[row.shift_date])
      map[row.shift_date] = { date: row.shift_date, totalHours: 0, totalOutput: 0, shiftsLogged: 0 };
    map[row.shift_date].totalHours += row.hours_worked ?? 0;
    map[row.shift_date].totalOutput += row.output_metric ?? 0;
    map[row.shift_date].shiftsLogged += 1;
  }

  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
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

  const map: Record<string, { customerName: string; total: number }> = {};
  for (const row of data ?? []) {
    const cid = row.customer_id as string;
    if (!map[cid]) map[cid] = { customerName: (row.customers as { name: string } | null)?.name ?? "Unknown", total: 0 };
    map[cid].total += (row.unit_price as number) * (row.quantity as number);
  }

  return Object.entries(map)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([customerId, v]) => ({ customerId, customerName: v.customerName, total: Math.round(v.total * 100) / 100 }));
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

  const map: Record<string, { customerName: string; total: number }> = {};
  for (const row of data ?? []) {
    const cid = row.customer_id as string;
    if (!map[cid]) map[cid] = { customerName: (row.customers as { name: string } | null)?.name ?? "Unknown", total: 0 };
    map[cid].total += (row.unit_price as number) * (row.quantity as number);
  }

  return Object.entries(map)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([customerId, v]) => ({ customerId, customerName: v.customerName, total: Math.round(v.total * 100) / 100 }));
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

  const map: Record<string, CustomerSummary> = {};
  for (const row of data ?? []) {
    const cid = row.customer_id as string;
    if (!map[cid]) {
      map[cid] = {
        customerId:         cid,
        customerName:       (row.customers as { name: string } | null)?.name ?? "Unknown",
        customerType:       ((row.customers as { type: string } | null)?.type ?? "external") as "external" | "internal",
        totalIncome:        0,
        totalExpenses:      0,
        netProfit:          0,
        transactionCount:   0,
        expensesByCategory: [],
      };
    }
    const amount = (row.unit_price as number) * (row.quantity as number);
    const entry = map[cid];
    entry.transactionCount += 1;
    if (row.type === "income") {
      entry.totalIncome += amount;
    } else {
      entry.totalExpenses += amount;
      const catName = (row.expense_categories as { name: string } | null)?.name
        ?? (row.category as string | null)
        ?? "Uncategorized";
      const catEntry = entry.expensesByCategory.find((c) => c.category === catName);
      if (catEntry) catEntry.total += amount;
      else entry.expensesByCategory.push({ category: catName, total: amount });
    }
  }

  return Object.values(map).map((s) => ({
    ...s,
    totalIncome:    Math.round(s.totalIncome * 100) / 100,
    totalExpenses:  Math.round(s.totalExpenses * 100) / 100,
    netProfit:      Math.round((s.totalIncome - s.totalExpenses) * 100) / 100,
    expensesByCategory: s.expensesByCategory.map((c) => ({
      ...c,
      total: Math.round(c.total * 100) / 100,
    })).sort((a, b) => b.total - a.total),
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

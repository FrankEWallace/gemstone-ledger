import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet } from "@/lib/providers/rest/client";
import { isDemoMode } from "@/lib/demo";
import {
  DEMO_MONTHLY_TREND,
  DEMO_EXPENSES_BY_CATEGORY,
  DEMO_REPORT_SUMMARY,
  DEMO_PRODUCTION_BY_DAY,
} from "@/lib/demo/data";

export type MonthlyTrend = { month: string; income: number; expenses: number };
export type CategoryBreakdown = { category: string; total: number };
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
  dateTo: string
): Promise<CategoryBreakdown[]> {
  if (isDemoMode()) return DEMO_EXPENSES_BY_CATEGORY;
  if (isRestActive())
    return restGet<CategoryBreakdown[]>(
      `/reports/expenses-by-category?site_id=${siteId}&from=${dateFrom}&to=${dateTo}`
    );

  const { data, error } = await supabase
    .from("transactions")
    .select("category, unit_price, quantity")
    .eq("site_id", siteId)
    .eq("type", "expense")
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo);
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

import { supabase } from "@/lib/supabase";

export type MonthlyTrend = {
  month: string; // "Jan 25"
  income: number;
  expenses: number;
};

export type CategoryBreakdown = {
  category: string;
  total: number;
};

export type ProductionSummary = {
  date: string;
  totalHours: number;
  totalOutput: number;
  shiftsLogged: number;
};

export type ReportSummary = {
  totalIncome: number;
  totalExpenses: number;
  netRevenue: number;
  transactionCount: number;
  totalShiftsLogged: number;
  totalHoursWorked: number;
};

// ─── Transaction aggregations ─────────────────────────────────────────────────

export async function getMonthlyTrend(
  siteId: string,
  dateFrom: string,
  dateTo: string
): Promise<MonthlyTrend[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("type, status, quantity, unit_price, transaction_date")
    .eq("site_id", siteId)
    .eq("status", "success")
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo)
    .order("transaction_date");
  if (error) throw error;

  const byMonth: Record<string, { income: number; expenses: number }> = {};

  for (const tx of data ?? []) {
    const d = new Date(tx.transaction_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    if (!byMonth[key]) byMonth[key] = { income: 0, expenses: 0 };
    const amount = tx.quantity * tx.unit_price;
    if (tx.type === "income") byMonth[key].income += amount;
    else if (tx.type === "expense") byMonth[key].expenses += amount;
  }

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => {
      const [year, month] = key.split("-");
      const d = new Date(Number(year), Number(month) - 1, 1);
      return {
        month: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        ...val,
      };
    });
}

export async function getExpensesByCategory(
  siteId: string,
  dateFrom: string,
  dateTo: string
): Promise<CategoryBreakdown[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("category, quantity, unit_price")
    .eq("site_id", siteId)
    .eq("type", "expense")
    .eq("status", "success")
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo);
  if (error) throw error;

  const byCategory: Record<string, number> = {};
  for (const tx of data ?? []) {
    const cat = tx.category ?? "Uncategorised";
    byCategory[cat] = (byCategory[cat] ?? 0) + tx.quantity * tx.unit_price;
  }

  return Object.entries(byCategory)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export async function getReportSummary(
  siteId: string,
  dateFrom: string,
  dateTo: string
): Promise<ReportSummary> {
  const [txRes, shiftRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, status, quantity, unit_price")
      .eq("site_id", siteId)
      .eq("status", "success")
      .gte("transaction_date", dateFrom)
      .lte("transaction_date", dateTo),
    supabase
      .from("shift_records")
      .select("hours_worked, output_metric")
      .eq("site_id", siteId)
      .gte("shift_date", dateFrom)
      .lte("shift_date", dateTo),
  ]);

  if (txRes.error) throw txRes.error;
  if (shiftRes.error) throw shiftRes.error;

  let totalIncome = 0;
  let totalExpenses = 0;
  for (const tx of txRes.data ?? []) {
    const amt = tx.quantity * tx.unit_price;
    if (tx.type === "income") totalIncome += amt;
    else if (tx.type === "expense") totalExpenses += amt;
  }

  const totalHoursWorked = (shiftRes.data ?? []).reduce(
    (sum, s) => sum + (s.hours_worked ?? 0),
    0
  );

  return {
    totalIncome,
    totalExpenses,
    netRevenue: totalIncome - totalExpenses,
    transactionCount: txRes.data?.length ?? 0,
    totalShiftsLogged: shiftRes.data?.length ?? 0,
    totalHoursWorked,
  };
}

export async function getProductionByDay(
  siteId: string,
  dateFrom: string,
  dateTo: string
): Promise<ProductionSummary[]> {
  const { data, error } = await supabase
    .from("shift_records")
    .select("shift_date, hours_worked, output_metric")
    .eq("site_id", siteId)
    .gte("shift_date", dateFrom)
    .lte("shift_date", dateTo)
    .order("shift_date");
  if (error) throw error;

  const byDate: Record<string, ProductionSummary> = {};
  for (const s of data ?? []) {
    if (!byDate[s.shift_date]) {
      byDate[s.shift_date] = { date: s.shift_date, totalHours: 0, totalOutput: 0, shiftsLogged: 0 };
    }
    byDate[s.shift_date].totalHours += s.hours_worked ?? 0;
    byDate[s.shift_date].totalOutput += s.output_metric ?? 0;
    byDate[s.shift_date].shiftsLogged += 1;
  }

  return Object.values(byDate);
}

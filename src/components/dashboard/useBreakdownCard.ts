import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { getExpensesByCategory, getIncomeByCategory } from "@/services/reports.service";

export type DashboardPeriod = "7D" | "1M" | "3M" | "6M" | "12M";

export const PERIOD_DAYS: Record<DashboardPeriod, number> = {
  "7D": 7, "1M": 30, "3M": 90, "6M": 180, "12M": 365,
};

export const PERIOD_LABEL: Record<DashboardPeriod, string> = {
  "7D": "7 days", "1M": "30 days", "3M": "3 months", "6M": "6 months", "12M": "12 months",
};

const CAT_COLORS = [
  "var(--chart-4)", "var(--chart-7)", "var(--chart-6)",
  "var(--chart-3)", "var(--chart-8)", "var(--chart-9)",
  "var(--chart-10)", "var(--chart-5)",
];

export function getPeriodDates(period: DashboardPeriod) {
  const today = new Date();
  return {
    from: format(subDays(today, PERIOD_DAYS[period] - 1), "yyyy-MM-dd"),
    to: format(today, "yyyy-MM-dd"),
  };
}

export function getPrevPeriodDates(period: DashboardPeriod) {
  const days = PERIOD_DAYS[period];
  const today = new Date();
  return {
    from: format(subDays(today, days * 2 - 1), "yyyy-MM-dd"),
    to: format(subDays(today, days), "yyyy-MM-dd"),
  };
}

interface Options {
  type: "expense" | "income";
  siteId: string;
  period: DashboardPeriod;
  selectedCustomerId?: string | null;
}

export function useBreakdownCard({ type, siteId, period, selectedCustomerId }: Options) {
  const { from, to } = getPeriodDates(period);
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const getFn = type === "expense" ? getExpensesByCategory : getIncomeByCategory;
  const custId = selectedCustomerId ?? undefined;

  const { data: periodData = [], isLoading } = useQuery({
    queryKey: [type, "breakdown", siteId, from, to, custId ?? null],
    queryFn: () => getFn(siteId, from, to, custId),
    enabled: !!siteId,
  });

  const { data: todayData = [] } = useQuery({
    queryKey: [type, "breakdown-today", siteId, today, custId ?? null],
    queryFn: () => getFn(siteId, today, today, custId),
    enabled: !!siteId,
  });

  const { data: yesterdayData = [] } = useQuery({
    queryKey: [type, "breakdown-ystd", siteId, yesterday, custId ?? null],
    queryFn: () => getFn(siteId, yesterday, yesterday, custId),
    enabled: !!siteId,
  });

  const periodTotal = periodData.reduce((s, c) => s + c.total, 0);
  const todayTotal = todayData.reduce((s, c) => s + c.total, 0);
  const yesterdayTotal = yesterdayData.reduce((s, c) => s + c.total, 0);

  const items = useMemo(() => {
    const grand = periodTotal || 1;
    return periodData.slice(0, 8).map((item, idx) => ({
      label: item.category,
      value: item.total,
      color: CAT_COLORS[idx % CAT_COLORS.length],
      pct: Math.round((item.total / grand) * 100),
    }));
  }, [periodData, periodTotal]);

  return { items, periodTotal, todayTotal, yesterdayTotal, isLoading };
}

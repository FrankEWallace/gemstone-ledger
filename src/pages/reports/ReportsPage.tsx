import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { BarChart3, TrendingDown, TrendingUp, Users, Package, ArrowRight, AlertTriangle } from "lucide-react";

import { useSite } from "@/hooks/useSite";
import { useReportDateRange } from "@/hooks/useReportDateRange";
import { getReportSummary } from "@/services/reports.service";
import { getInventoryItems } from "@/services/inventory.service";
import { fmtCurrency, fmtCompact } from "@/lib/formatCurrency";
import StatCard from "@/components/shared/StatCard";

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  income:  "var(--chart-income)",
  expense: "var(--chart-expense)",
  net:     "var(--chart-net)",
} as const;

const PRESETS = [
  { label: "This month",    months: 0 },
  { label: "Last 3 months", months: 2 },
  { label: "Last 6 months", months: 5 },
];

// ─── Primitives ───────────────────────────────────────────────────────────────


function ReportCard({
  to, icon: Icon, title, description, badge, dateQuery,
}: {
  to: string;
  icon: React.ElementType;
  title: string;
  description: string;
  badge?: React.ReactNode;
  dateQuery: string;
}) {
  return (
    <Link
      to={`${to}${dateQuery}`}
      className="group rounded-xl border border-border bg-card p-5 flex flex-col gap-3 hover:border-foreground/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        {badge}
      </div>
      <div className="space-y-1 min-w-0 flex-1">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
        View report <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { activeSiteId } = useSite();
  const { dateFrom, dateTo, setDateFrom, setDateTo } = useReportDateRange();
  const dateQuery = `?from=${dateFrom}&to=${dateTo}`;

  const opts = { enabled: !!activeSiteId && !!dateFrom && !!dateTo, staleTime: 0 };

  const { data: summary, isFetching } = useQuery({
    queryKey: ["report-summary", activeSiteId, dateFrom, dateTo],
    queryFn: () => getReportSummary(activeSiteId!, dateFrom, dateTo),
    ...opts,
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory", activeSiteId],
    queryFn: () => getInventoryItems(activeSiteId!),
    enabled: !!activeSiteId,
    staleTime: 5 * 60 * 1000,
  });

  const lowStockCount = inventoryItems.filter(
    (i) => i.reorder_level != null && i.quantity <= i.reorder_level
  ).length;

  const margin = summary && summary.totalIncome > 0
    ? ((summary.netRevenue / summary.totalIncome) * 100).toFixed(1)
    : null;

  return (
    <div className="p-4 lg:p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-display">Reports & Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Select a period then open a report</p>
      </div>

      {/* Period presets */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => {
          const from   = format(startOfMonth(subMonths(new Date(), p.months)), "yyyy-MM-dd");
          const to     = format(endOfMonth(new Date()), "yyyy-MM-dd");
          const active = dateFrom === from && dateTo === to;
          return (
            <button
              key={p.label}
              onClick={() => { setDateFrom(from); setDateTo(to); }}
              className={`h-8 rounded-lg border px-3 text-xs font-medium transition-colors ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <span className="text-xs text-muted-foreground">
          {dateFrom} → {dateTo}
        </span>
      </div>

      {/* KPI strip */}
      {isFetching ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total Income"
            value={fmtCompact(summary?.totalIncome ?? 0)}
            sub={fmtCurrency(summary?.totalIncome ?? 0)}
            color={C.income}
          />
          <StatCard
            label="Total Expenses"
            value={fmtCompact(summary?.totalExpenses ?? 0)}
            sub={fmtCurrency(summary?.totalExpenses ?? 0)}
            color={C.expense}
          />
          <StatCard
            label="Net Revenue"
            value={fmtCompact(summary?.netRevenue ?? 0)}
            sub={(summary?.netRevenue ?? 0) >= 0 ? "Positive cashflow" : "Net loss"}
            color={(summary?.netRevenue ?? 0) >= 0 ? C.income : C.expense}
          />
          <StatCard
            label="Profit Margin"
            value={margin ? `${margin}%` : "—"}
            sub="Of income retained"
            color={C.net}
          />
        </div>
      )}

      {/* Report cards */}
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">Reports</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ReportCard
            to="/reports/overview"
            icon={BarChart3}
            title="Financial Overview"
            description="Revenue trends, monthly financials and expense category breakdown with PDF export."
            dateQuery={dateQuery}
          />
          <ReportCard
            to="/reports/expenses"
            icon={TrendingDown}
            title="Expense Breakdown"
            description="All expenses grouped by category with full transaction drill-down and CSV export."
            dateQuery={dateQuery}
          />
          <ReportCard
            to="/reports/income"
            icon={TrendingUp}
            title="Income Breakdown"
            description="Income transactions by category with period-over-period comparison."
            dateQuery={dateQuery}
          />
          <ReportCard
            to="/reports/customers"
            icon={Users}
            title="Customer Reports"
            description="Profitability, net margin and expense breakdown per customer with export."
            dateQuery={dateQuery}
          />
          <ReportCard
            to="/reports/inventory"
            icon={Package}
            title="Inventory Report"
            description="Stock levels, consumption rates, low-stock alerts and write-offs."
            badge={
              lowStockCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 text-xs font-semibold">
                  <AlertTriangle className="h-3 w-3" />
                  {lowStockCount} low
                </span>
              ) : undefined
            }
            dateQuery={dateQuery}
          />
        </div>
      </div>

    </div>
  );
}

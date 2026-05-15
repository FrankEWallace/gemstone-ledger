import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Download } from "lucide-react";

import { useSite } from "@/hooks/useSite";
import { useReportDateRange } from "@/hooks/useReportDateRange";
import ReportsSubNav from "@/components/reports/ReportsSubNav";
import { getCustomerSummaries } from "@/services/reports.service";
import { fmtCurrency, fmtCompact } from "@/lib/formatCurrency";
import { Badge } from "@/components/ui/badge";

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  income:  "var(--chart-income)",
  expense: "var(--chart-expense)",
  cat: [
    "var(--chart-cat-1)", "var(--chart-cat-2)", "var(--chart-cat-3)",
    "var(--chart-cat-4)", "var(--chart-cat-5)",
  ],
} as const;

const PRESETS = [
  { label: "This month",    months: 0 },
  { label: "Last 3 months", months: 2 },
  { label: "Last 6 months", months: 5 },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerListReportPage() {
  const { activeSiteId } = useSite();
  const { dateFrom, dateTo, setDateFrom, setDateTo } = useReportDateRange();
  const dateQuery = `?from=${dateFrom}&to=${dateTo}`;

  const { data: customerSummaries = [], isFetching } = useQuery({
    queryKey: ["customer-summaries", activeSiteId, dateFrom, dateTo],
    queryFn: () => getCustomerSummaries(activeSiteId!, dateFrom, dateTo),
    enabled: !!activeSiteId && !!dateFrom && !!dateTo,
    staleTime: 0,
  });

  const sorted = [...customerSummaries].sort((a, b) => b.netProfit - a.netProfit);

  function handleExportCSV() {
    const header = "Customer,Type,Income,Expenses,Net Profit,Margin %,Transactions,Top Expense Category,Top Category Amount";
    const rows = sorted.map((cs) => {
      const margin = cs.totalIncome > 0
        ? ((cs.netProfit / cs.totalIncome) * 100).toFixed(1)
        : "0.0";
      const topCat = cs.expensesByCategory[0];
      return [
        `"${cs.customerName}"`,
        cs.customerType,
        cs.totalIncome.toFixed(2),
        cs.totalExpenses.toFixed(2),
        cs.netProfit.toFixed(2),
        margin,
        cs.transactionCount,
        topCat ? `"${topCat.category}"` : "",
        topCat ? topCat.total.toFixed(2) : "",
      ].join(",");
    });
    const csv  = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `customer-report-${dateFrom}-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">

      <ReportsSubNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight">Customer Reports</h1>
        {sorted.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        )}
      </div>

      {/* Date filter */}
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
      </div>

      {/* Cards */}
      {isFetching ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 animate-pulse bg-muted rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground rounded-xl border border-border bg-card">
          No customer data for this period.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((cs) => {
            const maxCatVal = Math.max(...cs.expensesByCategory.map((c) => c.total), 1);
            return (
              <Link
                key={cs.customerId}
                to={`/reports/customers/${cs.customerId}${dateQuery}`}
                className="group rounded-xl border border-border bg-card p-5 space-y-4 hover:border-foreground/30 transition-colors block"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{cs.customerName}</p>
                    <Badge
                      variant="outline"
                      className={cs.customerType === "external" ? "text-blue-600 border-blue-200 mt-1" : "text-muted-foreground mt-1"}
                    >
                      {cs.customerType}
                    </Badge>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Net Profit</p>
                    <p className="text-lg font-bold tabular-nums" style={{ color: cs.netProfit >= 0 ? C.income : C.expense }}>
                      {cs.netProfit >= 0 ? "+" : "−"}{fmtCurrency(Math.abs(cs.netProfit))}
                    </p>
                  </div>
                </div>

                {/* Income / Expenses */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Income</p>
                    <p className="text-sm font-semibold tabular-nums" style={{ color: C.income }}>{fmtCurrency(cs.totalIncome)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Expenses</p>
                    <p className="text-sm font-semibold tabular-nums" style={{ color: C.expense }}>{fmtCurrency(cs.totalExpenses)}</p>
                  </div>
                </div>

                {/* Expense categories */}
                {cs.expensesByCategory.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expenses by Category</p>
                    {cs.expensesByCategory.slice(0, 4).map((c, idx) => {
                      const pct      = Math.round((c.total / maxCatVal) * 100);
                      const barColor = C.cat[idx % C.cat.length];
                      return (
                        <div key={c.category} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-muted-foreground truncate mr-2">
                              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
                              {c.category}
                            </span>
                            <span className="tabular-nums font-medium shrink-0">{fmtCompact(c.total)}</span>
                          </div>
                          <div className="h-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {cs.transactionCount} transaction{cs.transactionCount !== 1 ? "s" : ""}
                  </p>
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    View report →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

    </div>
  );
}

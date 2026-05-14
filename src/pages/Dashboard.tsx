import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import { getTransactions } from "@/services/transactions.service";
import { getCustomers } from "@/services/customers.service";
import { getCustomerSummaries } from "@/services/reports.service";
import KpiCard from "@/components/dashboard/KpiCard";
import BreakdownCard from "@/components/dashboard/BreakdownCard";
import CustomerInsights from "@/components/dashboard/CustomerInsights";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import SiteStatusStrip from "@/components/dashboard/SiteStatusStrip";
import CustomerSelect from "@/components/dashboard/CustomerSelect";
import { type DashboardPeriod, PERIOD_DAYS } from "@/components/dashboard/useBreakdownCard";

// ─── Types ────────────────────────────────────────────────────────────────────

function getPeriodDates(period: DashboardPeriod) {
  const today = new Date();
  return {
    from: format(subDays(today, PERIOD_DAYS[period] - 1), "yyyy-MM-dd"),
    to: format(today, "yyyy-MM-dd"),
  };
}

function getPrevPeriodDates(period: DashboardPeriod) {
  const days = PERIOD_DAYS[period];
  const today = new Date();
  return {
    from: format(subDays(today, days * 2 - 1), "yyyy-MM-dd"),
    to: format(subDays(today, days), "yyyy-MM-dd"),
  };
}

// ─── Period Pills ─────────────────────────────────────────────────────────────

function PeriodPills({
  value,
  onChange,
}: {
  value: DashboardPeriod;
  onChange: (p: DashboardPeriod) => void;
}) {
  return (
    <div className="flex items-center rounded-full bg-muted p-0.5 gap-0.5">
      {(["7D", "1M", "3M", "6M", "12M"] as DashboardPeriod[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`h-7 rounded-full px-3 text-xs font-semibold transition-colors ${
            value === p
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

// ─── Chart colors ─────────────────────────────────────────────────────────────

const C = {
  net:  "var(--chart-3)",
  loss: "var(--destructive)",
} as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  useAuth();
  const { activeSiteId } = useSite();
  const today = new Date();

  const [period, setPeriod] = useState<DashboardPeriod>("1M");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const { from, to } = getPeriodDates(period);
  const { from: prevFrom, to: prevTo } = getPrevPeriodDates(period);

  const { data: txs = [], isLoading: txsLoading } = useQuery({
    queryKey: ["transactions", activeSiteId, from, to],
    queryFn: () => getTransactions(activeSiteId!, { dateFrom: from, dateTo: to }),
    enabled: !!activeSiteId,
  });

  const { data: prevTxs = [] } = useQuery({
    queryKey: ["transactions-prev", activeSiteId, prevFrom, prevTo],
    queryFn: () => getTransactions(activeSiteId!, { dateFrom: prevFrom, dateTo: prevTo }),
    enabled: !!activeSiteId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { data: customerSummaries = [] } = useQuery({
    queryKey: ["customer-summaries", activeSiteId, from, to],
    queryFn: () => getCustomerSummaries(activeSiteId!, from, to),
    enabled: !!activeSiteId,
  });

  // ── KPI derivation
  const filteredTxs = useMemo(
    () => (selectedCustomerId ? txs.filter((t) => t.customer_id === selectedCustomerId) : txs),
    [txs, selectedCustomerId]
  );

  function sumKpis(rows: typeof txs) {
    const success = rows.filter((t) => t.status === "success");
    const revenue = success.filter((t) => t.type === "income").reduce((s, t) => s + t.quantity * t.unit_price, 0);
    const expenses = success.filter((t) => t.type === "expense").reduce((s, t) => s + t.quantity * t.unit_price, 0);
    return { revenue, expenses, net: revenue - expenses };
  }

  const curr = sumKpis(filteredTxs);
  const prev = sumKpis(prevTxs);

  const trendPct = (cur: number, pre: number) =>
    pre > 0 ? Math.round(((cur - pre) / pre) * 1000) / 10 : null;

  const revTrend  = trendPct(curr.revenue,  prev.revenue);
  const expTrend  = trendPct(curr.expenses, prev.expenses);
  const netTrend  = prev.net !== 0 ? Math.round(((curr.net - prev.net) / Math.abs(prev.net)) * 1000) / 10 : null;

  if (!activeSiteId) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a site to view the dashboard.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {today.toLocaleDateString("en-US", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <PeriodPills value={period} onChange={setPeriod} />
          <CustomerSelect
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
            value={selectedCustomerId}
            onChange={setSelectedCustomerId}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Revenue"
          rawValue={curr.revenue}
          trendPct={revTrend}
          vsLabel="vs prev period"
          href="/transactions"
        />
        <KpiCard
          label="Expenses"
          rawValue={curr.expenses}
          trendPct={expTrend}
          vsLabel="vs prev period"
          href="/transactions"
        />
        <KpiCard
          label="Net Profit"
          rawValue={Math.abs(curr.net)}
          trendPct={netTrend}
          vsLabel={curr.net >= 0 ? "positive cashflow" : "net loss"}
          href="/reports"
          valueColor={curr.net >= 0 ? C.net : C.loss}
        />
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className="lg:col-span-2">
          <BreakdownCard
            type="expense"
            siteId={activeSiteId}
            period={period}
            selectedCustomerId={selectedCustomerId}
          />
        </div>
        <div className="lg:col-span-1">
          <BreakdownCard
            type="income"
            siteId={activeSiteId}
            period={period}
            selectedCustomerId={selectedCustomerId}
          />
        </div>
      </div>

      {/* Customer Insights */}
      <CustomerInsights
        summaries={customerSummaries}
        selectedId={selectedCustomerId}
        onSelect={setSelectedCustomerId}
      />

      {/* Recent Transactions */}
      <RecentTransactions txs={filteredTxs} isLoading={txsLoading} />

      {/* Site Status */}
      <SiteStatusStrip siteId={activeSiteId} />
    </div>
  );
}

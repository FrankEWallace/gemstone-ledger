import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Link } from "react-router-dom";
import { MapPin, Plus, Upload } from "lucide-react";
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

// ─── KPI derivation ───────────────────────────────────────────────────────────
// Counts only status === "success" rows — a third status convention distinct
// from the report aggregates (no filter) and the per-customer report
// functions (excludes "cancelled"). Left as-is; out of scope to unify.

function sumKpis(rows: Array<{ status: string; type: string; quantity: number; unit_price: number; customer_id: string | null }>) {
  const success = rows.filter((t) => t.status === "success");
  const revenue = success.filter((t) => t.type === "income").reduce((s, t) => s + t.quantity * t.unit_price, 0);
  const expenses = success.filter((t) => t.type === "expense").reduce((s, t) => s + t.quantity * t.unit_price, 0);
  return { revenue, expenses, net: revenue - expenses };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  useAuth();
  const { activeSiteId, sites, setActiveSite } = useSite();
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

  const curr = useMemo(() => sumKpis(filteredTxs), [filteredTxs]);
  const prev = useMemo(() => sumKpis(prevTxs), [prevTxs]);

  const trendPct = (cur: number, pre: number) =>
    pre > 0 ? Math.round(((cur - pre) / pre) * 1000) / 10 : null;

  const revTrend  = trendPct(curr.revenue,  prev.revenue);
  const expTrend  = trendPct(curr.expenses, prev.expenses);
  const netTrend  = prev.net !== 0 ? Math.round(((curr.net - prev.net) / Math.abs(prev.net)) * 1000) / 10 : null;

  if (!activeSiteId) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mx-auto">
            <MapPin className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-base">No site selected</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a site to start viewing your dashboard.
            </p>
          </div>
          {sites.length > 0 && (
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden text-left">
              {sites.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSite(s.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                    {s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{s.role}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
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

      {/* No-data prompt */}
      {txs.length === 0 && !txsLoading && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">No transactions yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add your first transaction or import existing data to see your dashboard come to life.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/transactions"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add transaction
            </Link>
            <Link
              to="/transactions"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </Link>
          </div>
        </div>
      )}

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
          prominent
        />
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 items-stretch">
        <BreakdownCard
          type="expense"
          siteId={activeSiteId}
          period={period}
          selectedCustomerId={selectedCustomerId}
        />
        <BreakdownCard
          type="income"
          siteId={activeSiteId}
          period={period}
          selectedCustomerId={selectedCustomerId}
        />
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

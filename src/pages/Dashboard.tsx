import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Link } from "react-router-dom";
import { MapPin, Plus, Upload, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import { getTransactions } from "@/services/transactions.service";
import { getCustomers } from "@/services/customers.service";
import { getCustomerSummaries } from "@/services/reports.service";
import StatCard from "@/components/shared/StatCard";
import EntityAvatar from "@/components/shared/EntityAvatar";
import BreakdownCard from "@/components/dashboard/BreakdownCard";
import CustomerInsights from "@/components/dashboard/CustomerInsights";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import SiteStatusStrip from "@/components/dashboard/SiteStatusStrip";
import { type DashboardPeriod, PERIOD_DAYS } from "@/components/dashboard/useBreakdownCard";
import { bucketSeries } from "@/lib/sparkline";

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
    <div className="flex items-center gap-1" role="group" aria-label="Period">
      {(["7D", "1M", "3M", "6M", "12M"] as DashboardPeriod[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-pressed={value === p}
          className={`h-7 rounded-full border px-3 text-xs font-medium transition-colors ${
            value === p
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

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
  const filteredPrevTxs = useMemo(
    () => (selectedCustomerId ? prevTxs.filter((t) => t.customer_id === selectedCustomerId) : prevTxs),
    [prevTxs, selectedCustomerId]
  );
  const prev = useMemo(() => sumKpis(filteredPrevTxs), [filteredPrevTxs]);

  // Previous period first (drawn faded), then the current period.
  const sparks = useMemo(() => {
    const days = PERIOD_DAYS[period];
    const buckets = period === "7D" ? 7 : 6;
    const c = bucketSeries(filteredTxs, from, days, buckets);
    const p = bucketSeries(filteredPrevTxs, prevFrom, days, buckets);
    return {
      dimFirst: buckets,
      revenue: [...p.revenue, ...c.revenue],
      expenses: [...p.expenses, ...c.expenses],
      net: [...p.net, ...c.net],
    };
  }, [filteredTxs, filteredPrevTxs, period, from, prevFrom]);

  const customerNames = useMemo(
    () => new Map(customers.map((c) => [c.id, c.name])),
    [customers]
  );

  const selectedCustomerName = useMemo(
    () =>
      customers.find((c) => c.id === selectedCustomerId)?.name ??
      customerSummaries.find((s) => s.customerId === selectedCustomerId)?.customerName ??
      null,
    [customers, customerSummaries, selectedCustomerId]
  );

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
            <h2 className="text-sm font-semibold">No site selected</h2>
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
                  <EntityAvatar name={s.name} seed={s.id} shape="square" className="h-8 w-8 text-xs" />
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
          <h1 className="text-display">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {today.toLocaleDateString("en-US", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
        <PeriodPills value={period} onChange={setPeriod} />
      </div>

      {/* Site status — slim line under header */}
      <SiteStatusStrip siteId={activeSiteId} />

      {/* Active customer filter chip */}
      {selectedCustomerId && (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="text-muted-foreground">Filtered by</span>
          <button
            onClick={() => setSelectedCustomerId(null)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium hover:bg-primary/15 transition-colors"
          >
            {selectedCustomerName ?? "client"}
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* No-data prompt */}
      {txs.length === 0 && !txsLoading && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">No transactions yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add your first transaction or import existing data to see your dashboard come to life.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/transactions"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add transaction
            </Link>
            <Link
              to="/transactions"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </Link>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Revenue"
          rawValue={curr.revenue}
          trendPct={revTrend}
          vsLabel="vs prev period"
          href="/transactions"
          spark={{ values: sparks.revenue, dimFirst: sparks.dimFirst }}
        />
        <StatCard
          label="Expenses"
          rawValue={curr.expenses}
          trendPct={expTrend}
          trendGoodWhen="down"
          vsLabel="vs prev period"
          href="/transactions"
          spark={{ values: sparks.expenses, dimFirst: sparks.dimFirst, tone: "muted" }}
        />
        <StatCard
          label="Net Profit"
          rawValue={Math.abs(curr.net)}
          trendPct={netTrend}
          vsLabel={curr.net >= 0 ? "positive cashflow" : "net loss"}
          href="/reports"
          valueClassName={curr.net < 0 ? "text-destructive" : undefined}
          spark={{ values: sparks.net, dimFirst: sparks.dimFirst }}
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
      <RecentTransactions txs={filteredTxs} isLoading={txsLoading} customerNames={customerNames} />
    </div>
  );
}

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  AlertTriangle,
  Users,
  Wrench,
  ShieldAlert,
  CalendarDays,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  isPast,
  parseISO,
  startOfMonth,
  endOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import { getTransactions } from "@/services/transactions.service";
import { getEquipment } from "@/services/equipment.service";
import { getSafetyIncidents } from "@/services/safety.service";
import { getPlannedShifts } from "@/services/schedule.service";
import { getWorkers } from "@/services/team.service";
import { getKpiTargets } from "@/services/kpi.service";
import {
  getMonthlyTrend,
  getExpensesByCategory,
  getCustomerSummaries,
} from "@/services/reports.service";
import type { CustomerSummary } from "@/services/reports.service";
import { getCustomers } from "@/services/customers.service";
import { fmtCompact, fmtCurrency as fmtFull_, fmtCompactNum, CURRENCY_SYMBOL } from "@/lib/formatCurrency";
import type { Transaction } from "@/lib/supabaseTypes";

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtCurrency = fmtCompact;
const fmtFull = fmtFull_;

// ─── Chart color palette ──────────────────────────────────────────────────────

const C = {
  income:  "#3b82f6", // blue
  expense: "#f97316", // orange
  net:     "#10b981", // emerald
  loss:    "#ef4444", // red
  cat: [
    "#3b82f6", // blue   — matches income
    "#f97316", // orange — matches expense
    "#10b981", // emerald— matches net
    "#8b5cf6", // violet
    "#f59e0b", // amber
    "#ef4444", // red    — matches loss
    "#06b6d4", // cyan
    "#84cc16", // lime
  ],
} as const;

// ─── Trend Badge ─────────────────────────────────────────────────────────────

function TrendBadge({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <div className={`flex flex-col items-center shrink-0 ${up ? "text-emerald-500" : "text-red-500"}`}>
      <span className="text-base leading-none">{up ? "▲" : "▼"}</span>
      <span className="text-[10px] font-semibold tabular-nums mt-0.5">
        {Math.abs(pct).toFixed(1)}%
      </span>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  rawValue,
  sub,
  trendPct,
  href,
  progressPct,
  progressLabel,
  color,
  valueColor,
  insightHeadline,
  insightSub,
}: {
  label: string;
  rawValue: number;
  sub?: string;
  trendPct?: number | null;
  href: string;
  progressPct?: number | null;
  progressLabel?: string;
  color?: string;
  valueColor?: string;
  insightHeadline?: string;
  insightSub?: string;
}) {
  return (
    <Link
      to={href}
      className="group rounded-xl border border-border/50 bg-card px-3 py-2 flex items-center gap-2.5 hover:border-foreground/20 hover:bg-muted/10 transition-all overflow-hidden"
    >
      {color && (
        <div
          className="shrink-0 self-stretch w-[3px] rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
            {label}
          </p>
          {sub && (
            <span className="text-[10px] text-muted-foreground shrink-0 truncate max-w-[120px]">
              {sub}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[10px] text-muted-foreground">{CURRENCY_SYMBOL}</span>
          <span
            className="font-display text-[17px] font-bold leading-none tabular-nums tracking-tight"
            style={valueColor ? { color: valueColor } : undefined}
          >
            {fmtCompactNum(rawValue)}
          </span>
        </div>
        {progressPct != null && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-[3px] rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progressPct}%`, backgroundColor: color ?? "hsl(var(--foreground))" }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
              {progressLabel && `${progressLabel} · `}{progressPct}%
            </span>
          </div>
        )}
        {insightHeadline && (
          <div className="mt-2 pt-2 border-t border-border/40">
            <p className="text-[10px] font-medium leading-snug">{insightHeadline}</p>
            {insightSub && (
              <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">{insightSub}</p>
            )}
          </div>
        )}
      </div>
      {trendPct != null && <TrendBadge pct={trendPct} />}
    </Link>
  );
}

// ─── Customer Filter ──────────────────────────────────────────────────────────

function CustomerFilter({
  customers,
  value,
  onChange,
}: {
  customers: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground appearance-none cursor-pointer hover:border-foreground/30 transition-colors focus:outline-none focus:ring-1 focus:ring-border"
    >
      <option value="">All Customers</option>
      {customers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

// ─── Expense Breakdown ────────────────────────────────────────────────────────

function ExpenseBreakdown({
  catData,
  customerData,
  isLoadingCat,
  forceCategory,
  todayExpenses,
  yesterdayExpenses,
}: {
  catData: { category: string; total: number }[];
  customerData: CustomerSummary[];
  isLoadingCat: boolean;
  forceCategory?: boolean;
  todayExpenses: number;
  yesterdayExpenses: number;
}) {
  const [mode, setMode] = useState<"category" | "customer">("category");
  const activeMode = forceCategory ? "category" : mode;

  const items = useMemo(() => {
    const source =
      activeMode === "category"
        ? catData.slice(0, 8).map((c) => ({ label: c.category, value: c.total }))
        : [...customerData]
            .sort((a, b) => b.totalExpenses - a.totalExpenses)
            .slice(0, 8)
            .map((c) => ({ label: c.customerName, value: c.totalExpenses }));

    const grand = source.reduce((s, i) => s + i.value, 0) || 1;
    return source.map((item, idx) => ({
      ...item,
      color: C.cat[idx % C.cat.length],
      pct: (item.value / grand) * 100,
      pctDisplay: Math.round((item.value / grand) * 100),
    }));
  }, [activeMode, catData, customerData]);

  // Today vs yesterday delta — for expenses, down is good
  const delta = todayExpenses - yesterdayExpenses;
  const deltaPct =
    yesterdayExpenses > 0
      ? Math.round(Math.abs((delta / yesterdayExpenses) * 100))
      : null;
  const deltaDown = delta <= 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <Link
          to="/reports/expenses"
          className="flex items-center gap-0.5 text-[11px] font-semibold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
        >
          Expense Breakdown <ChevronRight className="h-3 w-3" />
        </Link>
        {!forceCategory && (
          <div className="flex rounded-md border border-border overflow-hidden text-[10px] font-semibold">
            <button
              onClick={() => setMode("category")}
              className={`px-2.5 py-1 transition-colors ${
                activeMode === "category"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Category
            </button>
            <button
              onClick={() => setMode("customer")}
              className={`px-2.5 py-1 transition-colors ${
                activeMode === "customer"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Customer
            </button>
          </div>
        )}
      </div>

      {/* Today's expenses */}
      <div className="mb-5">
        <p className="text-xs text-muted-foreground mb-1">Today's expenses</p>
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-3xl font-bold tracking-tight tabular-nums">
            {fmtFull(todayExpenses)}
          </span>
          {deltaPct != null && (
            <span
              className={`flex items-center gap-1 text-sm font-medium ${
                deltaDown ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {deltaDown ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5" />
              )}
              {deltaPct}% vs yesterday
            </span>
          )}
          {deltaPct == null && todayExpenses === 0 && (
            <span className="text-sm text-muted-foreground">No expenses recorded today</span>
          )}
        </div>
      </div>

      {/* Stacked storage bar */}
      {isLoadingCat ? (
        <div className="h-8 animate-pulse bg-muted rounded-full mb-5" />
      ) : items.length === 0 ? (
        <div className="h-8 rounded-full bg-muted/40 mb-5 flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground">No expense data</span>
        </div>
      ) : (
        <div className="flex rounded-full overflow-hidden h-8 mb-5 gap-[2px]">
          {items.map((item) => (
            <div
              key={item.label}
              className="h-full transition-all duration-500"
              style={{
                width: `${item.pct}%`,
                backgroundColor: item.color,
                minWidth: item.pct > 1 ? "6px" : "0px",
              }}
              title={`${item.label}: ${fmtFull(item.value)} (${item.pctDisplay}%)`}
            />
          ))}
        </div>
      )}

      {/* Legend rows */}
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2.5">
              <span
                className="h-3 w-4 rounded-[3px] shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="flex-1 text-sm text-foreground truncate">{item.label}</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {fmtFull(item.value)}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">
                {item.pctDisplay}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Customer Insights ────────────────────────────────────────────────────────

function CustomerInsights({
  summaries,
  selectedId,
  onSelect,
}: {
  summaries: CustomerSummary[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (summaries.length === 0) return null;
  const sorted = [...summaries].sort((a, b) => b.netProfit - a.netProfit);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
          Customer Profitability — This Month
        </p>
        <Link
          to="/customers"
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {sorted.slice(0, 5).map((cs, idx) => (
          <button
            key={cs.customerId}
            onClick={() =>
              onSelect(selectedId === cs.customerId ? null : cs.customerId)
            }
            className={`w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-muted/30 transition-colors ${
              selectedId === cs.customerId ? "bg-muted/50" : ""
            }`}
          >
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground w-4 shrink-0">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{cs.customerName}</p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {cs.customerType}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p
                className="text-sm font-bold tabular-nums"
                style={{ color: cs.netProfit >= 0 ? C.income : C.expense }}
              >
                {cs.netProfit >= 0 ? "+" : "−"}
                {fmtCurrency(Math.abs(cs.netProfit))}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {fmtCurrency(cs.totalIncome)} rev
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Transactions ──────────────────────────────────────────────────────

function RecentTransactions({
  txs,
  isLoading,
}: {
  txs: Transaction[];
  isLoading: boolean;
}) {
  const recent = txs.slice(0, 6);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
          Recent Transactions
        </p>
        <Link
          to="/transactions"
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      {isLoading ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 animate-pulse bg-muted rounded" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[480px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">
                  Description
                </th>
                <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden md:table-cell">
                  Category
                </th>
                <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">
                  Status
                </th>
                <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden sm:table-cell">
                  Date
                </th>
                <th className="px-5 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                recent.map((t) => {
                  const total = t.quantity * t.unit_price;
                  const isIncome = t.type === "income";
                  return (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-medium text-foreground truncate block max-w-[200px]">
                          {t.description || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground hidden md:table-cell">
                        {t.category || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            t.status === "success"
                              ? "bg-foreground/8 text-foreground"
                              : t.status === "pending"
                              ? "bg-muted text-muted-foreground"
                              : "bg-muted text-muted-foreground line-through"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              t.status === "success"
                                ? "bg-emerald-500"
                                : t.status === "pending"
                                ? "bg-yellow-500"
                                : "bg-muted-foreground"
                            }`}
                          />
                          {t.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground tabular-nums hidden sm:table-cell">
                        {format(new Date(t.transaction_date), "d MMM")}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold">
                        <span style={{ color: isIncome ? C.income : C.expense }}>
                          {isIncome ? "+" : "−"}
                          {fmtFull(total)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Site Status Strip ────────────────────────────────────────────────────────

function SiteStatusStrip({ siteId }: { siteId: string }) {
  const today = new Date();
  const from = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const to = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const todayStr = format(today, "yyyy-MM-dd");

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment", siteId],
    queryFn: () => getEquipment(siteId),
  });
  const { data: incidents = [] } = useQuery({
    queryKey: ["safety-incidents", siteId],
    queryFn: () => getSafetyIncidents(siteId),
  });
  const { data: shifts = [] } = useQuery({
    queryKey: ["planned-shifts", siteId, from, to],
    queryFn: () => getPlannedShifts(siteId, from, to),
  });
  const { data: workers = [] } = useQuery({
    queryKey: ["workers", siteId],
    queryFn: () => getWorkers(siteId),
  });

  const operational = equipment.filter((e) => e.status === "operational").length;
  const maintenance = equipment.filter((e) => e.status === "maintenance").length;
  const overdue = equipment.filter(
    (e) =>
      e.next_service_date &&
      isPast(parseISO(e.next_service_date)) &&
      e.status !== "retired"
  ).length;
  const openIncidents = incidents.filter((i) => !i.resolved_at).length;
  const criticalIncidents = incidents.filter(
    (i) => !i.resolved_at && i.severity === "critical"
  ).length;
  const todayShifts = shifts.filter((s) => s.shift_date === todayStr).length;
  const activeWorkers = workers.filter((w) => w.status === "active").length;

  const items = [
    {
      icon: <Wrench className="h-3 w-3" />,
      label: "Equipment",
      value: `${operational} op · ${maintenance} svc`,
      alert: overdue > 0,
      alertLabel: overdue > 0 ? `${overdue} overdue` : undefined,
      href: "/equipment",
    },
    {
      icon: <ShieldAlert className="h-3 w-3" />,
      label: "Safety",
      value:
        openIncidents === 0
          ? "All clear"
          : `${openIncidents} open${criticalIncidents > 0 ? ` · ${criticalIncidents} critical` : ""}`,
      alert: criticalIncidents > 0,
      alertLabel: undefined,
      href: "/safety",
    },
    {
      icon: <CalendarDays className="h-3 w-3" />,
      label: "Shifts today",
      value: String(todayShifts),
      alert: false,
      alertLabel: undefined,
      href: "/team/schedule",
    },
    {
      icon: <Users className="h-3 w-3" />,
      label: "Active team",
      value: `${activeWorkers} of ${workers.length}`,
      alert: false,
      alertLabel: undefined,
      href: "/team",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.href}
            className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors"
          >
            <span
              className={`shrink-0 ${
                item.alert ? "text-yellow-500" : "text-muted-foreground"
              }`}
            >
              {item.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {item.label}
              </p>
              <p className="text-xs font-semibold truncate">{item.value}</p>
            </div>
            {item.alert && (
              <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { userProfile } = useAuth();
  const { activeSiteId } = useSite();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const today = new Date();

  const [dateFrom, setDateFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));

  const DASH_PRESETS = [
    { label: "Today",         from: format(today, "yyyy-MM-dd"),                                      to: format(today, "yyyy-MM-dd") },
    { label: "This week",     from: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),   to: format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd") },
    { label: "This month",    from: format(startOfMonth(today), "yyyy-MM-dd"),                        to: format(endOfMonth(today), "yyyy-MM-dd") },
    { label: "Last 3 months", from: format(startOfMonth(subMonths(today, 2)), "yyyy-MM-dd"),          to: format(endOfMonth(today), "yyyy-MM-dd") },
  ];

  // ── All transactions (KPIs + recent list)
  const { data: txs = [], isLoading: txsLoading } = useQuery({
    queryKey: ["transactions", activeSiteId, dateFrom, dateTo],
    queryFn: () => getTransactions(activeSiteId!, { dateFrom, dateTo }),
    enabled: !!activeSiteId,
  });

  // ── Customers list (filter dropdown)
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled: !!activeSiteId,
  });

  // ── Monthly trend (6-month sparkbars)
  const trendFrom = format(
    new Date(today.getFullYear(), today.getMonth() - 5, 1),
    "yyyy-MM-dd"
  );
  const trendTo = format(today, "yyyy-MM-dd");
  const { data: trend = [], isLoading: trendLoading } = useQuery({
    queryKey: ["monthly-trend", activeSiteId, trendFrom, trendTo],
    queryFn: () => getMonthlyTrend(activeSiteId!, trendFrom, trendTo),
    enabled: !!activeSiteId,
  });

  // ── Expense categories
  const { data: expenseCats = [], isLoading: catsLoading } = useQuery({
    queryKey: ["expenses-by-category", activeSiteId, dateFrom, dateTo],
    queryFn: () => getExpensesByCategory(activeSiteId!, dateFrom, dateTo),
    enabled: !!activeSiteId,
  });

  // ── Customer summaries
  const todayStr = format(today, "yyyy-MM-dd");
  const yesterdayStr = format(subDays(today, 1), "yyyy-MM-dd");

  const { data: customerSummaries = [] } = useQuery({
    queryKey: ["customer-summaries", activeSiteId, dateFrom, dateTo],
    queryFn: () => getCustomerSummaries(activeSiteId!, dateFrom, dateTo),
    enabled: !!activeSiteId,
  });

  // ── KPI targets (this month)
  const monthKey = format(startOfMonth(today), "yyyy-MM-dd");
  const { data: kpiTargets = [] } = useQuery({
    queryKey: ["kpi_targets", activeSiteId, [monthKey]],
    queryFn: () => getKpiTargets(activeSiteId!, [monthKey]),
    enabled: !!activeSiteId,
  });

  // ── Filter transactions by selected customer
  const filteredTxs = useMemo(
    () =>
      selectedCustomerId
        ? txs.filter((t) => t.customer_id === selectedCustomerId)
        : txs,
    [txs, selectedCustomerId]
  );

  // ── KPIs
  const successTxs = filteredTxs.filter((t) => t.status === "success");
  const totalRevenue = successTxs
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.quantity * t.unit_price, 0);
  const totalExpenses = successTxs
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.quantity * t.unit_price, 0);
  const netRevenue = totalRevenue - totalExpenses;

  // ── Today / yesterday expense totals (site-wide, not filtered by customer)
  const allSuccessExpenses = txs.filter((t) => t.status === "success" && t.type === "expense");
  const todayExpenses = allSuccessExpenses
    .filter((t) => t.transaction_date === todayStr)
    .reduce((s, t) => s + t.quantity * t.unit_price, 0);
  const yesterdayExpenses = allSuccessExpenses
    .filter((t) => t.transaction_date === yesterdayStr)
    .reduce((s, t) => s + t.quantity * t.unit_price, 0);

  // ── KPI target progress
  const target = kpiTargets[0];
  const hasTarget = target?.revenue_target != null && target.revenue_target > 0;
  const progressPct = hasTarget
    ? Math.min(100, Math.round((totalRevenue / (target.revenue_target ?? 1)) * 100))
    : null;

  // ── Insight text for Revenue KPI card
  const topCustomer =
    customerSummaries.length > 0
      ? [...customerSummaries].sort((a, b) => b.totalIncome - a.totalIncome)[0]
      : null;
  const txCountMonth = successTxs.length;
  let insightHeadline = "";
  let insightSub = "";
  if (!txsLoading) {
    if (progressPct !== null && progressPct >= 100) {
      insightHeadline = `Target smashed — ${progressPct}% of ${format(today, "MMM")} target!`;
      insightSub = topCustomer
        ? `${topCustomer.customerName} is your top earner.`
        : `${txCountMonth} transactions confirmed.`;
    } else if (progressPct !== null && progressPct > 0) {
      insightHeadline = `${progressPct}% toward your ${format(today, "MMM")} target.`;
      insightSub = topCustomer
        ? `Top: ${topCustomer.customerName} · ${fmtCurrency(topCustomer.totalIncome)} rev.`
        : `${txCountMonth} transactions this month.`;
    } else if (topCustomer) {
      insightHeadline = `${txCountMonth} transaction${txCountMonth !== 1 ? "s" : ""} this month.`;
      insightSub = `Top: ${topCustomer.customerName} · ${fmtCurrency(topCustomer.totalIncome)} rev.`;
    }
  }

  // ── Month-over-month trend percentages from the last two trend entries
  const prevMonth = trend[trend.length - 2];
  const currMonth = trend[trend.length - 1];
  const revenueTrendPct =
    prevMonth && prevMonth.income > 0
      ? Math.round(((currMonth.income - prevMonth.income) / prevMonth.income) * 1000) / 10
      : null;
  const expenseTrendPct =
    prevMonth && prevMonth.expenses > 0
      ? Math.round(((currMonth.expenses - prevMonth.expenses) / prevMonth.expenses) * 1000) / 10
      : null;
  const prevNet = (prevMonth?.income ?? 0) - (prevMonth?.expenses ?? 0);
  const currNet = (currMonth?.income ?? 0) - (currMonth?.expenses ?? 0);
  const netTrendPct =
    prevMonth && prevNet !== 0
      ? Math.round(((currNet - prevNet) / Math.abs(prevNet)) * 1000) / 10
      : null;

  // ── Expense chart: use selected customer's breakdown when filtered
  const selectedSummary = customerSummaries.find(
    (c) => c.customerId === selectedCustomerId
  );
  const expenseChartCats =
    selectedCustomerId && selectedSummary
      ? selectedSummary.expensesByCategory
      : expenseCats;

  if (!activeSiteId) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a site to view the dashboard.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {today.toLocaleDateString("en-US", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        {customers.length > 0 && (
          <CustomerFilter
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
            value={selectedCustomerId}
            onChange={setSelectedCustomerId}
          />
        )}
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-8 w-36 text-xs"
        />
        <span className="text-xs text-muted-foreground">→</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-8 w-36 text-xs"
        />
        <div className="flex gap-1.5 flex-wrap">
          {DASH_PRESETS.map((p) => {
            const active = dateFrom === p.from && dateTo === p.to;
            return (
              <button
                key={p.label}
                onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                className={`h-8 rounded-lg border px-3 text-xs font-medium transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="Revenue"
          rawValue={totalRevenue}
          sub={selectedCustomerId ? selectedSummary?.customerName : "All confirmed income"}
          trendPct={revenueTrendPct}
          href="/transactions"
          progressPct={progressPct}
          progressLabel={`${format(today, "MMM")} target`}
          color={C.income}
          insightHeadline={insightHeadline || undefined}
          insightSub={insightSub || undefined}
        />
        <KpiCard
          label="Expenses"
          rawValue={totalExpenses}
          sub={selectedCustomerId ? selectedSummary?.customerName : "All confirmed expenses"}
          trendPct={expenseTrendPct}
          href="/transactions"
          color={C.expense}
        />
        <KpiCard
          label="Net Profit"
          rawValue={Math.abs(netRevenue)}
          sub={netRevenue >= 0 ? "Positive cashflow" : "Net loss"}
          trendPct={netTrendPct}
          href="/reports"
          color={C.net}
          valueColor={netRevenue >= 0 ? C.net : C.loss}
        />
      </div>

      {/* Expense Breakdown — full width */}
      <ExpenseBreakdown
        catData={expenseChartCats}
        customerData={customerSummaries}
        isLoadingCat={!selectedCustomerId && catsLoading}
        forceCategory={!!selectedCustomerId}
        todayExpenses={todayExpenses}
        yesterdayExpenses={yesterdayExpenses}
      />

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

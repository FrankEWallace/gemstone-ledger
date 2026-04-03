import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Download,
  CalendarDays,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, startOfWeek, endOfWeek, isPast, parseISO, startOfMonth, endOfMonth, differenceInCalendarDays } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import { isDemoMode } from "@/lib/demo";
import { getInventoryItems } from "@/services/inventory.service";
import { getTransactions } from "@/services/transactions.service";
import { getEquipment } from "@/services/equipment.service";
import { getSafetyIncidents } from "@/services/safety.service";
import { getPlannedShifts } from "@/services/schedule.service";
import { getWorkers } from "@/services/team.service";
import { getKpiTargets } from "@/services/kpi.service";
import { getMonthlyTrend, getExpensesByCategory, getCustomerSummaries } from "@/services/reports.service";
import { supabase } from "@/lib/supabase";

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toLocaleString()}`;
}
function fmtFull(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// ─── Mini sparkbar ────────────────────────────────────────────────────────────

function SparkBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[2px] h-8 opacity-60">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-[5px] rounded-[2px] bg-foreground"
          style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  sparkValues,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  sparkValues?: number[];
  href: string;
}) {
  return (
    <Link
      to={href}
      className="group rounded-xl border border-border bg-card p-5 flex flex-col gap-3 hover:border-foreground/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
          {label}
        </p>
        {sparkValues && <SparkBars values={sparkValues} />}
      </div>
      <p className="text-[28px] font-bold tracking-tight leading-none font-display">{value}</p>
      {sub && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {sub}
        </p>
      )}
    </Link>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
        {title}
      </p>
      {href && (
        <Link
          to={href}
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.fill }}
          />
          {p.name}: <span className="font-semibold text-foreground">{fmtFull(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Revenue Trend Chart ──────────────────────────────────────────────────────

function RevenueTrendChart({ siteId }: { siteId: string }) {
  const today = new Date();
  const dateFrom = format(new Date(today.getFullYear(), today.getMonth() - 5, 1), "yyyy-MM-dd");
  const dateTo   = format(today, "yyyy-MM-dd");

  const { data: trend = [], isLoading } = useQuery({
    queryKey: ["monthly-trend", siteId, dateFrom, dateTo],
    queryFn: () => getMonthlyTrend(siteId, dateFrom, dateTo),
  });

  const chartData = trend.map((t) => ({
    month: t.month.slice(5),
    Income: t.income,
    Expenses: t.expenses,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionHeader title="Revenue Trend" href="/reports" />
      {isLoading ? (
        <div className="h-52 animate-pulse bg-muted rounded-lg" />
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={chartData} barGap={3} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `$${v / 1000}k`}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
            <Bar dataKey="Income" fill="hsl(var(--foreground))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Expenses" fill="hsl(var(--muted-foreground))" opacity={0.35} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-foreground" /> Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground opacity-60" /> Expenses
        </span>
      </div>
    </div>
  );
}

// ─── Expense Breakdown ────────────────────────────────────────────────────────

function ExpenseBreakdown({ siteId }: { siteId: string }) {
  const today = new Date();
  const dateFrom = format(new Date(today.getFullYear(), today.getMonth() - 5, 1), "yyyy-MM-dd");
  const dateTo   = format(today, "yyyy-MM-dd");

  const { data: cats = [], isLoading } = useQuery({
    queryKey: ["expenses-by-category", siteId, dateFrom, dateTo],
    queryFn: () => getExpensesByCategory(siteId, dateFrom, dateTo),
  });

  const top = cats.slice(0, 5);
  const maxVal = Math.max(...top.map((c) => c.total), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionHeader title="Expense Breakdown" href="/reports" />
      {isLoading ? (
        <div className="h-52 animate-pulse bg-muted rounded-lg" />
      ) : top.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">No expense data.</p>
      ) : (
        <div className="space-y-3 mt-1">
          {top.map((cat) => {
            const pct = Math.round((cat.total / maxVal) * 100);
            return (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate">{cat.category}</span>
                  <span className="tabular-nums font-medium text-foreground ml-2">
                    {fmtCurrency(cat.total)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground/70 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Recent Transactions ──────────────────────────────────────────────────────

function RecentTransactions({ siteId }: { siteId: string }) {
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions", siteId, "all", "all", "all"],
    queryFn: () => getTransactions(siteId),
  });

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
          {[1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse bg-muted rounded" />)}
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Description</th>
              <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden md:table-cell">Category</th>
              <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Status</th>
              <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden sm:table-cell">Date</th>
              <th className="px-5 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Amount</th>
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
                      <span className={isIncome ? "text-foreground" : "text-muted-foreground"}>
                        {isIncome ? "+" : "−"}{fmtFull(total)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Operations summary row ───────────────────────────────────────────────────

function EquipmentCard({ siteId }: { siteId: string }) {
  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ["equipment", siteId],
    queryFn: () => getEquipment(siteId),
  });

  const operational = equipment.filter((e) => e.status === "operational").length;
  const maintenance = equipment.filter((e) => e.status === "maintenance").length;
  const overdue = equipment.filter(
    (e) => e.next_service_date && isPast(parseISO(e.next_service_date)) && e.status !== "retired"
  ).length;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionHeader title="Equipment" href="/equipment" />
      {isLoading ? (
        <div className="h-20 animate-pulse bg-muted rounded-lg" />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xl font-bold font-display">{operational}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Operational</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xl font-bold font-display">{maintenance}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">In Service</p>
            </div>
          </div>
          {overdue > 0 ? (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
              {overdue} unit{overdue > 1 ? "s" : ""} overdue for service
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              All service schedules current
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SafetyCard({ siteId }: { siteId: string }) {
  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["safety-incidents", siteId],
    queryFn: () => getSafetyIncidents(siteId),
  });

  const open     = incidents.filter((i) => !i.resolved_at);
  const critical = open.filter((i) => i.severity === "critical");

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionHeader title="Safety" href="/safety" />
      {isLoading ? (
        <div className="h-20 animate-pulse bg-muted rounded-lg" />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className={`text-xl font-bold font-display ${open.length > 0 ? "text-foreground" : ""}`}>
                {open.length}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Open</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xl font-bold font-display">{critical.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Critical</p>
            </div>
          </div>
          {open.length === 0 ? (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              All incidents resolved
            </p>
          ) : (
            <div className="space-y-1">
              {open.slice(0, 2).map((i) => (
                <p key={i.id} className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    i.severity === "critical" ? "bg-red-500" : "bg-yellow-500"
                  }`} />
                  {i.title}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShiftsCard({ siteId }: { siteId: string }) {
  const today = new Date();
  const from = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const to   = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["planned-shifts", siteId, from, to],
    queryFn: () => getPlannedShifts(siteId, from, to),
  });

  const { data: workers = [] } = useQuery({
    queryKey: ["workers", siteId],
    queryFn: () => getWorkers(siteId),
  });

  const workerMap = Object.fromEntries(workers.map((w) => [w.id, w.full_name]));
  const todayStr   = format(today, "yyyy-MM-dd");
  const todayShifts = shifts.filter((s) => s.shift_date === todayStr);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionHeader title="Shifts This Week" href="/team/schedule" />
      {isLoading ? (
        <div className="h-20 animate-pulse bg-muted rounded-lg" />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xl font-bold font-display">{shifts.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Planned</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xl font-bold font-display">{todayShifts.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Today</p>
            </div>
          </div>
          {todayShifts.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No shifts scheduled for today.</p>
          ) : (
            todayShifts.slice(0, 2).map((s) => (
              <p key={s.id} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3 shrink-0" />
                <span className="truncate">{workerMap[s.worker_id] ?? "?"}</span>
                <span className="ml-auto tabular-nums">{s.start_time.slice(0, 5)}</span>
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function LowStockCard({ siteId }: { siteId: string }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory", siteId],
    queryFn: () => getInventoryItems(siteId),
  });

  const lowStock = items.filter(
    (i) => i.reorder_level !== null && i.quantity <= i.reorder_level
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionHeader title="Low Stock" href="/inventory" />
      {isLoading ? (
        <div className="h-20 animate-pulse bg-muted rounded-lg" />
      ) : lowStock.length === 0 ? (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          All items above reorder level
        </p>
      ) : (
        <div className="space-y-2">
          {lowStock.slice(0, 4).map((i) => (
            <div key={i.id} className="flex items-center gap-2 text-[11px]">
              <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
              <span className="flex-1 truncate text-muted-foreground">{i.name}</span>
              <span className="tabular-nums font-medium">
                {i.quantity} <span className="text-muted-foreground">{i.unit ?? ""}</span>
              </span>
            </div>
          ))}
          {lowStock.length > 4 && (
            <p className="text-[11px] text-muted-foreground">+{lowStock.length - 4} more items</p>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard2({ siteId }: { siteId: string }) {
  const today = new Date();
  const monthKey = format(startOfMonth(today), "yyyy-MM-dd");
  const from = format(startOfMonth(today), "yyyy-MM-dd");
  const to   = format(endOfMonth(today), "yyyy-MM-dd");

  const { data: targets = [] } = useQuery({
    queryKey: ["kpi_targets", siteId, [monthKey]],
    queryFn: () => getKpiTargets(siteId, [monthKey]),
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions", siteId, "all", "all", "all"],
    queryFn: () => getTransactions(siteId),
  });

  const target = targets[0];
  const successTxs = txs.filter((t) => t.status === "success");
  const monthRevenue = successTxs
    .filter((t) => t.type === "income" && t.transaction_date >= from && t.transaction_date <= to)
    .reduce((s, t) => s + t.quantity * t.unit_price, 0);

  const hasTarget = target?.revenue_target != null && target.revenue_target > 0;
  const pct = hasTarget ? Math.min(100, Math.round((monthRevenue / (target.revenue_target ?? 1)) * 100)) : null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionHeader title="KPI — This Month" href="/settings/targets" />
      {!hasTarget ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">No targets set for {format(today, "MMMM")}.</p>
          <Link to="/settings/targets" className="text-[11px] underline underline-offset-2 text-foreground">
            Set targets →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-muted-foreground">Revenue target</span>
              <span className="font-semibold tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {fmtFull(monthRevenue)} / {fmtFull(target.revenue_target!)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Intelligence Alert Banner ────────────────────────────────────────────────

type AlertItem = {
  id: string;
  level: "warning" | "critical" | "info";
  message: string;
  href?: string;
};

function IntelligenceAlertBanner({ siteId }: { siteId: string }) {
  const today = new Date();
  const thisMonthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const todayStr       = format(today, "yyyy-MM-dd");

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", siteId],
    queryFn: () => import("@/services/customers.service").then((m) => m.getCustomers(siteId)),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory", siteId],
    queryFn: () => import("@/services/inventory.service").then((m) => m.getInventoryItems(siteId)),
  });

  const { data: customerSummaries = [] } = useQuery({
    queryKey: ["customer-summaries", siteId, thisMonthStart, todayStr],
    queryFn: () => getCustomerSummaries(siteId, thisMonthStart, todayStr),
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions", siteId, "all", "all", "all"],
    queryFn: () => getTransactions(siteId),
  });

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const alerts: AlertItem[] = [];

  // 1. Contracts expiring within 14 days
  customers
    .filter((c) => c.status === "active" && c.contract_end)
    .forEach((c) => {
      const end = parseISO(c.contract_end!);
      const daysLeft = differenceInCalendarDays(end, today);
      if (daysLeft >= 0 && daysLeft <= 14) {
        alerts.push({
          id: `expiring-${c.id}`,
          level: daysLeft <= 3 ? "critical" : "warning",
          message: `Contract expiring in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}: ${c.name}`,
          href: `/customers/${c.id}`,
        });
      }
    });

  // 2. Customers with negative profitability this month
  customerSummaries
    .filter((cs) => cs.netProfit < 0 && cs.transactionCount > 0)
    .forEach((cs) => {
      alerts.push({
        id: `negative-profit-${cs.customerId}`,
        level: "warning",
        message: `${cs.customerName} is unprofitable this month (net ${cs.netProfit < 0 ? "−" : ""}$${Math.abs(Math.round(cs.netProfit)).toLocaleString()})`,
        href: `/customers/${cs.customerId}`,
      });
    });

  // 3. High expense ratio site-wide this month
  const monthTxs = txs.filter((t) => t.transaction_date >= thisMonthStart && t.status === "success");
  const monthIncome   = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.unit_price * t.quantity, 0);
  const monthExpenses = monthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.unit_price * t.quantity, 0);
  if (monthIncome > 0 && monthExpenses / monthIncome > 0.85) {
    alerts.push({
      id: "high-expense-ratio",
      level: "warning",
      message: `High expense ratio this month: ${Math.round((monthExpenses / monthIncome) * 100)}% of income spent on expenses`,
      href: "/reports",
    });
  }

  // 4. Inventory below reorder level
  inventory
    .filter((item) => item.reorder_level != null && item.quantity <= item.reorder_level!)
    .slice(0, 3)
    .forEach((item) => {
      alerts.push({
        id: `low-stock-${item.id}`,
        level: item.quantity === 0 ? "critical" : "info",
        message: `Low stock: ${item.name} — ${item.quantity} ${item.unit ?? "units"} remaining (reorder at ${item.reorder_level})`,
        href: "/inventory",
      });
    });

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const colorMap = {
    critical: "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 text-red-800 dark:text-red-300",
    warning:  "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-amber-800 dark:text-amber-300",
    info:     "border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 text-blue-800 dark:text-blue-300",
  };

  return (
    <div className="space-y-2">
      {visible.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-xs ${colorMap[alert.level]}`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {alert.href ? (
              <Link to={alert.href} className="hover:underline underline-offset-2">
                {alert.message}
              </Link>
            ) : (
              <span>{alert.message}</span>
            )}
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set([...prev, alert.id]))}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { userProfile } = useAuth();
  const { activeSiteId } = useSite();
  const firstName = userProfile?.full_name?.split(" ")[0] ?? "there";

  // Top-line KPIs
  const { data: txs = [] } = useQuery({
    queryKey: ["transactions", activeSiteId, "all", "all", "all"],
    queryFn: () => getTransactions(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { data: workers = [] } = useQuery({
    queryKey: ["workers", activeSiteId],
    queryFn: () => getWorkers(activeSiteId!),
    enabled: !!activeSiteId,
  });

  // Unread messages
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["messages-unread", activeSiteId],
    queryFn: async () => {
      if (isDemoMode()) return 4;
      const since = localStorage.getItem("messagesLastSeen") ?? new Date(0).toISOString();
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("site_id", activeSiteId!)
        .gt("created_at", since);
      return count ?? 0;
    },
    enabled: !!activeSiteId,
  });

  // Monthly trend for sparkbars
  const today = new Date();
  const trendFrom = format(new Date(today.getFullYear(), today.getMonth() - 5, 1), "yyyy-MM-dd");
  const trendTo   = format(today, "yyyy-MM-dd");
  const { data: trend = [] } = useQuery({
    queryKey: ["monthly-trend", activeSiteId, trendFrom, trendTo],
    queryFn: () => getMonthlyTrend(activeSiteId!, trendFrom, trendTo),
    enabled: !!activeSiteId,
  });

  const successTxs    = txs.filter((t) => t.status === "success");
  const totalRevenue  = successTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.quantity * t.unit_price, 0);
  const totalExpenses = successTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.quantity * t.unit_price, 0);
  const netRevenue    = totalRevenue - totalExpenses;
  const activeWorkers = workers.filter((w) => w.status === "active").length;

  const incomeSpark   = trend.map((t) => t.income);
  const expenseSpark  = trend.map((t) => t.expenses);
  const netSpark      = trend.map((t) => Math.max(0, t.income - t.expenses));

  // Customer profitability — this month only
  const thisMonthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const todayStr       = format(today, "yyyy-MM-dd");
  const { data: customerSummaries = [] } = useQuery({
    queryKey: ["customer-summaries", activeSiteId, thisMonthStart, todayStr],
    queryFn: () => getCustomerSummaries(activeSiteId!, thisMonthStart, todayStr),
    enabled: !!activeSiteId,
  });
  const topCustomers = [...customerSummaries]
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, 3);

  if (!activeSiteId) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a site to view the dashboard.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {today.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <Link
          to="/reports"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Export Report
        </Link>
      </div>

      {/* Intelligence Alerts */}
      <IntelligenceAlertBanner siteId={activeSiteId} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total Revenue"
          value={fmtCurrency(totalRevenue)}
          sub="All confirmed income"
          sparkValues={incomeSpark.length ? incomeSpark : [1, 2, 3, 4, 5, 6]}
          href="/transactions"
        />
        <KpiCard
          label="Total Expenses"
          value={fmtCurrency(totalExpenses)}
          sub="All confirmed expenses"
          sparkValues={expenseSpark.length ? expenseSpark : [1, 2, 3, 4, 5, 6]}
          href="/transactions"
        />
        <KpiCard
          label="Net Revenue"
          value={fmtCurrency(Math.abs(netRevenue))}
          sub={netRevenue >= 0 ? "Positive cashflow" : "Net loss"}
          sparkValues={netSpark.length ? netSpark : [1, 2, 3, 4, 5, 6]}
          href="/reports"
        />
        <KpiCard
          label="Active Workers"
          value={String(activeWorkers)}
          sub={`${workers.length} total on roster · ${unreadCount} unread msgs`}
          href="/team"
        />
      </div>

      {/* Customer Profitability */}
      {topCustomers.length > 0 && (
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
            {topCustomers.map((cs, idx) => (
              <div key={cs.customerId} className="flex items-center gap-4 px-5 py-3">
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground w-4 shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{cs.customerName}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{cs.customerType}</p>
                </div>
                <SparkBars values={[cs.totalIncome, cs.totalExpenses]} />
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold tabular-nums ${cs.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {cs.netProfit >= 0 ? "+" : "−"}{fmtCurrency(Math.abs(cs.netProfit))}
                  </p>
                  <p className="text-[10px] text-muted-foreground">net profit</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueTrendChart siteId={activeSiteId} />
        </div>
        <ExpenseBreakdown siteId={activeSiteId} />
      </div>

      {/* Transactions table */}
      <RecentTransactions siteId={activeSiteId} />

      {/* Operations row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <EquipmentCard siteId={activeSiteId} />
        <SafetyCard siteId={activeSiteId} />
        <ShiftsCard siteId={activeSiteId} />
        <LowStockCard siteId={activeSiteId} />
        <KpiCard2 siteId={activeSiteId} />
      </div>
    </div>
  );
}

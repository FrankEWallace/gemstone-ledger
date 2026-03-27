import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Package,
  ArrowLeftRight,
  Wrench,
  ShieldAlert,
  FolderOpen,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Users,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, isPast, parseISO } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import { supabase } from "@/lib/supabase";
import { getInventoryItems } from "@/services/inventory.service";
import { getTransactions } from "@/services/transactions.service";
import { getEquipment } from "@/services/equipment.service";
import { getSafetyIncidents } from "@/services/safety.service";
import { getPlannedShifts } from "@/services/schedule.service";
import { getSiteDocuments } from "@/services/documents.service";
import { getWorkers } from "@/services/team.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// ─── Widget shells ────────────────────────────────────────────────────────────

function Widget({
  title,
  href,
  children,
  className = "",
}: {
  title: string;
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card flex flex-col ${className}`}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-sm font-semibold">{title}</p>
        <Link to={href} className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors">
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex-1 px-4 pb-4">{children}</div>
    </div>
  );
}

function StatPill({
  label,
  value,
  icon,
  trend,
  trendLabel,
  href,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  href: string;
}) {
  return (
    <Link to={href} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="rounded-lg bg-muted p-2">{icon}</span>
      </div>
      <p className="text-2xl font-bold font-display">{value}</p>
      {trendLabel && (
        <p className={`text-xs flex items-center gap-1 ${trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`}>
          {trend === "up" && <TrendingUp className="h-3 w-3" />}
          {trend === "down" && <TrendingDown className="h-3 w-3" />}
          {trendLabel}
        </p>
      )}
    </Link>
  );
}

// ─── Equipment donut ──────────────────────────────────────────────────────────

const EQUIP_COLORS = { operational: "#22c55e", maintenance: "#eab308", retired: "#94a3b8" };

function EquipmentWidget({ siteId }: { siteId: string }) {
  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ["equipment", siteId],
    queryFn: () => getEquipment(siteId),
  });

  const counts = {
    operational: equipment.filter((e) => e.status === "operational").length,
    maintenance: equipment.filter((e) => e.status === "maintenance").length,
    retired:     equipment.filter((e) => e.status === "retired").length,
  };

  const overdueService = equipment.filter(
    (e) => e.next_service_date && isPast(parseISO(e.next_service_date)) && e.status !== "retired"
  ).length;

  const pieData = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <Widget title="Equipment" href="/equipment">
      {isLoading ? (
        <div className="h-32 animate-pulse bg-muted rounded" />
      ) : equipment.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No equipment added yet.</p>
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={100} height={100}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={46}>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={EQUIP_COLORS[entry.name as keyof typeof EQUIP_COLORS]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                formatter={(v: number, name: string) => [v, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 flex-1">
            {Object.entries(counts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 capitalize text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: EQUIP_COLORS[status as keyof typeof EQUIP_COLORS] }} />
                  {status}
                </span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
            {overdueService > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1 pt-1">
                <AlertTriangle className="h-3 w-3" />
                {overdueService} overdue for service
              </p>
            )}
          </div>
        </div>
      )}
    </Widget>
  );
}

// ─── Safety widget ────────────────────────────────────────────────────────────

function SafetyWidget({ siteId }: { siteId: string }) {
  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["safety-incidents", siteId],
    queryFn: () => getSafetyIncidents(siteId),
  });

  const open     = incidents.filter((i) => !i.resolved_at);
  const critical = open.filter((i) => i.severity === "critical");

  return (
    <Widget title="Safety Incidents" href="/safety">
      {isLoading ? (
        <div className="h-24 animate-pulse bg-muted rounded" />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <p className={`text-2xl font-bold font-display ${open.length > 0 ? "text-orange-500" : "text-emerald-500"}`}>{open.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Open</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <p className={`text-2xl font-bold font-display ${critical.length > 0 ? "text-red-600" : ""}`}>{critical.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Critical</p>
            </div>
          </div>
          {open.length === 0 ? (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> All incidents resolved
            </p>
          ) : (
            <div className="space-y-1">
              {open.slice(0, 2).map((i) => (
                <div key={i.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    i.severity === "critical" ? "bg-red-500" : i.severity === "high" ? "bg-orange-500" : "bg-yellow-500"
                  }`} />
                  <span className="truncate">{i.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Widget>
  );
}

// ─── Shifts this week ─────────────────────────────────────────────────────────

function ShiftsWidget({ siteId }: { siteId: string }) {
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
  const todayStr = format(today, "yyyy-MM-dd");
  const todayShifts = shifts.filter((s) => s.shift_date === todayStr);

  return (
    <Widget title="Shifts This Week" href="/team/schedule">
      {isLoading ? (
        <div className="h-24 animate-pulse bg-muted rounded" />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
            <span><span className="font-semibold text-foreground text-sm">{shifts.length}</span> planned</span>
            <span>·</span>
            <span><span className="font-semibold text-foreground text-sm">{todayShifts.length}</span> today</span>
          </div>
          {todayShifts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No shifts scheduled for today.</p>
          ) : (
            todayShifts.slice(0, 3).map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate font-medium">{workerMap[s.worker_id] ?? "?"}</span>
                <span className="text-muted-foreground tabular-nums">{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </Widget>
  );
}

// ─── Low stock ────────────────────────────────────────────────────────────────

function LowStockWidget({ siteId }: { siteId: string }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory", siteId],
    queryFn: () => getInventoryItems(siteId),
  });

  const lowStock = items.filter(
    (i) => i.reorder_level !== null && i.quantity <= i.reorder_level
  );

  return (
    <Widget title="Low Stock Alerts" href="/inventory">
      {isLoading ? (
        <div className="h-24 animate-pulse bg-muted rounded" />
      ) : lowStock.length === 0 ? (
        <p className="text-xs text-emerald-600 flex items-center gap-1 py-2">
          <CheckCircle2 className="h-3.5 w-3.5" /> All items above reorder level
        </p>
      ) : (
        <div className="space-y-1.5">
          {lowStock.slice(0, 5).map((i) => (
            <div key={i.id} className="flex items-center gap-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <span className="flex-1 truncate">{i.name}</span>
              <span className="tabular-nums text-muted-foreground">{i.quantity} {i.unit ?? ""}</span>
            </div>
          ))}
          {lowStock.length > 5 && (
            <p className="text-xs text-muted-foreground">+{lowStock.length - 5} more items</p>
          )}
        </div>
      )}
    </Widget>
  );
}

// ─── Recent Documents ─────────────────────────────────────────────────────────

function DocumentsWidget({ siteId }: { siteId: string }) {
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["site-documents", siteId],
    queryFn: () => getSiteDocuments(siteId),
  });

  return (
    <Widget title="Recent Documents" href="/documents">
      {isLoading ? (
        <div className="h-24 animate-pulse bg-muted rounded" />
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No documents uploaded yet.</p>
      ) : (
        <div className="space-y-1.5">
          {docs.slice(0, 4).map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-xs">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{d.name}</span>
              {d.category && <span className="text-muted-foreground">{d.category}</span>}
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

// ─── Recent Transactions ──────────────────────────────────────────────────────

function RecentTxWidget({ siteId }: { siteId: string }) {
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions", siteId, "all", "all", "all"],
    queryFn: () => getTransactions(siteId),
  });

  const recent = txs.slice(0, 5);

  return (
    <Widget title="Recent Transactions" href="/transactions" className="lg:col-span-2">
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map((i) => <div key={i} className="h-8 animate-pulse bg-muted rounded" />)}
        </div>
      ) : recent.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No transactions yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {recent.map((t) => {
            const total = t.quantity * t.unit_price;
            const isIncome = t.type === "income";
            return (
              <div key={t.id} className="flex items-center gap-3 py-2 text-sm">
                <div className={`rounded-full p-1.5 ${isIncome ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
                  {isIncome ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-xs">{t.description || "—"}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(t.transaction_date), "MMM d, yyyy")}</p>
                </div>
                <span className={`tabular-nums text-xs font-semibold ${isIncome ? "text-emerald-600" : "text-red-500"}`}>
                  {isIncome ? "+" : "−"}{fmt(total)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Widget>
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

  const { data: unreadCount } = useQuery({
    queryKey: ["messages-unread", activeSiteId],
    queryFn: async () => {
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

  const successTxs = txs.filter((t) => t.status === "success");
  const totalRevenue  = successTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.quantity * t.unit_price, 0);
  const totalExpenses = successTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.quantity * t.unit_price, 0);
  const activeWorkers = workers.filter((w) => w.status === "active").length;

  if (!activeSiteId) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a site to view the dashboard.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Welcome back, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Top KPI stat pills */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatPill
          label="Total Revenue"
          value={fmt(totalRevenue)}
          icon={<DollarSign className="h-4 w-4 text-emerald-500" />}
          trend="up"
          trendLabel="from confirmed transactions"
          href="/transactions"
        />
        <StatPill
          label="Total Expenses"
          value={fmt(totalExpenses)}
          icon={<ArrowLeftRight className="h-4 w-4 text-red-500" />}
          trend="neutral"
          trendLabel="from confirmed transactions"
          href="/transactions"
        />
        <StatPill
          label="Active Workers"
          value={String(activeWorkers)}
          icon={<Users className="h-4 w-4 text-primary" />}
          trendLabel={`${workers.length} total on roster`}
          href="/team"
        />
        <StatPill
          label="Unread Messages"
          value={String(unreadCount ?? 0)}
          icon={<Package className="h-4 w-4 text-muted-foreground" />}
          trendLabel="across all channels"
          href="/messages"
        />
      </div>

      {/* Main widgets grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <EquipmentWidget siteId={activeSiteId} />
        <SafetyWidget siteId={activeSiteId} />
        <ShiftsWidget siteId={activeSiteId} />
        <LowStockWidget siteId={activeSiteId} />
        <DocumentsWidget siteId={activeSiteId} />
        <RecentTxWidget siteId={activeSiteId} />
      </div>
    </div>
  );
}

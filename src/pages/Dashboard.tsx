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
  Globe,
  User,
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
  getIncomeByCategory,
  getExpensesByCustomer,
  getIncomeByCustomer,
  getCustomerSummaries,
} from "@/services/reports.service";
import type { CustomerSummary, CustomerTotal } from "@/services/reports.service";
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

// ─── Breakdown shared helpers ─────────────────────────────────────────────────

type BreakdownPeriod = "7D" | "1M" | "3M" | "6M" | "12M" | "All";
type BreakdownMode = "overview" | "customer";

const PERIOD_DAYS: Record<BreakdownPeriod, number> = {
  "7D": 7, "1M": 30, "3M": 90, "6M": 180, "12M": 365, "All": 1825,
};

function getPeriodDates(period: BreakdownPeriod) {
  const today = new Date();
  return {
    from: format(subDays(today, PERIOD_DAYS[period] - 1), "yyyy-MM-dd"),
    to: format(today, "yyyy-MM-dd"),
  };
}

function buildItems(source: { label: string; value: number }[]) {
  const grand = source.reduce((s, i) => s + i.value, 0) || 1;
  return source.map((item, idx) => ({
    ...item,
    color: C.cat[idx % C.cat.length],
    pct: (item.value / grand) * 100,
    pctDisplay: Math.round((item.value / grand) * 100),
  }));
}

// ─── Period Pills ─────────────────────────────────────────────────────────────

function PeriodPills({ value, onChange }: { value: BreakdownPeriod; onChange: (p: BreakdownPeriod) => void }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {(["7D", "1M", "3M", "6M", "12M", "All"] as BreakdownPeriod[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`h-6 rounded-md border px-2 text-[10px] font-semibold transition-colors ${
            value === p
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

// ─── Mode Toggle ──────────────────────────────────────────────────────────────

function ModeToggle({ value, onChange }: { value: BreakdownMode; onChange: (m: BreakdownMode) => void }) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden text-[10px] font-semibold shrink-0">
      <button
        onClick={() => onChange("overview")}
        className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
          value === "overview" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Globe className="h-3 w-3" /> Overview
      </button>
      <button
        onClick={() => onChange("customer")}
        className={`flex items-center gap-1 px-2.5 py-1.5 border-l border-border transition-colors ${
          value === "customer" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <User className="h-3 w-3" /> Per Customer
      </button>
    </div>
  );
}

// ─── Customer Dropdown ────────────────────────────────────────────────────────

function CustomerDropdown({
  customers,
  value,
  onChange,
}: {
  customers: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  if (!customers.length) return null;
  return (
    <div className="relative flex items-center">
      <User className="absolute left-2.5 h-3 w-3 text-muted-foreground pointer-events-none shrink-0" />
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded-full border border-border bg-card pl-7 pr-7 py-1 text-xs font-semibold appearance-none cursor-pointer hover:border-foreground/30 transition-colors focus:outline-none max-w-[160px] truncate"
      >
        <option value="">All customers</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <ChevronRight className="absolute right-2 h-3 w-3 text-muted-foreground pointer-events-none rotate-90" />
    </div>
  );
}

// ─── Vs Yesterday Badge ───────────────────────────────────────────────────────

function VsYesterdayBadge({
  today,
  yesterday,
  upIsGood,
}: {
  today: number;
  yesterday: number;
  upIsGood: boolean;
}) {
  if (yesterday <= 0 || today === 0) return null;
  const delta = today - yesterday;
  const pct = Math.round(Math.abs((delta / yesterday) * 100));
  const isUp = delta >= 0;
  const good = upIsGood ? isUp : !isUp;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        good
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      }`}
    >
      {isUp ? "↑" : "↓"} {pct}% vs yesterday
    </span>
  );
}

// ─── Gauge Chart ──────────────────────────────────────────────────────────────

function GaugeChart({
  items,
  total,
}: {
  items: { label: string; value: number; color: string; pct: number }[];
  total: number;
}) {
  const cx = 150, cy = 145, r = 108, sw = 22, GAP = 4;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const pt = (deg: number) => ({ x: cx + r * Math.cos(toRad(deg)), y: cy + r * Math.sin(toRad(deg)) });
  const arc = (s: number, e: number) => {
    const { x: sx, y: sy } = pt(s);
    const { x: ex, y: ey } = pt(e);
    return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${Math.abs(e - s) > 180 ? 1 : 0} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  };

  // Distribute 180° across segments with GAP° gaps between them
  const n = items.length;
  const usable = 180 - (n > 1 ? (n - 1) * GAP : 0);
  let pos = 180;
  const segs = items.map((item, i) => {
    const span = total > 0 ? (item.value / total) * usable : 0;
    const start = pos;
    const end = start + span;
    pos = end + (i < n - 1 ? GAP : 0);
    return { ...item, start, end };
  });

  return (
    <svg viewBox="0 0 300 168" className="w-full" aria-hidden="true">
      {/* Muted track */}
      <path d={arc(180, 360)} fill="none" stroke="hsl(var(--muted))" strokeWidth={sw} strokeLinecap="round" />
      {/* Coloured segments with rounded caps */}
      {segs.map((seg) =>
        seg.end > seg.start ? (
          <path key={seg.label} d={arc(seg.start, seg.end)} fill="none" stroke={seg.color} strokeWidth={sw} strokeLinecap="round" />
        ) : null
      )}
      {/* Total */}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="30" fontWeight="700" fill="currentColor" fontFamily="inherit">
        {fmtCurrency(total)}
      </text>
      <text x={cx} y={cy + 20} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))" fontFamily="inherit">
        Total Income
      </text>
    </svg>
  );
}

// ─── Sparkline Bar ────────────────────────────────────────────────────────────

const SLICES = 60;

function SparklineBar({
  items,
  isLoading,
}: {
  items: { label: string; color: string; pct: number }[];
  isLoading: boolean;
}) {
  const slices = useMemo(() => {
    if (!items.length) return [];
    const out: { color: string; key: string }[] = [];
    items.forEach((item) => {
      const count = Math.max(1, Math.round((item.pct / 100) * SLICES));
      for (let i = 0; i < count; i++) out.push({ color: item.color, key: `${item.label}-${i}` });
    });
    return out.slice(0, SLICES);
  }, [items]);

  if (isLoading) return <div className="h-14 animate-pulse rounded-lg bg-muted" />;
  if (!slices.length)
    return (
      <div className="h-14 rounded-lg bg-muted/30 flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground">No data</span>
      </div>
    );

  return (
    <div className="flex gap-[3px] h-14">
      {slices.map((s) => (
        <div key={s.key} className="flex-1 rounded-[4px]" style={{ backgroundColor: s.color }} />
      ))}
    </div>
  );
}

// ─── Expense Breakdown Card ───────────────────────────────────────────────────

function ExpenseBreakdownCard({ siteId }: { siteId: string }) {
  const [period, setPeriod] = useState<BreakdownPeriod>("1M");
  const [mode, setMode] = useState<BreakdownMode>("overview");
  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);

  const { from, to } = getPeriodDates(period);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const ystdStr = format(subDays(new Date(), 1), "yyyy-MM-dd");

  const { data: catData = [], isLoading: catLoading } = useQuery({
    queryKey: ["exp-cat", siteId, from, to],
    queryFn: () => getExpensesByCategory(siteId, from, to),
    enabled: !!siteId && mode === "overview",
  });

  const { data: custData = [], isLoading: custLoading } = useQuery({
    queryKey: ["exp-by-cust", siteId, from, to],
    queryFn: () => getExpensesByCustomer(siteId, from, to),
    enabled: !!siteId && mode === "customer",
  });

  const { data: custCatData = [], isLoading: custCatLoading } = useQuery({
    queryKey: ["exp-cust-cat", siteId, from, to, selectedCustId],
    queryFn: () => getExpensesByCategory(siteId, from, to, selectedCustId!),
    enabled: !!siteId && mode === "customer" && !!selectedCustId,
  });

  const { data: todayCat = [] } = useQuery({
    queryKey: ["exp-today", siteId, todayStr],
    queryFn: () => getExpensesByCategory(siteId, todayStr, todayStr),
    enabled: !!siteId && mode === "overview",
  });
  const { data: ystdCat = [] } = useQuery({
    queryKey: ["exp-ystd", siteId, ystdStr],
    queryFn: () => getExpensesByCategory(siteId, ystdStr, ystdStr),
    enabled: !!siteId && mode === "overview",
  });

  const { data: todayCustAll = [] } = useQuery({
    queryKey: ["exp-cust-today", siteId, todayStr],
    queryFn: () => getExpensesByCustomer(siteId, todayStr, todayStr),
    enabled: !!siteId && mode === "customer",
  });
  const { data: ystdCustAll = [] } = useQuery({
    queryKey: ["exp-cust-ystd", siteId, ystdStr],
    queryFn: () => getExpensesByCustomer(siteId, ystdStr, ystdStr),
    enabled: !!siteId && mode === "customer",
  });

  const handleModeChange = (m: BreakdownMode) => {
    setMode(m);
    if (m === "overview") setSelectedCustId(null);
  };

  const selectedCust: CustomerTotal | null = custData.find((c) => c.customerId === selectedCustId) ?? null;

  const todayTotal =
    mode === "overview"
      ? todayCat.reduce((s, c) => s + c.total, 0)
      : (todayCustAll.find((c) => c.customerId === selectedCustId)?.total ?? 0);

  const ystdTotal =
    mode === "overview"
      ? ystdCat.reduce((s, c) => s + c.total, 0)
      : (ystdCustAll.find((c) => c.customerId === selectedCustId)?.total ?? 0);

  const periodTotal =
    mode === "overview"
      ? catData.reduce((s, c) => s + c.total, 0)
      : selectedCust?.total ?? custData.reduce((s, c) => s + c.total, 0);

  const items = useMemo(() => {
    if (mode === "overview") {
      return buildItems(catData.slice(0, 8).map((c) => ({ label: c.category, value: c.total })));
    }
    if (selectedCustId && custCatData.length) {
      return buildItems(custCatData.slice(0, 8).map((c) => ({ label: c.category, value: c.total })));
    }
    return buildItems(
      [...custData].sort((a, b) => b.total - a.total).slice(0, 8).map((c) => ({ label: c.customerName, value: c.total }))
    );
  }, [mode, catData, custData, custCatData, selectedCustId]);

  const isLoading = mode === "overview" ? catLoading : selectedCustId ? custCatLoading : custLoading;
  const subtitle = selectedCust ? `Today's expenses · ${selectedCust.customerName}` : "Today's expenses";
  const customers = custData.map((c) => ({ id: c.customerId, name: c.customerName }));

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 h-full">
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link to="/reports/expenses" className="flex items-center gap-1 text-[11px] font-semibold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">
          Expense Breakdown <ChevronRight className="h-3 w-3" />
        </Link>
        <div className="flex-1" />
        {mode === "customer" && <CustomerDropdown customers={customers} value={selectedCustId} onChange={setSelectedCustId} />}
        <ModeToggle value={mode} onChange={handleModeChange} />
      </div>

      {/* Today stats */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">{subtitle}</p>
        <div className="flex items-center gap-2.5 flex-wrap mb-3">
          <span className="font-display text-3xl font-bold tracking-tight tabular-nums">{fmtFull(todayTotal)}</span>
          <VsYesterdayBadge today={todayTotal} yesterday={ystdTotal} upIsGood={false} />
        </div>
        <PeriodPills value={period} onChange={setPeriod} />
      </div>

      {/* Period total */}
      <div className="flex items-baseline gap-2">
        <span className="font-display text-2xl font-bold tabular-nums">{fmtCurrency(periodTotal)}</span>
        <span className="text-sm text-muted-foreground">spent over {period}</span>
      </div>

      {/* Sparkline bar */}
      <SparklineBar items={items} isLoading={isLoading} />

      {/* Legend */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {items.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-[2px] shrink-0" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      )}

      {/* Divider + list */}
      {items.length > 0 && (
        <>
          <div className="border-t border-border -mx-5" />
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="flex-1 text-sm text-foreground truncate">{item.label}</span>
                <span className="text-sm tabular-nums text-foreground">{fmtFull(item.value)}</span>
                <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{item.pctDisplay}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Income Breakdown Card ────────────────────────────────────────────────────

function IncomeBreakdownCard({ siteId }: { siteId: string }) {
  const [period, setPeriod] = useState<BreakdownPeriod>("1M");
  const [mode, setMode] = useState<BreakdownMode>("overview");
  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);

  const { from, to } = getPeriodDates(period);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const ystdStr = format(subDays(new Date(), 1), "yyyy-MM-dd");

  const { data: catData = [] } = useQuery({
    queryKey: ["inc-cat", siteId, from, to],
    queryFn: () => getIncomeByCategory(siteId, from, to),
    enabled: !!siteId && mode === "overview",
  });

  const { data: custData = [] } = useQuery({
    queryKey: ["inc-by-cust", siteId, from, to],
    queryFn: () => getIncomeByCustomer(siteId, from, to),
    enabled: !!siteId && mode === "customer",
  });

  const { data: custCatData = [] } = useQuery({
    queryKey: ["inc-cust-cat", siteId, from, to, selectedCustId],
    queryFn: () => getIncomeByCategory(siteId, from, to, selectedCustId!),
    enabled: !!siteId && mode === "customer" && !!selectedCustId,
  });

  const { data: todayCat = [] } = useQuery({
    queryKey: ["inc-today", siteId, todayStr],
    queryFn: () => getIncomeByCategory(siteId, todayStr, todayStr),
    enabled: !!siteId && mode === "overview",
  });
  const { data: ystdCat = [] } = useQuery({
    queryKey: ["inc-ystd", siteId, ystdStr],
    queryFn: () => getIncomeByCategory(siteId, ystdStr, ystdStr),
    enabled: !!siteId && mode === "overview",
  });

  const { data: todayCustAll = [] } = useQuery({
    queryKey: ["inc-cust-today", siteId, todayStr],
    queryFn: () => getIncomeByCustomer(siteId, todayStr, todayStr),
    enabled: !!siteId && mode === "customer",
  });
  const { data: ystdCustAll = [] } = useQuery({
    queryKey: ["inc-cust-ystd", siteId, ystdStr],
    queryFn: () => getIncomeByCustomer(siteId, ystdStr, ystdStr),
    enabled: !!siteId && mode === "customer",
  });

  const handleModeChange = (m: BreakdownMode) => {
    setMode(m);
    if (m === "overview") setSelectedCustId(null);
  };

  const selectedCust: CustomerTotal | null = custData.find((c) => c.customerId === selectedCustId) ?? null;

  const todayTotal =
    mode === "overview"
      ? todayCat.reduce((s, c) => s + c.total, 0)
      : (todayCustAll.find((c) => c.customerId === selectedCustId)?.total ?? 0);

  const ystdTotal =
    mode === "overview"
      ? ystdCat.reduce((s, c) => s + c.total, 0)
      : (ystdCustAll.find((c) => c.customerId === selectedCustId)?.total ?? 0);

  const items = useMemo(() => {
    if (mode === "overview") {
      return buildItems(catData.slice(0, 6).map((c) => ({ label: c.category, value: c.total })));
    }
    if (selectedCustId && custCatData.length) {
      return buildItems(custCatData.slice(0, 6).map((c) => ({ label: c.category, value: c.total })));
    }
    return buildItems(
      [...custData].sort((a, b) => b.total - a.total).slice(0, 6).map((c) => ({ label: c.customerName, value: c.total }))
    );
  }, [mode, catData, custData, custCatData, selectedCustId]);

  const total = items.reduce((s, i) => s + i.value, 0);
  const subtitle = selectedCust ? `Today's income · ${selectedCust.customerName}` : "Today's income";
  const customers = custData.map((c) => ({ id: c.customerId, name: c.customerName }));

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 h-full">
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link to="/reports/income" className="flex items-center gap-1 text-[11px] font-semibold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">
          Income Breakdown <ChevronRight className="h-3 w-3" />
        </Link>
        <div className="flex-1" />
        {mode === "customer" && <CustomerDropdown customers={customers} value={selectedCustId} onChange={setSelectedCustId} />}
        <ModeToggle value={mode} onChange={handleModeChange} />
      </div>

      {/* Today stats */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">{subtitle}</p>
        <div className="flex items-center gap-2.5 flex-wrap mb-3">
          <span className="font-display text-2xl font-bold tracking-tight tabular-nums">{fmtFull(todayTotal)}</span>
          <VsYesterdayBadge today={todayTotal} yesterday={ystdTotal} upIsGood={true} />
        </div>
        <PeriodPills value={period} onChange={setPeriod} />
      </div>

      {/* Gauge */}
      <div className="flex-1 flex items-center justify-center min-h-[148px]">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No income data</p>
        ) : (
          <GaugeChart items={items} total={total} />
        )}
      </div>

      {/* Legend with percentages */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center">
          {items.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              {item.label} <span className="font-semibold text-foreground">{item.pctDisplay}%</span>
            </span>
          ))}
        </div>
      )}

      {/* Divider + list */}
      {items.length > 0 && (
        <>
          <div className="border-t border-border -mx-5" />
          <div className="space-y-2.5">
            {items.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="flex-1 text-xs text-foreground truncate">{item.label}</span>
                <span className="text-xs tabular-nums text-foreground">{fmtFull(item.value)}</span>
                <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{item.pctDisplay}%</span>
              </div>
            ))}
          </div>
        </>
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
  useAuth();
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
  const { data: trend = [] } = useQuery({
    queryKey: ["monthly-trend", activeSiteId, trendFrom, trendTo],
    queryFn: () => getMonthlyTrend(activeSiteId!, trendFrom, trendTo),
    enabled: !!activeSiteId,
  });

  // ── Customer summaries
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

  const selectedSummary = customerSummaries.find(
    (c) => c.customerId === selectedCustomerId
  );

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

      {/* Breakdown — 2/3 expense + 1/3 income */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className="lg:col-span-2">
          <ExpenseBreakdownCard siteId={activeSiteId} />
        </div>
        <div className="lg:col-span-1">
          <IncomeBreakdownCard siteId={activeSiteId} />
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

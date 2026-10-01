import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { useSite } from "@/hooks/useSite";
import { useReportDateRange } from "@/hooks/useReportDateRange";
import { getProductionLogs } from "@/services/production.service";
import { getCustomers } from "@/services/customers.service";
import { getTransactions } from "@/services/transactions.service";
import { fmtCurrency, fmtCompactNum } from "@/lib/formatCurrency";
import { CHART_H } from "@/lib/chartHeights";
import { Input } from "@/components/ui/input";
import KpiCell from "@/components/shared/KpiCell";

// ─── Constants ────────────────────────────────────────────────────────────────

const C = { ore: "var(--chart-income)", waste: "var(--chart-expense)" } as const;

const PRESETS = [
  { label: "This month",    months: 0 },
  { label: "Last 3 months", months: 2 },
  { label: "Last 6 months", months: 5 },
];

// ─── Primitives ───────────────────────────────────────────────────────────────

function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: p.fill }} />
          {p.name}: <span className="font-semibold text-foreground">{p.value.toLocaleString()} t</span>
        </p>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductionReportPage() {
  const { activeSiteId } = useSite();
  const { dateFrom, dateTo, setDateFrom, setDateTo } = useReportDateRange();

  const opts = { enabled: !!activeSiteId };

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["production_logs", activeSiteId, "report"],
    queryFn: () => getProductionLogs(activeSiteId!, 365),
    ...opts,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    ...opts,
  });

  const { data: expenseTxs = [] } = useQuery({
    queryKey: ["transactions", activeSiteId, "expense", "success", dateFrom, dateTo],
    queryFn: () => getTransactions(activeSiteId!, { type: "expense", status: "success", dateFrom, dateTo }),
    ...opts,
  });

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);

  const filteredLogs = useMemo(
    () => logs.filter((l) => l.log_date >= dateFrom && l.log_date <= dateTo),
    [logs, dateFrom, dateTo],
  );

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalOre   = filteredLogs.reduce((s, l) => s + (l.ore_tonnes ?? 0), 0);
  const totalWaste = filteredLogs.reduce((s, l) => s + (l.waste_tonnes ?? 0), 0);
  const gradedLogs = filteredLogs.filter((l) => l.grade_g_t != null && (l.ore_tonnes ?? 0) > 0);
  const avgGrade = gradedLogs.length > 0
    ? gradedLogs.reduce((s, l) => s + (l.grade_g_t ?? 0) * (l.ore_tonnes ?? 0), 0) / gradedLogs.reduce((s, l) => s + (l.ore_tonnes ?? 0), 0)
    : null;
  const stripRatio = totalOre > 0 ? totalWaste / totalOre : null;
  const totalExpenses = expenseTxs.reduce((s, t) => s + t.quantity * t.unit_price, 0);
  const costPerTonne = totalOre > 0 ? totalExpenses / totalOre : null;

  // ── Chart: ore + waste by day ──────────────────────────────────────────────
  const chartData = useMemo(
    () =>
      [...filteredLogs]
        .sort((a, b) => a.log_date.localeCompare(b.log_date))
        .map((l) => ({
          date: format(parseISO(l.log_date), "d MMM"),
          Ore: l.ore_tonnes ?? 0,
          Waste: l.waste_tonnes ?? 0,
        })),
    [filteredLogs],
  );

  // ── By customer ──────────────────────────────────────────────────────────
  const byCustomer = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of filteredLogs) {
      const name = l.customer_id ? customerMap.get(l.customer_id) ?? "Unknown" : "Unassigned";
      map.set(name, (map.get(name) ?? 0) + (l.ore_tonnes ?? 0));
    }
    return [...map.entries()]
      .map(([name, tonnes]) => ({ name, tonnes }))
      .sort((a, b) => b.tonnes - a.tonnes)
      .slice(0, 5);
  }, [filteredLogs, customerMap]);

  if (!activeSiteId) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a site to view the production report.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">

      {/* Header */}
      <div className="space-y-1">
        <Link to="/reports" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1">
          <ArrowLeft className="h-3 w-3" /> Reports
        </Link>
        <h1 className="text-display">Production Overview</h1>
        <p className="text-sm text-muted-foreground">Ore, waste and cost-per-tonne across the site</p>
      </div>

      {/* Period */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => {
          const from = format(startOfMonth(subMonths(new Date(), p.months)), "yyyy-MM-dd");
          const to   = format(endOfMonth(new Date()), "yyyy-MM-dd");
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
        <span className="text-muted-foreground text-xs mx-1">·</span>
        <Input type="date" aria-label="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-36 text-xs" />
        <span className="text-muted-foreground text-xs">–</span>
        <Input type="date" aria-label="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-36 text-xs" />
      </div>

      {/* KPI strip */}
      {isLoading ? (
        <div className="h-20 animate-pulse bg-muted rounded-xl" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 rounded-xl border border-border bg-card divide-y divide-border sm:divide-y-0 sm:divide-x">
          <KpiCell label="Ore Mined" value={`${fmtCompactNum(totalOre)} t`} color={C.ore} />
          <KpiCell label="Waste Moved" value={`${fmtCompactNum(totalWaste)} t`} color={C.waste} />
          <KpiCell label="Strip Ratio" value={stripRatio != null ? `${stripRatio.toFixed(2)} : 1` : "—"} sub="waste : ore" />
          <KpiCell label="Cost / Tonne" value={costPerTonne != null ? fmtCurrency(costPerTonne, 2) : "—"} sub={avgGrade != null ? `${avgGrade.toFixed(2)} g/t avg grade` : undefined} />
        </div>
      )}

      {/* Ore vs waste chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-4">
          Ore vs Waste — Daily
        </p>
        {isLoading ? (
          <div className="h-56 animate-pulse bg-muted rounded-lg" />
        ) : chartData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
            No production logs for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={CHART_H.md}>
            <BarChart data={chartData} barGap={2} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
              <Bar dataKey="Ore" fill={C.ore} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Waste" fill={C.waste} opacity={0.85} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* By customer */}
      {byCustomer.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            Ore by Customer
          </p>
          <div className="space-y-2.5">
            {byCustomer.map((c) => {
              const pct = totalOre > 0 ? Math.round((c.tonnes / totalOre) * 100) : 0;
              return (
                <div key={c.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-muted-foreground">{c.name}</span>
                    <span className="shrink-0 tabular-nums font-medium">{fmtCompactNum(c.tonnes)} t</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: C.ore }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Link to operational log */}
      <Link
        to="/production"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Log or edit daily production <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

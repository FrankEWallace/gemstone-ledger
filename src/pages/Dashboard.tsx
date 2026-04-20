import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Users,
  Wrench,
  ShieldAlert,
  CalendarDays,
} from "lucide-react";
import { TrendArrow } from "@/components/shared/TrendArrow";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Label,
  Sector,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  format,
  startOfWeek,
  endOfWeek,
  isPast,
  parseISO,
  startOfMonth,
  endOfMonth,
} from "date-fns";
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
  income:  "hsl(var(--chart-income))",
  expense: "hsl(var(--chart-expense))",
  net:     "hsl(var(--chart-net))",
  cat: [
    "hsl(var(--chart-cat-1))",
    "hsl(var(--chart-cat-2))",
    "hsl(var(--chart-cat-3))",
    "hsl(var(--chart-cat-4))",
    "hsl(var(--chart-cat-5))",
  ],
} as const;

// ─── SparkBars ────────────────────────────────────────────────────────────────

function SparkBars({ values, color }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[2px] h-8 opacity-70">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-[5px] rounded-[2px]"
          style={{
            height: `${Math.max(12, (v / max) * 100)}%`,
            backgroundColor: color ?? "hsl(var(--foreground))",
          }}
        />
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  rawValue,
  sub,
  sparkValues,
  href,
  progressPct,
  progressLabel,
  color,
}: {
  label: string;
  rawValue: number;
  sub?: string;
  sparkValues?: number[];
  href: string;
  progressPct?: number | null;
  progressLabel?: string;
  color?: string;
}) {
  return (
    <Link
      to={href}
      className="group rounded-xl border border-border/50 bg-card px-4 py-3 flex items-center gap-3 hover:border-foreground/20 hover:bg-muted/10 transition-all overflow-hidden"
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
          <span className="font-display text-[20px] font-bold leading-none tabular-nums tracking-tight">
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
      </div>
      {sparkValues && <SparkBars values={sparkValues} color={color} />}
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
          {p.name}:{" "}
          <span className="font-semibold text-foreground">{fmtFull(p.value)}</span>
        </p>
      ))}
    </div>
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

// ─── Revenue Trend Chart ──────────────────────────────────────────────────────

function RevenueTrendChart({
  chartData,
  isLoading,
}: {
  chartData: { month: string; Income: number; Expenses: number }[];
  isLoading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <SectionHeader title="Revenue Trend" href="/reports" />
      {isLoading ? (
        <div className="h-52 animate-pulse bg-muted rounded-lg" />
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={chartData} barGap={3} barCategoryGap="30%">
            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
            />
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
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
            />
            <Bar dataKey="Income" fill={C.income} radius={[3, 3, 0, 0]} />
            <Bar dataKey="Expenses" fill={C.expense} opacity={0.85} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: C.income }} /> Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: C.expense }} /> Expenses
        </span>
      </div>
    </div>
  );
}

// ─── Expense Breakdown ────────────────────────────────────────────────────────

function ExpenseBreakdown({
  catData,
  customerData,
  isLoadingCat,
  forceCategory,
}: {
  catData: { category: string; total: number }[];
  customerData: CustomerSummary[];
  isLoadingCat: boolean;
  forceCategory?: boolean;
}) {
  const [mode, setMode] = useState<"category" | "customer">("category");
  const activeMode = forceCategory ? "category" : mode;
  const [activeKey, setActiveKey] = useState<string>("");

  const rawItems = useMemo(
    () =>
      activeMode === "category"
        ? catData.slice(0, 5).map((c) => ({ label: c.category, value: c.total }))
        : [...customerData]
            .sort((a, b) => b.totalExpenses - a.totalExpenses)
            .slice(0, 5)
            .map((c) => ({ label: c.customerName, value: c.totalExpenses })),
    [activeMode, catData, customerData]
  );

  const chartData = useMemo(
    () =>
      rawItems.map((item, idx) => {
        const key = item.label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        return { key, label: item.label, value: item.value, fill: `var(--color-${key})` };
      }),
    [rawItems]
  );

  const chartConfig = useMemo(
    () =>
      ({
        value: { label: "Expenses" },
        ...Object.fromEntries(
          chartData.map((d, idx) => [d.key, { label: d.label, color: C.cat[idx % C.cat.length] }])
        ),
      } as ChartConfig),
    [chartData]
  );

  const activeIndex = useMemo(() => {
    const i = chartData.findIndex((d) => d.key === activeKey);
    return i >= 0 ? i : 0;
  }, [chartData, activeKey]);

  const activeItem = chartData[activeIndex];

  const renderShape = useCallback(
    ({ index, outerRadius = 0, ...props }: any) => {
      if (index === activeIndex) {
        return (
          <g>
            <Sector {...props} outerRadius={outerRadius + 8} />
            <Sector
              {...props}
              outerRadius={outerRadius + 22}
              innerRadius={outerRadius + 10}
            />
          </g>
        );
      }
      return <Sector {...props} outerRadius={outerRadius} />;
    },
    [activeIndex]
  );

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <Link
          to="/reports/expenses"
          className="flex items-center gap-0.5 text-[11px] font-semibold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
        >
          Expenses <ChevronRight className="h-3 w-3" />
        </Link>
        <div className="flex items-center gap-2">
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
          {chartData.length > 0 && (
            <Select value={activeItem?.key ?? ""} onValueChange={setActiveKey}>
              <SelectTrigger className="h-7 w-[130px] rounded-lg pl-2.5 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl">
                {chartData.map((d) => (
                  <SelectItem key={d.key} value={d.key} className="rounded-lg [&_span]:flex">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className="flex h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: chartConfig[d.key]?.color as string }}
                      />
                      {d.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Chart */}
      {isLoadingCat && activeMode === "category" ? (
        <div className="h-52 animate-pulse bg-muted rounded-lg" />
      ) : chartData.length === 0 ? (
        <div className="flex items-center justify-center h-52 text-xs text-muted-foreground">
          No expense data for this period.
        </div>
      ) : (
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square w-full max-w-[280px]"
        >
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              innerRadius={65}
              strokeWidth={5}
              shape={renderShape}
              onClick={(_, index) => setActiveKey(chartData[index]?.key ?? "")}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-xl font-bold"
                        >
                          {fmtCurrency(activeItem?.value ?? 0)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 22}
                          className="fill-muted-foreground text-[10px]"
                        >
                          {activeItem?.label}
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      )}
    </div>
  );
}

// ─── Insight Banner ───────────────────────────────────────────────────────────

function InsightBanner({
  monthRevenue,
  totalExpenses,
  progressPct,
  progressLabel,
  topCustomer,
  txCount,
  color,
}: {
  monthRevenue: number;
  totalExpenses: number;
  progressPct: number | null;
  progressLabel?: string;
  topCustomer?: CustomerSummary | null;
  txCount: number;
  color?: string;
}) {
  const margin = monthRevenue - totalExpenses;
  const marginPct =
    monthRevenue > 0 ? Math.round((margin / monthRevenue) * 100) : null;

  let headline = "";
  let sub = "";

  if (progressPct !== null && progressPct >= 100) {
    headline = `Target smashed — ${progressPct}% of ${progressLabel} achieved!`;
    sub = topCustomer
      ? `${topCustomer.customerName} is your top earner at ${fmtCurrency(topCustomer.totalIncome)}.`
      : `${txCount} transactions confirmed this month.`;
  } else if (progressPct !== null && progressPct > 0) {
    headline = `${fmtCurrency(monthRevenue)} revenue tracked — ${progressPct}% toward your ${progressLabel}.`;
    sub = topCustomer
      ? `Top contributor: ${topCustomer.customerName} · ${fmtCurrency(topCustomer.totalIncome)} rev.`
      : `${txCount} transactions this month.`;
  } else if (topCustomer) {
    headline = `${fmtCurrency(monthRevenue)} revenue from ${txCount} transaction${txCount !== 1 ? "s" : ""} this month.`;
    sub = `Top contributor: ${topCustomer.customerName} · ${fmtCurrency(topCustomer.totalIncome)} rev${marginPct !== null ? ` · ${marginPct}% net margin` : ""}.`;
  } else {
    headline = `${fmtCurrency(monthRevenue)} revenue recorded across ${txCount} transaction${txCount !== 1 ? "s" : ""} this month.`;
    sub = marginPct !== null ? `Net margin: ${marginPct}%.` : "";
  }

  if (!headline) return null;

  return (
    <div
      className="rounded-xl border border-border/50 bg-card px-5 py-4 flex items-start gap-3"
      style={{ borderLeftWidth: 3, borderLeftColor: color ?? "hsl(var(--chart-income))" }}
    >
      <CheckCircle2
        className="h-4 w-4 shrink-0 mt-0.5"
        style={{ color: color ?? "hsl(var(--chart-income))" }}
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug">{headline}</p>
        {sub && (
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        )}
      </div>
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
                <td
                  colSpan={5}
                  className="px-5 py-8 text-center text-muted-foreground"
                >
                  No transactions yet.
                </td>
              </tr>
            ) : (
              recent.map((t) => {
                const total = t.quantity * t.unit_price;
                const isIncome = t.type === "income";
                return (
                  <tr
                    key={t.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
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

  // ── All transactions (KPIs + recent list)
  const { data: txs = [], isLoading: txsLoading } = useQuery({
    queryKey: ["transactions", activeSiteId, "all", "all", "all"],
    queryFn: () => getTransactions(activeSiteId!),
    enabled: !!activeSiteId,
  });

  // ── Customers list (filter dropdown)
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled: !!activeSiteId,
  });

  // ── Monthly trend (6-month, sparkbars + "all customers" chart)
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

  // ── Expense categories ("all customers" expense chart)
  const { data: expenseCats = [], isLoading: catsLoading } = useQuery({
    queryKey: ["expenses-by-category", activeSiteId, trendFrom, trendTo],
    queryFn: () => getExpensesByCategory(activeSiteId!, trendFrom, trendTo),
    enabled: !!activeSiteId,
  });

  // ── Customer summaries (this month — profitability list + "by customer" chart)
  const thisMonthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const todayStr = format(today, "yyyy-MM-dd");
  const { data: customerSummaries = [] } = useQuery({
    queryKey: ["customer-summaries", activeSiteId, thisMonthStart, todayStr],
    queryFn: () => getCustomerSummaries(activeSiteId!, thisMonthStart, todayStr),
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

  // ── KPI target progress (Revenue, this month)
  const target = kpiTargets[0];
  const monthFrom = format(startOfMonth(today), "yyyy-MM-dd");
  const monthTo = format(endOfMonth(today), "yyyy-MM-dd");
  const monthRevenue = successTxs
    .filter(
      (t) =>
        t.type === "income" &&
        t.transaction_date >= monthFrom &&
        t.transaction_date <= monthTo
    )
    .reduce((s, t) => s + t.quantity * t.unit_price, 0);
  const hasTarget = target?.revenue_target != null && target.revenue_target > 0;
  const progressPct = hasTarget
    ? Math.min(100, Math.round((monthRevenue / (target.revenue_target ?? 1)) * 100))
    : null;

  // ── Sparkbars (always site-wide from trend)
  const incomeSpark = trend.map((t) => t.income);
  const expenseSpark = trend.map((t) => t.expenses);
  const netSpark = trend.map((t) => Math.max(0, t.income - t.expenses));

  // ── Revenue trend chart data
  const chartData = useMemo(() => {
    if (!selectedCustomerId) {
      return trend.map((t) => ({
        month: t.month.slice(5),
        Income: t.income,
        Expenses: t.expenses,
      }));
    }
    const map: Record<string, { Income: number; Expenses: number }> = {};
    for (const t of filteredTxs) {
      const month = t.transaction_date.slice(5, 7);
      if (!map[month]) map[month] = { Income: 0, Expenses: 0 };
      const amount = t.quantity * t.unit_price;
      if (t.type === "income") map[month].Income += amount;
      else map[month].Expenses += amount;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }));
  }, [trend, filteredTxs, selectedCustomerId]);

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
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Dashboard
          </h1>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="Revenue"
          rawValue={totalRevenue}
          sub={
            selectedCustomerId
              ? selectedSummary?.customerName
              : "All confirmed income"
          }
          sparkValues={incomeSpark.length ? incomeSpark : [1, 2, 3, 4, 5, 6]}
          href="/transactions"
          progressPct={progressPct}
          progressLabel={`${format(today, "MMM")} target`}
          color={C.income}
        />
        <KpiCard
          label="Expenses"
          rawValue={totalExpenses}
          sub={
            selectedCustomerId
              ? selectedSummary?.customerName
              : "All confirmed expenses"
          }
          sparkValues={expenseSpark.length ? expenseSpark : [1, 2, 3, 4, 5, 6]}
          href="/transactions"
          color={C.expense}
        />
        <KpiCard
          label="Net Profit"
          rawValue={Math.abs(netRevenue)}
          sub={netRevenue >= 0 ? "Positive cashflow" : "Net loss"}
          sparkValues={netSpark.length ? netSpark : [1, 2, 3, 4, 5, 6]}
          href="/reports"
          color={C.net}
        />
      </div>

      {/* Insight Banner */}
      {!txsLoading && (
        <InsightBanner
          monthRevenue={monthRevenue}
          totalExpenses={totalExpenses}
          progressPct={progressPct}
          progressLabel={`${format(today, "MMM")} target`}
          topCustomer={
            customerSummaries.length > 0
              ? [...customerSummaries].sort((a, b) => b.totalIncome - a.totalIncome)[0]
              : null
          }
          txCount={successTxs.filter(
            (t) => t.transaction_date >= monthFrom && t.transaction_date <= monthTo
          ).length}
          color={C.income}
        />
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ExpenseBreakdown
            catData={expenseChartCats}
            customerData={customerSummaries}
            isLoadingCat={!selectedCustomerId && catsLoading}
            forceCategory={!!selectedCustomerId}
          />
        </div>
        <RevenueTrendChart
          chartData={chartData}
          isLoading={!selectedCustomerId && trendLoading}
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

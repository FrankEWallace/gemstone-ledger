import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { subMonths, format, startOfMonth, endOfMonth } from "date-fns";
import { Download, Package, AlertTriangle, ArrowRight } from "lucide-react";

import { useSite } from "@/hooks/useSite";
import { getInventoryItems } from "@/services/inventory.service";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getMonthlyTrend,
  getExpensesByCategory,
  getReportSummary,
  getProductionByDay,
  getCustomerSummaries,
} from "@/services/reports.service";
import { fmtCurrency, fmtCompact, fmtTick, CURRENCY_SYMBOL } from "@/lib/formatCurrency";

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = (n: number) => fmtCurrency(n);

function fmtShort(n: number) {
  return fmtCompact(n).replace(" ", "\u202F"); // narrow no-break space for charts
}


// ─── Chart colors (matches Dashboard palette) ─────────────────────────────────

const C = {
  income:  "var(--chart-income)",
  expense: "var(--chart-expense)",
  net:     "var(--chart-net)",
  cat: [
    "var(--chart-cat-1)",
    "var(--chart-cat-2)",
    "var(--chart-cat-3)",
    "var(--chart-cat-4)",
    "var(--chart-cat-5)",
  ],
} as const;

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground mb-4">
      {children}
    </p>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: p.fill ?? p.stroke }} />
          {p.name}:&nbsp;
          <span className="font-semibold text-foreground">
            {typeof p.value === "number" && p.name?.toLowerCase().includes("hour")
              ? `${p.value}h`
              : fmt(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

// ─── KPI stat cards ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 flex flex-col gap-1 min-w-0 overflow-hidden relative">
      {color && <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-lg" style={{ backgroundColor: color }} />}
      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground truncate pt-0.5">{label}</p>
      <p className="text-lg font-bold tracking-tight leading-none tabular-nums font-display truncate" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

// ─── Date range presets ───────────────────────────────────────────────────────

const PRESETS = [
  { label: "This month",    months: 0 },
  { label: "Last 3 months", months: 2 },
  { label: "Last 6 months", months: 5 },
];

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_FROM = format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");
const DEFAULT_TO   = format(endOfMonth(new Date()), "yyyy-MM-dd");

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { activeSiteId, activeSite } = useSite();
  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM);
  const [dateTo,   setDateTo]   = useState(DEFAULT_TO);
  const [isExporting, setIsExporting] = useState(false);

  // staleTime: 0 — reports are date-sensitive; always refetch when the key changes
  // even if IndexedDB holds a cache entry from a recent prior visit with the same dates.
  const opts = {
    enabled: !!activeSiteId && !!dateFrom && !!dateTo,
    staleTime: 0,
  };

  const { data: summary, isFetching: fetchingSummary } = useQuery({
    queryKey: ["report-summary", activeSiteId, dateFrom, dateTo],
    queryFn: () => getReportSummary(activeSiteId!, dateFrom, dateTo),
    ...opts,
  });

  const { data: trend = [], isFetching: loadingTrend } = useQuery({
    queryKey: ["report-trend", activeSiteId, dateFrom, dateTo],
    queryFn: () => getMonthlyTrend(activeSiteId!, dateFrom, dateTo),
    ...opts,
  });

  const { data: categories = [], isFetching: loadingCats } = useQuery({
    queryKey: ["report-categories", activeSiteId, dateFrom, dateTo],
    queryFn: () => getExpensesByCategory(activeSiteId!, dateFrom, dateTo),
    ...opts,
  });

  const { data: production = [], isFetching: loadingProd } = useQuery({
    queryKey: ["report-production", activeSiteId, dateFrom, dateTo],
    queryFn: () => getProductionByDay(activeSiteId!, dateFrom, dateTo),
    ...opts,
  });

  const { data: customerSummaries = [], isFetching: loadingCustomers } = useQuery({
    queryKey: ["customer-summaries", activeSiteId, dateFrom, dateTo],
    queryFn: () => getCustomerSummaries(activeSiteId!, dateFrom, dateTo),
    ...opts,
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory", activeSiteId],
    queryFn: () => getInventoryItems(activeSiteId!),
    enabled: !!activeSiteId,
    staleTime: 5 * 60 * 1000,
  });

  async function handleExportPDF() {
    if (!summary) return;
    setIsExporting(true);
    try {
      // Lazy-load the renderer so it never runs at page mount (avoids crashing the route)
      const { pdf, Document, Page, Text, View, StyleSheet } =
        await import("@react-pdf/renderer");

      const NAVY  = "#1a2035";
      const GREEN = "#2a9d50";
      const RED   = "#ef4444";

      const s = StyleSheet.create({
        page:         { paddingTop: 60, paddingBottom: 48, paddingLeft: 40, paddingRight: 40, fontFamily: "Helvetica", fontSize: 10, color: "#111" },
        header:       { position: "absolute", top: 0, left: 0, right: 0, height: 40, backgroundColor: NAVY, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 40, paddingRight: 40 },
        headerLeft:   { color: "#ffffff", fontSize: 8, fontWeight: "bold", letterSpacing: 1 },
        headerRight:  { color: "#8a9dbe", fontSize: 7 },
        footer:       { position: "absolute", bottom: 0, left: 0, right: 0, height: 28, backgroundColor: NAVY, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 40, paddingRight: 40 },
        footerText:   { color: "#7b8ea8", fontSize: 7 },
        titleBlock:   { marginBottom: 20 },
        title:        { fontSize: 22, fontWeight: "bold", color: NAVY, marginBottom: 4 },
        subtitle:     { fontSize: 9, color: "#888" },
        section:      { marginBottom: 22 },
        sectionTitle: { fontSize: 7, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1.5, color: NAVY, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 5, marginBottom: 10 },
        row:          { flexDirection: "row", marginBottom: 6 },
        statBox:      { flex: 1, marginRight: 8, borderRadius: 3, borderWidth: 1, borderColor: "#e5e7eb", borderLeftWidth: 3, borderLeftColor: NAVY, padding: 10 },
        statLabel:    { fontSize: 7, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
        statValue:    { fontSize: 14, fontWeight: "bold", color: "#111" },
        tableHeader:  { flexDirection: "row", backgroundColor: NAVY, padding: "6 8", borderRadius: 3, marginBottom: 0 },
        trOdd:        { flexDirection: "row", padding: "5 8", backgroundColor: "#ffffff" },
        trEven:       { flexDirection: "row", padding: "5 8", backgroundColor: "#f4f6f9" },
        thCell:       { flex: 1, fontSize: 8, fontWeight: "bold", color: "#ffffff" },
        thCellRight:  { flex: 1, fontSize: 8, fontWeight: "bold", color: "#ffffff", textAlign: "right" },
        tdCell:       { flex: 1, fontSize: 9, color: "#444" },
        tdCellRight:  { flex: 1, fontSize: 9, color: "#444", textAlign: "right" },
        tdCellBold:   { flex: 1, fontSize: 9, fontWeight: "bold", color: "#111", textAlign: "right" },
      });

      const siteName = activeSite?.name ?? "Site";
      const periodLabel = `${dateFrom} → ${dateTo}`;
      const blob = await pdf(
        <Document>
          <Page size="A4" style={s.page}>
            {/* Fixed navy header */}
            <View fixed style={s.header}>
              <Text style={s.headerLeft}>FW MINING OS  ·  {siteName.toUpperCase()}</Text>
              <Text style={s.headerRight}>Financial Report  ·  {periodLabel}</Text>
            </View>

            {/* Fixed navy footer */}
            <View fixed style={s.footer}>
              <Text style={s.footerText}>Confidential  ·  Generated {format(new Date(), "d MMM yyyy")}</Text>
              <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} style={s.footerText} />
            </View>

            {/* Title */}
            <View style={s.titleBlock}>
              <Text style={s.title}>Financial Report</Text>
              <Text style={s.subtitle}>{siteName}  ·  {periodLabel}</Text>
            </View>

            {/* KPI Summary */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Summary</Text>
              <View style={s.row}>
                {[
                  { label: "Total Income",   val: fmt(summary.totalIncome),   accent: GREEN },
                  { label: "Total Expenses", val: fmt(summary.totalExpenses), accent: RED },
                  { label: "Net Revenue",    val: fmt(summary.netRevenue),    accent: summary.netRevenue >= 0 ? GREEN : RED },
                ].map((item) => (
                  <View key={item.label} style={[s.statBox, { borderLeftColor: item.accent }]}>
                    <Text style={s.statLabel}>{item.label}</Text>
                    <Text style={s.statValue}>{item.val}</Text>
                  </View>
                ))}
              </View>
              <View style={[s.row, { marginTop: 6 }]}>
                {[
                  { label: "Transactions",  val: String(summary.transactionCount) },
                  { label: "Shifts Logged", val: String(summary.totalShiftsLogged) },
                  { label: "Profit Margin", val: summary.totalIncome > 0 ? `${((summary.netRevenue / summary.totalIncome) * 100).toFixed(1)}%` : "—" },
                ].map((item) => (
                  <View key={item.label} style={[s.statBox, { borderLeftColor: NAVY }]}>
                    <Text style={s.statLabel}>{item.label}</Text>
                    <Text style={s.statValue}>{item.val}</Text>
                  </View>
                ))}
              </View>
            </View>

            {trend.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Monthly Revenue vs Expenses</Text>
                <View style={s.tableHeader}>
                  <Text style={s.thCell}>Month</Text>
                  <Text style={s.thCellRight}>Income</Text>
                  <Text style={s.thCellRight}>Expenses</Text>
                  <Text style={s.thCellRight}>Net</Text>
                </View>
                {trend.map((row, idx) => (
                  <View key={row.month} style={idx % 2 === 0 ? s.trOdd : s.trEven}>
                    <Text style={s.tdCell}>{row.month}</Text>
                    <Text style={s.tdCellRight}>{fmt(row.income)}</Text>
                    <Text style={s.tdCellRight}>{fmt(row.expenses)}</Text>
                    <Text style={s.tdCellBold}>{fmt(row.income - row.expenses)}</Text>
                  </View>
                ))}
              </View>
            )}

            {categories.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Expenses by Category</Text>
                <View style={s.tableHeader}>
                  <Text style={s.thCell}>Category</Text>
                  <Text style={s.thCellRight}>Total</Text>
                  <Text style={s.thCellRight}>% of Expenses</Text>
                </View>
                {categories.map((row, idx) => {
                  const pct = summary.totalExpenses > 0
                    ? ((row.total / summary.totalExpenses) * 100).toFixed(1)
                    : "0.0";
                  return (
                    <View key={row.category} style={idx % 2 === 0 ? s.trOdd : s.trEven}>
                      <Text style={s.tdCell}>{row.category}</Text>
                      <Text style={s.tdCellRight}>{fmt(row.total)}</Text>
                      <Text style={s.tdCellRight}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {customerSummaries.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Customer Profitability</Text>
                <View style={s.tableHeader}>
                  <Text style={s.thCell}>Customer</Text>
                  <Text style={[s.thCell, { flex: 0.6 }]}>Type</Text>
                  <Text style={s.thCellRight}>Income</Text>
                  <Text style={s.thCellRight}>Expenses</Text>
                  <Text style={s.thCellRight}>Net Profit</Text>
                </View>
                {customerSummaries
                  .slice()
                  .sort((a, b) => b.netProfit - a.netProfit)
                  .map((cs, idx) => (
                    <View key={cs.customerId} style={idx % 2 === 0 ? s.trOdd : s.trEven}>
                      <Text style={s.tdCell}>{cs.customerName}</Text>
                      <Text style={[s.tdCell, { flex: 0.6 }]}>{cs.customerType}</Text>
                      <Text style={s.tdCellRight}>{fmt(cs.totalIncome)}</Text>
                      <Text style={s.tdCellRight}>{fmt(cs.totalExpenses)}</Text>
                      <Text style={s.tdCellBold}>{fmt(cs.netProfit)}</Text>
                    </View>
                  ))}
              </View>
            )}
          </Page>
        </Document>
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `report-${dateFrom}-${dateTo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  const trendChartData = trend.map((t) => ({
    month:    t.month.slice(5),
    Income:   t.income,
    Expenses: t.expenses,
  }));

  const prodChartData = production.map((p) => ({
    date:  format(new Date(p.date), "d MMM"),
    Hours: p.totalHours,
  }));

  const maxCat = Math.max(...categories.map((c) => c.total), 1);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px]">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight">Reports & Analytics</h1>
        <button
          onClick={handleExportPDF}
          disabled={isExporting || !summary}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="h-3.5 w-3.5" />
          {isExporting ? "Generating PDF…" : "Export PDF"}
        </button>
      </div>

      {/* ── Date range ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36 h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36 h-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-2 pb-0.5">
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
                    : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="by-customer">By Customer</TabsTrigger>
        </TabsList>

        {/* ── Overview tab ──────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-4">

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Total Income"
          value={fmtShort(summary?.totalIncome ?? 0)}
          sub={fmt(summary?.totalIncome ?? 0)}
          color={C.income}
        />
        <StatCard
          label="Total Expenses"
          value={fmtShort(summary?.totalExpenses ?? 0)}
          sub={fmt(summary?.totalExpenses ?? 0)}
          color={C.expense}
        />
        <StatCard
          label="Net Revenue"
          value={fmtShort(summary?.netRevenue ?? 0)}
          sub={(summary?.netRevenue ?? 0) >= 0 ? "Positive cashflow" : "Net loss"}
          color={(summary?.netRevenue ?? 0) >= 0 ? C.income : C.expense}
        />
        <StatCard
          label="Transactions"
          value={String(summary?.transactionCount ?? 0)}
        />
        <StatCard
          label="Shifts Logged"
          value={String(summary?.totalShiftsLogged ?? 0)}
        />
        <StatCard
          label="Profit Margin"
          value={
            (summary?.totalIncome ?? 0) > 0
              ? `${((( summary!.netRevenue) / summary!.totalIncome) * 100).toFixed(1)}%`
              : "—"
          }
          sub={(summary?.netRevenue ?? 0) >= 0 ? "Of income retained" : "Net loss"}
          color={C.net}
        />
      </div>

      {/* ── Revenue vs Expenses ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <SectionLabel>Revenue vs Expenses — Monthly</SectionLabel>
        {loadingTrend ? (
          <div className="h-56 animate-pulse bg-muted rounded-lg" />
        ) : trendChartData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
            No data for this period.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={trendChartData} barGap={3} barCategoryGap="32%">
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => fmtTick(v)}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
                <Bar dataKey="Income"   name="Income"   fill={C.income}          radius={[3, 3, 0, 0]} />
                <Bar dataKey="Expenses" name="Expenses" fill={C.expense} opacity={0.85} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: C.income }} /> Income
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: C.expense }} /> Expenses
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Category breakdown + Production hours ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Expense breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionLabel>Expenses by Category</SectionLabel>
          {loadingCats ? (
            <div className="h-48 animate-pulse bg-muted rounded-lg" />
          ) : categories.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
              No expense data.
            </div>
          ) : (
            <div className="space-y-3">
              {categories.slice(0, 7).map((c, idx) => {
                const pct = Math.round((c.total / maxCat) * 100);
                const sharePct = summary && summary.totalExpenses > 0
                  ? ((c.total / summary.totalExpenses) * 100).toFixed(0)
                  : "0";
                const barColor = C.cat[idx % C.cat.length];
                return (
                  <div key={c.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground truncate mr-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
                        {c.category}
                      </span>
                      <span className="tabular-nums font-semibold text-foreground shrink-0">
                        {fmtShort(c.total)}
                        <span className="text-muted-foreground font-normal ml-1.5">{sharePct}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Daily hours worked */}
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionLabel>Daily Hours Worked</SectionLabel>
          {loadingProd ? (
            <div className="h-48 animate-pulse bg-muted rounded-lg" />
          ) : prodChartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
              No shift records for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={prodChartData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}h`}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
                <Line
                  type="monotone"
                  dataKey="Hours"
                  name="Hours"
                  stroke={C.net}
                  strokeWidth={1.5}
                  dot={{ r: 2.5, fill: C.net, strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: C.net, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Expense category table ─────────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
              Expense Category Breakdown
            </p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">
                  Category
                </th>
                <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">
                  Total Spent
                </th>
                <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden sm:table-cell">
                  % of Expenses
                </th>
                <th className="px-5 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden md:table-cell">
                  Share
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((c, idx) => {
                const pct = summary && summary.totalExpenses > 0
                  ? (c.total / summary.totalExpenses) * 100
                  : 0;
                const barColor = C.cat[idx % C.cat.length];
                return (
                  <tr key={c.category} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium" style={{ color: C.expense }}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
                        {c.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold" style={{ color: C.expense }}>{fmt(c.total)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                      {pct.toFixed(1)}%
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <div className="flex items-center justify-end">
                        <div className="w-24 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.round(pct)}%`, backgroundColor: barColor }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {summary && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/20">
                  <td className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Total</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold">{fmt(summary.totalExpenses)}</td>
                  <td className="px-3 py-3 text-right text-muted-foreground hidden sm:table-cell">100%</td>
                  <td className="px-5 py-3 hidden md:table-cell" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ── Net revenue table ─────────────────────────────────────────────── */}
      {trend.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
              Monthly Financials
            </p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Month</th>
                <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Income</th>
                <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Expenses</th>
                <th className="px-5 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {trend.map((row) => {
                const net = row.income - row.expenses;
                return (
                  <tr key={row.month} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{row.month}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-medium" style={{ color: C.income }}>{fmt(row.income)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-medium" style={{ color: C.expense }}>{fmt(row.expenses)}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold" style={{ color: net >= 0 ? C.income : C.expense }}>
                      {net >= 0 ? "+" : "−"}{fmt(Math.abs(net))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Inventory snapshot ────────────────────────────────────────────── */}
      {inventoryItems.length > 0 && (() => {
        const totalItems   = inventoryItems.length;
        const stockValue   = inventoryItems.reduce((s, i) => s + (i.quantity * (i.unit_cost ?? 0)), 0);
        const lowOutCount  = inventoryItems.filter(i => i.reorder_level != null && i.quantity <= i.reorder_level).length;
        return (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
                Inventory Snapshot
              </p>
              <Link
                to="/reports/inventory"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Full inventory report <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted text-muted-foreground shrink-0">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Items</p>
                  <p className="text-lg font-bold tabular-nums leading-tight">{totalItems}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted text-muted-foreground shrink-0">
                  <span className="text-[10px] font-bold">{CURRENCY_SYMBOL}</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Stock Value</p>
                  <p className="text-lg font-bold tabular-nums leading-tight">{fmtShort(stockValue)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg border shrink-0 ${lowOutCount > 0 ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20" : "bg-muted text-muted-foreground"}`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Low / Out of Stock</p>
                  <p className={`text-lg font-bold tabular-nums leading-tight ${lowOutCount > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                    {lowOutCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

        </TabsContent>

        {/* ── By Customer tab ───────────────────────────────────────────── */}
        <TabsContent value="by-customer" className="mt-4 space-y-4">
          {/* CSV export */}
          {customerSummaries.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const header = "Customer,Type,Income,Expenses,Net Profit,Margin %,Transactions,Top Expense Category,Top Category Amount";
                  const rows = customerSummaries
                    .slice()
                    .sort((a, b) => b.netProfit - a.netProfit)
                    .map((cs) => {
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
                  const csv = [header, ...rows].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url  = URL.createObjectURL(blob);
                  const a    = document.createElement("a");
                  a.href     = url;
                  a.download = `customer-report-${dateFrom}-${dateTo}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export Customer CSV
              </button>
            </div>
          )}

          {loadingCustomers ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 animate-pulse bg-muted rounded-xl" />
              ))}
            </div>
          ) : customerSummaries.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground rounded-xl border border-border bg-card">
              No customer data for this period.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {customerSummaries.map((cs) => {
                const maxCatVal = Math.max(...cs.expensesByCategory.map((c) => c.total), 1);
                return (
                  <Link
                    key={cs.customerId}
                    to={`/reports/customers/${cs.customerId}`}
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
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Net Profit</p>
                        <p className="text-lg font-bold tabular-nums" style={{ color: cs.netProfit >= 0 ? C.income : C.expense }}>
                          {cs.netProfit >= 0 ? "+" : "−"}{fmt(Math.abs(cs.netProfit))}
                        </p>
                      </div>
                    </div>

                    {/* Income / Expenses */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Income</p>
                        <p className="text-sm font-semibold tabular-nums" style={{ color: C.income }}>{fmt(cs.totalIncome)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Expenses</p>
                        <p className="text-sm font-semibold tabular-nums" style={{ color: C.expense }}>{fmt(cs.totalExpenses)}</p>
                      </div>
                    </div>

                    {/* Expense category breakdown */}
                    {cs.expensesByCategory.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Expenses by Category
                        </p>
                        {cs.expensesByCategory.slice(0, 4).map((c, idx) => {
                          const pct = Math.round((c.total / maxCatVal) * 100);
                          const barColor = C.cat[idx % C.cat.length];
                          return (
                            <div key={c.category} className="space-y-0.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 text-muted-foreground truncate mr-2">
                                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
                                  {c.category}
                                </span>
                                <span className="tabular-nums font-medium shrink-0">{fmtShort(c.total)}</span>
                              </div>
                              <div className="h-1 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">
                        {cs.transactionCount} transaction{cs.transactionCount !== 1 ? "s" : ""}
                      </p>
                      <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
                        View report →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}

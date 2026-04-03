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
import { Download } from "lucide-react";
import {
  pdf,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

import { useSite } from "@/hooks/useSite";
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

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#111" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 28 },
  section: { marginBottom: 22 },
  sectionTitle: {
    fontSize: 8, fontWeight: "bold", textTransform: "uppercase",
    letterSpacing: 1.5, color: "#888", borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb", paddingBottom: 5, marginBottom: 10,
  },
  row: { flexDirection: "row", marginBottom: 6 },
  statBox: { flex: 1, padding: 10, backgroundColor: "#f9fafb", borderRadius: 4, marginRight: 8 },
  statLabel: { fontSize: 7, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  statValue: { fontSize: 15, fontWeight: "bold" },
  tableHeader: {
    flexDirection: "row", backgroundColor: "#f3f4f6",
    padding: "6 8", borderRadius: 3, marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row", padding: "5 8",
    borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  tableCell: { flex: 1, fontSize: 9, color: "#555" },
  tableCellBold: { flex: 1, fontSize: 9, fontWeight: "bold", color: "#111" },
  tableCellRight: { flex: 1, fontSize: 9, textAlign: "right", color: "#555" },
  tableCellRightBold: { flex: 1, fontSize: 9, textAlign: "right", fontWeight: "bold", color: "#111" },
});

function ReportPDF({
  siteName, dateFrom, dateTo, summary, trend, categories, customerSummaries,
}: {
  siteName: string;
  dateFrom: string;
  dateTo: string;
  summary: Awaited<ReturnType<typeof getReportSummary>>;
  trend: Awaited<ReturnType<typeof getMonthlyTrend>>;
  categories: Awaited<ReturnType<typeof getExpensesByCategory>>;
  customerSummaries: Awaited<ReturnType<typeof getCustomerSummaries>>;
}) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>Financial Report</Text>
        <Text style={pdfStyles.subtitle}>
          {siteName} · {dateFrom} → {dateTo} · Generated {format(new Date(), "d MMM yyyy")}
        </Text>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Summary</Text>
          <View style={pdfStyles.row}>
            {[
              { label: "Total Income",   val: fmt(summary.totalIncome) },
              { label: "Total Expenses", val: fmt(summary.totalExpenses) },
              { label: "Net Revenue",    val: fmt(summary.netRevenue) },
            ].map((s) => (
              <View key={s.label} style={pdfStyles.statBox}>
                <Text style={pdfStyles.statLabel}>{s.label}</Text>
                <Text style={pdfStyles.statValue}>{s.val}</Text>
              </View>
            ))}
          </View>
          <View style={{ ...pdfStyles.row, marginTop: 4 }}>
            {[
              { label: "Transactions",  val: String(summary.transactionCount) },
              { label: "Shifts Logged", val: String(summary.totalShiftsLogged) },
              { label: "Hours Worked",  val: `${summary.totalHoursWorked.toFixed(1)}h` },
            ].map((s) => (
              <View key={s.label} style={pdfStyles.statBox}>
                <Text style={pdfStyles.statLabel}>{s.label}</Text>
                <Text style={pdfStyles.statValue}>{s.val}</Text>
              </View>
            ))}
          </View>
        </View>

        {trend.length > 0 && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Monthly Revenue vs Expenses</Text>
            <View style={pdfStyles.tableHeader}>
              <Text style={pdfStyles.tableCellBold}>Month</Text>
              <Text style={pdfStyles.tableCellRight}>Income</Text>
              <Text style={pdfStyles.tableCellRight}>Expenses</Text>
              <Text style={pdfStyles.tableCellRightBold}>Net</Text>
            </View>
            {trend.map((row) => (
              <View key={row.month} style={pdfStyles.tableRow}>
                <Text style={pdfStyles.tableCell}>{row.month}</Text>
                <Text style={pdfStyles.tableCellRight}>{fmt(row.income)}</Text>
                <Text style={pdfStyles.tableCellRight}>{fmt(row.expenses)}</Text>
                <Text style={pdfStyles.tableCellRightBold}>{fmt(row.income - row.expenses)}</Text>
              </View>
            ))}
          </View>
        )}

        {categories.length > 0 && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Expenses by Category</Text>
            <View style={pdfStyles.tableHeader}>
              <Text style={pdfStyles.tableCellBold}>Category</Text>
              <Text style={pdfStyles.tableCellRight}>Total</Text>
              <Text style={pdfStyles.tableCellRight}>% of Expenses</Text>
            </View>
            {categories.map((row) => {
              const pct = summary.totalExpenses > 0
                ? ((row.total / summary.totalExpenses) * 100).toFixed(1)
                : "0.0";
              return (
                <View key={row.category} style={pdfStyles.tableRow}>
                  <Text style={pdfStyles.tableCell}>{row.category}</Text>
                  <Text style={pdfStyles.tableCellRight}>{fmt(row.total)}</Text>
                  <Text style={pdfStyles.tableCellRight}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        )}

        {customerSummaries.length > 0 && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Customer Profitability</Text>
            <View style={pdfStyles.tableHeader}>
              <Text style={pdfStyles.tableCellBold}>Customer</Text>
              <Text style={{ ...pdfStyles.tableCellRight, flex: 0.6 }}>Type</Text>
              <Text style={pdfStyles.tableCellRight}>Income</Text>
              <Text style={pdfStyles.tableCellRight}>Expenses</Text>
              <Text style={pdfStyles.tableCellRightBold}>Net Profit</Text>
            </View>
            {customerSummaries
              .slice()
              .sort((a, b) => b.netProfit - a.netProfit)
              .map((cs) => (
                <View key={cs.customerId} style={pdfStyles.tableRow}>
                  <Text style={pdfStyles.tableCell}>{cs.customerName}</Text>
                  <Text style={{ ...pdfStyles.tableCell, flex: 0.6, textTransform: "capitalize" }}>
                    {cs.customerType}
                  </Text>
                  <Text style={pdfStyles.tableCellRight}>{fmt(cs.totalIncome)}</Text>
                  <Text style={pdfStyles.tableCellRight}>{fmt(cs.totalExpenses)}</Text>
                  <Text style={pdfStyles.tableCellRightBold}>{fmt(cs.netProfit)}</Text>
                </View>
              ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

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

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-2">
      <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">{label}</p>
      <p className="text-[26px] font-bold tracking-tight leading-none font-display">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
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

  const opts = { enabled: !!activeSiteId && !!dateFrom && !!dateTo };

  const { data: summary } = useQuery({
    queryKey: ["report-summary", activeSiteId, dateFrom, dateTo],
    queryFn: () => getReportSummary(activeSiteId!, dateFrom, dateTo),
    ...opts,
  });

  const { data: trend = [], isLoading: loadingTrend } = useQuery({
    queryKey: ["report-trend", activeSiteId, dateFrom, dateTo],
    queryFn: () => getMonthlyTrend(activeSiteId!, dateFrom, dateTo),
    ...opts,
  });

  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ["report-categories", activeSiteId, dateFrom, dateTo],
    queryFn: () => getExpensesByCategory(activeSiteId!, dateFrom, dateTo),
    ...opts,
  });

  const { data: production = [], isLoading: loadingProd } = useQuery({
    queryKey: ["report-production", activeSiteId, dateFrom, dateTo],
    queryFn: () => getProductionByDay(activeSiteId!, dateFrom, dateTo),
    ...opts,
  });

  const { data: customerSummaries = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ["customer-summaries", activeSiteId, dateFrom, dateTo],
    queryFn: () => getCustomerSummaries(activeSiteId!, dateFrom, dateTo),
    ...opts,
  });

  async function handleExportPDF() {
    if (!summary) return;
    setIsExporting(true);
    try {
      const blob = await pdf(
        <ReportPDF
          siteName={activeSite?.name ?? "Site"}
          dateFrom={dateFrom}
          dateTo={dateTo}
          summary={summary}
          trend={trend}
          categories={categories}
          customerSummaries={customerSummaries}
        />
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
            className="w-38 h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-38 h-8 text-xs"
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
        />
        <StatCard
          label="Total Expenses"
          value={fmtShort(summary?.totalExpenses ?? 0)}
          sub={fmt(summary?.totalExpenses ?? 0)}
        />
        <StatCard
          label="Net Revenue"
          value={fmtShort(summary?.netRevenue ?? 0)}
          sub={(summary?.netRevenue ?? 0) >= 0 ? "Positive cashflow" : "Net loss"}
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
          label="Hours Worked"
          value={`${(summary?.totalHoursWorked ?? 0).toFixed(0)}h`}
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
                  width={44}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                <Bar dataKey="Income"   name="Income"   fill="hsl(var(--foreground))"                  radius={[3, 3, 0, 0]} />
                <Bar dataKey="Expenses" name="Expenses" fill="hsl(var(--muted-foreground))" opacity={0.35} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-foreground" /> Income
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground opacity-60" /> Expenses
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
              {categories.slice(0, 7).map((c) => {
                const pct = Math.round((c.total / maxCat) * 100);
                const sharePct = summary && summary.totalExpenses > 0
                  ? ((c.total / summary.totalExpenses) * 100).toFixed(0)
                  : "0";
                return (
                  <div key={c.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate mr-2">{c.category}</span>
                      <span className="tabular-nums font-semibold text-foreground shrink-0">
                        {fmtShort(c.total)}
                        <span className="text-muted-foreground font-normal ml-1.5">{sharePct}%</span>
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
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}h`}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--border))" }} />
                <Line
                  type="monotone"
                  dataKey="Hours"
                  name="Hours"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={1.5}
                  dot={{ r: 2.5, fill: "hsl(var(--foreground))", strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: "hsl(var(--foreground))", strokeWidth: 0 }}
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
              {categories.map((c) => {
                const pct = summary && summary.totalExpenses > 0
                  ? (c.total / summary.totalExpenses) * 100
                  : 0;
                return (
                  <tr key={c.category} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{c.category}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold">{fmt(c.total)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                      {pct.toFixed(1)}%
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <div className="flex items-center justify-end">
                        <div className="w-24 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-foreground/60"
                            style={{ width: `${Math.round(pct)}%` }}
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
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{fmt(row.income)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{fmt(row.expenses)}</td>
                    <td className={`px-5 py-3 text-right tabular-nums font-semibold ${net >= 0 ? "text-foreground" : "text-muted-foreground"}`}>
                      {net >= 0 ? "+" : "−"}{fmt(Math.abs(net))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
                  <div key={cs.customerId} className="rounded-xl border border-border bg-card p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/customers/${cs.customerId}`}
                          className="font-semibold truncate hover:underline underline-offset-2 block"
                        >
                          {cs.customerName}
                        </Link>
                        <Badge
                          variant="outline"
                          className={cs.customerType === "external" ? "text-blue-600 border-blue-200 mt-1" : "text-muted-foreground mt-1"}
                        >
                          {cs.customerType}
                        </Badge>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Net Profit</p>
                        <p className={`text-lg font-bold tabular-nums ${cs.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {cs.netProfit >= 0 ? "+" : "−"}{fmt(Math.abs(cs.netProfit))}
                        </p>
                      </div>
                    </div>

                    {/* Income / Expenses */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Income</p>
                        <p className="text-sm font-semibold tabular-nums text-emerald-600">{fmt(cs.totalIncome)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Expenses</p>
                        <p className="text-sm font-semibold tabular-nums text-red-500">{fmt(cs.totalExpenses)}</p>
                      </div>
                    </div>

                    {/* Expense category breakdown */}
                    {cs.expensesByCategory.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Expenses by Category
                        </p>
                        {cs.expensesByCategory.slice(0, 4).map((c) => {
                          const pct = Math.round((c.total / maxCatVal) * 100);
                          return (
                            <div key={c.category} className="space-y-0.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground truncate mr-2">{c.category}</span>
                                <span className="tabular-nums font-medium shrink-0">{fmtShort(c.total)}</span>
                              </div>
                              <div className="h-1 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-foreground/60 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground">
                      {cs.transactionCount} transaction{cs.transactionCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}

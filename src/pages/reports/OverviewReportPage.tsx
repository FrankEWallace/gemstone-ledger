import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Download } from "lucide-react";

import { useSite } from "@/hooks/useSite";
import { useReportDateRange } from "@/hooks/useReportDateRange";
import ReportsSubNav from "@/components/reports/ReportsSubNav";
import {
  getReportSummary, getMonthlyTrend, getExpensesByCategory,
} from "@/services/reports.service";
import { fmtCurrency, fmtCompact, fmtTick, CURRENCY_SYMBOL } from "@/lib/formatCurrency";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  income:  "var(--chart-income)",
  expense: "var(--chart-expense)",
  net:     "var(--chart-net)",
  cat: [
    "var(--chart-cat-1)", "var(--chart-cat-2)", "var(--chart-cat-3)",
    "var(--chart-cat-4)", "var(--chart-cat-5)",
  ],
} as const;

const PRESETS = [
  { label: "This month",    months: 0 },
  { label: "Last 3 months", months: 2 },
  { label: "Last 6 months", months: 5 },
];

// ─── Primitives ───────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-4">
      {children}
    </p>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-1 min-w-0 overflow-hidden relative">
      {color && <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl" style={{ backgroundColor: color }} />}
      <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground truncate pt-0.5">{label}</p>
      <p className="text-lg font-bold tracking-tight leading-none tabular-nums font-display truncate" style={color ? { color } : undefined}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: p.fill ?? p.stroke }} />
          {p.name}:&nbsp;
          <span className="font-semibold text-foreground">{fmtCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewReportPage() {
  const { activeSiteId, activeSite } = useSite();
  const { dateFrom, dateTo, setDateFrom, setDateTo } = useReportDateRange();
  const [isExporting, setIsExporting] = useState(false);

  const opts = { enabled: !!activeSiteId && !!dateFrom && !!dateTo, staleTime: 0 };

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

  // ── Derived ───────────────────────────────────────────────────────────────

  const trendChartData = trend.map((t) => ({
    month:    t.month.slice(5),
    Income:   t.income,
    Expenses: t.expenses,
  }));

  const maxCat = Math.max(...categories.map((c) => c.total), 1);

  const margin = summary && summary.totalIncome > 0
    ? ((summary.netRevenue / summary.totalIncome) * 100).toFixed(1)
    : null;

  // ── PDF export ────────────────────────────────────────────────────────────

  async function handleExportPDF() {
    if (!summary) return;
    setIsExporting(true);
    try {
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
        tableHeader:  { flexDirection: "row", backgroundColor: NAVY, padding: "6 8", borderRadius: 3 },
        trOdd:        { flexDirection: "row", padding: "5 8", backgroundColor: "#ffffff" },
        trEven:       { flexDirection: "row", padding: "5 8", backgroundColor: "#f4f6f9" },
        thCell:       { flex: 1, fontSize: 8, fontWeight: "bold", color: "#ffffff" },
        thCellRight:  { flex: 1, fontSize: 8, fontWeight: "bold", color: "#ffffff", textAlign: "right" },
        tdCell:       { flex: 1, fontSize: 9, color: "#444" },
        tdCellRight:  { flex: 1, fontSize: 9, color: "#444", textAlign: "right" },
        tdCellBold:   { flex: 1, fontSize: 9, fontWeight: "bold", color: "#111", textAlign: "right" },
      });

      const siteName    = activeSite?.name ?? "Site";
      const periodLabel = `${dateFrom} → ${dateTo}`;

      const blob = await pdf(
        <Document>
          <Page size="A4" style={s.page}>
            <View fixed style={s.header}>
              <Text style={s.headerLeft}>FW MINING OS  ·  {siteName.toUpperCase()}</Text>
              <Text style={s.headerRight}>Financial Overview  ·  {periodLabel}</Text>
            </View>
            <View fixed style={s.footer}>
              <Text style={s.footerText}>Confidential  ·  Generated {format(new Date(), "d MMM yyyy")}</Text>
              <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} style={s.footerText} />
            </View>

            <View style={s.titleBlock}>
              <Text style={s.title}>Financial Overview</Text>
              <Text style={s.subtitle}>{siteName}  ·  {periodLabel}</Text>
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>Summary</Text>
              <View style={s.row}>
                {[
                  { label: "Total Income",   val: fmtCurrency(summary.totalIncome),   accent: GREEN },
                  { label: "Total Expenses", val: fmtCurrency(summary.totalExpenses), accent: RED },
                  { label: "Net Revenue",    val: fmtCurrency(summary.netRevenue),    accent: summary.netRevenue >= 0 ? GREEN : RED },
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
                  { label: "Profit Margin", val: margin ? `${margin}%` : "—" },
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
                    <Text style={s.tdCellRight}>{fmtCurrency(row.income)}</Text>
                    <Text style={s.tdCellRight}>{fmtCurrency(row.expenses)}</Text>
                    <Text style={s.tdCellBold}>{fmtCurrency(row.income - row.expenses)}</Text>
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
                      <Text style={s.tdCellRight}>{fmtCurrency(row.total)}</Text>
                      <Text style={s.tdCellRight}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Page>
        </Document>
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `financial-overview-${dateFrom}-${dateTo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 space-y-6">

      <ReportsSubNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight">Financial Overview</h1>
        <button
          onClick={handleExportPDF}
          disabled={isExporting || !summary}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          {isExporting ? "Generating PDF…" : "Export PDF"}
        </button>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const from   = format(startOfMonth(subMonths(new Date(), p.months)), "yyyy-MM-dd");
            const to     = format(endOfMonth(new Date()), "yyyy-MM-dd");
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
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs w-36" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs w-36" />
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Income"   value={fmtCompact(summary?.totalIncome ?? 0)}   sub={fmtCurrency(summary?.totalIncome ?? 0)}   color={C.income} />
        <StatCard label="Total Expenses" value={fmtCompact(summary?.totalExpenses ?? 0)} sub={fmtCurrency(summary?.totalExpenses ?? 0)} color={C.expense} />
        <StatCard
          label="Net Revenue"
          value={fmtCompact(summary?.netRevenue ?? 0)}
          sub={(summary?.netRevenue ?? 0) >= 0 ? "Positive cashflow" : "Net loss"}
          color={(summary?.netRevenue ?? 0) >= 0 ? C.income : C.expense}
        />
        <StatCard label="Transactions"  value={String(summary?.transactionCount ?? 0)} />
        <StatCard label="Shifts Logged" value={String(summary?.totalShiftsLogged ?? 0)} />
        <StatCard
          label="Profit Margin"
          value={margin ? `${margin}%` : "—"}
          sub={(summary?.netRevenue ?? 0) >= 0 ? "Of income retained" : "Net loss"}
          color={C.net}
        />
      </div>

      {/* Revenue vs Expenses — ComposedChart */}
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
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={trendChartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="overviewIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.income} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.income} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
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
                  width={48}
                />
                <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="Income"
                  name="Income"
                  stroke={C.income}
                  strokeWidth={2}
                  fill="url(#overviewIncomeGrad)"
                  fillOpacity={1}
                  dot={false}
                  activeDot={{ r: 4, fill: C.income, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="Expenses"
                  name="Expenses"
                  stroke={C.expense}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  activeDot={{ r: 4, fill: C.expense, strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: C.income }} /> Income
              </span>
              <span className="flex items-center gap-1.5 opacity-70">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: C.expense }} /> Expenses
              </span>
            </div>
          </>
        )}
      </div>

      {/* Expense by category — horizontal bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionLabel>Expenses by Category</SectionLabel>
          {loadingCats ? (
            <div className="h-48 animate-pulse bg-muted rounded-lg" />
          ) : categories.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No expense data.</div>
          ) : (
            <div className="space-y-3">
              {categories.slice(0, 7).map((c, idx) => {
                const pct      = Math.round((c.total / maxCat) * 100);
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
                        {fmtCompact(c.total)}
                        <span className="text-muted-foreground font-normal ml-1.5">{sharePct}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Monthly financials table */}
        {trend.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <SectionLabel>Monthly Financials</SectionLabel>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-2.5 text-left font-semibold tracking-wider uppercase text-xs text-muted-foreground">Month</th>
                  <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-xs text-muted-foreground">Income</th>
                  <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-xs text-muted-foreground">Expenses</th>
                  <th className="px-5 py-2.5 text-right font-semibold tracking-wider uppercase text-xs text-muted-foreground">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {trend.map((row) => {
                  const net = row.income - row.expenses;
                  return (
                    <tr key={row.month} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium">{row.month}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium" style={{ color: C.income }}>{fmtCurrency(row.income)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium" style={{ color: C.expense }}>{fmtCurrency(row.expenses)}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold" style={{ color: net >= 0 ? C.income : C.expense }}>
                        {net >= 0 ? "+" : "−"}{fmtCurrency(Math.abs(net))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expense category table */}
      {categories.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Expense Category Breakdown</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-2.5 text-left font-semibold tracking-wider uppercase text-xs text-muted-foreground">Category</th>
                <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-xs text-muted-foreground">Total Spent</th>
                <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-xs text-muted-foreground hidden sm:table-cell">% of Expenses</th>
                <th className="px-5 py-2.5 text-right font-semibold tracking-wider uppercase text-xs text-muted-foreground hidden md:table-cell">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((c, idx) => {
                const pct      = summary && summary.totalExpenses > 0 ? (c.total / summary.totalExpenses) * 100 : 0;
                const barColor = C.cat[idx % C.cat.length];
                return (
                  <tr key={c.category} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
                        {c.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold" style={{ color: C.expense }}>{fmtCurrency(c.total)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground hidden sm:table-cell">{pct.toFixed(1)}%</td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <div className="flex items-center justify-end">
                        <div className="w-24 h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.round(pct)}%`, backgroundColor: barColor }} />
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
                  <td className="px-5 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Total</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold">{fmtCurrency(summary.totalExpenses)}</td>
                  <td className="px-3 py-3 text-right text-muted-foreground hidden sm:table-cell">100%</td>
                  <td className="px-5 py-3 hidden md:table-cell" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

    </div>
  );
}

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { subMonths, format, startOfMonth, endOfMonth } from "date-fns";
import { Download, TrendingUp, DollarSign, Clock, FileText } from "lucide-react";
import {
  pdf,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

import { useSite } from "@/hooks/useSite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getMonthlyTrend,
  getExpensesByCategory,
  getReportSummary,
  getProductionByDay,
} from "@/services/reports.service";

// ─── Chart colours ────────────────────────────────────────────────────────────

const PIE_COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
];

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// ─── PDF Document ─────────────────────────────────────────────────────────────

const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1a1a1a" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#666", marginBottom: 24 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", marginBottom: 10, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 4 },
  row: { flexDirection: "row", marginBottom: 4 },
  statBox: { flex: 1, padding: 10, backgroundColor: "#f9fafb", borderRadius: 4, marginRight: 8 },
  statLabel: { fontSize: 8, color: "#6b7280", marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: "bold" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f3f4f6", padding: "6 8", borderRadius: 4, marginBottom: 2 },
  tableRow: { flexDirection: "row", padding: "5 8", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tableCell: { flex: 1, fontSize: 9 },
  tableCellRight: { flex: 1, fontSize: 9, textAlign: "right" },
  positive: { color: "#16a34a" },
  negative: { color: "#dc2626" },
});

function ReportPDF({
  siteName,
  dateFrom,
  dateTo,
  summary,
  trend,
  categories,
}: {
  siteName: string;
  dateFrom: string;
  dateTo: string;
  summary: Awaited<ReturnType<typeof getReportSummary>>;
  trend: Awaited<ReturnType<typeof getMonthlyTrend>>;
  categories: Awaited<ReturnType<typeof getExpensesByCategory>>;
}) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>Financial Report</Text>
        <Text style={pdfStyles.subtitle}>
          {siteName} · {dateFrom} to {dateTo} · Generated {format(new Date(), "MMM d, yyyy")}
        </Text>

        {/* Summary */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Summary</Text>
          <View style={pdfStyles.row}>
            <View style={pdfStyles.statBox}>
              <Text style={pdfStyles.statLabel}>Total Income</Text>
              <Text style={[pdfStyles.statValue, pdfStyles.positive]}>{fmt(summary.totalIncome)}</Text>
            </View>
            <View style={pdfStyles.statBox}>
              <Text style={pdfStyles.statLabel}>Total Expenses</Text>
              <Text style={[pdfStyles.statValue, pdfStyles.negative]}>{fmt(summary.totalExpenses)}</Text>
            </View>
            <View style={{ ...pdfStyles.statBox, marginRight: 0 }}>
              <Text style={pdfStyles.statLabel}>Net Revenue</Text>
              <Text style={[pdfStyles.statValue, summary.netRevenue >= 0 ? pdfStyles.positive : pdfStyles.negative]}>
                {fmt(summary.netRevenue)}
              </Text>
            </View>
          </View>
          <View style={{ ...pdfStyles.row, marginTop: 8 }}>
            <View style={pdfStyles.statBox}>
              <Text style={pdfStyles.statLabel}>Transactions</Text>
              <Text style={pdfStyles.statValue}>{summary.transactionCount}</Text>
            </View>
            <View style={pdfStyles.statBox}>
              <Text style={pdfStyles.statLabel}>Shifts Logged</Text>
              <Text style={pdfStyles.statValue}>{summary.totalShiftsLogged}</Text>
            </View>
            <View style={{ ...pdfStyles.statBox, marginRight: 0 }}>
              <Text style={pdfStyles.statLabel}>Hours Worked</Text>
              <Text style={pdfStyles.statValue}>{summary.totalHoursWorked.toFixed(1)}h</Text>
            </View>
          </View>
        </View>

        {/* Monthly Trend */}
        {trend.length > 0 && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Monthly Revenue vs Expenses</Text>
            <View style={pdfStyles.tableHeader}>
              <Text style={pdfStyles.tableCell}>Month</Text>
              <Text style={pdfStyles.tableCellRight}>Income</Text>
              <Text style={pdfStyles.tableCellRight}>Expenses</Text>
              <Text style={pdfStyles.tableCellRight}>Net</Text>
            </View>
            {trend.map((row) => (
              <View key={row.month} style={pdfStyles.tableRow}>
                <Text style={pdfStyles.tableCell}>{row.month}</Text>
                <Text style={[pdfStyles.tableCellRight, pdfStyles.positive]}>{fmt(row.income)}</Text>
                <Text style={[pdfStyles.tableCellRight, pdfStyles.negative]}>{fmt(row.expenses)}</Text>
                <Text style={[pdfStyles.tableCellRight, (row.income - row.expenses) >= 0 ? pdfStyles.positive : pdfStyles.negative]}>
                  {fmt(row.income - row.expenses)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Expenses by Category */}
        {categories.length > 0 && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Expenses by Category</Text>
            <View style={pdfStyles.tableHeader}>
              <Text style={pdfStyles.tableCell}>Category</Text>
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
      </Page>
    </Document>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4 flex items-start gap-3">
      <div className="rounded-md bg-primary/10 p-2 text-primary">{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_FROM = format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");
const DEFAULT_TO = format(endOfMonth(new Date()), "yyyy-MM-dd");

export default function ReportsPage() {
  const { activeSiteId, activeSite } = useSite();
  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM);
  const [dateTo, setDateTo] = useState(DEFAULT_TO);
  const [isExporting, setIsExporting] = useState(false);

  const queryOpts = { enabled: !!activeSiteId && !!dateFrom && !!dateTo };

  const { data: summary } = useQuery({
    queryKey: ["report-summary", activeSiteId, dateFrom, dateTo],
    queryFn: () => getReportSummary(activeSiteId!, dateFrom, dateTo),
    ...queryOpts,
  });

  const { data: trend = [], isLoading: loadingTrend } = useQuery({
    queryKey: ["report-trend", activeSiteId, dateFrom, dateTo],
    queryFn: () => getMonthlyTrend(activeSiteId!, dateFrom, dateTo),
    ...queryOpts,
  });

  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ["report-categories", activeSiteId, dateFrom, dateTo],
    queryFn: () => getExpensesByCategory(activeSiteId!, dateFrom, dateTo),
    ...queryOpts,
  });

  const { data: production = [], isLoading: loadingProd } = useQuery({
    queryKey: ["report-production", activeSiteId, dateFrom, dateTo],
    queryFn: () => getProductionByDay(activeSiteId!, dateFrom, dateTo),
    ...queryOpts,
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
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${dateFrom}-${dateTo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  const productionChartData = production.map((p) => ({
    date: format(new Date(p.date), "MMM d"),
    hours: p.totalHours,
    output: p.totalOutput,
  }));

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Reports & Analytics</h1>
        <Button size="sm" onClick={handleExportPDF} disabled={isExporting || !summary}>
          <FileText className="h-4 w-4 mr-1.5" />
          {isExporting ? "Generating PDF…" : "Export PDF"}
        </Button>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border p-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40 h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40 h-8" />
        </div>
        <div className="flex gap-2">
          {[
            { label: "This month", from: format(startOfMonth(new Date()), "yyyy-MM-dd"), to: format(endOfMonth(new Date()), "yyyy-MM-dd") },
            { label: "Last 3 months", from: format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd"), to: format(endOfMonth(new Date()), "yyyy-MM-dd") },
            { label: "Last 6 months", from: format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd"), to: format(endOfMonth(new Date()), "yyyy-MM-dd") },
          ].map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => { setDateFrom(preset.from); setDateTo(preset.to); }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Income" value={fmt(summary?.totalIncome ?? 0)} icon={<DollarSign className="h-4 w-4" />} color="text-emerald-600" />
        <StatCard label="Total Expenses" value={fmt(summary?.totalExpenses ?? 0)} icon={<DollarSign className="h-4 w-4" />} color="text-red-600" />
        <StatCard
          label="Net Revenue"
          value={fmt(summary?.netRevenue ?? 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          color={(summary?.netRevenue ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}
        />
        <StatCard label="Transactions" value={String(summary?.transactionCount ?? 0)} icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Shifts Logged" value={String(summary?.totalShiftsLogged ?? 0)} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Hours Worked" value={`${(summary?.totalHoursWorked ?? 0).toFixed(0)}h`} icon={<Clock className="h-4 w-4" />} />
      </div>

      {/* Revenue vs Expenses trend */}
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium mb-4">Revenue vs Expenses by Month</p>
        {loadingTrend ? (
          <div className="h-56 animate-pulse bg-muted rounded" />
        ) : trend.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No data for this period.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend} margin={{ left: -10, right: 10 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, name: string) => [fmt(v), name === "income" ? "Income" : "Expenses"]}
              />
              <Legend formatter={(v) => v === "income" ? "Income" : "Expenses"} />
              <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Expenses by category + Production */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Expenses by category */}
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium mb-4">Expenses by Category</p>
          {loadingCats ? (
            <div className="h-48 animate-pulse bg-muted rounded" />
          ) : categories.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No expense data.</div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-44 shrink-0">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    {categories.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [fmt(v), "Total"]}
                  />
                </PieChart>
              </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                {categories.slice(0, 6).map((c, i) => (
                  <div key={c.category} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="truncate">{c.category}</span>
                    </div>
                    <span className="font-medium tabular-nums shrink-0">{fmt(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Production hours trend */}
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium mb-4">Daily Hours Worked</p>
          {loadingProd ? (
            <div className="h-48 animate-pulse bg-muted rounded" />
          ) : productionChartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No shift records for this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={productionChartData} margin={{ left: -20, right: 10 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v}h`, "Hours"]}
                />
                <Line type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Expense category table */}
      {categories.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Category</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total Spent</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">% of Expenses</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const pct = summary && summary.totalExpenses > 0
                  ? ((c.total / summary.totalExpenses) * 100).toFixed(1)
                  : "0.0";
                return (
                  <tr key={c.category} className="border-t border-border">
                    <td className="px-4 py-2.5">{c.category}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-600">{fmt(c.total)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

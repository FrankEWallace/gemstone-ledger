import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  parseISO,
} from "date-fns";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { useSite } from "@/hooks/useSite";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { fmtCurrency, fmtTick, fmtCompact, CURRENCY_SYMBOL } from "@/lib/formatCurrency";
import { getCustomers } from "@/services/customers.service";
import { getCustomerDetail } from "@/services/reports.service";
import { getTransactions } from "@/services/transactions.service";
import { getCustomerMonthlyTrend } from "@/services/contract.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = [
  "#10b981", "#6366f1", "#f59e0b", "#0ea5e9",
  "#ef4444", "#8b5cf6", "#f97316", "#14b8a6",
];

const PRESETS = [
  { label: "This month",    months: 0 },
  { label: "Last 3 months", months: 2 },
  { label: "Last 6 months", months: 5 },
];

const DEFAULT_FROM = format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");
const DEFAULT_TO   = format(endOfMonth(new Date()), "yyyy-MM-dd");

const fmt      = fmtCurrency;
const fmtShort = (n: number) => fmtCompact(n);

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground mb-4">
      {children}
    </p>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color = "text-foreground",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground truncate">
          {label}
        </p>
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground">
          {CURRENCY_SYMBOL}
        </span>
        <p className={`font-display text-2xl font-bold leading-none tabular-nums truncate ${color}`}>
          {value}
        </p>
      </div>
      {sub && (
        <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
      )}
    </div>
  );
}

function PlainKpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 min-w-0">
      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground truncate">
        {label}
      </p>
      <p className="font-display text-2xl font-bold leading-none tabular-nums truncate">
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
      )}
    </div>
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
          <span className="font-semibold text-foreground">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-0.5">{payload[0].name}</p>
      <p className="tabular-nums text-muted-foreground">{fmt(payload[0].value)}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerReportPage() {
  const { id } = useParams<{ id: string }>();
  const { activeSiteId, activeSite } = useSite();

  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM);
  const [dateTo,   setDateTo]   = useState(DEFAULT_TO);
  const [isExportingPDF,   setIsExportingPDF]   = useState(false);
  const [isExportingXLSX,  setIsExportingXLSX]  = useState(false);

  const opts = { enabled: !!activeSiteId && !!id };

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    ...opts,
  });

  const customer = customers.find((c) => c.id === id);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["customer-detail", activeSiteId, id, dateFrom, dateTo],
    queryFn: () => getCustomerDetail(activeSiteId!, id!, dateFrom, dateTo),
    ...opts,
  });

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["transactions", activeSiteId, "all", "all", "all", id, dateFrom, dateTo],
    queryFn: () => getTransactions(activeSiteId!, { customerId: id, dateFrom, dateTo }),
    ...opts,
  });

  const { data: monthlyTrend = [] } = useQuery({
    queryKey: ["customer-trend", activeSiteId, id, dateFrom, dateTo],
    queryFn: () => getCustomerMonthlyTrend(activeSiteId!, id!, dateFrom, dateTo),
    ...opts,
  });

  // ── Derived data ─────────────────────────────────────────────────────────────

  const expenseByCategory = summary?.expensesByCategory ?? [];

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "income")
      .forEach((t) => {
        const cat = t.category || "General";
        map[cat] = (map[cat] || 0) + (t.quantity as number) * (t.unit_price as number);
      });
    return Object.entries(map)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  const sortedTx = useMemo(
    () => [...transactions].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
    [transactions],
  );

  const trendChartData = monthlyTrend.map((t) => ({
    month:    t.month,
    Income:   t.income,
    Expenses: t.expenses,
  }));

  const margin = summary && summary.totalIncome > 0
    ? Math.round((summary.netProfit / summary.totalIncome) * 100)
    : 0;

  const daysWorked = useMemo(
    () => new Set(transactions.filter((t) => t.type === "income").map((t) => t.transaction_date)).size,
    [transactions],
  );

  // ── Export helpers ────────────────────────────────────────────────────────────

  const siteName     = activeSite?.name ?? "Site";
  const customerName = customer?.name ?? "Customer";
  const periodLabel  = `${dateFrom} → ${dateTo}`;

  async function handleExportPDF() {
    if (!summary) return;
    setIsExportingPDF(true);
    try {
      const { pdf, Document, Page, Text, View, StyleSheet } =
        await import("@react-pdf/renderer");

      const s = StyleSheet.create({
        page:                { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#111" },
        title:               { fontSize: 18, fontWeight: "bold", marginBottom: 3 },
        subtitle:            { fontSize: 9, color: "#666", marginBottom: 24 },
        section:             { marginBottom: 20 },
        sectionTitle:        { fontSize: 7, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1.5, color: "#888", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 4, marginBottom: 8 },
        row:                 { flexDirection: "row", marginBottom: 6 },
        statBox:             { flex: 1, padding: 10, backgroundColor: "#f9fafb", borderRadius: 4, marginRight: 8 },
        statLabel:           { fontSize: 7, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
        statValue:           { fontSize: 14, fontWeight: "bold" },
        tableHeader:         { flexDirection: "row", backgroundColor: "#f3f4f6", padding: "5 8", borderRadius: 3, marginBottom: 2 },
        tableRow:            { flexDirection: "row", padding: "4 8", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
        tableCell:           { flex: 1, fontSize: 9, color: "#555" },
        tableCellBold:       { flex: 1, fontSize: 9, fontWeight: "bold", color: "#111" },
        tableCellRight:      { flex: 1, fontSize: 9, textAlign: "right", color: "#555" },
        tableCellRightBold:  { flex: 1, fontSize: 9, textAlign: "right", fontWeight: "bold", color: "#111" },
        tableCellNarrow:     { flex: 0.6, fontSize: 9, color: "#555" },
        tableCellNarrowRight:{ flex: 0.6, fontSize: 9, textAlign: "right", color: "#555" },
      });

      const blob = await pdf(
        <Document>
          <Page size="A4" style={s.page}>
            {/* Header */}
            <Text style={s.title}>{customerName} — Financial Report</Text>
            <Text style={s.subtitle}>
              {siteName} · {periodLabel} · Generated {format(new Date(), "d MMM yyyy")}
            </Text>

            {/* KPI summary */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Summary</Text>
              <View style={s.row}>
                {[
                  { label: "Total Income",   val: fmt(summary.totalIncome) },
                  { label: "Total Expenses", val: fmt(summary.totalExpenses) },
                  { label: "Net Profit",     val: fmt(summary.netProfit) },
                ].map((item) => (
                  <View key={item.label} style={s.statBox}>
                    <Text style={s.statLabel}>{item.label}</Text>
                    <Text style={s.statValue}>{item.val}</Text>
                  </View>
                ))}
              </View>
              <View style={{ ...s.row, marginTop: 4 }}>
                {[
                  { label: "Margin",       val: `${margin}%` },
                  { label: "Transactions", val: String(summary.transactionCount) },
                  { label: "Days Worked",  val: String(daysWorked) },
                ].map((item) => (
                  <View key={item.label} style={s.statBox}>
                    <Text style={s.statLabel}>{item.label}</Text>
                    <Text style={s.statValue}>{item.val}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Monthly trend */}
            {monthlyTrend.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Monthly Revenue vs Expenses</Text>
                <View style={s.tableHeader}>
                  <Text style={s.tableCellBold}>Month</Text>
                  <Text style={s.tableCellRight}>Income</Text>
                  <Text style={s.tableCellRight}>Expenses</Text>
                  <Text style={s.tableCellRightBold}>Net</Text>
                </View>
                {monthlyTrend.map((row) => (
                  <View key={row.month} style={s.tableRow}>
                    <Text style={s.tableCell}>{row.month}</Text>
                    <Text style={s.tableCellRight}>{fmt(row.income)}</Text>
                    <Text style={s.tableCellRight}>{fmt(row.expenses)}</Text>
                    <Text style={s.tableCellRightBold}>{fmt(row.income - row.expenses)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Expense categories */}
            {expenseByCategory.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Expenses by Category</Text>
                <View style={s.tableHeader}>
                  <Text style={s.tableCellBold}>Category</Text>
                  <Text style={s.tableCellRight}>Total</Text>
                  <Text style={s.tableCellNarrowRight}>% of Expenses</Text>
                </View>
                {expenseByCategory.map((row) => {
                  const pct = summary.totalExpenses > 0
                    ? ((row.total / summary.totalExpenses) * 100).toFixed(1)
                    : "0.0";
                  return (
                    <View key={row.category} style={s.tableRow}>
                      <Text style={s.tableCell}>{row.category}</Text>
                      <Text style={s.tableCellRight}>{fmt(row.total)}</Text>
                      <Text style={s.tableCellNarrowRight}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Transactions */}
            {sortedTx.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Transactions ({sortedTx.length})</Text>
                <View style={s.tableHeader}>
                  <Text style={s.tableCellNarrow}>Date</Text>
                  <Text style={s.tableCellBold}>Description</Text>
                  <Text style={s.tableCellNarrow}>Type</Text>
                  <Text style={s.tableCellNarrow}>Status</Text>
                  <Text style={s.tableCellNarrowRight}>Amount</Text>
                </View>
                {sortedTx.map((t) => {
                  const amount = (t.quantity as number) * (t.unit_price as number);
                  return (
                    <View key={t.id} style={s.tableRow}>
                      <Text style={s.tableCellNarrow}>{format(new Date(t.transaction_date), "d MMM yy")}</Text>
                      <Text style={s.tableCell}>{t.description || "—"}</Text>
                      <Text style={s.tableCellNarrow}>{t.type}</Text>
                      <Text style={s.tableCellNarrow}>{t.status}</Text>
                      <Text style={s.tableCellNarrowRight}>{fmt(amount)}</Text>
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
      a.download = `${customerName.toLowerCase().replace(/\s+/g, "-")}-report-${dateFrom}-${dateTo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingPDF(false);
    }
  }

  async function handleExportXLSX() {
    if (!summary) return;
    setIsExportingXLSX(true);
    try {
      const XLSX = await import("xlsx");

      const wb = XLSX.utils.book_new();

      // ── Sheet 1: Summary ────────────────────────────────────────────────────
      const summaryData = [
        ["Customer Report", customerName],
        ["Site", siteName],
        ["Period", periodLabel],
        ["Generated", format(new Date(), "d MMM yyyy")],
        [],
        ["Metric", "Value"],
        ["Total Income",   summary.totalIncome],
        ["Total Expenses", summary.totalExpenses],
        ["Net Profit",     summary.netProfit],
        ["Margin %",       `${margin}%`],
        ["Transactions",   summary.transactionCount],
        ["Days Worked",    daysWorked],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary["!cols"] = [{ wch: 20 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

      // ── Sheet 2: Monthly Trend ──────────────────────────────────────────────
      if (monthlyTrend.length > 0) {
        const trendRows = [
          ["Month", "Income", "Expenses", "Net"],
          ...monthlyTrend.map((r) => [r.month, r.income, r.expenses, r.income - r.expenses]),
        ];
        const wsTrend = XLSX.utils.aoa_to_sheet(trendRows);
        wsTrend["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, wsTrend, "Monthly Trend");
      }

      // ── Sheet 3: Expense Categories ─────────────────────────────────────────
      if (expenseByCategory.length > 0) {
        const catRows = [
          ["Category", "Total", "% of Expenses"],
          ...expenseByCategory.map((c) => [
            c.category,
            c.total,
            summary.totalExpenses > 0
              ? Number(((c.total / summary.totalExpenses) * 100).toFixed(1))
              : 0,
          ]),
        ];
        const wsCat = XLSX.utils.aoa_to_sheet(catRows);
        wsCat["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, wsCat, "Expense Categories");
      }

      // ── Sheet 4: Transactions ───────────────────────────────────────────────
      if (sortedTx.length > 0) {
        const txRows = [
          ["Date", "Description", "Category", "Type", "Status", "Quantity", "Unit Price", "Total"],
          ...sortedTx.map((t) => [
            t.transaction_date,
            t.description ?? "",
            t.category ?? "",
            t.type,
            t.status,
            t.quantity,
            t.unit_price,
            (t.quantity as number) * (t.unit_price as number),
          ]),
        ];
        const wsTx = XLSX.utils.aoa_to_sheet(txRows);
        wsTx["!cols"] = [
          { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 10 },
          { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 16 },
        ];
        XLSX.utils.book_append_sheet(wb, wsTx, "Transactions");
      }

      XLSX.writeFile(wb, `${customerName.toLowerCase().replace(/\s+/g, "-")}-report-${dateFrom}-${dateTo}.xlsx`);
    } finally {
      setIsExportingXLSX(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px]">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/reports"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Reports & Analytics
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {customer?.name ?? "Customer Report"}
            </h1>
            {customer && (
              <>
                <Badge
                  variant="outline"
                  className={customer.type === "external" ? "text-blue-600 border-blue-200" : "text-muted-foreground"}
                >
                  {customer.type}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    customer.status === "active"    ? "text-emerald-600 border-emerald-200" :
                    customer.status === "prospect"  ? "text-violet-600 border-violet-200"   :
                    customer.status === "completed" ? "text-blue-500 border-blue-100"       :
                    "text-muted-foreground"
                  }
                >
                  {customer.status}
                </Badge>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportXLSX}
            disabled={isExportingXLSX || !summary}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {isExportingXLSX ? "Generating…" : "Export Excel"}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF || !summary}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            {isExportingPDF ? "Generating…" : "Export PDF"}
          </button>
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-38 h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-38 h-8 text-xs" />
        </div>
        <div className="flex flex-wrap gap-2 pb-0.5">
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
                    : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI strip */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 animate-pulse bg-muted rounded-xl" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <KpiCard
            label="Total Income"
            value={fmtShort(summary.totalIncome).replace(`${CURRENCY_SYMBOL} `, "")}
            sub={`${summary.transactionCount} transactions`}
            color="text-emerald-600"
            icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
          />
          <KpiCard
            label="Total Expenses"
            value={fmtShort(summary.totalExpenses).replace(`${CURRENCY_SYMBOL} `, "")}
            sub={expenseByCategory.length > 0 ? `${expenseByCategory[0].category} is largest` : "No expenses"}
            color="text-red-500"
            icon={<TrendingDown className="h-3.5 w-3.5 text-red-400 shrink-0" />}
          />
          <KpiCard
            label="Net Profit"
            value={fmtShort(summary.netProfit).replace(`${CURRENCY_SYMBOL} `, "").replace("−", "")}
            sub={summary.totalIncome > 0 ? `${margin}% margin` : ""}
            color={summary.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}
          />
          <PlainKpiCard
            label="Days Worked"
            value={String(daysWorked)}
            sub="days with income"
          />
          <PlainKpiCard
            label="Avg / Day"
            value={
              daysWorked > 0
                ? fmtShort(summary.totalIncome / daysWorked).replace(`${CURRENCY_SYMBOL} `, "")
                : "—"
            }
            sub="revenue per working day"
          />
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Monthly trend */}
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionLabel>Monthly Revenue vs Expenses</SectionLabel>
          {trendChartData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
              No monthly data for this period.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendChartData} barGap={3} barCategoryGap="32%">
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => {
                      try { return format(parseISO(v + "-01"), "MMM yy"); } catch { return v; }
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => fmtTick(v)}
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

        {/* Expense breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionLabel>Expense Breakdown by Category</SectionLabel>
          {expenseByCategory.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
              No expense data for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={82}
                  innerRadius={40}
                  paddingAngle={2}
                >
                  {expenseByCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Expense category table */}
      {expenseByCategory.length > 0 && summary && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <SectionLabel>Expense Category Breakdown</SectionLabel>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Category</th>
                <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Total Spent</th>
                <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden sm:table-cell">% of Expenses</th>
                <th className="px-5 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden md:table-cell">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expenseByCategory.map((c) => {
                const pct = summary.totalExpenses > 0
                  ? (c.total / summary.totalExpenses) * 100
                  : 0;
                return (
                  <tr key={c.category} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{c.category}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold">{fmt(c.total)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground hidden sm:table-cell">{pct.toFixed(1)}%</td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <div className="flex items-center justify-end">
                        <div className="w-24 h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-foreground/60" style={{ width: `${Math.round(pct)}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20">
                <td className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Total</td>
                <td className="px-3 py-3 text-right tabular-nums font-bold">{fmt(summary.totalExpenses)}</td>
                <td className="px-3 py-3 text-right text-muted-foreground hidden sm:table-cell">100%</td>
                <td className="px-5 py-3 hidden md:table-cell" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Transaction table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
            Transactions ({sortedTx.length})
          </p>
          {customer && (
            <Link
              to={`/customers/${customer.id}`}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              View customer profile →
            </Link>
          )}
        </div>
        {loadingTx ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse bg-muted rounded" />)}
          </div>
        ) : sortedTx.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No transactions in this date range.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Date</th>
                <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Description</th>
                <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden sm:table-cell">Category</th>
                <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Type</th>
                <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden md:table-cell">Status</th>
                <th className="px-5 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedTx.map((t) => {
                const total    = (t.quantity as number) * (t.unit_price as number);
                const isIncome = t.type === "income";
                return (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 tabular-nums text-muted-foreground whitespace-nowrap">
                      {format(new Date(t.transaction_date), "d MMM yyyy")}
                    </td>
                    <td className="px-3 py-3 font-medium text-foreground max-w-[180px] truncate">
                      {t.description || "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell truncate max-w-[120px]">
                      {t.category || "—"}
                    </td>
                    <td className="px-3 py-3 capitalize text-muted-foreground">{t.type}</td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        t.status === "success"   ? "bg-emerald-100 text-emerald-700"  :
                        t.status === "pending"   ? "bg-yellow-100 text-yellow-700"    :
                        t.status === "refunded"  ? "bg-blue-100 text-blue-700"        :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold">
                      <span className={isIncome ? "text-emerald-600" : "text-red-500"}>
                        {isIncome ? "+" : "−"}{fmt(total)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, subMonths, startOfMonth, endOfMonth, differenceInDays, parseISO } from "date-fns";
import {
  ChevronRight, ChevronDown, ArrowLeft, Download,
  ChevronsUpDown, ArrowLeftRight, TrendingUp, TrendingDown,
} from "lucide-react";
import { Label as ChartLabel, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useSite } from "@/hooks/useSite";
import { useReportDateRange } from "@/hooks/useReportDateRange";
import ReportsSubNav from "@/components/reports/ReportsSubNav";
import { getTransactions } from "@/services/transactions.service";
import { getCustomers } from "@/services/customers.service";
import { fmtCurrency, fmtCompact, CURRENCY_SYMBOL } from "@/lib/formatCurrency";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import CustomerSelect from "@/components/dashboard/CustomerSelect";
import type { Transaction } from "@/lib/supabaseTypes";

// ─── Constants ────────────────────────────────────────────────────────────────

const CAT_COLORS = [
  "var(--chart-4)", "var(--chart-7)", "var(--chart-6)",
  "var(--chart-3)", "var(--chart-8)", "var(--chart-9)",
  "var(--chart-10)", "var(--chart-5)",
];

const STATUS_LABELS: Record<string, string> = {
  all: "All", success: "Success", pending: "Pending",
  refunded: "Refunded", cancelled: "Cancelled",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusDot(status: Transaction["status"]) {
  if (status === "success") return "bg-emerald-500";
  if (status === "pending") return "bg-yellow-500";
  if (status === "refunded") return "bg-blue-400";
  return "bg-muted-foreground";
}

function exportCSV(txs: Transaction[], type: "expense" | "income") {
  const rows = [
    ["Date", "Description", "Reference", "Category", "Qty", "Unit Price", "Amount", "Status"],
    ...txs.map((t) => [
      t.transaction_date, t.description ?? "", t.reference_no ?? "",
      t.category ?? "Uncategorised", t.quantity, t.unit_price,
      t.quantity * t.unit_price, t.status,
    ]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${type}-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function deltaBadge(curr: number, prev: number) {
  if (prev <= 0) return null;
  const pct = Math.round(((curr - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{pct}%
    </span>
  );
}

// ─── CategoryRow ──────────────────────────────────────────────────────────────

function CategoryRow({
  category, total, prevTotal, transactions, maxTotal, grandTotal,
  colorIndex, isOpen, onToggle, comparing,
}: {
  category: string;
  total: number;
  prevTotal?: number;
  transactions: Transaction[];
  maxTotal: number;
  grandTotal: number;
  colorIndex: number;
  isOpen: boolean;
  onToggle: () => void;
  comparing: boolean;
}) {
  const barColor = CAT_COLORS[colorIndex % CAT_COLORS.length];
  const barPct = Math.round((total / maxTotal) * 100);
  const pct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
      >
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-semibold truncate">{category}</span>
            <div className="flex items-center gap-2 shrink-0">
              {comparing && prevTotal != null && prevTotal > 0 && (
                <span className="text-sm tabular-nums text-muted-foreground line-through">
                  {fmtCompact(prevTotal)}
                </span>
              )}
              <span className="text-sm font-bold tabular-nums">{fmtCurrency(total)}</span>
              {comparing && prevTotal != null && deltaBadge(total, prevTotal)}
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, backgroundColor: barColor }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} · {pct}% of total
          </p>
        </div>
        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {isOpen && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-2.5 text-left font-medium text-muted-foreground">Description</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Qty × Unit</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((t) => {
                  const amount = t.quantity * t.unit_price;
                  return (
                    <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-medium truncate block max-w-[220px]">{t.description || "—"}</span>
                        {t.reference_no && <span className="text-xs text-muted-foreground">{t.reference_no}</span>}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground tabular-nums hidden sm:table-cell">
                        {format(new Date(t.transaction_date), "d MMM yyyy")}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground tabular-nums hidden md:table-cell">
                        {t.quantity} × {CURRENCY_SYMBOL}{fmtCompact(t.unit_price)}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDot(t.status)}`} />
                          {t.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold">{fmtCurrency(amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20">
                  <td colSpan={4} className="px-5 py-2.5 text-xs font-medium text-muted-foreground">Category total</td>
                  <td className="px-5 py-2.5 text-right text-sm font-bold tabular-nums">{fmtCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  type: "expense" | "income";
}

export default function BreakdownReportPage({ type }: Props) {
  const { activeSiteId } = useSite();
  const today = new Date();
  const isExpense = type === "expense";

  const { dateFrom, dateTo, setDateFrom, setDateTo } = useReportDateRange();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "pending" | "refunded" | "cancelled">("all");
  const [sortBy, setSortBy] = useState<"total" | "count" | "alpha">("total");
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [comparing, setComparing] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const PRESETS = [
    { label: "This month", from: format(startOfMonth(today), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") },
    { label: "Last month", from: format(startOfMonth(subMonths(today, 1)), "yyyy-MM-dd"), to: format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd") },
    { label: "3M", from: format(startOfMonth(subMonths(today, 2)), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") },
    { label: "6M", from: format(startOfMonth(subMonths(today, 5)), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") },
  ];

  // Derive prev period from the same number of days immediately before dateFrom
  const periodDays = differenceInDays(parseISO(dateTo), parseISO(dateFrom)) + 1;
  const prevFrom = format(subDays(parseISO(dateFrom), periodDays), "yyyy-MM-dd");
  const prevTo = format(subDays(parseISO(dateFrom), 1), "yyyy-MM-dd");

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions", activeSiteId, type, dateFrom, dateTo],
    queryFn: () => getTransactions(activeSiteId!, { type, dateFrom, dateTo }),
    enabled: !!activeSiteId,
  });

  const { data: prevTxs = [] } = useQuery({
    queryKey: ["transactions", activeSiteId, type, prevFrom, prevTo],
    queryFn: () => getTransactions(activeSiteId!, { type, dateFrom: prevFrom, dateTo: prevTo }),
    enabled: !!activeSiteId && comparing,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled: !!activeSiteId,
  });

  // Client-side filters
  const filteredTxs = useMemo(() => {
    let result = txs;
    if (selectedCustomerId) result = result.filter((t) => t.customer_id === selectedCustomerId);
    if (statusFilter !== "all") result = result.filter((t) => t.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) =>
        (t.description ?? "").toLowerCase().includes(q) ||
        (t.reference_no ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [txs, selectedCustomerId, statusFilter, search]);

  const filteredPrevTxs = useMemo(() => {
    let result = prevTxs;
    if (selectedCustomerId) result = result.filter((t) => t.customer_id === selectedCustomerId);
    return result;
  }, [prevTxs, selectedCustomerId]);

  // Group current period
  const grouped = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const t of filteredTxs) {
      const cat = t.category ?? "Uncategorised";
      if (!map[cat]) map[cat] = [];
      map[cat].push(t);
    }
    return Object.entries(map)
      .map(([category, items]) => ({
        category,
        transactions: [...items].sort((a, b) =>
          new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
        ),
        total: items.reduce((s, t) => s + t.quantity * t.unit_price, 0),
      }))
      .sort((a, b) => {
        if (sortBy === "count") return b.transactions.length - a.transactions.length;
        if (sortBy === "alpha") return a.category.localeCompare(b.category);
        return b.total - a.total;
      });
  }, [filteredTxs, sortBy]);

  // Group previous period for comparison
  const prevGrouped = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of filteredPrevTxs) {
      const cat = t.category ?? "Uncategorised";
      map[cat] = (map[cat] ?? 0) + t.quantity * t.unit_price;
    }
    return map;
  }, [filteredPrevTxs]);

  const grandTotal = grouped.reduce((s, g) => s + g.total, 0);
  const prevGrandTotal = filteredPrevTxs.reduce((s, t) => s + t.quantity * t.unit_price, 0);
  const maxTotal = grouped[0]?.total ?? 1;
  const allOpen = grouped.length > 0 && grouped.every((g) => openMap[g.category]);

  function toggleCategory(cat: string) {
    setOpenMap((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }
  function setAllOpen(open: boolean) {
    const map: Record<string, boolean> = {};
    grouped.forEach((g) => { map[g.category] = open; });
    setOpenMap(map);
  }

  const chartData = grouped.map((g, idx) => ({
    name: g.category,
    value: g.total,
    fill: CAT_COLORS[idx % CAT_COLORS.length],
    pct: grandTotal > 0 ? Math.round((g.total / grandTotal) * 100) : 0,
  }));
  const chartConfig = Object.fromEntries(
    grouped.map((g, idx) => [g.category, { label: g.category, color: CAT_COLORS[idx % CAT_COLORS.length] }])
  );

  if (!activeSiteId) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a site to view {isExpense ? "expense" : "income"} breakdown.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">

      <ReportsSubNav />

      {/* Header */}
      <div className="space-y-1">
        <Link to="/reports" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1">
          <ArrowLeft className="h-3 w-3" /> Reports
        </Link>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {isExpense ? "Expense Breakdown" : "Income Breakdown"}
        </h1>
        <p className="text-sm text-muted-foreground">
          All {isExpense ? "expense" : "income"} transactions grouped by category
        </p>
      </div>

      {/* Controls: presets + dates + customer + compare */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Period presets */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => {
              const active = dateFrom === p.from && dateTo === p.to;
              return (
                <button
                  key={p.label}
                  onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    active ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Customer filter */}
          <CustomerSelect
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
            value={selectedCustomerId}
            onChange={setSelectedCustomerId}
          />

          {/* Compare toggle */}
          <button
            onClick={() => setComparing((c) => !c)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              comparing ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            <ArrowLeftRight className="h-3 w-3" />
            Compare
          </button>
        </div>

        {/* Date inputs */}
        <div className="flex items-end gap-3 shrink-0">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs w-36" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs w-36" />
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 rounded-xl border border-border bg-card divide-x divide-border">
        <div className="px-5 py-4">
          <p className="text-xs text-muted-foreground">{isExpense ? "Total Expenses" : "Total Income"}</p>
          <div className="flex items-baseline gap-2 mt-1 flex-wrap">
            <p className="font-display text-2xl font-semibold tabular-nums">{fmtCurrency(grandTotal)}</p>
            {comparing && prevGrandTotal > 0 && deltaBadge(grandTotal, prevGrandTotal)}
          </div>
          {comparing && prevGrandTotal > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
              prev: {fmtCompact(prevGrandTotal)}
            </p>
          )}
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-muted-foreground">Categories</p>
          <p className="font-display text-2xl font-semibold tabular-nums mt-1">{grouped.length}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-muted-foreground">Transactions</p>
          <p className="font-display text-2xl font-semibold tabular-nums mt-1">{filteredTxs.length}</p>
        </div>
      </div>

      {/* Donut chart */}
      {!isLoading && grouped.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
            <ChartContainer config={chartConfig} className="mx-auto aspect-square h-44">
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel className="w-44" nameKey="name" />} />
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} cornerRadius={4} paddingAngle={2} strokeWidth={4}>
                  <ChartLabel
                    content={({ viewBox }) => {
                      if (!(viewBox && "cx" in viewBox && "cy" in viewBox)) return null;
                      return (
                        <text dominantBaseline="middle" textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                          <tspan className="fill-muted-foreground" fontSize={10} x={viewBox.cx} y={(viewBox.cy ?? 0) - 8}>Total</tspan>
                          <tspan className="fill-foreground font-semibold" fontSize={13} x={viewBox.cx} y={(viewBox.cy ?? 0) + 10}>
                            {fmtCompact(grandTotal)}
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex flex-col gap-2.5 min-w-0">
              {chartData.map((item) => (
                <div key={item.name} className="grid grid-cols-[1fr_auto] items-center gap-2">
                  <div className="min-w-0 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                    <p className="truncate text-sm text-muted-foreground">{item.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium text-sm tabular-nums">{item.pct}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Controls bar: search + status + sort + expand + export */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search description or ref…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs flex-1 min-w-[180px]"
        />
        <div className="flex gap-1">
          {(["all", "success", "pending", "refunded", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                statusFilter === s ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["total", "count", "alpha"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                sortBy === s ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {s === "total" ? "By Total" : s === "count" ? "By Count" : "A–Z"}
            </button>
          ))}
        </div>
        {grouped.length > 0 && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setAllOpen(!allOpen)}>
            <ChevronsUpDown className="h-3 w-3" />
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
        )}
        {filteredTxs.length > 0 && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => exportCSV(filteredTxs, type)}>
            <Download className="h-3 w-3" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Category list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            {txs.length === 0
              ? `No ${type} transactions found for this period.`
              : "No transactions match the current filters."}
          </p>
          {(search || statusFilter !== "all" || selectedCustomerId) && (
            <button
              onClick={() => { setSearch(""); setStatusFilter("all"); setSelectedCustomerId(null); }}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((g, idx) => (
            <CategoryRow
              key={g.category}
              category={g.category}
              total={g.total}
              prevTotal={comparing ? prevGrouped[g.category] : undefined}
              transactions={g.transactions}
              maxTotal={maxTotal}
              grandTotal={grandTotal}
              colorIndex={idx}
              isOpen={!!openMap[g.category]}
              onToggle={() => toggleCategory(g.category)}
              comparing={comparing}
            />
          ))}
        </div>
      )}
    </div>
  );
}

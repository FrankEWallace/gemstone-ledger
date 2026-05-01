import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ChevronRight, ChevronDown, ArrowLeft, Download, ChevronsUpDown } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";

import { useSite } from "@/hooks/useSite";
import { getTransactions } from "@/services/transactions.service";
import { fmtCurrency, fmtCompact, CURRENCY_SYMBOL } from "@/lib/formatCurrency";
import type { Transaction } from "@/lib/supabaseTypes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// ─── Constants ────────────────────────────────────────────────────────────────

const CAT_COLORS = [
  "var(--chart-cat-1)",
  "var(--chart-cat-2)",
  "var(--chart-cat-3)",
  "var(--chart-cat-4)",
  "var(--chart-cat-5)",
];

const STATUS_LABELS: Record<string, string> = {
  all: "All",
  success: "Success",
  pending: "Pending",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusDot(status: Transaction["status"]) {
  if (status === "success") return "bg-emerald-500";
  if (status === "pending") return "bg-yellow-500";
  if (status === "refunded") return "bg-blue-400";
  return "bg-muted-foreground";
}

function exportCSV(txs: Transaction[]) {
  const rows = [
    ["Date", "Description", "Reference", "Category", "Qty", "Unit Price", "Amount", "Status"],
    ...txs.map((t) => [
      t.transaction_date,
      t.description ?? "",
      t.reference_no ?? "",
      t.category ?? "Uncategorised",
      t.quantity,
      t.unit_price,
      t.quantity * t.unit_price,
      t.status,
    ]),
  ];
  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expenses-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Category row (controlled) ────────────────────────────────────────────────

function CategoryRow({
  category,
  total,
  transactions,
  maxTotal,
  grandTotal,
  colorIndex,
  isOpen,
  onToggle,
}: {
  category: string;
  total: number;
  transactions: Transaction[];
  maxTotal: number;
  grandTotal: number;
  colorIndex: number;
  isOpen: boolean;
  onToggle: () => void;
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
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold truncate">{category}</span>
            <span className="text-sm font-bold tabular-nums shrink-0">{fmtCurrency(total)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${barPct}%`, backgroundColor: barColor }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} · {pct}% of total expenses
          </p>
        </div>

        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">
                    Description
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden sm:table-cell">
                    Date
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden md:table-cell">
                    Qty × Unit
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">
                    Status
                  </th>
                  <th className="px-5 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((t) => {
                  const amount = t.quantity * t.unit_price;
                  return (
                    <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-medium truncate block max-w-[220px]">
                          {t.description || "—"}
                        </span>
                        {t.reference_no && (
                          <span className="text-[10px] text-muted-foreground">{t.reference_no}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground tabular-nums hidden sm:table-cell">
                        {format(new Date(t.transaction_date), "d MMM yyyy")}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground tabular-nums hidden md:table-cell">
                        {t.quantity} × {CURRENCY_SYMBOL}{fmtCompact(t.unit_price)}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDot(t.status)}`} />
                          {t.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold text-foreground">
                        {fmtCurrency(amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20">
                  <td colSpan={4} className="px-5 py-2.5 text-xs font-semibold text-muted-foreground">
                    Category total
                  </td>
                  <td className="px-5 py-2.5 text-right text-sm font-bold tabular-nums">
                    {fmtCurrency(total)}
                  </td>
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

export default function ExpenseBreakdownPage() {
  const { activeSiteId } = useSite();
  const today = new Date();

  // Date range
  const [dateFrom, setDateFrom] = useState(
    format(startOfMonth(subMonths(today, 5)), "yyyy-MM-dd")
  );
  const [dateTo, setDateTo] = useState(format(today, "yyyy-MM-dd"));

  // Filters + sort
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "pending" | "refunded" | "cancelled">("all");
  const [sortBy, setSortBy] = useState<"total" | "count" | "alpha">("total");

  // Expand/collapse map
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  // Date presets
  const PRESETS = [
    {
      label: "This month",
      from: format(startOfMonth(today), "yyyy-MM-dd"),
      to: format(today, "yyyy-MM-dd"),
    },
    {
      label: "Last month",
      from: format(startOfMonth(subMonths(today, 1)), "yyyy-MM-dd"),
      to: format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd"),
    },
    {
      label: "3M",
      from: format(startOfMonth(subMonths(today, 2)), "yyyy-MM-dd"),
      to: format(today, "yyyy-MM-dd"),
    },
    {
      label: "6M",
      from: format(startOfMonth(subMonths(today, 5)), "yyyy-MM-dd"),
      to: format(today, "yyyy-MM-dd"),
    },
  ];

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions", activeSiteId, "expense", dateFrom, dateTo],
    queryFn: () =>
      getTransactions(activeSiteId!, { type: "expense", dateFrom, dateTo }),
    enabled: !!activeSiteId,
  });

  // Apply search + status filter client-side
  const filteredTxs = useMemo(() => {
    let result = txs;
    if (statusFilter !== "all") result = result.filter((t) => t.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          (t.description ?? "").toLowerCase().includes(q) ||
          (t.reference_no ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [txs, statusFilter, search]);

  // Group and sort
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
        transactions: [...items].sort(
          (a, b) =>
            new Date(b.transaction_date).getTime() -
            new Date(a.transaction_date).getTime()
        ),
        total: items.reduce((s, t) => s + t.quantity * t.unit_price, 0),
      }))
      .sort((a, b) => {
        if (sortBy === "count") return b.transactions.length - a.transactions.length;
        if (sortBy === "alpha") return a.category.localeCompare(b.category);
        return b.total - a.total;
      });
  }, [filteredTxs, sortBy]);

  const grandTotal = grouped.reduce((s, g) => s + g.total, 0);
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

  if (!activeSiteId) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a site to view expense breakdown.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[960px] mx-auto">

      {/* Header */}
      <div className="space-y-1">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-1"
        >
          <ArrowLeft className="h-3 w-3" /> Dashboard
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight">Expense Breakdown</h1>
        <p className="text-sm text-muted-foreground">All expense transactions grouped by category</p>
      </div>

      {/* Date presets + date inputs */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const active = dateFrom === p.from && dateTo === p.to;
            return (
              <button
                key={p.label}
                onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-end gap-3 shrink-0">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 rounded-xl border border-border bg-card divide-x divide-border">
        <div className="px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Total Expenses</p>
          <p className="font-display text-2xl font-bold tabular-nums mt-1">{fmtCurrency(grandTotal)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Categories</p>
          <p className="font-display text-2xl font-bold tabular-nums mt-1">{grouped.length}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Transactions</p>
          <p className="font-display text-2xl font-bold tabular-nums mt-1">{filteredTxs.length}</p>
        </div>
      </div>

      {/* Donut chart — only when there's data */}
      {!isLoading && grouped.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-6 items-center">
            <div className="flex justify-center">
              <PieChart width={160} height={160}>
                <Pie
                  data={grouped.map((g) => ({ name: g.category, value: g.total }))}
                  cx={80}
                  cy={80}
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {grouped.map((g, idx) => (
                    <Cell key={g.category} fill={CAT_COLORS[idx % CAT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [fmtCurrency(v), "Amount"]}
                  contentStyle={{
                    fontSize: "11px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    color: "var(--foreground)",
                  }}
                />
              </PieChart>
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-x-6 gap-y-2">
              {grouped.map((g, idx) => (
                <div key={g.category} className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CAT_COLORS[idx % CAT_COLORS.length] }}
                  />
                  <span className="text-xs truncate flex-1 text-foreground">{g.category}</span>
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground shrink-0">
                    {fmtCurrency(g.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search description or ref..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs flex-1 min-w-[180px]"
        />

        {/* Status filter */}
        <div className="flex gap-1">
          {(["all", "success", "pending", "refunded", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                statusFilter === s
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-1">
          {(["total", "count", "alpha"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                sortBy === s
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {s === "total" ? "By Total" : s === "count" ? "By Count" : "A–Z"}
            </button>
          ))}
        </div>

        {/* Expand / collapse all */}
        {grouped.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setAllOpen(!allOpen)}
          >
            <ChevronsUpDown className="h-3 w-3" />
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
        )}

        {/* Export CSV */}
        {filteredTxs.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => exportCSV(filteredTxs)}
          >
            <Download className="h-3 w-3" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Category list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            {txs.length === 0
              ? "No expense transactions found for this period."
              : "No transactions match the current filters."}
          </p>
          {(search || statusFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setStatusFilter("all"); }}
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
              transactions={g.transactions}
              maxTotal={maxTotal}
              grandTotal={grandTotal}
              colorIndex={idx}
              isOpen={!!openMap[g.category]}
              onToggle={() => toggleCategory(g.category)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

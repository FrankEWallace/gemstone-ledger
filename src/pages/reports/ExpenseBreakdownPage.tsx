import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ChevronRight, ChevronDown, ArrowLeft } from "lucide-react";

import { useSite } from "@/hooks/useSite";
import { getTransactions } from "@/services/transactions.service";
import { fmtCurrency, fmtCompact, CURRENCY_SYMBOL } from "@/lib/formatCurrency";
import type { Transaction } from "@/lib/supabaseTypes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Chart color palette ──────────────────────────────────────────────────────

const CAT_COLORS = [
  "hsl(var(--chart-cat-1))",
  "hsl(var(--chart-cat-2))",
  "hsl(var(--chart-cat-3))",
  "hsl(var(--chart-cat-4))",
  "hsl(var(--chart-cat-5))",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusDot(status: Transaction["status"]) {
  if (status === "success") return "bg-emerald-500";
  if (status === "pending") return "bg-yellow-500";
  return "bg-muted-foreground";
}

// ─── Category row (expandable) ────────────────────────────────────────────────

function CategoryRow({
  category,
  total,
  transactions,
  maxTotal,
  colorIndex,
}: {
  category: string;
  total: number;
  transactions: Transaction[];
  maxTotal: number;
  colorIndex: number;
}) {
  const [open, setOpen] = useState(false);
  const barColor = CAT_COLORS[colorIndex % CAT_COLORS.length];
  const pct = Math.round((total / maxTotal) * 100);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Category header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
      >
        {/* Color dot */}
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: barColor }}
        />

        {/* Name + bar */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold truncate">{category}</span>
            <span className="text-sm font-bold tabular-nums shrink-0">
              {fmtCurrency(total)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: barColor }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} · {pct}% of total expenses
          </p>
        </div>

        {/* Chevron toggle */}
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded transaction list */}
      {open && (
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
                          <span className="text-[10px] text-muted-foreground">
                            {t.reference_no}
                          </span>
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

  const [dateFrom, setDateFrom] = useState(
    format(startOfMonth(subMonths(today, 5)), "yyyy-MM-dd")
  );
  const [dateTo, setDateTo] = useState(format(today, "yyyy-MM-dd"));

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions", activeSiteId, "expense", dateFrom, dateTo],
    queryFn: () =>
      getTransactions(activeSiteId!, {
        type: "expense",
        dateFrom,
        dateTo,
      }),
    enabled: !!activeSiteId,
  });

  // Group by category
  const grouped = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const t of txs) {
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
      .sort((a, b) => b.total - a.total);
  }, [txs]);

  const grandTotal = grouped.reduce((s, g) => s + g.total, 0);
  const maxTotal = grouped[0]?.total ?? 1;

  if (!activeSiteId) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a site to view expense breakdown.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[960px] mx-auto">
      {/* Back + header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> Dashboard
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Expense Breakdown
          </h1>
          <p className="text-sm text-muted-foreground">
            All expense transactions grouped by category
          </p>
        </div>

        {/* Date range */}
        <div className="flex items-end gap-3 shrink-0">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              From
            </Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              To
            </Label>
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
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Total Expenses
          </p>
          <p className="font-display text-2xl font-bold tabular-nums mt-1">
            {fmtCurrency(grandTotal)}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Categories
          </p>
          <p className="font-display text-2xl font-bold tabular-nums mt-1">
            {grouped.length}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Transactions
          </p>
          <p className="font-display text-2xl font-bold tabular-nums mt-1">
            {txs.length}
          </p>
        </div>
      </div>

      {/* Category list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground text-sm">
          No expense transactions found for this period.
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
              colorIndex={idx}
            />
          ))}
        </div>
      )}
    </div>
  );
}

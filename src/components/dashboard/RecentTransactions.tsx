import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fmtCurrency } from "@/lib/formatCurrency";
import type { Transaction } from "@/lib/supabaseTypes";

const income = "var(--chart-1)";
const expense = "var(--chart-2)";

export default function RecentTransactions({
  txs,
  isLoading,
}: {
  txs: Transaction[];
  isLoading: boolean;
}) {
  const recent = txs.slice(0, 5);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <p className="text-sm font-medium">Recent Transactions</p>
        <Link
          to="/transactions"
          className="inline-flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View all <ChevronRight className="h-3.5 w-3.5" />
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
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Category</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                recent.map((t) => {
                  const total = t.quantity * t.unit_price;
                  const isIncome = t.type === "income";
                  return (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-medium truncate block max-w-[200px]">
                          {t.description || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {t.category || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
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
                                ? "bg-success"
                                : t.status === "pending"
                                ? "bg-warning"
                                : "bg-muted-foreground"
                            }`}
                          />
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums hidden sm:table-cell">
                        {format(new Date(t.transaction_date), "d MMM")}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold">
                        <span style={{ color: isIncome ? income : expense }}>
                          {isIncome ? "+" : "−"}
                          {fmtCurrency(total)}
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

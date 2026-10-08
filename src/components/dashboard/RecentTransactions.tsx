import { Link } from "react-router-dom";
import { ChevronRight, Coins, Fuel, HardHat, Pickaxe, Receipt, Truck, Wrench, type LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { fmtCurrency } from "@/lib/formatCurrency";
import EntityAvatar from "@/components/shared/EntityAvatar";
import StatusBadge from "@/components/shared/StatusBadge";
import type { Transaction } from "@/lib/supabaseTypes";

const CATEGORY_ICONS: Array<[RegExp, LucideIcon]> = [
  [/fuel|diesel|petrol/i, Fuel],
  [/labou?r|wage|salar|crew|payroll/i, HardHat],
  [/haul|transport|logistic|freight/i, Truck],
  [/mainten|repair|equipment|spare/i, Wrench],
  [/explosive|drill|blast|extract|dig/i, Pickaxe],
];

function iconFor(t: Transaction): LucideIcon {
  if (t.type === "income") return Coins;
  const hit = CATEGORY_ICONS.find(([re]) => re.test(t.category ?? ""));
  return hit ? hit[1] : Receipt;
}

function Row({ t, customerName }: { t: Transaction; customerName: string | undefined }) {
  const total = t.quantity * t.unit_price;
  const isIncome = t.type === "income";
  const Icon = iconFor(t);
  const title = customerName ?? (t.description || t.category || (isIncome ? "Income" : "Expense"));
  const meta = [customerName ? t.description : null, t.category, format(new Date(t.transaction_date), "d MMM")]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {customerName ? (
        <EntityAvatar name={customerName} seed={t.customer_id ?? undefined} className="h-9 w-9 text-xs" />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`text-sm font-semibold tabular-nums ${isIncome ? "text-success" : ""}`}>
          {isIncome ? "+" : "−"}
          {fmtCurrency(total)}
        </span>
        <StatusBadge status={t.status} />
      </div>
    </li>
  );
}

export default function RecentTransactions({
  txs,
  isLoading,
  customerNames,
}: {
  txs: Transaction[];
  isLoading: boolean;
  customerNames: Map<string, string>;
}) {
  const recent = txs.slice(0, 5);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">Recent transactions</p>
        <Link
          to="/transactions"
          className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View all <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {recent.map((t) => (
            <Row key={t.id} t={t} customerName={t.customer_id ? customerNames.get(t.customer_id) : undefined} />
          ))}
        </ul>
      )}
    </div>
  );
}

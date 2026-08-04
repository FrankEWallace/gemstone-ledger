import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSite } from "@/hooks/useSite";
import { getTransactions } from "@/services/transactions.service";
import { getCustomers } from "@/services/customers.service";
import { fmtCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Transaction } from "@/lib/supabaseTypes";

const amountOf = (t: Transaction) => Number(t.quantity ?? 0) * Number(t.unit_price ?? 0);
const ALL = "__all__";
const UNASSIGNED = "__none__";

/** Income / expense breakdown by category, with soft filters (category + customer).
 *  Reuses the Ledger's cached transactions; unfiltered totals reconcile with the
 *  ledger header (site-wide, paid-only). */
export default function CaptureBreakdown() {
  const { type = "expense" } = useParams<{ type: "income" | "expense" }>();
  const isIncome = type === "income";
  const { activeSiteId } = useSite();

  const [cat, setCat] = useState<string>(ALL);
  const [cust, setCust] = useState<string>(ALL);

  const { data: txns = [], isLoading } = useQuery({
    queryKey: ["capture", "ledger", activeSiteId],
    queryFn: () => getTransactions(activeSiteId!),
    enabled: !!activeSiteId,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["capture", "customers-ledger", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled: !!activeSiteId,
  });
  const customerName = useMemo(
    () => Object.fromEntries(customers.map((c) => [c.id, c.name])),
    [customers],
  );

  // All paid rows of this type — the filter option lists come from here.
  const base = useMemo(
    () => txns.filter((t) => t.type === type && t.status === "success"),
    [txns, type],
  );

  const catOptions = useMemo(
    () => [...new Set(base.map((t) => t.category || "Uncategorized"))].sort((a, b) => a.localeCompare(b)),
    [base],
  );
  const custOptions = useMemo(() => {
    const ids = [...new Set(base.filter((t) => t.customer_id).map((t) => t.customer_id!))];
    return ids
      .map((id) => ({ id, name: customerName[id] ?? "Unknown" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [base, customerName]);
  const hasUnassigned = useMemo(() => base.some((t) => !t.customer_id), [base]);

  const rows = useMemo(
    () =>
      base.filter(
        (t) =>
          (cat === ALL || (t.category || "Uncategorized") === cat) &&
          (cust === ALL || (cust === UNASSIGNED ? !t.customer_id : t.customer_id === cust)),
      ),
    [base, cat, cust],
  );

  const { total, groups } = useMemo(() => {
    const by = new Map<string, number>();
    let total = 0;
    for (const t of rows) {
      const amt = amountOf(t);
      total += amt;
      const key = t.category || "Uncategorized";
      by.set(key, (by.get(key) ?? 0) + amt);
    }
    const groups = [...by.entries()]
      .map(([name, amount]) => ({ name, amount, share: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
    return { total, groups };
  }, [rows]);

  const entries = useMemo(
    () => [...rows].sort((a, b) => (a.transaction_date < b.transaction_date ? 1 : -1)).slice(0, 40),
    [rows],
  );

  const accent = isIncome ? "text-success" : "text-destructive";
  const barBg = isIncome ? "bg-success" : "bg-destructive";
  const filtered = cat !== ALL || cust !== ALL;

  return (
    <div className="p-4">
      {/* Nav row: circular back + centered title */}
      <div className="relative mb-4 flex min-h-9 items-center justify-center">
        <Link
          to="/capture"
          className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-sm"
          aria-label="Back to ledger"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="truncate px-11 text-base font-semibold">{isIncome ? "Income" : "Expense"} breakdown</h1>
      </div>

      {/* Total hero */}
      <div className="mb-4 text-center">
        <div className="text-sm text-muted-foreground">Total {isIncome ? "income" : "expense"}</div>
        <div className={cn("text-4xl font-semibold tracking-tight tabular-nums", accent)}>{fmtCurrency(total)}</div>
        <div className="text-xs text-muted-foreground">paid · {filtered ? "filtered" : "site-wide"}</div>
      </div>

      {/* Soft filters */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <FilterSelect
          value={cat}
          onChange={setCat}
          allLabel="All categories"
          options={catOptions.map((c) => ({ value: c, label: c }))}
        />
        <FilterSelect
          value={cust}
          onChange={setCust}
          allLabel="All customers"
          options={[
            ...(hasUnassigned ? [{ value: UNASSIGNED, label: "Unassigned" }] : []),
            ...custOptions.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No {isIncome ? "income" : "expense"}{filtered ? " for this filter" : " yet"}.
        </p>
      ) : (
        <>
          {/* By category with share bars — only meaningful when not already pinned to one category */}
          {cat === ALL && (
            <>
              <div className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">By category</div>
              <div className="mb-5 overflow-hidden rounded-2xl bg-card p-3 shadow-sm">
                {groups.map((g, i) => (
                  <button
                    key={g.name}
                    onClick={() => setCat(g.name)}
                    className={cn("block w-full text-left py-2.5", i > 0 && "border-t")}
                  >
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium">{g.name}</span>
                      <span className="shrink-0 text-sm font-medium tabular-nums">{fmtCurrency(g.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", barBg)} style={{ width: `${Math.max(2, g.share)}%` }} />
                      </div>
                      <span className="w-10 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                        {g.share.toFixed(0)}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Underlying entries */}
          <div className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Entries{entries.length >= 40 ? " (latest 40)" : ""}
          </div>
          <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
            {entries.map((t, i) => (
              <div key={t.id} className={cn("flex items-center justify-between gap-3 px-3 py-2.5", i > 0 && "border-t")}>
                <div className="min-w-0">
                  <div className="truncate text-sm">{t.description || t.category || (isIncome ? "Income" : "Expense")}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {t.transaction_date}
                    {t.category ? ` · ${t.category}` : ""}
                    {t.customer_id && customerName[t.customer_id] ? ` · ${customerName[t.customer_id]}` : ""}
                  </div>
                </div>
                <div className={cn("shrink-0 text-sm font-medium tabular-nums", accent)}>
                  {isIncome ? "" : "−"}{fmtCurrency(amountOf(t))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 rounded-full bg-card text-sm">
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

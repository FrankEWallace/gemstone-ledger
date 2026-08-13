import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSite } from "@/hooks/useSite";
import { getTransactions } from "@/services/transactions.service";
import { getProductionPhases } from "@/services/production-phases.service";
import { getCustomers } from "@/services/customers.service";
import { fmtCompact, fmtCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Transaction } from "@/lib/supabaseTypes";
import type { CaptureContext } from "./CaptureLayout";
import CaptureTxRow from "./CaptureTxRow";

type Segment = "phase" | "customer" | "category";
const SEGMENTS: Segment[] = ["phase", "customer", "category"];

const amountOf = (t: Transaction) => Number(t.quantity ?? 0) * Number(t.unit_price ?? 0);

export default function CaptureLedger() {
  const { activeSiteId } = useSite();
  const { openEntry } = useOutletContext<CaptureContext>();
  const [segment, setSegment] = useState<Segment>("phase");

  const { data: txns = [], isLoading } = useQuery({
    queryKey: ["capture", "ledger", activeSiteId],
    queryFn: () => getTransactions(activeSiteId!),
    enabled: !!activeSiteId,
  });
  const { data: phases = [] } = useQuery({
    queryKey: ["capture", "phases", activeSiteId],
    queryFn: () => getProductionPhases(activeSiteId!),
    enabled: !!activeSiteId,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["capture", "customers-ledger", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const phaseName = useMemo(() => Object.fromEntries(phases.map((p) => [p.id, p.name])), [phases]);
  const customerName = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c.name])), [customers]);

  const { income, expense } = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of txns) {
      if (t.status !== "success") continue;
      if (t.type === "income") income += amountOf(t);
      else if (t.type === "expense") expense += amountOf(t);
    }
    return { income, expense };
  }, [txns]);
  const net = income - expense;

  const groups = useMemo(() => {
    const keyOf = (t: Transaction) =>
      segment === "phase"
        ? t.phase_id ? phaseName[t.phase_id] ?? "Unknown phase" : "No phase"
        : segment === "customer"
        ? t.customer_id ? customerName[t.customer_id] ?? "Unknown customer" : "No customer"
        : t.category || "Uncategorized";

    const by = new Map<string, Transaction[]>();
    for (const t of txns) {
      const k = keyOf(t);
      (by.get(k) ?? by.set(k, []).get(k)!).push(t);
    }
    return [...by.entries()]
      .map(([name, rows]) => ({
        name,
        rows,
        total: rows.reduce((s, t) => s + (t.type === "income" ? amountOf(t) : -amountOf(t)), 0),
      }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [txns, segment, phaseName, customerName]);

  return (
    <div className="p-4">
      <h1 className="mb-3 text-2xl font-bold">Ledger</h1>

      <div className="grid grid-cols-3 divide-x rounded-2xl bg-card shadow-sm p-3 text-center">
        <Stat to="/capture/breakdown/income" label="Income" value={fmtCompact(income)} className="text-success" />
        <Stat to="/capture/breakdown/expense" label="Expense" value={fmtCompact(expense)} className="text-destructive" />
        <Stat label="Net" value={fmtCompact(Math.abs(net))} className={net < 0 ? "text-destructive" : "text-success"} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
        {SEGMENTS.map((s) => (
          <button
            key={s}
            onClick={() => setSegment(s)}
            className={cn(
              "rounded-full py-1.5 text-sm capitalize transition-colors",
              segment === s ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {isLoading ? (
          [...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)
        ) : txns.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No entries yet. Tap + to add one.</p>
        ) : (
          groups.map((g) => (
            <section key={g.name}>
              <div className="mb-1 flex items-center justify-between gap-3 px-1">
                <span className="truncate text-xs font-medium text-muted-foreground">{g.name}</span>
                <span className={cn("shrink-0 text-xs font-medium tabular-nums", g.total < 0 ? "text-destructive" : "text-success")}>
                  {fmtCurrency(Math.abs(g.total))}
                </span>
              </div>
              <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
                {g.rows.map((t, i) => (
                  <CaptureTxRow
                    key={t.id}
                    t={t}
                    first={i === 0}
                    onEdit={openEntry}
                    formatAmount={fmtCurrency}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ to, label, value, className }: { to?: string; label: string; value: string; className?: string }) {
  const inner = (
    <>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm font-medium tabular-nums", className)}>{value}</div>
    </>
  );
  return to ? (
    <Link to={to} className="px-1 transition-transform active:scale-95">{inner}</Link>
  ) : (
    <div className="px-1">{inner}</div>
  );
}

import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { ChevronLeft } from "lucide-react";
import { useSite } from "@/hooks/useSite";
import { getCustomers } from "@/services/customers.service";
import { getTransactions } from "@/services/transactions.service";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import type { Transaction } from "@/lib/supabaseTypes";

const amountOf = (t: Transaction) => Number(t.quantity ?? 0) * Number(t.unit_price ?? 0);
const grp = (n: number) => Math.round(Math.abs(n)).toLocaleString("en-US");

export default function CaptureCustomerReport() {
  const { id = "" } = useParams();
  const { activeSiteId } = useSite();

  const { data: customers = [] } = useQuery({
    queryKey: ["capture", "customers-page", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled: !!activeSiteId,
  });
  const customer = customers.find((c) => c.id === id);

  const { data: txns = [], isLoading } = useQuery({
    queryKey: ["capture", "customer-txns", activeSiteId, id],
    queryFn: () => getTransactions(activeSiteId!, { customerId: id }),
    enabled: !!activeSiteId && !!id,
  });

  const stats = useMemo(() => {
    let income = 0, expense = 0, pending = 0;
    for (const t of txns) {
      const amt = amountOf(t);
      // "Pending" = receivables owed by the customer, i.e. pending income only
      // (matches the Swift app; a pending expense is our unsettled cost, not their debt).
      if (t.status === "pending" && t.type === "income") pending += amt;
      if (t.status !== "success") continue;
      if (t.type === "income") income += amt;
      else if (t.type === "expense") expense += amt;
    }
    return { income, expense, pending, net: income - expense };
  }, [txns]);

  const contract = useMemo(() => {
    if (!customer?.daily_rate || !customer.contract_start) return null;
    const rate = Number(customer.daily_rate);
    const start = parseISO(customer.contract_start);
    const end = customer.contract_end ? parseISO(customer.contract_end) : null;
    const today = new Date();
    const totalDays = end ? differenceInCalendarDays(end, start) + 1 : null;
    const elapsed = Math.max(0, differenceInCalendarDays(end && end < today ? end : today, start) + 1);
    const daysRemaining = end ? Math.max(0, differenceInCalendarDays(end, today)) : null;
    const value = totalDays != null ? totalDays * rate : elapsed * rate;
    const progress = totalDays ? Math.min(100, (elapsed / totalDays) * 100) : null;
    return { rate, daysRemaining, value, progress };
  }, [customer]);

  const recent = useMemo(
    () => [...txns].sort((a, b) => (a.transaction_date < b.transaction_date ? 1 : -1)).slice(0, 20),
    [txns],
  );

  return (
    <div className="p-4">
      {/* Nav row: circular back + centered name (matches the native app) */}
      <div className="relative mb-4 flex min-h-9 items-center justify-center">
        <Link
          to="/capture/customers"
          className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-sm"
          aria-label="Back to customers"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="truncate px-11 text-base font-semibold">{customer?.name ?? "Customer"}</h1>
      </div>

      {/* Net position hero — plain, centered, no card (matches the native app) */}
      <div className="mb-8 mt-6 text-center">
        <div className="text-sm text-muted-foreground">Net position</div>
        <div className={cn("mt-1 text-4xl font-semibold tracking-tight tabular-nums", stats.net < 0 ? "text-destructive" : "text-success")}>
          {grp(stats.net)}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">TZS</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {customer?.type && <span className="capitalize">{customer.type}</span>}
          {customer?.contact_phone ? ` · ${customer.contact_phone}` : ""}
        </div>
      </div>

      {/* Income / Expense / Pending */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Income" value={grp(stats.income)} className="text-success" />
        <MiniStat label="Expense" value={grp(stats.expense)} className="text-destructive" />
        <MiniStat label="Pending" value={grp(stats.pending)} className="text-warning" />
      </div>

      {contract && (
        <div className="mt-4 rounded-2xl bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Contract</span>
            <span className="text-sm text-muted-foreground">{grp(contract.rate)} / day</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-medium tabular-nums">{grp(contract.value)}</span>
            {contract.daysRemaining != null && (
              <span className="text-xs text-muted-foreground">{contract.daysRemaining} days left</span>
            )}
          </div>
          {contract.progress != null && <Progress value={contract.progress} className="mt-2 h-1.5" />}
        </div>
      )}

      {/* Recent — header inside the card */}
      <div className="mt-4 rounded-2xl bg-card p-4 shadow-sm">
        <div className="mb-1 text-base font-semibold">Recent</div>
        {isLoading ? (
          <div className="space-y-2 pt-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
        ) : recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          recent.map((t, i) => (
            <div key={t.id} className={cn("flex items-center justify-between gap-3 py-2.5", i > 0 && "border-t")}>
              <div className="min-w-0">
                <div className="truncate text-sm">{t.description || t.category || (t.type === "income" ? "Income" : "Expense")}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {t.transaction_date}{t.status !== "success" ? " · pending" : ""}
                </div>
              </div>
              <div className={cn("shrink-0 text-sm font-medium tabular-nums", t.type === "income" ? "text-success" : "text-destructive")}>
                {grp(amountOf(t))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-2xl bg-card px-3 py-4 shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1.5 text-lg font-medium tabular-nums", className)}>{value}</div>
    </div>
  );
}

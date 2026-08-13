import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo";
import { updateTransactionStatus } from "@/services/transactions.service";
import type { Transaction, TransactionStatus } from "@/lib/supabaseTypes";

const amountOf = (t: Transaction) => Number(t.quantity ?? 0) * Number(t.unit_price ?? 0);

/**
 * A tappable transaction row for the simple-capture lists. The row opens the
 * entry pad in edit mode; the status pill flips Paid/Pending inline without
 * opening the pad. Optimistically patches every ["capture", …] query.
 */
export default function CaptureTxRow({
  t,
  first,
  onEdit,
  formatAmount,
  className,
}: {
  t: Transaction;
  first: boolean;
  onEdit: (t: Transaction) => void;
  /** Row-specific amount formatter (Ledger shows the currency, reports show a bare number). */
  formatAmount: (n: number) => string;
  /** Extra classes — e.g. `px-0` when the parent card already provides padding. */
  className?: string;
}) {
  const qc = useQueryClient();

  const { mutate, isPending } = useMutation<
    void,
    Error,
    TransactionStatus,
    { snaps: { key: readonly unknown[]; data: unknown }[] }
  >({
    mutationFn: async (status) => {
      if (isDemoMode()) return;
      await updateTransactionStatus(t.id, status);
    },
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: ["capture"] });
      const keys = qc.getQueryCache().findAll({ queryKey: ["capture"] });
      const snaps = keys.map((q) => ({ key: q.queryKey, data: q.state.data }));
      keys.forEach((q) => {
        qc.setQueryData(q.queryKey, (old: unknown) =>
          Array.isArray(old)
            ? old.map((x) =>
                x && typeof x === "object" && (x as Transaction).id === t.id ? { ...x, status } : x,
              )
            : old,
        );
      });
      return { snaps };
    },
    onError: (err, _status, context) => {
      context?.snaps.forEach(({ key, data }) => qc.setQueryData(key, data));
      toast.error(err.message);
    },
    onSuccess: () => {
      if (!isDemoMode()) qc.invalidateQueries({ queryKey: ["capture"] });
    },
  });

  const paid = t.status === "success";
  const title = t.description || t.category || (t.type === "income" ? "Income" : "Expense");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(t)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(t);
        }
      }}
      className={cn(
        "flex cursor-pointer items-center justify-between gap-2.5 px-3 py-2.5 text-left transition-colors active:bg-muted/60",
        !first && "border-t",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{t.transaction_date}</div>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={(e) => {
          e.stopPropagation();
          mutate(paid ? "pending" : "success");
        }}
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50",
          paid ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
        )}
        aria-label={paid ? "Mark pending" : "Mark paid"}
      >
        {paid ? "Paid" : "Pending"}
      </button>
      <div
        className={cn(
          "shrink-0 text-sm font-medium tabular-nums",
          t.type === "income" ? "text-success" : "text-destructive",
        )}
      >
        {formatAmount(amountOf(t))}
      </div>
    </div>
  );
}

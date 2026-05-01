import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, differenceInDays, parseISO } from "date-fns";
import { Activity, Plus, CheckCircle2, Package } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import { getCustomers, updateCustomer } from "@/services/customers.service";
import { UseInventoryModal } from "@/pages/transactions/TransactionActions";
import { createTransaction } from "@/services/transactions.service";
import { getExpenseCategories } from "@/services/expense-categories.service";
import { getCustomerSummaries } from "@/services/reports.service";
import type { CustomerSummary } from "@/services/reports.service";
import type { Customer } from "@/lib/supabaseTypes";
import { fmtCompact } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TODAY = format(new Date(), "yyyy-MM-dd");

const C = {
  income:  "var(--chart-income)",
  expense: "var(--chart-expense)",
} as const;

// ─── QuickTxModal ─────────────────────────────────────────────────────────────

function QuickTxModal({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const { activeSiteId } = useSite();
  const { userProfile, orgId } = useAuth();
  const queryClient = useQueryClient();

  const [txType, setTxType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(TODAY);
  const [status, setStatus] = useState<"success" | "pending">("success");

  const { data: allCategories = [] } = useQuery({
    queryKey: ["expense-categories", orgId],
    queryFn: () => getExpenseCategories(orgId!),
    enabled: !!orgId,
  });

  const categories = allCategories.filter((c) => c.type === txType);

  function handleTypeChange(type: "income" | "expense") {
    setTxType(type);
    setCategoryId(""); // reset when type switches
  }

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      createTransaction(
        activeSiteId!,
        {
          type: txType,
          quantity: 1,
          unit_price: parseFloat(amount),
          description: description || undefined,
          transaction_date: date,
          status,
          customer_id: customer.id,
          source: "manual",
          expense_category_id: categoryId || null,
        },
        userProfile?.id
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", activeSiteId] });
      queryClient.invalidateQueries({ queryKey: ["activity-summaries", activeSiteId] });
      toast.success("Transaction added");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const valid = !!amount && parseFloat(amount) > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <p className="text-sm text-muted-foreground">{customer.name}</p>
        </DialogHeader>

        {/* Income / Expense toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => handleTypeChange("income")}
            className={cn("flex-1 py-2 text-sm font-medium transition-colors", txType !== "income" && "text-muted-foreground hover:bg-muted")}
            style={txType === "income" ? { backgroundColor: C.income, color: "#fff" } : undefined}
          >
            Income
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange("expense")}
            className={cn("flex-1 py-2 text-sm font-medium transition-colors border-l border-border", txType !== "expense" && "text-muted-foreground hover:bg-muted")}
            style={txType === "expense" ? { backgroundColor: C.expense, color: "#fff" } : undefined}
          >
            Expense
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="qt-amount">Amount *</Label>
            <Input
              id="qt-amount"
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="qt-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="qt-category">
                <SelectValue placeholder="Select category…" />
              </SelectTrigger>
              <SelectContent>
                {categories.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    No {txType} categories found
                  </SelectItem>
                ) : (
                  categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="qt-desc">Description</Label>
            <Input
              id="qt-desc"
              placeholder="Optional"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="qt-date">Date</Label>
            <Input
              id="qt-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="qt-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "success" | "pending")}
            >
              <SelectTrigger id="qt-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={!valid || isPending}
            onClick={() => mutate()}
          >
            {isPending ? "Saving…" : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── CloseActivityModal ───────────────────────────────────────────────────────

function CloseActivityModal({
  customer,
  summary,
  onClose,
}: {
  customer: Customer;
  summary: CustomerSummary | undefined;
  onClose: () => void;
}) {
  const { activeSiteId } = useSite();
  const queryClient = useQueryClient();
  const [endDate, setEndDate] = useState(TODAY);

  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpenses = summary?.totalExpenses ?? 0;
  const net = totalIncome - totalExpenses;

  const daysActive =
    customer.contract_start && endDate
      ? differenceInDays(new Date(endDate), parseISO(customer.contract_start))
      : null;

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      updateCustomer(customer.id, { contract_end: endDate, status: "completed" }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["activity-customers", activeSiteId] });
      const prev = queryClient.getQueryData<Customer[]>(["activity-customers", activeSiteId]);
      queryClient.setQueryData<Customer[]>(
        ["activity-customers", activeSiteId],
        (old) => (old ?? []).filter((c) => c.id !== customer.id)
      );
      return { prev };
    },
    onError: (_err: Error, _vars, ctx) => {
      if (ctx?.prev)
        queryClient.setQueryData(["activity-customers", activeSiteId], ctx.prev);
      toast.error("Failed to close activity");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", activeSiteId] });
      queryClient.invalidateQueries({ queryKey: ["activity-summaries", activeSiteId] });
      toast.success(`${customer.name} activity closed`);
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Close Activity</DialogTitle>
          <p className="text-sm text-muted-foreground">{customer.name}</p>
        </DialogHeader>

        {customer.contact_name && (
          <p className="text-xs text-muted-foreground -mt-2">{customer.contact_name}</p>
        )}

        {/* End date */}
        <div className="space-y-1.5">
          <Label htmlFor="ca-end">End Date</Label>
          <Input
            id="ca-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          {customer.contract_start && (
            <p className="text-xs text-muted-foreground">
              Active since{" "}
              {format(parseISO(customer.contract_start), "MMM d, yyyy")}
              {daysActive !== null && daysActive >= 0 && ` · ${daysActive} day${daysActive !== 1 ? "s" : ""}`}
            </p>
          )}
        </div>

        {/* Period totals */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Income</span>
            <span className="font-semibold" style={{ color: C.income }}>{fmtCompact(totalIncome)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Expenses</span>
            <span className="font-semibold" style={{ color: C.expense }}>{fmtCompact(totalExpenses)}</span>
          </div>
          <div className="flex justify-between items-center border-t border-border pt-2">
            <span className="font-medium">Net</span>
            <span className="font-bold" style={{ color: net >= 0 ? C.income : C.expense }}>
              {net < 0 ? "−" : ""}
              {fmtCompact(Math.abs(net))}
            </span>
          </div>
        </div>

        {net < 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
            Expenses exceed income for this period.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={isPending} onClick={() => mutate()}>
            {isPending ? "Closing…" : "Confirm & Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── ActivityPage ─────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const { activeSiteId } = useSite();
  const { userProfile } = useAuth();

  const [quickTxCustomer, setQuickTxCustomer] = useState<Customer | null>(null);
  const [closeCustomer, setCloseCustomer] = useState<Customer | null>(null);
  const [useInvCustomer, setUseInvCustomer] = useState<Customer | null>(null);

  const { data: activeCustomers = [], isLoading } = useQuery({
    queryKey: ["activity-customers", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled: !!activeSiteId,
    select: (data) => data.filter((c) => c.status === "active"),
  });

  const { data: summaries = [] } = useQuery({
    queryKey: ["activity-summaries", activeSiteId],
    queryFn: () => getCustomerSummaries(activeSiteId!, "2000-01-01", TODAY),
    enabled: !!activeSiteId,
  });

  const summaryMap = Object.fromEntries(summaries.map((s) => [s.customerId, s]));

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Activity</h1>
          {!isLoading && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeCustomers.length} active customer
              {activeCustomers.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-border animate-pulse bg-muted/40"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && activeCustomers.length === 0 && (
        <EmptyState
          icon={Activity}
          title="No active customers"
          description="Customers with status 'active' will appear here for quick transaction entry and activity closing."
        />
      )}

      {/* Customer cards */}
      {!isLoading && (
        <div className="space-y-3">
          {activeCustomers.map((customer) => {
            const summary = summaryMap[customer.id];
            const income = summary?.totalIncome ?? 0;
            const expenses = summary?.totalExpenses ?? 0;
            const net = income - expenses;
            const daysActive =
              customer.contract_start
                ? differenceInDays(new Date(), parseISO(customer.contract_start))
                : null;

            return (
              <div
                key={customer.id}
                className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                {/* Identity */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm truncate">
                      {customer.name}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide",
                        customer.type === "internal"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {customer.type}
                    </span>
                  </div>
                  {customer.contact_name && (
                    <p className="text-xs text-muted-foreground">
                      {customer.contact_name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {customer.contract_start
                      ? `Started ${format(parseISO(customer.contract_start), "MMM d, yyyy")} · Day ${daysActive}`
                      : "No start date recorded"}
                  </p>
                </div>

                {/* Financials */}
                <div className="flex gap-5 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                      Income
                    </p>
                    <p className="font-semibold" style={{ color: C.income }}>
                      {fmtCompact(income)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                      Expenses
                    </p>
                    <p className="font-semibold" style={{ color: C.expense }}>
                      {fmtCompact(expenses)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                      Net
                    </p>
                    <p className="font-bold" style={{ color: net >= 0 ? C.income : C.expense }}>
                      {net < 0 ? "−" : ""}
                      {fmtCompact(Math.abs(net))}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuickTxCustomer(customer)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Transaction
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-blue-600 border-blue-200"
                    onClick={() => setUseInvCustomer(customer)}
                  >
                    <Package className="h-3.5 w-3.5 mr-1" />
                    Use Inventory
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-muted-foreground"
                    onClick={() => setCloseCustomer(customer)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Close Activity
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {quickTxCustomer && (
        <QuickTxModal
          customer={quickTxCustomer}
          onClose={() => setQuickTxCustomer(null)}
        />
      )}
      {closeCustomer && (
        <CloseActivityModal
          customer={closeCustomer}
          summary={summaryMap[closeCustomer.id]}
          onClose={() => setCloseCustomer(null)}
        />
      )}
      {useInvCustomer && (
        <UseInventoryModal
          open
          onClose={() => setUseInvCustomer(null)}
          siteId={activeSiteId!}
          userId={userProfile?.id}
          customers={activeCustomers.map((c) => ({ id: c.id, name: c.name }))}
          defaultCustomerId={useInvCustomer.id}
        />
      )}
    </div>
  );
}

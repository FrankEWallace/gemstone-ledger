import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, Upload, Trash2, ArrowUpCircle, ArrowDownCircle, RefreshCw, ChevronDown, Package } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fmtCurrency, CURRENCY_SYMBOL } from "@/lib/formatCurrency";
import { Input } from "@/components/ui/input";

import { useSite } from "@/hooks/useSite";
import { useAuth } from "@/hooks/useAuth";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Transaction, TransactionType, TransactionStatus } from "@/lib/supabaseTypes";
import {
  getTransactions,
  getTransactionCategories,
  createTransaction,
  updateTransactionStatus,
  deleteTransaction,
  type TransactionPayload,
} from "@/services/transactions.service";
import { getCustomers } from "@/services/customers.service";
import CsvImportModal, { type CsvColumn } from "@/components/shared/CsvImportModal";
import {
  RecordPaymentModal,
  RecordExpenseModal,
  UseInventoryModal,
} from "./TransactionActions";

// ─── Chart colors (matches Dashboard palette) ─────────────────────────────────

const C = {
  income:  "var(--chart-income)",
  expense: "var(--chart-expense)",
  net:     "var(--chart-net)",
} as const;

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPES: TransactionType[] = ["income", "expense", "refund"];
const STATUSES: TransactionStatus[] = ["success", "pending", "refunded", "cancelled"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function typeIcon(type: TransactionType) {
  if (type === "income") return <ArrowUpCircle className="h-3.5 w-3.5" style={{ color: C.income }} />;
  if (type === "expense") return <ArrowDownCircle className="h-3.5 w-3.5" style={{ color: C.expense }} />;
  return <RefreshCw className="h-3.5 w-3.5" style={{ color: C.net }} />;
}

function statusBadge(status: TransactionStatus) {
  const map: Record<TransactionStatus, string> = {
    success:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    pending:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    refunded:  "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[status]}`}>
      {status}
    </span>
  );
}

function exportCSV(txs: Transaction[], customerMap: Map<string, string>) {
  const header = "Date,Reference,Description,Category,Customer,Type,Status,Qty,Unit Price,Total";
  const rows = txs.map((t) =>
    [
      t.transaction_date,
      t.reference_no ?? "",
      `"${(t.description ?? "").replace(/"/g, '""')}"`,
      t.category ?? "",
      `"${customerMap.get(t.customer_id ?? "") ?? ""}"`,
      t.type,
      t.status,
      t.quantity,
      t.unit_price,
      (t.quantity * t.unit_price).toFixed(2),
    ].join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "transactions.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Status Update Popover ────────────────────────────────────────────────────

function StatusSelect({ tx }: { tx: Transaction }) {
  const queryClient = useQueryClient();
  const { activeSiteId } = useSite();

  const { mutate } = useMutation({
    mutationFn: (status: TransactionStatus) => updateTransactionStatus(tx.id, status),
    onMutate: async (newStatus: TransactionStatus) => {
      await queryClient.cancelQueries({ queryKey: ["transactions", activeSiteId] });
      const keys = queryClient
        .getQueryCache()
        .findAll({ queryKey: ["transactions", activeSiteId] });
      const snapshots = keys.map((q) => ({ key: q.queryKey, data: q.state.data }));
      keys.forEach((q) => {
        queryClient.setQueryData<Transaction[]>(q.queryKey, (old) =>
          old?.map((t) => (t.id === tx.id ? { ...t, status: newStatus } : t)) ?? []
        );
      });
      return { snapshots };
    },
    onError: (err: Error, _status, context) => {
      context?.snapshots.forEach(({ key, data }) => {
        queryClient.setQueryData(key, data);
      });
      toast.error(err.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", activeSiteId] });
      toast.success("Status updated.");
    },
  });

  return (
    <Select value={tx.status} onValueChange={(v) => mutate(v as TransactionStatus)}>
      <SelectTrigger className="h-7 text-xs w-28 border-0 shadow-none focus:ring-0 p-1">
        <SelectValue>{statusBadge(tx.status)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {statusBadge(s)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const { activeSiteId } = useSite();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const txCsvColumns: CsvColumn<TransactionPayload>[] = [
    { header: "Description",      key: "description" },
    { header: "Reference No",     key: "reference_no" },
    { header: "Category",         key: "category" },
    { header: "Type",             key: "type",             required: true, transform: (v) => { if (!["income","expense","refund"].includes(v)) throw new Error("must be income/expense/refund"); return v as TransactionType; } },
    { header: "Status",           key: "status",           required: true, transform: (v) => { if (!["success","pending","refunded","cancelled"].includes(v)) throw new Error("must be success/pending/refunded/cancelled"); return v as TransactionStatus; } },
    { header: "Quantity",         key: "quantity",         required: true, transform: (v) => { const n = Number(v); if (isNaN(n) || n < 1) throw new Error("must be ≥ 1"); return n; } },
    { header: "Unit Price",       key: "unit_price",       required: true, transform: (v) => { const n = Number(v); if (isNaN(n)) throw new Error("not a number"); return n; } },
    { header: "Transaction Date", key: "transaction_date", required: true, transform: (v) => { if (!v) throw new Error("required"); return v; } },
  ];

  async function handleTxCsvImport(rows: Record<string, unknown>[]) {
    for (const row of rows) {
      await createTransaction(activeSiteId!, row as TransactionPayload, user?.id);
    }
    queryClient.invalidateQueries({ queryKey: ["transactions", activeSiteId] });
    queryClient.invalidateQueries({ queryKey: ["tx-categories", activeSiteId] });
  }

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", activeSiteId, typeFilter, statusFilter, categoryFilter, customerFilter, dateFrom, dateTo],
    queryFn: () =>
      getTransactions(activeSiteId!, {
        type: typeFilter,
        status: statusFilter,
        category: categoryFilter,
        customerId: customerFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    enabled: !!activeSiteId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["tx-categories", activeSiteId],
    queryFn: () => getTransactionCategories(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const customerMap = new Map(customers.map((c) => [c.id, c.name]));

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["transactions", activeSiteId] });
      const keys = queryClient
        .getQueryCache()
        .findAll({ queryKey: ["transactions", activeSiteId] });
      const snapshots = keys.map((q) => ({ key: q.queryKey, data: q.state.data }));
      keys.forEach((q) => {
        queryClient.setQueryData<Transaction[]>(q.queryKey, (old) =>
          old?.filter((t) => t.id !== id) ?? []
        );
      });
      setDeleteTarget(null);
      return { snapshots };
    },
    onError: (err: Error, _id, context) => {
      context?.snapshots.forEach(({ key, data }) => {
        queryClient.setQueryData(key, data);
      });
      toast.error(err.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", activeSiteId] });
      toast.success("Transaction deleted.");
    },
  });

  const totalIncome = transactions
    .filter((t) => t.type === "income" && t.status === "success")
    .reduce((sum, t) => sum + t.quantity * t.unit_price, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === "expense" && t.status === "success")
    .reduce((sum, t) => sum + t.quantity * t.unit_price, 0);

  // Running balance: sort oldest-first, accumulate, then reverse for display
  const sortedAsc = [...transactions].sort(
    (a, b) => a.transaction_date.localeCompare(b.transaction_date)
  );
  let runningBalance = 0;
  const txWithBalance = sortedAsc
    .map((t) => {
      const amount = t.quantity * t.unit_price;
      if (t.type === "income" && t.status !== "cancelled") runningBalance += amount;
      else if (t.type === "expense" && t.status !== "cancelled") runningBalance -= amount;
      return { ...t, _balance: runningBalance };
    })
    .reverse();

  const columns: DataTableColumn<(typeof txWithBalance)[number]>[] = [
    {
      key: "transaction_date",
      header: "Date",
      sortable: true,
      render: (val) => format(new Date(String(val)), "MMM d, yyyy"),
    },
    {
      key: "reference_no",
      header: "Ref #",
      render: (val) => <span className="font-mono text-xs">{String(val || "—")}</span>,
    },
    {
      key: "description",
      header: "Description",
      sortable: true,
      render: (_, row) => {
        const typeColor = row.type === "income" ? C.income : row.type === "expense" ? C.expense : undefined;
        return (
          <div>
            <p className="font-medium" style={{ color: typeColor }}>{row.description || "—"}</p>
            {row.category && (
              <p className="text-xs text-muted-foreground">{row.category}</p>
            )}
          </div>
        );
      },
    },
    {
      key: "customer_id",
      header: "Customer",
      render: (val) => {
        const name = val ? customerMap.get(String(val)) : null;
        return <span className="text-xs text-muted-foreground">{name ?? "—"}</span>;
      },
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (val) => (
        <div className="flex items-center gap-1.5 capitalize">
          {typeIcon(val as TransactionType)}
          {String(val)}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (_, row) => <StatusSelect tx={row as unknown as Transaction} />,
    },
    {
      key: "unit_price",
      header: "Total",
      sortable: true,
      className: "text-right",
      render: (_, row) => {
        const total = (row.quantity as number) * (row.unit_price as number);
        const isIncome = row.type === "income";
        return (
          <span className="tabular-nums font-medium" style={{ color: isIncome ? C.income : C.expense }}>
            {CURRENCY_SYMBOL} {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      key: "_balance" as keyof (typeof txWithBalance)[number],
      header: "Balance",
      className: "text-right",
      render: (val) => {
        const n = Number(val);
        return (
          <span className="tabular-nums text-xs font-medium" style={{ color: n >= 0 ? C.income : C.expense }}>
            {fmtCurrency(Math.abs(n))}
          </span>
        );
      },
    },
    {
      key: "id",
      header: "",
      className: "w-10 text-right",
      render: (_, row) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => setDeleteTarget(row as unknown as Transaction)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Transactions</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(transactions, customerMap)}>
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" />
            Import CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Add
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setPaymentOpen(true)}>
                <ArrowUpCircle className="h-4 w-4 mr-2" style={{ color: C.income }} />
                Record Payment
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setInventoryOpen(true)}>
                <Package className="h-4 w-4 mr-2" style={{ color: C.net }} />
                Use Inventory
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExpenseOpen(true)}>
                <ArrowDownCircle className="h-4 w-4 mr-2" style={{ color: C.expense }} />
                Record Expense
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border p-4 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: C.income }} />
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold pt-0.5">Collected Income</p>
          <p className="text-xl font-bold mt-1" style={{ color: C.income }}>
            {fmtCurrency(totalIncome)}
          </p>
          <p className="text-[11px] text-muted-foreground">success status only</p>
        </div>
        <div className="rounded-lg border border-border p-4 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: C.expense }} />
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold pt-0.5">Total Expenses</p>
          <p className="text-xl font-bold mt-1" style={{ color: C.expense }}>
            {fmtCurrency(totalExpenses)}
          </p>
          <p className="text-[11px] text-muted-foreground">success status only</p>
        </div>
        <div className="rounded-lg border border-border p-4 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: C.net }} />
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold pt-0.5">Net Profit</p>
          <p className="text-xl font-bold mt-1" style={{ color: totalIncome - totalExpenses >= 0 ? C.income : C.expense }}>
            {fmtCurrency(totalIncome - totalExpenses)}
          </p>
          <p className="text-[11px] text-muted-foreground">income − expenses</p>
        </div>
        <div className="rounded-lg border border-border p-4 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-foreground/20" />
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold pt-0.5">Running Balance</p>
          <p className="text-xl font-bold mt-1 tabular-nums" style={{ color: (txWithBalance[0]?._balance ?? 0) >= 0 ? C.income : C.expense }}>
            {fmtCurrency(Math.abs(txWithBalance[0]?._balance ?? 0))}
          </p>
          <p className="text-[11px] text-muted-foreground">all transactions incl. pending</p>
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={txWithBalance as unknown as Record<string, unknown>[]}
        columns={columns as DataTableColumn<Record<string, unknown>>[]}
        keyField="id"
        searchable
        searchPlaceholder="Search description or ref…"
        searchKeys={["description", "reference_no", "category"]}
        pageSize={15}
        isLoading={isLoading}
        emptyMessage="No transactions match the current filters."
        toolbar={
          <>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-36 text-xs"
              title="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-36 text-xs"
              title="To date"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="h-9 px-2.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
              >
                Clear dates
              </button>
            )}
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TransactionType | "all")}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TransactionStatus | "all")}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {categories.length > 0 && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {customers.length > 0 && (
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        }
      />

      {/* CSV Import */}
      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entityName="Transactions"
        columns={txCsvColumns as CsvColumn<Record<string, unknown>>[]}
        onImport={handleTxCsvImport}
        templateHeaders="Description,Reference No,Category,Type,Status,Quantity,Unit Price,Transaction Date"
        exampleRow='Diesel fuel,INV-001,Fuel,expense,success,1,450.00,2026-03-15'
      />

      {/* Action Modals */}
      <RecordPaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        siteId={activeSiteId!}
        userId={user?.id}
        customers={customers}
        transactions={transactions}
      />
      <RecordExpenseModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        siteId={activeSiteId!}
        userId={user?.id}
        transactions={transactions}
      />
      <UseInventoryModal
        open={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        siteId={activeSiteId!}
        userId={user?.id}
        customers={customers}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.description}" — this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && doDelete(deleteTarget.id)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Download, Upload, Trash2, ArrowUpCircle, ArrowDownCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { useSite } from "@/hooks/useSite";
import { useAuth } from "@/hooks/useAuth";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import type { Transaction, TransactionType, TransactionStatus } from "@/lib/supabaseTypes";
import {
  getTransactions,
  getTransactionCategories,
  createTransaction,
  updateTransactionStatus,
  deleteTransaction,
  type TransactionPayload,
} from "@/services/transactions.service";
import CsvImportModal, { type CsvColumn } from "@/components/shared/CsvImportModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPES: TransactionType[] = ["income", "expense", "refund"];
const STATUSES: TransactionStatus[] = ["success", "pending", "refunded", "cancelled"];

// ─── Schema ──────────────────────────────────────────────────────────────────

const txSchema = z.object({
  description: z.string().min(1, "Description is required"),
  reference_no: z.string().optional(),
  category: z.string().optional(),
  type: z.enum(["income", "expense", "refund"]),
  status: z.enum(["success", "pending", "refunded", "cancelled"]),
  quantity: z.coerce.number().min(1, "Must be ≥ 1"),
  unit_price: z.coerce.number().min(0, "Must be ≥ 0"),
  transaction_date: z.string().min(1, "Date is required"),
});

type TxFormValues = z.infer<typeof txSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function typeIcon(type: TransactionType) {
  if (type === "income") return <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" />;
  if (type === "expense") return <ArrowDownCircle className="h-3.5 w-3.5 text-red-500" />;
  return <RefreshCw className="h-3.5 w-3.5 text-yellow-500" />;
}

function statusBadge(status: TransactionStatus) {
  const map: Record<TransactionStatus, string> = {
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    refunded: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[status]}`}>
      {status}
    </span>
  );
}

function exportCSV(txs: Transaction[]) {
  const header = "Date,Reference,Description,Category,Type,Status,Qty,Unit Price,Total";
  const rows = txs.map((t) =>
    [
      t.transaction_date,
      t.reference_no ?? "",
      `"${t.description ?? ""}"`,
      t.category ?? "",
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

// ─── Add Transaction Modal ────────────────────────────────────────────────────

interface AddTxModalProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  userId?: string;
}

function AddTransactionModal({ open, onClose, siteId, userId }: AddTxModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<TxFormValues>({
    resolver: zodResolver(txSchema),
    defaultValues: {
      description: "",
      reference_no: "",
      category: "",
      type: "income",
      status: "pending",
      quantity: 1,
      unit_price: 0,
      transaction_date: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: TxFormValues) =>
      createTransaction(
        siteId,
        {
          description: values.description,
          reference_no: values.reference_no || undefined,
          category: values.category || undefined,
          type: values.type,
          status: values.status,
          quantity: values.quantity,
          unit_price: values.unit_price,
          transaction_date: values.transaction_date,
        },
        userId
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", siteId] });
      queryClient.invalidateQueries({ queryKey: ["tx-categories", siteId] });
      toast.success("Transaction added.");
      onClose();
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Diesel fuel purchase" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reference_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference No.</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. INV-0042" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Fuel, Equipment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price ($) *</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="transaction_date"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Add Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
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
  const [modalOpen, setModalOpen] = useState(false);
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
    queryKey: ["transactions", activeSiteId, typeFilter, statusFilter, categoryFilter],
    queryFn: () =>
      getTransactions(activeSiteId!, {
        type: typeFilter,
        status: statusFilter,
        category: categoryFilter,
      }),
    enabled: !!activeSiteId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["tx-categories", activeSiteId],
    queryFn: () => getTransactionCategories(activeSiteId!),
    enabled: !!activeSiteId,
  });

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

  const columns: DataTableColumn<Transaction>[] = [
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
      render: (_, row) => (
        <div>
          <p className="font-medium">{row.description || "—"}</p>
          {row.category && (
            <p className="text-xs text-muted-foreground">{row.category}</p>
          )}
        </div>
      ),
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
          <span className={`tabular-nums font-medium ${isIncome ? "text-emerald-600" : "text-red-600"}`}>
            {isIncome ? "+" : "-"}${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(transactions)}>
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" />
            Import CSV
          </Button>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Income</p>
          <p className="text-xl font-bold text-emerald-600">
            ${totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Expenses</p>
          <p className="text-xl font-bold text-red-600">
            ${totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg border border-border p-4 col-span-2 sm:col-span-1">
          <p className="text-sm text-muted-foreground">Net</p>
          <p className={`text-xl font-bold ${totalIncome - totalExpenses >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            ${(totalIncome - totalExpenses).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={transactions as unknown as Record<string, unknown>[]}
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

      {/* Add Modal */}
      {modalOpen && (
        <AddTransactionModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          siteId={activeSiteId!}
          userId={user?.id}
        />
      )}

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

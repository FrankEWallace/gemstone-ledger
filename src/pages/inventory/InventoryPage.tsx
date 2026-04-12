import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Download, Upload, Pencil, Trash2, AlertTriangle, PackageSearch } from "lucide-react";
import { toast } from "sonner";

import { useSite } from "@/hooks/useSite";
import { fmtCurrency } from "@/lib/formatCurrency";
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

import { useAuth } from "@/hooks/useAuth";
import type { InventoryItem } from "@/lib/supabaseTypes";
import {
  getInventoryItems,
  getInventoryCategories,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryConsumptionRates,
  consumeInventoryItem,
} from "@/services/inventory.service";
import { getCustomers } from "@/services/customers.service";
import { getExpenseCategories } from "@/services/expense-categories.service";
import { isDemoMode } from "@/lib/demo";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import CsvImportModal, { type CsvColumn } from "@/components/shared/CsvImportModal";

// ─── Schema ──────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.coerce.number().min(0, "Must be ≥ 0"),
  unit: z.string().optional(),
  unit_cost: z.coerce.number().min(0, "Must be ≥ 0").optional().or(z.literal("")),
  reorder_level: z.coerce.number().min(0, "Must be ≥ 0").optional().or(z.literal("")),
});

type ItemFormValues = z.infer<typeof itemSchema>;

// ─── CSV export helper ────────────────────────────────────────────────────────

function exportCSV(items: InventoryItem[]) {
  const header = "Name,Category,SKU,Quantity,Unit,Unit Cost,Reorder Level";
  const rows = items.map((i) =>
    [
      `"${i.name}"`,
      i.category ?? "",
      i.sku ?? "",
      i.quantity,
      i.unit ?? "",
      i.unit_cost ?? "",
      i.reorder_level ?? "",
    ].join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventory.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

interface ItemModalProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  editing: InventoryItem | null;
}

function ItemModal({ open, onClose, siteId, editing }: ItemModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    values: editing
      ? {
          name: editing.name,
          category: editing.category ?? "",
          sku: editing.sku ?? "",
          quantity: editing.quantity,
          unit: editing.unit ?? "",
          unit_cost: editing.unit_cost ?? "",
          reorder_level: editing.reorder_level ?? "",
        }
      : {
          name: "",
          category: "",
          sku: "",
          quantity: 0,
          unit: "",
          unit_cost: "",
          reorder_level: "",
        },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: ItemFormValues) => {
      const payload = {
        name: values.name,
        category: values.category || undefined,
        sku: values.sku || undefined,
        quantity: values.quantity,
        unit: values.unit || undefined,
        unit_cost: values.unit_cost === "" ? null : Number(values.unit_cost),
        reorder_level:
          values.reorder_level === "" ? null : Number(values.reorder_level),
      };
      return editing
        ? updateInventoryItem(editing.id, payload)
        : createInventoryItem(siteId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", siteId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-categories", siteId] });
      toast.success(editing ? "Item updated." : "Item added.");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Item" : "Add Inventory Item"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Safety Helmet" {...field} />
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
                      <Input placeholder="e.g. PPE" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. PPE-001" {...field} />
                    </FormControl>
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
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. pcs, kg, L" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Cost ($)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reorder_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder Level</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} placeholder="Min qty before alert" {...field} />
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
                {isPending ? "Saving…" : editing ? "Save Changes" : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

type StockStatus = "out" | "low" | "in";

function getStockStatus(quantity: number, reorderLevel: number | null): StockStatus {
  if (quantity === 0) return "out";
  if (reorderLevel !== null && quantity <= reorderLevel) return "low";
  return "in";
}

function StatusBadge({ quantity, reorderLevel }: { quantity: number; reorderLevel: number | null }) {
  const status = getStockStatus(quantity, reorderLevel);
  if (status === "out") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-red-50 text-red-600 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
        Out of Stock
      </span>
    );
  }
  if (status === "low") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
        Low Stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
      In Stock
    </span>
  );
}

// ─── Days-left chip ───────────────────────────────────────────────────────────

function DaysLeftChip({ daysLeft }: { daysLeft: number }) {
  const label = daysLeft < 1 ? "Stockout" : `${Math.round(daysLeft)}d left`;
  const color =
    daysLeft < 7
      ? "text-red-500 dark:text-red-400"
      : daysLeft < 30
      ? "text-amber-500 dark:text-amber-400"
      : "text-muted-foreground";
  return (
    <span className={`text-[10px] font-medium tabular-nums ${color}`}>
      ({label})
    </span>
  );
}

// ─── Log Usage Modal ──────────────────────────────────────────────────────────

interface LogUsageModalProps {
  open: boolean;
  onClose: () => void;
  item: InventoryItem;
  siteId: string;
  orgId: string;
  userId?: string;
}

function LogUsageModal({ open, onClose, item, siteId, orgId, userId }: LogUsageModalProps) {
  const queryClient = useQueryClient();
  const [qty, setQty] = useState(1);
  const [customerId, setCustomerId] = useState("");
  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", siteId],
    queryFn: () => getCustomers(siteId),
  });
  const { data: expenseCategories = [] } = useQuery({
    queryKey: ["expense-categories", orgId],
    queryFn: () => getExpenseCategories(orgId),
    enabled: !!orgId,
  });

  const unitCost = Number(item.unit_cost ?? 0);
  const total = qty * unitCost;
  const maxQty = item.quantity;

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (isDemoMode()) {
        toast.info("Demo mode — changes are not persisted.");
        return;
      }
      await consumeInventoryItem(siteId, item, qty, {
        customerId: customerId || null,
        expenseCategoryId: expenseCategoryId || null,
        notes,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", siteId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", siteId] });
      toast.success(`Logged ${qty} ${item.unit ?? "unit(s)"} of ${item.name}${unitCost > 0 ? ` · ${fmtCurrency(total, 2)} expense created` : ""}`);
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Inventory Usage</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg bg-muted/40 p-3 space-y-0.5">
            <p className="text-sm font-semibold">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              In stock: <span className="font-medium">{item.quantity} {item.unit ?? "units"}</span>
              {unitCost > 0 && <> · Unit cost: <span className="font-medium">${unitCost.toFixed(2)}</span></>}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Quantity Used *</Label>
            <Input
              type="number"
              min={1}
              max={maxQty}
              value={qty}
              onChange={(e) => setQty(Math.min(maxQty, Math.max(1, Number(e.target.value))))}
              className="h-8 text-xs"
            />
          </div>

          {customers.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Customer (optional)</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="No customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No customer</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {expenseCategories.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Expense Category (optional)</Label>
              <Select value={expenseCategoryId} onValueChange={setExpenseCategoryId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Uncategorised" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Uncategorised</SelectItem>
                  {expenseCategories.map((ec) => (
                    <SelectItem key={ec.id} value={ec.id}>{ec.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              placeholder="e.g. Used for leaching circuit"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs"
            />
          </div>

          {unitCost > 0 && (
            <p className="text-xs text-muted-foreground rounded-md bg-muted/40 px-3 py-2">
              An expense transaction of{" "}
              <span className="font-semibold text-foreground">{fmtCurrency(total, 2)}</span>{" "}
              will be recorded automatically.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending || qty < 1 || qty > maxQty}>
            {isPending ? "Logging…" : "Log Usage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { activeSiteId } = useSite();
  const { orgId, user } = useAuth();
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [logUsageTarget, setLogUsageTarget] = useState<InventoryItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory", activeSiteId],
    queryFn: () => getInventoryItems(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["inventory-categories", activeSiteId],
    queryFn: () => getInventoryCategories(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { data: consumptionRates = {} } = useQuery({
    queryKey: ["inventory-consumption", activeSiteId],
    queryFn: () => getInventoryConsumptionRates(activeSiteId!),
    enabled: !!activeSiteId,
    // Refresh every 5 minutes — audit log data doesn't change that fast
    staleTime: 5 * 60 * 1000,
  });

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteInventoryItem(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["inventory", activeSiteId] });
      const previous = queryClient.getQueryData<InventoryItem[]>(["inventory", activeSiteId]);
      queryClient.setQueryData<InventoryItem[]>(
        ["inventory", activeSiteId],
        (old) => old?.filter((item) => item.id !== id) ?? []
      );
      setDeleteTarget(null);
      return { previous };
    },
    onError: (err: Error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["inventory", activeSiteId], context.previous);
      }
      toast.error(err.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", activeSiteId] });
      toast.success("Item deleted.");
    },
  });

  const filteredItems = categoryFilter === "all"
    ? items
    : items.filter((i) => i.category === categoryFilter);

  const lowStockCount = items.filter(
    (i) => i.reorder_level !== null && i.quantity <= i.reorder_level
  ).length;

  const columns: DataTableColumn<InventoryItem>[] = [
    {
      key: "sku",
      header: "Item ID",
      className: "text-center",
      render: (val) => (
        <span className="font-mono text-xs text-muted-foreground">
          {(val as string | null) ?? "—"}
        </span>
      ),
    },
    {
      key: "name",
      header: "Item Name",
      sortable: true,
      className: "text-center",
      render: (_, row) => {
        const rate = consumptionRates[row.id as string] ?? 0;
        const daysLeft = rate > 0 ? (row.quantity as number) / rate : null;
        return (
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-medium text-sm leading-tight">{row.name as string}</span>
            {daysLeft !== null && daysLeft < 60 && (
              <DaysLeftChip daysLeft={daysLeft} />
            )}
          </div>
        );
      },
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      className: "text-center",
      render: (val) =>
        val ? (
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground ring-1 ring-border">
            {val as string}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: "quantity",
      header: "Stock",
      sortable: true,
      className: "text-center",
      render: (_, row) => (
        <span className="tabular-nums text-sm font-semibold">
          {row.quantity as number}{" "}
          <span className="text-xs font-normal text-muted-foreground">{(row.unit as string | null) ?? ""}</span>
        </span>
      ),
    },
    {
      key: "unit_cost",
      header: "Unit Cost",
      sortable: true,
      className: "text-center",
      render: (val) => (
        <span className="tabular-nums text-sm">
          {val != null ? fmtCurrency(Number(val), 2) : <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      key: "reorder_level",
      header: "Reorder At",
      className: "text-center",
      render: (val) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {val != null ? String(val) : "—"}
        </span>
      ),
    },
    {
      key: "id",
      header: "Status",
      className: "text-center",
      render: (_, row) => (
        <StatusBadge
          quantity={row.quantity as number}
          reorderLevel={row.reorder_level as number | null}
        />
      ),
    },
    {
      key: "id",
      header: "",
      className: "w-28 text-center",
      render: (_, row) => (
        <div className="flex items-center justify-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-2 gap-1"
            title="Log usage → auto-expense"
            onClick={() => setLogUsageTarget(row as unknown as InventoryItem)}
          >
            <PackageSearch className="h-3.5 w-3.5" />
            Use
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => { setEditing(row); setModalOpen(true); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteTarget(row)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const csvColumns: CsvColumn<Omit<InventoryItem, "id" | "site_id" | "supplier_id" | "created_at" | "updated_at">>[] = [
    { header: "Name",          key: "name",          required: true },
    { header: "Category",      key: "category" },
    { header: "SKU",           key: "sku" },
    { header: "Quantity",      key: "quantity",      required: true, transform: (v) => { const n = Number(v); if (isNaN(n)) throw new Error("not a number"); return n; } },
    { header: "Unit",          key: "unit" },
    { header: "Unit Cost",     key: "unit_cost",     transform: (v) => v ? Number(v) : null },
    { header: "Reorder Level", key: "reorder_level", transform: (v) => v ? Number(v) : null },
  ];

  async function handleCsvImport(rows: Record<string, unknown>[]) {
    for (const row of rows) {
      await createInventoryItem(activeSiteId!, row as Parameters<typeof createInventoryItem>[1]);
    }
    queryClient.invalidateQueries({ queryKey: ["inventory", activeSiteId] });
    queryClient.invalidateQueries({ queryKey: ["inventory-categories", activeSiteId] });
  }

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Inventory</h1>
          {lowStockCount > 0 && (
            <p className="text-sm text-destructive mt-0.5 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {lowStockCount} item{lowStockCount !== 1 ? "s" : ""} below reorder level
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(filteredItems)}>
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" />
            Import CSV
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={filteredItems as unknown as Record<string, unknown>[]}
        columns={columns as DataTableColumn<Record<string, unknown>>[]}
        keyField="id"
        searchable
        searchPlaceholder="Search by name or SKU…"
        searchKeys={["name", "sku", "category"]}
        pageSize={15}
        isLoading={isLoading}
        emptyMessage={
          categoryFilter !== "all"
            ? `No items in category "${categoryFilter}".`
            : "No inventory items yet. Add your first item to get started."
        }
        toolbar={
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* CSV Import */}
      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entityName="Inventory Items"
        columns={csvColumns as CsvColumn<Record<string, unknown>>[]}
        onImport={handleCsvImport}
        templateHeaders="Name,Category,SKU,Quantity,Unit,Unit Cost,Reorder Level"
        exampleRow='Safety Helmet,PPE,PPE-001,100,pcs,12.50,20'
      />

      {/* Add / Edit Modal */}
      {modalOpen && (
        <ItemModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          siteId={activeSiteId!}
          editing={editing}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The item will be permanently removed from inventory.
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

      {logUsageTarget && (
        <LogUsageModal
          open={!!logUsageTarget}
          onClose={() => setLogUsageTarget(null)}
          item={logUsageTarget}
          siteId={activeSiteId!}
          orgId={orgId!}
          userId={user?.id}
        />
      )}
    </div>
  );
}

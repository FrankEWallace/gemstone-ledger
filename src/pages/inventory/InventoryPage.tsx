import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Download, Upload, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { useSite } from "@/hooks/useSite";
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

import type { InventoryItem } from "@/lib/supabaseTypes";
import {
  getInventoryItems,
  getInventoryCategories,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "@/services/inventory.service";
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { activeSiteId } = useSite();
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);

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
      key: "name",
      header: "Item Name",
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.name}</span>
          {row.reorder_level !== null && row.quantity <= row.reorder_level && (
            <Badge variant="destructive" className="text-xs py-0 gap-1">
              <AlertTriangle className="h-3 w-3" />
              Low
            </Badge>
          )}
        </div>
      ),
    },
    { key: "category", header: "Category", sortable: true },
    { key: "sku", header: "SKU" },
    {
      key: "quantity",
      header: "Qty",
      sortable: true,
      className: "text-right",
      render: (_, row) => (
        <span className="tabular-nums">
          {row.quantity} {row.unit ?? ""}
        </span>
      ),
    },
    {
      key: "unit_cost",
      header: "Unit Cost",
      sortable: true,
      className: "text-right",
      render: (val) =>
        val != null ? `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—",
    },
    {
      key: "reorder_level",
      header: "Reorder At",
      className: "text-right",
      render: (val) => (val != null ? String(val) : "—"),
    },
    {
      key: "id",
      header: "",
      className: "w-20 text-right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => { setEditing(row); setModalOpen(true); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
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
        <div className="flex items-center gap-2">
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
    </div>
  );
}

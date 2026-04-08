import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { isDemoMode } from "@/lib/demo";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";

import type { ExpenseCategory } from "@/lib/supabaseTypes";
import {
  getExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  type ExpenseCategoryPayload,
} from "@/services/expense-categories.service";

// ─── Schema ──────────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  color: z.string().optional(),
  type: z.enum(["expense", "income"]),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

// ─── Preset colors ────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  "#7c3aed", "#2563eb", "#059669", "#dc2626", "#d97706",
  "#0891b2", "#be185d", "#65a30d", "#9333ea", "#ea580c",
];

// ─── Modal ────────────────────────────────────────────────────────────────────

interface CategoryModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  editing: ExpenseCategory | null;
  defaultType: "expense" | "income";
}

function CategoryModal({ open, onClose, orgId, editing, defaultType }: CategoryModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    values: editing
      ? {
          name: editing.name,
          description: editing.description ?? "",
          color: editing.color ?? "",
          type: editing.type ?? defaultType,
        }
      : { name: "", description: "", color: COLOR_PRESETS[0], type: defaultType },
  });

  const selectedColor = form.watch("color");

  const { mutate, isPending } = useMutation({
    mutationFn: (values: CategoryFormValues) => {
      if (isDemoMode()) {
        toast.info("Demo mode — changes are not persisted.");
        return Promise.resolve({} as ExpenseCategory);
      }
      const payload: ExpenseCategoryPayload = {
        name: values.name,
        description: values.description || undefined,
        color: values.color || undefined,
        type: values.type,
      };
      return editing
        ? updateExpenseCategory(editing.id, payload)
        : createExpenseCategory(orgId, payload);
    },
    onSuccess: () => {
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: ["expense-categories", orgId] });
        toast.success(editing ? "Category updated." : "Category added.");
      }
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">

            {/* Type toggle */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <div className="flex gap-2">
                    {(["expense", "income"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => field.onChange(t)}
                        className={[
                          "flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors",
                          field.value === t
                            ? t === "expense"
                              ? "border-destructive bg-destructive/10 text-destructive"
                              : "border-green-600 bg-green-600/10 text-green-700 dark:text-green-400"
                            : "border-border text-muted-foreground hover:bg-muted",
                        ].join(" ")}
                      >
                        {t === "expense" ? "Expense" : "Income"}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder={form.watch("type") === "income" ? "e.g. Sales / Royalties" : "e.g. Chemicals / Reagents"} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Optional description…" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Colour</FormLabel>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => field.onChange(c)}
                        className="h-7 w-7 rounded-full border-2 transition-all"
                        style={{
                          background: c,
                          borderColor: selectedColor === c ? "hsl(var(--foreground))" : "transparent",
                          boxShadow: selectedColor === c ? "0 0 0 2px hsl(var(--background))" : "none",
                        }}
                      />
                    ))}
                    <input
                      type="color"
                      value={field.value ?? "#7c3aed"}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="h-7 w-7 rounded-full cursor-pointer border border-border overflow-hidden"
                      title="Custom colour"
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save Changes" : "Add Category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "expense" | "income";

const TAB_LABELS: Record<Tab, string> = {
  expense: "Expenses",
  income: "Income",
};

export default function ExpenseCategoriesPage() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("expense");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategory | null>(null);

  const { data: allCategories = [], isLoading } = useQuery({
    queryKey: ["expense-categories", orgId],
    queryFn: () => getExpenseCategories(orgId!),
    enabled: !!orgId,
  });

  const categories = allCategories.filter((c) => (c.type ?? "expense") === activeTab);

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => {
      if (isDemoMode()) {
        toast.info("Demo mode — changes are not persisted.");
        return Promise.resolve();
      }
      return deleteExpenseCategory(id);
    },
    onSuccess: () => {
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: ["expense-categories", orgId] });
        toast.success("Category deleted.");
      }
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: DataTableColumn<ExpenseCategory>[] = [
    {
      key: "name",
      header: "Category",
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          {row.color && (
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ background: row.color }}
            />
          )}
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (_, row) => {
        const t = row.type ?? "expense";
        return (
          <Badge
            variant="outline"
            className={
              t === "income"
                ? "border-green-600 text-green-700 dark:text-green-400"
                : "border-destructive text-destructive"
            }
          >
            {t === "income" ? "Income" : "Expense"}
          </Badge>
        );
      },
    },
    {
      key: "description",
      header: "Description",
      render: (val) => (
        <span className="text-sm text-muted-foreground">{String(val || "—")}</span>
      ),
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

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage expense and income categories for reporting and transaction breakdowns.
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Category
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => {
          const count = allCategories.filter((c) => (c.type ?? "expense") === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {TAB_LABELS[tab]}
              <span className="ml-1.5 text-xs text-muted-foreground">({count})</span>
            </button>
          );
        })}
      </div>

      <DataTable
        data={categories as unknown as Record<string, unknown>[]}
        columns={columns as DataTableColumn<Record<string, unknown>>[]}
        keyField="id"
        searchable
        searchPlaceholder={`Search ${TAB_LABELS[activeTab].toLowerCase()} categories…`}
        searchKeys={["name", "description"]}
        pageSize={20}
        isLoading={isLoading}
        emptyMessage={`No ${TAB_LABELS[activeTab].toLowerCase()} categories yet. Add your first category.`}
      />

      {modalOpen && (
        <CategoryModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          orgId={orgId!}
          editing={editing}
          defaultType={activeTab}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing transactions linked to this category will lose their category reference.
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

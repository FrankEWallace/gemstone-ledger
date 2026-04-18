/**
 * Action-based transaction creation.
 *
 * Three focused workflows replace the generic "Add Transaction" form:
 *   RecordPaymentModal  — income, source = 'payment', requires customer
 *   RecordExpenseModal  — expense, source = 'manual', no customer
 *   UseInventoryModal   — expense, source = 'inventory', item picker
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Wand2, Package } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtCurrency } from "@/lib/formatCurrency";

import { createTransaction } from "@/services/transactions.service";
import { consumeInventoryItem, getInventoryItems } from "@/services/inventory.service";
import type { InventoryItem } from "@/lib/supabaseTypes";

// ─── Shared constants ─────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: "TZS", label: "TSh — Tanzanian Shilling" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "ZAR", label: "ZAR — South African Rand" },
  { code: "KES", label: "KES — Kenyan Shilling" },
];

const INCOME_STATUSES = ["pending", "success", "cancelled"] as const;
const EXPENSE_STATUSES = ["pending", "success", "cancelled"] as const;

export function generateRefNo(transactions: { reference_no?: string | null }[]): string {
  const dateStr = format(new Date(), "yyyyMMdd");
  const prefix = `TXN-${dateStr}-`;
  const existing = transactions
    .map((t) => t.reference_no ?? "")
    .filter((r) => r.startsWith(prefix))
    .map((r) => parseInt(r.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

// ─── Record Payment ───────────────────────────────────────────────────────────
// Creates: type='income', source='payment', customer required

const paymentSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  description: z.string().min(1, "Description is required"),
  reference_no: z.string().optional(),
  category: z.string().optional(),
  quantity: z.coerce.number().min(1, "Must be ≥ 1"),
  unit_price: z.coerce.number().min(0, "Must be ≥ 0"),
  currency: z.string().min(1),
  transaction_date: z.string().min(1, "Date is required"),
  status: z.enum(["pending", "success", "cancelled"]),
});

type PaymentForm = z.infer<typeof paymentSchema>;

export interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  userId?: string;
  customers: { id: string; name: string }[];
  transactions: { reference_no?: string | null }[];
}

export function RecordPaymentModal({
  open,
  onClose,
  siteId,
  userId,
  customers,
  transactions,
}: RecordPaymentModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      customer_id: "",
      description: "",
      reference_no: "",
      category: "Sales",
      quantity: 1,
      unit_price: 0,
      currency: "TZS",
      transaction_date: format(new Date(), "yyyy-MM-dd"),
      status: "pending",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (v: PaymentForm) =>
      createTransaction(
        siteId,
        {
          type: "income",
          source: "payment",
          customer_id: v.customer_id,
          description: v.description,
          reference_no: v.reference_no || undefined,
          category: v.category || undefined,
          quantity: v.quantity,
          unit_price: v.unit_price,
          currency: v.currency,
          transaction_date: v.transaction_date,
          status: v.status,
        },
        userId
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", siteId] });
      queryClient.invalidateQueries({ queryKey: ["tx-categories", siteId] });
      toast.success("Payment recorded.");
      onClose();
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const qty = form.watch("quantity");
  const price = form.watch("unit_price");
  const total = (Number(qty) || 0) * (Number(price) || 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-emerald-600 dark:text-emerald-400">
            Record Payment
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            {/* Customer — required for payments */}
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What was sold / paid for *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Gemstone lot #42 — 5 sapphires" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Reference */}
              <FormField
                control={form.control}
                name="reference_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference No.</FormLabel>
                    <div className="flex gap-1.5">
                      <FormControl>
                        <Input placeholder="Auto" {...field} />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0 h-9 w-9"
                        title="Auto-generate"
                        onClick={() =>
                          form.setValue("reference_no", generateRefNo(transactions))
                        }
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Category */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Sales, Royalties" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quantity */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qty Sold *</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Unit Price */}
              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price *</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
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
                        {INCOME_STATUSES.map((s) => (
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

              {/* Date */}
              <FormField
                control={form.control}
                name="transaction_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Currency */}
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Currency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Total preview */}
            {total > 0 && (
              <p className="text-sm text-right text-emerald-600 font-medium tabular-nums">
                Total: {fmtCurrency(total)}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isPending ? "Saving…" : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Record Expense ───────────────────────────────────────────────────────────
// Creates: type='expense', source='manual', no customer

const expenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  reference_no: z.string().optional(),
  category: z.string().optional(),
  quantity: z.coerce.number().min(1, "Must be ≥ 1"),
  unit_price: z.coerce.number().min(0, "Must be ≥ 0"),
  currency: z.string().min(1),
  transaction_date: z.string().min(1, "Date is required"),
  status: z.enum(["pending", "success", "cancelled"]),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

export interface RecordExpenseModalProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  userId?: string;
  transactions: { reference_no?: string | null }[];
}

export function RecordExpenseModal({
  open,
  onClose,
  siteId,
  userId,
  transactions,
}: RecordExpenseModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: "",
      reference_no: "",
      category: "",
      quantity: 1,
      unit_price: 0,
      currency: "TZS",
      transaction_date: format(new Date(), "yyyy-MM-dd"),
      status: "pending",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (v: ExpenseForm) =>
      createTransaction(
        siteId,
        {
          type: "expense",
          source: "manual",
          description: v.description,
          reference_no: v.reference_no || undefined,
          category: v.category || undefined,
          quantity: v.quantity,
          unit_price: v.unit_price,
          currency: v.currency,
          transaction_date: v.transaction_date,
          status: v.status,
        },
        userId
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", siteId] });
      queryClient.invalidateQueries({ queryKey: ["tx-categories", siteId] });
      toast.success("Expense recorded.");
      onClose();
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const qty = form.watch("quantity");
  const price = form.watch("unit_price");
  const total = (Number(qty) || 0) * (Number(price) || 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-red-600 dark:text-red-400">Record Expense</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What was purchased / paid for *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Diesel fuel — 200L, generator repair" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Reference */}
              <FormField
                control={form.control}
                name="reference_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference No.</FormLabel>
                    <div className="flex gap-1.5">
                      <FormControl>
                        <Input placeholder="Auto" {...field} />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0 h-9 w-9"
                        title="Auto-generate"
                        onClick={() =>
                          form.setValue("reference_no", generateRefNo(transactions))
                        }
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Category */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Fuel, Equipment, Labour" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quantity */}
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

              {/* Unit Cost */}
              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Cost *</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
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
                        {EXPENSE_STATUSES.map((s) => (
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

              {/* Date */}
              <FormField
                control={form.control}
                name="transaction_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Currency */}
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Currency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Total preview */}
            {total > 0 && (
              <p className="text-sm text-right text-red-600 font-medium tabular-nums">
                Total: {fmtCurrency(total)}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isPending ? "Saving…" : "Record Expense"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Use Inventory ────────────────────────────────────────────────────────────
// Creates: type='expense', source='inventory' via consumeInventoryItem
// Also deducts stock from inventory_items

const useInventorySchema = z.object({
  inventory_item_id: z.string().min(1, "Item is required"),
  quantity: z.coerce.number().positive("Must be > 0"),
  customer_id: z.string().optional(),
  notes: z.string().optional(),
  transaction_date: z.string().min(1, "Date is required"),
});

type UseInventoryForm = z.infer<typeof useInventorySchema>;

export interface UseInventoryModalProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  userId?: string;
  customers: { id: string; name: string }[];
  defaultCustomerId?: string;
}

export function UseInventoryModal({
  open,
  onClose,
  siteId,
  userId,
  customers,
  defaultCustomerId,
}: UseInventoryModalProps) {
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery<InventoryItem[]>({
    queryKey: ["inventory", siteId],
    queryFn: () => getInventoryItems(siteId),
    enabled: open && !!siteId,
  });

  const form = useForm<UseInventoryForm>({
    resolver: zodResolver(useInventorySchema),
    defaultValues: {
      inventory_item_id: "",
      quantity: 1,
      customer_id: defaultCustomerId ?? "",
      notes: "",
      transaction_date: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const watchedItemId = form.watch("inventory_item_id");
  const watchedQty = form.watch("quantity");
  const selectedItem = items.find((i) => i.id === watchedItemId);
  const unitCost = Number(selectedItem?.unit_cost ?? 0);
  const totalCost = unitCost * (Number(watchedQty) || 0);
  const stockAfter = selectedItem
    ? selectedItem.quantity - (Number(watchedQty) || 0)
    : null;

  const { mutate, isPending } = useMutation({
    mutationFn: async (v: UseInventoryForm) => {
      const item = items.find((i) => i.id === v.inventory_item_id);
      if (!item) throw new Error("Item not found");
      if (v.quantity > item.quantity)
        throw new Error(`Only ${item.quantity} ${item.unit ?? "units"} available`);

      await consumeInventoryItem(siteId, item, v.quantity, {
        customerId: (v.customer_id && v.customer_id !== "__none__") ? v.customer_id : null,
        notes: v.notes || undefined,
        userId,
        transactionDate: v.transaction_date,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", siteId] });
      queryClient.invalidateQueries({ queryKey: ["inventory", siteId] });
      toast.success("Inventory usage recorded.");
      onClose();
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Package className="h-4 w-4" />
            Use Inventory
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            {/* Item picker */}
            <FormField
              control={form.control}
              name="inventory_item_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue("quantity", 1);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select inventory item…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <span className="font-medium">{item.name}</span>
                          <span className="text-muted-foreground ml-2 text-xs">
                            {item.quantity} {item.unit ?? "units"} available
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Item cost/stock summary */}
            {selectedItem && (
              <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-sm grid grid-cols-3 gap-2 tabular-nums">
                <div>
                  <p className="text-xs text-muted-foreground">Unit cost</p>
                  <p className="font-medium">
                    {unitCost > 0 ? fmtCurrency(unitCost) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">In stock</p>
                  <p className="font-medium">
                    {selectedItem.quantity} {selectedItem.unit ?? "units"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">After use</p>
                  <p
                    className={`font-medium ${
                      stockAfter !== null && stockAfter < 0 ? "text-red-600" : ""
                    }`}
                  >
                    {stockAfter !== null
                      ? `${stockAfter} ${selectedItem.unit ?? "units"}`
                      : "—"}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Quantity */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Quantity used *{" "}
                      {selectedItem?.unit && (
                        <span className="text-muted-foreground font-normal">
                          ({selectedItem.unit})
                        </span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0.001}
                        step="any"
                        max={selectedItem?.quantity}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date */}
              <FormField
                control={form.control}
                name="transaction_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Customer (optional) */}
              {customers.length > 0 && (
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Customer (optional)</FormLabel>
                      <Select
                        value={field.value || "__none__"}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Used for crushing phase, Pit B" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Total cost preview */}
            {totalCost > 0 && (
              <p className="text-sm text-right text-red-600 font-medium tabular-nums">
                Expense created: {fmtCurrency(totalCost)}
              </p>
            )}
            {selectedItem && unitCost === 0 && (
              <p className="text-xs text-muted-foreground text-right">
                No unit cost set — stock will be deducted but no expense transaction created.
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !watchedItemId}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isPending ? "Recording…" : "Use Inventory"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

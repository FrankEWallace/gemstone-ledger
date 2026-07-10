import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
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
import { Separator } from "@/components/ui/separator";

import type { Transaction, TransactionType, TransactionStatus } from "@/lib/supabaseTypes";
import type { Customer } from "@/lib/supabaseTypes";
import { updateTransaction } from "@/services/transactions.service";
import { getProductionPhases } from "@/services/production-phases.service";
import { useSite } from "@/hooks/useSite";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  transaction_date: z.string().min(1, "Date is required"),
  description:      z.string().optional(),
  reference_no:     z.string().optional(),
  category:         z.string().optional(),
  customer_id:      z.string().nullable().optional(),
  phase_id:         z.string().nullable().optional(),
  type:             z.enum(["income", "expense", "refund"]),
  status:           z.enum(["success", "pending", "refunded", "cancelled"]),
  quantity:         z.coerce.number().min(0.001, "Must be > 0"),
  unit_price:       z.coerce.number().min(0, "Must be ≥ 0"),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  transaction: Transaction | null;
  open: boolean;
  onClose: () => void;
  customers: Customer[];
  categories: string[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TransactionEditSheet({
  transaction,
  open,
  onClose,
  customers,
  categories,
}: Props) {
  const { activeSiteId } = useSite();
  const queryClient = useQueryClient();

  const { data: phases = [] } = useQuery({
    queryKey: ["production-phases", activeSiteId],
    queryFn: () => getProductionPhases(activeSiteId!),
    enabled: open && !!activeSiteId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: txToForm(transaction),
  });

  useEffect(() => {
    if (transaction) form.reset(txToForm(transaction));
  }, [transaction, form]);

  const { mutate, isPending } = useMutation({
    mutationFn: (values: FormValues) =>
      updateTransaction(transaction!.id, {
        ...values,
        customer_id: values.customer_id || null,
        phase_id: values.phase_id || null,
        description: values.description || undefined,
        reference_no: values.reference_no || undefined,
        category: values.category || undefined,
        type: values.type as TransactionType,
        status: values.status as TransactionStatus,
      }),
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: ["transactions", activeSiteId] });
      const keys = queryClient.getQueryCache().findAll({ queryKey: ["transactions", activeSiteId] });
      const snapshots = keys.map((q) => ({ key: q.queryKey, data: q.state.data }));
      keys.forEach((q) => {
        queryClient.setQueryData<Transaction[]>(q.queryKey, (old) =>
          old?.map((t) =>
            t.id === transaction!.id ? { ...t, ...values, customer_id: values.customer_id ?? null } : t
          ) ?? []
        );
      });
      return { snapshots };
    },
    onError: (err: Error, _v, context) => {
      context?.snapshots.forEach(({ key, data }) => queryClient.setQueryData(key, data));
      toast.error(err.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", activeSiteId] });
      toast.success("Transaction updated.");
      onClose();
    },
  });

  const total = (form.watch("quantity") || 0) * (form.watch("unit_price") || 0);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Edit Transaction</SheetTitle>
          {transaction?.reference_no && (
            <p className="text-xs text-muted-foreground font-mono">{transaction.reference_no}</p>
          )}
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">

            {/* Date + Ref */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="transaction_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="text-sm" />
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
                    <FormLabel>Ref #</FormLabel>
                    <FormControl>
                      <Input placeholder="INV-001" {...field} className="text-sm font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="What was this for?" {...field} className="text-sm" />
                  </FormControl>
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
                    <>
                      <Input
                        list="tx-categories"
                        placeholder="e.g. Fuel, Labour…"
                        {...field}
                        className="text-sm"
                      />
                      <datalist id="tx-categories">
                        {categories.map((c) => <option key={c} value={c} />)}
                      </datalist>
                    </>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Customer */}
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select
                    value={field.value ?? "__none__"}
                    onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phase */}
            {phases.length > 0 && (
              <FormField
                control={form.control}
                name="phase_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phase</FormLabel>
                    <Select
                      value={field.value ?? "__none__"}
                      onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {phases.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Separator />

            {/* Type + Status */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="text-sm capitalize">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(["income", "expense", "refund"] as TransactionType[]).map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
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
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="text-sm capitalize">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(["success", "pending", "refunded", "cancelled"] as TransactionStatus[]).map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Qty + Unit Price */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" min="0.001" step="any" {...field} className="text-sm" />
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
                    <FormLabel>Unit Price</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} className="text-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Total preview */}
            <div className="rounded-lg bg-muted/50 px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold tabular-nums">
                {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <SheetFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save changes"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function txToForm(tx: Transaction | null): FormValues {
  return {
    transaction_date: tx?.transaction_date ?? "",
    description:      tx?.description ?? "",
    reference_no:     tx?.reference_no ?? "",
    category:         tx?.category ?? "",
    customer_id:      tx?.customer_id ?? null,
    phase_id:         tx?.phase_id ?? null,
    type:             (tx?.type as FormValues["type"]) ?? "income",
    status:           (tx?.status as FormValues["status"]) ?? "pending",
    quantity:         tx?.quantity ?? 1,
    unit_price:       tx?.unit_price ?? 0,
  };
}

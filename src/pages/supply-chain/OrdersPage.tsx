import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Trash2,
  ChevronRight,
  PackageCheck,
  Send,
  CheckCircle,
  XCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { useSite } from "@/hooks/useSite";
import { fmtCurrency } from "@/lib/formatCurrency";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Separator } from "@/components/ui/separator";

import type { Order, OrderStatus, InventoryItem, Supplier, Channel, Customer } from "@/lib/supabaseTypes";
import {
  getOrders,
  getOrderWithItems,
  createOrder,
  updateOrderStatus,
  receiveOrder,
  deleteOrder,
  type OrderWithItems,
} from "@/services/orders.service";
import { getSuppliers, getChannels } from "@/services/suppliers.service";
import { getInventoryItems } from "@/services/inventory.service";
import { getCustomers } from "@/services/customers.service";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  draft: "sent",
  sent: "confirmed",
  confirmed: "received",
  received: null,
  cancelled: null,
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  confirmed: "Confirmed",
  received: "Received",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  received: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const lineItemSchema = z.object({
  inventory_item_id: z.string().min(1, "Select an item"),
  quantity: z.coerce.number().min(1, "Min 1"),
  unit_price: z.coerce.number().min(0, "Min 0"),
});

const orderSchema = z.object({
  supplier_id: z.string().optional(),
  channel_id: z.string().optional(),
  customer_id: z.string().optional(),
  expected_date: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "Add at least one line item"),
});

type OrderFormValues = z.infer<typeof orderSchema>;

// ─── Create Order Modal ───────────────────────────────────────────────────────

interface CreateOrderModalProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  userId?: string;
  orgId?: string | null;
  suppliers: Supplier[];
  channels: Channel[];
  inventoryItems: InventoryItem[];
  customers: Customer[];
}

function CreateOrderModal({
  open,
  onClose,
  siteId,
  userId,
  suppliers,
  channels,
  inventoryItems,
  customers,
}: CreateOrderModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      supplier_id: "",
      channel_id: "",
      customer_id: "",
      expected_date: "",
      notes: "",
      items: [{ inventory_item_id: "", quantity: 1, unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = form.watch("items");
  const orderTotal = watchedItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0
  );

  const { mutate, isPending } = useMutation({
    mutationFn: (values: OrderFormValues) =>
      createOrder(
        siteId,
        {
          supplier_id: values.supplier_id || undefined,
          channel_id: values.channel_id || undefined,
          customer_id: values.customer_id || null,
          expected_date: values.expected_date || undefined,
          notes: values.notes || undefined,
          items: values.items.map((i) => ({
            inventory_item_id: i.inventory_item_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
        },
        userId
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", siteId] });
      toast.success("Purchase order created.");
      onClose();
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleItemSelect(index: number, itemId: string) {
    const item = inventoryItems.find((i) => i.id === itemId);
    form.setValue(`items.${index}.inventory_item_id`, itemId);
    if (item?.unit_cost) {
      form.setValue(`items.${index}.unit_price`, item.unit_cost);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-5">
            {/* Order details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <Select
                      value={field.value || "__none__"}
                      onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {suppliers.filter((s) => s.status === "active").map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="channel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel</FormLabel>
                    <Select
                      value={field.value || "__none__"}
                      onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select channel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {channels.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {customers.length > 0 && (
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer (cost attribution)</FormLabel>
                      <Select
                          value={field.value || "__none__"}
                          onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                        >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">No customer</SelectItem>
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="expected_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Delivery</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any special instructions or notes…" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Line Items</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ inventory_item_id: "", quantity: 1, unit_price: 0 })}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Line
                </Button>
              </div>

              {form.formState.errors.items?.root && (
                <p className="text-sm text-destructive mb-2">{form.formState.errors.items.root.message}</p>
              )}
              {typeof form.formState.errors.items === "object" && "message" in form.formState.errors.items && (
                <p className="text-sm text-destructive mb-2">{form.formState.errors.items.message as string}</p>
              )}

              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                    {/* Item select — col-span 5 */}
                    <div className="col-span-12 sm:col-span-5">
                      <FormField
                        control={form.control}
                        name={`items.${index}.inventory_item_id`}
                        render={({ field: f }) => (
                          <FormItem>
                            {index === 0 && <FormLabel className="text-xs text-muted-foreground">Item</FormLabel>}
                            <Select value={f.value} onValueChange={(v) => handleItemSelect(index, v)}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select item" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {inventoryItems.map((i) => (
                                  <SelectItem key={i.id} value={i.id}>
                                    {i.name} {i.sku ? `(${i.sku})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Qty — col-span 2 */}
                    <div className="col-span-4 sm:col-span-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field: f }) => (
                          <FormItem>
                            {index === 0 && <FormLabel className="text-xs text-muted-foreground">Qty</FormLabel>}
                            <FormControl>
                              <Input type="number" min={1} className="h-9" {...f} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Unit price — col-span 3 */}
                    <div className="col-span-5 sm:col-span-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.unit_price`}
                        render={({ field: f }) => (
                          <FormItem>
                            {index === 0 && <FormLabel className="text-xs text-muted-foreground">Unit Price</FormLabel>}
                            <FormControl>
                              <Input type="number" min={0} step="0.01" className="h-9" {...f} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Line total — col-span 1 */}
                    <div className="col-span-2 sm:col-span-1 flex items-end pb-1">
                      {index === 0 && <div className="h-5" />}
                      <p className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        ${((Number(watchedItems[index]?.quantity) || 0) * (Number(watchedItems[index]?.unit_price) || 0)).toFixed(2)}
                      </p>
                    </div>

                    {/* Remove — col-span 1 */}
                    <div className="col-span-1 flex items-end pb-0.5">
                      {index === 0 && <div className="h-5" />}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => fields.length > 1 && remove(index)}
                        disabled={fields.length <= 1}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-3">
                <p className="text-sm font-medium">
                  Order Total: <span className="text-base">{fmtCurrency(orderTotal, 2)}</span>
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create PO"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Order Detail Sheet ───────────────────────────────────────────────────────

interface OrderDetailSheetProps {
  orderId: string | null;
  onClose: () => void;
  suppliers: Supplier[];
  channels: Channel[];
  inventoryItems: InventoryItem[];
  siteId: string;
  userId?: string;
}

function OrderDetailSheet({
  orderId,
  onClose,
  suppliers,
  channels,
  inventoryItems,
  siteId,
  userId,
}: OrderDetailSheetProps) {
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-detail", orderId],
    queryFn: () => getOrderWithItems(orderId!),
    enabled: !!orderId,
  });

  const { mutate: advance, isPending: isAdvancing } = useMutation({
    mutationFn: async (o: OrderWithItems) => {
      const next = STATUS_FLOW[o.status];
      if (!next) return;
      if (next === "received") {
        await receiveOrder(o.id, { userId });
      } else {
        await updateOrderStatus(o.id, next);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", siteId] });
      queryClient.invalidateQueries({ queryKey: ["order-detail", orderId] });
      queryClient.invalidateQueries({ queryKey: ["inventory", siteId] });
      toast.success("Order status updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: cancel, isPending: isCancelling } = useMutation({
    mutationFn: (id: string) => updateOrderStatus(id, "cancelled"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", siteId] });
      queryClient.invalidateQueries({ queryKey: ["order-detail", orderId] });
      toast.success("Order cancelled.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const supplier = suppliers.find((s) => s.id === order?.supplier_id);
  const channel = channels.find((c) => c.id === order?.channel_id);
  const nextStatus = order ? STATUS_FLOW[order.status] : null;

  const nextLabel: Record<string, string> = {
    sent: "Mark as Sent",
    confirmed: "Mark as Confirmed",
    received: "Receive Order",
  };

  const nextIcon: Record<string, React.ReactNode> = {
    sent: <Send className="h-3.5 w-3.5 mr-1.5" />,
    confirmed: <CheckCircle className="h-3.5 w-3.5 mr-1.5" />,
    received: <PackageCheck className="h-3.5 w-3.5 mr-1.5" />,
  };

  return (
    <Sheet open={!!orderId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isLoading ? "Loading…" : order?.order_number ?? "Order Detail"}
          </SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {order && (
          <div className="mt-6 space-y-6">
            {/* Status + actions */}
            <div className="flex items-center justify-between">
              <StatusBadge status={order.status} />
              <div className="flex items-center gap-2">
                {nextStatus && (
                  <Button
                    size="sm"
                    onClick={() => advance(order)}
                    disabled={isAdvancing}
                    className={nextStatus === "received" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                  >
                    {nextIcon[nextStatus]}
                    {nextLabel[nextStatus]}
                  </Button>
                )}
                {order.status !== "cancelled" && order.status !== "received" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => cancel(order.id)}
                    disabled={isCancelling}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Supplier</p>
                <p className="font-medium">{supplier?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Channel</p>
                <p className="font-medium">{channel?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Expected</p>
                <p className="font-medium">
                  {order.expected_date
                    ? format(new Date(order.expected_date), "MMM d, yyyy")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Received</p>
                <p className="font-medium">
                  {order.received_date
                    ? format(new Date(order.received_date), "MMM d, yyyy")
                    : "—"}
                </p>
              </div>
              {order.notes && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Notes</p>
                  <p>{order.notes}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Line items */}
            <div>
              <p className="text-sm font-medium mb-3">Line Items</p>
              <div className="space-y-2">
                {order.order_items.map((item) => {
                  const invItem = inventoryItems.find((i) => i.id === item.inventory_item_id);
                  return (
                    <div key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium">{invItem?.name ?? "Unknown item"}</p>
                        {invItem?.sku && <p className="text-xs text-muted-foreground">{invItem.sku}</p>}
                      </div>
                      <div className="text-right">
                        <p className="tabular-nums">
                          {item.quantity} × ${Number(item.unit_price).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          ${Number(item.total).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center mt-3 pt-3 border-t border-border font-medium">
                <span>Total</span>
                <span>{fmtCurrency(Number(order.total_amount ?? 0), 2)}</span>
              </div>
            </div>

            {nextStatus === "received" && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                <PackageCheck className="h-4 w-4 inline mr-1.5" />
                Receiving this order will automatically increment inventory quantities for all line items.
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { activeSiteId } = useSite();
  const { user, orgId } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", activeSiteId],
    queryFn: () => getOrders(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", orgId],
    queryFn: () => getSuppliers(orgId!),
    enabled: !!orgId,
  });

  const { data: channels = [] } = useQuery({
    queryKey: ["channels", orgId],
    queryFn: () => getChannels(orgId!),
    enabled: !!orgId,
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory", activeSiteId],
    queryFn: () => getInventoryItems(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", activeSiteId] });
      toast.success("Order deleted.");
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (supplierFilter !== "all" && o.supplier_id !== supplierFilter) return false;
    return true;
  });

  const columns: DataTableColumn<Order>[] = [
    {
      key: "order_number",
      header: "PO #",
      sortable: true,
      render: (val) => <span className="font-mono text-sm font-medium">{String(val || "—")}</span>,
    },
    {
      key: "supplier_id",
      header: "Supplier",
      sortable: true,
      render: (val) => suppliers.find((s) => s.id === val)?.name ?? "—",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (val) => <StatusBadge status={val as OrderStatus} />,
    },
    {
      key: "total_amount",
      header: "Total",
      sortable: true,
      className: "text-right",
      render: (val) =>
        val != null
          ? fmtCurrency(Number(val), 2)
          : "—",
    },
    {
      key: "expected_date",
      header: "Expected",
      render: (val) => (val ? format(new Date(String(val)), "MMM d, yyyy") : "—"),
    },
    {
      key: "created_at",
      header: "Created",
      sortable: true,
      render: (val) => format(new Date(String(val)), "MMM d, yyyy"),
    },
    {
      key: "id",
      header: "",
      className: "w-24 text-right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setSelectedOrderId(row.id as string)}
          >
            View
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          {(row.status === "draft" || row.status === "cancelled") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => setDeleteTarget(row as unknown as Order)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Order Management</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Purchase Order
        </Button>
      </div>

      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        columns={columns as DataTableColumn<Record<string, unknown>>[]}
        keyField="id"
        searchable
        searchPlaceholder="Search by PO number…"
        searchKeys={["order_number", "notes"]}
        pageSize={15}
        isLoading={isLoading}
        emptyMessage="No orders found. Create your first purchase order."
        toolbar={
          <>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(["draft", "sent", "confirmed", "received", "cancelled"] as OrderStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {suppliers.length > 0 && (
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="All suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All suppliers</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        }
      />

      {/* Create Order Modal */}
      {createOpen && (
        <CreateOrderModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          siteId={activeSiteId!}
          userId={user?.id}
          orgId={orgId}
          suppliers={suppliers}
          channels={channels}
          inventoryItems={inventoryItems}
          customers={customers}
        />
      )}

      {/* Order Detail Sheet */}
      <OrderDetailSheet
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        suppliers={suppliers}
        channels={channels}
        inventoryItems={inventoryItems}
        siteId={activeSiteId!}
        userId={user?.id}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.order_number}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the order and its line items. Only draft and cancelled orders can be deleted.
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

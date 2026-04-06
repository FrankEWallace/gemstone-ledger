import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restPut, restDel } from "@/lib/providers/rest/client";
import type { Order, OrderItem, OrderStatus } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_ORDERS } from "@/lib/demo/data";

export type OrderLineItem = {
  inventory_item_id: string;
  quantity: number;
  unit_price: number;
};

export type CreateOrderPayload = {
  supplier_id?: string;
  channel_id?: string;
  customer_id?: string | null;
  expected_date?: string;
  notes?: string;
  items: OrderLineItem[];
};

export type OrderWithItems = Order & { order_items: OrderItem[] };

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function getOrders(siteId: string): Promise<Order[]> {
  if (isDemoMode()) return DEMO_ORDERS as any;
  if (isRestActive())
    return restGet<Order[]>(`/orders?site_id=${siteId}`);

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getOrderWithItems(orderId: string): Promise<OrderWithItems> {
  if (isRestActive())
    return restGet<OrderWithItems>(`/orders/${orderId}/items`);

  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .single();
  if (error) throw error;
  return data as OrderWithItems;
}

export async function createOrder(
  siteId: string,
  payload: CreateOrderPayload,
  createdBy?: string
): Promise<Order> {
  if (isRestActive())
    return restPost<Order>("/orders", {
      ...payload,
      site_id: siteId,
      customer_id: payload.customer_id ?? null,
      created_by: createdBy ?? null,
    });

  const orderNumber = `PO-${Date.now().toString().slice(-6)}`;
  const totalAmount = payload.items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      site_id: siteId,
      supplier_id: payload.supplier_id || null,
      channel_id: payload.channel_id || null,
      customer_id: payload.customer_id || null,
      order_number: orderNumber,
      status: "draft",
      total_amount: totalAmount,
      expected_date: payload.expected_date || null,
      notes: payload.notes || null,
      created_by: createdBy ?? null,
    })
    .select()
    .single();
  if (orderError) throw orderError;

  if (payload.items.length > 0) {
    const { error: itemsError } = await supabase.from("order_items").insert(
      payload.items.map((item) => ({
        order_id: order.id,
        inventory_item_id: item.inventory_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
      }))
    );
    if (itemsError) throw itemsError;
  }

  return order;
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  extraFields?: { received_date?: string }
): Promise<Order> {
  if (isRestActive())
    return restPut<Order>(`/orders/${id}/status`, { status, ...extraFields });

  const { data, error } = await supabase
    .from("orders")
    .update({ status, ...extraFields })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Mark order as received, increment inventory quantities, and create
 * `source: 'order'` expense transactions for each line item.
 * REST: single atomic call — the PHP API handles all side-effects server-side.
 */
export async function receiveOrder(
  orderId: string,
  opts?: { userId?: string }
): Promise<void> {
  if (isRestActive()) {
    await restPost(`/orders/${orderId}/receive`, {});
    return;
  }

  // Fetch order for site_id and customer_id (needed for transaction creation)
  const { data: order, error: orderFetchError } = await supabase
    .from("orders")
    .select("site_id, customer_id")
    .eq("id", orderId)
    .single();
  if (orderFetchError) throw orderFetchError;

  const { data: items, error: fetchError } = await supabase
    .from("order_items")
    .select("inventory_item_id, quantity, unit_price")
    .eq("order_id", orderId);
  if (fetchError) throw fetchError;

  const today = new Date().toISOString().split("T")[0];
  const { error: statusError } = await supabase
    .from("orders")
    .update({ status: "received", received_date: today })
    .eq("id", orderId);
  if (statusError) throw statusError;

  for (const item of items ?? []) {
    if (!item.inventory_item_id) continue;

    const { data: inv, error: fetchInvError } = await supabase
      .from("inventory_items")
      .select("quantity, name, unit, category")
      .eq("id", item.inventory_item_id)
      .single();
    if (fetchInvError) continue;

    await supabase
      .from("inventory_items")
      .update({ quantity: (inv?.quantity ?? 0) + item.quantity })
      .eq("id", item.inventory_item_id);

    // Auto-create expense transaction for this line item
    if (Number(item.unit_price) > 0) {
      await supabase.from("transactions").insert({
        site_id: order.site_id,
        customer_id: order.customer_id ?? null,
        inventory_item_id: item.inventory_item_id,
        description: `PO received — ${inv?.name ?? "item"} × ${item.quantity} ${inv?.unit ?? "units"}`,
        type: "expense",
        status: "success",
        quantity: item.quantity,
        unit_price: item.unit_price,
        category: inv?.category ?? null,
        transaction_date: today,
        source: "order",
        created_by: opts?.userId ?? null,
      });
    }
  }
}

export async function deleteOrder(id: string): Promise<void> {
  if (isRestActive()) return restDel(`/orders/${id}`);

  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
}

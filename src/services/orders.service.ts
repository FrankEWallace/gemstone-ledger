import { supabase } from "@/lib/supabase";
import type { Order, OrderItem, OrderStatus } from "@/lib/supabaseTypes";

export type OrderLineItem = {
  inventory_item_id: string;
  quantity: number;
  unit_price: number;
};

export type CreateOrderPayload = {
  supplier_id?: string;
  channel_id?: string;
  expected_date?: string;
  notes?: string;
  items: OrderLineItem[];
};

export type OrderWithItems = Order & { order_items: OrderItem[] };

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function getOrders(siteId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getOrderWithItems(orderId: string): Promise<OrderWithItems> {
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
  // Generate a simple order number
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
 * Mark order as received and increment inventory quantities for each line item.
 * Sequential calls — no client-side transaction support in Supabase JS.
 */
export async function receiveOrder(orderId: string): Promise<void> {
  // 1. Get order items
  const { data: items, error: fetchError } = await supabase
    .from("order_items")
    .select("inventory_item_id, quantity")
    .eq("order_id", orderId);
  if (fetchError) throw fetchError;

  // 2. Update order status
  const today = new Date().toISOString().split("T")[0];
  const { error: statusError } = await supabase
    .from("orders")
    .update({ status: "received", received_date: today })
    .eq("id", orderId);
  if (statusError) throw statusError;

  // 3. Increment inventory quantities
  for (const item of items ?? []) {
    if (!item.inventory_item_id) continue;

    const { data: inv, error: fetchInvError } = await supabase
      .from("inventory_items")
      .select("quantity")
      .eq("id", item.inventory_item_id)
      .single();
    if (fetchInvError) continue; // skip if item no longer exists

    await supabase
      .from("inventory_items")
      .update({ quantity: (inv?.quantity ?? 0) + item.quantity })
      .eq("id", item.inventory_item_id);
  }
}

export async function deleteOrder(id: string): Promise<void> {
  // order_items cascade delete via FK
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
}

import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restPut, restDel } from "@/lib/providers/rest/client";
import type { InventoryItem } from "@/lib/supabaseTypes";
import { createTransaction } from "@/services/transactions.service";
import { isDemoMode } from "@/lib/demo";
import { DEMO_INVENTORY, DEMO_INVENTORY_WRITE_OFFS, DEMO_INVENTORY_USAGE } from "@/lib/demo/data";
import { enqueue } from "@/lib/offline/syncQueue";
import { registerHandler } from "@/lib/offline/syncEngine";

export type InventoryItemPayload = {
  name: string;
  category?: string;
  sku?: string;
  quantity: number;
  unit?: string;
  unit_cost?: number;
  reorder_level?: number;
  supplier_id?: string;
};

export async function getInventoryItems(siteId: string): Promise<InventoryItem[]> {
  if (isDemoMode()) return DEMO_INVENTORY as any;
  if (isRestActive())
    return restGet<InventoryItem[]>(`/inventory?site_id=${siteId}`);

  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("site_id", siteId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createInventoryItem(
  siteId: string,
  payload: InventoryItemPayload
): Promise<InventoryItem> {
  const fullPayload = { ...payload, site_id: siteId };

  if (!navigator.onLine) {
    const tempId = `offline-${crypto.randomUUID()}`;
    await enqueue({ entity: "inventory_items", operation: "create", payload: fullPayload, siteId, timestamp: Date.now() });
    return { id: tempId, created_at: new Date().toISOString(), ...fullPayload } as unknown as InventoryItem;
  }

  if (isRestActive()) return restPost<InventoryItem>("/inventory", fullPayload);

  const { data, error } = await supabase
    .from("inventory_items")
    .insert(fullPayload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateInventoryItem(
  id: string,
  payload: Partial<InventoryItemPayload>
): Promise<InventoryItem> {
  if (!navigator.onLine) {
    await enqueue({ entity: "inventory_items", operation: "update", payload: { id, ...payload }, siteId: "", timestamp: Date.now() });
    return { id, ...payload } as unknown as InventoryItem;
  }
  if (isRestActive()) return restPut<InventoryItem>(`/inventory/${id}`, payload);

  const { data, error } = await supabase
    .from("inventory_items")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteInventoryItem(id: string): Promise<void> {
  if (!navigator.onLine) {
    await enqueue({ entity: "inventory_items", operation: "delete", payload: { id }, siteId: "", timestamp: Date.now() });
    return;
  }
  if (isRestActive()) return restDel(`/inventory/${id}`);

  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) throw error;
}

// ─── Sync handlers ────────────────────────────────────────────────────────────

registerHandler("inventory_items", "create", async (item) => {
  await supabase.from("inventory_items").insert(item.payload as object);
});
registerHandler("inventory_items", "update", async (item) => {
  const { id, ...rest } = item.payload as { id: string } & Partial<InventoryItemPayload>;
  await supabase.from("inventory_items").update(rest).eq("id", id);
});
registerHandler("inventory_items", "delete", async (item) => {
  const { id } = item.payload as { id: string };
  await supabase.from("inventory_items").delete().eq("id", id);
});

export async function getInventoryConsumptionRates(
  siteId: string
): Promise<Record<string, number>> {
  if (isDemoMode()) return { "di1": 0.23, "di3": 0.13, "di4": 0.20, "di6": 0.17 };
  if (isRestActive())
    return restGet<Record<string, number>>(`/inventory/consumption?site_id=${siteId}`);

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data, error } = await supabase
    .from("inventory_transactions")
    .select("inventory_item_id, quantity_change")
    .eq("site_id", siteId)
    .lt("quantity_change", 0)
    .gte("created_at", since.toISOString());
  if (error) return {};

  const rates: Record<string, number> = {};
  for (const row of data ?? []) {
    rates[row.inventory_item_id] =
      (rates[row.inventory_item_id] ?? 0) + Math.abs(row.quantity_change);
  }
  for (const key in rates) rates[key] = rates[key] / 30;
  return rates;
}

/**
 * Atomically deducts inventory stock and creates a `source: 'inventory'` expense transaction.
 * Transaction is only created when unit_cost > 0.
 */
export async function consumeInventoryItem(
  siteId: string,
  item: InventoryItem,
  qty: number,
  opts: {
    customerId?: string | null;
    expenseCategoryId?: string | null;
    notes?: string;
    userId?: string;
    transactionDate?: string;
  } = {}
): Promise<void> {
  await updateInventoryItem(item.id, { quantity: item.quantity - qty });

  const unitCost = Number(item.unit_cost ?? 0);
  if (unitCost > 0) {
    await createTransaction(
      siteId,
      {
        description: `${item.name} usage — ${qty} ${item.unit ?? "units"}${opts.notes ? ` (${opts.notes})` : ""}`,
        type: "expense",
        status: "success",
        quantity: qty,
        unit_price: unitCost,
        transaction_date: opts.transactionDate ?? new Date().toISOString().slice(0, 10),
        customer_id: opts.customerId ?? null,
        expense_category_id: opts.expenseCategoryId ?? null,
        category: item.category ?? undefined,
        inventory_item_id: item.id,
        source: "inventory",
      },
      opts.userId
    );
  }
}

// ─── Write-offs ───────────────────────────────────────────────────────────────

export type WriteOffReason = "damaged" | "expired" | "theft" | "stocktake";

export interface WriteOffRow {
  id: string;
  itemName: string;
  category: string;
  unit: string;
  quantity: number;
  unitCost: number;
  value: number;
  reason: string;
  notes: string | null;
  writtenOffAt: string;
}

export interface InventoryUsageRow {
  id: string;
  inventoryItemId: string;
  itemName: string;
  category: string;
  unit: string;
  quantityConsumed: number;
  valueConsumed: number;
  customerId: string | null;
  customerName: string | null;
  transactionDate: string;
}

export async function writeOffInventoryItem(
  siteId: string,
  item: InventoryItem,
  qty: number,
  reason: WriteOffReason,
  notes: string,
  userId?: string
): Promise<void> {
  if (isDemoMode()) {
    return;
  }

  await updateInventoryItem(item.id, { quantity: item.quantity - qty });

  const { error } = await supabase
    .from("inventory_write_offs" as any)
    .insert({
      site_id: siteId,
      inventory_item_id: item.id,
      quantity: qty,
      reason,
      notes: notes || null,
      written_off_at: new Date().toISOString().slice(0, 10),
      written_off_by: userId ?? null,
    });
  if (error) throw error;
}

export async function getInventoryWriteOffsForReport(
  siteId: string,
  dateFrom: string,
  dateTo: string
): Promise<WriteOffRow[]> {
  if (isDemoMode()) {
    const items = DEMO_INVENTORY;
    return (DEMO_INVENTORY_WRITE_OFFS as any[])
      .filter((w) => w.written_off_at >= dateFrom && w.written_off_at <= dateTo)
      .map((w) => {
        const item = items.find((i) => i.id === w.inventory_item_id);
        const unitCost = Number(item?.unit_cost ?? 0);
        return {
          id: w.id,
          itemName: item?.name ?? "Unknown",
          category: item?.category ?? "",
          unit: item?.unit ?? "",
          quantity: w.quantity,
          unitCost,
          value: w.quantity * unitCost,
          reason: w.reason,
          notes: w.notes ?? null,
          writtenOffAt: w.written_off_at,
        };
      });
  }

  const { data, error } = await supabase
    .from("inventory_write_offs" as any)
    .select("id, quantity, reason, notes, written_off_at, inventory_items(name, category, unit, unit_cost)")
    .eq("site_id", siteId)
    .gte("written_off_at", dateFrom)
    .lte("written_off_at", dateTo)
    .order("written_off_at", { ascending: false });

  if (error) {
    console.warn("inventory_write_offs query failed:", error.message);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const item = row.inventory_items ?? {};
    const qty = Number(row.quantity ?? 0);
    const unitCost = Number(item.unit_cost ?? 0);
    return {
      id: row.id,
      itemName: item.name ?? "Unknown",
      category: item.category ?? "",
      unit: item.unit ?? "",
      quantity: qty,
      unitCost,
      value: qty * unitCost,
      reason: row.reason ?? "other",
      notes: row.notes ?? null,
      writtenOffAt: row.written_off_at,
    };
  });
}

export async function getInventoryUsageForReport(
  siteId: string,
  dateFrom: string,
  dateTo: string
): Promise<InventoryUsageRow[]> {
  if (isDemoMode()) {
    return (DEMO_INVENTORY_USAGE as any[]).filter(
      (u) => u.transactionDate >= dateFrom && u.transactionDate <= dateTo
    );
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("id, quantity, unit_price, transaction_date, inventory_item_id, customer_id, description, customers(name)")
    .eq("site_id", siteId)
    .eq("source", "inventory")
    .not("inventory_item_id", "is", null)
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo);

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const match = (row.description ?? "").match(/^(.+?) usage/);
    const itemName = match ? match[1] : row.description ?? "Unknown";
    return {
      id: row.id,
      inventoryItemId: row.inventory_item_id,
      itemName,
      category: "",
      unit: "",
      quantityConsumed: Number(row.quantity ?? 0),
      valueConsumed: Number(row.quantity ?? 0) * Number(row.unit_price ?? 0),
      customerId: row.customer_id ?? null,
      customerName: (row.customers as any)?.name ?? null,
      transactionDate: row.transaction_date,
    };
  });
}

export async function getInventoryCategories(siteId: string): Promise<string[]> {
  if (isDemoMode()) return [...new Set(DEMO_INVENTORY.map(i => i.category).filter(Boolean))] as string[];
  if (isRestActive())
    return restGet<string[]>(`/inventory/categories?site_id=${siteId}`);

  const { data, error } = await supabase
    .from("inventory_items")
    .select("category")
    .eq("site_id", siteId)
    .not("category", "is", null);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.category as string))].sort();
}

import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restPut, restDel } from "@/lib/providers/rest/client";
import type { InventoryItem, InventoryMovement, TablesInsert } from "@/lib/supabaseTypes";
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
  unit_cost?: number | null;
  reorder_level?: number | null;
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
  const { error } = await supabase.from("inventory_items").insert(item.payload as TablesInsert<"inventory_items">);
  if (error) throw error;
});
registerHandler("inventory_items", "update", async (item) => {
  const { id, ...rest } = item.payload as { id: string } & Partial<InventoryItemPayload>;
  const { error } = await supabase.from("inventory_items").update(rest).eq("id", id);
  if (error) throw error;
});
registerHandler("inventory_items", "delete", async (item) => {
  const { id } = item.payload as { id: string };
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) throw error;
});

export async function getInventoryConsumptionRates(
  siteId: string
): Promise<Record<string, number>> {
  if (isDemoMode()) return { "di1": 0.23, "di3": 0.13, "di4": 0.20, "di6": 0.17 };
  if (isRestActive())
    return restGet<Record<string, number>>(`/inventory/consumption?site_id=${siteId}`);

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceDate = since.toISOString().slice(0, 10);
  // Consumption is recorded as `source: 'inventory'` expense transactions (see
  // consumeInventoryItem), so derive per-item daily usage from there.
  const { data, error } = await supabase
    .from("transactions")
    .select("inventory_item_id, quantity")
    .eq("site_id", siteId)
    .eq("source", "inventory")
    .not("inventory_item_id", "is", null)
    .gte("transaction_date", sinceDate);
  if (error) return {};

  const rates: Record<string, number> = {};
  for (const row of data ?? []) {
    if (!row.inventory_item_id) continue;
    rates[row.inventory_item_id] =
      (rates[row.inventory_item_id] ?? 0) + Number(row.quantity ?? 0);
  }
  for (const key in rates) rates[key] = rates[key] / 30;
  return rates;
}

// ─── Movement ledger ────────────────────────────────────────────────────────
// Explicit, item-scoped history over receive/use/write-off/adjustment events,
// each carrying a running `quantity_after` balance — see migration 034.

type MovementInsert = {
  site_id: string;
  inventory_item_id: string;
  type: InventoryMovement["type"];
  quantity: number;
  quantity_after: number;
  unit_cost?: number | null;
  transaction_id?: string | null;
  write_off_id?: string | null;
  customer_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
};

async function insertMovement(row: MovementInsert): Promise<void> {
  if (isDemoMode()) return; // nothing is persisted in demo mode
  const { error } = await supabase.from("inventory_movements" as any).insert(row as any);
  if (error) throw error;
}

export async function receiveInventoryStock(
  siteId: string,
  item: InventoryItem,
  qty: number,
  notes?: string,
  userId?: string
): Promise<void> {
  const quantityAfter = item.quantity + qty;
  await updateInventoryItem(item.id, { quantity: quantityAfter });
  await insertMovement({
    site_id: siteId,
    inventory_item_id: item.id,
    type: "receive",
    quantity: qty,
    quantity_after: quantityAfter,
    unit_cost: item.unit_cost ?? null,
    notes: notes || null,
    created_by: userId ?? null,
  });
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
  const quantityAfter = item.quantity - qty;
  await updateInventoryItem(item.id, { quantity: quantityAfter });

  let transactionId: string | null = null;
  const unitCost = Number(item.unit_cost ?? 0);
  if (unitCost > 0) {
    const tx = await createTransaction(
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
    transactionId = tx.id ?? null;
  }

  await insertMovement({
    site_id: siteId,
    inventory_item_id: item.id,
    type: "use",
    quantity: -qty,
    quantity_after: quantityAfter,
    unit_cost: unitCost || null,
    transaction_id: transactionId,
    customer_id: opts.customerId ?? null,
    notes: opts.notes || null,
    created_by: opts.userId ?? null,
  });
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

  const quantityAfter = item.quantity - qty;
  await updateInventoryItem(item.id, { quantity: quantityAfter });

  const { data, error } = await supabase
    .from("inventory_write_offs" as any)
    .insert({
      site_id: siteId,
      inventory_item_id: item.id,
      quantity: qty,
      reason,
      notes: notes || null,
      written_off_at: new Date().toISOString().slice(0, 10),
      written_off_by: userId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  await insertMovement({
    site_id: siteId,
    inventory_item_id: item.id,
    type: "write_off",
    quantity: -qty,
    quantity_after: quantityAfter,
    unit_cost: item.unit_cost ?? null,
    write_off_id: (data as unknown as { id: string } | null)?.id ?? null,
    notes: `${reason}${notes ? ` — ${notes}` : ""}`,
    created_by: userId ?? null,
  });
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

// ─── Item history ───────────────────────────────────────────────────────────

export interface InventoryMovementRow {
  id: string;
  type: InventoryMovement["type"];
  quantity: number;
  quantityAfter: number;
  unitCost: number | null;
  customerId: string | null;
  customerName: string | null;
  notes: string | null;
  createdAt: string;
}

/**
 * Full receive/use/write-off/adjustment history for one item, newest first.
 * `currentQuantity` is only used to anchor the synthesized demo-mode timeline
 * (demo data predates this ledger, so there's nothing stored to read back).
 */
export async function getInventoryMovements(
  siteId: string,
  itemId: string,
  currentQuantity: number
): Promise<InventoryMovementRow[]> {
  if (isDemoMode()) {
    const usage = DEMO_INVENTORY_USAGE
      .filter((u) => u.inventoryItemId === itemId)
      .map((u) => ({
        id: u.id,
        type: "use" as const,
        quantity: -u.quantityConsumed,
        unitCost: u.quantityConsumed ? u.valueConsumed / u.quantityConsumed : null,
        customerId: u.customerId,
        customerName: u.customerName,
        notes: null as string | null,
        createdAt: u.transactionDate,
      }));
    const writeOffs = (DEMO_INVENTORY_WRITE_OFFS as any[])
      .filter((w) => w.inventory_item_id === itemId)
      .map((w) => ({
        id: w.id,
        type: "write_off" as const,
        quantity: -w.quantity,
        unitCost: null,
        customerId: null,
        customerName: null,
        notes: `${w.reason}${w.notes ? ` — ${w.notes}` : ""}`,
        createdAt: w.written_off_at,
      }));

    // Walk forward chronologically to build a self-consistent running balance,
    // then shift it so the most recent entry lands on the item's actual stock.
    const chrono = [...usage, ...writeOffs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let running = 0;
    const withRunning = chrono.map((m) => { running += m.quantity; return { ...m, quantityAfter: running }; });
    const shift = currentQuantity - (withRunning.at(-1)?.quantityAfter ?? currentQuantity);
    return withRunning.map((m) => ({ ...m, quantityAfter: m.quantityAfter + shift })).reverse();
  }

  const { data, error } = await supabase
    .from("inventory_movements" as any)
    .select("id, type, quantity, quantity_after, unit_cost, notes, created_at, customer_id, customers(name)")
    .eq("site_id", siteId)
    .eq("inventory_item_id", itemId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("inventory_movements query failed:", error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    type: row.type,
    quantity: Number(row.quantity),
    quantityAfter: Number(row.quantity_after),
    unitCost: row.unit_cost != null ? Number(row.unit_cost) : null,
    customerId: row.customer_id ?? null,
    customerName: (row.customers as any)?.name ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
  }));
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

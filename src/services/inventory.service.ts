import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restPut, restDel } from "@/lib/providers/rest/client";
import type { InventoryItem } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_INVENTORY } from "@/lib/demo/data";
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

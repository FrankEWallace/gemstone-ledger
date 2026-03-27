import { supabase } from "@/lib/supabase";
import type { InventoryItem } from "@/lib/supabaseTypes";

export type InventoryItemPayload = {
  name: string;
  category?: string;
  sku?: string;
  quantity: number;
  unit?: string;
  unit_cost?: number | null;
  reorder_level?: number | null;
  supplier_id?: string | null;
};

export async function getInventoryItems(siteId: string): Promise<InventoryItem[]> {
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
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({ ...payload, site_id: siteId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateInventoryItem(
  id: string,
  payload: Partial<InventoryItemPayload>
): Promise<InventoryItem> {
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
  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Returns a map of itemId → average daily consumption (units/day) over the
 * last 30 days by reading audit_logs for UPDATE events where quantity decreased.
 */
export async function getInventoryConsumptionRates(
  siteId: string
): Promise<Record<string, number>> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from("audit_logs")
    .select("entity_id, before, after, created_at")
    .eq("entity_type", "inventory_items")
    .eq("action", "UPDATE")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  if (error) throw error;

  const consumption: Record<string, number> = {};
  for (const log of data ?? []) {
    const before = log.before as Record<string, unknown> | null;
    const after  = log.after  as Record<string, unknown> | null;
    if (!before || !after) continue;

    // Check if this is for an item in our site (before.site_id or after.site_id)
    if (after.site_id !== siteId && before.site_id !== siteId) continue;

    const qBefore = Number(before.quantity ?? 0);
    const qAfter  = Number(after.quantity  ?? 0);
    const diff    = qBefore - qAfter;
    if (diff <= 0) continue; // skip restocks

    const id = log.entity_id as string;
    consumption[id] = (consumption[id] ?? 0) + diff;
  }

  // Convert totals to per-day rates (over 30-day window)
  const rates: Record<string, number> = {};
  for (const [id, total] of Object.entries(consumption)) {
    rates[id] = total / 30;
  }
  return rates;
}

/** Returns distinct category values for a site (for filter dropdown). */
export async function getInventoryCategories(siteId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("category")
    .eq("site_id", siteId)
    .not("category", "is", null);
  if (error) throw error;
  const unique = [...new Set((data ?? []).map((r) => r.category as string))].sort();
  return unique;
}

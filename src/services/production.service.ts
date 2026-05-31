import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restDel } from "@/lib/providers/rest/client";
import type { ProductionLog } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_PRODUCTION_LOGS } from "@/lib/demo/data";
import { enqueue } from "@/lib/offline/syncQueue";
import { registerHandler } from "@/lib/offline/syncEngine";

export type ProductionLogPayload = {
  site_id: string;
  customer_id?: string | null;
  log_date: string;
  ore_tonnes?: number | null;
  waste_tonnes?: number | null;
  grade_g_t?: number | null;
  water_m3?: number | null;
  notes?: string | null;
};

export async function getProductionLogs(
  siteId: string,
  limit = 60,
  customerId?: string
): Promise<ProductionLog[]> {
  if (isDemoMode()) return DEMO_PRODUCTION_LOGS as any;

  if (isRestActive()) {
    const params = new URLSearchParams({ site_id: siteId, per_page: String(limit) });
    const logs = await restGet<ProductionLog[]>(`/production-logs?${params}`);
    // PHP index doesn't filter by customer_id — apply client-side
    return customerId ? logs.filter((l) => l.customer_id === customerId) : logs;
  }

  let query = supabase
    .from("production_logs")
    .select("*")
    .eq("site_id", siteId)
    .order("log_date", { ascending: false })
    .limit(limit);
  if (customerId) query = query.eq("customer_id", customerId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function upsertProductionLog(
  payload: ProductionLogPayload,
  createdBy?: string
): Promise<ProductionLog> {
  const fullPayload = { ...payload, created_by: createdBy ?? null };

  if (!navigator.onLine) {
    const tempId = `offline-${crypto.randomUUID()}`;
    await enqueue({ entity: "production_logs", operation: "create", payload: fullPayload, siteId: payload.site_id, timestamp: Date.now() });
    return { id: tempId, created_at: new Date().toISOString(), ...fullPayload } as unknown as ProductionLog;
  }

  if (isRestActive()) {
    return restPost<ProductionLog>("/production-logs/upsert", fullPayload);
  }

  const { data, error } = await supabase
    .from("production_logs")
    .upsert(fullPayload, { onConflict: "site_id,log_date" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProductionLog(id: string): Promise<void> {
  if (!navigator.onLine) {
    await enqueue({ entity: "production_logs", operation: "delete", payload: { id }, siteId: "", timestamp: Date.now() });
    return;
  }

  if (isRestActive()) {
    return restDel(`/production-logs/${id}`);
  }

  const { error } = await supabase.from("production_logs").delete().eq("id", id);
  if (error) throw error;
}

// ─── Sync handlers ────────────────────────────────────────────────────────────

registerHandler("production_logs", "create", async (item) => {
  if (isRestActive()) {
    await restPost("/production-logs/upsert", item.payload);
    return;
  }
  await supabase
    .from("production_logs")
    .upsert(item.payload as object, { onConflict: "site_id,log_date" });
});
registerHandler("production_logs", "delete", async (item) => {
  const { id } = item.payload as { id: string };
  if (isRestActive()) {
    await restDel(`/production-logs/${id}`);
    return;
  }
  await supabase.from("production_logs").delete().eq("id", id);
});

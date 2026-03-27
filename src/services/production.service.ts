import { supabase } from "@/lib/supabase";
import type { ProductionLog } from "@/lib/supabaseTypes";

export type ProductionLogPayload = {
  site_id: string;
  log_date: string;
  ore_tonnes?: number | null;
  waste_tonnes?: number | null;
  grade_g_t?: number | null;
  water_m3?: number | null;
  notes?: string | null;
};

export async function getProductionLogs(siteId: string, limit = 60): Promise<ProductionLog[]> {
  const { data, error } = await supabase
    .from("production_logs")
    .select("*")
    .eq("site_id", siteId)
    .order("log_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function upsertProductionLog(
  payload: ProductionLogPayload,
  createdBy?: string
): Promise<ProductionLog> {
  const { data, error } = await supabase
    .from("production_logs")
    .upsert(
      { ...payload, created_by: createdBy ?? null },
      { onConflict: "site_id,log_date" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProductionLog(id: string): Promise<void> {
  const { error } = await supabase.from("production_logs").delete().eq("id", id);
  if (error) throw error;
}

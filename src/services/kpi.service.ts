import { supabase } from "@/lib/supabase";
import type { KpiTarget } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_KPI_TARGETS } from "@/lib/demo/data";

export type KpiTargetPayload = Omit<KpiTarget, "id" | "created_at" | "updated_at" | "created_by">;

export async function getKpiTargets(siteId: string, months: string[]): Promise<KpiTarget[]> {
  if (isDemoMode()) return DEMO_KPI_TARGETS as any;
  const { data, error } = await supabase
    .from("kpi_targets")
    .select("*")
    .eq("site_id", siteId)
    .in("month", months)
    .order("month", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertKpiTarget(payload: KpiTargetPayload, createdBy?: string): Promise<KpiTarget> {
  const { data, error } = await supabase
    .from("kpi_targets")
    .upsert(
      { ...payload, created_by: createdBy ?? null },
      { onConflict: "site_id,month" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

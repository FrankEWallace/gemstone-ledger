import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost } from "@/lib/providers/rest/client";
import type { KpiTarget } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_KPI_TARGETS } from "@/lib/demo/data";

export type KpiTargetPayload = Omit<KpiTarget, "id" | "created_at" | "updated_at" | "created_by">;

export async function getKpiTargets(siteId: string, months: string[]): Promise<KpiTarget[]> {
  if (isDemoMode()) return DEMO_KPI_TARGETS as any;

  if (isRestActive()) {
    if (months.length === 0) return [];
    const sorted = [...months].sort();
    const params = new URLSearchParams({
      site_id: siteId,
      from: `${sorted[0]}-01`,
      to: `${sorted[sorted.length - 1]}-01`,
    });
    const all = await restGet<KpiTarget[]>(`/kpi-targets?${params}`);
    // PHP returns all months in the range — filter to exactly the requested set
    const monthSet = new Set(months);
    return all.filter((k) => monthSet.has(k.month?.slice(0, 7) ?? ""));
  }

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
  if (isRestActive()) {
    return restPost<KpiTarget>("/kpi-targets/upsert", { ...payload, created_by: createdBy ?? null });
  }

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

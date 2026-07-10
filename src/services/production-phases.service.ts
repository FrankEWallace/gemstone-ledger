import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restPut, restDel } from "@/lib/providers/rest/client";
import type { ProductionPhase, ProductionPhaseStatus } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_PRODUCTION_PHASES } from "@/lib/demo/data";

export type ProductionPhasePayload = {
  name: string;
  status?: ProductionPhaseStatus;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
};

export async function getProductionPhases(siteId: string): Promise<ProductionPhase[]> {
  if (isDemoMode()) return DEMO_PRODUCTION_PHASES.filter((p) => p.site_id === siteId) as ProductionPhase[];
  if (isRestActive()) return restGet<ProductionPhase[]>(`/production-phases?site_id=${siteId}`);

  const { data, error } = await supabase
    .from("production_phases")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProductionPhase(
  siteId: string,
  orgId: string,
  payload: ProductionPhasePayload
): Promise<ProductionPhase> {
  const fullPayload = { ...payload, site_id: siteId, org_id: orgId };
  if (isRestActive()) return restPost<ProductionPhase>("/production-phases", fullPayload);

  const { data, error } = await supabase
    .from("production_phases")
    .insert(fullPayload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProductionPhase(
  id: string,
  payload: Partial<ProductionPhasePayload>
): Promise<ProductionPhase> {
  if (isRestActive()) return restPut<ProductionPhase>(`/production-phases/${id}`, payload);

  const { data, error } = await supabase
    .from("production_phases")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProductionPhase(id: string): Promise<void> {
  if (isRestActive()) return restDel(`/production-phases/${id}`);

  const { error } = await supabase.from("production_phases").delete().eq("id", id);
  if (error) throw error;
}

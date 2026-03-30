import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restPut, restDel } from "@/lib/providers/rest/client";
import type { SafetyIncident, SafetySeverity } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_SAFETY as DEMO_SAFETY_INCIDENTS } from "@/lib/demo/data";

export type SafetyIncidentPayload = {
  title: string;
  severity?: SafetySeverity;
  type?: string;
  description?: string;
  actions_taken?: string;
  resolved_at?: string | null;
};

export async function getSafetyIncidents(siteId: string): Promise<SafetyIncident[]> {
  if (isDemoMode()) return DEMO_SAFETY_INCIDENTS as any;
  if (isRestActive())
    return restGet<SafetyIncident[]>(`/safety-incidents?site_id=${siteId}`);

  const { data, error } = await supabase
    .from("safety_incidents")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSafetyIncident(
  siteId: string,
  payload: SafetyIncidentPayload,
  reportedBy?: string
): Promise<SafetyIncident> {
  if (isRestActive())
    return restPost<SafetyIncident>("/safety-incidents", {
      ...payload,
      site_id: siteId,
      reported_by: reportedBy ?? null,
      reported_at: new Date().toISOString(),
    });

  const { data, error } = await supabase
    .from("safety_incidents")
    .insert({
      ...payload,
      site_id: siteId,
      reported_by: reportedBy ?? null,
      reported_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSafetyIncident(
  id: string,
  payload: Partial<SafetyIncidentPayload>
): Promise<SafetyIncident> {
  if (isRestActive())
    return restPut<SafetyIncident>(`/safety-incidents/${id}`, payload);

  const { data, error } = await supabase
    .from("safety_incidents")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSafetyIncident(id: string): Promise<void> {
  if (isRestActive()) return restDel(`/safety-incidents/${id}`);

  const { error } = await supabase.from("safety_incidents").delete().eq("id", id);
  if (error) throw error;
}

export async function resolveSafetyIncident(id: string): Promise<SafetyIncident> {
  const resolved_at = new Date().toISOString();
  if (isRestActive())
    return restPut<SafetyIncident>(`/safety-incidents/${id}`, { resolved_at });

  const { data, error } = await supabase
    .from("safety_incidents")
    .update({ resolved_at })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

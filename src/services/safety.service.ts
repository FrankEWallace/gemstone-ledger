import { supabase } from "@/lib/supabase";
import type { SafetyIncident, IncidentSeverity, IncidentType } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_SAFETY } from "@/lib/demo/data";

export type SafetyIncidentPayload = {
  title: string;
  severity?: IncidentSeverity;
  type?: IncidentType;
  description?: string;
  actions_taken?: string;
  resolved_at?: string | null;
};

export async function getSafetyIncidents(siteId: string): Promise<SafetyIncident[]> {
  if (isDemoMode()) return DEMO_SAFETY as any;
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
  const { data, error } = await supabase
    .from("safety_incidents")
    .insert({ ...payload, site_id: siteId, reported_by: reportedBy ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSafetyIncident(
  id: string,
  payload: Partial<SafetyIncidentPayload>
): Promise<SafetyIncident> {
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
  const { error } = await supabase.from("safety_incidents").delete().eq("id", id);
  if (error) throw error;
}

export async function resolveSafetyIncident(id: string): Promise<SafetyIncident> {
  return updateSafetyIncident(id, { resolved_at: new Date().toISOString() });
}

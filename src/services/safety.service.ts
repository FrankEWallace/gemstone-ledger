import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restPut, restDel } from "@/lib/providers/rest/client";
import type { SafetyIncident, SafetySeverity } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_SAFETY as DEMO_SAFETY_INCIDENTS } from "@/lib/demo/data";
import { enqueue } from "@/lib/offline/syncQueue";
import { registerHandler } from "@/lib/offline/syncEngine";

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
  const fullPayload = {
    ...payload,
    site_id: siteId,
    reported_by: reportedBy ?? null,
    reported_at: new Date().toISOString(),
  };

  if (!navigator.onLine) {
    const tempId = `offline-${crypto.randomUUID()}`;
    await enqueue({ entity: "safety_incidents", operation: "create", payload: fullPayload, siteId, timestamp: Date.now() });
    return { id: tempId, created_at: new Date().toISOString(), resolved_at: null, ...fullPayload } as unknown as SafetyIncident;
  }

  if (isRestActive()) return restPost<SafetyIncident>("/safety-incidents", fullPayload);

  const { data, error } = await supabase
    .from("safety_incidents")
    .insert(fullPayload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSafetyIncident(
  id: string,
  payload: Partial<SafetyIncidentPayload>
): Promise<SafetyIncident> {
  if (!navigator.onLine) {
    await enqueue({ entity: "safety_incidents", operation: "update", payload: { id, ...payload }, siteId: "", timestamp: Date.now() });
    return { id, ...payload } as unknown as SafetyIncident;
  }
  if (isRestActive()) return restPut<SafetyIncident>(`/safety-incidents/${id}`, payload);

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
  if (!navigator.onLine) {
    await enqueue({ entity: "safety_incidents", operation: "delete", payload: { id }, siteId: "", timestamp: Date.now() });
    return;
  }
  if (isRestActive()) return restDel(`/safety-incidents/${id}`);

  const { error } = await supabase.from("safety_incidents").delete().eq("id", id);
  if (error) throw error;
}

export async function resolveSafetyIncident(id: string): Promise<SafetyIncident> {
  const resolved_at = new Date().toISOString();
  if (!navigator.onLine) {
    await enqueue({ entity: "safety_incidents", operation: "update", payload: { id, resolved_at }, siteId: "", timestamp: Date.now() });
    return { id, resolved_at } as unknown as SafetyIncident;
  }
  if (isRestActive()) return restPut<SafetyIncident>(`/safety-incidents/${id}`, { resolved_at });

  const { data, error } = await supabase
    .from("safety_incidents")
    .update({ resolved_at })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Sync handlers (registered once at module load) ──────────────────────────

registerHandler("safety_incidents", "create", async (item) => {
  const p = item.payload as SafetyIncidentPayload & { site_id: string; reported_by: string | null; reported_at: string };
  await supabase.from("safety_incidents").insert(p);
});
registerHandler("safety_incidents", "update", async (item) => {
  const { id, ...rest } = item.payload as { id: string } & Partial<SafetyIncidentPayload>;
  await supabase.from("safety_incidents").update(rest).eq("id", id);
});
registerHandler("safety_incidents", "delete", async (item) => {
  const { id } = item.payload as { id: string };
  await supabase.from("safety_incidents").delete().eq("id", id);
});

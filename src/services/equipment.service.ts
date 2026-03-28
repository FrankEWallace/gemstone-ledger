import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restPut, restDel } from "@/lib/providers/rest/client";
import type { Equipment, EquipmentStatus } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_EQUIPMENT } from "@/lib/demo/data";

export type EquipmentPayload = {
  name: string;
  type?: string;
  serial_number?: string;
  status?: EquipmentStatus;
  last_service_date?: string | null;
  next_service_date?: string | null;
  notes?: string;
};

export async function getEquipment(siteId: string): Promise<Equipment[]> {
  if (isDemoMode()) return DEMO_EQUIPMENT as any;
  if (isRestActive())
    return restGet<Equipment[]>(`/equipment?site_id=${siteId}`);

  const { data, error } = await supabase
    .from("equipment")
    .select("*")
    .eq("site_id", siteId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createEquipment(siteId: string, payload: EquipmentPayload): Promise<Equipment> {
  if (isRestActive())
    return restPost<Equipment>("/equipment", { ...payload, site_id: siteId });

  const { data, error } = await supabase
    .from("equipment")
    .insert({ ...payload, site_id: siteId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEquipment(id: string, payload: Partial<EquipmentPayload>): Promise<Equipment> {
  if (isRestActive())
    return restPut<Equipment>(`/equipment/${id}`, payload);

  const { data, error } = await supabase
    .from("equipment")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEquipment(id: string): Promise<void> {
  if (isRestActive()) return restDel(`/equipment/${id}`);

  const { error } = await supabase.from("equipment").delete().eq("id", id);
  if (error) throw error;
}

import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restDel } from "@/lib/providers/rest/client";
import type { PlannedShift } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_SHIFTS } from "@/lib/demo/data";

export type PlannedShiftPayload = {
  worker_id: string;
  shift_date: string;   // YYYY-MM-DD
  start_time: string;   // HH:MM
  end_time: string;     // HH:MM
  notes?: string;
};

export async function getPlannedShifts(
  siteId: string,
  from: string,
  to: string
): Promise<PlannedShift[]> {
  if (isDemoMode())
    return DEMO_SHIFTS.filter((s) => s.shift_date >= from && s.shift_date <= to) as any;
  if (isRestActive())
    return restGet<PlannedShift[]>(
      `/planned-shifts?site_id=${siteId}&from=${from}&to=${to}`
    );

  const { data, error } = await supabase
    .from("planned_shifts")
    .select("*")
    .eq("site_id", siteId)
    .gte("shift_date", from)
    .lte("shift_date", to)
    .order("shift_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createPlannedShift(
  siteId: string,
  payload: PlannedShiftPayload,
  createdBy?: string
): Promise<PlannedShift> {
  if (isRestActive())
    return restPost<PlannedShift>("/planned-shifts", {
      ...payload,
      site_id: siteId,
      created_by: createdBy ?? null,
    });

  const { data, error } = await supabase
    .from("planned_shifts")
    .insert({ ...payload, site_id: siteId, created_by: createdBy ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlannedShift(id: string): Promise<void> {
  if (isRestActive()) return restDel(`/planned-shifts/${id}`);

  const { error } = await supabase.from("planned_shifts").delete().eq("id", id);
  if (error) throw error;
}

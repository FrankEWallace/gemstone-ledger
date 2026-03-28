import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restPut, restDel } from "@/lib/providers/rest/client";
import type { Worker, ShiftRecord, WorkerStatus } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_WORKERS, DEMO_SHIFT_RECORDS } from "@/lib/demo/data";

export type WorkerPayload = {
  full_name: string;
  position?: string;
  department?: string;
  hire_date?: string;
  status?: WorkerStatus;
};

export type ShiftPayload = {
  worker_id: string;
  shift_date: string;
  hours_worked?: number;
  output_metric?: number;
  metric_unit?: string;
  notes?: string;
};

// ─── Workers ─────────────────────────────────────────────────────────────────

export async function getWorkers(siteId: string): Promise<Worker[]> {
  if (isDemoMode()) return DEMO_WORKERS as any;
  if (isRestActive())
    return restGet<Worker[]>(`/workers?site_id=${siteId}`);

  const { data, error } = await supabase
    .from("workers")
    .select("*")
    .eq("site_id", siteId)
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function createWorker(siteId: string, payload: WorkerPayload): Promise<Worker> {
  if (isRestActive())
    return restPost<Worker>("/workers", {
      ...payload,
      site_id: siteId,
      status: payload.status ?? "active",
    });

  const { data, error } = await supabase
    .from("workers")
    .insert({ ...payload, site_id: siteId, status: payload.status ?? "active" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateWorker(id: string, payload: Partial<WorkerPayload>): Promise<Worker> {
  if (isRestActive())
    return restPut<Worker>(`/workers/${id}`, payload);

  const { data, error } = await supabase
    .from("workers")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWorker(id: string): Promise<void> {
  if (isRestActive()) return restDel(`/workers/${id}`);

  const { error } = await supabase.from("workers").delete().eq("id", id);
  if (error) throw error;
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

export async function getShiftRecords(siteId: string): Promise<ShiftRecord[]> {
  if (isDemoMode()) return DEMO_SHIFT_RECORDS as any;
  if (isRestActive())
    return restGet<ShiftRecord[]>(`/shift-records?site_id=${siteId}`);

  const { data, error } = await supabase
    .from("shift_records")
    .select("*")
    .eq("site_id", siteId)
    .order("shift_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getShiftsForWorker(workerId: string): Promise<ShiftRecord[]> {
  if (isDemoMode()) return DEMO_SHIFT_RECORDS.filter(s => s.worker_id === workerId) as any;
  if (isRestActive())
    return restGet<ShiftRecord[]>(`/shift-records?worker_id=${workerId}&limit=30`);

  const { data, error } = await supabase
    .from("shift_records")
    .select("*")
    .eq("worker_id", workerId)
    .order("shift_date", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function logShift(siteId: string, payload: ShiftPayload): Promise<ShiftRecord> {
  if (isRestActive())
    return restPost<ShiftRecord>("/shift-records", { ...payload, site_id: siteId });

  const { data, error } = await supabase
    .from("shift_records")
    .insert({ ...payload, site_id: siteId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteShift(id: string): Promise<void> {
  if (isRestActive()) return restDel(`/shift-records/${id}`);

  const { error } = await supabase.from("shift_records").delete().eq("id", id);
  if (error) throw error;
}

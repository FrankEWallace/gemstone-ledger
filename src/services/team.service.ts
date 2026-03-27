import { supabase } from "@/lib/supabase";
import type { Worker, ShiftRecord, WorkerStatus } from "@/lib/supabaseTypes";

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
  const { data, error } = await supabase
    .from("workers")
    .select("*")
    .eq("site_id", siteId)
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function createWorker(siteId: string, payload: WorkerPayload): Promise<Worker> {
  const { data, error } = await supabase
    .from("workers")
    .insert({ ...payload, site_id: siteId, status: payload.status ?? "active" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateWorker(id: string, payload: Partial<WorkerPayload>): Promise<Worker> {
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
  const { error } = await supabase.from("workers").delete().eq("id", id);
  if (error) throw error;
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

export async function getShiftRecords(siteId: string): Promise<ShiftRecord[]> {
  const { data, error } = await supabase
    .from("shift_records")
    .select("*")
    .eq("site_id", siteId)
    .order("shift_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getShiftsForWorker(workerId: string): Promise<ShiftRecord[]> {
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
  const { data, error } = await supabase
    .from("shift_records")
    .insert({ ...payload, site_id: siteId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteShift(id: string): Promise<void> {
  const { error } = await supabase.from("shift_records").delete().eq("id", id);
  if (error) throw error;
}

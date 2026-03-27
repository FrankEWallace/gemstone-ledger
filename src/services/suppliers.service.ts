import { supabase } from "@/lib/supabase";
import type { Supplier, Channel } from "@/lib/supabaseTypes";

// ─── Suppliers (org-scoped) ───────────────────────────────────────────────────

export type SupplierPayload = {
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  category?: string;
  status?: "active" | "inactive";
};

export async function getSuppliers(orgId: string): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createSupplier(orgId: string, payload: SupplierPayload): Promise<Supplier> {
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ ...payload, org_id: orgId, status: payload.status ?? "active" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSupplier(
  id: string,
  payload: Partial<SupplierPayload>
): Promise<Supplier> {
  const { data, error } = await supabase
    .from("suppliers")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;
}

// ─── Channels (org-scoped) ────────────────────────────────────────────────────

export type ChannelPayload = {
  name: string;
  type?: string;
  description?: string;
};

export async function getChannels(orgId: string): Promise<Channel[]> {
  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createChannel(orgId: string, payload: ChannelPayload): Promise<Channel> {
  const { data, error } = await supabase
    .from("channels")
    .insert({ ...payload, org_id: orgId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateChannel(
  id: string,
  payload: Partial<ChannelPayload>
): Promise<Channel> {
  const { data, error } = await supabase
    .from("channels")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteChannel(id: string): Promise<void> {
  const { error } = await supabase.from("channels").delete().eq("id", id);
  if (error) throw error;
}

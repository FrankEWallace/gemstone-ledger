import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restPut, restDel } from "@/lib/providers/rest/client";
import type { Supplier, Channel } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_SUPPLIERS, DEMO_CHANNELS } from "@/lib/demo/data";

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
  if (isDemoMode()) return DEMO_SUPPLIERS as any;
  if (isRestActive())
    return restGet<Supplier[]>(`/suppliers?org_id=${orgId}`);

  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createSupplier(orgId: string, payload: SupplierPayload): Promise<Supplier> {
  if (isRestActive())
    return restPost<Supplier>("/suppliers", {
      ...payload,
      org_id: orgId,
      status: payload.status ?? "active",
    });

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
  if (isRestActive())
    return restPut<Supplier>(`/suppliers/${id}`, payload);

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
  if (isRestActive()) return restDel(`/suppliers/${id}`);

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
  if (isDemoMode()) return DEMO_CHANNELS as any;
  if (isRestActive())
    return restGet<Channel[]>(`/channels?org_id=${orgId}`);

  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createChannel(orgId: string, payload: ChannelPayload): Promise<Channel> {
  if (isRestActive())
    return restPost<Channel>("/channels", { ...payload, org_id: orgId });

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
  if (isRestActive())
    return restPut<Channel>(`/channels/${id}`, payload);

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
  if (isRestActive()) return restDel(`/channels/${id}`);

  const { error } = await supabase.from("channels").delete().eq("id", id);
  if (error) throw error;
}

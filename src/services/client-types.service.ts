import { supabase } from "@/lib/supabase";
import type { ClientType } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_CUSTOMER_TYPES } from "@/lib/demo/data";

export async function getClientTypes(orgId: string): Promise<ClientType[]> {
  if (isDemoMode()) return DEMO_CUSTOMER_TYPES.filter((t) => t.org_id === orgId) as ClientType[];

  const { data, error } = await supabase
    .from("customer_types")
    .select("*")
    .eq("org_id", orgId)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createClientType(orgId: string, name: string, sortOrder: number): Promise<ClientType> {
  const { data, error } = await supabase
    .from("customer_types")
    .insert({ org_id: orgId, name: name.trim(), sort_order: sortOrder })
    .select()
    .single();
  if (error) throw friendly(error);
  return data;
}

export async function updateClientType(
  id: string,
  patch: { name?: string; archived?: boolean }
): Promise<ClientType> {
  const { data, error } = await supabase
    .from("customer_types")
    .update(patch.name !== undefined ? { ...patch, name: patch.name.trim() } : patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw friendly(error);
  return data;
}

/** Clients keep working after a delete — their type just becomes unset. */
export async function deleteClientType(id: string): Promise<void> {
  const { error } = await supabase.from("customer_types").delete().eq("id", id);
  if (error) throw error;
}

function friendly(error: { code?: string; message: string }): Error {
  return new Error(error.code === "23505" ? "A client type with that name already exists." : error.message);
}

import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restPut, restDel } from "@/lib/providers/rest/client";
import type { Customer } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_CUSTOMERS } from "@/lib/demo/data";

export type CustomerPayload = {
  name: string;
  type?: "external" | "internal";
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contract_start?: string;
  contract_end?: string;
  daily_rate?: number;
  notes?: string;
  status?: "active" | "inactive" | "completed";
};

export async function getCustomers(siteId: string): Promise<Customer[]> {
  if (isDemoMode()) return DEMO_CUSTOMERS.filter((c) => c.site_id === siteId) as Customer[];
  if (isRestActive()) return restGet<Customer[]>(`/customers?site_id=${siteId}`);

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("site_id", siteId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createCustomer(
  siteId: string,
  orgId: string,
  payload: CustomerPayload
): Promise<Customer> {
  const fullPayload = { ...payload, site_id: siteId, org_id: orgId };
  if (isRestActive()) return restPost<Customer>("/customers", fullPayload);

  const { data, error } = await supabase
    .from("customers")
    .insert(fullPayload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomer(
  id: string,
  payload: Partial<CustomerPayload>
): Promise<Customer> {
  if (isRestActive()) return restPut<Customer>(`/customers/${id}`, payload);

  const { data, error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCustomer(id: string): Promise<void> {
  if (isRestActive()) return restDel(`/customers/${id}`);

  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
}

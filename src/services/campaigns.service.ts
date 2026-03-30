import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restPut, restDel } from "@/lib/providers/rest/client";
import type { Campaign, CampaignStatus } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_CAMPAIGNS } from "@/lib/demo/data";

export type CampaignPayload = {
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  target_sites?: string[];
};

export async function getCampaigns(orgId: string): Promise<Campaign[]> {
  if (isDemoMode()) return DEMO_CAMPAIGNS as any;
  if (isRestActive())
    return restGet<Campaign[]>(`/campaigns?org_id=${orgId}`);

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCampaign(
  orgId: string,
  payload: CampaignPayload,
  createdBy?: string
): Promise<Campaign> {
  if (isRestActive())
    return restPost<Campaign>("/campaigns", {
      org_id: orgId,
      ...payload,
      status: "draft",
      created_by: createdBy ?? null,
    });

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      org_id: orgId,
      title: payload.title,
      description: payload.description ?? null,
      status: "draft",
      start_date: payload.start_date ?? null,
      end_date: payload.end_date ?? null,
      target_sites: payload.target_sites ?? null,
      created_by: createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCampaignStatus(id: string, status: CampaignStatus): Promise<Campaign> {
  if (isRestActive())
    return restPut<Campaign>(`/campaigns/${id}`, { status });

  const { data, error } = await supabase
    .from("campaigns")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCampaign(id: string): Promise<void> {
  if (isRestActive()) return restDel(`/campaigns/${id}`);

  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) throw error;
}

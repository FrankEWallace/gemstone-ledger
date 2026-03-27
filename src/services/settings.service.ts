import { supabase } from "@/lib/supabase";
import type { Organization } from "@/lib/supabaseTypes";

export type OrgUpdatePayload = {
  name?: string;
  slug?: string;
  logo_url?: string | null;
};

export async function getOrganization(orgId: string): Promise<Organization> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateOrganization(
  orgId: string,
  payload: OrgUpdatePayload
): Promise<Organization> {
  const { data, error } = await supabase
    .from("organizations")
    .update(payload)
    .eq("id", orgId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Uploads a logo file to Supabase Storage bucket `org-assets`.
 * Returns the public URL of the uploaded file.
 * Requires the bucket to be created via Supabase dashboard with public access.
 */
export async function uploadOrgLogo(orgId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `logos/${orgId}.${ext}`;

  const { error } = await supabase.storage
    .from("org-assets")
    .upload(path, file, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("org-assets").getPublicUrl(path);
  return data.publicUrl;
}

export type SupportMessagePayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

/** Submits a support message via the send-support-message Edge Function. */
export async function submitSupportMessage(payload: SupportMessagePayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke("send-support-message", {
    body: payload,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

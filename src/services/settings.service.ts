import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPut, restPost } from "@/lib/providers/rest/client";
import { getBackendConfig } from "@/lib/providers/backendConfig";
import type { Organization } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_ORG } from "@/lib/demo/data";

export type OrgUpdatePayload = {
  name?: string;
  slug?: string;
  logo_url?: string;
  timezone?: string;
  currency?: string;
  disabled_modules?: string[];
};

export type SupportMessagePayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export async function getOrganization(orgId: string): Promise<Organization> {
  if (isDemoMode()) return DEMO_ORG as any;
  if (isRestActive())
    return restGet<Organization>(`/org/${orgId}`);

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
  if (isRestActive())
    return restPut<Organization>(`/org/${orgId}`, payload);

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
 * Upload the org logo.
 * - Supabase: uploads to Storage bucket and returns the public URL.
 * - REST: sends multipart/form-data POST to /org/:id/logo and returns { url }.
 */
export async function uploadOrgLogo(orgId: string, file: File): Promise<string> {
  if (isRestActive()) {
    const { restBaseUrl } = getBackendConfig();
    const token = localStorage.getItem("fwmining_rest_token");

    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${restBaseUrl.replace(/\/$/, "")}/org/${orgId}/logo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? `Upload failed: HTTP ${res.status}`);
    return json.data.url as string;
  }

  const ext = file.name.split(".").pop();
  const path = `${orgId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("org-assets")
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("org-assets").getPublicUrl(path);
  return data.publicUrl;
}

export async function submitSupportMessage(payload: SupportMessagePayload): Promise<void> {
  if (isRestActive()) {
    await restPost("/support/message", payload);
    return;
  }

  const { error } = await supabase.functions.invoke("send-support-message", {
    body: payload,
  });
  if (error) throw error;
}

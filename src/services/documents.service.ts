import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restDel } from "@/lib/providers/rest/client";
import { getBackendConfig } from "@/lib/providers/backendConfig";
import type { SiteDocument } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_DOCUMENTS } from "@/lib/demo/data";

export async function getSiteDocuments(siteId: string): Promise<SiteDocument[]> {
  if (isDemoMode()) return DEMO_DOCUMENTS as any;
  if (isRestActive())
    return restGet<SiteDocument[]>(`/documents?site_id=${siteId}`);

  const { data, error } = await supabase
    .from("site_documents")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Upload a document.
 * - Supabase: uploads to Storage bucket then inserts a metadata row.
 * - REST: sends a multipart/form-data POST to /documents/upload.
 */
export async function uploadDocument(
  siteId: string,
  file: File,
  category?: string,
  uploadedBy?: string
): Promise<SiteDocument> {
  if (isRestActive()) {
    const { restBaseUrl } = getBackendConfig();
    const token = localStorage.getItem("fwmining_rest_token");

    const form = new FormData();
    form.append("file", file);
    form.append("site_id", siteId);
    if (category) form.append("category", category);
    if (uploadedBy) form.append("uploaded_by", uploadedBy);

    const res = await fetch(`${restBaseUrl.replace(/\/$/, "")}/documents/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? `Upload failed: HTTP ${res.status}`);
    return json.data as SiteDocument;
  }

  const ext = file.name.split(".").pop();
  const path = `${siteId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("site-documents")
    .upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from("site_documents")
    .insert({
      site_id: siteId,
      name: file.name,
      storage_path: path,
      file_type: file.type,
      file_size: file.size,
      category: category ?? null,
      uploaded_by: uploadedBy ?? null,
    })
    .select()
    .single();
  if (insertError) throw insertError;
  return data;
}

export async function getDocumentUrl(storagePath: string): Promise<string> {
  if (isRestActive()) {
    // REST: the storage_path IS the full URL returned by the PHP upload endpoint
    return storagePath;
  }

  const { data, error } = await supabase.storage
    .from("site-documents")
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteSiteDocument(doc: SiteDocument): Promise<void> {
  if (isRestActive()) {
    await restDel(`/documents/${doc.id}`);
    return;
  }

  await supabase.storage.from("site-documents").remove([doc.storage_path]);
  const { error } = await supabase.from("site_documents").delete().eq("id", doc.id);
  if (error) throw error;
}

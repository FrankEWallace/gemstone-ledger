import { supabase } from "@/lib/supabase";
import type { SiteDocument } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_DOCUMENTS } from "@/lib/demo/data";

const BUCKET = "site-documents";

export async function getSiteDocuments(siteId: string): Promise<SiteDocument[]> {
  if (isDemoMode()) return DEMO_DOCUMENTS as any;
  const { data, error } = await supabase
    .from("site_documents")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function uploadDocument(
  siteId: string,
  file: File,
  category: string | undefined,
  uploadedBy: string | undefined
): Promise<SiteDocument> {
  const ext = file.name.split(".").pop();
  const path = `${siteId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("site_documents")
    .insert({
      site_id: siteId,
      uploaded_by: uploadedBy ?? null,
      name: file.name,
      category: category || null,
      storage_path: path,
      file_size: file.size,
      mime_type: file.type,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getDocumentUrl(storagePath: string): Promise<string> {
  if (isDemoMode()) return "#";
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60); // 1 hour
  if (!data?.signedUrl) throw new Error("Could not generate download URL.");
  return data.signedUrl;
}

export async function deleteSiteDocument(doc: SiteDocument): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([doc.storage_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from("site_documents").delete().eq("id", doc.id);
  if (error) throw error;
}

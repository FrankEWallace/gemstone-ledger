import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restPost } from "@/lib/providers/rest/client";

/**
 * Create a new site for the current user's organization and return its id.
 * Backed by the `create_site` RPC (SECURITY DEFINER): it enforces that the
 * caller is an org owner/admin, inserts the site, and grants the creator the
 * `admin` site role in one transaction.
 */
export async function createSite(name: string, location?: string): Promise<string> {
  if (isRestActive()) {
    return restPost<string>("/sites", {
      name: name.trim(),
      location: location?.trim() || null,
    });
  }

  const { data, error } = await supabase.rpc("create_site", {
    p_name: name.trim(),
    p_location: location?.trim() ? location.trim() : null,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Site was not created.");
  return data;
}

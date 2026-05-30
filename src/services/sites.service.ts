import { supabase } from "@/lib/supabase";

/**
 * Create a new site for the current user's organization and return its id.
 * Backed by the `create_site` RPC (SECURITY DEFINER): it enforces that the
 * caller is an org owner/admin, inserts the site, and grants the creator the
 * `admin` site role in one transaction.
 */
export async function createSite(name: string, location?: string): Promise<string> {
  // `create_site` isn't in the generated Database types, so call it untyped.
  const { data, error } = await (supabase.rpc as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: string | null; error: { message: string } | null }>)("create_site", {
    p_name: name.trim(),
    p_location: location?.trim() ? location.trim() : null,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Site was not created.");
  return data;
}

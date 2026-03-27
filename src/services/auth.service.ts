import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/lib/supabaseTypes";

export type OrgUser = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  org_id: string | null;
  created_at: string;
  site_roles: { site_id: string; site_name: string; role: UserRole }[];
};

/**
 * Returns all users in the org with their site role assignments.
 * Fetches user_profiles + user_site_roles + sites in one pass.
 */
export async function getOrgUsers(orgId: string): Promise<OrgUser[]> {
  const { data: profiles, error: profErr } = await supabase
    .from("user_profiles")
    .select("id, full_name, avatar_url, org_id, created_at")
    .eq("org_id", orgId)
    .order("full_name");
  if (profErr) throw profErr;

  const { data: roleRows, error: roleErr } = await supabase
    .from("user_site_roles")
    .select("user_id, site_id, role, sites(name)")
    .in("user_id", (profiles ?? []).map((p) => p.id));
  if (roleErr) throw roleErr;

  return (profiles ?? []).map((profile) => {
    const roles = (roleRows ?? [])
      .filter((r) => r.user_id === profile.id)
      .map((r) => ({
        site_id: r.site_id,
        site_name: (r.sites as { name: string } | null)?.name ?? "Unknown",
        role: r.role,
      }));
    return { ...profile, site_roles: roles };
  });
}

export async function updateUserRole(
  userId: string,
  siteId: string,
  role: UserRole
): Promise<void> {
  const { error } = await supabase
    .from("user_site_roles")
    .update({ role })
    .eq("user_id", userId)
    .eq("site_id", siteId);
  if (error) throw error;
}

export async function removeUserFromSite(userId: string, siteId: string): Promise<void> {
  const { error } = await supabase
    .from("user_site_roles")
    .delete()
    .eq("user_id", userId)
    .eq("site_id", siteId);
  if (error) throw error;
}

/**
 * Invites a user by email via the invite-user Edge Function.
 * The Edge Function uses auth.admin to send the invite email and sets
 * org_id / site_id / role in user_metadata so the signup trigger can
 * create the profile and role rows automatically.
 */
export async function inviteUser(payload: {
  email: string;
  org_id: string;
  site_id: string;
  role: UserRole;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke("invite-user", {
    body: payload,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPut, restPost, restDel } from "@/lib/providers/rest/client";
import type { OrgUser, OrgRole, OrgUserSiteRole, UserRole } from "@/lib/supabaseTypes";
export type { OrgUser, UserRole } from "@/lib/supabaseTypes";

export async function getOrgUsers(orgId: string): Promise<OrgUser[]> {
  if (isRestActive())
    return restGet<OrgUser[]>(`/org-users?org_id=${orgId}`);

  // Backed by the `get_org_users` SECURITY DEFINER RPC: RLS on user_site_roles
  // only exposes a caller's own roles, so other members' roles can't be read by
  // a plain client query. The RPC returns every org member with their per-site
  // roles aggregated as JSON (and email from auth.users).
  const { data, error } = await supabase.rpc("get_org_users", { p_org_id: orgId });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    avatar_url: row.avatar_url,
    created_at: row.created_at,
    org_role: (row.org_role ?? undefined) as OrgRole | undefined,
    site_roles: (row.site_roles ?? []) as unknown as OrgUserSiteRole[],
  }));
}

export async function updateUserRole(
  userId: string,
  siteId: string,
  role: UserRole
): Promise<void> {
  if (isRestActive()) {
    await restPut("/user-site-roles", { user_id: userId, site_id: siteId, role });
    return;
  }

  const { error } = await supabase
    .from("user_site_roles")
    .update({ role })
    .eq("user_id", userId)
    .eq("site_id", siteId);
  if (error) throw error;
}

export async function removeUserFromSite(userId: string, siteId: string): Promise<void> {
  if (isRestActive()) {
    await restDel(`/user-site-roles?user_id=${userId}&site_id=${siteId}`);
    return;
  }

  const { error } = await supabase
    .from("user_site_roles")
    .delete()
    .eq("user_id", userId)
    .eq("site_id", siteId);
  if (error) throw error;
}

export async function inviteUser(payload: {
  email: string;
  org_id: string;
  site_id: string;
  role: UserRole;
}): Promise<void> {
  if (isRestActive()) {
    await restPost("/invite-user", payload);
    return;
  }

  const { error } = await supabase.functions.invoke("invite-user", { body: payload });
  if (error) throw error;
}

export async function updateSite(
  siteId: string,
  payload: { name?: string; location?: string }
): Promise<void> {
  if (isRestActive()) {
    await restPut(`/sites/${siteId}`, payload);
    return;
  }

  const { error } = await supabase
    .from("sites")
    .update(payload)
    .eq("id", siteId);
  if (error) throw error;
}

export async function getOrgSites(orgId: string): Promise<{ id: string; name: string; location: string | null; status: string }[]> {
  if (isRestActive()) {
    return restGet(`/sites?org_id=${orgId}`);
  }

  const { data, error } = await supabase
    .from("sites")
    .select("id, name, location, status")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

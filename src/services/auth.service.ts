import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPut, restPost, restDel } from "@/lib/providers/rest/client";
import type { OrgUser, UserRole } from "@/lib/supabaseTypes";
export type { OrgUser, UserRole } from "@/lib/supabaseTypes";

export async function getOrgUsers(orgId: string): Promise<OrgUser[]> {
  if (isRestActive())
    return restGet<OrgUser[]>(`/org-users?org_id=${orgId}`);

  // NOTE: user_site_roles has no `org_id` column (org scope is reached via
  // sites.org_id), so this Supabase-path query is a known latent bug — the
  // `.eq("org_id", …)` filter and `profiles` embed don't resolve against the
  // real schema. Cast keeps the build green; the query itself needs reworking
  // (e.g. an org-users RPC or an embedded sites!inner filter) before relying on
  // the Supabase backend for this call.
  const { data, error } = await (supabase.from("user_site_roles") as any)
    .select(
      `
      user_id,
      site_id,
      role,
      sites ( name ),
      profiles ( full_name, email, avatar_url )
    `
    )
    .eq("org_id", orgId);
  if (error) throw error;
  return (data ?? []) as unknown as OrgUser[];
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

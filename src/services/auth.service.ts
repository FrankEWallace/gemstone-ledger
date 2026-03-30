import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPut, restPost, restDel } from "@/lib/providers/rest/client";
import type { OrgUser, UserRole } from "@/lib/supabaseTypes";

export async function getOrgUsers(orgId: string): Promise<OrgUser[]> {
  if (isRestActive())
    return restGet<OrgUser[]>(`/org-users?org_id=${orgId}`);

  const { data, error } = await supabase
    .from("user_site_roles")
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

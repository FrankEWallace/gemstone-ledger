import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restPut, restPost } from "@/lib/providers/rest/client";
import { isDemoMode } from "@/lib/demo";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
  type UserProfile,
} from "@/lib/supabaseTypes";

export type ProfileUpdatePayload = {
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  notification_prefs?: NotificationPrefs;
};

/**
 * Read a profile's notification preferences, applying defaults for any key
 * that's missing or for an entirely absent/legacy blob. Always returns a
 * complete object so the UI never has to null-check individual toggles.
 */
export function resolveNotificationPrefs(profile: UserProfile | null): NotificationPrefs {
  const raw = (profile?.notification_prefs ?? null) as Partial<NotificationPrefs> | null;
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(raw ?? {}) };
}

export async function updateUserProfile(
  userId: string,
  payload: ProfileUpdatePayload
): Promise<UserProfile> {
  if (isRestActive()) {
    return restPut<UserProfile>("/profile", payload);
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .update(payload)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function changePassword(newPassword: string): Promise<void> {
  if (isDemoMode()) throw new Error("Password changes are not available in demo mode.");

  if (isRestActive()) {
    await restPost<void>("/auth/change-password", { password: newPassword });
    return;
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function changeEmail(newEmail: string): Promise<void> {
  if (isDemoMode()) throw new Error("Email changes are not available in demo mode.");

  if (isRestActive()) {
    await restPost<void>("/auth/change-email", { email: newEmail });
    return;
  }

  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;
}

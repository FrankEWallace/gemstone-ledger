import { supabase } from "@/lib/supabase";
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
  const { data, error } = await supabase
    .from("user_profiles")
    .update(payload)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Upload a user avatar to the `user-avatars` storage bucket.
 * Returns the public URL of the uploaded file.
 *
 * Requires the `user-avatars` bucket to be created in Supabase Storage
 * with public access enabled.
 */
export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("user-avatars")
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("user-avatars").getPublicUrl(path);
  return data.publicUrl;
}

export async function changePassword(newPassword: string): Promise<void> {
  if (isDemoMode()) throw new Error("Password changes are not available in demo mode.");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function changeEmail(newEmail: string): Promise<void> {
  if (isDemoMode()) throw new Error("Email changes are not available in demo mode.");
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;
}

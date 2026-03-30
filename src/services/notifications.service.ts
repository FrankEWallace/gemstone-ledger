import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost } from "@/lib/providers/rest/client";
import type { Notification } from "@/lib/supabaseTypes";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { isDemoMode } from "@/lib/demo";
import { DEMO_NOTIFICATIONS } from "@/lib/demo/data";

export async function getNotifications(userId: string, limit = 30): Promise<Notification[]> {
  if (isDemoMode()) return DEMO_NOTIFICATIONS as any;
  if (isRestActive())
    return restGet<Notification[]>(`/notifications?user_id=${userId}&limit=${limit}`);

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function markAsRead(id: string): Promise<void> {
  if (isRestActive()) {
    await restPost(`/notifications/${id}/read`, {});
    return;
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllAsRead(userId: string): Promise<void> {
  if (isRestActive()) {
    await restPost("/notifications/read-all", { user_id: userId });
    return;
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw error;
}

/**
 * Subscribe to new notifications.
 * - Supabase: Postgres Realtime (push).
 * - REST: polls GET /notifications?user_id=&unread=true&after=<timestamp> every 8s.
 */
export function subscribeToNotifications(
  userId: string,
  onNew: (notification: Notification) => void
): RealtimeChannel {
  if (isRestActive()) {
    let lastTimestamp = new Date().toISOString();
    const timer = setInterval(async () => {
      try {
        const items = await restGet<Notification[]>(
          `/notifications?user_id=${userId}&after=${encodeURIComponent(lastTimestamp)}&limit=10`
        );
        if (items.length > 0) {
          lastTimestamp = items[0].created_at;
          items.forEach(onNew);
        }
      } catch {
        // silently ignore poll errors
      }
    }, 8000);
    return { unsubscribe: () => clearInterval(timer) } as unknown as RealtimeChannel;
  }

  return supabase
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onNew(payload.new as Notification)
    )
    .subscribe();
}

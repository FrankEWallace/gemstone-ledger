import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost } from "@/lib/providers/rest/client";
import type { Message, MessageChannel } from "@/lib/supabaseTypes";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { isDemoMode } from "@/lib/demo";
import { DEMO_MESSAGES } from "@/lib/demo/data";

export async function getMessages(
  siteId: string,
  channel: MessageChannel,
  limit = 60
): Promise<Message[]> {
  if (isDemoMode())
    return DEMO_MESSAGES.filter((m) => m.channel === channel) as any;
  if (isRestActive())
    return restGet<Message[]>(
      `/messages?site_id=${siteId}&channel=${channel}&limit=${limit}`
    );

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("site_id", siteId)
    .eq("channel", channel)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function sendMessage(
  siteId: string,
  senderId: string,
  content: string,
  channel: MessageChannel
): Promise<Message> {
  if (isRestActive())
    return restPost<Message>("/messages", {
      site_id: siteId,
      sender_id: senderId,
      content,
      channel,
    });

  const { data, error } = await supabase
    .from("messages")
    .insert({ site_id: siteId, sender_id: senderId, content, channel })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Subscribe to new messages.
 * - Supabase: uses Postgres Realtime (push).
 * - REST: polls GET /messages?site_id=&channel=&after=<timestamp> every 4s.
 *   Returns a fake channel object with an unsubscribe() method to match the
 *   Supabase RealtimeChannel interface used by callers.
 */
export function subscribeToMessages(
  siteId: string,
  channel: MessageChannel,
  onNewMessage: (msg: Message) => void
): RealtimeChannel {
  if (isRestActive()) {
    let lastTimestamp = new Date().toISOString();
    const timer = setInterval(async () => {
      try {
        const msgs = await restGet<Message[]>(
          `/messages?site_id=${siteId}&channel=${channel}&after=${encodeURIComponent(lastTimestamp)}`
        );
        if (msgs.length > 0) {
          lastTimestamp = msgs[msgs.length - 1].created_at;
          msgs.forEach(onNewMessage);
        }
      } catch {
        // silently ignore poll errors
      }
    }, 4000);
    return { unsubscribe: () => clearInterval(timer) } as unknown as RealtimeChannel;
  }

  return supabase
    .channel(`messages-${siteId}-${channel}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `site_id=eq.${siteId}`,
      },
      (payload) => {
        const msg = payload.new as Message;
        if (msg.channel === channel) onNewMessage(msg);
      }
    )
    .subscribe();
}

export async function getChannelMessageCounts(
  siteId: string,
  since: string
): Promise<Record<MessageChannel, number>> {
  if (isDemoMode()) return { general: 3, safety: 1, operations: 2 };
  if (isRestActive())
    return restGet<Record<MessageChannel, number>>(
      `/messages/counts?site_id=${siteId}&since=${encodeURIComponent(since)}`
    );

  const { data, error } = await supabase
    .from("messages")
    .select("channel")
    .eq("site_id", siteId)
    .gte("created_at", since);
  if (error) return { general: 0, safety: 0, operations: 0 };

  const counts: Record<MessageChannel, number> = { general: 0, safety: 0, operations: 0 };
  for (const row of data ?? []) {
    counts[row.channel as MessageChannel] = (counts[row.channel as MessageChannel] ?? 0) + 1;
  }
  return counts;
}

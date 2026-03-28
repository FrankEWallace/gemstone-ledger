import { supabase } from "@/lib/supabase";
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
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("site_id", siteId)
    .eq("channel", channel)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  // Return in chronological order for display
  return (data ?? []).reverse();
}

export async function sendMessage(
  siteId: string,
  senderId: string,
  content: string,
  channel: MessageChannel
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ site_id: siteId, sender_id: senderId, content, channel })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function subscribeToMessages(
  siteId: string,
  channel: MessageChannel,
  onNewMessage: (msg: Message) => void
): RealtimeChannel {
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
        if (msg.channel === channel) {
          onNewMessage(msg);
        }
      }
    )
    .subscribe();
}

/** Returns message counts per channel since a given timestamp (for unread badge). */
export async function getChannelMessageCounts(
  siteId: string,
  since: string
): Promise<Record<MessageChannel, number>> {
  if (isDemoMode()) return { general: 3, safety: 1, operations: 2 };
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

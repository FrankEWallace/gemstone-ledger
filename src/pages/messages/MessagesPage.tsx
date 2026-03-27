import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Shield, Settings, MessageSquare } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";

import { useSite } from "@/hooks/useSite";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Message, MessageChannel } from "@/lib/supabaseTypes";
import {
  getMessages,
  sendMessage,
  subscribeToMessages,
} from "@/services/messages.service";
import { supabase } from "@/lib/supabase";

// ─── Channel config ───────────────────────────────────────────────────────────

const CHANNELS: { id: MessageChannel; label: string; icon: React.ElementType; description: string }[] = [
  { id: "general", label: "General", icon: MessageSquare, description: "Team-wide announcements and chat" },
  { id: "safety", label: "Safety", icon: Shield, description: "Safety alerts and incident reports" },
  { id: "operations", label: "Operations", icon: Settings, description: "Operational coordination and updates" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateLabel(isoString: string): string {
  const d = new Date(isoString);
  if (isToday(d)) return `Today at ${format(d, "h:mm a")}`;
  if (isYesterday(d)) return `Yesterday at ${format(d, "h:mm a")}`;
  return format(d, "MMM d 'at' h:mm a");
}

function userInitials(name: string | null | undefined) {
  if (!name) return "??";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Message bubble ───────────────────────────────────────────────────────────

interface SenderCache {
  [userId: string]: string | null;
}

function MessageBubble({ msg, isMine, senderName }: { msg: Message; isMine: boolean; senderName: string | null }) {
  return (
    <div className={cn("flex gap-2.5 group", isMine && "flex-row-reverse")}>
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        isMine ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        {userInitials(senderName)}
      </div>
      <div className={cn("max-w-[75%] space-y-1", isMine && "items-end flex flex-col")}>
        <div className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground",
          isMine && "flex-row-reverse"
        )}>
          <span className="font-medium">{isMine ? "You" : (senderName ?? "Unknown")}</span>
          <span>{dateLabel(msg.created_at)}</span>
        </div>
        <div className={cn(
          "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          isMine
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-muted"
        )}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { activeSiteId } = useSite();
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();

  const [activeChannel, setActiveChannel] = useState<MessageChannel>("general");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [senderCache, setSenderCache] = useState<SenderCache>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch initial messages for active channel
  const { isLoading } = useQuery({
    queryKey: ["messages", activeSiteId, activeChannel],
    queryFn: async () => {
      const msgs = await getMessages(activeSiteId!, activeChannel);
      setMessages(msgs);
      return msgs;
    },
    enabled: !!activeSiteId,
    staleTime: 0,
  });

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription — resubscribe when channel or site changes
  useEffect(() => {
    if (!activeSiteId) return;
    const realtimeChannel = subscribeToMessages(activeSiteId, activeChannel, (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });
    return () => { supabase.removeChannel(realtimeChannel); };
  }, [activeSiteId, activeChannel]);

  // Fetch sender names on demand and cache them
  const resolveSenderName = useCallback(
    async (senderId: string | null) => {
      if (!senderId || senderCache[senderId] !== undefined) return;
      setSenderCache((prev) => ({ ...prev, [senderId]: null })); // mark as fetching
      const { data } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", senderId)
        .single();
      setSenderCache((prev) => ({ ...prev, [senderId]: data?.full_name ?? null }));
    },
    [senderCache]
  );

  // Resolve sender names for all visible messages
  useEffect(() => {
    const unknown = messages.filter((m) => m.sender_id && senderCache[m.sender_id] === undefined);
    unknown.forEach((m) => resolveSenderName(m.sender_id));
  }, [messages, resolveSenderName, senderCache]);

  async function handleSend() {
    if (!draft.trim() || !activeSiteId || !user?.id) return;
    setIsSending(true);
    try {
      await sendMessage(activeSiteId, user.id, draft.trim(), activeChannel);
      setDraft("");
      // Invalidate so unread counts elsewhere update
      queryClient.invalidateQueries({ queryKey: ["messages", activeSiteId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function switchChannel(ch: MessageChannel) {
    setActiveChannel(ch);
    setMessages([]);
    queryClient.invalidateQueries({ queryKey: ["messages", activeSiteId, ch] });
  }

  const activeMeta = CHANNELS.find((c) => c.id === activeChannel)!;

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden">
      {/* Channel sidebar — desktop only */}
      <div className="hidden sm:flex w-56 shrink-0 border-r border-border bg-muted/20 flex-col">
        <div className="p-3 border-b border-border">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Channels</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            return (
              <button
                key={ch.id}
                onClick={() => switchChannel(ch.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors",
                  activeChannel === ch.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="capitalize">{ch.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile channel tab bar */}
        <div className="sm:hidden flex border-b border-border bg-muted/20 shrink-0">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            return (
              <button
                key={ch.id}
                onClick={() => switchChannel(ch.id)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-xs font-medium transition-colors border-b-2",
                  activeChannel === ch.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{ch.label}</span>
              </button>
            );
          })}
        </div>

        {/* Channel header — desktop */}
        <div className="hidden sm:block border-b border-border px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <activeMeta.icon className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold capitalize">{activeMeta.label}</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{activeMeta.description}</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                    <div className="h-10 w-64 bg-muted animate-pulse rounded-2xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <activeMeta.icon className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">No messages yet</p>
              <p className="text-sm mt-1">Be the first to post in #{activeMeta.label.toLowerCase()}.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isMine={msg.sender_id === user?.id}
                senderName={
                  msg.sender_id === user?.id
                    ? userProfile?.full_name ?? null
                    : senderCache[msg.sender_id ?? ""] ?? null
                }
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3 shrink-0">
          <div className="flex gap-2 items-end">
            <Textarea
              placeholder={`Message #${activeMeta.label.toLowerCase()}… (Enter to send, Shift+Enter for newline)`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="resize-none min-h-[40px] max-h-32"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!draft.trim() || isSending}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

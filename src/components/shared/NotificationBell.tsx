import { useState, useEffect } from "react";
import { Bell, CheckCheck, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Notification, NotificationType } from "@/lib/supabaseTypes";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  subscribeToNotifications,
} from "@/services/notifications.service";
import { supabase } from "@/lib/supabase";

// ─── Type icon + colour ───────────────────────────────────────────────────────

const TYPE_META: Record<NotificationType, { icon: React.ElementType; color: string }> = {
  alert: { icon: AlertCircle, color: "text-red-500" },
  warning: { icon: AlertTriangle, color: "text-yellow-500" },
  info: { icon: Info, color: "text-blue-500" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Initial load
  useEffect(() => {
    if (!user?.id) return;
    getNotifications(user.id).then((data) => {
      setNotifications(data);
      setLoaded(true);
    });
  }, [user?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = subscribeToNotifications(user.id, (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
      toast(newNotif.title ?? "New notification", {
        description: newNotif.body ?? undefined,
        icon: newNotif.type === "alert" ? "🚨" : newNotif.type === "warning" ? "⚠️" : "ℹ️",
      });
    });
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  async function handleMarkRead(id: string) {
    await markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  async function handleMarkAllRead() {
    if (!user?.id) return;
    await markAllAsRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative rounded-lg p-2 hover:bg-accent transition-colors">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="font-semibold text-sm">Notifications</p>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto">
          {!loaded ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-7 w-7 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notif, i) => {
              const meta = TYPE_META[notif.type];
              const Icon = meta.icon;
              return (
                <button
                  key={notif.id}
                  onClick={() => !notif.read && handleMarkRead(notif.id)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                    !notif.read && "bg-primary/5",
                    i < notifications.length - 1 && "border-b border-border/50"
                  )}
                >
                  <div className={cn("mt-0.5 shrink-0", meta.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm leading-snug", !notif.read && "font-medium")}>
                        {notif.title ?? "Notification"}
                      </p>
                      {!notif.read && (
                        <span className="shrink-0 h-2 w-2 rounded-full bg-primary mt-1" />
                      )}
                    </div>
                    {notif.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

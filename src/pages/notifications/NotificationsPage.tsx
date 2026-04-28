import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCheck,
  ChevronRight,
  X,
  Package,
  Users,
  TrendingDown,
  FileText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import { useSystemAlerts, type SystemAlert, type SystemAlertCategory } from "@/hooks/useSystemAlerts";
import { getNotifications, markAsRead, markAllAsRead } from "@/services/notifications.service";
import { supabase } from "@/lib/supabase";
import { subscribeToNotifications } from "@/services/notifications.service";
import type { Notification, NotificationType } from "@/lib/supabaseTypes";

// ─── System alert config ──────────────────────────────────────────────────────

const LEVEL_META = {
  critical: {
    icon: AlertCircle,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    label: "Critical",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    border: "border-yellow-200 dark:border-yellow-800",
    label: "Warning",
  },
  info: {
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    label: "Info",
  },
} as const;

const CATEGORY_META: Record<SystemAlertCategory, { icon: React.ElementType; label: string }> = {
  contracts: { icon: FileText, label: "Contracts" },
  customers: { icon: Users,    label: "Customers" },
  financials: { icon: TrendingDown, label: "Financials" },
  inventory:  { icon: Package, label: "Inventory" },
};

const NOTIF_TYPE_META: Record<NotificationType, { icon: React.ElementType; color: string }> = {
  alert:   { icon: AlertCircle,   color: "text-red-500" },
  warning: { icon: AlertTriangle, color: "text-yellow-500" },
  info:    { icon: Info,          color: "text-blue-500" },
};

// ─── System Alert Card ────────────────────────────────────────────────────────

function SystemAlertCard({ alert, onDismiss }: { alert: SystemAlert; onDismiss: () => void }) {
  const level = LEVEL_META[alert.level];
  const cat   = CATEGORY_META[alert.category];
  const Icon  = level.icon;
  const CatIcon = cat.icon;

  return (
    <div className={cn("rounded-xl border p-4 flex items-start gap-3", level.bg, level.border)}>
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", level.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider", level.color)}>
            {level.label}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <CatIcon className="h-3 w-3" />
            {cat.label}
          </span>
        </div>
        {alert.href ? (
          <Link
            to={alert.href}
            className="text-sm hover:underline underline-offset-2 leading-snug"
          >
            {alert.message}
            <ChevronRight className="inline h-3 w-3 ml-0.5 opacity-60" />
          </Link>
        ) : (
          <p className="text-sm leading-snug">{alert.message}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded p-1 opacity-50 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Push Notification Row ────────────────────────────────────────────────────

function NotifRow({
  notif,
  onRead,
  isLast,
}: {
  notif: Notification;
  onRead: () => void;
  isLast: boolean;
}) {
  const meta = NOTIF_TYPE_META[notif.type] ?? NOTIF_TYPE_META["info"];
  const Icon = meta.icon;

  return (
    <button
      onClick={() => !notif.read && onRead()}
      className={cn(
        "w-full flex items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40",
        !notif.read && "bg-primary/5",
        !isLast && "border-b border-border/50"
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
          <p className="text-xs text-muted-foreground mt-0.5">{notif.body}</p>
        )}
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { user } = useAuth();
  const { activeSiteId } = useSite();

  const { alerts, totalCount, criticalCount, dismiss, dismissAll } = useSystemAlerts(activeSiteId);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifsLoaded, setNotifsLoaded] = useState(false);

  const unreadDbCount = notifications.filter((n) => !n.read).length;

  // Load DB push notifications
  useEffect(() => {
    if (!user?.id) return;
    getNotifications(user.id).then((data) => {
      setNotifications(data);
      setNotifsLoaded(true);
    });
  }, [user?.id]);

  // Real-time subscription for new push notifications
  useEffect(() => {
    if (!user?.id) return;
    const channel = subscribeToNotifications(user.id, (n) => {
      setNotifications((prev) => [n, ...prev]);
    });
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  async function handleMarkRead(id: string) {
    await markAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  async function handleMarkAllRead() {
    if (!user?.id) return;
    await markAllAsRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const hasAnything = totalCount > 0 || notifications.length > 0;

  return (
    <div className="p-4 lg:p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalCount > 0
              ? `${totalCount} system alert${totalCount !== 1 ? "s" : ""}${criticalCount > 0 ? ` · ${criticalCount} critical` : ""}`
              : "No active system alerts"}
            {unreadDbCount > 0 && ` · ${unreadDbCount} unread push notification${unreadDbCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        {hasAnything && (
          <div className="flex items-center gap-2 shrink-0">
            {totalCount > 0 && (
              <button
                onClick={dismissAll}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg border border-border px-3 py-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Dismiss alerts
              </button>
            )}
            {unreadDbCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg border border-border px-3 py-1.5"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>
        )}
      </div>

      {/* System Alerts */}
      <section>
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-3">
          System Alerts
        </p>

        {totalCount === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2 opacity-25" />
            <p className="text-sm font-medium">No active alerts</p>
            <p className="text-xs mt-1">
              Alerts appear here when contracts are expiring, inventory is low, or financial thresholds are exceeded.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <SystemAlertCard
                key={alert.id}
                alert={alert}
                onDismiss={() => dismiss(alert.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Push Notifications */}
      <section>
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-3">
          Push Notifications
        </p>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {!notifsLoaded ? (
            <div className="p-5 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-7 w-7 rounded-full bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-25" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs mt-1">Push notifications from system triggers will appear here.</p>
            </div>
          ) : (
            notifications.map((notif, i) => (
              <NotifRow
                key={notif.id}
                notif={notif}
                onRead={() => handleMarkRead(notif.id)}
                isLast={i === notifications.length - 1}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import type { Notification } from "@/lib/supabaseTypes";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  subscribeToNotifications,
} from "@/services/notifications.service";

/**
 * One source of truth for push notifications, shared by the bell and the
 * Notifications page so read-state never drifts between them.
 */
export function useNotifications(onNew?: (n: Notification) => void) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const key = ["notifications", userId];

  const query = useQuery({
    queryKey: key,
    queryFn: () => getNotifications(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    return subscribeToNotifications(userId, (incoming) => {
      queryClient.setQueryData<Notification[]>(["notifications", userId], (prev = []) =>
        prev.some((n) => n.id === incoming.id) ? prev : [incoming, ...prev]
      );
      onNew?.(incoming);
    });
    // onNew is intentionally excluded: callers pass inline closures
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, queryClient]);

  function patch(updater: (list: Notification[]) => Notification[]) {
    queryClient.setQueryData<Notification[]>(key, (prev = []) => updater(prev));
  }

  const read = useMutation({
    mutationFn: markAsRead,
    onMutate: (id: string) => {
      const previous = queryClient.getQueryData<Notification[]>(key);
      patch((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
      return { previous };
    },
    onError: (_e, _id, ctx) => queryClient.setQueryData(key, ctx?.previous),
  });

  const readAll = useMutation({
    mutationFn: () => markAllAsRead(userId!),
    onMutate: () => {
      const previous = queryClient.getQueryData<Notification[]>(key);
      patch((list) => list.map((n) => ({ ...n, read: true })));
      return { previous };
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(key, ctx?.previous),
  });

  const notifications = query.data ?? [];
  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    isLoading: query.isLoading,
    isError: query.isError,
    markRead: (id: string) => read.mutate(id),
    markAllRead: () => readAll.mutate(),
  };
}

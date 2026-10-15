import { useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase";
import { fetchUnreadCount } from "./api";

/** Root of every notifications query key, so one invalidation refreshes list and badge. */
export const NOTIFICATIONS_KEY = "teacher-notifications";

/**
 * Subscribes to new and changed rows of the teacher's own notifications (channel
 * `notifications:{uid}`, API-CONTRACT) and refreshes the list and unread badge on every event.
 * A reconnect refetches too, so nothing is missed while offline.
 */
export function useNotificationsRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();
  const instance = useId();

  useEffect(() => {
    if (!userId) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
    const channel = supabase
      .channel(`notifications:${userId}:${instance}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        refresh,
      )
      .subscribe((status) => {
        if (String(status) === "SUBSCRIBED") refresh();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, instance, queryClient]);
}

/**
 * Unread count for the bell and sidebar badge. Shares its query key with the inbox page, so
 * reading a notification updates every badge at once.
 */
export function useUnreadNotificationCount(userId: string | undefined) {
  useNotificationsRealtime(userId);
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, "unread", userId],
    queryFn: () => fetchUnreadCount(userId!),
    enabled: Boolean(userId),
  });
}

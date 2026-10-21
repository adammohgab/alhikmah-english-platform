import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase";

export const NOTIFICATIONS_KEY = "student-notifications";

export function useStudentNotificationsRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const refresh = () => void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
    const channel = supabase
      .channel(`student-notifications:${userId}`)
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
  }, [queryClient, userId]);
}

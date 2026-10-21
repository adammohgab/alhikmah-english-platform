import { useEffect, useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase";
import { ANNOUNCEMENTS_KEY } from "./api";

/**
 * Refreshes the feed and read rates whenever a student opens an announcement. Realtime only
 * delivers rows the teacher may read (`announcement_recipients_select_author`), so the
 * subscription covers the teacher's own announcements and nothing else.
 */
export function useReceiptsRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();
  const instance = useId();

  useEffect(() => {
    if (!userId) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: [ANNOUNCEMENTS_KEY] });
    const channel = supabase
      .channel(`announcement-receipts:${userId}:${instance}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "announcement_recipients" },
        refresh,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, instance, queryClient]);
}

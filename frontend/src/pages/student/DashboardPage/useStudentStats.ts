import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "@/app/providers/auth-context";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import { levelProgress, rankTitle, type LevelProgress } from "./rules";

/* ========================================
   useStudentStats (STU-CORE-01)

   The student's XP, level, coins and streak from their own `student_stats` row. A student who
   has not earned anything yet has no row, which reads as level 1 with zeros rather than an error.
   Level progress (XP inside the level, XP to the next one) is derived with the same formula the
   `award_xp` function uses, so the bar and the stored level always agree.
   ======================================== */

const statsRow = z.object({
  total_xp: z.coerce.number(),
  current_level: z.coerce.number(),
  current_coins: z.coerce.number(),
  current_streak: z.coerce.number(),
  streak_freeze_count: z.coerce.number().nullish(),
});

export interface StudentStats {
  totalXp: number;
  level: number;
  rank: string;
  coins: number;
  streak: number;
  freezes: number;
  progress: LevelProgress;
}

interface StatsClient {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => PromiseLike<{
          data: unknown;
          error: { message: string; code?: string } | null;
        }>;
      };
    };
  };
}

export const STUDENT_STATS_KEY = "student-stats";

export async function fetchStudentStats(userId: string): Promise<StudentStats> {
  const result = await (supabase as unknown as StatsClient)
    .from("student_stats")
    .select("total_xp, current_level, current_coins, current_streak, streak_freeze_count")
    .eq("student_id", userId)
    .maybeSingle();
  if (result.error) throw new Error(normalizeApiError(result.error).message);

  const row = result.data === null ? null : statsRow.parse(result.data);
  const totalXp = row?.total_xp ?? 0;
  const progress = levelProgress(totalXp, row?.current_level);
  return {
    totalXp,
    level: progress.level,
    rank: rankTitle(progress.level),
    coins: row?.current_coins ?? 0,
    streak: row?.current_streak ?? 0,
    freezes: row?.streak_freeze_count ?? 0,
    progress,
  };
}

export function useStudentStats(): UseQueryResult<StudentStats> {
  const userId = useAuth().user?.id ?? null;
  return useQuery({
    queryKey: [STUDENT_STATS_KEY, userId],
    queryFn: () => fetchStudentStats(userId ?? ""),
    enabled: userId !== null,
    refetchOnWindowFocus: true,
  });
}

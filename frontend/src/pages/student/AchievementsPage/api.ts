import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Achievements data layer (STUDENT-SPEC ST-26, ECONOMY-AND-GAMES section 5)

   Reads the badge catalog (`badge_definitions`), the student's own `user_badges`, and the stats
   that locked badges are measured against (`student_stats` for streak and XP, completed rows of
   `lesson_progress` for lesson badges). Pinning goes through the `pin_badges` RPC, which checks
   that every pinned badge is earned and that at most three are pinned. Rows are parsed with zod
   so a schema drift shows a visible error instead of an empty gallery. The generated `Database`
   type does not describe these tables yet, so calls go through a narrow explicit signature.
   ======================================== */

export const ACHIEVEMENTS_KEY = "student-achievements";

const definitionRow = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  icon_url: z.string().nullish(),
  category: z.string(),
  requirement_json: z.record(z.string(), z.unknown()).nullish(),
});

const earnedRow = z.object({
  badge_id: z.string(),
  awarded_at: z.string().nullish(),
  is_pinned: z.boolean().nullish(),
});

const statsRow = z.object({
  total_xp: z.coerce.number(),
  current_streak: z.coerce.number(),
});

const lessonRow = z.object({ lesson_id: z.string() });

export type DefinitionRow = z.infer<typeof definitionRow>;
export type EarnedRow = z.infer<typeof earnedRow>;

export interface AchievementsData {
  definitions: DefinitionRow[];
  earned: EarnedRow[];
  stats: { totalXp: number; currentStreak: number };
  lessonsCompleted: number;
}

interface DbError {
  message: string;
  code?: string;
}

interface Result {
  data: unknown;
  error: DbError | null;
}

interface Filterable extends PromiseLike<Result> {
  eq(column: string, value: string | boolean): Filterable;
}

interface LooseClient {
  from(table: string): { select(columns: string): Filterable };
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<Result>;
}

const client = (): LooseClient => supabase as unknown as LooseClient;

async function load<T>(request: PromiseLike<Result>, schema: z.ZodType<T>, what: string) {
  const { data, error } = await request;
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${what} came back in an unexpected shape.`);
  return parsed.data;
}

export async function fetchAchievements(studentId: string): Promise<AchievementsData> {
  const [definitions, earned, stats, lessons] = await Promise.all([
    load(
      client()
        .from("badge_definitions")
        .select("id, code, name, description, icon_url, category, requirement_json"),
      z.array(definitionRow),
      "The badge list",
    ),
    load(
      client()
        .from("user_badges")
        .select("badge_id, awarded_at, is_pinned")
        .eq("student_id", studentId),
      z.array(earnedRow),
      "Your badges",
    ),
    load(
      client().from("student_stats").select("total_xp, current_streak").eq("student_id", studentId),
      z.array(statsRow),
      "Your stats",
    ),
    load(
      client()
        .from("lesson_progress")
        .select("lesson_id")
        .eq("student_id", studentId)
        .eq("is_completed", true),
      z.array(lessonRow),
      "Your lesson progress",
    ),
  ]);

  const first = stats[0];
  return {
    definitions,
    earned,
    stats: { totalXp: first?.total_xp ?? 0, currentStreak: first?.current_streak ?? 0 },
    lessonsCompleted: new Set(lessons.map((row) => row.lesson_id)).size,
  };
}

/** Replaces the student's pinned badges with `badgeIds` (at most three, all earned). */
export async function pinBadges(studentId: string, badgeIds: string[]): Promise<void> {
  const result = await client().rpc("pin_badges", {
    student_id: studentId,
    badge_ids: badgeIds,
  });
  if (result.error) {
    const message =
      result.error.message === "Choose up to three distinct badges"
        ? "You can pin up to three badges. Unpin one first."
        : result.error.message === "You can only pin badges you have earned"
          ? "You can only pin badges you have earned."
          : normalizeApiError(result.error).message;
    throw new Error(message);
  }
}

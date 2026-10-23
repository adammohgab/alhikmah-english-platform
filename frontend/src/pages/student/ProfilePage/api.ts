import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import { fetchAchievements, type AchievementsData } from "../AchievementsPage/api";

/* ========================================
   Student profile data layer (STUDENT-SPEC ST-28)

   Reads the student's own rows: `profiles`, `student_stats`, their active class enrollment (for the
   grade level) and graded `assessment_attempts` (for the quiz average). Badges and the lesson count
   come from the Achievements data layer so both pages show the same numbers and a pin made on
   either page refreshes the other.
   ======================================== */

export const PROFILE_KEY = "student-profile";

function trimmedOr(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;
  return fallback;
}

const profileRow = z.object({
  display_name: z.string().nullish(),
  username: z.string().nullish(),
  avatar_url: z.string().nullish(),
});

const statsRow = z.object({
  total_xp: z.coerce.number(),
  current_level: z.coerce.number(),
  longest_streak: z.coerce.number(),
});

const classShape = z.object({
  name: z.string().nullish(),
  grade_level: z.coerce.string().nullish(),
});
const enrollmentRow = z.object({
  status: z.string().nullish(),
  classes: z.union([classShape, z.array(classShape)]).nullish(),
});

const attemptRow = z.object({
  status: z.string(),
  score: z.coerce.number().nullish(),
  max_score: z.coerce.number().nullish(),
});

interface DbError {
  message: string;
  code?: string;
}
interface Result {
  data: unknown;
  error: DbError | null;
}
interface Filterable extends PromiseLike<Result> {
  eq(column: string, value: string): Filterable;
}
interface LooseClient {
  from(table: string): { select(columns: string): Filterable };
}
const client = (): LooseClient => {
  const raw: unknown = supabase;
  return raw as LooseClient;
};

async function load<T>(request: PromiseLike<Result>, schema: z.ZodType<T>, what: string) {
  const { data, error } = await request;
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${what} came back in an unexpected shape.`);
  return parsed.data;
}

<<<<<<< HEAD
export interface ProfileData {
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  gradeLevel: string | null;
  className: string | null;
  totalXp: number;
  level: number;
  longestStreak: number;
  lessonsCompleted: number;
  /** Mean of graded quiz scores in percent, or null before the first graded quiz. */
  quizAverage: number | null;
  quizzesGraded: number;
  achievements: AchievementsData;
}

export async function fetchProfile(studentId: string): Promise<ProfileData> {
  const [profiles, stats, enrollments, attempts, achievements] = await Promise.all([
    load(
      client().from("profiles").select("display_name, username, avatar_url").eq("id", studentId),
      z.array(profileRow),
      "Your profile",
    ),
    load(
      client()
        .from("student_stats")
        .select("total_xp, current_level, longest_streak")
        .eq("student_id", studentId),
      z.array(statsRow),
      "Your stats",
    ),
    load(
      client()
        .from("class_enrollments")
        .select("status, classes(name, grade_level)")
        .eq("student_id", studentId),
      z.array(enrollmentRow),
      "Your class",
    ),
    load(
      client()
        .from("assessment_attempts")
        .select("status, score, max_score")
        .eq("student_id", studentId)
        .eq("status", "graded"),
      z.array(attemptRow),
      "Your quiz results",
    ),
    fetchAchievements(studentId),
  ]);

  const profile = profiles[0];
  const stat = stats[0];
  const enrollment = enrollments.find((row) => row.status === "active") ?? enrollments[0];
  const klass = Array.isArray(enrollment?.classes) ? enrollment.classes[0] : enrollment?.classes;

  const scored = attempts.filter((row) => (row.max_score ?? 0) > 0 && row.score != null);
  const quizAverage =
    scored.length === 0
      ? null
      : scored.reduce((sum, row) => sum + (row.score! / row.max_score!) * 100, 0) / scored.length;

  return {
    displayName: profile?.display_name ?? null,
    username: profile?.username ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    gradeLevel: klass?.grade_level ?? null,
    className: klass?.name ?? null,
    totalXp: stat?.total_xp ?? achievements.stats.totalXp,
    level: Math.max(1, stat?.current_level ?? 1),
    longestStreak: stat?.longest_streak ?? 0,
    lessonsCompleted: achievements.lessonsCompleted,
    quizAverage,
    quizzesGraded: scored.length,
    achievements,
  };
}

/** XP needed to go from `level` to the next one (ECONOMY-AND-GAMES section 3.1). */
export function xpForLevel(level: number): number {
  const n = level - 1;
  return 120 + 25 * n + n * n;
=======
/** Loads only the signed-in student's own profile and lifetime learning records. */
export async function fetchStudentProfile(studentId: string): Promise<StudentProfileSnapshot> {
  const db = client();
  const [profiles, statsRows, lessons, quizAttempts, enrollments, definitions, earnedRows] =
    await Promise.all([
      load(
        db.from("profiles").select("id, username, display_name, avatar_url").eq("id", studentId),
        z.array(profileRow),
        "Your profile",
      ),
      load(
        db
          .from("student_stats")
          .select("total_xp, current_level, current_streak, longest_streak")
          .eq("student_id", studentId),
        z.array(statsRow),
        "Your learning stats",
      ),
      load(
        db
          .from("lesson_progress")
          .select("lesson_id")
          .eq("student_id", studentId)
          .eq("status", "completed"),
        z.array(lessonRow),
        "Your completed lessons",
      ),
      load(
        db
          .from("quiz_attempts")
          .select("score_pct")
          .eq("student_id", studentId)
          .eq("counted", true),
        z.array(quizRow),
        "Your quiz results",
      ),
      load(
        db
          .from("class_enrollments")
          .select("classes(name, grade_level, is_archived)")
          .eq("student_id", studentId)
          .eq("status", "active"),
        z.array(enrollmentRow),
        "Your class enrollment",
      ),
      load(
        db.from("badge_definitions").select("id, name, description, icon_url, category"),
        z.array(badgeDefinitionRow),
        "The badge catalog",
      ),
      load(
        db
          .from("user_badges")
          .select("badge_id, awarded_at, is_pinned")
          .eq("student_id", studentId),
        z.array(userBadgeRow),
        "Your badges",
      ),
    ]);

  const profile = profiles[0];
  if (!profile) throw new Error("Your profile could not be found. Sign out and sign in again.");
  const stats = statsRows[0];
  const activeClass = enrollments
    .map((row) => (Array.isArray(row.classes) ? row.classes[0] : row.classes))
    .find((row) => row && row.is_archived !== true);
  const earnedById = new Map(earnedRows.map((row) => [row.badge_id, row]));
  const badges = definitions
    .filter((definition) => earnedById.has(definition.id))
    .map((definition): ProfileBadge => {
      const earned = earnedById.get(definition.id);
      return {
        id: definition.id,
        name: definition.name,
        description: trimmedOr(definition.description, `${definition.name} achievement`),
        iconUrl: definition.icon_url ?? null,
        category: definition.category,
        earnedAt: earned?.awarded_at ?? null,
        pinned: earned?.is_pinned === true,
      };
    })
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""),
    );
  const scores = quizAttempts
    .map((attempt) => attempt.score_pct)
    .filter((score): score is number => score !== null);

  return {
    id: profile.id,
    username: trimmedOr(profile.username, profile.display_name),
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url ?? null,
    gradeLevel: activeClass?.grade_level ?? null,
    className: activeClass?.name ?? null,
    totalXp: stats?.total_xp ?? 0,
    currentLevel: stats?.current_level ?? 1,
    currentStreak: stats?.current_streak ?? 0,
    longestStreak: stats?.longest_streak ?? 0,
    lessonsCompleted: new Set(lessons.map((lesson) => lesson.lesson_id)).size,
    quizAverage: scores.length
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null,
    badges,
  };
}

/** Replaces pinned badges through the server-side rule-enforcing RPC. */
export async function updatePinnedBadges(studentId: string, badgeIds: string[]): Promise<void> {
  if (badgeIds.length > 3 || new Set(badgeIds).size !== badgeIds.length) {
    throw new Error("Choose up to three different badges.");
  }
  const { error } = await client().rpc("pin_badges", {
    student_id: studentId,
    badge_ids: badgeIds,
  });
  if (error) throw new Error(normalizeApiError(error).message);
}

/** XP required to reach the start of a level, following ECONOMY-AND-GAMES §3.1. */
export function xpAtLevel(level: number): number {
  let total = 0;
  for (let current = 1; current < Math.min(60, Math.max(1, level)); current += 1) {
    const step = current - 1;
    total += 120 + 25 * step + step * step;
  }
  return total;
>>>>>>> 7b774a56829125da7626a5f705f17f62f540944d
}

/** Percent through the current level, for the ring only. Level 60 is always full. */
export function levelProgress(totalXp: number, level: number): number {
  if (level >= 60) return 100;
  let floor = 0;
  for (let n = 1; n < level; n += 1) floor += xpForLevel(n);
  const pct = ((totalXp - floor) / xpForLevel(level)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

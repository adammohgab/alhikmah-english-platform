import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

export const STUDENT_PROFILE_KEY = "student-profile";

function trimmedOr(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;
  return fallback;
}

const profileRow = z.object({
  id: z.string(),
  username: z.string().nullish(),
  display_name: z.string(),
  avatar_url: z.string().nullish(),
});
const statsRow = z.object({
  total_xp: z.coerce.number().nonnegative(),
  current_level: z.coerce.number().int().min(1).max(60),
  current_streak: z.coerce.number().int().nonnegative().default(0),
  longest_streak: z.coerce.number().int().nonnegative().default(0),
});
const lessonRow = z.object({ lesson_id: z.string() });
const quizRow = z.object({
  score_pct: z.preprocess(
    (value) => (value === null || value === undefined ? null : Number(value)),
    z.number().min(0).max(100).nullable(),
  ),
});
const classRow = z.object({
  name: z.string(),
  grade_level: z.string().nullish(),
  is_archived: z.boolean().nullish(),
});
const enrollmentRow = z.object({
  classes: z.union([classRow, z.array(classRow)]).nullish(),
});
const badgeDefinitionRow = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  icon_url: z.string().nullish(),
  category: z.string(),
});
const userBadgeRow = z.object({
  badge_id: z.string(),
  awarded_at: z.string().nullish(),
  is_pinned: z.boolean().nullish(),
});

export interface ProfileBadge {
  id: string;
  name: string;
  description: string;
  iconUrl: string | null;
  category: string;
  earnedAt: string | null;
  pinned: boolean;
}

export interface StudentProfileSnapshot {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  gradeLevel: string | null;
  className: string | null;
  totalXp: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  lessonsCompleted: number;
  quizAverage: number | null;
  badges: ProfileBadge[];
}

interface DbError {
  message: string;
  code?: string;
}
interface DbResult {
  data: unknown;
  error: DbError | null;
}
interface Query extends PromiseLike<DbResult> {
  eq(column: string, value: string | boolean): Query;
}
interface ProfileClient {
  from(table: string): { select(columns: string): Query };
  rpc(name: string, args: Record<string, unknown>): PromiseLike<DbResult>;
}
const client = () => supabase as unknown as ProfileClient;

async function load<T>(request: PromiseLike<DbResult>, schema: z.ZodType<T>, label: string) {
  const { data, error } = await request;
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${label} came back in an unexpected shape.`);
  return parsed.data;
}

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
}

export function levelProgress(totalXp: number, level: number): number {
  if (level >= 60) return 100;
  const start = xpAtLevel(level);
  const next = 120 + 25 * (level - 1) + (level - 1) ** 2;
  return Math.max(0, Math.min(100, ((totalXp - start) / next) * 100));
}

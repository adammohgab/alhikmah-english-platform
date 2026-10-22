import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import {
  dailyXpProgress,
  parseDailyGoal,
  pickResumeTarget,
  startOfSchoolDay,
  sumXp,
  type CourseUnit,
  type DailyGoalId,
  type DailyXpProgress,
  type ResumeTarget,
} from "./rules";

/* ========================================
   Dashboard data layer (STUDENT-SPEC ST-01, STU-CORE-01)

   Every read is the student's own data, scoped by RLS and again by `student_id`:
     profiles         display name and avatar
     user_settings    the daily goal (light, regular, serious), read with `*` so a database that
                      does not have the column yet falls back to "regular" instead of failing
     xp_ledger        today's XP, summed from the append-only ledger
     lesson_progress  the lesson the student left last and which lessons are finished
     courses          the course tree (units and lessons) visible to the student through RLS
   Rows are parsed with zod so a schema drift shows a visible error instead of blank numbers.
   The generated `Database` type does not describe these tables yet, so calls go through a
   narrow explicit signature.
   ======================================== */

interface LooseResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface LooseQuery extends PromiseLike<LooseResult> {
  eq: (column: string, value: string | boolean) => LooseQuery;
  in: (column: string, values: readonly string[]) => LooseQuery;
  gte: (column: string, value: string) => LooseQuery;
  order: (column: string, options: { ascending: boolean }) => LooseQuery;
  limit: (count: number) => LooseQuery;
  maybeSingle: () => PromiseLike<LooseResult>;
}

interface LooseClient {
  from: (table: string) => { select: (columns: string) => LooseQuery };
}

const client = (): LooseClient => {
  const raw: unknown = supabase;
  return raw as LooseClient;
};

function unwrap(result: LooseResult): unknown {
  if (result.error) throw new Error(normalizeApiError(result.error).message);
  return result.data;
}

/* ---------- Profile ---------- */

const profileRow = z.object({
  display_name: z.string().nullish(),
  avatar_url: z.string().nullish(),
});

export interface DashboardProfile {
  displayName: string | null;
  avatarUrl: string | null;
}

export async function fetchDashboardProfile(userId: string): Promise<DashboardProfile> {
  const data = unwrap(
    await client()
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle(),
  );
  if (data === null) return { displayName: null, avatarUrl: null };
  const row = profileRow.parse(data);
  return { displayName: row.display_name ?? null, avatarUrl: row.avatar_url ?? null };
}

/* ---------- Daily XP ---------- */

const settingsRow = z.looseObject({ daily_goal: z.unknown().optional() });
const ledgerRow = z.object({ amount: z.coerce.number() });

export interface DailyXp extends DailyXpProgress {
  goal: DailyGoalId;
}

export async function fetchDailyXp(userId: string, now: Date = new Date()): Promise<DailyXp> {
  const [settings, ledger] = await Promise.all([
    client().from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    client()
      .from("xp_ledger")
      .select("amount")
      .eq("student_id", userId)
      .gte("created_at", startOfSchoolDay(now)),
  ]);

  const settingsData = unwrap(settings);
  const goal = parseDailyGoal(
    settingsData === null ? undefined : settingsRow.parse(settingsData).daily_goal,
  );
  const amounts = z.array(ledgerRow).parse(unwrap(ledger) ?? []);
  return { goal, ...dailyXpProgress(sumXp(amounts.map((row) => row.amount)), goal) };
}

/* ---------- Continue Learning ---------- */

const recentRow = z.object({
  lesson_id: z.string(),
  is_completed: z.boolean(),
  lessons: z
    .object({
      id: z.string(),
      units: z.object({ course_id: z.string() }).nullish(),
    })
    .nullish(),
});

const courseRow = z.object({
  id: z.string(),
  title: z.string(),
  units: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        order_index: z.number().int(),
        lessons: z.array(
          z.object({ id: z.string(), title: z.string(), order_index: z.number().int() }),
        ),
      }),
    )
    .nullish(),
});

const courseIdRow = z.object({ id: z.string() });
const completedRow = z.object({ lesson_id: z.string() });

const COURSE_SELECT = "id, title, units(id, title, order_index, lessons(id, title, order_index))";
/** How many visible courses are checked when the preferred one has nothing left to do. */
const COURSE_FALLBACK_LIMIT = 5;

export interface ResumeResult {
  /** `null` when there is nothing to open. */
  target: ResumeTarget | null;
  /** `false` when the student can see no published course at all. */
  hasCourses: boolean;
}

async function targetForCourse(
  userId: string,
  courseId: string,
  inProgressLessonId: string | null,
  lastLessonId: string | null,
): Promise<{ target: ResumeTarget | null; found: boolean }> {
  const courseData = unwrap(
    await client().from("courses").select(COURSE_SELECT).eq("id", courseId).maybeSingle(),
  );
  if (courseData === null) return { target: null, found: false };
  const course = courseRow.parse(courseData);

  const units: CourseUnit[] = (course.units ?? []).map((unit) => ({
    id: unit.id,
    title: unit.title,
    orderIndex: unit.order_index,
    lessons: unit.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      orderIndex: lesson.order_index,
    })),
  }));
  const lessonIds = units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id));
  if (lessonIds.length === 0) return { target: null, found: true };

  const completed = z.array(completedRow).parse(
    unwrap(
      await client()
        .from("lesson_progress")
        .select("lesson_id")
        .eq("student_id", userId)
        .eq("is_completed", true)
        .in("lesson_id", lessonIds),
    ) ?? [],
  );

  return {
    found: true,
    target: pickResumeTarget({
      courseId: course.id,
      courseTitle: course.title,
      units,
      completedLessonIds: new Set(completed.map((row) => row.lesson_id)),
      inProgressLessonId,
      lastLessonId,
    }),
  };
}

export async function fetchResume(userId: string): Promise<ResumeResult> {
  const recent = z.array(recentRow).parse(
    unwrap(
      await client()
        .from("lesson_progress")
        .select("lesson_id, is_completed, lessons(id, units(course_id))")
        .eq("student_id", userId)
        .order("last_accessed_at", { ascending: false })
        .limit(20),
    ) ?? [],
  );

  const inProgress = recent.find((row) => !row.is_completed) ?? null;
  const last = recent[0] ?? null;
  const preferredCourse =
    inProgress?.lessons?.units?.course_id ?? last?.lessons?.units?.course_id ?? null;

  const visible = z.array(courseIdRow).parse(
    unwrap(
      await client()
        .from("courses")
        .select("id")
        .eq("status", "published")
        .order("position", { ascending: true })
        .limit(COURSE_FALLBACK_LIMIT),
    ) ?? [],
  );

  const candidates = [
    ...(preferredCourse === null ? [] : [preferredCourse]),
    ...visible.map((row) => row.id).filter((id) => id !== preferredCourse),
  ];

  let hasCourses = visible.length > 0;
  for (const courseId of candidates) {
    const isPreferred = courseId === preferredCourse;
    const { target, found } = await targetForCourse(
      userId,
      courseId,
      isPreferred ? (inProgress?.lesson_id ?? null) : null,
      isPreferred ? (last?.lesson_id ?? null) : null,
    );
    if (found) hasCourses = true;
    if (target) return { target, hasCourses };
  }
  return { target: null, hasCourses };
}

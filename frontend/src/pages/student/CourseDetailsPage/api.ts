import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

export const COURSE_DETAILS_KEY = ["student", "course-details"] as const;

const lessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  minutes: z.coerce.number().nonnegative().nullish(),
  done: z.boolean().default(false),
  activities: z
    .array(
      z
        .object({
          id: z.string(),
          title: z.string().optional(),
          kind: z.string().optional(),
          done: z.boolean().optional(),
        })
        .passthrough(),
    )
    .default([]),
});
const quizSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    lock: z
      .union([
        z.boolean(),
        z.string(),
        z.object({ locked: z.boolean().optional(), reason: z.string().optional() }).passthrough(),
      ])
      .nullish(),
    question_count: z.coerce.number().nonnegative().nullish(),
    time_limit_min: z.coerce.number().nonnegative().nullish(),
  })
  .passthrough();
const unitSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullish(),
    position: z.coerce.number().nullish(),
    status: z.string().nullish(),
    progress: z
      .object({ done: z.coerce.number().nonnegative(), total: z.coerce.number().nonnegative() })
      .nullish(),
    lessons: z.array(lessonSchema).default([]),
    activities: z
      .array(
        z
          .object({
            id: z.string(),
            title: z.string(),
            done: z.boolean().default(false),
            kind: z.string().optional(),
          })
          .passthrough(),
      )
      .default([]),
    quiz: quizSchema.nullish(),
    skills: z.array(z.string()).default([]),
    objectives: z.array(z.string()).default([]),
    locked: z.boolean().optional(),
  })
  .passthrough();
const courseSchema = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    name: z.string().optional(),
    category: z.string().nullish(),
    grade: z.string().nullish(),
    grade_level: z.string().nullish(),
    teacher_name: z.string().nullish(),
    description: z.string().nullish(),
    about: z.string().nullish(),
    term: z.string().nullish(),
    semester: z.string().nullish(),
    objectives: z.array(z.string()).default([]),
    cover_image: z.string().nullish(),
  })
  .passthrough();
const sideSchema = z
  .object({
    about: z.string().nullish(),
    term: z.string().nullish(),
    lessons: z.coerce.number().nonnegative().nullish(),
    hours: z.coerce.number().nonnegative().nullish(),
    xp_earned: z.coerce.number().nonnegative().nullish(),
    upcoming: z
      .array(
        z
          .object({
            id: z.string().optional(),
            title: z.string(),
            kind: z.string().optional(),
            due_at: z.string().nullish(),
          })
          .passthrough(),
      )
      .default([]),
    certificate: z
      .object({ earned: z.boolean().default(false), id: z.string().optional() })
      .nullish(),
  })
  .passthrough();
const responseSchema = z
  .object({ course: courseSchema, units: z.array(unitSchema), side: sideSchema.nullish() })
  .passthrough();

export type CourseLesson = z.infer<typeof lessonSchema>;
export type CourseUnit = z.infer<typeof unitSchema>;
export type CourseDetails = z.infer<typeof responseSchema>;

interface LooseResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}
interface LooseClient {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<LooseResult>;
}

/** Uses the canonical get_course snapshot so completion and class unlock rules stay server-owned. */
export async function fetchCourseDetails(courseId: string): Promise<CourseDetails> {
  if (!courseId.trim()) throw new Error("A course ID is required.");
  const client = supabase as unknown as LooseClient;
  const { data, error } = await client.rpc("get_course", { course_id: courseId });
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) throw new Error("Course details came back in an unexpected shape.");
  return {
    ...parsed.data,
    units: [...parsed.data.units].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
  };
}

export function isQuizLocked(quiz: CourseUnit["quiz"]): boolean {
  if (quiz?.lock == null) return false;
  if (typeof quiz.lock === "boolean") return quiz.lock;
  if (typeof quiz.lock === "string")
    return quiz.lock.toLowerCase() !== "unlocked" && quiz.lock.toLowerCase() !== "none";
  return quiz.lock.locked ?? Boolean(quiz.lock.reason);
}

export function courseProgress(units: CourseUnit[]): number {
  const total = units.reduce((sum, unit) => sum + (unit.progress?.total ?? unit.lessons.length), 0);
  const done = units.reduce(
    (sum, unit) =>
      sum + (unit.progress?.done ?? unit.lessons.filter((lesson) => lesson.done).length),
    0,
  );
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

export function estimateMinutes(units: CourseUnit[]): number {
  return units.reduce(
    (sum, unit) =>
      sum + unit.lessons.reduce((lessonSum, lesson) => lessonSum + (lesson.minutes ?? 10), 0),
    0,
  );
}

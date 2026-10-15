import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Teacher Dashboard data layer (TEACHER-SPEC TC-01, API-CONTRACT §4.1)

   Every widget reads one contract RPC. Responses are validated with zod so a contract drift
   surfaces as a visible, per-widget error state instead of a silent blank or a crash.
   ======================================== */

const classRef = z.object({
  id: z.string(),
  name: z.string(),
  grade_level: z.string().nullish(),
});

const gradingRow = z.object({
  assignment_id: z.string(),
  title: z.string(),
  class: classRef,
  waiting: z.number().int().nonnegative(),
  ai_ready: z.number().int().nonnegative(),
  oldest_at: z.string().nullable(),
  grading_mode: z.string().nullish(),
});

const attentionRow = z.object({
  student: z.object({
    id: z.string(),
    full_name: z.string(),
    avatar_url: z.string().nullish(),
  }),
  class: classRef,
  reasons: z.array(z.object({ code: z.string(), label: z.string() })),
  last_active_at: z.string().nullable(),
});

const feedEvent = z.object({
  id: z.string(),
  kind: z.string(),
  text: z.string(),
  class: classRef.nullish(),
  occurred_at: z.string(),
  link: z.string().nullish(),
});

const feedPage = z.object({
  items: z.array(feedEvent),
  next_cursor: z.string().nullish(),
});

const classSummary = z.object({
  class: classRef,
  students: z.number().int().nonnegative(),
  avg_progress: z.number().nullable(),
  avg_score: z.number().nullable(),
  awaiting_grading: z.number().int().nonnegative(),
  join_code_enabled: z.boolean(),
  /** Share (0-100) of enrolled students active today. Shown when the backend provides it. */
  active_today: z.number().nullish(),
});

const deadlineRow = z.object({
  kind: z.enum(["assignment", "quiz"]),
  id: z.string(),
  title: z.string(),
  class: classRef,
  due_at: z.string(),
  submitted: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type GradingRow = z.infer<typeof gradingRow>;
export type AttentionRow = z.infer<typeof attentionRow>;
export type FeedEvent = z.infer<typeof feedEvent>;
export type ClassSummary = z.infer<typeof classSummary>;
export type DeadlineRow = z.infer<typeof deadlineRow>;
export type FeedFilter = "all" | "submissions" | "quizzes" | "students";

/**
 * The generated `Database` type does not describe the teacher RPCs yet, so the call goes through
 * a narrow, explicit signature and the result is parsed by zod rather than trusted.
 */
type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`${fn} returned data in an unexpected shape.`);
  }
  return parsed.data;
}

const withClass = (classId: string | undefined) => (classId ? { class_id: classId } : {});

export const fetchGradingQueue = (classId?: string) =>
  callRpc("teacher_grading_queue_summary", withClass(classId), z.array(gradingRow));

export const fetchAttentionStudents = (classId?: string) =>
  callRpc("teacher_attention_students", { ...withClass(classId), limit: 6 }, z.array(attentionRow));

export const fetchActivityFeed = async (classId: string | undefined, filter: FeedFilter) => {
  const page = await callRpc(
    "teacher_activity_feed",
    { ...withClass(classId), ...(filter === "all" ? {} : { filter }) },
    feedPage,
  );
  return page.items.slice(0, 12);
};

export const fetchClassesSummary = () =>
  callRpc("teacher_classes_summary", {}, z.array(classSummary));

export const fetchDeadlines = (classId?: string) =>
  callRpc("teacher_deadlines", { ...withClass(classId), limit: 5 }, z.array(deadlineRow));

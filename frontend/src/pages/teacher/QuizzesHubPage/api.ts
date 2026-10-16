import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Quizzes hub data layer (TEACHER-SPEC TC-16, API-CONTRACT §4.5)
   `list_quizzes` returns the quizzes with counts and averages; live attempts are counted from
   in-progress rows of `assessment_attempts`. Results are validated with zod.
   ======================================== */

export const QUIZ_STATUSES = ["draft", "scheduled", "open", "closed"] as const;
export type QuizStatus = (typeof QUIZ_STATUSES)[number];

const quizRow = z.object({
  id: z.string(),
  title: z.string(),
  classes: z.array(z.object({ id: z.string(), name: z.string() })),
  unit: z.object({ title: z.string() }).nullish(),
  question_count: z.number().int().nonnegative(),
  time_limit_min: z.number().nullable(),
  attempts_allowed: z.number().int().positive().nullish(),
  status: z.enum(QUIZ_STATUSES),
  opens_at: z.string().nullish(),
  closes_at: z.string().nullish(),
  attempts_taken: z.number().int().nonnegative(),
  avg_score: z.number().nullable(),
  /** Share (0-100) of finished attempts that reached the pass mark. */
  pass_rate: z.number().nullish(),
});

const quizPage = z.object({
  items: z.array(quizRow),
  next_cursor: z.string().nullish(),
});

const classOption = z.object({ class: z.object({ id: z.string(), name: z.string() }) });
const liveRows = z.array(z.object({ assessment_id: z.string() }));

export type QuizRow = z.infer<typeof quizRow>;

interface DbError {
  message: string;
  code?: string;
}

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: DbError | null }>;

async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  // The generated Database type does not describe these RPCs yet; zod validates the result.
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${fn} returned data in an unexpected shape.`);
  return parsed.data;
}

export interface QuizQuery {
  classId: string | undefined;
  status: QuizStatus | undefined;
  search: string;
}

export const fetchQuizzesPage = (query: QuizQuery, cursor: string | undefined) =>
  callRpc(
    "list_quizzes",
    {
      ...(query.classId ? { class_id: query.classId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { q: query.search } : {}),
      ...(cursor ? { cursor } : {}),
    },
    quizPage,
  );

export async function fetchClassOptions() {
  const rows = await callRpc("teacher_classes_summary", {}, z.array(classOption));
  return rows.map((row) => row.class);
}

interface LiveBuilder extends PromiseLike<{ data: unknown; error: DbError | null }> {
  eq(column: string, value: string): LiveBuilder;
}

/** Students currently inside a quiz attempt, as a map of quiz id to head count. */
export async function fetchLiveCounts(): Promise<Record<string, number>> {
  const table = (
    supabase as unknown as { from(name: string): { select(columns: string): LiveBuilder } }
  ).from("assessment_attempts");
  const { data, error } = await table.select("assessment_id").eq("status", "in_progress");
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = liveRows.safeParse(data);
  if (!parsed.success) throw new Error("Live attempts were returned in an unexpected shape.");
  const counts: Record<string, number> = {};
  for (const row of parsed.data) counts[row.assessment_id] = (counts[row.assessment_id] ?? 0) + 1;
  return counts;
}

export const closeQuizEarly = (id: string) =>
  callRpc("close_assessment_early", { kind: "quiz", id }, z.unknown());

export const openQuizNow = (id: string) =>
  callRpc("publish_assessment", { kind: "quiz", id, schedule: "now" }, z.unknown());

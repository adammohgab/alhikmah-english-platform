import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Student quizzes data layer (STUDENT-SPEC ST-07, API-CONTRACT 3.x)

   `my_quizzes {tab: 'available'|'history', course_id?, status?, sort?, cursor?}` returns a page.
   Available rows carry `lock` and attempts used and allowed. The contract does not name the
   fields, so the schema below is tolerant: optional values may be missing. The backend decides
   every status, lock, score and pass mark; this page only displays them.
   ======================================== */

export type QuizSource = "available" | "history";

const quiz = z.object({
  id: z.string(),
  title: z.string(),
  course: z.string().nullish(),
  class_name: z.string().nullish(),
  unit: z.string().nullish(),
  question_count: z.number().nullish(),
  time_limit_min: z.number().nullish(),
  attempts_used: z.number().nullish(),
  /** Null or missing means unlimited. */
  attempts_allowed: z.number().nullish(),
  status: z.string().nullish(),
  lock: z.object({ reason: z.string().nullish(), opens_at: z.string().nullish() }).nullish(),
  closes_at: z.string().nullish(),
  best_score_pct: z.number().nullish(),
  // History rows
  attempt_id: z.string().nullish(),
  attempt_no: z.number().nullish(),
  score_pct: z.number().nullish(),
  passed: z.boolean().nullish(),
  submitted_at: z.string().nullish(),
});

const page = z.object({
  items: z.array(quiz).prefault([]),
  next_cursor: z.string().nullish(),
});

export type QuizRow = z.infer<typeof quiz>;
export type QuizPage = z.infer<typeof page>;

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

export const QUIZZES_KEY = "student-quizzes";

export async function fetchQuizzes(
  source: QuizSource,
  cursor: string | undefined,
): Promise<QuizPage> {
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc("my_quizzes", {
    tab: source,
    sort: source === "history" ? "date" : "due",
    ...(cursor ? { cursor } : {}),
  });
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = page.safeParse(data);
  if (!parsed.success) throw new Error("Your quizzes came back in an unexpected shape.");
  return parsed.data;
}

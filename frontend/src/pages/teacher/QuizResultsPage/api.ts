import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Quiz results data layer (TEACHER-SPEC TC-18, API-CONTRACT §4.5)
   `quiz_results` and `grant_extra_attempt` follow the contract; zod validates every reply.
   ======================================== */

const studentRow = z.object({
  student: z.object({ id: z.string(), full_name: z.string() }),
  attempts_used: z.number().int().nonnegative(),
  attempts_allowed: z.number().int().nullish(),
  score_pct: z.number().nullable(),
  time_spent_s: z.number().nullish(),
  status: z.enum(["passed", "not_passed", "not_attempted"]),
});

const item = z.object({
  question: z.object({ id: z.string(), position: z.number().int(), prompt: z.string() }),
  percent_correct: z.number(),
  common_wrong: z.object({ answer: z.string(), count: z.number().int() }).nullish(),
  avg_time_s: z.number().nullish(),
});

const results = z.object({
  summary: z.object({
    title: z.string(),
    status: z.string().nullish(),
    attempts: z.number().int().nonnegative(),
    completion_rate: z.number().nullish(),
    average_score: z.number().nullable(),
    highest: z.number().nullable(),
    lowest: z.number().nullable(),
    avg_time_s: z.number().nullish(),
    pass_mark: z.number().default(60),
  }),
  students: z.array(studentRow),
  items: z.array(item),
});

const grantResult = z.object({}).passthrough();

export type QuizResults = z.infer<typeof results>;
export type StudentResult = z.infer<typeof studentRow>;
export type ItemResult = z.infer<typeof item>;

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

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

export const fetchQuizResults = (quizId: string) =>
  callRpc("quiz_results", { quiz_id: quizId }, results);

/** Raises the student's attempt allowance for this quiz by one. */
export const grantExtraAttempt = (quizId: string, studentId: string) =>
  callRpc("grant_extra_attempt", { quiz_id: quizId, student_id: studentId }, grantResult);

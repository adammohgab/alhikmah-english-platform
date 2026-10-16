import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Live quiz monitor data layer (task TCH-CORE-20)
   `quiz_live_state` returns one snapshot of every student; `extend_quiz_time` and
   `force_submit_attempt` are the two teacher controls. Realtime events only trigger a refetch of
   the snapshot (see index.tsx), so the server stays the single source of truth.
   ======================================== */

const liveStudent = z.object({
  student: z.object({ id: z.string(), full_name: z.string() }),
  attempt_id: z.string().nullable(),
  status: z.enum(["not_started", "in_progress", "submitted"]),
  current_question: z.number().int().nullable(),
  started_at: z.string().nullable(),
  submitted_at: z.string().nullable(),
  deadline_at: z.string().nullable(),
  last_seen_at: z.string().nullable(),
});

const liveState = z.object({
  server_time: z.string(),
  quiz: z.object({
    id: z.string(),
    title: z.string(),
    question_count: z.number().int().nonnegative(),
  }),
  students: z.array(liveStudent),
});

const actionResult = z.object({}).passthrough();

export type LiveState = z.infer<typeof liveState>;
export type LiveStudent = z.infer<typeof liveStudent>;

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

export const fetchLiveState = (quizId: string) =>
  callRpc("quiz_live_state", { quiz_id: quizId }, liveState);

/** Adds minutes to the deadline of every in-progress attempt of this quiz. */
export const extendQuizTime = (quizId: string, minutes: number) =>
  callRpc("extend_quiz_time", { quiz_id: quizId, minutes }, actionResult);

/** Ends one student's attempt now and scores it from the answers saved so far. */
export const forceSubmitAttempt = (attemptId: string) =>
  callRpc("force_submit_attempt", { attempt_id: attemptId }, actionResult);

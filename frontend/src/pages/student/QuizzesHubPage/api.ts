import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import type { AvailableQuiz, HistoryAttempt } from "./rules";

/* ========================================
   Quizzes hub data layer (STUDENT-SPEC ST-07, API-CONTRACT section 3.3)

   `my_quizzes({ tab, cursor? })` returns `Page<T> = { items, next_cursor, total_estimate? }`.
   - tab `available`: quizzes assigned to the student's classes, with `lock`, attempts used and
     allowed, and the best score so far.
   - tab `history`: the student's finished attempts, newest first.
   The contract does not list every row field, so the zod schemas below name the fields this page
   reads and tolerate the rest. A reply that does not match shows an error state with a retry
   instead of blank cards. The generated `Database` type does not describe this RPC yet, so the
   call goes through a narrow signature.
   ======================================== */

interface RpcResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface RpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
}

const label = z.union([z.string(), z.object({ title: z.string() }).transform((v) => v.title)]);

const lockShape = z.object({
  locked: z.boolean(),
  reason: z.string().nullish(),
  unlocks_when: z
    .object({
      lessons_remaining: z.number().int().nullish(),
      date: z.string().nullish(),
    })
    .nullish(),
});

const availableRow = z.object({
  id: z.string(),
  title: z.string(),
  course: label.nullish(),
  class_name: z.string().nullish(),
  unit: label.nullish(),
  question_count: z.coerce.number().int().nonnegative(),
  time_limit_min: z.coerce.number().int().positive().nullish(),
  attempts_used: z.coerce.number().int().nonnegative().default(0),
  attempts_allowed: z.coerce.number().int().positive().default(1),
  best_score_pct: z.coerce.number().nullish(),
  opens_at: z.string().nullish(),
  due_at: z.string().nullish(),
  lock: lockShape.nullish(),
});

const historyRow = z.object({
  attempt_id: z.string(),
  quiz_id: z.string(),
  title: z.string(),
  course: label.nullish(),
  class_name: z.string().nullish(),
  submitted_at: z.string().nullish(),
  score_pct: z.coerce.number().nullish(),
  passed: z.boolean().nullish(),
  attempt_no: z.coerce.number().int().positive().default(1),
});

function page<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    next_cursor: z.string().nullish(),
  });
}

export interface QuizPage<T> {
  items: T[];
  nextCursor: string | null;
}

async function callMyQuizzes(
  tab: "available" | "history",
  cursor: string | null,
): Promise<unknown> {
  const result = await (supabase as unknown as RpcClient).rpc("my_quizzes", {
    tab,
    ...(cursor === null ? {} : { cursor }),
  });
  if (result.error) throw new Error(normalizeApiError(result.error).message);
  return result.data ?? { items: [], next_cursor: null };
}

export async function fetchAvailableQuizzes(
  cursor: string | null,
): Promise<QuizPage<AvailableQuiz>> {
  const parsed = page(availableRow).parse(await callMyQuizzes("available", cursor));
  return {
    nextCursor: parsed.next_cursor ?? null,
    items: parsed.items.map((row) => ({
      id: row.id,
      title: row.title,
      course: row.course ?? null,
      className: row.class_name ?? null,
      unit: row.unit ?? null,
      questionCount: row.question_count,
      timeLimitMin: row.time_limit_min ?? null,
      attemptsUsed: row.attempts_used,
      attemptsAllowed: row.attempts_allowed,
      bestScorePct: row.best_score_pct ?? null,
      opensAt: row.opens_at ?? null,
      dueAt: row.due_at ?? null,
      lock: {
        locked: row.lock?.locked ?? false,
        reason: row.lock?.reason ?? null,
        lessonsRemaining: row.lock?.unlocks_when?.lessons_remaining ?? null,
        unlocksOn: row.lock?.unlocks_when?.date ?? null,
      },
    })),
  };
}

export async function fetchQuizHistory(cursor: string | null): Promise<QuizPage<HistoryAttempt>> {
  const parsed = page(historyRow).parse(await callMyQuizzes("history", cursor));
  return {
    nextCursor: parsed.next_cursor ?? null,
    items: parsed.items.map((row) => ({
      attemptId: row.attempt_id,
      quizId: row.quiz_id,
      title: row.title,
      course: row.course ?? null,
      className: row.class_name ?? null,
      submittedAt: row.submitted_at ?? null,
      scorePct: row.score_pct ?? null,
      passed: row.passed ?? null,
      attemptNo: row.attempt_no,
    })),
  };
}

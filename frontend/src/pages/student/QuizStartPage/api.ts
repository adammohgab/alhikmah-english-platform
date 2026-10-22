import { z } from "zod";
import { supabase } from "@/shared/api/supabase";

/* ========================================
   Quiz start data layer (STUDENT-SPEC ST-08, API-CONTRACT 3.x)

   `get_quiz_brief {quiz_id}` gives the briefing: title, course and unit, question count, time
   limit, pass mark, attempts left, best score, the rules, the question types and the lock.
   The contract does not pin every field, so the schema is tolerant: optional values may be
   missing. The backend decides locks and attempt counts; this page only shows them.

   `start_quiz_attempt` is called with the argument name the shipped function uses
   (migration 023: `assessment_id`). It resumes an attempt already in progress instead of
   making another, and raises when the quiz is closed, unpublished or out of attempts.
   ======================================== */

export const QUIZ_BRIEF_KEY = "student-quiz-brief";

const lock = z.object({
  locked: z.boolean().nullish(),
  reason: z.string().nullish(),
  unlocks_when: z
    .object({
      lessons_remaining: z.number().nullish(),
      date: z.string().nullish(),
    })
    .nullish(),
});

const best = z.union([z.number(), z.object({ score_pct: z.number().nullish() })]).nullish();

const brief = z.object({
  quiz: z.object({
    title: z.string(),
    course: z.string().nullish(),
    unit: z.string().nullish(),
    question_count: z.number().nullish(),
    /** Null or missing means untimed. */
    time_limit_min: z.number().nullish(),
    pass_mark: z.number().nullish(),
    /** Null or missing means unlimited. */
    attempts_left: z.number().nullish(),
    attempts_allowed: z.number().nullish(),
    best,
    shuffle_questions: z.boolean().nullish(),
    /** Set when an attempt is already running, so the button can say "Resume". */
    in_progress_attempt_id: z.string().nullish(),
  }),
  rules: z.array(z.string()).nullish(),
  question_types: z.array(z.string()).nullish(),
  lock: lock.nullish(),
});

export interface QuizBrief {
  title: string;
  course: string | null;
  unit: string | null;
  questionCount: number | null;
  timeLimitMin: number | null;
  passMark: number | null;
  /** Null means unlimited. */
  attemptsLeft: number | null;
  attemptsAllowed: number | null;
  bestScorePct: number | null;
  shuffleQuestions: boolean;
  resuming: boolean;
  rules: string[];
  questionTypes: string[];
  locked: boolean;
  lockReason: string | null;
  lessonsRemaining: number | null;
  unlocksOn: string | null;
}

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

const rpc: LooseRpc = (fn, args) => (supabase.rpc.bind(supabase) as unknown as LooseRpc)(fn, args);

export function toBrief(data: unknown): QuizBrief | null {
  const parsed = brief.safeParse(data);
  if (!parsed.success) return null;
  const { quiz, rules, question_types, lock: lockInfo } = parsed.data;
  const bestPct = typeof quiz.best === "number" ? quiz.best : (quiz.best?.score_pct ?? null);
  return {
    title: quiz.title,
    course: quiz.course ?? null,
    unit: quiz.unit ?? null,
    questionCount: quiz.question_count ?? null,
    timeLimitMin: quiz.time_limit_min ?? null,
    passMark: quiz.pass_mark ?? null,
    attemptsLeft: quiz.attempts_left ?? null,
    attemptsAllowed: quiz.attempts_allowed ?? null,
    bestScorePct: bestPct,
    shuffleQuestions: quiz.shuffle_questions === true,
    resuming: Boolean(quiz.in_progress_attempt_id),
    rules: (rules ?? []).filter((rule) => rule.trim() !== ""),
    questionTypes: question_types ?? [],
    locked: lockInfo?.locked === true,
    lockReason: lockInfo?.reason ?? null,
    lessonsRemaining: lockInfo?.unlocks_when?.lessons_remaining ?? null,
    unlocksOn: lockInfo?.unlocks_when?.date ?? null,
  };
}

export async function fetchQuizBrief(quizId: string): Promise<QuizBrief> {
  const { data, error } = await rpc("get_quiz_brief", { quiz_id: quizId });
  if (error) {
    throw new Error(
      classifyStartError(error) === "not-found"
        ? START_MESSAGES["not-found"]
        : "We could not load this quiz. Try again.",
    );
  }
  const result = toBrief(data);
  if (result === null) throw new Error("This quiz came back in an unexpected shape.");
  return result;
}

/* ---------- Starting ---------- */

const started = z.object({
  attempt_id: z.string(),
  attempt_number: z.number().nullish(),
  attempt_no: z.number().nullish(),
  expires_at: z.string().nullish(),
  deadline_at: z.string().nullish(),
});

export interface StartedAttempt {
  attemptId: string;
  attemptNumber: number | null;
  expiresAt: string | null;
}

export type StartFailure = "exhausted" | "closed" | "locked" | "not-found" | "network" | "failed";

export class StartQuizError extends Error {
  readonly kind: StartFailure;
  constructor(kind: StartFailure, message: string) {
    super(message);
    this.name = "StartQuizError";
    this.kind = kind;
  }
}

export const START_MESSAGES: Record<StartFailure, string> = {
  exhausted: "No attempts left. Ask your teacher.",
  closed: "This quiz is closed, so it can no longer be started.",
  locked: "This quiz is not open to you yet.",
  "not-found": "We could not find this quiz.",
  network: "We could not reach the server. Check your connection and try again.",
  failed: "We could not start the quiz. Try again.",
};

/** Sorts a database error into the few outcomes the page can explain. */
export function classifyStartError(error: { message: string; code?: string }): StartFailure {
  const text = `${error.code ?? ""} ${error.message}`.toLowerCase();
  if (/attempts_exhausted|maximum quiz attempts/.test(text)) return "exhausted";
  if (/window_closed|closing time|not published/.test(text)) return "closed";
  if (/assessment_locked|not actively enrolled|not assigned|42501/.test(text)) return "locked";
  if (/p0002|not found/.test(text)) return "not-found";
  if (/fetch|network|failed to fetch/.test(text)) return "network";
  return "failed";
}

/** Creates the attempt (or resumes the running one) and returns its id. */
export async function startQuizAttempt(quizId: string): Promise<StartedAttempt> {
  let result: Awaited<ReturnType<LooseRpc>>;
  try {
    result = await rpc("start_quiz_attempt", { assessment_id: quizId });
  } catch (cause) {
    throw new StartQuizError(
      "network",
      cause instanceof Error ? cause.message : START_MESSAGES.network,
    );
  }
  if (result.error) {
    const kind = classifyStartError(result.error);
    throw new StartQuizError(kind, START_MESSAGES[kind]);
  }
  const parsed = started.safeParse(result.data);
  if (!parsed.success) throw new StartQuizError("failed", START_MESSAGES.failed);
  return {
    attemptId: parsed.data.attempt_id,
    attemptNumber: parsed.data.attempt_number ?? parsed.data.attempt_no ?? null,
    expiresAt: parsed.data.expires_at ?? parsed.data.deadline_at ?? null,
  };
}

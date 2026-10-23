import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import type { ActionCardData, ActionChangeOp } from "@/shared/components/ai/ActionCardDisplay";

/* ========================================
   Support plan data layer (TEACHER-SPEC TC-32, API-CONTRACT `ai_support_plan`)

   Evidence is read from the student's graded `assessment_attempts` and the wrong rows of
   `attempt_answers` (teacher RLS covers the teacher's own students). The plan is drafted by the
   `ai-support-plan` Edge Function, which returns a diagnosis, goals, strategies and ACTION CARDS
   (targeted practice, quest, announcement, bonus). Cards are applied or discarded through
   `apply_action_card` / `discard_action_card`; nothing reaches the student before Approve. The
   finished plan is stored in `support_plans`.
   ======================================== */

export const LOW_SCORE_PCT = 70;

export interface LowAttempt {
  id: string;
  title: string;
  pct: number;
  submittedAt: string | null;
}
export interface Evidence {
  studentName: string | null;
  classId: string | null;
  lowAttempts: LowAttempt[];
  /** Topics the student got wrong most, with the number of wrong answers. */
  weakTopics: { topic: string; wrong: number }[];
  wrongAnswers: number;
}

const attemptRow = z.object({
  id: z.string(),
  score: z.coerce.number().nullish(),
  max_score: z.coerce.number().nullish(),
  submitted_at: z.string().nullish(),
  assessments: z
    .union([
      z.object({ title: z.string().nullish() }),
      z.array(z.object({ title: z.string().nullish() })),
    ])
    .nullish(),
});
const answerRow = z.object({
  questions: z
    .union([
      z.object({ tags: z.array(z.string()).nullish() }),
      z.array(z.object({ tags: z.array(z.string()).nullish() })),
    ])
    .nullish(),
});
const profileRow = z.object({ display_name: z.string().nullish() });
const enrollmentRow = z.object({ class_id: z.string() });

interface DbError {
  message: string;
  code?: string;
}
interface Result {
  data: unknown;
  error: DbError | null;
}
interface Query extends PromiseLike<Result> {
  eq(column: string, value: string | boolean): Query;
  in(column: string, values: string[]): Query;
  order(column: string, options: { ascending: boolean }): Query;
  limit(count: number): Query;
}
interface LooseClient {
  from(table: string): {
    select(columns: string): Query;
    insert(values: Record<string, unknown>): PromiseLike<Result>;
  };
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<Result>;
}
const client = (): LooseClient => {
  const raw: unknown = supabase;
  return raw as LooseClient;
};

async function load<T>(request: PromiseLike<Result>, schema: z.ZodType<T>, what: string) {
  const { data, error } = await request;
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${what} came back in an unexpected shape.`);
  return parsed.data;
}

const first = <T>(value: T | T[] | null | undefined): T | undefined =>
  Array.isArray(value) ? value[0] : (value ?? undefined);

export async function fetchEvidence(
  studentId: string,
  classHint: string | null,
): Promise<Evidence> {
  const [profiles, enrollments, attempts] = await Promise.all([
    load(
      client().from("profiles").select("display_name").eq("id", studentId),
      z.array(profileRow),
      "The student",
    ),
    load(
      client()
        .from("class_enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .eq("status", "active"),
      z.array(enrollmentRow),
      "The student's class",
    ),
    load(
      client()
        .from("assessment_attempts")
        .select("id, score, max_score, submitted_at, assessments(title)")
        .eq("student_id", studentId)
        .eq("status", "graded")
        .order("submitted_at", { ascending: false })
        .limit(20),
      z.array(attemptRow),
      "Recent results",
    ),
  ]);

  const scored = attempts
    .filter((row) => (row.max_score ?? 0) > 0 && row.score != null)
    .map((row) => ({
      id: row.id,
      title: first(row.assessments)?.title ?? "Assessment",
      pct: (row.score! / row.max_score!) * 100,
      submittedAt: row.submitted_at ?? null,
    }));
  const lowAttempts = scored.filter((row) => row.pct < LOW_SCORE_PCT);

  let weakTopics: Evidence["weakTopics"] = [];
  let wrongAnswers = 0;
  if (lowAttempts.length > 0) {
    const answers = await load(
      client()
        .from("attempt_answers")
        .select("questions(tags)")
        .in(
          "attempt_id",
          lowAttempts.map((row) => row.id),
        )
        .eq("is_correct", false),
      z.array(answerRow),
      "Wrong answers",
    );
    wrongAnswers = answers.length;
    const counts = new Map<string, number>();
    for (const answer of answers) {
      for (const tag of first(answer.questions)?.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    weakTopics = [...counts.entries()]
      .map(([topic, wrong]) => ({ topic, wrong }))
      .sort((a, b) => b.wrong - a.wrong)
      .slice(0, 6);
  }

  return {
    studentName: profiles[0]?.display_name ?? null,
    classId: classHint ?? enrollments[0]?.class_id ?? null,
    lowAttempts,
    weakTopics,
    wrongAnswers,
  };
}

/* ---- AI draft ---- */

const OPS: readonly ActionChangeOp[] = [
  "create_draft",
  "update",
  "publish",
  "assign",
  "schedule",
  "notify",
  "award",
  "create_quest",
];

const cardSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string().nullish(),
  summary: z.string(),
  status: z.string().nullish(),
  changes: z
    .array(
      z.object({
        op: z.string().nullish(),
        description: z.string(),
        before: z.string().nullish(),
        after: z.string().nullish(),
      }),
    )
    .prefault([]),
  sources: z.array(z.object({ label: z.string(), href: z.string().nullish() })).nullish(),
  notes: z.array(z.string()).nullish(),
});

const draftSchema = z.object({
  diagnosis: z.string().nullish(),
  goals: z
    .array(
      z.object({
        title: z.string(),
        target: z.string().nullish(),
        due_date: z.string().nullish(),
      }),
    )
    .prefault([]),
  strategies: z.array(z.string()).prefault([]),
  cards: z.array(cardSchema).prefault([]),
});

export interface DraftGoal {
  id: string;
  title: string;
  target: string;
  dueDate: string;
}
export interface PlanDraft {
  diagnosis: string;
  goals: DraftGoal[];
  strategies: string[];
  cards: ActionCardData[];
}

export async function generatePlan(
  studentId: string,
  classId: string | null,
  issue: string,
): Promise<PlanDraft> {
  const response = await supabase.functions.invoke<unknown>("ai-support-plan", {
    body: {
      student_ids: [studentId],
      ...(classId ? { class_id: classId } : {}),
      ...(issue.trim() ? { issue: issue.trim() } : {}),
    },
  });
  if (response.error) throw new Error(normalizeApiError(response.error).message);
  const parsed = draftSchema.safeParse(response.data);
  if (!parsed.success) throw new Error("The plan came back in an unexpected shape.");
  const draft = parsed.data;
  return {
    diagnosis: draft.diagnosis ?? "",
    goals: draft.goals.slice(0, 3).map((goal, index) => ({
      id: `goal-${index}`,
      title: goal.title,
      target: goal.target ?? "",
      dueDate: goal.due_date ?? "",
    })),
    strategies: draft.strategies,
    cards: draft.cards.map((card) => ({
      id: card.id,
      kind: card.kind,
      title: card.title ?? undefined,
      summary: card.summary,
      status: card.status === "approved" || card.status === "discarded" ? card.status : "ready",
      changes: card.changes.map((change) => ({
        op: OPS.find((op) => op === change.op) ?? "update",
        description: change.description,
        before: change.before ?? undefined,
        after: change.after ?? undefined,
      })),
      sources: card.sources?.map((source) => ({
        label: source.label,
        href: source.href ?? undefined,
      })),
      notes: card.notes ?? undefined,
    })),
  };
}

/* ---- Cards and the saved plan ---- */

export async function applyCard(cardId: string): Promise<void> {
  const { error } = await client().rpc("apply_action_card", { card_id: cardId });
  if (error) throw new Error(normalizeApiError(error).message);
}

export async function discardCard(cardId: string): Promise<void> {
  const { error } = await client().rpc("discard_action_card", { card_id: cardId });
  if (error) throw new Error(normalizeApiError(error).message);
}

export interface PlanInput {
  studentId: string;
  classId: string | null;
  diagnosis: string;
  goals: DraftGoal[];
  strategies: string[];
  reviewDate: string;
}

export async function savePlan(input: PlanInput): Promise<void> {
  const { error } = await client()
    .from("support_plans")
    .insert({
      student_id: input.studentId,
      class_id: input.classId,
      status: "active",
      diagnosis: input.diagnosis,
      goals: input.goals.map((goal) => ({
        title: goal.title,
        target: goal.target || null,
        due_date: goal.dueDate || null,
      })),
      strategies: input.strategies,
      review_date: input.reviewDate || null,
    });
  if (error) throw new Error(normalizeApiError(error).message);
}

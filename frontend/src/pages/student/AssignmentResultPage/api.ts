import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Assignment result data layer (STUDENT-SPEC ST-14, API-CONTRACT `get_assignment_result`)

   `get_assignment_result {assignment_id}` returns `{status, released, grade?, per_question[]}`.
   The contract does not name every field, so the schema is tolerant: every optional value may be
   missing and unknown rubric or comment shapes are narrowed here. The backend decides the grade,
   whether the result is released and what is still preliminary; this page only displays them.
   ======================================== */

export const RESULT_KEY = "student-assignment-result";

const num = z.coerce.number();

const criterion = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  title: z.string().nullish(),
  score: num.nullish(),
  points: num.nullish(),
  awarded: num.nullish(),
  max: num.nullish(),
  max_points: num.nullish(),
  max_score: num.nullish(),
  comment: z.string().nullish(),
});

const comment = z.object({
  id: z.string().nullish(),
  body: z.string(),
  author: z.string().nullish(),
  quote: z.string().nullish(),
  start: num.nullish(),
  end: num.nullish(),
});

const question = z.object({
  question_id: z.string().nullish(),
  id: z.string().nullish(),
  prompt: z.string().nullish(),
  type: z.string().nullish(),
  student_answer: z.unknown().optional(),
  correct_answer: z.unknown().optional(),
  points: num.nullish(),
  max_points: num.nullish(),
  score: num.nullish(),
  ai: z
    .object({
      summary: z.string().nullish(),
      rubric: z.array(criterion).nullish(),
      preliminary: z.boolean().nullish(),
    })
    .nullish(),
  teacher: z
    .object({
      score: num.nullish(),
      comment: z.string().nullish(),
      rubric: z.array(criterion).nullish(),
      audio_url: z.string().nullish(),
    })
    .nullish(),
  comments: z.array(comment).prefault([]),
});

const resultSchema = z.object({
  status: z.string(),
  released: z.boolean().nullish(),
  title: z.string().nullish(),
  submitted_at: z.string().nullish(),
  grade: z
    .object({
      points: num.nullish(),
      max_points: num.nullish(),
      pct: num.nullish(),
      letter: z.string().nullish(),
      graded_at: z.string().nullish(),
      teacher_name: z.string().nullish(),
      comment: z.string().nullish(),
      audio_url: z.string().nullish(),
    })
    .nullish(),
  per_question: z.array(question).prefault([]),
});

export type Criterion = z.infer<typeof criterion>;
export type InlineComment = z.infer<typeof comment>;
export type QuestionResult = z.infer<typeof question>;
export type AssignmentResult = z.infer<typeof resultSchema>;

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

export async function fetchAssignmentResult(assignmentId: string): Promise<AssignmentResult> {
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc("get_assignment_result", { assignment_id: assignmentId });
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = resultSchema.safeParse(data);
  if (!parsed.success) throw new Error("The result came back in an unexpected shape.");
  return parsed.data;
}

/** Name, awarded and maximum marks of one rubric criterion, whichever field names were sent. */
export function criterionMarks(item: Criterion): {
  name: string;
  awarded: number | null;
  max: number | null;
} {
  return {
    name: item.name ?? item.title ?? "Criterion",
    awarded: item.score ?? item.awarded ?? item.points ?? null,
    max: item.max ?? item.max_points ?? item.max_score ?? null,
  };
}

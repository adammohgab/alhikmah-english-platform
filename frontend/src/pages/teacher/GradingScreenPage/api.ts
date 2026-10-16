import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import type { SaveGradePayload } from "./scoring";

/* ========================================
   Grading screen data layer (TEACHER-SPEC TC-21, API-CONTRACT §4.7)
   - `get_submission_for_grading` and `add_inline_comment` follow the API contract.
   - `lock_submission_for_grading` and `save_grade` match supabase/028_ops_13_teacher_grading.sql.
   Results are parsed with zod so drift shows up as a visible error state.
   ======================================== */

const rubricLevel = z.object({
  label: z.string(),
  points: z.number(),
  description: z.string().nullish(),
});

const rubricCriterion = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  levels: z.array(rubricLevel),
});

const rubric = z.object({
  id: z.string().nullish(),
  title: z.string(),
  max_score: z.number(),
  criteria: z.array(rubricCriterion),
});

const aiSuggestion = z.object({
  score: z.number(),
  confidence: z.number().nullish(),
  comment: z.string().nullish(),
  /** criterion id -> points the AI would award */
  criteria: z.record(z.string(), z.number()).nullish(),
});

const question = z.object({
  question_id: z.string(),
  position: z.number().int(),
  prompt: z.string(),
  question_type: z.string(),
  max_points: z.number(),
  is_writing: z.boolean(),
  /** What the student wrote or chose, already rendered as text. */
  student_answer: z.string().nullish(),
  correct_answer: z.string().nullish(),
  auto_score: z.number().nullish(),
  teacher_score: z.number().nullish(),
  teacher_comment: z.string().nullish(),
  ai: aiSuggestion.nullish(),
});

const inlineComment = z.object({
  id: z.string(),
  question_id: z.string(),
  body: z.string(),
  quote: z.string().nullish(),
  start_offset: z.number().int().nonnegative(),
  end_offset: z.number().int().nonnegative(),
});

const submission = z.object({
  submission: z.object({
    id: z.string(),
    assignment_id: z.string(),
    assignment_title: z.string(),
    student: z.object({ id: z.string(), full_name: z.string() }),
    class: z.object({ id: z.string(), name: z.string() }),
    submitted_at: z.string().nullish(),
    status: z.string(),
    overall_comment: z.string().nullish(),
  }),
  questions: z.array(question),
  rubric: rubric.nullish(),
  comments: z.array(inlineComment),
  neighbors: z.object({ prev: z.string().nullish(), next: z.string().nullish() }),
});

const lockResult = z.object({ attempt_id: z.string() });
const saveResult = z.object({ attempt_id: z.string(), score: z.number() });
const inlineResult = z.object({ id: z.string() });

export type SubmissionForGrading = z.infer<typeof submission>;
export type GradingQuestion = z.infer<typeof question>;
export type InlineComment = z.infer<typeof inlineComment>;

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

export class GradingApiError extends Error {
  readonly code: string | undefined;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "GradingApiError";
    this.code = code;
  }
}

async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  // The generated Database type does not describe these RPCs yet; zod validates the result.
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc(fn, args);
  if (error) throw new GradingApiError(normalizeApiError(error).message, error.code);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new GradingApiError(`${fn} returned data in an unexpected shape.`);
  return parsed.data;
}

export const fetchSubmission = (submissionId: string) =>
  callRpc("get_submission_for_grading", { submission_id: submissionId }, submission);

/** Takes (or refreshes) the 10-minute grading lock. Fails with code 55P03 when another teacher holds it. */
export const lockSubmission = (submissionId: string) =>
  callRpc("lock_submission_for_grading", { attempt_id: submissionId }, lockResult);

export const saveGrade = (payload: SaveGradePayload) =>
  callRpc("save_grade", { ...payload }, saveResult);

export interface InlineCommentInput {
  submissionId: string;
  questionId: string;
  body: string;
  quote: string;
  startOffset: number;
  endOffset: number;
}

export const addInlineComment = (input: InlineCommentInput) =>
  callRpc(
    "add_inline_comment",
    {
      submission_id: input.submissionId,
      question_id: input.questionId,
      body: input.body,
      quote: input.quote,
      start_offset: input.startOffset,
      end_offset: input.endOffset,
    },
    inlineResult,
  );

const uploadTicket = z.object({
  asset_id: z.string(),
  upload_url: z.string(),
  token: z.string().nullish(),
});

async function invokeEdge<T>(name: string, body: Record<string, unknown>, schema: z.ZodType<T>) {
  const response = await supabase.functions.invoke<unknown>(name, { body });
  if (response.error) throw new GradingApiError(normalizeApiError(response.error).message);
  const parsed = schema.safeParse(response.data);
  if (!parsed.success) throw new GradingApiError(`${name} returned data in an unexpected shape.`);
  return parsed.data;
}

/** Uploads a recorded voice note through the signed-upload flow (API-CONTRACT §1.8) and returns its asset id. */
export async function uploadVoiceNote(blob: Blob, filename: string): Promise<string> {
  const ticket = await invokeEdge(
    "create_upload",
    { bucket: "lesson-media", kind: "audio", filename, mime: blob.type, size: blob.size },
    uploadTicket,
  );
  const response = await fetch(ticket.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": blob.type,
      ...(ticket.token ? { Authorization: `Bearer ${ticket.token}` } : {}),
    },
    body: blob,
  });
  if (!response.ok) throw new GradingApiError("The voice note could not be uploaded.");
  await invokeEdge("complete_upload", { asset_id: ticket.asset_id }, z.object({}).passthrough());
  return ticket.asset_id;
}

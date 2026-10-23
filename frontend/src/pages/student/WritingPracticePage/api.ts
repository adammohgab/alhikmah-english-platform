import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import { wordCount } from "./prompts";

/* ========================================
   Writing workshop data layer (STUDENT-SPEC ST-18)

   Drafts live in `writing_drafts` (RLS: a student reads and writes only their own rows).
   AI feedback comes from the `ai-writing-feedback` Edge Function, which also stores the review
   on the draft it is given. The function reports a safety block as HTTP 200 with an `error`
   object, so that shape is handled here and never shown as feedback.
   ======================================== */

export const DRAFTS_KEY = "student-writing-drafts";
export const MAX_CHARS = 5000;

const correction = z.object({
  original: z.string(),
  suggestion: z.string(),
  explanation: z.string(),
  category: z.string(),
});

const feedbackSchema = z.object({
  overall_score: z.coerce.number(),
  cefr_level: z.string(),
  strengths: z.array(z.string()),
  areas_for_improvement: z.array(z.string()),
  inline_corrections: z.array(correction),
  praise: z.string(),
  summary: z.string(),
});

const responseSchema = z.union([
  z.object({ feedback: feedbackSchema, draft_id: z.string().nullish() }),
  z.object({ error: z.object({ code: z.string().nullish(), message: z.string() }) }),
]);

const draftRow = z.object({
  id: z.string(),
  title: z.string().nullish(),
  content: z.string().nullish(),
  text: z.string().nullish(),
  word_count: z.coerce.number(),
  status: z.string(),
  ai_feedback: feedbackSchema.nullish(),
  last_saved_at: z.string(),
});

export type WritingFeedback = z.infer<typeof feedbackSchema>;
export type FeedbackCorrection = z.infer<typeof correction>;

export interface Draft {
  id: string;
  title: string;
  text: string;
  wordCount: number;
  finished: boolean;
  feedback: WritingFeedback | null;
  savedAt: string;
}

interface DbError {
  message: string;
  code?: string;
}
interface Result {
  data: unknown;
  error: DbError | null;
}
interface Query extends PromiseLike<Result> {
  eq(column: string, value: string): Query;
  order(column: string, options: { ascending: boolean }): Query;
  limit(count: number): Query;
  select(columns?: string): Query;
}
interface LooseClient {
  from(table: string): {
    select(columns: string): Query;
    insert(values: Record<string, unknown>): Query;
    update(values: Record<string, unknown>): Query;
  };
}
const client = (): LooseClient => {
  const raw: unknown = supabase;
  return raw as LooseClient;
};

function fail(error: DbError): never {
  throw new Error(normalizeApiError(error).message);
}

const COLUMNS = "id, title, content, text, word_count, status, ai_feedback, last_saved_at";

function toDraft(row: z.infer<typeof draftRow>): Draft {
  return {
    id: row.id,
    title: row.title?.trim() ? row.title : "Free writing",
    text: row.content ?? row.text ?? "",
    wordCount: row.word_count,
    finished: row.status === "finished",
    feedback: row.ai_feedback ?? null,
    savedAt: row.last_saved_at,
  };
}

export async function fetchDrafts(studentId: string): Promise<Draft[]> {
  const { data, error } = await client()
    .from("writing_drafts")
    .select(COLUMNS)
    .eq("student_id", studentId)
    .order("last_saved_at", { ascending: false })
    .limit(20);
  if (error) fail(error);
  const parsed = z.array(draftRow).safeParse(data);
  if (!parsed.success) throw new Error("Your drafts came back in an unexpected shape.");
  return parsed.data.map(toDraft);
}

export interface SaveInput {
  studentId: string;
  draftId: string | null;
  title: string;
  text: string;
  finished?: boolean;
}

/** Creates the draft on first save and updates it afterwards. Returns the draft id. */
export async function saveDraft(input: SaveInput): Promise<string> {
  const values = {
    title: input.title,
    content: input.text,
    text: input.text,
    word_count: wordCount(input.text),
    status: input.finished ? "finished" : "draft",
    last_saved_at: new Date().toISOString(),
  };
  if (input.draftId) {
    const { error } = await client()
      .from("writing_drafts")
      .update(values)
      .eq("id", input.draftId)
      .eq("student_id", input.studentId);
    if (error) fail(error);
    return input.draftId;
  }
  const { data, error } = await client()
    .from("writing_drafts")
    .insert({ ...values, student_id: input.studentId })
    .select("id");
  if (error) fail(error);
  const parsed = z.array(z.object({ id: z.string() })).safeParse(data);
  const id = parsed.success ? parsed.data[0]?.id : undefined;
  if (!id) throw new Error("The draft was saved but its id was not returned.");
  return id;
}

export async function requestFeedback(
  text: string,
  prompt: string | null,
  draftId: string,
): Promise<WritingFeedback> {
  const response = await supabase.functions.invoke<unknown>("ai-writing-feedback", {
    body: { text, draft_id: draftId, ...(prompt ? { prompt } : {}) },
  });
  if (response.error) throw new Error(normalizeApiError(response.error).message);
  const parsed = responseSchema.safeParse(response.data);
  if (!parsed.success) throw new Error("The feedback came back in an unexpected shape.");
  if ("error" in parsed.data) throw new Error(parsed.data.error.message);
  return parsed.data.feedback;
}

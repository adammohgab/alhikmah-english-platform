import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Grading queue data layer (TEACHER-SPEC TC-20, API-CONTRACT §4.7)
   Contract RPCs are parsed with zod so drift shows up as a visible error state.
   ======================================== */

const classRef = z.object({ id: z.string(), name: z.string() });

export const queueRow = z.object({
  submission_id: z.string(),
  assignment_id: z.string(),
  assignment_title: z.string(),
  assessment_kind: z.string(),
  grading_mode: z.string().nullish(),
  class: classRef,
  student: z.object({ id: z.string(), full_name: z.string() }),
  submitted_at: z.string(),
  due_at: z.string().nullish(),
  status: z.enum(["waiting", "ai_graded", "flagged", "graded"]),
  ai_status: z.enum(["pending", "done", "flagged", "off"]),
  ai_confidence: z.number().nullish(),
  locked_by: z.object({ id: z.string(), name: z.string() }).nullish(),
});

const queuePage = z.object({
  items: z.array(queueRow),
  next_cursor: z.string().nullish(),
});

const classOption = z.object({ class: classRef });

const summary = z.array(
  z.object({ waiting: z.number().int().nonnegative(), ai_ready: z.number().int().nonnegative() }),
);

const approveResult = z.object({
  approved: z.number().int().nonnegative(),
  skipped: z.array(z.object({ id: z.string(), reason: z.string() })),
});

export type QueueRow = z.infer<typeof queueRow>;
export type QueuePage = z.infer<typeof queuePage>;
export type ApproveResult = z.infer<typeof approveResult>;

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

export const fetchQueuePage = (
  classId: string | undefined,
  view: "grouped" | "flat",
  cursor: string | undefined,
) =>
  callRpc(
    "grading_queue",
    {
      view,
      ...(classId ? { class_id: classId } : {}),
      ...(cursor ? { cursor } : {}),
    },
    queuePage,
  );

export async function fetchClassOptions() {
  const rows = await callRpc("teacher_classes_summary", {}, z.array(classOption));
  return rows.map((row) => row.class);
}

export async function fetchQueueTotals(classId: string | undefined) {
  const rows = await callRpc(
    "teacher_grading_queue_summary",
    classId ? { class_id: classId } : {},
    summary,
  );
  return {
    waiting: rows.reduce((sum, row) => sum + row.waiting, 0),
    aiReady: rows.reduce((sum, row) => sum + row.ai_ready, 0),
  };
}

export const approveAllAiGrades = (assignmentId: string) =>
  callRpc("approve_all_ai_grades", { assignment_id: assignmentId }, approveResult);

import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Assignment results data layer (TEACHER-SPEC TC-15, API-CONTRACT §4.5)
   - `assignment_results` follows the API contract.
   - `release_grades` matches supabase/028_ops_13_teacher_grading.sql, whose single argument is
     named `assessment_id` (it is the assignment's id); the migration is what is deployed.
   ======================================== */

export const resultsKey = (assignmentId: string) =>
  ["teacher", "assignment-results", assignmentId] as const;

const submissionRow = z.object({
  id: z.string().nullish(),
  student: z.object({ id: z.string(), full_name: z.string() }),
  status: z.string(),
  submitted_at: z.string().nullish(),
  is_late: z.boolean().nullish(),
  final: z.number().nullish(),
  released: z.boolean().nullish(),
});

const results = z.object({
  assignment: z.object({
    id: z.string(),
    title: z.string(),
    max_points: z.number().nullish(),
    due_at: z.string().nullish(),
  }),
  submissions: z.array(submissionRow),
});

const releaseResult = z.object({ released: z.number().int().nonnegative() }).passthrough();

export type AssignmentResults = z.infer<typeof results>;
export type SubmissionRow = z.infer<typeof submissionRow>;

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

export const fetchResults = (assignmentId: string) =>
  callRpc("assignment_results", { assignment_id: assignmentId }, results);

/** Publishes every graded, unreleased grade to its student and notifies them. */
export const releaseGrades = (assignmentId: string) =>
  callRpc("release_grades", { assessment_id: assignmentId }, releaseResult);

import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Assignments hub data layer (TEACHER-SPEC TC-13, API-CONTRACT §4.5)
   `list_assignments` returns assignments with submission counts; `duplicate_assessment` and
   `close_assessment_early` are the contract's actions. Results are validated with zod.
   ======================================== */

export const ASSIGNMENT_STATUSES = ["draft", "scheduled", "open", "closed"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export type StatusFilter = AssignmentStatus | "needs_grading" | "all";

const assignmentRow = z.object({
  id: z.string(),
  title: z.string(),
  classes: z.array(z.object({ id: z.string(), name: z.string() })),
  course: z.object({ title: z.string() }).nullish(),
  unit: z.object({ title: z.string() }).nullish(),
  due_at: z.string().nullish(),
  status: z.enum(ASSIGNMENT_STATUSES),
  submitted: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  waiting_to_grade: z.number().int().nonnegative(),
  avg_score: z.number().nullable(),
});

const assignmentPage = z.object({
  items: z.array(assignmentRow),
  next_cursor: z.string().nullish(),
});

const classOption = z.object({ class: z.object({ id: z.string(), name: z.string() }) });

export type AssignmentRow = z.infer<typeof assignmentRow>;

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

export interface AssignmentQuery {
  classId: string | undefined;
  status: StatusFilter;
  search: string;
}

export const fetchAssignmentsPage = (query: AssignmentQuery, cursor: string | undefined) =>
  callRpc(
    "list_assignments",
    {
      sort: "due_date",
      ...(query.classId ? { class_id: query.classId } : {}),
      ...(query.status !== "all" ? { status: query.status } : {}),
      ...(query.search ? { q: query.search } : {}),
      ...(cursor ? { cursor } : {}),
    },
    assignmentPage,
  );

export async function fetchClassOptions() {
  const rows = await callRpc("teacher_classes_summary", {}, z.array(classOption));
  return rows.map((row) => row.class);
}

export const duplicateAssignment = (id: string) =>
  callRpc("duplicate_assessment", { kind: "assignment", id }, z.unknown());

export const closeAssignmentEarly = (id: string) =>
  callRpc("close_assessment_early", { kind: "assignment", id }, z.unknown());

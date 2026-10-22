import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Student assignments data layer (STUDENT-SPEC ST-11, API-CONTRACT 3.x)

   `my_assignments {tab, course_id?, sort?, cursor?}` returns a page of assignments; status chips
   are not_started, in_progress, submitted, awaiting_teacher and graded. The contract does not
   name the page's fields, so the schema below is tolerant and every optional value may be
   missing. The backend decides each status, grade and overdue flag; this page only displays them.
   ======================================== */

export type AssignmentTab = "todo" | "submitted" | "graded";

const assignment = z.object({
  id: z.string(),
  title: z.string(),
  course: z.string().nullish(),
  class_name: z.string().nullish(),
  kind: z.string().nullish(),
  due_at: z.string().nullish(),
  status: z.string(),
  overdue: z.boolean().nullish(),
  late_until: z.string().nullish(),
  progress: z.object({ answered: z.number(), total: z.number() }).nullish(),
  points: z.number().nullish(),
  rubric_summary: z.string().nullish(),
  grade: z
    .object({
      points: z.number().nullish(),
      pct: z.number().nullish(),
      teacher_name: z.string().nullish(),
    })
    .nullish(),
});

const page = z.object({
  items: z.array(assignment).prefault([]),
  next_cursor: z.string().nullish(),
});

export type AssignmentRow = z.infer<typeof assignment>;
export type AssignmentPage = z.infer<typeof page>;

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

export const ASSIGNMENTS_KEY = "student-assignments";

export async function fetchAssignments(
  tab: AssignmentTab,
  cursor: string | undefined,
): Promise<AssignmentPage> {
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc("my_assignments", {
    tab,
    sort: "due",
    ...(cursor ? { cursor } : {}),
  });
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = page.safeParse(data);
  if (!parsed.success) throw new Error("Your assignments came back in an unexpected shape.");
  return parsed.data;
}

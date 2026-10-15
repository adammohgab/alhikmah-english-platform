import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   All-my-students data layer (TEACHER-SPEC TC-07, API-CONTRACT §4.3 `my_students`)
   The server owns the flag rules (needs attention, inactive, top performer, thresholds from
   teacher settings); this page only passes the chosen flag through.
   ======================================== */

export type StudentFlag = "needs_attention" | "inactive" | "top_performers";

const studentRow = z.object({
  student: z.object({
    id: z.string(),
    full_name: z.string(),
    username: z.string().nullish(),
    avatar_url: z.string().nullish(),
  }),
  class: z.object({
    id: z.string(),
    name: z.string(),
    grade_level: z.string().nullish(),
  }),
  level: z.number().nullish(),
  progress: z.number().nullable(),
  avg_score: z.number().nullable(),
  last_active_at: z.string().nullable(),
  streak: z.number().int().nonnegative().nullish(),
  flags: z.array(z.object({ code: z.string(), label: z.string() })),
});

const studentsPage = z.object({
  items: z.array(studentRow),
  next_cursor: z.string().nullish(),
});

const classOption = z.object({ class: z.object({ id: z.string(), name: z.string() }) });

export type StudentRow = z.infer<typeof studentRow>;

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

export interface StudentQuery {
  classId: string | undefined;
  flag: StudentFlag | undefined;
  search: string;
}

export const fetchStudentsPage = (query: StudentQuery, cursor: string | undefined) =>
  callRpc(
    "my_students",
    {
      ...(query.classId ? { class_id: query.classId } : {}),
      ...(query.flag ? { flag: query.flag } : {}),
      ...(query.search ? { q: query.search } : {}),
      ...(cursor ? { cursor } : {}),
    },
    studentsPage,
  );

export async function fetchClassOptions() {
  const rows = await callRpc("teacher_classes_summary", {}, z.array(classOption));
  return rows.map((row) => row.class);
}

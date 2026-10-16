import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Classes list data layer (TEACHER-SPEC TC-02, API-CONTRACT §4.2)
   `list_my_classes`, `create_class`, `archive_class` and `duplicate_class` are contract RPCs;
   terms come from the `terms` table (with their school year). Results are validated with zod.
   ======================================== */

/** Root of the classes query keys. The shell's class switcher reads the same list, so every
 * change here invalidates it and a new class shows up there immediately. */
export const TEACHER_CLASSES_KEY = "teacher-classes";

const classRow = z.object({
  class: z.object({
    id: z.string(),
    name: z.string(),
    grade_level: z.string().nullish(),
    is_archived: z.boolean().nullish(),
  }),
  term: z.object({ name: z.string() }).nullish(),
  students: z.number().int().nonnegative(),
  avg_progress: z.number().nullable(),
  avg_score: z.number().nullable(),
  awaiting_grading: z.number().int().nonnegative(),
  join_code: z.string().nullish(),
  join_code_enabled: z.boolean(),
  teachers: z
    .array(z.object({ id: z.string(), full_name: z.string(), avatar_url: z.string().nullish() }))
    .prefault([]),
  courses: z.array(z.object({ id: z.string(), title: z.string() })).prefault([]),
  assigned_by_admin: z.boolean().nullish(),
});

const classesPage = z.object({
  items: z.array(classRow),
  next_cursor: z.string().nullish(),
});

const termRow = z.object({
  id: z.string(),
  name: z.string(),
  year_id: z.string(),
  school_years: z
    .object({ id: z.string(), name: z.string(), is_active: z.boolean().nullish() })
    .nullish(),
});

export type ClassRow = z.infer<typeof classRow>;
export type TermRow = z.infer<typeof termRow>;
export type ClassStatus = "active" | "archived";

interface DbError {
  message: string;
  code?: string;
}

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: DbError | null }>;

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

export interface ClassesQuery {
  status: ClassStatus;
  grade: string | undefined;
  search: string;
}

export const fetchClassesPage = (query: ClassesQuery, cursor: string | undefined) =>
  callRpc(
    "list_my_classes",
    {
      status: query.status,
      ...(query.grade ? { grade: query.grade } : {}),
      ...(query.search ? { q: query.search } : {}),
      ...(cursor ? { cursor } : {}),
    },
    classesPage,
  );

interface TermsBuilder extends PromiseLike<{ data: unknown; error: DbError | null }> {
  order(column: string, options: { ascending: boolean }): TermsBuilder;
}

export async function fetchTerms(): Promise<TermRow[]> {
  const table = (
    supabase as unknown as {
      from(name: string): { select(columns: string): TermsBuilder };
    }
  ).from("terms");
  const { data, error } = await table
    .select("id, name, year_id, school_years(id, name, is_active)")
    .order("start_date", { ascending: false });
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = z.array(termRow).safeParse(data);
  if (!parsed.success) throw new Error("Academic terms were returned in an unexpected shape.");
  return parsed.data;
}

export interface CreateClassInput {
  name: string;
  grade: string;
  termId: string;
  schoolYearId: string;
  description: string;
}

/** The server generates the unique 6-character join code (the class's `join_code` is unique)
 * when join codes are enabled, so two teachers can never receive the same one. */
export const createClass = (input: CreateClassInput) =>
  callRpc(
    "create_class",
    {
      name: input.name,
      grade: input.grade,
      school_year_id: input.schoolYearId,
      term_id: input.termId,
      join_code_enabled: true,
      ...(input.description ? { description: input.description } : {}),
    },
    z.object({ class_id: z.string() }),
  );

export const archiveClass = (id: string) => callRpc("archive_class", { class_id: id }, z.unknown());

export const duplicateClass = (id: string) =>
  callRpc("duplicate_class", { class_id: id }, z.unknown());

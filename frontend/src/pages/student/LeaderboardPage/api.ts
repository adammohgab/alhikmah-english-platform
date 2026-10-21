import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Leaderboard data layer (STUDENT-SPEC ST-25, task STU-GAM-11)
   Two reads: the student's active classes (`class_enrollments`, RLS limits it to their own rows)
   and the ranked board of one class for one period (`get_leaderboard`, migration 031). The RPC
   already applies the privacy rule: when the school default is private it returns "Student N"
   and no avatar for everyone except the caller. Results are validated with zod; the generated
   Database type does not describe these yet.
   ======================================== */

export const LEADERBOARD_CLASSES_KEY = "student-leaderboard-classes";
export const LEADERBOARD_KEY = "student-leaderboard";

export type Timeframe = "week" | "month" | "all_time";

const classRow = z.object({
  name: z.string(),
  grade_level: z.string().nullish(),
  is_archived: z.boolean().nullish(),
});

const enrollmentRow = z.object({
  class_id: z.string(),
  /** PostgREST returns a to-one embed as an object; tolerate a one-item array too. */
  classes: z.union([classRow, z.array(classRow)]).nullish(),
});

const badgeRow = z.object({
  id: z.string(),
  name: z.string(),
  icon_url: z.string().nullish(),
});

const entryRow = z.object({
  rank: z.coerce.number().int().positive(),
  student_id: z.string(),
  display_name: z.string().nullish(),
  avatar_url: z.string().nullish(),
  equipped_badge: badgeRow.nullish(),
  xp: z.coerce.number(),
});

const boardRow = z.object({
  class_id: z.string(),
  timeframe: z.string(),
  my_rank: z.coerce.number().nullish(),
  entries: z.array(entryRow),
});

export interface ClassOption {
  id: string;
  name: string;
  gradeLevel: string | null;
}

export type LeaderboardEntryRow = z.infer<typeof entryRow>;
export type LeaderboardData = z.infer<typeof boardRow>;

interface DbError {
  message: string;
  code?: string;
}

interface DbResult {
  data: unknown;
  error: DbError | null;
}

interface Filterable extends PromiseLike<DbResult> {
  eq(column: string, value: string | boolean): Filterable;
}

interface LooseClient {
  from(table: string): { select(columns: string): Filterable };
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<DbResult>;
}

async function unwrap<T>(request: PromiseLike<DbResult>, schema: z.ZodType<T>, what: string) {
  const { data, error } = await request;
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${what} came back in an unexpected shape.`);
  return parsed.data;
}

/** The classes the signed-in student is actively enrolled in, archived ones left out, by name. */
export async function fetchMyClasses(studentId: string): Promise<ClassOption[]> {
  const client = supabase as unknown as LooseClient;
  const rows = await unwrap(
    client
      .from("class_enrollments")
      .select("class_id, classes(name, grade_level, is_archived)")
      .eq("student_id", studentId)
      .eq("status", "active"),
    z.array(enrollmentRow),
    "Your classes",
  );
  const options: ClassOption[] = [];
  for (const row of rows) {
    const cls = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    if (!cls || cls.is_archived === true) continue;
    options.push({ id: row.class_id, name: cls.name, gradeLevel: cls.grade_level ?? null });
  }
  return options.sort((a, b) => a.name.localeCompare(b.name));
}

/** The ranked board of one class for one period. */
export async function fetchLeaderboard(
  classId: string,
  timeframe: Timeframe,
): Promise<LeaderboardData> {
  const client = supabase as unknown as LooseClient;
  return unwrap(
    client.rpc("get_leaderboard", { class_id: classId, timeframe }),
    boardRow,
    "The leaderboard",
  );
}


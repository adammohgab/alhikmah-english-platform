import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Class detail data layer (TEACHER-SPEC TC-03, API-CONTRACT §4.2)
   `class_overview`, `class_roster` and `class_work` are contract RPCs. Class rules and the
   class announcements feed are read straight from their tables (`class_rules`, `announcements`)
   under RLS. Results are parsed with zod so drift shows up as a visible error state.
   ======================================== */

export const classDetailKey = (classId: string, part: string) =>
  ["teacher", "class-detail", classId, part] as const;

const person = z.object({
  id: z.string(),
  full_name: z.string(),
  avatar_url: z.string().nullish(),
});

const overview = z.object({
  class: z.object({
    id: z.string(),
    name: z.string(),
    grade_level: z.string().nullish(),
    join_code: z.string().nullish(),
    join_code_enabled: z.boolean().nullish(),
  }),
  term: z.object({ name: z.string() }).nullish(),
  teachers: z.array(person).prefault([]),
  stats: z.object({
    students: z.number().int().nonnegative(),
    avg_score: z.number().nullable(),
    completion_rate: z.number().nullable(),
    active_this_week: z.number().int().nonnegative().nullish(),
    awaiting_grading: z.number().int().nonnegative(),
  }),
  courses: z.array(z.object({ id: z.string(), title: z.string() })).prefault([]),
});

const rosterRow = z.object({
  student: person,
  student_code: z.string().nullish(),
  status: z.string(),
  last_active_at: z.string().nullish(),
  progress: z.number().nullable(),
  avg_score: z.number().nullable(),
});
const roster = z.object({ rows: z.array(rosterRow).prefault([]) });

const workItem = z.object({
  id: z.string(),
  kind: z.enum(["assignment", "quiz"]),
  title: z.string(),
  status: z.string(),
  due_at: z.string().nullish(),
  submitted: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  avg_score: z.number().nullable(),
});
const work = z.object({ items: z.array(workItem).prefault([]) });

const rules = z.object({
  games_enabled: z.boolean(),
  ai_tutor_enabled: z.boolean(),
  late_submission_allowed: z.boolean(),
  late_penalty_percent: z.number(),
  bonus_multiplier: z.number(),
});

const announcement = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  priority: z.string(),
  publish_at: z.string(),
});
const announcements = z.array(announcement);

export type ClassOverview = z.infer<typeof overview>;
export type RosterRow = z.infer<typeof rosterRow>;
export type WorkItem = z.infer<typeof workItem>;
export type ClassRules = z.infer<typeof rules>;
export type ClassAnnouncement = z.infer<typeof announcement>;

interface DbError {
  message: string;
  code?: string;
}
type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: DbError | null }>;

function parse<T>(label: string, data: unknown, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${label} returned data in an unexpected shape.`);
  return parsed.data;
}

async function callRpc<T>(fn: string, classId: string, schema: z.ZodType<T>): Promise<T> {
  // The generated Database type does not describe these RPCs yet; zod validates the result.
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc(fn, { class_id: classId });
  if (error) throw new Error(normalizeApiError(error).message);
  return parse(fn, data, schema);
}

export const fetchOverview = (classId: string) => callRpc("class_overview", classId, overview);
export const fetchRoster = (classId: string) => callRpc("class_roster", classId, roster);
export const fetchWork = (classId: string) => callRpc("class_work", classId, work);

type Result = PromiseLike<{ data: unknown; error: DbError | null }>;
interface LooseQuery {
  maybeSingle: () => Result;
  order: (column: string, options: { ascending: boolean }) => { limit: (n: number) => Result };
}
interface LooseTable {
  select: (columns: string) => { eq: (column: string, value: string) => LooseQuery };
}
const table = (name: string) =>
  (supabase as unknown as { from: (n: string) => LooseTable }).from(name);

export async function fetchRules(classId: string): Promise<ClassRules | null> {
  const { data, error } = await table("class_rules")
    .select("games_enabled, ai_tutor_enabled, late_submission_allowed, late_penalty_percent, bonus_multiplier")
    .eq("class_id", classId)
    .maybeSingle();
  if (error) throw new Error(normalizeApiError(error).message);
  return data == null ? null : parse("class_rules", data, rules);
}

export async function fetchAnnouncements(classId: string): Promise<ClassAnnouncement[]> {
  const { data, error } = await table("announcements")
    .select("id, title, body, priority, publish_at")
    .eq("target_class_id", classId)
    .order("publish_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(normalizeApiError(error).message);
  return parse("announcements", data ?? [], announcements);
}

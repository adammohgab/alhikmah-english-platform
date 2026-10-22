import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Compare classes data layer (TEACHER-SPEC TC-24, API-CONTRACT 4.8)

   `report_compare {class_ids[2..4], period}` returns "metric columns, skill series, weekly
   series". The contract does not name the fields, so this file reads one entry per class under
   `classes` and every number may be missing (shown as "No data"). The backend computes every
   figure; the page only displays and words them.
   ======================================== */

export type PeriodPreset = "term" | "last_30_days";
export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  term: "This term",
  last_30_days: "Last 30 days",
};

export const SKILLS = ["vocabulary", "grammar", "reading", "writing", "listening"] as const;
export type SkillName = (typeof SKILLS)[number];

const num = z.number().nullish();

const compareClass = z.object({
  id: z.string(),
  name: z.string(),
  grade_level: z.string().nullish(),
  students: num,
  avg_score: num,
  completion_rate: num,
  active_pct: num,
  avg_streak: num,
  on_time_pct: num,
  skills: z.record(z.string(), z.number().nullable()).default({}),
  weekly: z.array(z.object({ week: z.string(), avg: num })).default([]),
});
const compareResult = z.object({ classes: z.array(compareClass).default([]) });

const classChoice = z.object({
  class: z.object({ id: z.string(), name: z.string(), grade_level: z.string().nullish() }),
});

export type CompareClass = z.infer<typeof compareClass>;
export type ClassChoice = z.infer<typeof classChoice>;

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

async function callRpc<T>(fn: string, args: Record<string, unknown>, schema: z.ZodType<T>) {
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${fn} returned data in an unexpected shape.`);
  return parsed.data;
}

export const COMPARE_KEY = "teacher-compare";

export const fetchClassChoices = () => callRpc("teacher_classes_summary", {}, z.array(classChoice));

export const fetchCompare = (classIds: string[], period: PeriodPreset) =>
  callRpc("report_compare", { class_ids: classIds, period }, compareResult);

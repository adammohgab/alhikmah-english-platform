import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Teacher reports data layer (TEACHER-SPEC TC-22, TC-23; API-CONTRACT 4.8)

   `report_class {class_id, period}` returns {summary, trend, histogram, skills, assessments[],
   top[], support[], roster[]}. The contract names those parts but not their fields, so the
   schemas below are tolerant: every number can be missing or null and shows as "no data"
   instead of breaking the page. The backend computes every figure; this file only reads them.
   ======================================== */

export type PeriodPreset = "term" | "last_30_days" | "custom";

export interface Period {
  preset: PeriodPreset;
  /** ISO dates (yyyy-mm-dd), used when preset is "custom". */
  from?: string | undefined;
  to?: string | undefined;
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  term: "This term",
  last_30_days: "Last 30 days",
  custom: "Custom range",
};

const num = z.number().nullish();

const summary = z.object({
  avg_score: num,
  completion_rate: num,
  active_students: z.number().nullish(),
  total_students: z.number().nullish(),
  assessments_count: z.number().nullish(),
});

const trendPoint = z.object({ week: z.string(), avg: num });
const histogramBand = z.object({ band: z.string(), count: z.number() });
const skillRow = z.object({
  skill: z.string(),
  score: num,
  change: num,
  /** CEFR band for this skill (A1 to C2) when the backend reports one. */
  cefr: z.string().nullish(),
});
const assessmentRow = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.string().nullish(),
  date: z.string().nullish(),
  submitted: z.number().nullish(),
  avg: num,
  highest: num,
  lowest: num,
});
const personRow = z.object({
  id: z.string(),
  name: z.string(),
  avg: num,
  progress: num,
  reason: z.string().nullish(),
});

const classReport = z.object({
  summary: summary.default({}),
  trend: z.array(trendPoint).default([]),
  histogram: z.array(histogramBand).default([]),
  skills: z.array(skillRow).default([]),
  assessments: z.array(assessmentRow).default([]),
  top: z.array(personRow).default([]),
  support: z.array(personRow).default([]),
  roster: z.array(personRow).default([]),
});

const classChoice = z.object({
  class: z.object({
    id: z.string(),
    name: z.string(),
    grade_level: z.string().nullish(),
  }),
  students: z.number().nullish(),
});

const recentReport = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string().nullish(),
  created_at: z.string(),
  params: z.record(z.string(), z.unknown()).nullish(),
});

export type ClassReport = z.infer<typeof classReport>;
export type SkillRow = z.infer<typeof skillRow>;
export type PersonRow = z.infer<typeof personRow>;
export type AssessmentRow = z.infer<typeof assessmentRow>;
export type ClassChoice = z.infer<typeof classChoice>;
export type RecentReport = z.infer<typeof recentReport>;

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

/** The generated Database type does not describe these RPCs yet, so results go through zod. */
async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${fn} returned data in an unexpected shape.`);
  return parsed.data;
}

export const REPORTS_KEY = "teacher-reports";

export const fetchClassChoices = () => callRpc("teacher_classes_summary", {}, z.array(classChoice));

export const fetchClassReport = (classId: string, period: Period) =>
  callRpc(
    "report_class",
    {
      class_id: classId,
      period: period.preset,
      ...(period.preset === "custom" ? { from: period.from, to: period.to } : {}),
    },
    classReport,
  );

export const fetchRecentReports = () => callRpc("recent_reports", {}, z.array(recentReport));

export const saveClassReport = (classId: string, period: Period, notes: string) =>
  callRpc(
    "save_report",
    { kind: "class", params: { class_id: classId, ...period }, notes },
    z.object({ id: z.string() }),
  );

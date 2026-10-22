import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Student report card data layer (TEACHER-SPEC TC-25, API-CONTRACT 4.8)

   `report_student {student_id, period}` returns {courses[], skills[], participation, strengths[],
   improve[]}. The contract does not name the fields inside, so the schema below is tolerant:
   every number may be missing and is shown as "No data". `student`, `summary` and
   `grade_distribution` are read when the backend includes them. The letterhead comes from the
   public settings view. The backend computes every figure.
   ======================================== */

export type PeriodPreset = "term" | "last_30_days";
export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  term: "This term",
  last_30_days: "Last 30 days",
};

const num = z.number().nullish();

const studentReport = z.object({
  student: z
    .object({
      id: z.string().nullish(),
      name: z.string(),
      student_code: z.string().nullish(),
      class_name: z.string().nullish(),
      grade_level: z.string().nullish(),
      teacher_name: z.string().nullish(),
    })
    .nullish(),
  summary: z.object({ avg_score: num, progress: num, activity_days: num }).prefault({}),
  courses: z
    .array(
      z.object({
        id: z.string().nullish(),
        name: z.string(),
        progress: num,
        overall: num,
        assessments: z.array(z.object({ title: z.string(), score: num })).prefault([]),
      }),
    )
    .prefault([]),
  skills: z
    .array(z.object({ skill: z.string(), score: num, comment: z.string().nullish() }))
    .prefault([]),
  participation: z
    .object({
      lessons_completed: num,
      best_streak: num,
      level: num,
      rank: z.string().nullish(),
    })
    .prefault({}),
  strengths: z.array(z.string()).prefault([]),
  improve: z.array(z.string()).prefault([]),
  grade_distribution: z.array(z.object({ band: z.string(), count: z.number() })).prefault([]),
});

const letterhead = z.object({
  platform_name: z.string().nullish(),
  school_name: z.string().nullish(),
  location: z.string().nullish(),
  contact_email: z.string().nullish(),
  contact_phone: z.string().nullish(),
});

export type StudentReport = z.infer<typeof studentReport>;
export type Letterhead = z.infer<typeof letterhead>;

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

export const STUDENT_REPORT_KEY = "teacher-student-report";

export async function fetchStudentReport(
  studentId: string,
  period: PeriodPreset,
): Promise<StudentReport> {
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc("report_student", { student_id: studentId, period });
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = studentReport.safeParse(data);
  if (!parsed.success) throw new Error("report_student returned data in an unexpected shape.");
  return parsed.data;
}

/** School letterhead text from the public settings view. A failure just leaves it plain. */
export async function fetchLetterhead(): Promise<Letterhead> {
  const { data, error } = await supabase
    .from("v_public_settings")
    .select("platform_name, school_name, location, contact_email, contact_phone")
    .maybeSingle();
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = letterhead.safeParse(data ?? {});
  return parsed.success ? parsed.data : {};
}

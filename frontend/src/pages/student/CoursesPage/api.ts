import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import { clampPercent, normalizeCategory, type Course } from "./rules";

/* ========================================
   Courses list data layer (STUDENT-SPEC ST-02, API-CONTRACT section 3.2, STU-CORE-03)

   One read: the `my_courses` RPC. It is the only place a student can get the teacher's name,
   the unit count and personal progress together, because students have no direct read access
   to units, lessons or teacher profiles. The whole list is loaded once; the filter tabs and
   the sort control work on that list in the browser and never call the server again.

   Contract row: {id, title, category, grade, teacher_name, units_count, progress_pct,
   next_label, cover_pattern, completed, official}. The page also uses three optional fields
   when the server sends them (`lessons_done`, `lessons_total`, `last_opened_at`); without
   them the lesson count is hidden and "Recently used" falls back to the course name.
   Rows are parsed with zod so a contract drift shows an error instead of blank cards. The
   generated `Database` type does not describe this function yet, so the call uses a narrow
   signature.
   ======================================== */

const count = z.coerce.number().int().nonnegative();

const courseRow = z.object({
  id: z.string().min(1),
  title: z.string(),
  category: z.string().nullish(),
  grade: z.union([z.string(), z.number()]).nullish(),
  teacher_name: z.string().nullish(),
  units_count: count.nullish(),
  progress_pct: z.coerce.number().nullish(),
  next_label: z.string().nullish(),
  cover_pattern: z.string().nullish(),
  completed: z.boolean().nullish(),
  lessons_done: count.nullish(),
  lessons_total: count.nullish(),
  last_opened_at: z.string().nullish(),
});

type CourseRow = z.infer<typeof courseRow>;

interface LooseResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface LooseRpc {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<LooseResult>;
}

export function toCourse(row: CourseRow): Course {
  const completed = row.completed === true;
  const trimmedCategory = row.category?.trim() ?? "";
  const category = normalizeCategory(trimmedCategory);
  return {
    id: row.id,
    title: row.title,
    category,
    categoryText: category === "custom" && trimmedCategory !== "" ? trimmedCategory : null,
    grade: row.grade === null || row.grade === undefined ? null : String(row.grade),
    teacherName: row.teacher_name?.trim() ? row.teacher_name.trim() : null,
    unitsCount: row.units_count ?? 0,
    progressPct: completed ? 100 : clampPercent(row.progress_pct ?? 0),
    lessonsDone: row.lessons_done ?? null,
    lessonsTotal: row.lessons_total ?? null,
    nextLabel: row.next_label?.trim() ? row.next_label.trim() : null,
    coverSeed: row.cover_pattern?.trim() ? row.cover_pattern.trim() : row.id,
    completed,
    lastOpenedAt: row.last_opened_at ?? null,
  };
}

export async function fetchMyCourses(): Promise<Course[]> {
  const result = await (supabase as unknown as LooseRpc).rpc("my_courses", {});
  if (result.error) throw new Error(normalizeApiError(result.error).message);
  const parsed = z.array(courseRow).safeParse(result.data ?? []);
  if (!parsed.success) {
    throw new Error("The course list came back in an unexpected format.");
  }
  return parsed.data.map(toCourse);
}

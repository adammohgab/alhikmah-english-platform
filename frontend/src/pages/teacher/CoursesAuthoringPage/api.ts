import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Teacher courses data layer (TEACHER-SPEC TC-09, API-CONTRACT 3.x)

   Course rows, unit counts and the classes using each course are read from `courses`, `units`
   and `class_courses` (RLS: a teacher sees their own courses and every published one). Archiving
   updates the teacher's own course. `create_course` and `duplicate_course` are contract RPCs that
   do the multi-table work on the server. Rows are parsed with zod so a schema drift shows an
   error instead of an empty list.
   ======================================== */

export const COURSES_KEY = "teacher-courses-authoring";

const courseRow = z.object({
  id: z.string(),
  author_id: z.string().nullish(),
  title: z.string(),
  description: z.string().nullish(),
  grade_level: z.string().nullish(),
  is_official: z.boolean(),
  status: z.string(),
  updated_at: z.string(),
  author: z
    .union([
      z.object({ display_name: z.string().nullish() }),
      z.array(z.object({ display_name: z.string().nullish() })),
    ])
    .nullish(),
});
const unitRow = z.object({ course_id: z.string() });
const usageRow = z.object({ course_id: z.string(), class_id: z.string() });

export interface CourseItem {
  id: string;
  title: string;
  description: string | null;
  grade: string | null;
  official: boolean;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  authorName: string | null;
  mine: boolean;
  units: number;
  classes: number;
}

interface DbError {
  message: string;
  code?: string;
}
interface Result {
  data: unknown;
  error: DbError | null;
}
interface Query extends PromiseLike<Result> {
  eq(column: string, value: string | boolean): Query;
  in(column: string, values: string[]): Query;
  order(column: string, options: { ascending: boolean }): Query;
}
interface LooseClient {
  from(table: string): {
    select(columns: string): Query;
    update(values: Record<string, unknown>): Query;
  };
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<Result>;
}
const client = (): LooseClient => {
  const raw: unknown = supabase;
  return raw as LooseClient;
};

async function load<T>(request: PromiseLike<Result>, schema: z.ZodType<T>, what: string) {
  const { data, error } = await request;
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${what} came back in an unexpected shape.`);
  return parsed.data;
}

function status(value: string): CourseItem["status"] {
  return value === "published" || value === "archived" ? value : "draft";
}

export async function fetchCourses(teacherId: string): Promise<CourseItem[]> {
  const rows = await load(
    client()
      .from("courses")
      .select(
        "id, author_id, title, description, grade_level, is_official, status, updated_at, author:profiles(display_name)",
      )
      .order("updated_at", { ascending: false }),
    z.array(courseRow),
    "The course list",
  );
  const visible = rows.filter(
    (row) =>
      row.author_id === teacherId ||
      (row.status === "published" && row.is_official) ||
      row.status === "published",
  );
  const ids = visible.map((row) => row.id);
  if (ids.length === 0) return [];

  const [units, usage] = await Promise.all([
    load(
      client().from("units").select("course_id").in("course_id", ids),
      z.array(unitRow),
      "Unit counts",
    ),
    load(
      client()
        .from("class_courses")
        .select("course_id, class_id")
        .in("course_id", ids)
        .eq("is_active", true),
      z.array(usageRow),
      "Class usage",
    ),
  ]);
  const unitCount = new Map<string, number>();
  for (const unit of units) unitCount.set(unit.course_id, (unitCount.get(unit.course_id) ?? 0) + 1);
  const classSets = new Map<string, Set<string>>();
  for (const row of usage) {
    const set = classSets.get(row.course_id) ?? new Set<string>();
    set.add(row.class_id);
    classSets.set(row.course_id, set);
  }

  return visible.map((row) => {
    const author = Array.isArray(row.author) ? row.author[0] : row.author;
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      grade: row.grade_level ?? null,
      official: row.is_official,
      status: status(row.status),
      updatedAt: row.updated_at,
      authorName: author?.display_name ?? null,
      mine: row.author_id === teacherId,
      units: unitCount.get(row.id) ?? 0,
      classes: classSets.get(row.id)?.size ?? 0,
    };
  });
}

const idResult = z.object({ course_id: z.string() });

async function callForCourseId(fn: string, args: Record<string, unknown>): Promise<string> {
  const { data, error } = await client().rpc(fn, args);
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = idResult.safeParse(data);
  if (!parsed.success) throw new Error("The server did not return the new course.");
  return parsed.data.course_id;
}

export interface CreateCourseInput {
  title: string;
  grade: string;
  category: string;
  description: string;
  startFrom: "blank" | "duplicate";
  sourceCourseId?: string | undefined;
}

export function createCourse(input: CreateCourseInput): Promise<string> {
  return callForCourseId("create_course", {
    title: input.title,
    grade: input.grade,
    category: input.category,
    description: input.description,
    start_from: input.startFrom,
    ...(input.sourceCourseId ? { source_course_id: input.sourceCourseId } : {}),
  });
}

/** Copies a course (own, library or official). The copy's title always ends with "(Copy)". */
export async function duplicateCourse(course: { id: string; title: string }): Promise<string> {
  const id = await callForCourseId("duplicate_course", { course_id: course.id });
  const wanted = `${course.title} (Copy)`;
  const { data } = await client().from("courses").select("title").eq("id", id);
  const current = Array.isArray(data)
    ? (data[0] as { title?: string } | undefined)?.title
    : undefined;
  if (current !== undefined && !current.endsWith("(Copy)")) {
    await client().from("courses").update({ title: wanted }).eq("id", id);
  }
  return id;
}

export async function archiveCourse(courseId: string): Promise<void> {
  const { error } = await client()
    .from("courses")
    .update({ status: "archived" })
    .eq("id", courseId);
  if (error) throw new Error(normalizeApiError(error).message);
}

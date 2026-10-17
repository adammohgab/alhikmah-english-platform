import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import type { AssignmentResult, QuizResult } from "./rules";

/* ========================================
   Student progress data layer (TEACHER-SPEC TC-08, API-CONTRACT §4.3)
   Contract RPCs are parsed with zod. Private teacher notes live in `admin_notes`
   (supabase/002_identity_profiles.sql: id, user_id, author_id, note, created_at).
   ======================================== */

const overview = z.object({
  student: z.object({
    id: z.string(),
    full_name: z.string(),
    username: z.string().nullish(),
    class: z.object({ id: z.string(), name: z.string(), grade_level: z.string().nullish() }),
    level: z.number().nullish(),
    streak: z.number().int().nonnegative().nullish(),
    last_active_at: z.string().nullish(),
  }),
  tiles: z.object({
    average_score: z.number().nullable(),
    overall_progress: z.number().nullish(),
    lessons_completed: z.number().int().nonnegative(),
    words_learned: z.number().int().nonnegative(),
  }),
  attention: z.array(z.object({ code: z.string(), text: z.string() })).default([]),
});

const quizPage = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      date: z.string(),
      score_pct: z.number().nullable(),
      attempts: z.number().int().nullish(),
      passed: z.boolean().nullish(),
    }),
  ),
  next_cursor: z.string().nullish(),
});

const assignmentPage = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      date: z.string(),
      grade_pct: z.number().nullable(),
      status: z.string(),
    }),
  ),
  next_cursor: z.string().nullish(),
});

const skills = z.object({
  skills: z.array(
    z.object({ skill: z.string(), accuracy: z.number(), trend: z.number().nullish() }),
  ),
  mistakes: z.object({
    words: z.array(z.object({ word: z.string(), count: z.number().int() })).default([]),
    grammar_topics: z.array(z.object({ topic: z.string(), count: z.number().int() })).default([]),
  }),
});

export type StudentOverview = z.infer<typeof overview>;
export type StudentSkills = z.infer<typeof skills>;

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

export const fetchOverview = (studentId: string) =>
  callRpc("student_overview", { student_id: studentId }, overview);

export const fetchSkills = (studentId: string) =>
  callRpc("student_skills", { student_id: studentId }, skills);

/** Walks every page so the timeline holds the student's complete history. */
async function allPages<T>(
  fetchPage: (
    cursor: string | undefined,
  ) => Promise<{ items: T[]; next_cursor?: string | null | undefined }>,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let guard = 0; guard < 50; guard += 1) {
    const page = await fetchPage(cursor);
    items.push(...page.items);
    if (!page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return items;
}

export async function fetchQuizResults(studentId: string): Promise<QuizResult[]> {
  const rows = await allPages((cursor) =>
    callRpc(
      "student_quiz_results",
      { student_id: studentId, ...(cursor ? { cursor } : {}) },
      quizPage,
    ),
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    date: r.date,
    scorePct: r.score_pct,
    attempts: r.attempts ?? null,
    passed: r.passed ?? null,
  }));
}

export async function fetchAssignmentResults(studentId: string): Promise<AssignmentResult[]> {
  const rows = await allPages((cursor) =>
    callRpc(
      "student_assignment_results",
      { student_id: studentId, ...(cursor ? { cursor } : {}) },
      assignmentPage,
    ),
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    date: r.date,
    scorePct: r.grade_pct,
    status: r.status,
  }));
}

/* ---------- Private teacher notes (admin_notes) ---------- */

interface DbError {
  message: string;
  code?: string;
}

interface NotesTable {
  select(columns: string): {
    eq(
      column: string,
      value: string,
    ): {
      eq(
        column: string,
        value: string,
      ): {
        order(
          column: string,
          options: { ascending: boolean },
        ): { limit(n: number): PromiseLike<{ data: unknown; error: DbError | null }> };
      };
    };
  };
  insert(row: Record<string, unknown>): PromiseLike<{ error: DbError | null }>;
  update(row: Record<string, unknown>): {
    eq(column: string, value: string): PromiseLike<{ error: DbError | null }>;
  };
}

const notes = () =>
  (supabase as unknown as { from(table: string): NotesTable }).from("admin_notes");

const noteRow = z.array(z.object({ id: z.string(), note: z.string() }));

export interface TeacherNote {
  id: string | null;
  note: string;
}

export async function fetchTeacherNote(studentId: string, authorId: string): Promise<TeacherNote> {
  const { data, error } = await notes()
    .select("id, note")
    .eq("user_id", studentId)
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(normalizeApiError(error).message);
  const rows = noteRow.safeParse(data);
  if (!rows.success) throw new Error("Teacher notes returned data in an unexpected shape.");
  const row = rows.data[0];
  return row ? { id: row.id, note: row.note } : { id: null, note: "" };
}

/** One private note per teacher per student: updates the existing row, or inserts the first one. */
export async function saveTeacherNote(
  studentId: string,
  authorId: string,
  existingId: string | null,
  note: string,
): Promise<string> {
  if (existingId) {
    const { error } = await notes().update({ note }).eq("id", existingId);
    if (error) throw new Error(normalizeApiError(error).message);
    return existingId;
  }
  // admin_notes.id has no database default, so the id is generated here.
  const id = crypto.randomUUID();
  const { error } = await notes().insert({ id, user_id: studentId, author_id: authorId, note });
  if (error) throw new Error(normalizeApiError(error).message);
  return id;
}

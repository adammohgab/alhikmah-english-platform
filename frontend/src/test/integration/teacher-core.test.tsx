import { beforeEach, describe, expect, it, vi } from "vitest";
import gradingMigrationSql from "../../../../supabase/migrations/038_ops_13_teacher_grading.sql?raw";

/* ========================================
   TCH-CORE-22 · Teacher core workflows integration tests
   Journey: create class -> enroll / remove students -> assignment visible -> rubric grading ->
   grade release + notification dispatch, plus the security boundary between classes.

   The real teacher data layers (`api.ts` files) and the real scoring rules run against an
   in-memory stand-in for Supabase. The stand-in's RPCs follow
   - supabase/migrations/035_ops_04_teacher_roster.sql  (add_students_to_class, remove_student_from_class)
   - supabase/migrations/038_ops_13_teacher_grading.sql (lock_submission_for_grading, save_grade, release_grades)
   - API-CONTRACT §4.2 / §4.5 for the RPCs no migration defines yet (create_class, list_my_classes,
     class_roster, assignment_results, list_assignments).
   ======================================== */

interface RpcError {
  message: string;
  code?: string;
}
interface RpcResult {
  data: unknown;
  error: RpcError | null;
}

interface ClassRecord {
  id: string;
  name: string;
  grade: string;
  termId: string;
  joinCode: string;
  joinCodeEnabled: boolean;
}
interface EnrollmentRecord {
  classId: string;
  studentId: string;
  status: "active" | "archived";
}
interface AttemptRecord {
  id: string;
  assessmentId: string;
  studentId: string;
  status: "in_progress" | "submitted" | "graded";
  score: number | null;
  feedback: string | null;
  releasedAt: string | null;
  lockedBy: string | null;
  questionScores: Record<string, number>;
}
interface AssessmentRecord {
  id: string;
  classId: string;
  title: string;
  status: "draft" | "open" | "closed";
  /** question id -> max points */
  questions: Record<string, number>;
}
interface NotificationRecord {
  userId: string;
  kind: string;
  payload: Record<string, unknown>;
}

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const fake = vi.hoisted(() => {
  const state = {
    userId: "" as string,
    role: "teacher" as "teacher" | "admin" | "student",
    profiles: new Map<string, { role: "teacher" | "admin" | "student"; name: string }>(),
    classes: [] as ClassRecord[],
    /** class_teachers rows: class id -> teacher id -> is_primary */
    classTeachers: [] as { classId: string; teacherId: string; primary: boolean }[],
    enrollments: [] as EnrollmentRecord[],
    assessments: [] as AssessmentRecord[],
    attempts: [] as AttemptRecord[],
    notifications: [] as NotificationRecord[],
    auditLog: [] as { action: string; classId: string; studentId?: string }[],
    nextId: 1,
    calls: [] as { fn: string; args: Record<string, unknown> }[],
  };
  return state;
});

const ok = (data: unknown): RpcResult => ({ data, error: null });
const fail = (message: string, code: string): RpcResult => ({ data: null, error: { message, code } });

const nextId = (prefix: string) => `${prefix}-${fake.nextId++}`;

function generateJoinCode(): string {
  // Deterministic walk over the alphabet; uniqueness is enforced like the real unique index.
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    let code = "";
    let seed = fake.nextId * 7919 + attempt * 104729;
    for (let i = 0; i < 6; i += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      code += JOIN_CODE_ALPHABET[seed % JOIN_CODE_ALPHABET.length] ?? "";
    }
    if (!fake.classes.some((c) => c.joinCode === code)) return code;
  }
  throw new Error("join code space exhausted");
}

const isAdmin = () => fake.role === "admin";
const teachesClass = (classId: string) =>
  fake.classTeachers.some((ct) => ct.classId === classId && ct.teacherId === fake.userId);
const isPrimaryTeacher = (classId: string) =>
  fake.classTeachers.some(
    (ct) => ct.classId === classId && ct.teacherId === fake.userId && ct.primary,
  );
const assessmentClass = (assessmentId: string) =>
  fake.assessments.find((a) => a.id === assessmentId)?.classId;

function classRow(c: ClassRecord) {
  const active = fake.enrollments.filter((e) => e.classId === c.id && e.status === "active");
  return {
    class: { id: c.id, name: c.name, grade_level: c.grade, is_archived: false },
    term: { name: "Term 1" },
    students: active.length,
    avg_progress: null,
    avg_score: null,
    awaiting_grading: fake.attempts.filter(
      (a) => assessmentClass(a.assessmentId) === c.id && a.status === "submitted",
    ).length,
    join_code: c.joinCodeEnabled ? c.joinCode : null,
    join_code_enabled: c.joinCodeEnabled,
    teachers: [],
    courses: [],
  };
}

function handleRpc(fn: string, args: Record<string, unknown>): RpcResult {
  if (!fake.userId) return fail("Authentication required", "42501");

  switch (fn) {
    case "create_class": {
      if (fake.role === "student") return fail("forbidden", "42501");
      const id = nextId("class");
      fake.classes.push({
        id,
        name: String(args["name"]),
        grade: String(args["grade"]),
        termId: String(args["term_id"]),
        joinCode: generateJoinCode(),
        joinCodeEnabled: args["join_code_enabled"] === true,
      });
      fake.classTeachers.push({ classId: id, teacherId: fake.userId, primary: true });
      return ok({ class_id: id });
    }
    case "list_my_classes": {
      const mine = fake.classes.filter((c) => isAdmin() || teachesClass(c.id));
      return ok({ items: mine.map(classRow), next_cursor: null });
    }
    case "class_roster": {
      const classId = String(args["class_id"]);
      if (!isAdmin() && !teachesClass(classId)) return fail("forbidden", "42501");
      const rows = fake.enrollments
        .filter((e) => e.classId === classId && e.status === "active")
        .map((e) => ({
          student: { id: e.studentId, full_name: fake.profiles.get(e.studentId)?.name ?? "?" },
          status: "active",
          progress: null,
          avg_score: null,
        }));
      return ok({ rows });
    }
    case "add_students_to_class": {
      const classId = String(args["class_id"]);
      const ids = args["student_ids"] as string[];
      if (!isAdmin() && !isPrimaryTeacher(classId)) return fail("forbidden", "P0001");
      if (ids.some((id) => fake.profiles.get(id)?.role !== "student")) {
        return fail("invalid_student", "P0001");
      }
      let added = 0;
      for (const id of new Set(ids)) {
        if (fake.enrollments.some((e) => e.classId === classId && e.studentId === id)) continue;
        fake.enrollments.push({ classId, studentId: id, status: "active" });
        added += 1;
      }
      fake.auditLog.push({ action: "class_students_added", classId });
      return ok({ added, skipped: Math.max(ids.length - added, 0) });
    }
    case "remove_student_from_class": {
      const classId = String(args["class_id"]);
      const studentId = String(args["student_id"]);
      if (!isAdmin() && !isPrimaryTeacher(classId)) return fail("forbidden", "P0001");
      const row = fake.enrollments.find((e) => e.classId === classId && e.studentId === studentId);
      if (!row) return fail("enrollment_not_found", "P0001");
      row.status = "archived";
      fake.auditLog.push({ action: "student_removed_from_class", classId, studentId });
      return ok({ ok: true });
    }
    case "list_assignments": {
      const items = fake.assessments
        .filter((a) => a.status !== "draft" && (isAdmin() || teachesClass(a.classId)))
        .map((a) => {
          const klass = fake.classes.find((c) => c.id === a.classId);
          const attempts = fake.attempts.filter((t) => t.assessmentId === a.id);
          return {
            id: a.id,
            title: a.title,
            classes: [{ id: a.classId, name: klass?.name ?? "" }],
            status: a.status,
            submitted: attempts.filter((t) => t.status !== "in_progress").length,
            total: fake.enrollments.filter((e) => e.classId === a.classId && e.status === "active")
              .length,
            waiting_to_grade: attempts.filter((t) => t.status === "submitted").length,
            avg_score: null,
          };
        });
      return ok({ items, next_cursor: null });
    }
    case "lock_submission_for_grading": {
      const attempt = fake.attempts.find((a) => a.id === args["attempt_id"]);
      if (!attempt) return fail("Submission not found", "P0002");
      const classId = assessmentClass(attempt.assessmentId) ?? "";
      if (!teachesClass(classId) && !isAdmin()) {
        return fail("Not authorized to grade this class", "42501");
      }
      if (attempt.status === "in_progress") return fail("Submission is not ready for grading", "55000");
      if (attempt.lockedBy && attempt.lockedBy !== fake.userId) {
        return fail("Submission is already locked by another teacher", "55P03");
      }
      attempt.lockedBy = fake.userId;
      return ok({ attempt_id: attempt.id });
    }
    case "save_grade": {
      const attempt = fake.attempts.find((a) => a.id === args["attempt_id"]);
      const rubricScores = args["rubric_scores"] as Record<string, number> | null;
      const finalScore = args["final_score"] as number | null;
      if (rubricScores == null || finalScore == null || finalScore < 0) {
        return fail("Invalid grade data", "22023");
      }
      if (!attempt) return fail("Submission not found", "P0002");
      const assessment = fake.assessments.find((a) => a.id === attempt.assessmentId);
      if (!assessment) return fail("Submission not found", "P0002");
      if (!teachesClass(assessment.classId) && !isAdmin()) {
        return fail("Not authorized to grade this class", "42501");
      }
      if (attempt.lockedBy !== fake.userId) {
        return fail("You must hold the active grading lock", "55P03");
      }
      const maxScore = Object.values(assessment.questions).reduce((sum, p) => sum + p, 0);
      if (finalScore > maxScore) {
        return fail("Final score exceeds the assessment maximum", "22023");
      }
      for (const [questionId, score] of Object.entries(rubricScores)) {
        const max = assessment.questions[questionId];
        if (max !== undefined && (score < 0 || score > max)) {
          return fail("Question score is outside its allowed range", "22023");
        }
        attempt.questionScores[questionId] = score;
      }
      attempt.score = finalScore;
      attempt.status = "graded";
      attempt.lockedBy = null;
      attempt.feedback = typeof args["feedback"] === "string" ? args["feedback"] : "";
      return ok({ attempt_id: attempt.id, score: finalScore });
    }
    case "release_grades": {
      const assessmentId = String(args["assessment_id"]);
      const classId = assessmentClass(assessmentId);
      if (classId === undefined) return fail("Assessment not found", "P0002");
      if (!teachesClass(classId) && !isAdmin()) {
        return fail("Not authorized to release grades", "42501");
      }
      let released = 0;
      for (const attempt of fake.attempts) {
        if (attempt.assessmentId === assessmentId && attempt.status === "graded" && !attempt.releasedAt) {
          attempt.releasedAt = "2026-10-21T10:00:00.000Z";
          released += 1;
        }
      }
      const students = new Set(
        fake.attempts
          .filter((a) => a.assessmentId === assessmentId && a.status === "graded" && a.releasedAt)
          .map((a) => a.studentId),
      );
      for (const userId of students) {
        fake.notifications.push({
          userId,
          kind: "grade_released",
          payload: { assessment_id: assessmentId },
        });
      }
      return ok({ assessment_id: assessmentId, released });
    }
    case "assignment_results": {
      const assessmentId = String(args["assignment_id"]);
      const assessment = fake.assessments.find((a) => a.id === assessmentId);
      if (!assessment) return fail("Assessment not found", "P0002");
      if (!teachesClass(assessment.classId) && !isAdmin()) return fail("forbidden", "42501");
      return ok({
        assignment: {
          id: assessment.id,
          title: assessment.title,
          max_points: Object.values(assessment.questions).reduce((s, p) => s + p, 0),
        },
        submissions: fake.attempts
          .filter((a) => a.assessmentId === assessmentId)
          .map((a) => ({
            id: a.id,
            student: { id: a.studentId, full_name: fake.profiles.get(a.studentId)?.name ?? "?" },
            status: a.status,
            final: a.score,
            released: a.releasedAt !== null,
          })),
      });
    }
    default:
      return fail(`Unknown rpc ${fn}`, "42883");
  }
}

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      fake.calls.push({ fn, args });
      return Promise.resolve(handleRpc(fn, args));
    },
    from: (table: string) => ({
      select: () => ({
        order: () =>
          Promise.resolve(
            table === "terms"
              ? {
                  data: [
                    {
                      id: "term-1",
                      name: "Term 1",
                      year_id: "year-1",
                      school_years: { id: "year-1", name: "2026/27", is_active: true },
                    },
                  ],
                  error: null,
                }
              : { data: [], error: null },
          ),
      }),
    }),
  },
}));

import { createClass, fetchClassesPage, fetchTerms } from "@/pages/teacher/ClassesListPage/api";
import {
  classLinks,
  groupTerms,
  validateCreateClass,
  yearIdForTerm,
} from "@/pages/teacher/ClassesListPage/rules";
import { fetchRoster } from "@/pages/teacher/ClassDetailPage/api";
import { formatJoinCode, joinLink } from "@/pages/teacher/ClassDetailPage/rules";
import { fetchAssignmentsPage } from "@/pages/teacher/AssignmentsHubPage/api";
import { fetchResults, releaseGrades } from "@/pages/teacher/AssignmentResultsPage/api";
import {
  GradingApiError,
  lockSubmission,
  saveGrade,
} from "@/pages/teacher/GradingScreenPage/api";
import {
  buildSavePayload,
  computeTotals,
  rubricComplete,
  rubricMax,
  scoreFromRubric,
} from "@/pages/teacher/GradingScreenPage/scoring";
import type {
  QuestionScoreInput,
  Rubric,
  RubricSelection,
} from "@/pages/teacher/GradingScreenPage/scoring";
import { supabase } from "@/shared/api/supabase";

/* ---------- fixtures: people, classes and a submitted assignment ---------- */

const TEACHER_A = "teacher-a";
const TEACHER_B = "teacher-b";
const ADMIN = "admin-1";
const STUDENT_1 = "student-1";
const STUDENT_2 = "student-2";
const STUDENT_3 = "student-3";

const asUser = (userId: string, role: "teacher" | "admin" | "student" = "teacher") => {
  fake.userId = userId;
  fake.role = role;
};

const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => Promise<RpcResult>;

/** The error text the data layers surface to the UI for a given RPC error. */
async function rejectionOf(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error("Expected the call to be rejected");
}

const essayRubric: Rubric = {
  title: "Essay rubric",
  max_score: 10,
  criteria: [
    {
      id: "grammar",
      name: "Grammar",
      levels: [
        { label: "Weak", points: 1 },
        { label: "Good", points: 3 },
        { label: "Great", points: 5 },
      ],
    },
    {
      id: "vocab",
      name: "Vocabulary",
      levels: [
        { label: "Weak", points: 1 },
        { label: "Great", points: 5 },
      ],
    },
  ],
};

function seed() {
  fake.userId = "";
  fake.role = "teacher";
  fake.profiles.clear();
  fake.classes.length = 0;
  fake.classTeachers.length = 0;
  fake.enrollments.length = 0;
  fake.assessments.length = 0;
  fake.attempts.length = 0;
  fake.notifications.length = 0;
  fake.auditLog.length = 0;
  fake.calls.length = 0;
  fake.nextId = 1;

  fake.profiles.set(TEACHER_A, { role: "teacher", name: "Rana Teacher" });
  fake.profiles.set(TEACHER_B, { role: "teacher", name: "Omar Teacher" });
  fake.profiles.set(ADMIN, { role: "admin", name: "Admin" });
  fake.profiles.set(STUDENT_1, { role: "student", name: "Layla Student" });
  fake.profiles.set(STUDENT_2, { role: "student", name: "Yusuf Student" });
  fake.profiles.set(STUDENT_3, { role: "student", name: "Mariam Student" });
}

/** Teacher A's class "Grade 8 A" with an open two-question assignment (10 + 10 points). */
async function createClassWithAssignment() {
  asUser(TEACHER_A);
  const { class_id: classId } = await createClass({
    name: "Grade 8 A",
    grade: "8",
    termId: "term-1",
    schoolYearId: "year-1",
    description: "",
  });
  await rpc("add_students_to_class", { class_id: classId, student_ids: [STUDENT_1, STUDENT_2] });
  fake.assessments.push({
    id: "assignment-1",
    classId,
    title: "Essay: My City",
    status: "open",
    questions: { "q-auto": 10, "q-essay": 10 },
  });
  for (const [index, studentId] of [STUDENT_1, STUDENT_2].entries()) {
    fake.attempts.push({
      id: `attempt-${index + 1}`,
      assessmentId: "assignment-1",
      studentId,
      status: "submitted",
      score: null,
      feedback: null,
      releasedAt: null,
      lockedBy: null,
      questionScores: {},
    });
  }
  return classId;
}

/** Same totals the grading screen computes: auto question + rubric-scored writing question. */
function questionsFor(selection: RubricSelection, autoScore: number): QuestionScoreInput[] {
  return [
    { questionId: "q-auto", isWriting: false, maxPoints: 10, autoScore, teacherScore: null },
    {
      questionId: "q-essay",
      isWriting: true,
      maxPoints: 10,
      autoScore: null,
      teacherScore: scoreFromRubric(essayRubric, selection, 10),
    },
  ];
}

beforeEach(() => {
  seed();
});

/* ---------- 1. class creation and join code generation ---------- */

describe("teacher core · class creation and join codes", () => {
  it("rejects invalid wizard input before anything is sent to the server", () => {
    const errors = validateCreateClass({ name: "A", grade: "13", termId: "", description: "" });
    expect(errors.name).toBeDefined();
    expect(errors.grade).toBeDefined();
    expect(errors.termId).toBeDefined();
    expect(
      validateCreateClass({ name: "Grade 8 A", grade: "8", termId: "term-1", description: "" }),
    ).toEqual({});
  });

  it("resolves the school year from the chosen term and groups the active year first", async () => {
    asUser(TEACHER_A);
    const terms = await fetchTerms();
    expect(yearIdForTerm(terms, "term-1")).toBe("year-1");
    expect(groupTerms(terms)[0]?.label).toBe("2026/27 (current)");
  });

  it("creates the class with join codes enabled and lists it for its teacher", async () => {
    asUser(TEACHER_A);
    const created = await createClass({
      name: "Grade 8 A",
      grade: "8",
      termId: "term-1",
      schoolYearId: "year-1",
      description: "Morning group",
    });

    const sent = fake.calls.find((c) => c.fn === "create_class");
    expect(sent?.args).toMatchObject({
      name: "Grade 8 A",
      grade: "8",
      school_year_id: "year-1",
      term_id: "term-1",
      join_code_enabled: true,
      description: "Morning group",
    });

    const page = await fetchClassesPage({ status: "active", grade: undefined, search: "" }, undefined);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.class.id).toBe(created.class_id);
    expect(page.items[0]?.students).toBe(0);
    expect(classLinks(created.class_id).roster).toBe(`/teacher/classes/${created.class_id}/students`);
  });

  it("gives every class its own 6-character join code and formats it as a share link", async () => {
    asUser(TEACHER_A);
    await createClass({ name: "Grade 8 A", grade: "8", termId: "term-1", schoolYearId: "year-1", description: "" });
    asUser(TEACHER_B);
    await createClass({ name: "Grade 9 B", grade: "9", termId: "term-1", schoolYearId: "year-1", description: "" });

    const codes = fake.classes.map((c) => c.joinCode);
    expect(new Set(codes).size).toBe(2);
    for (const code of codes) expect(code).toMatch(/^[A-Z2-9]{6}$/);

    asUser(TEACHER_A);
    const page = await fetchClassesPage({ status: "active", grade: undefined, search: "" }, undefined);
    const code = page.items[0]?.join_code ?? "";
    expect(code).toBe(codes[0]);
    expect(formatJoinCode(code)).toBe(`${code.slice(0, 3)} ${code.slice(3)}`);
    expect(joinLink("https://app.example", "/", code)).toBe(
      `https://app.example/join?code=${encodeURIComponent(code)}`,
    );
  });

  it("only lists classes the teacher teaches", async () => {
    await createClassWithAssignment();
    asUser(TEACHER_B);
    const page = await fetchClassesPage({ status: "active", grade: undefined, search: "" }, undefined);
    expect(page.items).toEqual([]);
  });
});

/* ---------- 2. roster addition and removal ---------- */

describe("teacher core · roster", () => {
  it("adds students, ignores duplicates and shows them on the roster", async () => {
    const classId = await createClassWithAssignment();
    const roster = await fetchRoster(classId);
    expect(roster.rows.map((r) => r.student.id).sort()).toEqual([STUDENT_1, STUDENT_2]);

    const again = await rpc("add_students_to_class", {
      class_id: classId,
      student_ids: [STUDENT_2, STUDENT_3],
    });
    expect(again.data).toEqual({ added: 1, skipped: 1 });
    expect((await fetchRoster(classId)).rows).toHaveLength(3);
  });

  it("refuses ids that are not active students", async () => {
    const classId = await createClassWithAssignment();
    const result = await rpc("add_students_to_class", {
      class_id: classId,
      student_ids: [TEACHER_B],
    });
    expect(result.error?.message).toBe("invalid_student");
    expect((await fetchRoster(classId)).rows).toHaveLength(2);
  });

  it("removes a student from the roster and records it in the audit log", async () => {
    const classId = await createClassWithAssignment();
    const result = await rpc("remove_student_from_class", {
      class_id: classId,
      student_id: STUDENT_1,
      reason: "Transferred to another section",
    });
    expect(result.error).toBeNull();

    const roster = await fetchRoster(classId);
    expect(roster.rows.map((r) => r.student.id)).toEqual([STUDENT_2]);
    expect(fake.auditLog).toContainEqual({
      action: "student_removed_from_class",
      classId,
      studentId: STUDENT_1,
    });

    const missing = await rpc("remove_student_from_class", {
      class_id: classId,
      student_id: STUDENT_3,
      reason: "",
    });
    expect(missing.error?.message).toBe("enrollment_not_found");
  });

  it("keeps roster changes inside the teacher's own classes", async () => {
    const classId = await createClassWithAssignment();
    asUser(TEACHER_B);
    const add = await rpc("add_students_to_class", { class_id: classId, student_ids: [STUDENT_3] });
    const remove = await rpc("remove_student_from_class", {
      class_id: classId,
      student_id: STUDENT_1,
      reason: "",
    });
    expect(add.error?.message).toBe("forbidden");
    expect(remove.error?.message).toBe("forbidden");
    expect(fake.enrollments.filter((e) => e.status === "active")).toHaveLength(2);
    expect((await rejectionOf(fetchRoster(classId))).message).toBe(
      "You do not have permission to perform this action.",
    );
  });
});

/* ---------- 3. assignment visibility ---------- */

describe("teacher core · published assignment", () => {
  it("appears in the owning teacher's hub with its submission counts", async () => {
    await createClassWithAssignment();
    const page = await fetchAssignmentsPage({ classId: undefined, status: "all", search: "" }, undefined);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: "assignment-1",
      title: "Essay: My City",
      status: "open",
      submitted: 2,
      total: 2,
      waiting_to_grade: 2,
    });
  });

  it("stays hidden from teachers of other classes and hides drafts", async () => {
    await createClassWithAssignment();
    fake.assessments.push({
      id: "assignment-draft",
      classId: fake.classes[0]?.id ?? "",
      title: "Not yet published",
      status: "draft",
      questions: { "q-auto": 5 },
    });
    asUser(TEACHER_B);
    expect((await fetchAssignmentsPage({ classId: undefined, status: "all", search: "" }, undefined)).items).toEqual([]);

    asUser(TEACHER_A);
    const titles = (
      await fetchAssignmentsPage({ classId: undefined, status: "all", search: "" }, undefined)
    ).items.map((i) => i.title);
    expect(titles).toEqual(["Essay: My City"]);
  });
});

/* ---------- 4. rubric grading arithmetic and submission ---------- */

describe("teacher core · rubric grading", () => {
  it("computes the reachable maximum from each criterion's top level", () => {
    expect(rubricMax(essayRubric)).toBe(10);
  });

  it("scales the rubric total onto the question maximum and never exceeds it", () => {
    expect(scoreFromRubric(essayRubric, { grammar: 2, vocab: 1 }, 10)).toBe(10);
    expect(scoreFromRubric(essayRubric, { grammar: 1, vocab: 0 }, 10)).toBe(4);
    expect(scoreFromRubric(essayRubric, { grammar: 2 }, 10)).toBe(5);
    expect(scoreFromRubric(essayRubric, { grammar: 2, vocab: 1 }, 4)).toBe(4);
    expect(scoreFromRubric(essayRubric, {}, 10)).toBe(0);
    expect(scoreFromRubric({ ...essayRubric, criteria: [] }, {}, 10)).toBe(0);
  });

  it("ignores out-of-range level choices instead of inventing points", () => {
    expect(scoreFromRubric(essayRubric, { grammar: 9, vocab: 1 }, 10)).toBe(5);
    expect(rubricComplete(essayRubric, { grammar: 9, vocab: 1 })).toBe(false);
    expect(rubricComplete(essayRubric, { grammar: 0, vocab: 1 })).toBe(true);
  });

  it("totals auto and writing points and blocks saving until writing is scored", () => {
    const partial: QuestionScoreInput[] = [
      { questionId: "q-auto", isWriting: false, maxPoints: 10, autoScore: 8, teacherScore: null },
      { questionId: "q-essay", isWriting: true, maxPoints: 10, autoScore: null, teacherScore: null },
    ];
    expect(computeTotals(partial)).toMatchObject({ auto: 8, writing: 0, final: 8, max: 20, undecided: ["q-essay"] });
    expect(buildSavePayload("attempt-1", partial, "", null)).toEqual({
      ok: false,
      reason: "Score the remaining writing answer before saving.",
    });

    const complete = questionsFor({ grammar: 1, vocab: 1 }, 8);
    expect(computeTotals(complete)).toMatchObject({ auto: 8, writing: 8, final: 16, max: 20, undecided: [] });
  });

  it("locks, saves and persists a rubric grade through the teacher's data layer", async () => {
    await createClassWithAssignment();
    const questions = questionsFor({ grammar: 1, vocab: 1 }, 8);
    const built = buildSavePayload("attempt-1", questions, "Well argued.", null);
    if (!built.ok) throw new Error(built.reason);

    await lockSubmission("attempt-1");
    const saved = await saveGrade(built.payload);

    expect(built.payload.rubric_scores).toEqual({ "q-auto": 8, "q-essay": 8 });
    expect(saved).toEqual({ attempt_id: "attempt-1", score: 16 });
    const attempt = fake.attempts.find((a) => a.id === "attempt-1");
    expect(attempt).toMatchObject({ status: "graded", score: 16, feedback: "Well argued.", lockedBy: null });
    expect(attempt?.questionScores).toEqual({ "q-auto": 8, "q-essay": 8 });

    const results = await fetchResults("assignment-1");
    expect(results.submissions.find((s) => s.id === "attempt-1")).toMatchObject({ final: 16, released: false });
  });

  it("requires the grading lock and honours another teacher's lock", async () => {
    await createClassWithAssignment();
    const built = buildSavePayload("attempt-1", questionsFor({ grammar: 2, vocab: 1 }, 10), "", null);
    if (!built.ok) throw new Error(built.reason);

    const unlocked = await rejectionOf(saveGrade(built.payload));
    expect(unlocked).toBeInstanceOf(GradingApiError);
    expect((unlocked as GradingApiError).code).toBe("55P03");

    await lockSubmission("attempt-1");
    // A co-teacher of the same class cannot take over a fresh lock.
    fake.classTeachers.push({ classId: fake.classes[0]?.id ?? "", teacherId: TEACHER_B, primary: false });
    asUser(TEACHER_B);
    const taken = await rejectionOf(lockSubmission("attempt-1"));
    expect((taken as GradingApiError).code).toBe("55P03");
  });

  it("rejects scores above the question or assessment maximum", async () => {
    await createClassWithAssignment();
    await lockSubmission("attempt-1");

    const overQuestion = await rejectionOf(
      saveGrade({ attempt_id: "attempt-1", rubric_scores: { "q-essay": 11 }, feedback: "", final_score: 11 }),
    );
    expect(overQuestion.message).toBe("Question score is outside its allowed range");

    const overTotal = await rejectionOf(
      saveGrade({ attempt_id: "attempt-1", rubric_scores: { "q-essay": 10 }, feedback: "", final_score: 21 }),
    );
    expect(overTotal.message).toBe("Final score exceeds the assessment maximum");
    expect(fake.attempts.find((a) => a.id === "attempt-1")?.status).toBe("submitted");
  });
});

/* ---------- 5. grade release and notification dispatch ---------- */

describe("teacher core · grade release", () => {
  async function gradeAttempt(attemptId: string, selection: RubricSelection, autoScore: number) {
    const built = buildSavePayload(attemptId, questionsFor(selection, autoScore), "", null);
    if (!built.ok) throw new Error(built.reason);
    await lockSubmission(attemptId);
    await saveGrade(built.payload);
  }

  it("releases only graded work and notifies exactly those students", async () => {
    await createClassWithAssignment();
    await gradeAttempt("attempt-1", { grammar: 2, vocab: 1 }, 10);

    const result = await releaseGrades("assignment-1");
    expect(result.released).toBe(1);
    const releaseCalls = fake.calls.filter((c) => c.fn === "release_grades");
    expect(releaseCalls[releaseCalls.length - 1]?.args).toEqual({
      assessment_id: "assignment-1",
    });

    expect(fake.attempts.find((a) => a.id === "attempt-1")?.releasedAt).not.toBeNull();
    expect(fake.attempts.find((a) => a.id === "attempt-2")?.releasedAt).toBeNull();
    expect(fake.notifications).toEqual([
      { userId: STUDENT_1, kind: "grade_released", payload: { assessment_id: "assignment-1" } },
    ]);

    const results = await fetchResults("assignment-1");
    expect(results.submissions.find((s) => s.id === "attempt-1")?.released).toBe(true);
    expect(results.submissions.find((s) => s.id === "attempt-2")?.released).toBe(false);
  });

  it("notifies every student whose grade is released in one batch", async () => {
    await createClassWithAssignment();
    await gradeAttempt("attempt-1", { grammar: 2, vocab: 1 }, 10);
    await gradeAttempt("attempt-2", { grammar: 0, vocab: 0 }, 4);

    expect((await releaseGrades("assignment-1")).released).toBe(2);
    expect(fake.notifications.map((n) => n.userId).sort()).toEqual([STUDENT_1, STUDENT_2]);
    expect(fake.attempts.map((a) => a.score).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([6, 20]);
  });

  it("releases nothing and notifies nobody when nothing is graded", async () => {
    await createClassWithAssignment();
    expect((await releaseGrades("assignment-1")).released).toBe(0);
    expect(fake.notifications).toEqual([]);
  });
});

/* ---------- 6. security boundaries between classes ---------- */

describe("teacher core · cross-class security boundaries", () => {
  it("stops a teacher from locking or grading another class's submission", async () => {
    await createClassWithAssignment();
    asUser(TEACHER_B);

    const lock = await rejectionOf(lockSubmission("attempt-1"));
    expect(lock).toBeInstanceOf(GradingApiError);
    expect((lock as GradingApiError).code).toBe("42501");
    expect(lock.message).toBe("You do not have permission to perform this action.");

    const save = await rejectionOf(
      saveGrade({ attempt_id: "attempt-1", rubric_scores: { "q-essay": 10 }, feedback: "", final_score: 10 }),
    );
    expect((save as GradingApiError).code).toBe("42501");

    const attempt = fake.attempts.find((a) => a.id === "attempt-1");
    expect(attempt).toMatchObject({ status: "submitted", score: null, lockedBy: null });
  });

  it("stops a teacher from releasing or reading another class's results", async () => {
    await createClassWithAssignment();
    asUser(TEACHER_A);
    await lockSubmission("attempt-1");
    await saveGrade({ attempt_id: "attempt-1", rubric_scores: { "q-essay": 10 }, feedback: "", final_score: 10 });

    asUser(TEACHER_B);
    expect((await rejectionOf(releaseGrades("assignment-1"))).message).toBe(
      "You do not have permission to perform this action.",
    );
    expect((await rejectionOf(fetchResults("assignment-1"))).message).toBe(
      "You do not have permission to perform this action.",
    );
    expect(fake.attempts.every((a) => a.releasedAt === null)).toBe(true);
    expect(fake.notifications).toEqual([]);
  });

  it("requires a signed-in user for every grading call", async () => {
    await createClassWithAssignment();
    fake.userId = "";
    expect((await rejectionOf(lockSubmission("attempt-1"))).message).toBe(
      "You do not have permission to perform this action.",
    );
  });

  it("lets an active admin grade any class", async () => {
    await createClassWithAssignment();
    asUser(ADMIN, "admin");
    await expect(lockSubmission("attempt-1")).resolves.toEqual({ attempt_id: "attempt-1" });
  });
});

/* ---------- 7. the deployed SQL enforces the same boundaries ---------- */

describe("teacher core · migration 038 authorization guards", () => {
  const sql: string = gradingMigrationSql;

  const bodyOf = (fnName: string) => {
    const start = sql.indexOf(`create or replace function public.${fnName}`);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = sql.indexOf("create or replace function", start + 10);
    return sql.slice(start, end === -1 ? undefined : end);
  };

  it.each([
    ["lock_submission_for_grading", "Not authorized to grade this class"],
    ["save_grade", "Not authorized to grade this class"],
    ["release_grades", "Not authorized to release grades"],
  ])("%s checks class_teachers membership before touching data", (fnName, message) => {
    const body = bodyOf(fnName);
    expect(body).toContain("public.class_teachers");
    expect(body).toContain(message);
    expect(body).toContain("errcode = '42501'");
    expect(body.indexOf("class_teachers")).toBeLessThan(body.indexOf("update public.assessment_attempts"));
  });

  it("only grants grading RPCs to signed-in users", () => {
    for (const signature of [
      "lock_submission_for_grading(uuid)",
      "save_grade(uuid, jsonb, text, numeric)",
      "release_grades(uuid)",
    ]) {
      expect(sql).toContain(`revoke all on function public.${signature} from public;`);
      expect(sql).toContain(`grant execute on function public.${signature} to authenticated;`);
    }
  });
});

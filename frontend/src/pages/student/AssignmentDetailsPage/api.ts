import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import type {
  AssignmentAttachment,
  AssignmentDetails,
  AssignmentQuestionType,
  AssignmentStatus,
  RubricCriterion,
} from "./types";

/* ========================================
   Student assignment brief (STUDENT-SPEC ST-12, API-CONTRACT 3.4)

   `get_assignment_brief {assignment_id}` returns the assignment, the resources the teacher
   attached, the included question types and the student's submission state. The contract names
   the wrapper fields but not every nested field, so the mapping below is deliberately tolerant:
   missing optional values are omitted, and anything unrecognisable becomes an empty state rather
   than crashing the page.
   ======================================== */

const briefSchema = z
  .object({
    assignment: z.unknown(),
  })
  .passthrough();

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{
  data: unknown;
  error: { message: string; code?: string | null; status?: number | null } | null;
}>;

function record(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    const found = text(value);
    if (found) return found;
  }
  return undefined;
}

function number(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const found = number(value);
    if (found !== undefined) return found;
  }
  return undefined;
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

function textArray(...sources: unknown[]): string[] {
  const result: string[] = [];
  for (const source of sources) {
    for (const item of array(source)) {
      const value = text(item);
      if (value) {
        result.push(value);
        continue;
      }
      const raw = record(item);
      const nested = firstText(raw?.["text"], raw?.["label"], raw?.["title"]);
      if (nested) result.push(nested);
    }
  }
  return result;
}

function courseName(value: unknown): string | undefined {
  const raw = record(value);
  return firstText(value, raw?.["title"], raw?.["name"]);
}

function attachmentType(raw: Record<string, unknown>): AssignmentAttachment["type"] {
  const type = firstText(
    raw["type"],
    raw["kind"],
    raw["mime_type"],
    raw["mimeType"],
    raw["mime"],
  )?.toLowerCase();
  if (type?.includes("pdf")) return "pdf";
  if (type?.startsWith("audio/") || type?.includes("audio")) return "audio";

  const name = firstText(
    raw["name"],
    raw["title"],
    raw["file_name"],
    raw["fileName"],
  )?.toLowerCase();
  if (name?.endsWith(".pdf")) return "pdf";
  if (name && /\.(mp3|wav|ogg|m4a|aac)$/.test(name)) return "audio";
  return "link";
}

function mapAttachments(...sources: unknown[]): AssignmentAttachment[] {
  const result: AssignmentAttachment[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    for (const [index, item] of array(source).entries()) {
      const raw = record(item);
      if (!raw) continue;

      const url = firstText(
        raw["url"],
        raw["href"],
        raw["download_url"],
        raw["downloadUrl"],
        raw["src"],
      );
      if (!url) continue;

      const name =
        firstText(raw["name"], raw["title"], raw["file_name"], raw["fileName"]) ??
        `Resource ${index + 1}`;
      const id =
        firstText(raw["id"], raw["asset_id"], raw["assetId"], raw["key"]) ?? `${name}-${index}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const sizeBytes = firstNumber(raw["size_bytes"], raw["sizeBytes"], raw["size"]);
      const durationSeconds = firstNumber(
        raw["duration_seconds"],
        raw["durationSeconds"],
        raw["duration"],
      );

      result.push({
        id,
        name,
        type: attachmentType(raw),
        url,
        ...(sizeBytes !== undefined ? { sizeBytes } : {}),
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
      });
    }
  }

  return result;
}

function descriptorText(value: unknown): string | undefined {
  if (typeof value === "string") return text(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = descriptorText(item);
      if (found) return found;
    }
    return undefined;
  }

  const raw = record(value);
  if (!raw) return undefined;

  const preferred = [
    "4",
    "full_credit",
    "fullCredit",
    "excellent",
    "advanced",
    "proficient",
    "meets",
  ];
  for (const key of preferred) {
    const found = descriptorText(raw[key]);
    if (found) return found;
  }
  for (const item of Object.values(raw)) {
    const found = descriptorText(item);
    if (found) return found;
  }
  return undefined;
}

function rubricList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  const raw = record(value);
  if (!raw) return [];

  for (const key of ["criteria", "items", "rows"]) {
    const list = raw[key];
    if (Array.isArray(list)) return list;
  }
  return [];
}

function mapRubric(...sources: unknown[]): RubricCriterion[] {
  const result: RubricCriterion[] = [];
  let position = 0;

  for (const source of sources) {
    for (const item of rubricList(source)) {
      const raw = record(item);
      if (!raw) continue;

      const name = firstText(raw["name"], raw["title"], raw["criterion"]);
      if (!name) continue;

      const descriptor = descriptorText(raw["descriptors"]);
      const description =
        firstText(raw["description"], raw["summary"], raw["detail"], descriptor) ?? "";
      const fullCreditExpectation =
        firstText(
          raw["full_credit_expectation"],
          raw["fullCreditExpectation"],
          raw["full_credit"],
          raw["fullCredit"],
          descriptor,
        ) ?? description;
      const maxPoints =
        firstNumber(raw["max_points"], raw["maxPoints"], raw["points"], raw["score"]) ?? 0;
      const id = firstText(raw["id"], raw["key"]) ?? `criterion-${position}`;

      result.push({
        id,
        name,
        description,
        fullCreditExpectation,
        maxPoints,
      });
      position += 1;
    }
  }

  return result;
}

function mapQuestionTypes(...sources: unknown[]): AssignmentQuestionType[] {
  const merged = new Map<string, AssignmentQuestionType>();

  for (const source of sources) {
    for (const item of array(source)) {
      let type: string | undefined;
      let count: number | undefined;

      if (typeof item === "string") {
        type = text(item);
      } else {
        const raw = record(item);
        if (!raw) continue;
        type = firstText(
          raw["type"],
          raw["kind"],
          raw["question_type"],
          raw["questionType"],
          raw["name"],
        );
        count = firstNumber(raw["count"], raw["question_count"], raw["questionCount"]);
      }

      if (!type) continue;
      const key = type.toLowerCase();
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, {
          type,
          ...(count !== undefined ? { count } : {}),
        });
        continue;
      }

      if (count !== undefined) {
        merged.set(key, {
          type: existing.type,
          count: (existing.count ?? 0) + count,
        });
      }
    }
  }

  return [...merged.values()];
}

function normalizeStatus(value: string | undefined): AssignmentStatus {
  switch (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
  ) {
    case "in_progress":
    case "started":
    case "draft":
      return "in_progress";
    case "submitted":
      return "submitted";
    case "awaiting_teacher":
    case "awaiting_grading":
    case "ai_graded":
      return "awaiting_teacher";
    case "graded":
    case "reviewed":
    case "returned":
      return "graded";
    default:
      return "not_started";
  }
}

function isNotFoundError(error: {
  message: string;
  code?: string | null;
  status?: number | null;
}): boolean {
  const code = error.code?.toLowerCase() ?? "";
  return (
    code === "pgrst116" ||
    code === "404" ||
    code === "not_found" ||
    code === "assignment_not_found" ||
    error.status === 404 ||
    /not found/i.test(error.message)
  );
}

function mapBrief(assignmentId: string, data: unknown): AssignmentDetails {
  const parsed = briefSchema.safeParse(data);
  if (!parsed.success) throw new Error("REQUEST_FAILED");

  const brief = parsed.data;
  const assignment = record(brief.assignment);
  if (!assignment) throw new Error("NOT_FOUND");

  const title = firstText(assignment["title"], brief["title"]);
  if (!title) throw new Error("REQUEST_FAILED");

  const id = firstText(assignment["id"], brief["assignment_id"], brief["id"]) ?? assignmentId;
  const wordCountSource = record(assignment["word_count"] ?? assignment["wordCount"]);
  const minWords = firstNumber(
    wordCountSource?.["min"],
    assignment["min_words"],
    assignment["minWords"],
    brief["min_words"],
    brief["minWords"],
  );
  const maxWords = firstNumber(
    wordCountSource?.["max"],
    assignment["max_words"],
    assignment["maxWords"],
    brief["max_words"],
    brief["maxWords"],
  );

  const questionTypes = mapQuestionTypes(
    brief["question_types"],
    brief["questionTypes"],
    assignment["question_types"],
    assignment["questionTypes"],
    array(assignment["questions"]).map((question) => record(question)?.["type"]),
  );

  const explicitQuestionCount = firstNumber(
    brief["question_count"],
    brief["questionCount"],
    assignment["question_count"],
    assignment["questionCount"],
  );
  const countedQuestions = questionTypes.reduce((total, item) => total + (item.count ?? 0), 0);
  const questionCount =
    explicitQuestionCount ??
    (countedQuestions > 0
      ? countedQuestions
      : array(assignment["questions"]).length > 0
        ? array(assignment["questions"]).length
        : undefined);

  const hasWriting =
    firstBoolean(brief["has_writing"], brief["hasWriting"], assignment["has_writing"]) ??
    questionTypes.some((item) => item.type.trim().toLowerCase() === "writing");

  const status = normalizeStatus(
    firstText(brief["status"], assignment["status"], brief["submission_status"]),
  );

  const attemptsSource = record(brief["attempts"] ?? assignment["attempts"]);
  const attemptsUsed = firstNumber(
    attemptsSource?.["used"],
    brief["attempts_used"],
    brief["attemptsUsed"],
    assignment["attempts_used"],
    assignment["attemptsUsed"],
  );
  const attemptsAllowed = firstNumber(
    attemptsSource?.["allowed"],
    brief["attempts_allowed"],
    brief["attemptsAllowed"],
    assignment["attempts_allowed"],
    assignment["attemptsAllowed"],
  );
  const attempts =
    attemptsUsed !== undefined || attemptsAllowed !== undefined
      ? {
          ...(attemptsUsed !== undefined ? { used: attemptsUsed } : {}),
          ...(attemptsAllowed !== undefined ? { allowed: attemptsAllowed } : {}),
        }
      : undefined;

  const draftSource = record(brief["draft"] ?? assignment["draft"]);
  const draftId = firstText(
    draftSource?.["id"],
    draftSource?.["submission_id"],
    brief["submission_id"],
  );
  const lastSavedAt = firstText(
    draftSource?.["updated_at"],
    draftSource?.["updatedAt"],
    draftSource?.["saved_at"],
    brief["last_saved_at"],
    brief["lastSavedAt"],
    assignment["last_saved_at"],
    assignment["lastSavedAt"],
  );
  const draftWordCount = firstNumber(
    draftSource?.["word_count"],
    draftSource?.["wordCount"],
    brief["draft_word_count"],
    brief["draftWordCount"],
  );
  const hasDraft = status === "in_progress" || Boolean(draftSource) || Boolean(lastSavedAt);
  const draft = hasDraft
    ? {
        ...(draftId ? { id: draftId } : {}),
        ...(lastSavedAt ? { updatedAt: lastSavedAt } : {}),
        ...(draftWordCount !== undefined ? { wordCount: draftWordCount } : {}),
      }
    : null;

  const course =
    firstText(
      assignment["course_name"],
      assignment["courseName"],
      courseName(assignment["course"]),
      brief["course_name"],
      brief["courseName"],
      courseName(brief["course"]),
    ) ?? undefined;
  const teacher =
    firstText(
      assignment["teacher_name"],
      assignment["teacherName"],
      courseName(assignment["teacher"]),
      brief["teacher_name"],
      brief["teacherName"],
      courseName(brief["teacher"]),
    ) ?? undefined;
  const dueAt =
    firstText(brief["due_at"], brief["dueAt"], assignment["due_at"], assignment["dueAt"]) ??
    undefined;
  const closeAt =
    firstText(brief["close_at"], brief["closeAt"], assignment["close_at"], assignment["closeAt"]) ??
    undefined;
  const latePolicyText =
    firstText(
      brief["late_policy_text"],
      brief["latePolicyText"],
      assignment["late_policy_text"],
      assignment["latePolicyText"],
    ) ?? undefined;
  const points =
    firstNumber(brief["points"], assignment["points"], assignment["total_points"]) ?? undefined;

  return {
    id,
    title,
    ...(course ? { courseName: course } : {}),
    ...(teacher ? { teacherName: teacher } : {}),
    ...(dueAt ? { dueAt } : {}),
    ...(closeAt ? { closeAt } : {}),
    ...(latePolicyText ? { latePolicyText } : {}),
    prompt:
      firstText(
        assignment["instructions"],
        assignment["prompt"],
        assignment["description"],
        brief["instructions"],
        brief["prompt"],
      ) ?? "Your teacher has not added instructions yet.",
    formattingGuidelines: textArray(
      assignment["formatting_guidelines"],
      assignment["formattingGuidelines"],
      assignment["guidelines"],
      brief["formatting_guidelines"],
      brief["formattingGuidelines"],
      brief["guidelines"],
    ),
    wordCount: {
      ...(minWords !== undefined ? { min: minWords } : {}),
      ...(maxWords !== undefined ? { max: maxWords } : {}),
    },
    attachments: mapAttachments(
      brief["resources"],
      assignment["resources"],
      brief["attachments"],
      assignment["attachments"],
    ),
    rubric: mapRubric(
      assignment["rubric"],
      assignment["rubric_criteria"],
      assignment["rubricCriteria"],
      brief["rubric"],
      brief["rubric_criteria"],
      brief["rubricCriteria"],
    ),
    questionTypes,
    hasWriting,
    ...(points !== undefined ? { points } : {}),
    ...(questionCount !== undefined ? { questionCount } : {}),
    status,
    ...(attempts !== undefined ? { attempts } : {}),
    ...(lastSavedAt ? { lastSavedAt } : {}),
    draft,
  };
}

export async function fetchAssignmentDetails(assignmentId: string): Promise<AssignmentDetails> {
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc("get_assignment_brief", { assignment_id: assignmentId });

  if (error) {
    if (isNotFoundError(error)) throw new Error("NOT_FOUND");
    throw new Error("REQUEST_FAILED");
  }
  if (data === null || data === undefined) throw new Error("NOT_FOUND");

  return mapBrief(assignmentId, data);
}

export type DetailsState =
  | { status: "loading" }
  | { status: "error"; code: "NOT_FOUND" | "REQUEST_FAILED" }
  | { status: "ready"; data: AssignmentDetails };

export function useAssignmentDetails(assignmentId: string | undefined) {
  const [state, setState] = useState<DetailsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!assignmentId) {
      setState({ status: "error", code: "NOT_FOUND" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    fetchAssignmentDetails(assignmentId)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          code:
            error instanceof Error && error.message === "NOT_FOUND"
              ? "NOT_FOUND"
              : "REQUEST_FAILED",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [assignmentId, attempt]);

  return { state, retry: () => setAttempt((current) => current + 1) };
}

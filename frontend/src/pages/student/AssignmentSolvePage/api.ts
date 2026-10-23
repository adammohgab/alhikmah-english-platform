import { useEffect, useState } from "react";
import { supabase } from "@/shared/api/supabase";
import { fetchAssignmentDetails } from "../AssignmentDetailsPage/api";
import type { AssignmentDetails, AssignmentStatus } from "../AssignmentDetailsPage/types";
import { hydrateAnswers, normalizeQuestions, serializeAnswers } from "./questions";
import type { AnswerMap, SolveErrorCode, SubmitResult, WorkspaceState } from "./types";

/* ========================================
   Assignment workspace data layer (ST-13)

   Reads use the API-contract RPCs `get_assignment_brief` and `start_assignment`. Saves and submits
   use the signatures that exist in migration 029:
     save_assignment_draft(assessment_id, draft_data)
     submit_assignment(assessment_id, submission_data)
   The migration stores the JSON payload as the answers map, so this layer sends the same serialized
   answer map for both calls. That keeps a resumed draft and the teacher's grading view consistent.
   ======================================== */

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

export class SolveError extends Error {
  readonly code: SolveErrorCode;

  constructor(code: SolveErrorCode, message: string = code) {
    super(message);
    this.name = "SolveError";
    this.code = code;
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

function isAlreadySubmittedError(error: { message: string; code?: string | null }): boolean {
  return (
    error.code?.toLowerCase() === "already_submitted" ||
    /already\s+submitted|already_submitted/i.test(error.message)
  );
}

function isLockedStatus(status: AssignmentStatus): boolean {
  return status === "submitted" || status === "awaiting_teacher" || status === "graded";
}

interface StartedAssignment {
  submissionId: string;
  questions: ReturnType<typeof normalizeQuestions>["questions"];
  initialAnswers: AnswerMap;
  ignoredQuestionCount: number;
}

async function startAssignment(
  assignmentId: string,
  brief: AssignmentDetails,
): Promise<StartedAssignment> {
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc("start_assignment", { assignment_id: assignmentId });

  if (error) {
    if (isAlreadySubmittedError(error)) {
      throw new SolveError("ALREADY_SUBMITTED", error.message);
    }
    if (isNotFoundError(error)) throw new SolveError("NOT_FOUND", error.message);
    throw new SolveError("REQUEST_FAILED", error.message);
  }

  const payload = record(data);
  if (!payload) throw new SolveError("REQUEST_FAILED", "start_assignment returned no data");

  const nested = record(payload.data);
  const rawQuestions =
    payload.questions ?? nested?.questions ?? record(payload.assignment)?.questions ?? [];
  const normalized = normalizeQuestions(rawQuestions, {
    ...(brief.wordCount.min !== undefined ? { min: brief.wordCount.min } : {}),
    ...(brief.wordCount.max !== undefined ? { max: brief.wordCount.max } : {}),
  });

  if (normalized.questions.length === 0) {
    throw new SolveError(
      array(rawQuestions).length > 0 ? "UNSUPPORTED_QUESTIONS" : "NO_QUESTIONS",
      "The assignment has no questions this workspace can display",
    );
  }

  const draft = payload.draft ?? payload.draft_data ?? nested?.draft ?? null;
  const submissionId =
    firstText(
      payload.submission_id,
      payload.submissionId,
      nested?.submission_id,
      nested?.submissionId,
    ) ?? "";

  return {
    submissionId,
    questions: normalized.questions,
    initialAnswers: hydrateAnswers(normalized.questions, draft),
    ignoredQuestionCount: normalized.ignoredCount,
  };
}

export async function loadAssignment(assignmentId: string): Promise<WorkspaceState> {
  let brief: AssignmentDetails;
  try {
    brief = await fetchAssignmentDetails(assignmentId);
  } catch (error) {
    const code =
      error instanceof Error && error.message === "NOT_FOUND" ? "NOT_FOUND" : "REQUEST_FAILED";
    throw new SolveError(code, error instanceof Error ? error.message : undefined);
  }

  if (isLockedStatus(brief.status)) {
    return { status: "locked", brief };
  }

  try {
    const started = await startAssignment(assignmentId, brief);
    return { status: "ready", brief, ...started };
  } catch (error) {
    if (error instanceof SolveError && error.code === "ALREADY_SUBMITTED") {
      return { status: "locked", brief };
    }
    throw error;
  }
}

export interface SaveDraftResult {
  draftVersion?: number | undefined;
  savedAt?: string | undefined;
}

export async function saveAssignmentDraft(
  assignmentId: string,
  answers: AnswerMap,
): Promise<SaveDraftResult> {
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc("save_assignment_draft", {
    assessment_id: assignmentId,
    draft_data: serializeAnswers(answers),
  });

  if (error) {
    if (isAlreadySubmittedError(error)) {
      throw new SolveError("ALREADY_SUBMITTED", error.message);
    }
    if (isNotFoundError(error)) throw new SolveError("NOT_FOUND", error.message);
    throw new SolveError("REQUEST_FAILED", error.message);
  }

  const payload = record(data);
  const draftVersion = firstNumber(payload?.draft_version, payload?.draftVersion);
  const savedAt = firstText(payload?.saved_at, payload?.savedAt);

  return {
    ...(draftVersion !== undefined ? { draftVersion } : {}),
    ...(savedAt ? { savedAt } : {}),
  };
}

export async function submitAssignment(
  assignmentId: string,
  answers: AnswerMap,
): Promise<SubmitResult> {
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc("submit_assignment", {
    assessment_id: assignmentId,
    submission_data: serializeAnswers(answers),
  });

  if (error) {
    if (isNotFoundError(error)) throw new SolveError("NOT_FOUND", error.message);
    throw new SolveError("REQUEST_FAILED", error.message);
  }

  const payload = record(data);
  if (!payload) throw new SolveError("REQUEST_FAILED", "submit_assignment returned no data");

  const status = firstText(payload.status) ?? "submitted";
  const isLate = payload.is_late === true || payload.isLate === true;
  const latePenaltyPct = firstNumber(payload.late_penalty_pct, payload.latePenaltyPct);
  const submittedAt = firstText(payload.submitted_at, payload.submittedAt);

  return {
    status,
    alreadySubmitted: payload.already_submitted === true,
    isLate,
    ...(latePenaltyPct !== undefined ? { latePenaltyPct } : {}),
    ...(submittedAt ? { submittedAt } : {}),
  };
}

export function useAssignmentWorkspace(assignmentId: string | undefined) {
  const [state, setState] = useState<WorkspaceState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!assignmentId) {
      setState({ status: "error", code: "NOT_FOUND" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    loadAssignment(assignmentId)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          code: error instanceof SolveError ? error.code : "REQUEST_FAILED",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [assignmentId, attempt]);

  return {
    state,
    retry: () => setAttempt((current) => current + 1),
  };
}

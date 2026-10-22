import type { Question, QuestionPrompt, QuestionValue } from "@/shared/components/questions/types";
import type { AssignmentDetails } from "../AssignmentDetailsPage/types";

/* ========================================
   Assignment solving workspace (STUDENT-SPEC ST-13)
   ======================================== */

/** A question that uses the rich writing editor instead of QuestionRenderer. */
export interface WritingSolveQuestion {
  kind: "writing";
  id: string;
  type: "writing";
  prompt: QuestionPrompt;
  points?: number | undefined;
  minWords?: number | undefined;
  maxWords?: number | undefined;
  /** The type the backend sent, kept for the question-type label. */
  sourceType: string;
}

/** A question rendered by the shared QuestionRenderer. */
export interface RendererSolveQuestion {
  kind: "renderer";
  id: string;
  question: Question;
  points?: number | undefined;
}

export type SolveQuestion = WritingSolveQuestion | RendererSolveQuestion;

/** A rich-text answer stores both the editor HTML and the plain text used for counters. */
export interface WritingAnswer {
  html: string;
  text: string;
  wordCount: number;
  characterCount: number;
}

export type SolveAnswer = QuestionValue | WritingAnswer;

export type AnswerMap = Record<string, SolveAnswer>;

export type SolveErrorCode =
  "NOT_FOUND" | "REQUEST_FAILED" | "ALREADY_SUBMITTED" | "NO_QUESTIONS" | "UNSUPPORTED_QUESTIONS";

export interface ReadyWorkspace {
  brief: AssignmentDetails;
  submissionId: string;
  questions: SolveQuestion[];
  initialAnswers: AnswerMap;
  ignoredQuestionCount: number;
}

export type WorkspaceState =
  | { status: "loading" }
  | { status: "error"; code: SolveErrorCode }
  | { status: "locked"; brief: AssignmentDetails }
  | ({ status: "ready" } & ReadyWorkspace);

export interface SubmitResult {
  status: string;
  alreadySubmitted: boolean;
  isLate: boolean;
  latePenaltyPct?: number | undefined;
  submittedAt?: string | undefined;
}

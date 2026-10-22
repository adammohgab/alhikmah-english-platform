export type AttachmentType = "pdf" | "audio" | "link";

export type AssignmentStatus =
  "not_started" | "in_progress" | "submitted" | "awaiting_teacher" | "graded";

export interface AssignmentAttachment {
  id: string;
  name: string;
  type: AttachmentType;
  url: string;
  sizeBytes?: number | undefined;
  durationSeconds?: number | undefined;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  fullCreditExpectation: string;
  maxPoints: number;
}

export interface AssignmentQuestionType {
  type: string;
  count?: number | undefined;
}

export interface AssignmentAttempts {
  used?: number | undefined;
  allowed?: number | undefined;
}

export interface AssignmentDraftSummary {
  id?: string | undefined;
  updatedAt?: string | undefined;
  wordCount?: number | undefined;
}

export interface AssignmentDetails {
  id: string;
  title: string;
  courseName?: string | undefined;
  teacherName?: string | undefined;
  dueAt?: string | undefined;
  closeAt?: string | undefined;
  latePolicyText?: string | undefined;
  prompt: string;
  formattingGuidelines: string[];
  wordCount: { min?: number | undefined; max?: number | undefined };
  attachments: AssignmentAttachment[];
  rubric: RubricCriterion[];
  questionTypes: AssignmentQuestionType[];
  hasWriting: boolean;
  points?: number | undefined;
  questionCount?: number | undefined;
  status: AssignmentStatus;
  attempts?: AssignmentAttempts | undefined;
  lastSavedAt?: string | undefined;
  draft?: AssignmentDraftSummary | null | undefined;
}

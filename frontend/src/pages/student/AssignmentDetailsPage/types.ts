export type AttachmentType = "pdf" | "audio";

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

export interface AssignmentDraftSummary {
  id: string;
  updatedAt: string;
  wordCount: number;
}

export interface AssignmentDetails {
  id: string;
  title: string;
  courseName?: string | undefined;
  dueAt?: string | undefined;
  prompt: string;
  formattingGuidelines: string[];
  wordCount: { min?: number | undefined; max?: number | undefined };
  attachments: AssignmentAttachment[];
  rubric: RubricCriterion[];
  draft?: AssignmentDraftSummary | null | undefined;
}

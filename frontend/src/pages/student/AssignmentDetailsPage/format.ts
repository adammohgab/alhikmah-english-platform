import type { AssignmentStatus } from "./types";

export function formatWordTarget(min?: number, max?: number): string {
  if (min != null && max != null) return `${min}-${max} words`;
  if (min != null) return `At least ${min} words`;
  if (max != null) return `Up to ${max} words`;
  return "No word count target";
}

export function formatDate(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatSize(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes === 0) return "0 B";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds?: number): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

const STATUS_LABELS: Record<AssignmentStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  awaiting_teacher: "Awaiting teacher",
  graded: "Graded",
};

export function formatStatus(status: AssignmentStatus): string {
  return STATUS_LABELS[status];
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True / false",
  fill_blank: "Fill in the blank",
  matching: "Matching",
  listening: "Listening",
  writing: "Writing",
  short_answer: "Short answer",
  essay: "Essay",
};

export function formatQuestionType(type: string): string {
  const key = type
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const label = QUESTION_TYPE_LABELS[key];
  if (label) return label;
  if (!key) return "";
  return key
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatAttempts(used?: number, allowed?: number): string {
  if (allowed != null && used != null) return `${used} of ${allowed} used`;
  if (allowed != null) return `${allowed} allowed`;
  if (used != null) return `${used} used`;
  return "";
}

export function formatDueCountdown(iso?: string, now: Date = new Date()): string {
  if (!iso) return "";
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return "";

  const difference = due.getTime() - now.getTime();
  const absoluteMinutes = Math.ceil(Math.abs(difference) / 60_000);
  const late = difference < 0 ? "Overdue" : "Due";

  if (absoluteMinutes < 1) return difference < 0 ? "Overdue" : "Due now";
  if (absoluteMinutes < 60) {
    return `${late} ${difference < 0 ? "by" : "in"} ${absoluteMinutes} min`;
  }

  const absoluteHours = Math.ceil(absoluteMinutes / 60);
  if (absoluteHours < 24) {
    return `${late} ${difference < 0 ? "by" : "in"} ${absoluteHours} hr`;
  }

  const absoluteDays = Math.ceil(absoluteHours / 24);
  return `${late} ${difference < 0 ? "by" : "in"} ${absoluteDays} day${absoluteDays === 1 ? "" : "s"}`;
}

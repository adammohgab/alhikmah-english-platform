import type { SolveQuestion } from "./types";

const TYPE_LABELS: Record<string, string> = {
  audio_spelling: "Listening",
  fill_blank: "Fill in the blank",
  matching: "Matching",
  multiple_choice: "Multiple choice",
  reorder: "Put in order",
  short_answer: "Short answer",
  writing: "Writing",
};

export function formatQuestionType(question: SolveQuestion): string {
  if (question.kind === "writing") {
    return TYPE_LABELS[question.sourceType.toLowerCase()] ?? "Writing";
  }
  return TYPE_LABELS[question.question.type] ?? "Question";
}

export function formatPoints(points: number | undefined): string | undefined {
  if (points === undefined || points <= 0) return undefined;
  return `${points} ${points === 1 ? "point" : "points"}`;
}

export function formatDue(value: string | undefined): string {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatWordTarget(
  minWords: number | undefined,
  maxWords: number | undefined,
): string | undefined {
  if (minWords !== undefined && maxWords !== undefined) {
    return `${minWords}–${maxWords} words`;
  }
  if (minWords !== undefined) return `At least ${minWords} words`;
  if (maxWords !== undefined) return `Up to ${maxWords} words`;
  return undefined;
}

export function formatSavedAt(savedAt: number | null, now: number): string | undefined {
  if (savedAt === null) return undefined;
  const seconds = Math.max(0, Math.round((now - savedAt) / 1000));
  if (seconds < 45) return "Saved just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes <= 1) return "Saved 1 minute ago";
  if (minutes < 60) return `Saved ${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "Saved 1 hour ago";
  if (hours < 24) return `Saved ${hours} hours ago`;
  return "Saved earlier today";
}

export function formatPromptPreview(value: string, maxLength = 72): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled question";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

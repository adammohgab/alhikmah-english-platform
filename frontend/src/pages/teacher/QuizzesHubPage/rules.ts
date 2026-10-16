import type { QuizRow, QuizStatus } from "./api";

export const STATUS_LABELS: Record<QuizStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  open: "Open",
  closed: "Closed",
};

export type StatusFilter = QuizStatus | "all";

/** Whole-number percent for display; "—" when there is no value yet. */
export function percent(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "—" : `${Math.round(value)}%`;
}

export function timeLimitLabel(minutes: number | null): string {
  return minutes == null ? "No time limit" : `${minutes} min`;
}

export const questionLabel = (count: number) =>
  `${count} ${count === 1 ? "question" : "questions"}`;

/** Total students in a quiz right now, across the listed quizzes. */
export function totalLive(
  rows: readonly QuizRow[],
  live: Readonly<Record<string, number>>,
): number {
  return rows.reduce((sum, row) => sum + (live[row.id] ?? 0), 0);
}

/** Pass-rate badge tone: a pass rate under 60 needs a look. */
export function passTone(rate: number): "good" | "watch" {
  return rate >= 60 ? "good" : "watch";
}

/** Which actions make sense for a status (a quiz with no questions cannot be opened). */
export function availableActions(row: QuizRow): { openEarly: boolean; close: boolean } {
  return {
    openEarly: row.status === "scheduled" && row.question_count > 0,
    close: row.status === "open",
  };
}

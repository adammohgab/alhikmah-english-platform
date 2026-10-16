import type { AssignmentRow, AssignmentStatus, StatusFilter } from "./api";

/* Pure display rules for the assignments hub. */

export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  open: "Open",
  closed: "Closed",
};

export const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  ...STATUS_LABELS,
  needs_grading: "Needs grading",
};

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "Due in 3 days", "Overdue: 2 hours ago", "No due date". */
export function dueLabel(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "No due date";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "No due date";
  const diff = time - now;
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) {
      const text = relative.format(Math.round(diff / ms), unit);
      return diff < 0 ? `Overdue: ${text}` : `Due ${text}`;
    }
  }
  return "Due now";
}

export const isOverdue = (row: AssignmentRow, now = Date.now()): boolean => {
  if (!row.due_at || row.status === "closed" || row.status === "draft") return false;
  const time = Date.parse(row.due_at);
  return !Number.isNaN(time) && time < now;
};

/** "22/28 submitted" and its share for the mini bar (0 when nobody is assigned yet). */
export const submissionLabel = (row: AssignmentRow) => `${row.submitted}/${row.total} submitted`;
export const submissionShare = (row: AssignmentRow) =>
  row.total === 0 ? 0 : Math.min(100, (row.submitted / row.total) * 100);

export function availableActions(row: AssignmentRow) {
  return {
    grade: row.status !== "draft" && row.status !== "scheduled",
    closeEarly: row.status === "open",
  };
}

const enc = encodeURIComponent;

export const assignmentLinks = (id: string) => ({
  grade: `/teacher/grading?assignment=${enc(id)}`,
  edit: `/teacher/assignments/${enc(id)}/edit`,
  results: `/teacher/assignments/${enc(id)}`,
});

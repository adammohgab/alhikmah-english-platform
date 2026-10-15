import type { QueueRow } from "./api";

/* Pure queue logic: filtering, urgency sorting and picking the next submission to grade. */

export type SortMode = "oldest" | "due";
export type KindFilter = "all" | "essay" | "quiz_review" | "speaking";
export type DueFilter = "all" | "overdue" | "week" | "later";

export const KIND_LABELS: Record<string, string> = {
  essay: "Essay",
  quiz_review: "Quiz review",
  speaking: "Speaking",
};

export const kindLabel = (kind: string) => KIND_LABELS[kind] ?? kind;

/** A submission still needs the teacher unless it is already graded. */
export const isPending = (row: QueueRow) => row.status !== "graded";

const time = (iso: string | null | undefined, fallback: number) => {
  if (!iso) return fallback;
  const value = Date.parse(iso);
  return Number.isNaN(value) ? fallback : value;
};

export function matchesDue(row: QueueRow, due: DueFilter, now: number): boolean {
  if (due === "all") return true;
  if (!row.due_at) return false;
  const dueTime = time(row.due_at, NaN);
  if (Number.isNaN(dueTime)) return false;
  const weekAhead = now + 7 * 86_400_000;
  if (due === "overdue") return dueTime < now;
  if (due === "week") return dueTime >= now && dueTime <= weekAhead;
  return dueTime > weekAhead;
}

export function filterRows(
  rows: readonly QueueRow[],
  kind: KindFilter,
  due: DueFilter,
  now: number,
): QueueRow[] {
  return rows.filter(
    (row) => (kind === "all" || row.assessment_kind === kind) && matchesDue(row, due, now),
  );
}

/**
 * Oldest submission first (the default urgency order); ties fall back to the earlier due date.
 * "due" sorts by due date first, with no-deadline work last, then by submission age.
 */
export function sortRows(rows: readonly QueueRow[], mode: SortMode): QueueRow[] {
  const submitted = (row: QueueRow) => time(row.submitted_at, Number.MAX_SAFE_INTEGER);
  const due = (row: QueueRow) => time(row.due_at, Number.MAX_SAFE_INTEGER);
  const first = mode === "oldest" ? submitted : due;
  const second = mode === "oldest" ? due : submitted;
  return [...rows].sort(
    (a, b) =>
      first(a) - first(b) ||
      second(a) - second(b) ||
      a.submission_id.localeCompare(b.submission_id),
  );
}

/** First submission in queue order that is pending and not open with another teacher. */
export function nextToGrade(rows: readonly QueueRow[]): QueueRow | undefined {
  return rows.find((row) => isPending(row) && !row.locked_by) ?? rows.find(isPending);
}

export interface AssignmentGroup {
  assignmentId: string;
  title: string;
  className: string;
  kind: string;
  gradingMode: string | null;
  rows: QueueRow[];
}

/** Groups already-sorted rows by assignment; groups keep the order of their first row. */
export function groupByAssignment(rows: readonly QueueRow[]): AssignmentGroup[] {
  const groups = new Map<string, AssignmentGroup>();
  for (const row of rows) {
    const existing = groups.get(row.assignment_id);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(row.assignment_id, {
        assignmentId: row.assignment_id,
        title: row.assignment_title,
        className: row.class.name,
        kind: row.assessment_kind,
        gradingMode: row.grading_mode ?? null,
        rows: [row],
      });
    }
  }
  return [...groups.values()];
}

/** AI grades eligible for bulk approval: done and not flagged. */
export const bulkApprovable = (rows: readonly QueueRow[]) =>
  rows.filter((row) => row.status === "ai_graded" && row.ai_status === "done");

/* ========================================
   Deadline rules for the dashboard widget (STUDENT-SPEC ST-01, STU-CORE-02)

   Pure functions, no I/O. They turn `my_deadlines` rows into the list the widget shows:
   overdue items first, then upcoming ones in date order, with plain-language due text.
   ======================================== */

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
/** Items due within this window get the pulsing "due soon" clock tag. */
export const DUE_SOON_MS = DAY_MS;
/** The dashboard shows at most this many deadlines (ST-01). */
export const DEADLINE_LIMIT = 5;

export type DeadlineKind = "assignment" | "quiz";

/** One `my_deadlines` row after parsing. */
export interface RawDeadline {
  kind: DeadlineKind;
  id: string;
  title: string;
  course: string | null;
  dueAt: string | null;
  status: string | null;
  action: string | null;
  overdue: boolean | null;
}

export interface Deadline {
  key: string;
  kind: DeadlineKind;
  id: string;
  title: string;
  course: string | null;
  /** Epoch milliseconds, `null` when the item has no due date. */
  dueAt: number | null;
  statusLabel: string;
  actionLabel: string;
  overdue: boolean;
  dueSoon: boolean;
  dueText: string;
  /** The assessment start page (ST-08 for a quiz, ST-12 for an assignment). */
  path: string;
}

/** Where a deadline opens: the quiz start page or the assignment details page. */
export function deadlinePath(kind: DeadlineKind, id: string): string {
  const safe = encodeURIComponent(id);
  return kind === "quiz" ? `/student/quizzes/${safe}` : `/student/assignments/${safe}`;
}

function humanise(value: string): string {
  const text = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return text === "" ? "Not started" : text.charAt(0).toUpperCase() + text.slice(1);
}

export function statusLabel(status: string | null): string {
  return status === null ? "Not started" : humanise(status);
}

export function actionLabel(action: string | null, status: string | null): string {
  const value = (action ?? "").trim().toLowerCase();
  if (value === "continue" || value === "resume") return "Continue";
  if (value === "start") return "Start";
  if (value === "view") return "View";
  return status?.trim().toLowerCase() === "in_progress" ? "Continue" : "Start";
}

const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** "Overdue by 2 days", "Due in 5h", "Due tomorrow", "Due Nov 3". */
export function dueText(dueAt: number | null, overdue: boolean, now: number): string {
  if (dueAt === null) return overdue ? "Overdue" : "No due date";
  if (overdue) {
    const late = Math.max(0, now - dueAt);
    if (late < HOUR_MS) return `Overdue by ${Math.max(1, Math.round(late / 60_000))} min`;
    if (late < DAY_MS) return `Overdue by ${Math.round(late / HOUR_MS)}h`;
    return `Overdue by ${plural(Math.floor(late / DAY_MS), "day")}`;
  }
  const left = dueAt - now;
  if (left < HOUR_MS) return `Due in ${Math.max(1, Math.round(left / 60_000))} min`;
  if (left < DAY_MS) return `Due in ${Math.round(left / HOUR_MS)}h`;
  if (left < 2 * DAY_MS) return "Due tomorrow";
  if (left < 14 * DAY_MS) return `Due in ${plural(Math.floor(left / DAY_MS), "day")}`;
  return `Due ${SHORT_DATE.format(new Date(dueAt))}`;
}

function parseTime(iso: string | null): number | null {
  if (iso === null) return null;
  const value = Date.parse(iso);
  return Number.isNaN(value) ? null : value;
}

/** Overdue items first (oldest first), then upcoming by date, then items with no date. */
function group(item: Deadline): number {
  if (item.overdue) return 0;
  return item.dueAt === null ? 2 : 1;
}

export function toDeadlines(
  rows: readonly RawDeadline[],
  now: number,
  limit: number = DEADLINE_LIMIT,
): Deadline[] {
  const items = rows.map((row): Deadline => {
    const dueAt = parseTime(row.dueAt);
    const overdue = row.overdue === true || (dueAt !== null && dueAt < now);
    return {
      key: `${row.kind}:${row.id}`,
      kind: row.kind,
      id: row.id,
      title: row.title,
      course: row.course,
      dueAt,
      statusLabel: statusLabel(row.status),
      actionLabel: actionLabel(row.action, row.status),
      overdue,
      dueSoon: !overdue && dueAt !== null && dueAt - now <= DUE_SOON_MS,
      dueText: dueText(dueAt, overdue, now),
      path: deadlinePath(row.kind, row.id),
    };
  });

  return items
    .sort((a, b) => {
      const order = group(a) - group(b);
      if (order !== 0) return order;
      if (a.dueAt !== null && b.dueAt !== null && a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
      return a.title.localeCompare(b.title);
    })
    .slice(0, Math.max(0, limit));
}

/** Assignments that are past due and still not submitted (the homework alert). */
export function overdueAssignments(items: readonly Deadline[]): number {
  return items.filter((item) => item.kind === "assignment" && item.overdue).length;
}

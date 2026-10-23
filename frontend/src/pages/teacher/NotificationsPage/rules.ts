import type { NotificationRow } from "./api";

/* Pure rules: which tab a notification belongs to and where clicking it should lead. */

export type Category = "submissions" | "class_requests" | "system";
export type CategoryFilter = Category | "all";

export const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "All",
  submissions: "Submissions",
  class_requests: "Class requests",
  system: "System notices",
};

/** Event kinds from TC-28, grouped into the three tabs. Unknown kinds only appear under All. */
export function categorize(kind: string): Category | null {
  if (/join|invite|request/.test(kind)) return "class_requests";
  if (/submission|grading|ai_grade|deadline|quiz|flagged|attention/.test(kind))
    return "submissions";
  if (/admin|system|announcement|course|maintenance/.test(kind)) return "system";
  return null;
}

export function matchesCategory(row: NotificationRow, filter: CategoryFilter): boolean {
  return filter === "all" || categorize(row.kind) === filter;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const enc = encodeURIComponent;

/** Only in-app paths are followed; anything else is ignored rather than navigated to. */
const isInternal = (link: string) => link.startsWith("/") && !link.startsWith("//");

/**
 * The page a notification opens: its own link when it has an in-app one, otherwise the action
 * item named in its payload (grading screen, class roster for join requests, quiz results).
 */
export function destinationFor(row: NotificationRow): string | null {
  if (row.link && isInternal(row.link)) return row.link;
  const payload = row.payload ?? {};
  const submissionId = text(payload.submission_id);
  if (submissionId) return `/teacher/grading/${enc(submissionId)}`;
  const classId = text(payload.class_id);
  if (classId && categorize(row.kind) === "class_requests")
    return `/teacher/classes/${enc(classId)}/students`;
  const quizId = text(payload.quiz_id);
  if (quizId) return `/teacher/quizzes/${enc(quizId)}`;
  const assignmentId = text(payload.assignment_id);
  if (assignmentId) return `/teacher/assignments/${enc(assignmentId)}`;
  return null;
}

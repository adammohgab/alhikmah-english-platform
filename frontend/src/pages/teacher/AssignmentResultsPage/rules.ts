import type { SubmissionRow } from "./api";

/* Pure rules for the assignment results page: status labels, summary counts and CSV export. */

export type StatusKey = "not_started" | "in_progress" | "submitted" | "ai_graded" | "graded";

const LABELS: Record<StatusKey, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  submitted: "Submitted",
  ai_graded: "AI Graded",
  graded: "Graded",
};

export function statusLabel(status: string): string {
  return LABELS[status as StatusKey] ?? status;
}

export interface ResultsSummary {
  total: number;
  notStarted: number;
  submitted: number;
  graded: number;
  late: number;
  /** Graded but not yet visible to the student. */
  unreleased: number;
}

export function summarize(rows: readonly SubmissionRow[]): ResultsSummary {
  const summary: ResultsSummary = {
    total: rows.length,
    notStarted: 0,
    submitted: 0,
    graded: 0,
    late: 0,
    unreleased: 0,
  };
  for (const row of rows) {
    if (row.status === "not_started") summary.notStarted += 1;
    if (row.status === "submitted" || row.status === "ai_graded") summary.submitted += 1;
    if (row.status === "graded") {
      summary.graded += 1;
      if (row.released !== true) summary.unreleased += 1;
    }
    if (row.is_late === true) summary.late += 1;
  }
  return summary;
}

export function formatSubmittedAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatScore(score: number | null | undefined, max: number | null | undefined) {
  if (score == null) return "—";
  return max != null ? `${score} / ${max}` : String(score);
}

/**
 * One CSV cell. Quotes are doubled, and a cell starting with = + - @ gets a leading apostrophe
 * so a student name cannot run as a spreadsheet formula when the file is opened.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildResultsCsv(
  rows: readonly SubmissionRow[],
  maxPoints: number | null | undefined,
) {
  const header = ["Student", "Status", "Score", "Max score", "Submitted at", "Late"];
  const lines = rows.map((row) =>
    [
      row.student.full_name,
      statusLabel(row.status),
      row.final ?? "",
      maxPoints ?? "",
      row.submitted_at ?? "",
      row.is_late === true ? "Yes" : "No",
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.map(csvCell).join(","), ...lines].join("\r\n");
}

export function csvFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "assignment"}-results.csv`;
}

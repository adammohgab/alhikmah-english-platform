/* ========================================
   Student progress rules (TEACHER-SPEC TC-08)
   Pure helpers: grade letter, score pill tone, the merged assessment timeline and chart points.
   ======================================== */

export type PillTone = "good" | "ok" | "low" | "none";

export interface QuizResult {
  id: string;
  title: string;
  date: string;
  scorePct: number | null;
  attempts: number | null;
  passed: boolean | null;
}

export interface AssignmentResult {
  id: string;
  title: string;
  date: string;
  scorePct: number | null;
  status: string;
}

export type TimelineKind = "quiz" | "assignment";

export interface TimelineEntry {
  key: string;
  kind: TimelineKind;
  title: string;
  date: string;
  scorePct: number | null;
  detail: string;
}

/** Letter grade for a percentage (the school grading bands). */
export function gradeLetter(pct: number | null): string {
  if (pct === null) return "—";
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

export function pillTone(pct: number | null): PillTone {
  if (pct === null) return "none";
  if (pct >= 80) return "good";
  if (pct >= 60) return "ok";
  return "low";
}

export function formatPct(pct: number | null): string {
  return pct === null ? "—" : `${Math.round(pct)}%`;
}

const time = (iso: string) => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Completed assessments only (a result with a date and a score), newest first.
 * Quizzes and assignments share one chronological list.
 */
export function buildTimeline(
  quizzes: QuizResult[],
  assignments: AssignmentResult[],
): TimelineEntry[] {
  const fromQuizzes: TimelineEntry[] = quizzes
    .filter((q) => q.scorePct !== null)
    .map((q) => ({
      key: `quiz-${q.id}`,
      kind: "quiz" as const,
      title: q.title,
      date: q.date,
      scorePct: q.scorePct,
      detail: [
        q.attempts !== null ? `${q.attempts} attempt${q.attempts === 1 ? "" : "s"}` : null,
        q.passed === null ? null : q.passed ? "Passed" : "Not passed",
      ]
        .filter(Boolean)
        .join(" · "),
    }));
  const fromAssignments: TimelineEntry[] = assignments
    .filter((a) => a.scorePct !== null)
    .map((a) => ({
      key: `assignment-${a.id}`,
      kind: "assignment" as const,
      title: a.title,
      date: a.date,
      scorePct: a.scorePct,
      detail: a.status,
    }));
  return [...fromQuizzes, ...fromAssignments].sort((a, b) => time(b.date) - time(a.date));
}

export interface TrendPoint {
  label: string;
  scorePct: number;
}

/** Oldest to newest, last `limit` scored assessments (the chart reads left to right). */
export function trendPoints(timeline: TimelineEntry[], limit = 10): TrendPoint[] {
  return timeline
    .filter((e): e is TimelineEntry & { scorePct: number } => e.scorePct !== null)
    .slice(0, limit)
    .reverse()
    .map((e) => ({ label: e.title, scorePct: e.scorePct }));
}

/** Change between the first and last point, rounded; null with fewer than two points. */
export function trendDelta(points: TrendPoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0]!.scorePct;
  const last = points[points.length - 1]!.scorePct;
  return Math.round(last - first);
}

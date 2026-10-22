/* ========================================
   Quizzes hub rules (STUDENT-SPEC ST-07, STU-CORE-08)

   Pure functions, no I/O: which tab a quiz belongs in, which quizzes are urgent, how the score
   reads, and how the list is searched, filtered and sorted. The page and its tests share them.
   ======================================== */

export const HOUR_MS = 3_600_000;
/** A quiz that closes within this window is urgent. */
export const URGENT_WINDOW_MS = 24 * HOUR_MS;

export interface QuizLock {
  locked: boolean;
  reason: string | null;
  lessonsRemaining: number | null;
  unlocksOn: string | null;
}

export interface AvailableQuiz {
  id: string;
  title: string;
  course: string | null;
  className: string | null;
  unit: string | null;
  questionCount: number;
  /** `null` when the quiz is untimed. */
  timeLimitMin: number | null;
  attemptsUsed: number;
  attemptsAllowed: number;
  bestScorePct: number | null;
  opensAt: string | null;
  /** When the quiz closes. */
  dueAt: string | null;
  lock: QuizLock;
}

export interface HistoryAttempt {
  attemptId: string;
  quizId: string;
  title: string;
  course: string | null;
  className: string | null;
  submittedAt: string | null;
  /** `null` while the score is not available yet. */
  scorePct: number | null;
  passed: boolean | null;
  attemptNo: number;
}

/** What a student can do with an available-tab quiz right now. */
export type QuizState = "ready" | "upcoming" | "exhausted" | "closed";

function ms(iso: string | null): number | null {
  if (iso === null) return null;
  const value = Date.parse(iso);
  return Number.isNaN(value) ? null : value;
}

export function quizState(quiz: AvailableQuiz, now: number): QuizState {
  const closes = ms(quiz.dueAt);
  const opens = ms(quiz.opensAt);
  const unlocksOn = ms(quiz.lock.unlocksOn);

  if (closes !== null && closes <= now) return "closed";
  if (opens !== null && opens > now) return "upcoming";
  if (quiz.lock.locked) return "upcoming";
  if (unlocksOn !== null && unlocksOn > now && quiz.lock.lessonsRemaining === null) {
    return "upcoming";
  }
  if (quiz.attemptsUsed >= quiz.attemptsAllowed) return "exhausted";
  return "ready";
}

/** True when a startable quiz closes within 24 hours. */
export function isUrgent(quiz: AvailableQuiz, now: number): boolean {
  if (quizState(quiz, now) !== "ready") return false;
  const closes = ms(quiz.dueAt);
  return closes !== null && closes - now <= URGENT_WINDOW_MS;
}

export interface HubTabs {
  /** Startable quizzes first (soonest closing first), then ones with no attempts left or closed. */
  available: AvailableQuiz[];
  upcoming: AvailableQuiz[];
}

function byDueThenTitle(a: AvailableQuiz, b: AvailableQuiz): number {
  const aDue = ms(a.dueAt);
  const bDue = ms(b.dueAt);
  if (aDue !== null && bDue !== null && aDue !== bDue) return aDue - bDue;
  if (aDue !== null && bDue === null) return -1;
  if (aDue === null && bDue !== null) return 1;
  return a.title.localeCompare(b.title);
}

function byOpensThenTitle(a: AvailableQuiz, b: AvailableQuiz): number {
  const aOpen = ms(a.opensAt) ?? ms(a.lock.unlocksOn);
  const bOpen = ms(b.opensAt) ?? ms(b.lock.unlocksOn);
  if (aOpen !== null && bOpen !== null && aOpen !== bOpen) return aOpen - bOpen;
  if (aOpen !== null && bOpen === null) return -1;
  if (aOpen === null && bOpen !== null) return 1;
  return a.title.localeCompare(b.title);
}

const STATE_ORDER: Record<QuizState, number> = { ready: 0, exhausted: 1, closed: 2, upcoming: 3 };

export function splitQuizzes(quizzes: readonly AvailableQuiz[], now: number): HubTabs {
  const available: AvailableQuiz[] = [];
  const upcoming: AvailableQuiz[] = [];
  for (const quiz of quizzes) {
    (quizState(quiz, now) === "upcoming" ? upcoming : available).push(quiz);
  }
  available.sort((a, b) => {
    const order = STATE_ORDER[quizState(a, now)] - STATE_ORDER[quizState(b, now)];
    return order !== 0 ? order : byDueThenTitle(a, b);
  });
  upcoming.sort(byOpensThenTitle);
  return { available, upcoming };
}

/* ---------- Copy ---------- */

export function lockMessage(lock: QuizLock): string {
  if (lock.lessonsRemaining !== null && lock.lessonsRemaining > 0) {
    const count = lock.lessonsRemaining;
    return `Finish ${count} more ${count === 1 ? "lesson" : "lessons"} in this unit`;
  }
  return lock.reason ?? "Not open yet";
}

export function attemptsLabel(used: number, allowed: number): string {
  return `${Math.min(used, allowed)} of ${allowed} ${allowed === 1 ? "attempt" : "attempts"} used`;
}

export function timeLimitLabel(minutes: number | null): string {
  return minutes === null ? "No time limit" : `${minutes} min`;
}

export function questionCountLabel(count: number): string {
  return `${count} ${count === 1 ? "question" : "questions"}`;
}

/** Whole percent for display, clamped to 0 to 100. `null` when there is no score. */
export function formatScore(scorePct: number | null): string | null {
  if (scorePct === null || !Number.isFinite(scorePct)) return null;
  return `${Math.round(Math.min(100, Math.max(0, scorePct)))}%`;
}

export function clampPct(value: number | null): number {
  return value === null || !Number.isFinite(value) ? 0 : Math.min(100, Math.max(0, value));
}

const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** "Closes in 5h", "Closes tomorrow", "Closes Nov 3". `null` when the quiz has no close date. */
export function closesLabel(dueAt: string | null, now: number): string | null {
  const due = ms(dueAt);
  if (due === null) return null;
  const diff = due - now;
  if (diff <= 0) return "Closed";
  if (diff < HOUR_MS) return `Closes in ${Math.max(1, Math.round(diff / 60_000))} min`;
  if (diff < 24 * HOUR_MS) return `Closes in ${Math.round(diff / HOUR_MS)}h`;
  if (diff < 48 * HOUR_MS) return "Closes tomorrow";
  return `Closes ${SHORT_DATE.format(new Date(due))}`;
}

export function opensLabel(quiz: AvailableQuiz): string | null {
  const when = quiz.opensAt ?? quiz.lock.unlocksOn;
  const value = ms(when);
  if (value === null) return null;
  return `Opens ${SHORT_DATE.format(new Date(value))}`;
}

/* ---------- Filters ---------- */

export type HistoryStatus = "all" | "passed" | "not_passed" | "pending";

export interface HubFilters {
  search: string;
  /** Course title, or `null` for all courses. */
  course: string | null;
}

function normalise(text: string): string {
  return text.trim().toLocaleLowerCase();
}

export function matchesSearch(title: string, search: string): boolean {
  const needle = normalise(search);
  return needle === "" || normalise(title).includes(needle);
}

export function filterAvailable(
  quizzes: readonly AvailableQuiz[],
  filters: HubFilters,
): AvailableQuiz[] {
  return quizzes.filter(
    (quiz) =>
      matchesSearch(quiz.title, filters.search) &&
      (filters.course === null || quiz.course === filters.course),
  );
}

export function historyStatusOf(attempt: HistoryAttempt): Exclude<HistoryStatus, "all"> {
  if (attempt.scorePct === null || attempt.passed === null) return "pending";
  return attempt.passed ? "passed" : "not_passed";
}

export function filterHistory(
  attempts: readonly HistoryAttempt[],
  filters: HubFilters,
  status: HistoryStatus,
): HistoryAttempt[] {
  return attempts
    .filter(
      (attempt) =>
        matchesSearch(attempt.title, filters.search) &&
        (filters.course === null || attempt.course === filters.course) &&
        (status === "all" || historyStatusOf(attempt) === status),
    )
    .sort((a, b) => (ms(b.submittedAt) ?? 0) - (ms(a.submittedAt) ?? 0));
}

export function courseOptions(items: ReadonlyArray<{ course: string | null }>): string[] {
  return [...new Set(items.flatMap((item) => (item.course === null ? [] : [item.course])))].sort(
    (a, b) => a.localeCompare(b),
  );
}

/* ---------- Routes (STUDENT-SPEC section 3) ---------- */

export const quizStartPath = (quizId: string): string =>
  `/student/quizzes/${encodeURIComponent(quizId)}`;

export const quizResultPath = (quizId: string, attemptId: string): string =>
  `/student/quizzes/${encodeURIComponent(quizId)}/result/${encodeURIComponent(attemptId)}`;

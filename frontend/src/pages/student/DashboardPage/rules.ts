/* ========================================
   Student dashboard rules (STUDENT-SPEC ST-01, ECONOMY-AND-GAMES sections 3.1 to 3.2)

   Pure functions with no I/O, so the page and its tests share one definition of: the level
   table, rank titles, the daily XP goal, the greeting and the Continue Learning target.
   ======================================== */

export const MAX_LEVEL = 60;

/** School day boundary. The region setting is admin-only, so students use the school zone. */
export const SCHOOL_TIME_ZONE = "Africa/Tripoli";

export type DailyGoalId = "light" | "regular" | "serious";

/* STUDENT-SPEC section 11 only names the three tiers. The XP numbers follow ECONOMY-AND-GAMES
   section 2: a light day earns about 80 to 120 XP and an engaged day 220 to 260. */
export const DAILY_GOAL_XP: Record<DailyGoalId, number> = {
  light: 60,
  regular: 120,
  serious: 240,
};

export const DEFAULT_DAILY_GOAL: DailyGoalId = "regular";

export function parseDailyGoal(value: unknown): DailyGoalId {
  return value === "light" || value === "regular" || value === "serious"
    ? value
    : DEFAULT_DAILY_GOAL;
}

/* ---------- Levels and ranks ---------- */

/** Total XP at which `level` starts. Matches `award_xp`: min(60, floor(sqrt(xp / 100)) + 1). */
export function xpForLevel(level: number): number {
  const whole = Math.max(1, Math.trunc(level));
  return 100 * (whole - 1) ** 2;
}

export function levelForXp(totalXp: number): number {
  const xp = Number.isFinite(totalXp) ? Math.max(0, totalXp) : 0;
  return Math.min(MAX_LEVEL, Math.floor(Math.sqrt(xp / 100)) + 1);
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  xpInLevel: number;
  /** XP still needed for the next level. `0` at the top level. */
  xpToNext: number;
  /** Size of the current level in XP (`xpInLevel + xpToNext`). */
  levelSpan: number;
  /** 0 to 100. */
  percent: number;
  isMaxLevel: boolean;
}

export function levelProgress(totalXp: number, storedLevel?: number): LevelProgress {
  const xp = Number.isFinite(totalXp) ? Math.max(0, Math.trunc(totalXp)) : 0;
  const known = storedLevel !== undefined && storedLevel >= 1 ? storedLevel : levelForXp(xp);
  const level = Math.min(MAX_LEVEL, Math.max(1, Math.trunc(known)));
  if (level >= MAX_LEVEL) {
    return {
      level,
      xpInLevel: Math.max(0, xp - xpForLevel(level)),
      xpToNext: 0,
      levelSpan: 0,
      percent: 100,
      isMaxLevel: true,
    };
  }
  const start = xpForLevel(level);
  const span = xpForLevel(level + 1) - start;
  const inLevel = Math.min(span, Math.max(0, xp - start));
  return {
    level,
    xpInLevel: inLevel,
    xpToNext: span - inLevel,
    levelSpan: span,
    percent: span > 0 ? (inLevel / span) * 100 : 0,
    isMaxLevel: false,
  };
}

/** Rank title from the level (ECONOMY-AND-GAMES section 3.2: a new title every 10 levels). */
export function rankTitle(level: number): string {
  if (level >= 60) return "Grandmaster";
  if (level >= 50) return "Scholar";
  if (level >= 40) return "Linguist";
  if (level >= 30) return "Storyteller";
  if (level >= 20) return "Wordsmith";
  if (level >= 10) return "Explorer";
  return "Newcomer";
}

/* ---------- Greeting ---------- */

/** Hour of day (0 to 23) in the school's time zone. */
export function schoolHour(now: Date, timeZone: string = SCHOOL_TIME_ZONE): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone,
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    return Number.isFinite(hour) ? hour : now.getHours();
  } catch {
    return now.getHours();
  }
}

export function greetingFor(hour: number): "Good morning" | "Good afternoon" | "Good evening" {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function firstNameOf(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : "there";
}

/* ---------- Daily XP goal ---------- */

export interface DailyXpProgress {
  earned: number;
  target: number;
  /** 0 to 100, clamped. */
  percent: number;
  remaining: number;
  reached: boolean;
}

export function dailyXpProgress(earnedToday: number, goal: DailyGoalId): DailyXpProgress {
  const target = DAILY_GOAL_XP[goal];
  const earned = Number.isFinite(earnedToday) ? Math.max(0, Math.trunc(earnedToday)) : 0;
  return {
    earned,
    target,
    percent: Math.min(100, (earned / target) * 100),
    remaining: Math.max(0, target - earned),
    reached: earned >= target,
  };
}

/** Sums ledger amounts. Corrections can be negative, so the total never drops below zero. */
export function sumXp(amounts: readonly number[]): number {
  return Math.max(
    0,
    amounts.reduce((total, amount) => total + (Number.isFinite(amount) ? amount : 0), 0),
  );
}

/** ISO instant at which the school day containing `now` began. */
export function startOfSchoolDay(now: Date, timeZone: string = SCHOOL_TIME_ZONE): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const pick = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
    // The wall clock in the school zone, read as if it were UTC, gives the zone's offset.
    const wallAsUtc = Date.UTC(
      pick("year"),
      pick("month") - 1,
      pick("day"),
      pick("hour"),
      pick("minute"),
      pick("second"),
    );
    const offset = wallAsUtc - Math.floor(now.getTime() / 1000) * 1000;
    const midnightWall = Date.UTC(pick("year"), pick("month") - 1, pick("day"));
    return new Date(midnightWall - offset).toISOString();
  } catch {
    const local = new Date(now);
    local.setHours(0, 0, 0, 0);
    return local.toISOString();
  }
}

/* ---------- Continue Learning ---------- */

export interface CourseLesson {
  id: string;
  title: string;
  orderIndex: number;
}

export interface CourseUnit {
  id: string;
  title: string;
  orderIndex: number;
  lessons: CourseLesson[];
}

export interface ResumeTarget {
  /** `resume` re-opens an unfinished lesson, `next` the next pending one, `start` the first. */
  kind: "resume" | "next" | "start";
  courseId: string;
  courseTitle: string;
  unitId: string;
  unitTitle: string;
  lessonId: string;
  lessonTitle: string;
  completedLessons: number;
  totalLessons: number;
}

export function lessonPath(target: Pick<ResumeTarget, "courseId" | "unitId" | "lessonId">): string {
  return `/student/courses/${encodeURIComponent(target.courseId)}/units/${encodeURIComponent(
    target.unitId,
  )}/lessons/${encodeURIComponent(target.lessonId)}`;
}

interface FlatLesson {
  unit: CourseUnit;
  lesson: CourseLesson;
}

function flattenCourse(units: readonly CourseUnit[]): FlatLesson[] {
  return [...units]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .flatMap((unit) =>
      [...unit.lessons]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((lesson) => ({ unit, lesson })),
    );
}

export interface PickInput {
  courseId: string;
  courseTitle: string;
  units: readonly CourseUnit[];
  completedLessonIds: ReadonlySet<string>;
  /** The lesson the student opened last and did not finish, when there is one. */
  inProgressLessonId: string | null;
  /** The lesson the student opened last (finished or not), to continue from. */
  lastLessonId: string | null;
}

/**
 * Chooses the lesson the Continue Learning card opens:
 * 1. the unfinished lesson the student left last,
 * 2. otherwise the first unfinished lesson after the last one they opened (wrapping to the start),
 * 3. otherwise the first unfinished lesson of the course.
 * Returns `null` when the course has no lessons or every lesson is complete.
 */
export function pickResumeTarget(input: PickInput): ResumeTarget | null {
  const flat = flattenCourse(input.units);
  if (flat.length === 0) return null;

  const isDone = (item: FlatLesson): boolean => input.completedLessonIds.has(item.lesson.id);
  const completedLessons = flat.filter(isDone).length;
  const build = (item: FlatLesson, kind: ResumeTarget["kind"]): ResumeTarget => ({
    kind,
    courseId: input.courseId,
    courseTitle: input.courseTitle,
    unitId: item.unit.id,
    unitTitle: item.unit.title,
    lessonId: item.lesson.id,
    lessonTitle: item.lesson.title,
    completedLessons,
    totalLessons: flat.length,
  });

  if (input.inProgressLessonId !== null) {
    const open = flat.find((item) => item.lesson.id === input.inProgressLessonId);
    if (open && !isDone(open)) return build(open, "resume");
  }

  const pending = flat.filter((item) => !isDone(item));
  if (pending.length === 0) return null;

  const lastIndex =
    input.lastLessonId === null
      ? -1
      : flat.findIndex((item) => item.lesson.id === input.lastLessonId);
  if (lastIndex >= 0) {
    const after = flat.slice(lastIndex + 1).find((item) => !isDone(item));
    const next = after ?? pending[0];
    if (next) return build(next, "next");
  }

  const first = pending[0];
  return first ? build(first, completedLessons === 0 ? "start" : "next") : null;
}

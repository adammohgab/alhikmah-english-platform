import { describe, expect, it } from "vitest";
import {
  DAILY_GOAL_XP,
  dailyXpProgress,
  firstNameOf,
  greetingFor,
  levelForXp,
  levelProgress,
  lessonPath,
  parseDailyGoal,
  pickResumeTarget,
  rankTitle,
  schoolHour,
  startOfSchoolDay,
  sumXp,
  xpForLevel,
  type CourseUnit,
} from "./rules";

const units: CourseUnit[] = [
  {
    id: "u2",
    title: "Family",
    orderIndex: 2,
    lessons: [{ id: "l4", title: "My Family", orderIndex: 1 }],
  },
  {
    id: "u1",
    title: "Greetings",
    orderIndex: 1,
    lessons: [
      { id: "l2", title: "Introductions", orderIndex: 2 },
      { id: "l1", title: "Hello", orderIndex: 1 },
      { id: "l3", title: "Goodbye", orderIndex: 3 },
    ],
  },
];

const base = { courseId: "c1", courseTitle: "Grade 7 English", units };

describe("levels", () => {
  it("matches the award_xp formula", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(450)).toBe(3);
    expect(levelForXp(1_000_000)).toBe(60);
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(3)).toBe(400);
  });

  it("reports XP inside the level and to the next one", () => {
    const progress = levelProgress(450, 3);
    expect(progress).toMatchObject({ level: 3, xpInLevel: 50, xpToNext: 450, levelSpan: 500 });
    expect(progress.percent).toBeCloseTo(10);
    expect(progress.isMaxLevel).toBe(false);
  });

  it("has no next level at the top", () => {
    const progress = levelProgress(400_000, 60);
    expect(progress).toMatchObject({ level: 60, xpToNext: 0, percent: 100, isMaxLevel: true });
  });

  it("treats a missing or negative total as level 1", () => {
    expect(levelProgress(-5)).toMatchObject({ level: 1, xpInLevel: 0, xpToNext: 100 });
  });

  it("names the rank every 10 levels", () => {
    expect(rankTitle(1)).toBe("Newcomer");
    expect(rankTitle(9)).toBe("Newcomer");
    expect(rankTitle(10)).toBe("Explorer");
    expect(rankTitle(59)).toBe("Scholar");
    expect(rankTitle(60)).toBe("Grandmaster");
  });
});

describe("greeting", () => {
  it("picks the greeting from the hour", () => {
    expect(greetingFor(5)).toBe("Good morning");
    expect(greetingFor(12)).toBe("Good afternoon");
    expect(greetingFor(18)).toBe("Good evening");
    expect(greetingFor(23)).toBe("Good evening");
  });

  it("reads the hour in the school time zone", () => {
    expect(schoolHour(new Date("2026-10-22T10:30:00Z"), "Africa/Tripoli")).toBe(12);
    expect(schoolHour(new Date("2026-10-22T23:30:00Z"), "Africa/Tripoli")).toBe(1);
  });

  it("uses the first name", () => {
    expect(firstNameOf("  Sara  Ahmed ")).toBe("Sara");
    expect(firstNameOf("")).toBe("there");
    expect(firstNameOf(null)).toBe("there");
  });
});

describe("daily XP goal", () => {
  it("falls back to the regular goal", () => {
    expect(parseDailyGoal("serious")).toBe("serious");
    expect(parseDailyGoal("extreme")).toBe("regular");
    expect(parseDailyGoal(undefined)).toBe("regular");
  });

  it("fills in proportion to today's earnings", () => {
    const progress = dailyXpProgress(30, "regular");
    expect(progress.target).toBe(DAILY_GOAL_XP.regular);
    expect(progress.percent).toBeCloseTo(25);
    expect(progress.remaining).toBe(90);
    expect(progress.reached).toBe(false);
  });

  it("caps the bar at full once the goal is met", () => {
    const progress = dailyXpProgress(500, "light");
    expect(progress).toMatchObject({ percent: 100, remaining: 0, reached: true });
  });

  it("never goes below zero", () => {
    expect(sumXp([20, -50])).toBe(0);
    expect(sumXp([20, 15, 10])).toBe(45);
    expect(dailyXpProgress(-4, "regular").percent).toBe(0);
  });

  it("starts the school day at local midnight", () => {
    expect(startOfSchoolDay(new Date("2026-10-22T10:30:00Z"), "Africa/Tripoli")).toBe(
      "2026-10-21T22:00:00.000Z",
    );
    expect(startOfSchoolDay(new Date("2026-10-22T23:30:00Z"), "Africa/Tripoli")).toBe(
      "2026-10-22T22:00:00.000Z",
    );
  });
});

describe("pickResumeTarget", () => {
  it("re-opens the unfinished lesson the student left", () => {
    const target = pickResumeTarget({
      ...base,
      completedLessonIds: new Set(["l1"]),
      inProgressLessonId: "l2",
      lastLessonId: "l2",
    });
    expect(target).toMatchObject({
      kind: "resume",
      lessonId: "l2",
      unitId: "u1",
      completedLessons: 1,
      totalLessons: 4,
    });
  });

  it("moves to the next pending lesson after the last finished one", () => {
    const target = pickResumeTarget({
      ...base,
      completedLessonIds: new Set(["l1", "l2"]),
      inProgressLessonId: null,
      lastLessonId: "l2",
    });
    expect(target).toMatchObject({ kind: "next", lessonId: "l3" });
  });

  it("crosses into the next unit in course order", () => {
    const target = pickResumeTarget({
      ...base,
      completedLessonIds: new Set(["l1", "l2", "l3"]),
      inProgressLessonId: null,
      lastLessonId: "l3",
    });
    expect(target).toMatchObject({ kind: "next", lessonId: "l4", unitId: "u2" });
  });

  it("starts at the first lesson for a student with no progress", () => {
    const target = pickResumeTarget({
      ...base,
      completedLessonIds: new Set(),
      inProgressLessonId: null,
      lastLessonId: null,
    });
    expect(target).toMatchObject({ kind: "start", lessonId: "l1", completedLessons: 0 });
  });

  it("wraps to an earlier skipped lesson when nothing is pending after the last one", () => {
    const target = pickResumeTarget({
      ...base,
      completedLessonIds: new Set(["l2", "l3", "l4"]),
      inProgressLessonId: null,
      lastLessonId: "l4",
    });
    expect(target).toMatchObject({ kind: "next", lessonId: "l1" });
  });

  it("returns null when everything is complete or the course is empty", () => {
    expect(
      pickResumeTarget({
        ...base,
        completedLessonIds: new Set(["l1", "l2", "l3", "l4"]),
        inProgressLessonId: null,
        lastLessonId: "l4",
      }),
    ).toBeNull();
    expect(
      pickResumeTarget({
        ...base,
        units: [],
        completedLessonIds: new Set(),
        inProgressLessonId: null,
        lastLessonId: null,
      }),
    ).toBeNull();
  });

  it("builds the lesson route from the spec", () => {
    expect(lessonPath({ courseId: "c1", unitId: "u1", lessonId: "l2" })).toBe(
      "/student/courses/c1/units/u1/lessons/l2",
    );
  });
});

import { describe, expect, it } from "vitest";
import { courseProgress, estimateMinutes, isQuizLocked, type CourseUnit } from "./api";

const unit = (overrides: Partial<CourseUnit> = {}): CourseUnit => ({
  id: "unit-1",
  title: "Unit one",
  description: null,
  position: 1,
  status: null,
  progress: null,
  lessons: [
    { id: "lesson-1", title: "Lesson one", minutes: 12, done: true, activities: [] },
    { id: "lesson-2", title: "Lesson two", minutes: 8, done: false, activities: [] },
  ],
  activities: [],
  quiz: null,
  skills: [],
  objectives: [],
  ...overrides,
});

describe("course roadmap calculations", () => {
  it("calculates course completion from the server progress snapshot", () => {
    expect(courseProgress([unit(), unit({ id: "unit-2", progress: { done: 3, total: 3 }, lessons: [] })])).toBe(80);
  });

  it("falls back to lesson completion when unit progress is absent", () => {
    expect(courseProgress([unit()])).toBe(50);
  });

  it("returns zero progress for a course with no lessons", () => {
    expect(courseProgress([unit({ lessons: [], progress: { done: 0, total: 0 } })])).toBe(0);
  });

  it("estimates total lesson time and uses a ten-minute fallback", () => {
    expect(estimateMinutes([unit(), unit({ id: "unit-2", lessons: [{ id: "l3", title: "Lesson three", minutes: null, done: false, activities: [] }] })])).toBe(30);
  });

  it("interprets the server's different quiz lock representations", () => {
    expect(isQuizLocked({ id: "q", lock: true })).toBe(true);
    expect(isQuizLocked({ id: "q", lock: "locked" })).toBe(true);
    expect(isQuizLocked({ id: "q", lock: { locked: true, reason: "Finish lessons" } })).toBe(true);
    expect(isQuizLocked({ id: "q", lock: false })).toBe(false);
    expect(isQuizLocked({ id: "q", lock: "unlocked" })).toBe(false);
    expect(isQuizLocked(null)).toBe(false);
  });
});

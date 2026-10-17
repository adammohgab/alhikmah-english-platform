import { describe, expect, it } from "vitest";
import { buildTimeline, gradeLetter, pillTone, trendDelta, trendPoints } from "./rules";

describe("grade bands", () => {
  it("maps percentages to letters and tones", () => {
    expect([95, 85, 75, 65, 40].map(gradeLetter)).toEqual(["A", "B", "C", "D", "F"]);
    expect(gradeLetter(null)).toBe("—");
    expect([80, 60, 59.9, null].map(pillTone)).toEqual(["good", "ok", "low", "none"]);
  });
});

describe("timeline", () => {
  const timeline = buildTimeline(
    [
      {
        id: "q1",
        title: "Verbs quiz",
        date: "2026-10-01T10:00:00Z",
        scorePct: 70,
        attempts: 2,
        passed: true,
      },
      {
        id: "q2",
        title: "Unstarted",
        date: "2026-10-09T10:00:00Z",
        scorePct: null,
        attempts: 0,
        passed: null,
      },
    ],
    [{ id: "a1", title: "Essay", date: "2026-10-05T10:00:00Z", scorePct: 90, status: "Graded" }],
  );

  it("merges completed quizzes and assignments, newest first, skipping unscored ones", () => {
    expect(timeline.map((e) => e.key)).toEqual(["assignment-a1", "quiz-q1"]);
    expect(timeline[1]?.detail).toBe("2 attempts · Passed");
  });

  it("builds chart points oldest to newest and the change across them", () => {
    const points = trendPoints(timeline);
    expect(points.map((p) => p.scorePct)).toEqual([70, 90]);
    expect(trendDelta(points)).toBe(20);
    expect(trendDelta(points.slice(0, 1))).toBeNull();
  });
});

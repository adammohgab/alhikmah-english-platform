import { describe, expect, it } from "vitest";
import {
  attemptsLabel,
  clampPct,
  closesLabel,
  courseOptions,
  filterAvailable,
  filterHistory,
  formatScore,
  historyStatusOf,
  isUrgent,
  lockMessage,
  quizResultPath,
  quizStartPath,
  quizState,
  splitQuizzes,
  timeLimitLabel,
  type AvailableQuiz,
  type HistoryAttempt,
  type HistoryStatus,
} from "./rules";

const NOW = Date.parse("2026-10-22T12:00:00Z");
const hours = (count: number): string => new Date(NOW + count * 3_600_000).toISOString();

function quiz(overrides: Partial<AvailableQuiz> = {}): AvailableQuiz {
  return {
    id: "q1",
    title: "Unit 1 Quiz",
    course: "Grade 7 English",
    className: "7A",
    unit: "Greetings",
    questionCount: 10,
    timeLimitMin: 20,
    attemptsUsed: 0,
    attemptsAllowed: 2,
    bestScorePct: null,
    opensAt: null,
    dueAt: null,
    lock: { locked: false, reason: null, lessonsRemaining: null, unlocksOn: null },
    ...overrides,
  };
}

function attempt(overrides: Partial<HistoryAttempt> = {}): HistoryAttempt {
  return {
    attemptId: "a1",
    quizId: "q1",
    title: "Unit 1 Quiz",
    course: "Grade 7 English",
    className: "7A",
    submittedAt: hours(-48),
    scorePct: 80,
    passed: true,
    attemptNo: 1,
    ...overrides,
  };
}

describe("quizState", () => {
  it("is ready when the quiz is open with attempts left", () => {
    expect(quizState(quiz({ dueAt: hours(72) }), NOW)).toBe("ready");
    expect(quizState(quiz(), NOW)).toBe("ready");
  });

  it("is upcoming before it opens or while locked", () => {
    expect(quizState(quiz({ opensAt: hours(5) }), NOW)).toBe("upcoming");
    expect(
      quizState(
        quiz({ lock: { locked: true, reason: "Locked", lessonsRemaining: 2, unlocksOn: null } }),
        NOW,
      ),
    ).toBe("upcoming");
    expect(
      quizState(
        quiz({
          lock: { locked: false, reason: null, lessonsRemaining: null, unlocksOn: hours(9) },
        }),
        NOW,
      ),
    ).toBe("upcoming");
  });

  it("is closed after the close time, even with attempts left", () => {
    expect(quizState(quiz({ dueAt: hours(-1) }), NOW)).toBe("closed");
  });

  it("is exhausted when every attempt is used", () => {
    expect(quizState(quiz({ attemptsUsed: 2, attemptsAllowed: 2 }), NOW)).toBe("exhausted");
  });
});

describe("isUrgent", () => {
  it("flags a startable quiz closing within 24 hours", () => {
    expect(isUrgent(quiz({ dueAt: hours(5) }), NOW)).toBe(true);
    expect(isUrgent(quiz({ dueAt: hours(24) }), NOW)).toBe(true);
  });

  it("ignores later, closed, locked and exhausted quizzes", () => {
    expect(isUrgent(quiz({ dueAt: hours(30) }), NOW)).toBe(false);
    expect(isUrgent(quiz({ dueAt: hours(-2) }), NOW)).toBe(false);
    expect(isUrgent(quiz({ dueAt: hours(5), opensAt: hours(2) }), NOW)).toBe(false);
    expect(isUrgent(quiz({ dueAt: hours(5), attemptsUsed: 2 }), NOW)).toBe(false);
    expect(isUrgent(quiz(), NOW)).toBe(false);
  });
});

describe("splitQuizzes", () => {
  it("separates available from upcoming and orders by urgency", () => {
    const later = quiz({ id: "later", title: "Later", dueAt: hours(72) });
    const soon = quiz({ id: "soon", title: "Soon", dueAt: hours(5) });
    const noDate = quiz({ id: "none", title: "Open ended" });
    const used = quiz({ id: "used", title: "Used up", attemptsUsed: 2, dueAt: hours(1) });
    const future = quiz({ id: "future", title: "Future", opensAt: hours(20) });
    const sooner = quiz({ id: "sooner", title: "Sooner", opensAt: hours(4) });

    const tabs = splitQuizzes([later, noDate, used, future, soon, sooner], NOW);
    expect(tabs.available.map((item) => item.id)).toEqual(["soon", "later", "none", "used"]);
    expect(tabs.upcoming.map((item) => item.id)).toEqual(["sooner", "future"]);
  });
});

describe("copy", () => {
  it("explains a lesson lock and falls back to the server reason", () => {
    expect(lockMessage({ locked: true, reason: null, lessonsRemaining: 2, unlocksOn: null })).toBe(
      "Finish 2 more lessons in this unit",
    );
    expect(lockMessage({ locked: true, reason: null, lessonsRemaining: 1, unlocksOn: null })).toBe(
      "Finish 1 more lesson in this unit",
    );
    expect(
      lockMessage({
        locked: true,
        reason: "Teacher locked it",
        lessonsRemaining: null,
        unlocksOn: null,
      }),
    ).toBe("Teacher locked it");
  });

  it("formats attempts and time limits", () => {
    expect(attemptsLabel(1, 3)).toBe("1 of 3 attempts used");
    expect(attemptsLabel(5, 1)).toBe("1 of 1 attempt used");
    expect(timeLimitLabel(null)).toBe("No time limit");
    expect(timeLimitLabel(20)).toBe("20 min");
  });

  it("formats the earned grade as a whole percent", () => {
    expect(formatScore(79.6)).toBe("80%");
    expect(formatScore(140)).toBe("100%");
    expect(formatScore(-3)).toBe("0%");
    expect(formatScore(null)).toBeNull();
    expect(clampPct(null)).toBe(0);
    expect(clampPct(120)).toBe(100);
  });

  it("words the closing time", () => {
    expect(closesLabel(null, NOW)).toBeNull();
    expect(closesLabel(hours(-1), NOW)).toBe("Closed");
    expect(closesLabel(new Date(NOW + 20 * 60_000).toISOString(), NOW)).toBe("Closes in 20 min");
    expect(closesLabel(hours(5), NOW)).toBe("Closes in 5h");
    expect(closesLabel(hours(30), NOW)).toBe("Closes tomorrow");
  });
});

describe("filters", () => {
  it("searches by title and filters by course", () => {
    const items = [
      quiz({ id: "a", title: "Grammar Basics", course: "Grade 7 English" }),
      quiz({ id: "b", title: "Vocabulary", course: "Grade 8 English" }),
    ];
    const ids = (search: string, course: string | null): string[] =>
      filterAvailable(items, { search, course }).map((item) => item.id);
    expect(ids("gram", null)).toEqual(["a"]);
    expect(ids("", "Grade 8 English")).toEqual(["b"]);
    expect(filterAvailable(items, { search: "  ", course: null })).toHaveLength(2);
  });

  it("filters history by result and lists the newest first", () => {
    const items = [
      attempt({ attemptId: "old", submittedAt: hours(-72), passed: false, scorePct: 40 }),
      attempt({ attemptId: "new", submittedAt: hours(-2), passed: true, scorePct: 90 }),
      attempt({ attemptId: "wait", submittedAt: hours(-10), passed: null, scorePct: null }),
    ];
    const all = { search: "", course: null };
    const ids = (status: HistoryStatus): string[] =>
      filterHistory(items, all, status).map((item) => item.attemptId);
    expect(ids("all")).toEqual(["new", "wait", "old"]);
    expect(ids("passed")).toEqual(["new"]);
    expect(ids("not_passed")).toEqual(["old"]);
    expect(ids("pending")).toEqual(["wait"]);
    expect(historyStatusOf(items[2]!)).toBe("pending");
  });

  it("lists each course once, sorted", () => {
    expect(
      courseOptions([{ course: "B" }, { course: null }, { course: "A" }, { course: "B" }]),
    ).toEqual(["A", "B"]);
  });
});

describe("routes", () => {
  it("matches the spec paths", () => {
    expect(quizStartPath("q1")).toBe("/student/quizzes/q1");
    expect(quizResultPath("q1", "a9")).toBe("/student/quizzes/q1/result/a9");
  });
});

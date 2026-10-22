import { describe, expect, it } from "vitest";
import {
  actionLabel,
  deadlinePath,
  dueText,
  overdueAssignments,
  statusLabel,
  toDeadlines,
  type RawDeadline,
} from "./deadlines";

const NOW = Date.parse("2026-10-22T12:00:00Z");
const at = (hours: number): string => new Date(NOW + hours * 3_600_000).toISOString();

function row(overrides: Partial<RawDeadline> = {}): RawDeadline {
  return {
    kind: "assignment",
    id: "a1",
    title: "Essay",
    course: "Grade 7 English",
    dueAt: at(48),
    status: "not_started",
    action: "start",
    overdue: false,
    ...overrides,
  };
}

describe("toDeadlines", () => {
  it("lists overdue first, then upcoming chronologically, then undated", () => {
    const items = toDeadlines(
      [
        row({ id: "late", title: "Late", dueAt: at(72) }),
        row({ id: "none", title: "No date", dueAt: null }),
        row({ id: "soon", title: "Soon", kind: "quiz", dueAt: at(3) }),
        row({ id: "old", title: "Old", dueAt: at(-50), overdue: true }),
        row({ id: "recent", title: "Recent", dueAt: at(-2), overdue: true }),
      ],
      NOW,
    );
    expect(items.map((item) => item.id)).toEqual(["old", "recent", "soon", "late", "none"]);
  });

  it("keeps only the first five", () => {
    const rows = Array.from({ length: 8 }, (_, index) =>
      row({ id: `r${index}`, title: `R${index}`, dueAt: at(index + 1) }),
    );
    expect(toDeadlines(rows, NOW)).toHaveLength(5);
  });

  it("marks past-due items overdue even when the server flag is missing", () => {
    const [item] = toDeadlines([row({ dueAt: at(-1), overdue: null })], NOW);
    expect(item).toMatchObject({ overdue: true, dueSoon: false });
  });

  it("flags items due within 24 hours as due soon", () => {
    const [soon, later] = toDeadlines(
      [row({ id: "s", dueAt: at(23) }), row({ id: "l", dueAt: at(25) })],
      NOW,
    );
    expect(soon).toMatchObject({ id: "s", dueSoon: true, overdue: false });
    expect(later).toMatchObject({ id: "l", dueSoon: false });
  });

  it("links straight to the assessment start page", () => {
    const [quiz, assignment] = toDeadlines(
      [row({ kind: "quiz", id: "q9", dueAt: at(1) }), row({ id: "a9", dueAt: at(2) })],
      NOW,
    );
    expect(quiz?.path).toBe("/student/quizzes/q9");
    expect(assignment?.path).toBe("/student/assignments/a9");
    expect(deadlinePath("quiz", "x y")).toBe("/student/quizzes/x%20y");
  });

  it("counts overdue assignments only", () => {
    const items = toDeadlines(
      [
        row({ id: "a", dueAt: at(-5), overdue: true }),
        row({ id: "q", kind: "quiz", dueAt: at(-5), overdue: true }),
        row({ id: "b", dueAt: at(5) }),
      ],
      NOW,
    );
    expect(overdueAssignments(items)).toBe(1);
  });
});

describe("dueText", () => {
  it("words overdue time", () => {
    expect(dueText(NOW - 20 * 60_000, true, NOW)).toBe("Overdue by 20 min");
    expect(dueText(NOW - 5 * 3_600_000, true, NOW)).toBe("Overdue by 5h");
    expect(dueText(NOW - 86_400_000, true, NOW)).toBe("Overdue by 1 day");
    expect(dueText(NOW - 3 * 86_400_000, true, NOW)).toBe("Overdue by 3 days");
    expect(dueText(null, true, NOW)).toBe("Overdue");
  });

  it("words upcoming time", () => {
    expect(dueText(NOW + 10 * 60_000, false, NOW)).toBe("Due in 10 min");
    expect(dueText(NOW + 5 * 3_600_000, false, NOW)).toBe("Due in 5h");
    expect(dueText(NOW + 30 * 3_600_000, false, NOW)).toBe("Due tomorrow");
    expect(dueText(NOW + 4 * 86_400_000, false, NOW)).toBe("Due in 4 days");
    expect(dueText(null, false, NOW)).toBe("No due date");
  });
});

describe("labels", () => {
  it("humanises status and picks the action", () => {
    expect(statusLabel("in_progress")).toBe("In progress");
    expect(statusLabel(null)).toBe("Not started");
    expect(actionLabel("continue", "in_progress")).toBe("Continue");
    expect(actionLabel(null, "in_progress")).toBe("Continue");
    expect(actionLabel(null, "not_started")).toBe("Start");
  });
});

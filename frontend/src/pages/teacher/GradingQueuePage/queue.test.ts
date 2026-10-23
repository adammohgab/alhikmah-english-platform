import { describe, expect, it } from "vitest";
import type { QueueRow } from "./api";
import { filterRows, groupByAssignment, nextToGrade, sortRows } from "./queue";

function row(overrides: Partial<QueueRow> & { submission_id: string }): QueueRow {
  return {
    assignment_id: "a1",
    assignment_title: "Essay",
    assessment_kind: "essay",
    class: { id: "c1", name: "8A" },
    student: { id: "s1", full_name: "Student" },
    submitted_at: "2026-10-10T10:00:00Z",
    status: "waiting",
    ai_status: "off",
    ...overrides,
  };
}

const NOW = Date.parse("2026-10-15T12:00:00Z");

describe("grading queue logic", () => {
  it("puts the oldest submissions first", () => {
    const sorted = sortRows(
      [
        row({ submission_id: "new", submitted_at: "2026-10-14T10:00:00Z" }),
        row({ submission_id: "old", submitted_at: "2026-10-01T10:00:00Z" }),
        row({ submission_id: "mid", submitted_at: "2026-10-08T10:00:00Z" }),
      ],
      "oldest",
    );
    expect(sorted.map((item) => item.submission_id)).toEqual(["old", "mid", "new"]);
  });

  it("sorts by due date with undated work last", () => {
    const sorted = sortRows(
      [
        row({ submission_id: "none" }),
        row({ submission_id: "late", due_at: "2026-10-20T00:00:00Z" }),
        row({ submission_id: "soon", due_at: "2026-10-16T00:00:00Z" }),
      ],
      "due",
    );
    expect(sorted.map((item) => item.submission_id)).toEqual(["soon", "late", "none"]);
  });

  it("filters by kind and due date", () => {
    const rows = [
      row({ submission_id: "e", due_at: "2026-10-01T00:00:00Z" }),
      row({ submission_id: "s", assessment_kind: "speaking", due_at: "2026-10-18T00:00:00Z" }),
    ];
    expect(filterRows(rows, "speaking", "all", NOW).map((r) => r.submission_id)).toEqual(["s"]);
    expect(filterRows(rows, "all", "overdue", NOW).map((r) => r.submission_id)).toEqual(["e"]);
    expect(filterRows(rows, "all", "week", NOW).map((r) => r.submission_id)).toEqual(["s"]);
  });

  it("starts with the first pending submission, preferring unlocked ones", () => {
    const rows = [
      row({ submission_id: "done", status: "graded" }),
      row({ submission_id: "busy", locked_by: { id: "t2", name: "Ms Rana" } }),
      row({ submission_id: "free" }),
    ];
    expect(nextToGrade(rows)?.submission_id).toBe("free");
    expect(nextToGrade(rows.slice(0, 2))?.submission_id).toBe("busy");
    expect(nextToGrade([rows[0]])).toBeUndefined();
  });

  it("groups rows by assignment in order of first appearance", () => {
    const groups = groupByAssignment([
      row({ submission_id: "1", assignment_id: "b", assignment_title: "B" }),
      row({ submission_id: "2", assignment_id: "a", assignment_title: "A" }),
      row({ submission_id: "3", assignment_id: "b", assignment_title: "B" }),
    ]);
    expect(groups.map((g) => [g.assignmentId, g.rows.length])).toEqual([
      ["b", 2],
      ["a", 1],
    ]);
  });
});

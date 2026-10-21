import { describe, expect, it } from "vitest";
import type { LeaderboardData } from "./api";
import { LEADERBOARD_LIMIT, TIMEFRAMES, buildBoard, formatXp, ordinal } from "./rules";

function board(
  rows: { id: string; name?: string | null; xp: number; rank?: number }[],
): LeaderboardData {
  return {
    class_id: "c1",
    timeframe: "week",
    my_rank: null,
    entries: rows.map((row, index) => ({
      rank: row.rank ?? index + 1,
      student_id: row.id,
      display_name: row.name === undefined ? row.id : row.name,
      avatar_url: null,
      equipped_badge: null,
      xp: row.xp,
    })),
  };
}

describe("TIMEFRAMES", () => {
  it("offers This Week, This Month and All Time in that order", () => {
    expect(TIMEFRAMES.map((item) => item.label)).toEqual(["This Week", "This Month", "All Time"]);
    expect(TIMEFRAMES.map((item) => item.value)).toEqual(["week", "month", "all_time"]);
  });
});

describe("buildBoard", () => {
  it("splits the top three into the podium and the rest into rows, in rank order", () => {
    const result = buildBoard(
      board([
        { id: "e", xp: 10 },
        { id: "a", xp: 90 },
        { id: "b", xp: 80 },
        { id: "c", xp: 70 },
        { id: "d", xp: 60 },
      ]),
      "nobody",
    );
    expect(result.podium.map((entry) => entry.studentId)).toEqual(["e", "a", "b"]);
    expect(result.rows.map((entry) => entry.studentId)).toEqual(["c", "d"]);
    expect(result.me).toBeNull();
    expect(result.xpToPass).toBeNull();
  });

  it("finds the student, the one above them and the XP needed to pass", () => {
    const result = buildBoard(
      board([
        { id: "sara", name: "Sara", xp: 400 },
        { id: "omar", name: "Omar", xp: 300 },
        { id: "me", name: "Me", xp: 280 },
      ]),
      "me",
    );
    expect(result.me?.rank).toBe(3);
    expect(result.above?.name).toBe("Omar");
    expect(result.xpToPass).toBe(21);
  });

  it("needs one XP to pass someone tied on XP, because the earlier scorer keeps the place", () => {
    const result = buildBoard(
      board([
        { id: "sara", name: "Sara", xp: 100 },
        { id: "me", name: "Me", xp: 100 },
      ]),
      "me",
    );
    expect(result.xpToPass).toBe(1);
  });

  it("reports the lead when the student is first", () => {
    const result = buildBoard(
      board([
        { id: "me", xp: 500 },
        { id: "sara", xp: 420 },
      ]),
      "me",
    );
    expect(result.above).toBeNull();
    expect(result.xpToPass).toBeNull();
    expect(result.leadOver).toBe(80);
  });

  it("keeps the top 50 and appends the student's own row when it falls past them", () => {
    const rows = Array.from({ length: 60 }, (_, index) => ({
      id: `s${index + 1}`,
      xp: 1000 - index,
    }));
    const result = buildBoard(board(rows), "s57");
    expect(result.rows).toHaveLength(LEADERBOARD_LIMIT - 3 + 1);
    expect(result.rows[result.rows.length - 1]?.studentId).toBe("s57");
    expect(result.rows.some((entry) => entry.studentId === "s51")).toBe(false);
  });

  it("flags anonymized boards but not a board that only shows the student's own name", () => {
    const hidden = buildBoard(
      board([
        { id: "a", name: "Student 1", xp: 9 },
        { id: "me", name: "Sara", xp: 8 },
      ]),
      "me",
    );
    expect(hidden.namesHidden).toBe(true);
    const open = buildBoard(board([{ id: "me", name: "Sara", xp: 8 }]), "me");
    expect(open.namesHidden).toBe(false);
  });

  it("falls back to a neutral name when the display name is empty", () => {
    const result = buildBoard(board([{ id: "a", name: null, xp: 1 }]), "me");
    expect(result.podium[0]?.name).toBe("Student");
  });

  it("handles an empty board", () => {
    const result = buildBoard(board([]), "me");
    expect(result.total).toBe(0);
    expect(result.podium).toEqual([]);
    expect(result.me).toBeNull();
  });
});

describe("ordinal and formatXp", () => {
  it("writes ordinals, including the teens", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 112].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "101st",
      "112th",
    ]);
  });

  it("groups thousands", () => {
    expect(formatXp(1240)).toBe("1,240 XP");
    expect(formatXp(0)).toBe("0 XP");
  });
});

import type { LeaderboardData, LeaderboardEntryRow, Timeframe } from "./api";

/* Pure rules for the leaderboard page: period tabs, the shape of one ranked entry, the podium,
   the visible list (top 50 plus the student's own row), and the gap to the next rank. */

export const TIMEFRAMES: readonly { value: Timeframe; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all_time", label: "All Time" },
];

/** ECONOMY-AND-GAMES §7: lists show the top 50 plus the student's own row. */
export const LEADERBOARD_LIMIT = 50;

export interface BoardEntry {
  rank: number;
  studentId: string;
  name: string;
  avatarUrl: string | null;
  badge: { id: string; name: string; iconUrl: string | null } | null;
  xp: number;
  isMe: boolean;
}

export interface Board {
  /** Ranks 1 to 3 in rank order. Fewer when the class is small. */
  podium: BoardEntry[];
  /** Rank 4 and below, up to the limit, plus the student's own row when it falls past it. */
  rows: BoardEntry[];
  me: BoardEntry | null;
  /** The student directly above, when the student is not first. */
  above: BoardEntry | null;
  /** XP the student must earn to rank above `above` (ties go to whoever got there first). */
  xpToPass: number | null;
  /** XP lead over second place, when the student is first and has company. */
  leadOver: number | null;
  /** True when the server anonymized other students ("Student N"). */
  namesHidden: boolean;
  total: number;
}

function toEntry(row: LeaderboardEntryRow, userId: string): BoardEntry {
  const name = row.display_name?.trim();
  return {
    rank: row.rank,
    studentId: row.student_id,
<<<<<<< HEAD
    name: name ?? "Student",
=======
    name: name !== undefined && name !== "" ? name : "Student",
>>>>>>> 396e3f56b4bb9fc3d6568f7fba82333a823da2b2
    avatarUrl: row.avatar_url ?? null,
    badge: row.equipped_badge
      ? {
          id: row.equipped_badge.id,
          name: row.equipped_badge.name,
          iconUrl: row.equipped_badge.icon_url ?? null,
        }
      : null,
    xp: row.xp,
    isMe: row.student_id === userId,
  };
}

export function buildBoard(data: LeaderboardData, userId: string): Board {
  const entries = data.entries.map((row) => toEntry(row, userId)).sort((a, b) => a.rank - b.rank);
  const myIndex = entries.findIndex((entry) => entry.isMe);
  const me = myIndex >= 0 ? (entries[myIndex] ?? null) : null;
  const above = me && myIndex > 0 ? (entries[myIndex - 1] ?? null) : null;
  const second = entries[1];

  return {
    podium: entries.slice(0, 3),
    rows: entries.slice(3).filter((entry) => entry.rank <= LEADERBOARD_LIMIT || entry.isMe),
    me,
    above,
    xpToPass: me && above ? Math.max(above.xp - me.xp, 0) + 1 : null,
    leadOver: me && myIndex === 0 && second ? me.xp - second.xp : null,
    namesHidden: entries.some((entry) => !entry.isMe && entry.name === `Student ${entry.rank}`),
    total: entries.length,
  };
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatXp(xp: number): string {
  return `${Math.round(xp).toLocaleString("en-US")} XP`;
}

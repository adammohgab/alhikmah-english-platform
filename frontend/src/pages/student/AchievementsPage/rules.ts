import type { AchievementsData, DefinitionRow } from "./api";

/* Pure rules for the achievements gallery: grouping, rarity and XP reward, progress toward
   locked badges, filters and the three-pin limit. */

export const MAX_PINS = 3;

export type Rarity = "common" | "rare" | "epic" | "legendary";
export type BadgeStatus = "earned" | "progress" | "locked";
export type GroupId = "streaks" | "learning" | "quizzes" | "events";

export const GROUPS: readonly { id: GroupId; label: string }[] = [
  { id: "streaks", label: "Streaks" },
  { id: "learning", label: "Learning" },
  { id: "quizzes", label: "Quizzes" },
  { id: "events", label: "Special Events" },
];

export const STATUS_FILTERS: readonly { id: BadgeStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "earned", label: "Unlocked" },
  { id: "progress", label: "In progress" },
  { id: "locked", label: "Locked" },
];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

/** XP a badge pays, by rarity (ECONOMY-AND-GAMES section 2.1). */
const RARITY_XP: Record<Rarity, number> = { common: 20, rare: 50, epic: 120, legendary: 300 };

const LEARNING = new Set([
  "learning",
  "lesson",
  "lessons",
  "reading",
  "practice",
  "writing",
  "listening",
  "grammar",
  "vocabulary",
]);
const QUIZZES = new Set(["quiz", "quizzes", "assessment"]);

/** Every category the catalog can hold lands in one of the four gallery tabs; anything that is
 * not streaks, learning or quizzes (games, social, collector, secret, xp, events) is an event. */
export function groupOf(category: string): GroupId {
  const key = category.trim().toLowerCase();
  if (key === "streak" || key === "streaks") return "streaks";
  if (LEARNING.has(key)) return "learning";
  if (QUIZZES.has(key)) return "quizzes";
  return "events";
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function positiveInt(value: unknown): number | null {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) && number > 0
    ? Math.floor(number)
    : null;
}

/** The threshold the award engine compares against: `threshold`, `days` or `count`. */
export function targetOf(requirement: Record<string, unknown>): number | null {
  return (
    positiveInt(requirement["threshold"]) ??
    positiveInt(requirement["days"]) ??
    positiveInt(requirement["count"])
  );
}

function rarityOf(requirement: Record<string, unknown>): Rarity | null {
  const value = requirement["rarity"];
  return value === "common" || value === "rare" || value === "epic" || value === "legendary"
    ? value
    : null;
}

/** The current value of the stat the award engine checks for this category, or null when the
 * engine counts something the page cannot measure (quizzes, games, social). */
function measure(category: string, data: AchievementsData): number | null {
  switch (category) {
    case "streak":
      return data.stats.currentStreak;
    case "xp":
    case "milestone":
      return data.stats.totalXp;
    case "reading":
    case "lessons":
      return data.lessonsCompleted;
    default:
      return null;
  }
}

export interface BadgeProgress {
  value: number;
  target: number;
  percent: number;
}

export interface Badge {
  id: string;
  code: string;
  /** "Secret badge" while a secret badge is still locked. */
  name: string;
  description: string;
  hint: string | null;
  iconUrl: string | null;
  group: GroupId;
  rarity: Rarity | null;
  /** XP the badge pays, when its rarity or an explicit reward is known. */
  xpReward: number | null;
  status: BadgeStatus;
  /** A locked secret badge: its name, art and requirement stay hidden. */
  hidden: boolean;
  earnedAt: string | null;
  pinned: boolean;
  /** Only for unearned badges whose stat the page can measure. */
  progress: BadgeProgress | null;
}

export interface Achievements {
  badges: Badge[];
  earnedCount: number;
  total: number;
  pinnedIds: string[];
}

function toBadge(definition: DefinitionRow, data: AchievementsData): Badge {
  const requirement = asRecord(definition.requirement_json);
  const earned = data.earned.find((row) => row.badge_id === definition.id);
  const rarity = rarityOf(requirement);
  const explicitXp = positiveInt(requirement["xp_reward"]) ?? positiveInt(requirement["xp"]);
  const secret = requirement["secret"] === true;
  const hidden = secret && !earned;
  const hint = typeof requirement["hint"] === "string" ? requirement["hint"] : null;

  const target = targetOf(requirement);
  const current = measure(definition.category, data);
  let progress: BadgeProgress | null = null;
  if (!earned && !hidden && target !== null && current !== null) {
    const value = Math.min(current, target);
    progress = { value, target, percent: Math.floor((value / target) * 100) };
  }

  const status: BadgeStatus = earned
    ? "earned"
    : progress && progress.value > 0
      ? "progress"
      : "locked";

  return {
    id: definition.id,
    code: definition.code,
    name: hidden ? "Secret badge" : definition.name,
    description: hidden
      ? "Keep exploring to discover this badge."
      : definition.description?.trim() || hint || "Keep learning to unlock this badge.",
    hint: hidden ? null : hint,
    iconUrl: hidden ? null : (definition.icon_url ?? null),
    group: groupOf(definition.category),
    rarity,
    xpReward: explicitXp ?? (rarity ? RARITY_XP[rarity] : null),
    status,
    hidden,
    earnedAt: earned?.awarded_at ?? null,
    pinned: earned?.is_pinned === true,
    progress,
  };
}

const STATUS_ORDER: Record<BadgeStatus, number> = { earned: 0, progress: 1, locked: 2 };

const time = (iso: string | null): number => (iso ? new Date(iso).getTime() || 0 : 0);

/** Unlocked first (newest first), then in progress (closest first), then locked by name. */
function compareBadges(a: Badge, b: Badge): number {
  if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (a.status === "earned") return time(b.earnedAt) - time(a.earnedAt);
  if (a.status === "progress") {
    return (b.progress?.percent ?? 0) - (a.progress?.percent ?? 0) || a.name.localeCompare(b.name);
  }
  return a.name.localeCompare(b.name);
}

export function buildAchievements(data: AchievementsData): Achievements {
  const badges = data.definitions
    .map((definition) => toBadge(definition, data))
    .sort(compareBadges);
  return {
    badges,
    earnedCount: badges.filter((badge) => badge.status === "earned").length,
    total: badges.length,
    pinnedIds: badges.filter((badge) => badge.pinned).map((badge) => badge.id),
  };
}

export function filterBadges(
  badges: Badge[],
  group: GroupId | "all",
  status: BadgeStatus | "all",
): Badge[] {
  return badges.filter(
    (badge) =>
      (group === "all" || badge.group === group) && (status === "all" || badge.status === status),
  );
}

/** The pinned set after pinning or unpinning `badge`, or null when the change is not allowed:
 * the badge is not earned, or three badges are already pinned. */
export function pinnedAfterToggle(pinned: string[], badge: Badge): string[] | null {
  if (badge.status !== "earned") return null;
  if (pinned.includes(badge.id)) return pinned.filter((id) => id !== badge.id);
  return pinned.length >= MAX_PINS ? null : [...pinned, badge.id];
}

export function formatEarnedDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
}

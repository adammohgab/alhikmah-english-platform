import { describe, expect, it } from "vitest";
import type { AchievementsData } from "./api";
import {
  buildAchievements,
  filterBadges,
  formatEarnedDate,
  groupOf,
  pinnedAfterToggle,
} from "./rules";

const data: AchievementsData = {
  definitions: [
    {
      id: "b1",
      code: "on_a_roll",
      name: "On a Roll",
      description: "Keep a 3-day streak.",
      category: "streak",
      requirement_json: { days: 3, rarity: "common" },
    },
    {
      id: "b2",
      code: "week_warrior",
      name: "Week Warrior",
      description: "Keep a 7-day streak.",
      category: "streak",
      requirement_json: { days: 7, rarity: "rare" },
    },
    {
      id: "b3",
      code: "quiz_starter",
      name: "Quiz Starter",
      description: "Pass your first quiz.",
      category: "quiz",
      requirement_json: { count: 1 },
    },
    {
      id: "b4",
      code: "night_owl",
      name: "Night Owl",
      description: "Finish a lesson after 21:00.",
      category: "secret",
      requirement_json: { secret: true, rarity: "common" },
    },
    {
      id: "b5",
      code: "bookworm",
      name: "Bookworm",
      description: "",
      category: "lessons",
      requirement_json: { count: 10, hint: "Finish ten lessons.", xp_reward: 35 },
    },
  ],
  earned: [{ badge_id: "b1", awarded_at: "2026-10-01T10:00:00Z", is_pinned: true }],
  stats: { totalXp: 500, currentStreak: 5 },
  lessonsCompleted: 0,
};

describe("buildAchievements", () => {
  const gallery = buildAchievements(data);
  const byId = Object.fromEntries(gallery.badges.map((badge) => [badge.id, badge]));

  it("counts earned badges out of the whole catalog and lists pins", () => {
    expect(gallery.earnedCount).toBe(1);
    expect(gallery.total).toBe(5);
    expect(gallery.pinnedIds).toEqual(["b1"]);
  });

  it("marks earned badges with their date and XP reward from rarity", () => {
    expect(byId["b1"]?.status).toBe("earned");
    expect(byId["b1"]?.earnedAt).toBe("2026-10-01T10:00:00Z");
    expect(byId["b1"]?.xpReward).toBe(20);
    expect(byId["b2"]?.xpReward).toBe(50);
  });

  it("measures progress toward locked badges with the stat the engine checks", () => {
    expect(byId["b2"]?.status).toBe("progress");
    expect(byId["b2"]?.progress).toEqual({ value: 5, target: 7, percent: 71 });
  });

  it("keeps a badge locked when nothing is measured or nothing is done yet", () => {
    expect(byId["b3"]?.status).toBe("locked");
    expect(byId["b3"]?.progress).toBeNull();
    expect(byId["b5"]?.status).toBe("locked");
    expect(byId["b5"]?.progress).toEqual({ value: 0, target: 10, percent: 0 });
  });

  it("uses an explicit XP reward and falls back to the hint for the description", () => {
    expect(byId["b5"]?.xpReward).toBe(35);
    expect(byId["b5"]?.description).toBe("Finish ten lessons.");
  });

  it("hides a locked secret badge", () => {
    expect(byId["b4"]?.hidden).toBe(true);
    expect(byId["b4"]?.name).toBe("Secret badge");
    expect(byId["b4"]?.description).not.toContain("21:00");
  });

  it("reveals a secret badge once it is earned", () => {
    const revealed = buildAchievements({
      ...data,
      earned: [{ badge_id: "b4", awarded_at: "2026-10-02T10:00:00Z", is_pinned: false }],
    });
    expect(revealed.badges.find((badge) => badge.id === "b4")?.name).toBe("Night Owl");
  });

  it("sorts unlocked first, then in progress, then locked", () => {
    expect(gallery.badges.map((badge) => badge.status)).toEqual([
      "earned",
      "progress",
      "locked",
      "locked",
      "locked",
    ]);
  });
});

describe("groupOf and filterBadges", () => {
  it("maps categories to the four gallery groups", () => {
    expect(groupOf("streak")).toBe("streaks");
    expect(groupOf("lessons")).toBe("learning");
    expect(groupOf("quiz")).toBe("quizzes");
    expect(groupOf("collector")).toBe("events");
    expect(groupOf("secret")).toBe("events");
  });

  it("filters by group and status", () => {
    const { badges } = buildAchievements(data);
    expect(filterBadges(badges, "streaks", "all")).toHaveLength(2);
    expect(filterBadges(badges, "all", "earned")).toHaveLength(1);
    expect(filterBadges(badges, "quizzes", "earned")).toHaveLength(0);
  });
});

describe("pinnedAfterToggle", () => {
  const { badges } = buildAchievements({
    ...data,
    earned: ["b1", "b2", "b3", "b5"].map((id) => ({
      badge_id: id,
      awarded_at: "2026-10-01T10:00:00Z",
      is_pinned: false,
    })),
  });
  const badge = (id: string) => badges.find((item) => item.id === id)!;

  it("pins up to three earned badges", () => {
    expect(pinnedAfterToggle([], badge("b1"))).toEqual(["b1"]);
    expect(pinnedAfterToggle(["b1", "b2"], badge("b3"))).toEqual(["b1", "b2", "b3"]);
  });

  it("refuses a fourth pin and unpins an already pinned badge", () => {
    expect(pinnedAfterToggle(["b1", "b2", "b3"], badge("b5"))).toBeNull();
    expect(pinnedAfterToggle(["b1", "b2", "b3"], badge("b2"))).toEqual(["b1", "b3"]);
  });

  it("refuses to pin a badge that is not earned", () => {
    const locked = buildAchievements(data).badges.find((item) => item.id === "b3")!;
    expect(pinnedAfterToggle([], locked)).toBeNull();
  });
});

describe("formatEarnedDate", () => {
  it("formats a date and tolerates missing or invalid input", () => {
    expect(formatEarnedDate("2026-10-01T10:00:00Z")).toBe("Oct 1, 2026");
    expect(formatEarnedDate(null)).toBeNull();
    expect(formatEarnedDate("nope")).toBeNull();
  });
});

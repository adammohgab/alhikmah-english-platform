import { describe, expect, it } from "vitest";
import type { GamesHubData } from "./api";
import {
  buildGamesHub,
  filterBySkill,
  formatMultiplier,
  formatScore,
  playPath,
  utcDayKey,
} from "./rules";

const TODAY = "2026-10-21";

const data: GamesHubData = {
  games: [
    {
      id: "g3",
      slug: "grammar-challenge",
      title: "Grammar Challenge",
      description: "Pick the form",
    },
    {
      id: "g1",
      slug: "vocabulary-match",
      title: "Vocabulary Match",
      description: " Pair words ",
    },
    { id: "g9", slug: "mystery", title: "Mystery", description: null },
  ],
  featured: { game_id: "g1", bonus_multiplier: 1.5 },
  sessions: [
    { game_id: "g1", score: 900, played_at: "2026-10-20T10:00:00Z" },
    { game_id: "g1", score: 1240, played_at: "2026-10-21T08:00:00Z" },
    { game_id: "g1", score: 700, played_at: "2026-10-21T09:00:00Z" },
    { game_id: "g3", score: 500, played_at: null },
  ],
};

describe("buildGamesHub", () => {
  const hub = buildGamesHub(data, TODAY);

  it("orders the catalog like the spec and puts unknown games last", () => {
    expect(hub.cards.map((card) => card.slug)).toEqual([
      "vocabulary-match",
      "grammar-challenge",
      "mystery",
    ]);
  });

  it("uses the highest score as the personal best, or null when never played", () => {
    const byId = Object.fromEntries(hub.cards.map((card) => [card.id, card]));
    expect(byId.g1?.bestScore).toBe(1240);
    expect(byId.g3?.bestScore).toBe(500);
    expect(byId.g9?.bestScore).toBeNull();
  });

  it("counts only today's sessions and ignores sessions without a date", () => {
    expect(hub.playedToday).toBe(2);
    expect(hub.cards[0]?.playsToday).toBe(2);
    expect(hub.cards[1]?.playsToday).toBe(0);
  });

  it("finds the featured game and its multiplier", () => {
    expect(hub.featured?.card.slug).toBe("vocabulary-match");
    expect(hub.featured?.multiplier).toBe(1.5);
    expect(hub.cards[0]?.description).toBe("Pair words");
  });

  it("has no featured game when none is set or it is not in the catalog", () => {
    expect(buildGamesHub({ ...data, featured: null }, TODAY).featured).toBeNull();
    expect(
      buildGamesHub({ ...data, featured: { game_id: "gone", bonus_multiplier: 1.5 } }, TODAY)
        .featured,
    ).toBeNull();
  });

  it("falls back to 1.5x when the multiplier is missing", () => {
    const result = buildGamesHub({ ...data, featured: { game_id: "g1" } }, TODAY);
    expect(result.featured?.multiplier).toBe(1.5);
  });
});

describe("filterBySkill", () => {
  const { cards } = buildGamesHub(data, TODAY);

  it("returns everything for all", () => {
    expect(filterBySkill(cards, "all")).toHaveLength(3);
  });

  it("keeps the games that train the chosen skill", () => {
    expect(filterBySkill(cards, "grammar").map((card) => card.slug)).toEqual(["grammar-challenge"]);
    expect(filterBySkill(cards, "speed")).toEqual([]);
  });
});

describe("formatting", () => {
  it("formats scores, multipliers, day keys and the play path", () => {
    expect(formatScore(1240)).toBe("1,240");
    expect(formatMultiplier(1.5)).toBe("1.5x");
    expect(formatMultiplier(2)).toBe("2x");
    expect(utcDayKey(new Date("2026-10-21T23:30:00Z"))).toBe("2026-10-21");
    expect(playPath("timed-quiz")).toBe("/student/games/timed-quiz/play");
  });
});

import { describe, expect, it } from "vitest";
import {
  RATINGS,
  buildSession,
  countByMastery,
  filterWords,
  isFinished,
  rate,
  startSession,
  topicsOf,
  type LibraryWord,
} from "./rules";

function word(id: string, overrides: Partial<LibraryWord> = {}): LibraryWord {
  return {
    id,
    word: id,
    partOfSpeech: "noun",
    pronunciation: null,
    meaning: `meaning of ${id}`,
    arabicMeaning: null,
    example: null,
    level: null,
    tags: [],
    vocabItemId: null,
    mastery: "new",
    starred: false,
    nextReviewAt: null,
    ...overrides,
  };
}

const NOW = Date.parse("2026-10-22T10:00:00Z");

describe("RATINGS", () => {
  it("has the three buttons in order and only Need Practice is a wrong review", () => {
    expect(RATINGS.map((item) => item.label)).toEqual([
      "Need Practice",
      "Almost Got It",
      "Mastered",
    ]);
    expect(RATINGS.map((item) => item.correct)).toEqual([false, true, true]);
  });
});

describe("filterWords", () => {
  const words = [
    word("apple", { mastery: "mastered", tags: ["food"], starred: true }),
    word("bridge", { mastery: "learning", tags: ["city"], meaning: "a way over water" }),
    word("cat", { mastery: "new", arabicMeaning: "قطة" }),
  ];
  const all = { search: "", mastery: "all", topic: null } as const;

  it("filters by mastery, starred and topic", () => {
    expect(filterWords(words, { ...all, mastery: "learning" }).map((w) => w.id)).toEqual([
      "bridge",
    ]);
    expect(filterWords(words, { ...all, mastery: "starred" }).map((w) => w.id)).toEqual(["apple"]);
    expect(filterWords(words, { ...all, topic: "city" }).map((w) => w.id)).toEqual(["bridge"]);
  });

  it("searches the word, the meaning and the Arabic text", () => {
    expect(filterWords(words, { ...all, search: "WATER" }).map((w) => w.id)).toEqual(["bridge"]);
    expect(filterWords(words, { ...all, search: "قطة" }).map((w) => w.id)).toEqual(["cat"]);
    expect(filterWords(words, { ...all, search: "app" }).map((w) => w.id)).toEqual(["apple"]);
  });

  it("lists distinct sorted topics and counts mastery", () => {
    expect(topicsOf([...words, word("d", { tags: ["food", "animals"] })])).toEqual([
      "animals",
      "city",
      "food",
    ]);
    expect(countByMastery(words)).toEqual({ new: 1, learning: 1, mastered: 1 });
  });
});

describe("buildSession", () => {
  it("puts due words first (new, then oldest due) and caps the size", () => {
    const words = [
      word("later", { mastery: "learning", nextReviewAt: "2026-10-25T00:00:00Z" }),
      word("old", { mastery: "learning", nextReviewAt: "2026-10-20T00:00:00Z" }),
      word("fresh"),
      word("recent", { mastery: "learning", nextReviewAt: "2026-10-22T09:00:00Z" }),
    ];
    expect(buildSession(words, NOW).map((w) => w.id)).toEqual(["fresh", "old", "recent", "later"]);
    expect(buildSession(words, NOW, 2).map((w) => w.id)).toEqual(["fresh", "old"]);
  });
});

describe("rate", () => {
  it("repeats a Need Practice card once, then lets it go", () => {
    let state = startSession([word("a"), word("b")]);
    state = rate(state, "need_practice");
    expect(state.queue.map((w) => w.id)).toEqual(["a", "b", "a"]);
    state = rate(state, "almost");
    expect(isFinished(state)).toBe(false);
    state = rate(state, "need_practice");
    expect(state.queue).toHaveLength(3);
    expect(isFinished(state)).toBe(true);
    expect(state.tally).toEqual({ need_practice: 2, almost: 1, mastered: 0 });
  });

  it("does nothing once the set is finished", () => {
    const done = rate(startSession([word("a")]), "mastered");
    expect(rate(done, "mastered")).toBe(done);
  });
});

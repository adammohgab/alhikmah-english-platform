import { describe, expect, it } from "vitest";
import { formatDuration, formatGameName, gameResultInputSchema, mergeResultState } from "./rules";

describe("game results rules", () => {
  it("validates a completed round and derives accuracy from answer counts", () => {
    expect(
      gameResultInputSchema.parse({
        score: 120,
        durationSeconds: 60,
        correctAnswers: 3,
        totalQuestions: 4,
      }),
    ).toMatchObject({ accuracy: 75, correctAnswers: 3, totalQuestions: 4 });
  });

  it("rejects impossible round scores and inconsistent answer totals", () => {
    expect(gameResultInputSchema.safeParse({ score: 61_000, durationSeconds: 60 }).success).toBe(
      false,
    );
    expect(
      gameResultInputSchema.safeParse({
        score: 10,
        durationSeconds: 60,
        correctAnswers: 4,
        totalQuestions: 3,
      }).success,
    ).toBe(false);
  });

  it("formats slugs and elapsed time for the results summary", () => {
    expect(formatGameName("memory_match")).toBe("Memory Match");
    expect(formatDuration(125)).toBe("2:05");
  });

  it("merges only record-like result state with navigation values taking precedence", () => {
    expect(mergeResultState({ score: 10, durationSeconds: 60 }, { score: 20 })).toEqual({
      score: 20,
      durationSeconds: 60,
    });
    expect(mergeResultState(["not", "a", "record"], null)).toEqual({});
  });
});

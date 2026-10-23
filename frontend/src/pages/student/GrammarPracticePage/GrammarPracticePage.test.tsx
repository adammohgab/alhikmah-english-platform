import { describe, expect, it } from "vitest";
import { dailyProgressKey, isCorrectAnswer, normalizeAnswer } from "./rules";

describe("grammar practice rules", () => {
  it("normalizes capitalization, whitespace, and final punctuation", () => {
    expect(normalizeAnswer("  She   IS ready! ")).toBe("she is ready");
  });

  it("accepts equivalent sentence answers with different final punctuation", () => {
    expect(isCorrectAnswer("I am interested in science", "I am interested in science.")).toBe(true);
  });

  it("does not accept a grammatically different answer", () => {
    expect(
      isCorrectAnswer("If it will rain, we stay home", "If it rains, we will stay home."),
    ).toBe(false);
  });

  it("creates a date-specific key for daily progress", () => {
    expect(dailyProgressKey(new Date(2026, 9, 22))).toBe("grammar-practice:2026-10-22");
  });
});

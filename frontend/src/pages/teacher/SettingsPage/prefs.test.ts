import { describe, expect, it } from "vitest";
import { formatGrade, toLetter } from "./prefs";

describe("grading scale helpers", () => {
  it("maps percentages to letters", () => {
    expect([95, 90, 85, 70, 61, 12].map(toLetter)).toEqual(["A", "A", "B", "C", "D", "F"]);
  });

  it("formats a mark in the chosen default scale", () => {
    expect(formatGrade(84.6, "percentage")).toBe("85%");
    expect(formatGrade(84.6, "letter")).toBe("B");
  });
});

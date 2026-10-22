import { describe, expect, it } from "vitest";
import { formatDate, formatDuration, formatSize, formatWordTarget } from "./format";

describe("assignment detail formatting", () => {
  it("formats word targets including zero-valued bounds", () => {
    expect(formatWordTarget(250, 500)).toBe("250-500 words");
    expect(formatWordTarget(0, 500)).toBe("0-500 words");
    expect(formatWordTarget(250)).toBe("At least 250 words");
    expect(formatWordTarget(undefined, 500)).toBe("Up to 500 words");
    expect(formatWordTarget()).toBe("No word count target");
  });

  it("formats valid dates and ignores invalid dates", () => {
    expect(formatDate("not-a-date")).toBe("");
    expect(formatDate()).toBe("");
    expect(formatDate("2026-01-05T00:00:00.000Z")).toContain("Jan");
  });

  it("preserves zero values for file size and duration", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65.9)).toBe("1:05");
    expect(formatSize(-1)).toBe("");
    expect(formatDuration(Number.NaN)).toBe("");
  });
});

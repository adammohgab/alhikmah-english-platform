import { describe, expect, it } from "vitest";
import {
  formatAttempts,
  formatDate,
  formatDateTime,
  formatDueCountdown,
  formatDuration,
  formatQuestionType,
  formatSize,
  formatStatus,
  formatWordTarget,
} from "./format";

describe("assignment detail formatting", () => {
  it("formats word targets including zero-valued bounds", () => {
    expect(formatWordTarget(250, 500)).toBe("250-500 words");
    expect(formatWordTarget(0, 500)).toBe("0-500 words");
    expect(formatWordTarget(250)).toBe("At least 250 words");
    expect(formatWordTarget(undefined, 500)).toBe("Up to 500 words");
    expect(formatWordTarget()).toBe("No word count target");
  });

  it("formats valid dates and times and ignores invalid dates", () => {
    expect(formatDate("not-a-date")).toBe("");
    expect(formatDate()).toBe("");
    expect(formatDate("2026-01-05T00:00:00.000Z")).toContain("Jan");
    expect(formatDateTime("not-a-date")).toBe("");
    expect(formatDateTime()).toBe("");
    expect(formatDateTime("2026-01-05T00:00:00.000Z")).toContain("2026");
  });

  it("preserves zero values for file size and duration", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65.9)).toBe("1:05");
    expect(formatSize(-1)).toBe("");
    expect(formatDuration(Number.NaN)).toBe("");
  });

  it("labels submission state, question types and attempts for students", () => {
    expect(formatStatus("not_started")).toBe("Not started");
    expect(formatStatus("in_progress")).toBe("In progress");
    expect(formatStatus("awaiting_teacher")).toBe("Awaiting teacher");
    expect(formatQuestionType("multiple_choice")).toBe("Multiple choice");
    expect(formatQuestionType("fill-blank")).toBe("Fill in the blank");
    expect(formatQuestionType("peer_review")).toBe("Peer Review");
    expect(formatQuestionType("")).toBe("");
    expect(formatAttempts(0, 2)).toBe("0 of 2 used");
    expect(formatAttempts(undefined, 2)).toBe("2 allowed");
    expect(formatAttempts(1)).toBe("1 used");
    expect(formatAttempts()).toBe("");
  });

  it("counts down to the due time and marks overdue work", () => {
    const now = new Date("2026-01-05T10:00:00.000Z");

    expect(formatDueCountdown("2026-01-05T12:00:00.000Z", now)).toBe("Due in 2 hr");
    expect(formatDueCountdown("2026-01-05T10:30:00.000Z", now)).toBe("Due in 30 min");
    expect(formatDueCountdown("2026-01-08T10:00:00.000Z", now)).toBe("Due in 3 days");
    expect(formatDueCountdown("2026-01-05T09:30:00.000Z", now)).toBe("Overdue by 30 min");
    expect(formatDueCountdown("2026-01-05T10:00:00.000Z", now)).toBe("Due now");
    expect(formatDueCountdown("not-a-date", now)).toBe("");
  });
});

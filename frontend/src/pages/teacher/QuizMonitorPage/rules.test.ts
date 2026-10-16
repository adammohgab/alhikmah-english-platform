import { describe, expect, it } from "vitest";
import {
  clockOffsetMs,
  connectionStatus,
  countStatuses,
  elapsedSeconds,
  formatClock,
  remainingSeconds,
  sortForGrid,
} from "./rules";

const NOW = new Date("2026-10-16T10:00:00Z").getTime();
const ago = (s: number) => new Date(NOW - s * 1000).toISOString();

describe("connectionStatus", () => {
  it("is green when active, yellow when idle, grey when gone", () => {
    expect(connectionStatus(ago(5), NOW)).toBe("active");
    expect(connectionStatus(ago(30), NOW)).toBe("active");
    expect(connectionStatus(ago(31), NOW)).toBe("idle");
    expect(connectionStatus(ago(120), NOW)).toBe("idle");
    expect(connectionStatus(ago(121), NOW)).toBe("offline");
    expect(connectionStatus(null, NOW)).toBe("offline");
    expect(connectionStatus("not a date", NOW)).toBe("offline");
  });
});

describe("clock helpers", () => {
  it("measures elapsed time and freezes it at submit", () => {
    expect(elapsedSeconds(ago(90), null, NOW)).toBe(90);
    expect(elapsedSeconds(ago(90), ago(30), NOW)).toBe(60);
    expect(elapsedSeconds(null, null, NOW)).toBeNull();
  });

  it("counts down to the deadline and stops at zero", () => {
    const deadline = new Date(NOW + 300_000).toISOString();
    expect(remainingSeconds(deadline, NOW)).toBe(300);
    expect(remainingSeconds(ago(10), NOW)).toBe(0);
    expect(remainingSeconds(null, NOW)).toBeNull();
  });

  it("corrects for browser clock drift", () => {
    expect(clockOffsetMs(new Date(NOW + 4000).toISOString(), NOW)).toBe(4000);
    expect(clockOffsetMs("bad", NOW)).toBe(0);
  });

  it("formats clocks", () => {
    expect([null, 5, 65, 3725].map(formatClock)).toEqual(["—", "0:05", "1:05", "1:02:05"]);
  });
});

describe("grid helpers", () => {
  it("counts statuses and how many test-takers are not active", () => {
    const counts = countStatuses(
      [
        { status: "in_progress", lastSeenAt: ago(5) },
        { status: "in_progress", lastSeenAt: ago(60) },
        { status: "in_progress", lastSeenAt: null },
        { status: "submitted", lastSeenAt: ago(1) },
        { status: "not_started", lastSeenAt: null },
      ],
      NOW,
    );
    expect(counts).toEqual({ inProgress: 3, submitted: 1, notStarted: 1, idleOrOffline: 2 });
  });

  it("puts test-takers first and sorts names inside each group", () => {
    const sorted = sortForGrid([
      { status: "submitted" as const, name: "Amal" },
      { status: "in_progress" as const, name: "Zed" },
      { status: "not_started" as const, name: "Bilal" },
      { status: "in_progress" as const, name: "Chadia" },
    ]);
    expect(sorted.map((r) => r.name)).toEqual(["Chadia", "Zed", "Bilal", "Amal"]);
  });
});

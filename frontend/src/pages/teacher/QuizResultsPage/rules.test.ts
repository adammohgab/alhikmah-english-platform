import { describe, expect, it } from "vitest";
import { formatDuration, hardestFirst, histogramBins, itemFlag } from "./rules";

describe("histogramBins", () => {
  it("counts scores into ten-point bands with 100 in the top band", () => {
    const bins = histogramBins([0, 9, 10, 59, 60, 99, 100, 100]);
    expect(bins).toHaveLength(10);
    expect(bins.map((b) => b.count)).toEqual([2, 1, 0, 0, 0, 1, 1, 0, 0, 3]);
    expect(bins[0]?.label).toBe("0-9");
    expect(bins[9]?.label).toBe("90-100");
  });

  it("clamps out-of-range values and skips non-numbers", () => {
    const bins = histogramBins([-5, 140, Number.NaN]);
    expect(bins[0]?.count).toBe(1);
    expect(bins[9]?.count).toBe(1);
  });
});

describe("item analysis", () => {
  it("flags extreme and low success questions", () => {
    expect([20, 45, 70, 99].map(itemFlag)).toEqual(["too_hard", "low_success", null, "too_easy"]);
  });

  it("orders hardest first without mutating the input", () => {
    const items = [
      { id: "a", position: 1, percentCorrect: 80 },
      { id: "b", position: 2, percentCorrect: 30 },
      { id: "c", position: 3, percentCorrect: 30 },
    ];
    expect(hardestFirst(items).map((i) => i.id)).toEqual(["b", "c", "a"]);
    expect(items[0]?.id).toBe("a");
  });

  it("formats durations", () => {
    expect([null, 45, 125].map(formatDuration)).toEqual(["—", "45s", "2m 5s"]);
  });
});

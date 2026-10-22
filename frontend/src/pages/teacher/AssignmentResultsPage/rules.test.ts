import { describe, expect, it } from "vitest";
import { buildResultsCsv, csvCell, csvFilename, summarize } from "./rules";
import type { SubmissionRow } from "./api";

const row = (over: Partial<SubmissionRow> & { name?: string }): SubmissionRow => ({
  student: { id: over.name ?? "s", full_name: over.name ?? "Amal" },
  status: "submitted",
  ...over,
});

describe("results rules", () => {
  it("summarises statuses, late and unreleased grades", () => {
    const s = summarize([
      row({ status: "not_started" }),
      row({ status: "submitted", is_late: true }),
      row({ status: "graded", released: false }),
      row({ status: "graded", released: true }),
    ]);
    expect(s).toMatchObject({
      total: 4,
      notStarted: 1,
      submitted: 1,
      graded: 2,
      late: 1,
      unreleased: 1,
    });
  });
  it("escapes CSV cells and blocks formulas", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell(null)).toBe("");
  });
  it("builds a CSV with a header", () => {
    const csv = buildResultsCsv([row({ name: "Amal", final: 8, is_late: true })], 10);
    expect(csv.split("\r\n")).toEqual([
      "Student,Status,Score,Max score,Submitted at,Late",
      "Amal,Submitted,8,10,,Yes",
    ]);
    expect(csvFilename("Essay 1!")).toBe("essay-1-results.csv");
  });
});

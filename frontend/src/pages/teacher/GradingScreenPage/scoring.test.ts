import { describe, expect, it } from "vitest";
import {
  buildSavePayload,
  composeFeedback,
  computeTotals,
  rubricComplete,
  rubricMax,
  scoreFromRubric,
  selectionFromPoints,
  splitHighlights,
} from "./scoring";
import type { QuestionScoreInput, Rubric } from "./scoring";

const rubric: Rubric = {
  title: "Writing",
  max_score: 10,
  criteria: [
    {
      id: "grammar",
      name: "Grammar",
      levels: [
        { label: "Weak", points: 1 },
        { label: "Good", points: 3 },
        { label: "Great", points: 5 },
      ],
    },
    {
      id: "vocab",
      name: "Vocabulary",
      levels: [
        { label: "Weak", points: 1 },
        { label: "Great", points: 5 },
      ],
    },
  ],
};

describe("rubric scoring", () => {
  it("finds the reachable maximum from each criterion's top level", () => {
    expect(rubricMax(rubric)).toBe(10);
  });

  it("recalculates as levels are chosen and scales onto the question maximum", () => {
    expect(scoreFromRubric(rubric, { grammar: 2 }, 20)).toBe(10);
    expect(scoreFromRubric(rubric, { grammar: 2, vocab: 1 }, 20)).toBe(20);
    expect(scoreFromRubric(rubric, { grammar: 1, vocab: 0 }, 8)).toBe(3.2);
    expect(scoreFromRubric(rubric, {}, 8)).toBe(0);
  });

  it("knows when every criterion has a level", () => {
    expect(rubricComplete(rubric, { grammar: 0 })).toBe(false);
    expect(rubricComplete(rubric, { grammar: 0, vocab: 1 })).toBe(true);
  });

  it("maps AI points to the nearest level", () => {
    expect(selectionFromPoints(rubric, { grammar: 4.2, vocab: 2 })).toEqual({ grammar: 2, vocab: 0 });
    expect(selectionFromPoints(rubric, { missing: 3 })).toEqual({});
  });
});

const questions: QuestionScoreInput[] = [
  { questionId: "a", isWriting: false, maxPoints: 2, autoScore: 2, teacherScore: null },
  { questionId: "b", isWriting: false, maxPoints: 2, autoScore: 0, teacherScore: null },
  { questionId: "w", isWriting: true, maxPoints: 10, autoScore: null, teacherScore: null },
];

describe("totals and save payload", () => {
  it("reports undecided writing answers and keeps auto points", () => {
    const totals = computeTotals(questions);
    expect(totals).toMatchObject({ auto: 2, writing: 0, final: 2, max: 14, undecided: ["w"] });
  });

  it("refuses to save until every writing answer has a score", () => {
    const result = buildSavePayload("att-1", questions, "Nice", null);
    expect(result).toEqual({ ok: false, reason: "Score the remaining writing answer before saving." });
  });

  it("builds the save_grade arguments, clamping scores to the question maximum", () => {
    const scored = questions.map((q) => (q.questionId === "w" ? { ...q, teacherScore: 99 } : q));
    const result = buildSavePayload("att-1", scored, "  Well done  ", "asset-9");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toEqual({
      attempt_id: "att-1",
      rubric_scores: { a: 2, b: 0, w: 10 },
      feedback: "Well done\n[voice-note:asset-9]",
      final_score: 12,
    });
  });

  it("does not duplicate the voice note marker", () => {
    expect(composeFeedback("Good\n[voice-note:old]", "new")).toBe("Good\n[voice-note:new]");
    expect(composeFeedback("Good\n[voice-note:old]", null)).toBe("Good");
  });
});

describe("splitHighlights", () => {
  it("returns one plain segment without comments", () => {
    expect(splitHighlights("hello", [])).toEqual([{ text: "hello", commentIds: [] }]);
  });

  it("splits at comment boundaries, including overlaps", () => {
    const segments = splitHighlights("abcdefgh", [
      { id: "1", start: 1, end: 5 },
      { id: "2", start: 3, end: 7 },
    ]);
    expect(segments.map((s) => [s.text, s.commentIds])).toEqual([
      ["a", []],
      ["bc", ["1"]],
      ["de", ["1", "2"]],
      ["fg", ["2"]],
      ["h", []],
    ]);
  });

  it("ignores ranges outside the text", () => {
    expect(splitHighlights("abc", [{ id: "x", start: 10, end: 12 }])).toEqual([
      { text: "abc", commentIds: [] },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  countAnswered,
  countWords,
  hydrateAnswers,
  isAnswerEmpty,
  normalizeQuestions,
  serializeAnswers,
  writingAnswerFromHtml,
} from "./questions";
import type { AnswerMap } from "./types";

describe("normalizeQuestions", () => {
  it("maps writing aliases to the editor and keeps renderer questions strongly typed", () => {
    const result = normalizeQuestions(
      [
        {
          key: "q1",
          type: "essay",
          prompt: { text: "Describe a memorable day." },
          points: 8,
          meta: { min_words: 100, max_words: 300 },
        },
        {
          key: "q2",
          type: "multiple_choice",
          prompt: { text: "Pick the best title." },
          options: [
            { id: "a", text: "A day at the sea" },
            { id: "b", text: "A day in bed" },
          ],
          points: 2,
          meta: { multi: true },
        },
        {
          key: "q3",
          type: "short-answer",
          prompt: { text: "Explain your choice." },
        },
        {
          key: "q4",
          type: "telepathy",
          prompt: { text: "Unsupported" },
        },
        {
          key: "q4",
          type: "fill_blank",
          prompt: { text: "I ___ to school." },
          meta: { word_bank: ["walk", "run"] },
        },
      ],
      { min: 50, max: 120 },
    );

    expect(result.ignoredCount).toBe(1);
    expect(result.questions).toHaveLength(4);

    const writing = result.questions[0];
    expect(writing?.kind).toBe("writing");
    if (writing?.kind === "writing") {
      expect(writing.minWords).toBe(100);
      expect(writing.maxWords).toBe(300);
      expect(writing.points).toBe(8);
    }

    const multipleChoice = result.questions[1];
    expect(multipleChoice?.kind).toBe("renderer");
    if (multipleChoice?.kind === "renderer" && multipleChoice.question.type === "multiple_choice") {
      expect(multipleChoice.question.multi).toBe(true);
      expect(multipleChoice.question.options).toHaveLength(2);
    }

    const shortAnswer = result.questions[2];
    expect(shortAnswer?.kind).toBe("writing");
    if (shortAnswer?.kind === "writing") {
      expect(shortAnswer.sourceType).toBe("short-answer");
      expect(shortAnswer.minWords).toBe(50);
      expect(shortAnswer.maxWords).toBe(120);
    }

    const duplicate = result.questions[3];
    expect(duplicate?.id).toBe("q4");
    expect(duplicate?.kind).toBe("renderer");
  });

  it("uses the QuestionForClient key as the stable draft key", () => {
    const result = normalizeQuestions([
      {
        key: "client-key-1",
        id: "database-id-9",
        type: "writing",
        prompt: { text: "Answer" },
      },
    ]);

    expect(result.questions[0]?.id).toBe("client-key-1");
  });
});

describe("draft hydration and serialization", () => {
  const { questions } = normalizeQuestions([
    { key: "writing-1", type: "writing", prompt: { text: "Write" } },
    {
      key: "choice-1",
      type: "multiple_choice",
      prompt: { text: "Choose" },
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
    },
  ]);

  it("hydrates rich HTML, plain legacy text and direct answer maps", () => {
    const answers = hydrateAnswers(questions, {
      "writing-1": {
        html: "<p>Hello <strong>world</strong></p>",
        text: "Hello world",
        word_count: 2,
        character_count: 11,
      },
      "choice-1": { selected: ["b"] },
    });

    expect(answers["writing-1"]).toMatchObject({
      html: "<p>Hello <strong>world</strong></p>",
      text: "Hello world",
      wordCount: 2,
      characterCount: 11,
    });
    expect(answers["choice-1"]).toEqual({ selected: ["b"] });
  });

  it("reads a wrapped answers envelope from older draft payloads", () => {
    const answers = hydrateAnswers(questions, {
      answers: {
        "writing-1": "A plain text draft",
        "choice-1": { value: ["a"] },
      },
    });

    expect(answers["writing-1"]).toMatchObject({
      text: "A plain text draft",
      wordCount: 4,
    });
    expect(answers["choice-1"]).toEqual({ selected: ["a"] });
  });

  it("serializes writing answers with teacher-facing word counts", () => {
    const answers = hydrateAnswers(questions, {
      "writing-1": "<p>One two three</p>",
    });

    expect(serializeAnswers(answers)).toEqual({
      "writing-1": {
        html: "<p>One two three</p>",
        text: "One two three",
        word_count: 3,
        character_count: 13,
      },
    });
  });
});

describe("writing helpers", () => {
  it("counts words and characters from rendered HTML text", () => {
    const answer = writingAnswerFromHtml("<p>Hello<br>world</p>");

    expect(answer.text).toBe("Hello\nworld");
    expect(answer.wordCount).toBe(2);
    expect(answer.characterCount).toBe(11);
    expect(countWords("   ")).toBe(0);
  });

  it("treats empty renderer values as unanswered and counts partial answers", () => {
    const { questions } = normalizeQuestions([
      { key: "w", type: "writing", prompt: { text: "Write" } },
      { key: "m", type: "multiple_choice", prompt: { text: "Choose" } },
      { key: "f", type: "fill_blank", prompt: { text: "Fill" } },
    ]);
    const answers: AnswerMap = {
      w: { html: "", text: "", wordCount: 0, characterCount: 0 },
      m: { selected: [] },
      f: { blanks: ["walk"] },
    };

    expect(isAnswerEmpty(questions[0]!, answers["w"])).toBe(true);
    expect(isAnswerEmpty(questions[1]!, answers["m"])).toBe(true);
    expect(isAnswerEmpty(questions[2]!, answers["f"])).toBe(false);
    expect(countAnswered(questions, answers)).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { classifyStartError, toBrief } from "./api";
import { attemptsText, typeLabel } from "./rules";

describe("STU-CORE-09 quiz brief", () => {
  it("reads a full brief", () => {
    const brief = toBrief({
      quiz: {
        title: "Unit 3 quiz",
        course: "English 8",
        unit: "Unit 3",
        question_count: 10,
        time_limit_min: 15,
        pass_mark: 60,
        attempts_left: 1,
        attempts_allowed: 2,
        best: { score_pct: 72 },
        shuffle_questions: true,
      },
      rules: ["One sitting."],
      question_types: ["multiple_choice", "fill_blank"],
      lock: { locked: false },
    });
    expect(brief).not.toBeNull();
    expect(brief?.bestScorePct).toBe(72);
    expect(brief?.shuffleQuestions).toBe(true);
    expect(brief && attemptsText(brief)).toBe("1 of 2");
  });

  it("treats missing attempts as unlimited and rejects a malformed body", () => {
    const brief = toBrief({ quiz: { title: "Quick quiz" } });
    expect(brief?.attemptsLeft).toBeNull();
    expect(brief && attemptsText(brief)).toBe("Unlimited");
    expect(toBrief({ nope: true })).toBeNull();
  });

  it("labels question types", () => {
    expect(typeLabel("true_false")).toBe("True or false");
    expect(typeLabel("word_search")).toBe("Word search");
  });
});

describe("STU-CORE-09 start errors", () => {
  it("sorts database refusals", () => {
    expect(classifyStartError({ message: "Maximum quiz attempts reached", code: "55000" })).toBe(
      "exhausted",
    );
    expect(classifyStartError({ message: "Quiz closing time has passed", code: "55000" })).toBe(
      "closed",
    );
    expect(classifyStartError({ message: "Quiz not found", code: "P0002" })).toBe("not-found");
    expect(classifyStartError({ message: "boom" })).toBe("failed");
  });
});

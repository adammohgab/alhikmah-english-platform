import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionRenderer } from "./QuestionRenderer";
import type {
  AudioSpellingQuestionData,
  FillBlankQuestionData,
  MatchingQuestionData,
  MultipleChoiceQuestionData,
  ReorderQuestionData,
  Question,
  ShortAnswerQuestionData,
} from "./types";

afterEach(() => {
  cleanup();
});

const multipleChoiceQuestion: MultipleChoiceQuestionData = {
  id: "multiple-choice",
  type: "multiple_choice",
  prompt: { text: "Choose the correct answer." },
  options: [
    { id: "first", text: "First answer" },
    { id: "second", text: "Second answer" },
  ],
  answer: { correct: ["first"] },
  explanation: "The first answer is correct.",
};

const fillBlankQuestion: FillBlankQuestionData = {
  id: "fill-blank",
  type: "fill_blank",
  prompt: { text: "A {{1}} can fly." },
  answer: { blanks: [["bird"]] },
  explanation: "Birds have wings.",
};

const twoBlanksQuestion: FillBlankQuestionData = {
  id: "two-blanks",
  type: "fill_blank",
  prompt: { text: "The {{1}} and {{2}} are flying." },
  answer: { blanks: [["birds"], ["planes"]] },
};

const matchingQuestion: MatchingQuestionData = {
  id: "matching",
  type: "matching",
  prompt: { text: "Match each item with its category." },
  options: {
    left: [{ id: "apple", text: "Apple" }],
    right: [{ id: "fruit", text: "Fruit" }],
  },
  answer: { pairs: [["apple", "fruit"]] },
  explanation: "An apple is a fruit.",
};

const reorderQuestion: ReorderQuestionData = {
  id: "reorder",
  type: "reorder",
  prompt: { text: "Put the words in order." },
  options: {
    items: [
      { id: "we", text: "We" },
      { id: "learn", text: "learn" },
      { id: "English", text: "English." },
    ],
  },
  answer: { order: ["we", "learn", "English"] },
  explanation: "This is the correct sentence order.",
};

const shortAnswerQuestion: ShortAnswerQuestionData = {
  id: "short-answer",
  type: "short_answer",
  prompt: { text: "What do birds use to fly?" },
  answer: { accepted: ["wings"] },
  sampleAnswer: "Birds use their wings to fly.",
  explanation: "Wings provide lift.",
};

const audioSpellingQuestion: AudioSpellingQuestionData = {
  id: "audio-spelling",
  type: "audio_spelling",
  prompt: { text: "Listen and spell the word." },
  options: {
    tiles: [
      { id: "c", text: "c" },
      { id: "a", text: "a" },
      { id: "t", text: "t" },
    ],
  },
  answer: { word: "cat" },
  explanation: "The word has three letters.",
};

function renderQuestion(question: Question, showSolution = false) {
  switch (question.type) {
    case "multiple_choice":
      return render(<QuestionRenderer question={question} showSolution={showSolution} />);
    case "fill_blank":
      return render(<QuestionRenderer question={question} showSolution={showSolution} />);
    case "matching":
      return render(<QuestionRenderer question={question} showSolution={showSolution} />);
    case "reorder":
      return render(<QuestionRenderer question={question} showSolution={showSolution} />);
    case "short_answer":
      return render(<QuestionRenderer question={question} showSolution={showSolution} />);
    case "audio_spelling":
      return render(<QuestionRenderer question={question} showSolution={showSolution} />);
  }
}

describe("QuestionRenderer", () => {
  it.each([
    [multipleChoiceQuestion, "Choose the correct answer."],
    [fillBlankQuestion, "Blank 1"],
    [matchingQuestion, "Match each item with its category."],
    [reorderQuestion, "Put the words in order."],
    [shortAnswerQuestion, "What do birds use to fly?"],
    [audioSpellingQuestion, "Listen and spell the word."],
  ] as const)("renders the %s question type", (question, prompt) => {
    renderQuestion(question);
    if (question.type === "fill_blank") {
      expect(screen.getByRole("textbox", { name: prompt })).toBeInTheDocument();
    } else {
      expect(screen.getByText(prompt)).toBeInTheDocument();
    }
  });

  it("emits the expected response shape for all six question types", async () => {
    const user = userEvent.setup();

    const multipleChoiceChange = vi.fn();
    const multipleChoiceView = render(
      <QuestionRenderer question={multipleChoiceQuestion} onChange={multipleChoiceChange} />,
    );
    await user.click(screen.getByRole("radio", { name: /Second answer/ }));
    expect(multipleChoiceChange).toHaveBeenLastCalledWith({ selected: ["second"] });
    multipleChoiceView.unmount();

    const fillBlankChange = vi.fn();
    const fillBlankView = render(
      <QuestionRenderer question={fillBlankQuestion} onChange={fillBlankChange} />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Blank 1" }), {
      target: { value: "bird" },
    });
    expect(fillBlankChange).toHaveBeenLastCalledWith({ blanks: ["bird"] });
    expect(fillBlankChange).toHaveBeenCalledTimes(1);
    fillBlankView.unmount();

    const matchingChange = vi.fn();
    const matchingView = render(
      <QuestionRenderer question={matchingQuestion} onChange={matchingChange} />,
    );
    screen.getByRole("button", { name: /Apple/ }).focus();
    await user.keyboard("{Enter}");
    screen.getByRole("button", { name: /Fruit/ }).focus();
    await user.keyboard(" ");
    expect(matchingChange).toHaveBeenLastCalledWith({ pairs: [["apple", "fruit"]] });
    matchingView.unmount();

    const reorderChange = vi.fn();
    const reorderView = render(
      <QuestionRenderer question={reorderQuestion} onChange={reorderChange} />,
    );
    const firstItem = screen.getByRole("button", { name: /We Position 1 of 3/ });
    firstItem.focus();
    await user.keyboard(" {ArrowDown} ");
    expect(reorderChange).toHaveBeenLastCalledWith({ order: ["learn", "we", "English"] });
    reorderView.unmount();

    const shortAnswerChange = vi.fn();
    const shortAnswerView = render(
      <QuestionRenderer question={shortAnswerQuestion} onChange={shortAnswerChange} />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Wings" } });
    expect(shortAnswerChange).toHaveBeenLastCalledWith({ text: "Wings" });
    shortAnswerView.unmount();

    const audioSpellingChange = vi.fn();
    render(<QuestionRenderer question={audioSpellingQuestion} onChange={audioSpellingChange} />);
    await user.click(screen.getByRole("button", { name: "Letter c" }));
    expect(audioSpellingChange).toHaveBeenLastCalledWith({ tiles: ["c"] });
  });

  it("supports keyboard selection for multiple choice and Tab navigation between blanks", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QuestionRenderer question={multipleChoiceQuestion} onChange={onChange} />);
    const firstOption = screen.getByRole("radio", { name: /First answer/ });
    const secondOption = screen.getByRole("radio", { name: /Second answer/ });
    firstOption.focus();
    await user.keyboard("{ArrowDown}");
    expect(secondOption).toHaveFocus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith({ selected: ["second"] });

    cleanup();
    render(<QuestionRenderer question={twoBlanksQuestion} onChange={vi.fn()} />);
    const firstBlank = screen.getByRole("textbox", { name: "Blank 1" });
    const secondBlank = screen.getByRole("textbox", { name: "Blank 2" });
    firstBlank.focus();
    await user.keyboard("{Tab}");
    expect(secondBlank).toHaveFocus();
  });

  it("does not emit answer changes in read-only mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const multipleChoiceView = render(
      <QuestionRenderer question={multipleChoiceQuestion} onChange={onChange} readOnly />,
    );
    expect(screen.getByRole("radio", { name: /Second answer/ })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Second answer/ }));
    multipleChoiceView.unmount();

    const fillBlankView = render(
      <QuestionRenderer question={fillBlankQuestion} onChange={onChange} readOnly />,
    );
    const blank = screen.getByRole("textbox", { name: "Blank 1" });
    expect(blank).toHaveAttribute("readonly");
    await user.type(blank, "bird");
    fillBlankView.unmount();

    const matchingView = render(
      <QuestionRenderer question={matchingQuestion} onChange={onChange} readOnly />,
    );
    expect(screen.getByRole("button", { name: /Apple/ })).toBeDisabled();
    matchingView.unmount();

    const reorderView = render(
      <QuestionRenderer question={reorderQuestion} onChange={onChange} readOnly />,
    );
    const reorderItem = screen.getByRole("button", { name: /We Position 1 of 3/ });
    expect(reorderItem).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(reorderItem, { key: " " });
    reorderView.unmount();

    const shortAnswerView = render(
      <QuestionRenderer question={shortAnswerQuestion} onChange={onChange} readOnly />,
    );
    const answer = screen.getByRole("textbox");
    expect(answer).toHaveAttribute("readonly");
    await user.type(answer, "Wings");
    shortAnswerView.unmount();

    render(<QuestionRenderer question={audioSpellingQuestion} onChange={onChange} readOnly />);
    expect(screen.getByRole("button", { name: "Letter c" })).toBeDisabled();

    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows solution marks, correct answers, and explanations when answer keys exist", () => {
    const wrongOrder = { order: ["English", "we", "learn"] };

    const multipleChoiceView = render(
      <QuestionRenderer
        question={multipleChoiceQuestion}
        value={{ selected: ["second"] }}
        showSolution
      />,
    );
    expect(screen.getByText("Correct answer")).toBeInTheDocument();
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
    expect(screen.getByText("The first answer is correct.")).toBeInTheDocument();
    multipleChoiceView.unmount();

    const fillBlankView = render(
      <QuestionRenderer question={fillBlankQuestion} value={{ blanks: ["plane"] }} showSolution />,
    );
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
    expect(screen.getByText("bird")).toBeInTheDocument();
    expect(screen.getByText("Birds have wings.")).toBeInTheDocument();
    fillBlankView.unmount();

    const matchingView = render(
      <QuestionRenderer question={matchingQuestion} value={{ pairs: [] }} showSolution />,
    );
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Items" })).getByText("Fruit"),
    ).toBeInTheDocument();
    expect(screen.getByText("An apple is a fruit.")).toBeInTheDocument();
    matchingView.unmount();

    const reorderView = render(
      <QuestionRenderer question={reorderQuestion} value={wrongOrder} showSolution />,
    );
    expect(screen.getAllByText("Incorrect")).toHaveLength(3);
    expect(screen.getByText("Correct order:")).toBeInTheDocument();
    expect(screen.getByText("This is the correct sentence order.")).toBeInTheDocument();
    reorderView.unmount();

    const shortAnswerView = render(
      <QuestionRenderer question={shortAnswerQuestion} value={{ text: "A tail" }} showSolution />,
    );
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
    expect(screen.getByText("wings")).toBeInTheDocument();
    expect(screen.getByText("Wings provide lift.")).toBeInTheDocument();
    shortAnswerView.unmount();

    render(
      <QuestionRenderer
        question={audioSpellingQuestion}
        value={{ tiles: ["c", "a"] }}
        showSolution
      />,
    );
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
    expect(screen.getByText("cat")).toBeInTheDocument();
    expect(screen.getByText("The word has three letters.")).toBeInTheDocument();
  });

  it("does not show correct or incorrect marks when no answer key is supplied", () => {
    const questions: Question[] = [
      { ...multipleChoiceQuestion, answer: undefined },
      { ...fillBlankQuestion, answer: undefined },
      { ...matchingQuestion, answer: undefined },
      { ...reorderQuestion, answer: undefined },
      { ...shortAnswerQuestion, answer: undefined },
      { ...audioSpellingQuestion, answer: undefined },
    ] as const;

    for (const question of questions) {
      const view = renderQuestion(question, true);
      expect(screen.queryByText("Correct")).not.toBeInTheDocument();
      expect(screen.queryByText("Incorrect")).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("announces matching and reorder interactions through live regions", async () => {
    const user = userEvent.setup();

    const matchingView = render(
      <QuestionRenderer question={matchingQuestion} onChange={vi.fn()} />,
    );
    screen.getByRole("button", { name: /Apple/ }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Apple selected. Now choose its match on the right.",
    );
    matchingView.unmount();

    render(<QuestionRenderer question={reorderQuestion} onChange={vi.fn()} />);
    const firstItem = screen.getByRole("button", { name: /We Position 1 of 3/ });
    firstItem.focus();
    await user.keyboard(" {ArrowDown}");
    expect(screen.getByRole("status")).toHaveTextContent("We moved to position 2 of 3.");
  });

  it("removes a matching pair with Delete and cancels a reorder with Escape", async () => {
    const user = userEvent.setup();
    const matchingChange = vi.fn();
    render(
      <QuestionRenderer
        question={matchingQuestion}
        value={{ pairs: [["apple", "fruit"]] }}
        onChange={matchingChange}
      />,
    );
    const apple = within(screen.getByRole("list", { name: "Items" })).getByRole("button", {
      name: /Apple/,
    });
    apple.focus();
    await user.keyboard("{Delete}");
    expect(matchingChange).toHaveBeenCalledWith({ pairs: [] });

    cleanup();
    const reorderChange = vi.fn();
    render(<QuestionRenderer question={reorderQuestion} onChange={reorderChange} />);
    const firstItem = screen.getByRole("button", { name: /We Position 1 of 3/ });
    firstItem.focus();
    await user.keyboard(" {ArrowDown}");
    expect(reorderChange).toHaveBeenLastCalledWith({ order: ["learn", "we", "English"] });
    await user.keyboard("{Escape}");
    expect(reorderChange).toHaveBeenLastCalledWith({ order: ["we", "learn", "English"] });
    expect(screen.getByRole("status")).toHaveTextContent(/Move cancelled/);
  });

  it("marks correct responses as correct for every question type", () => {
    const multipleChoiceView = render(
      <QuestionRenderer
        question={multipleChoiceQuestion}
        value={{ selected: ["first"] }}
        showSolution
      />,
    );
    expect(screen.getByText("Correct")).toBeInTheDocument();
    multipleChoiceView.unmount();

    const fillBlankView = render(
      <QuestionRenderer question={fillBlankQuestion} value={{ blanks: ["bird"] }} showSolution />,
    );
    expect(screen.getByText("Correct")).toBeInTheDocument();
    fillBlankView.unmount();

    const matchingView = render(
      <QuestionRenderer
        question={matchingQuestion}
        value={{ pairs: [["apple", "fruit"]] }}
        showSolution
      />,
    );
    expect(screen.getByText("Correct")).toBeInTheDocument();
    matchingView.unmount();

    const reorderView = render(
      <QuestionRenderer
        question={reorderQuestion}
        value={{ order: ["we", "learn", "English"] }}
        showSolution
      />,
    );
    expect(screen.getAllByText("Correct")).toHaveLength(3);
    reorderView.unmount();

    const shortAnswerView = render(
      <QuestionRenderer question={shortAnswerQuestion} value={{ text: "Wings" }} showSolution />,
    );
    expect(screen.getByText("Correct")).toBeInTheDocument();
    shortAnswerView.unmount();

    render(
      <QuestionRenderer
        question={audioSpellingQuestion}
        value={{ tiles: ["c", "a", "t"] }}
        showSolution
      />,
    );
    expect(screen.getByText("Correct")).toBeInTheDocument();
  });

  it("uses tile buttons and removes the final placed letter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <QuestionRenderer
        question={audioSpellingQuestion}
        value={{ tiles: ["c", "a"] }}
        onChange={onChange}
      />,
    );

    const spelling = within(screen.getByRole("group", { name: "Your spelling" }));
    expect(spelling.getByRole("button", { name: "Remove letter c" })).toBeInTheDocument();
    expect(spelling.getByRole("button", { name: "Remove letter a" })).toBeInTheDocument();
    await user.click(spelling.getByRole("button", { name: "Remove last letter" }));
    expect(onChange).toHaveBeenCalledWith({ tiles: ["c"] });
  });
});

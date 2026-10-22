import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { WritingEditor } from "./WritingEditor";
import type { WritingAnswer } from "./types";

/* ProseMirror measures text nodes and caret positions; jsdom implements neither. */
beforeAll(() => {
  const rect = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
  const emptyRects = {
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* iterator() {
      yield* [];
    },
  } as unknown as DOMRectList;

  Object.defineProperty(Text.prototype, "getClientRects", {
    configurable: true,
    value: () => emptyRects,
  });
  Range.prototype.getClientRects = () => emptyRects;
  Range.prototype.getBoundingClientRect = () => rect;
  document.elementFromPoint = () => document.body;
});

describe("WritingEditor", () => {
  it("renders the rich-text toolbar and reports live word and character counts", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(answer: WritingAnswer) => void>();
    render(
      <WritingEditor
        initialHtml="<p></p>"
        readOnly={false}
        label="Writing answer"
        minWords={2}
        maxWords={50}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("toolbar", { name: "Writing format" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bold" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Bullet list" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Heading 2" })).toBeEnabled();

    const editor = screen.getByRole("textbox", { name: "Writing answer" });
    await user.click(editor);
    await user.keyboard("Hello shiny world");

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });

    const latest = onChange.mock.calls.at(-1)?.[0];
    expect(latest).toMatchObject({
      text: "Hello shiny world",
      wordCount: 3,
      characterCount: 17,
    });
    expect(latest?.html).toContain("Hello shiny world");
  });

  it("locks the editor and toolbar after submission", () => {
    const { rerender } = render(
      <WritingEditor
        initialHtml="<p>Finished answer</p>"
        readOnly={false}
        label="Writing answer"
        onChange={vi.fn()}
      />,
    );

    rerender(
      <WritingEditor
        initialHtml="<p>Finished answer</p>"
        readOnly
        label="Writing answer"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Writing answer" })).toHaveAttribute(
      "contenteditable",
      "false",
    );
    expect(screen.getByRole("button", { name: "Bold" })).toBeDisabled();
    expect(screen.getByText("Locked after submission")).toBeInTheDocument();
  });
});

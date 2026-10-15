import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import { ActionCardDisplay, type ActionCardData, type ActionCardStatus } from "./ActionCardDisplay";
import { ChatInput } from "./ChatInput";
import { ChatMessage, type ChatMessageProps } from "./ChatMessage";
import { ChatThread } from "./ChatThread";
import { Markdown } from "./Markdown";
import { TypingIndicator } from "./TypingIndicator";

const soundValue: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

let clipboardWrite: ReturnType<typeof vi.fn>;

function renderWithSound(ui: ReactElement) {
  return render(<SoundContext.Provider value={soundValue}>{ui}</SoundContext.Provider>);
}

function message(role: ChatMessageProps["role"], content: string, streaming = false) {
  const props: ChatMessageProps = { role, content, streaming };
  return <ChatMessage {...props} />;
}

function createCard(status: ActionCardStatus): ActionCardData {
  return {
    id: "card-1",
    kind: "update",
    title: "Update lesson",
    summary: "The lesson changes are ready for review.",
    changes: [
      {
        op: "update",
        description: "Updates the lesson title",
        before: "Old title",
        after: "New title",
      },
    ],
    sources: [{ label: "Lesson 1", href: "/lessons/1" }],
    notes: ["Review the new title before applying."],
    status,
  };
}

describe("Markdown", () => {
  it("renders bold text, lists, fenced code, and an unfinished code fence", () => {
    const { container } = render(
      <Markdown content={"**bold**\n\n- first\n- second\n\n```ts\nconst answer = 42;\n```"} />,
    );

    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByRole("list").children).toHaveLength(2);
    expect(container.querySelector("pre code")).toHaveTextContent("const answer = 42;");
    expect(() => render(<Markdown content={"```ts\nconst partial = true;"} />)).not.toThrow();
    expect(screen.getByText("const partial = true;")).toBeInTheDocument();
  });

  it("leaves an unclosed bold marker as text and drops javascript links", () => {
    const { container } = render(
      <Markdown content={"unfinished **bold\n\n[run](javascript:alert)"} />,
    );

    expect(screen.getByText("unfinished **bold")).toBeInTheDocument();
    expect(screen.getByText("run").closest("a")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });
});

describe("ChatMessage", () => {
  beforeEach(() => {
    clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
  });

  it("shows no copy control while an assistant reply is streaming", () => {
    const { container } = render(message("assistant", "A partial answer", true));

    expect(screen.queryByRole("button", { name: "Copy message" })).not.toBeInTheDocument();
    expect(container.querySelector(".h-9.w-9")).toBeInTheDocument();
  });

  it("copies the assistant content after streaming has finished", async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    const content = "A complete answer";
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    renderWithSound(message("assistant", content));

    await user.click(screen.getByRole("button", { name: "Copy message" }));

    expect(clipboardWrite).toHaveBeenCalledWith(content);
    expect(await screen.findByRole("status")).toHaveTextContent("Copied to clipboard");
  });

  it("announces when copying the assistant content fails", async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    const rejectedWrite = vi.fn().mockRejectedValue(new Error("clipboard denied"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: rejectedWrite },
    });
    renderWithSound(message("assistant", "A complete answer"));

    await user.click(screen.getByRole("button", { name: "Copy message" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Could not copy message");
    expect(rejectedWrite).toHaveBeenCalledWith("A complete answer");
    expect(screen.getByRole("button", { name: "Copy failed" })).toBeInTheDocument();
  });

  it("renders user content as plain text instead of Markdown", () => {
    render(message("user", "**not bold**"));

    expect(screen.getByText("**not bold**")).toBeInTheDocument();
    expect(screen.queryByText("not bold", { selector: "strong" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy message" })).not.toBeInTheDocument();
  });
});

describe("ChatInput", () => {
  it("sends on Enter and returns focus to the textarea", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    renderWithSound(<ChatInput onSend={onSend} />);
    const textarea = screen.getByRole("textbox", { name: "Message" });

    await user.type(textarea, "Hello Pip");
    await user.keyboard("{Enter}");

    expect(onSend).toHaveBeenCalledWith("Hello Pip");
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue("");
  });

  it("does not send on Shift+Enter or while an IME composition is active", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    renderWithSound(<ChatInput onSend={onSend} />);
    const textarea = screen.getByRole("textbox", { name: "Message" });

    await user.type(textarea, "first line");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue("first line\n");

    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter", isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("returns focus to the textarea after choosing a suggestion", async () => {
    const user = userEvent.setup();
    const onSuggestionSelect = vi.fn();
    renderWithSound(
      <ChatInput
        onSend={vi.fn()}
        suggestions={["Explain this rule"]}
        onSuggestionSelect={onSuggestionSelect}
      />,
    );
    const textarea = screen.getByRole("textbox", { name: "Message" });

    await user.click(screen.getByRole("button", { name: "Explain this rule" }));

    expect(onSuggestionSelect).toHaveBeenCalledWith("Explain this rule");
    expect(textarea).toHaveFocus();
  });

  it("grows the textarea to fit its content", async () => {
    const user = userEvent.setup();
    renderWithSound(<ChatInput onSend={vi.fn()} />);
    const textarea = screen.getByRole("textbox", { name: "Message" });
    Object.defineProperty(textarea, "scrollHeight", { configurable: true, value: 96 });

    await user.type(textarea, "A taller draft");

    expect(textarea).toHaveStyle({ height: "96px" });
  });

  it("announces when voice input is listening", () => {
    renderWithSound(<ChatInput onSend={vi.fn()} voice={{ listening: true, onToggle: vi.fn() }} />);

    expect(screen.getByRole("status")).toHaveTextContent("Listening");
  });
});

describe("TypingIndicator", () => {
  it("announces the typing status politely", () => {
    render(<TypingIndicator label="Pip is thinking" />);

    expect(screen.getByRole("status")).toHaveTextContent("Pip is thinking");
  });
});

describe("ActionCardDisplay", () => {
  it("shows action details and only offers Apply and Discard while ready", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onDiscard = vi.fn();
    renderWithSound(
      <ActionCardDisplay card={createCard("ready")} onApply={onApply} onDiscard={onDiscard} />,
    );

    expect(screen.getByText("Update")).toBeInTheDocument();
    expect(screen.getByText("Updates the lesson title")).toBeInTheDocument();
    expect(screen.getByText("Old title")).toBeInTheDocument();
    expect(screen.getByText("New title")).toBeInTheDocument();
    expect(screen.getByText("Review the new title before applying.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lesson 1" })).toHaveAttribute("href", "/lessons/1");

    await user.click(screen.getByRole("button", { name: "Apply Changes" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(onApply).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it.each([
    ["generating", "Preparing proposed changes"],
    ["approved", "Changes applied."],
    ["edited", "Changes applied."],
    ["discarded", "Discarded. Nothing was changed."],
    ["stale", "This changed since it was prepared, so it cannot be applied."],
    ["failed", "Something went wrong. Nothing was changed."],
  ] as const)("renders the %s state without ready-only actions", (status, message) => {
    renderWithSound(
      <ActionCardDisplay
        card={createCard(status)}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    );

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply Changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
  });

  it("moves focus to the card when a ready card resolves", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithSound(
      <ActionCardDisplay card={createCard("ready")} onApply={vi.fn()} onDiscard={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Apply Changes" }));
    rerender(
      <SoundContext.Provider value={soundValue}>
        <ActionCardDisplay card={createCard("approved")} onApply={vi.fn()} onDiscard={vi.fn()} />
      </SoundContext.Provider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Proposed changes: Update lesson" })).toHaveFocus(),
    );
  });
});

describe("ChatThread", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows Jump to latest when scrolled up and returns to the bottom on request", async () => {
    const user = userEvent.setup();
    renderWithSound(<ChatThread>{message("assistant", "Earlier message")}</ChatThread>);
    const scroller = screen.getByRole("log", { name: "Conversation" });
    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, value: 500 },
      clientHeight: { configurable: true, value: 100 },
      scrollTop: { configurable: true, writable: true, value: 100 },
    });
    fireEvent.scroll(scroller);

    const jump = screen.getByRole("button", { name: "Jump to latest" });
    await user.click(jump);

    expect(scroller.scrollTop).toBe(500);
    expect(screen.queryByRole("button", { name: "Jump to latest" })).not.toBeInTheDocument();
  });

  it("follows content growth only while the reader remains at the bottom", async () => {
    let onResize: ResizeObserverCallback | undefined;
    class ResizeObserverStub {
      constructor(callback: ResizeObserverCallback) {
        onResize = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);

    const { rerender } = renderWithSound(
      <ChatThread>{message("assistant", "A", true)}</ChatThread>,
    );
    const scroller = screen.getByRole("log", { name: "Conversation" });
    let scrollHeight = 300;
    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, get: () => scrollHeight },
      clientHeight: { configurable: true, value: 100 },
      scrollTop: { configurable: true, writable: true, value: 200 },
    });
    fireEvent.scroll(scroller);

    scrollHeight = 420;
    rerender(
      <SoundContext.Provider value={soundValue}>
        <ChatThread>{message("assistant", "A much longer streamed answer", true)}</ChatThread>
      </SoundContext.Provider>,
    );
    await act(async () => {
      onResize?.([], {} as ResizeObserver);
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    });
    expect(scroller.scrollTop).toBe(420);

    scroller.scrollTop = 120;
    fireEvent.scroll(scroller);
    scrollHeight = 600;
    await act(async () => {
      onResize?.([], {} as ResizeObserver);
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    });
    expect(scroller.scrollTop).toBe(120);
    expect(screen.getByRole("button", { name: "Jump to latest" })).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SoundContext } from "@/shared/hooks/useSound";
import type { SoundContextValue } from "@/shared/hooks/useSound";
import FaqPage from "./index";
import { FAQ_ENTRIES, filterFaq } from "./faq-data";

const sound: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

function renderPage() {
  return render(
    <SoundContext.Provider value={sound}>
      <MemoryRouter>
        <FaqPage />
      </MemoryRouter>
    </SoundContext.Provider>,
  );
}

const search = () => screen.getByRole("searchbox", { name: "Search the FAQ" });

describe("PUB-09: FaqPage (SH-07)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows every category with its questions and sets the title", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: /Frequently asked/ })).toBeInTheDocument();
    for (const name of ["Students", "Parents", "Teachers", "Technical"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button", { expanded: false })).toBeTruthy();
    expect(document.title).toBe("FAQ | Wordland");
  });

  it("filters questions across all categories as you type", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(search(), "password");
    expect(screen.getByText("What if I forget my password?")).toBeInTheDocument();
    expect(screen.getByText("How do I reset a student's password?")).toBeInTheDocument();
    expect(screen.queryByText("What are coins and how do I earn them?")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Students" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Teachers" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Parents" })).not.toBeInTheDocument();
  });

  it("requires every word to match", () => {
    expect(filterFaq(FAQ_ENTRIES, "quiz locked", "all").map((e) => e.id)).toContain("quiz-locked");
    expect(filterFaq(FAQ_ENTRIES, "quiz zebra", "all")).toHaveLength(0);
    expect(filterFaq(FAQ_ENTRIES, "  ", "all")).toHaveLength(FAQ_ENTRIES.length);
  });

  it("shows the empty state with a link to Help when nothing matches", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(search(), "zzzzqx");
    expect(screen.getByRole("heading", { name: "No questions match." })).toBeInTheDocument();
    expect(screen.getByText("Try different words, or contact your school.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Help and contact" })).toBeInTheDocument();
  });

  it("category pills filter the visible questions", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Technical" }));
    expect(screen.getByRole("button", { name: "Technical", pressed: true })).toBeInTheDocument();
    expect(screen.getByText("The page will not load.")).toBeInTheDocument();
    expect(screen.queryByText("How do I sign in?")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Students" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("How do I sign in?")).toBeInTheDocument();
  });

  it("pills and search work together", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Teachers" }));
    await user.type(search(), "password");
    expect(screen.getByText("How do I reset a student's password?")).toBeInTheDocument();
    expect(screen.queryByText("What if I forget my password?")).not.toBeInTheDocument();
  });

  it("opens one answer at a time within a category", async () => {
    const user = userEvent.setup();
    renderPage();
    const first = screen.getByRole("button", { name: "How do I get an account?" });
    const second = screen.getByRole("button", { name: "How do I sign in?" });
    await user.click(first);
    expect(first).toHaveAttribute("aria-expanded", "true");
    await user.click(second);
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(first).toHaveAttribute("aria-expanded", "false");
    await user.click(second);
    expect(second).toHaveAttribute("aria-expanded", "false");
  });

  it("supports the keyboard: arrows move between questions, Enter opens", async () => {
    const user = userEvent.setup();
    renderPage();
    const first = screen.getByRole("button", { name: "How do I get an account?" });
    first.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "How do I sign in?" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "How do I sign in?" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await user.keyboard("{Home}");
    expect(first).toHaveFocus();
  });

  it("Expand all opens every visible answer and Collapse all closes them", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Technical" }));
    await user.click(screen.getByRole("button", { name: "Expand all" }));
    const technical = FAQ_ENTRIES.filter((e) => e.category === "technical");
    for (const entry of technical) {
      expect(screen.getByRole("button", { name: entry.question })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    }
    await user.click(screen.getByRole("button", { name: "Collapse all" }));
    for (const entry of technical) {
      expect(screen.getByRole("button", { name: entry.question })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    }
  });

  it("announces the number of results", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(search(), "zzzzqx");
    expect(screen.getByText("No questions match.", { selector: "p" })).toBeInTheDocument();
  });

  it("records 'Did this answer your question?' and remembers it", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPage();
    await user.click(screen.getByRole("button", { name: "What are themes?" }));
    const panel = screen.getByRole("region", { name: "What are themes?" });
    expect(within(panel).getByText("Did this answer your question?")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Yes" }));
    expect(within(panel).getByText("Thanks for letting us know.")).toBeInTheDocument();
    unmount();

    renderPage();
    await user.click(screen.getByRole("button", { name: "What are themes?" }));
    expect(
      within(screen.getByRole("region", { name: "What are themes?" })).getByText(
        "Thanks for letting us know.",
      ),
    ).toBeInTheDocument();
  });

  it("points to Help after a 'No'", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "What are themes?" }));
    const panel = screen.getByRole("region", { name: "What are themes?" });
    await user.click(within(panel).getByRole("button", { name: "No" }));
    expect(within(panel).getByRole("link", { name: "contact your school" })).toHaveAttribute(
      "href",
      "/help",
    );
  });
});

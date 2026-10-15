import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SoundContext } from "@/shared/hooks/useSound";
import type { SoundContextValue } from "@/shared/hooks/useSound";
import AboutPage from "./index";

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
        <AboutPage />
      </MemoryRouter>
    </SoundContext.Provider>,
  );
}

describe("PUB-11: AboutPage (SH-09)", () => {
  it("leads with one h1 mission statement and sets the title", () => {
    renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Help every student grow in English." }),
    ).toBeInTheDocument();
    expect(document.title).toBe("About the platform | Wordland");
  });

  it("has every section from the spec, in order", () => {
    renderPage();
    const names = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent)
      .filter((t): t is string => Boolean(t));
    const expected = [
      "What this is",
      "Who it is for",
      "The language skills",
      "How learning works",
      "How AI is used",
      "Rewards",
      "Meet Pip and Nova",
      "Privacy in brief",
      "Contact",
    ];
    const positions = expected.map((name) => names.indexOf(name));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("shows the four language skills as a grid", () => {
    renderPage();
    const section = screen.getByRole("region", { name: "The language skills" });
    const items = within(section).getAllByRole("listitem");
    expect(items.map((li) => within(li).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "Reading",
      "Writing",
      "Listening",
      "Speaking",
    ]);
    expect(within(section).getByText(/CEFR level/)).toBeInTheDocument();
    expect(within(section).getByText(/Not practiced on the platform yet/)).toBeInTheDocument();
  });

  it("explains the course structure as a numbered sequence with the quiz note", () => {
    renderPage();
    const section = screen.getByRole("region", { name: "How learning works" });
    const steps = within(section).getAllByRole("listitem");
    expect(steps.map((li) => /^\d(\w+)\./.exec(li.textContent ?? "")?.[1])).toEqual([
      "Course",
      "Unit",
      "Lesson",
      "Activity",
      "Quiz",
    ]);
    expect(
      within(section).getByText("Quizzes unlock after you finish the lessons in their unit."),
    ).toBeInTheDocument();
  });

  it("tells the story of Pip and Nova", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 3, name: "Pip, the curious owl" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Nova, the helper star" }),
    ).toBeInTheDocument();
  });

  it("links to Terms and Privacy and to Help, and shows the school logo", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "Read the Terms and Privacy notice" })).toHaveAttribute(
      "href",
      "/terms",
    );
    const contact = screen.getByRole("region", { name: "Contact" });
    expect(within(contact).getByRole("link", { name: "Help and contact" })).toHaveAttribute(
      "href",
      "/help",
    );
    expect(screen.getAllByRole("img", { name: "Al Hikmah Private School" }).length).toBeGreaterThan(
      0,
    );
  });
});

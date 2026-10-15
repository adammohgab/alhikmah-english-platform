import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthContext, defaultAuthContext } from "@/app/providers/auth-context";
import type { AuthContextValue } from "@/app/providers/auth-context";
import { SoundContext } from "@/shared/hooks/useSound";
import type { SoundContextValue } from "@/shared/hooks/useSound";
import NotFoundPage from "./index";

const play = vi.fn();
const sound: SoundContextValue = {
  play,
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

function renderPage(auth: AuthContextValue = defaultAuthContext) {
  return render(
    <SoundContext.Provider value={sound}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={["/nope"]}>
          <NotFoundPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundContext.Provider>,
  );
}

const teacher: AuthContextValue = {
  ...defaultAuthContext,
  isAuthenticated: true,
  user: {
    id: "u1",
    username: "t.one",
    fullName: "Teacher One",
    role: "teacher",
    adminLevel: null,
    status: "active",
    mustChangePassword: false,
  },
};

describe("PUB-12: NotFoundPage (SH-10)", () => {
  beforeEach(() => {
    play.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the spec copy and a single way home when signed out", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "We could not find that page." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The link may be wrong or the page may have moved."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to the home page" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Go to my dashboard" })).not.toBeInTheDocument();
  });

  it("offers the dashboard when signed in", () => {
    renderPage(teacher);
    expect(screen.getByRole("button", { name: "Go to my dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to home" })).toBeInTheDocument();
  });

  it("sets the document title", () => {
    renderPage();
    expect(document.title).toBe("Page not found | Wordland");
  });

  it("rewards three quick presses on Pip with a sound and coins, then resets", async () => {
    const user = userEvent.setup();
    renderPage();
    const pip = screen.getByRole("button", { name: /Pip the owl/ });

    await user.click(pip);
    await user.click(pip);
    expect(play).toHaveBeenLastCalledWith("pop");
    expect(document.querySelectorAll(".nf-coin")).toHaveLength(0);

    await user.click(pip);
    expect(play).toHaveBeenLastCalledWith("success");
    expect(document.querySelectorAll(".nf-coin").length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent("Pip found some coins!");

    // The count starts over after the reward.
    await user.click(pip);
    expect(play).toHaveBeenLastCalledWith("pop");
  });

  it("does not count slow presses", () => {
    vi.useFakeTimers();
    renderPage();
    const pip = screen.getByRole("button", { name: /Pip the owl/ });

    act(() => {
      pip.click();
    });
    act(() => {
      vi.advanceTimersByTime(2500);
      pip.click();
    });
    act(() => {
      vi.advanceTimersByTime(2500);
      pip.click();
    });
    expect(play).not.toHaveBeenCalledWith("success");
    expect(document.querySelectorAll(".nf-coin")).toHaveLength(0);
  });

  it("removes the coins after the animation", () => {
    vi.useFakeTimers();
    renderPage();
    const pip = screen.getByRole("button", { name: /Pip the owl/ });
    act(() => {
      pip.click();
      pip.click();
      pip.click();
    });
    expect(document.querySelectorAll(".nf-coin").length).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(2300);
    });
    expect(document.querySelectorAll(".nf-coin")).toHaveLength(0);
  });
});

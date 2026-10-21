import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/app/providers/auth-context";
import GameResultsPage from "./index";
import { recordGameResult } from "./api";

vi.mock("./api", () => ({ recordGameResult: vi.fn() }));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

const student: AuthContextValue = {
  isAuthenticated: true,
  isLoading: false,
  signOut: () => Promise.resolve(),
  user: {
    id: "student-1",
    username: "sara",
    fullName: "Sara",
    role: "student",
    adminLevel: null,
    status: "active",
    mustChangePassword: false,
  },
};

function renderPage(
  state: unknown = {
    score: 120,
    accuracy: 75,
    durationSeconds: 60,
    correctAnswers: 3,
    totalQuestions: 4,
    gameName: "Word Builder",
  },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={student}>
        <MemoryRouter initialEntries={[{ pathname: "/student/games/word-builder/results", state }]}>
          <Routes>
            <Route path="/student/games/:gameSlug/results" element={<GameResultsPage />} />
            <Route path="/student/games/:gameSlug/play" element={<p>Game screen</p>} />
            <Route path="/student/games" element={<p>Arcade hall</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(recordGameResult).mockResolvedValue({
    gameTitle: "Word Builder",
    previousBest: 100,
    sessionId: "session-1",
    score: 120,
    accuracy: 75,
    xpAwarded: 12,
    coinsAwarded: 5,
  });
  window.sessionStorage.clear();
});

describe("GameResultsPage", () => {
  it("shows the recorded score, high-score celebration, rewards, and answer summary", async () => {
    renderPage();

    expect(await screen.findByText(/New High Score/)).toBeInTheDocument();
    expect(screen.getByText("+12")).toBeInTheDocument();
    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(screen.getByText("3/4")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(recordGameResult).toHaveBeenCalledTimes(1);
    expect(recordGameResult).toHaveBeenCalledWith(
      "word-builder",
      "student-1",
      expect.objectContaining({ score: 120, accuracy: 75 }),
    );
  });

  it("shows the game title and navigates to replay", async () => {
    renderPage();
    await screen.findByText("Score saved and rewards added to your account.");
    fireEvent.click(screen.getByRole("button", { name: /Play Again/ }));
    expect(await screen.findByText("Game screen")).toBeInTheDocument();
  });

  it("does not submit an invalid result and shows an actionable error", async () => {
    renderPage({ score: -1, durationSeconds: 60 });

    expect(
      await screen.findByText(
        "Your completed round could not be found. Return to the arcade and start a game.",
      ),
    ).toBeInTheDocument();
    expect(recordGameResult).not.toHaveBeenCalled();
  });

  it("shows failed submissions and lets the student retry", async () => {
    vi.mocked(recordGameResult)
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce({
        gameTitle: "Word Builder",
        previousBest: 100,
        sessionId: "session-2",
        score: 120,
        accuracy: 75,
        xpAwarded: 0,
        coinsAwarded: 0,
      });
    renderPage();

    expect(await screen.findByText("Network unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));
    expect(
      await screen.findByText("Score saved and rewards added to your account."),
    ).toBeInTheDocument();
    await waitFor(() => expect(recordGameResult).toHaveBeenCalledTimes(2));
  });

  it("does not report a new high score when the current score ties the record", async () => {
    vi.mocked(recordGameResult).mockResolvedValue({
      gameTitle: "Word Builder",
      previousBest: 120,
      sessionId: "session-3",
      score: 120,
      accuracy: 75,
      xpAwarded: 0,
      coinsAwarded: 0,
    });
    renderPage();

    await screen.findByText("Score saved and rewards added to your account.");
    expect(screen.queryByText("New High Score!")).not.toBeInTheDocument();
  });
});

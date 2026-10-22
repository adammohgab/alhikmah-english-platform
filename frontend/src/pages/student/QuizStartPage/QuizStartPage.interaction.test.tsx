import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoundContext } from "@/shared/hooks/useSound";
import type { QuizBrief } from "./api";
import { startQuizAttempt } from "./api";
import QuizStartPage from "./index";

const mocks = vi.hoisted(() => ({
  fetchQuizBrief: vi.fn(),
  startQuizAttempt: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@/app/providers/auth-context", () => ({
  useAuth: () => ({ user: { id: "student-1" } }),
}));

vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ show: mocks.showToast }),
}));

vi.mock("./api", () => ({
  QUIZ_BRIEF_KEY: "student-quiz-brief",
  StartQuizError: class StartQuizError extends Error {
    kind: string;
    constructor(kind: string, message: string) {
      super(message);
      this.kind = kind;
    }
  },
  fetchQuizBrief: mocks.fetchQuizBrief,
  startQuizAttempt: mocks.startQuizAttempt,
}));

const quizBrief: QuizBrief = {
  title: "Unit 3 quiz",
  course: "English 8",
  unit: "Unit 3",
  questionCount: 10,
  timeLimitMin: 15,
  passMark: 60,
  attemptsLeft: 1,
  attemptsAllowed: 2,
  bestScorePct: null,
  shuffleQuestions: true,
  resuming: false,
  rules: [],
  questionTypes: ["multiple_choice"],
  locked: false,
  lockReason: null,
  lessonsRemaining: null,
  unlocksOn: null,
};

function CurrentPath() {
  const { pathname } = useLocation();
  return <p>{pathname}</p>;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <SoundContext.Provider
      value={{
        play: vi.fn(),
        volume: 0.35,
        setVolume: vi.fn(),
        muted: false,
        setMuted: vi.fn(),
        toggleMute: vi.fn(),
      }}
    >
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/student/quizzes/quiz-1"]}>
          <Routes>
            <Route path="/student/quizzes/:quizId" element={<QuizStartPage />} />
            <Route path="/student/quizzes/:quizId/attempt/:attemptId" element={<CurrentPath />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </SoundContext.Provider>,
  );
}

describe("QuizStartPage interactions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.fetchQuizBrief.mockResolvedValue(quizBrief);
  });

  it("requires the honor pledge before starting, then navigates to the attempt", async () => {
    mocks.startQuizAttempt.mockResolvedValue({
      attemptId: "attempt-1",
      attemptNumber: 1,
      expiresAt: null,
    });
    renderPage();

    const startButton = await screen.findByRole("button", { name: "Start quiz" });
    expect(startButton).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(startButton).toBeEnabled();

    fireEvent.click(startButton);
    expect(
      await screen.findByText("/student/quizzes/quiz-1/attempt/attempt-1"),
    ).toBeInTheDocument();
    expect(startQuizAttempt).toHaveBeenCalledWith("quiz-1");
  });

  it("shows the lock explanation instead of allowing a locked quiz to start", async () => {
    mocks.fetchQuizBrief.mockResolvedValue({
      ...quizBrief,
      locked: true,
      lockReason: "Finish 2 more lessons in this unit.",
      lessonsRemaining: 2,
    });
    renderPage();

    expect(await screen.findByText("Finish 2 more lessons in this unit.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start quiz" })).not.toBeInTheDocument();
  });

  it("shows the best result when no attempts remain", async () => {
    mocks.fetchQuizBrief.mockResolvedValue({
      ...quizBrief,
      attemptsLeft: 0,
      bestScorePct: 74,
    });
    renderPage();

    expect(await screen.findByText("No attempts left. Ask your teacher.")).toBeInTheDocument();
    expect(screen.getByText("Your best score: 74%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start quiz" })).not.toBeInTheDocument();
  });
});

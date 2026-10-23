import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/app/providers/auth-context";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import QuizzesHubPage from "./index";

interface Reply {
  data: unknown;
  error: { message: string } | null;
}

const replies: Record<string, () => Reply> = {};

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    rpc: (fn: string, args: { tab?: string }) =>
      Promise.resolve(
        fn === "my_quizzes" && args.tab !== undefined
          ? (replies[args.tab]?.() ?? { data: { items: [], next_cursor: null }, error: null })
          : { data: null, error: { message: `unexpected ${fn}` } },
      ),
  },
}));

const sound: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

const auth: AuthContextValue = {
  isAuthenticated: true,
  isLoading: false,
  signOut: () => Promise.resolve(),
  user: {
    id: "me",
    username: "sara",
    fullName: "Sara Ahmed",
    role: "student",
    adminLevel: null,
    status: "active",
    mustChangePassword: false,
  },
};

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <AuthContext.Provider value={auth}>
          <MemoryRouter initialEntries={["/student/quizzes"]}>
            <Routes>
              <Route path="/student/quizzes" element={<QuizzesHubPage />} />
              <Route path="*" element={<Where />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

const hoursFromNow = (count: number): string =>
  new Date(Date.now() + count * 3_600_000).toISOString();

const open = { locked: false };

function availableRow(overrides: Record<string, unknown>) {
  return {
    id: "q",
    title: "Quiz",
    course: "Grade 7 English",
    class_name: "7A",
    unit: "Greetings",
    question_count: 10,
    time_limit_min: 20,
    attempts_used: 0,
    attempts_allowed: 2,
    best_score_pct: null,
    opens_at: null,
    due_at: null,
    lock: open,
    ...overrides,
  };
}

beforeEach(() => {
  for (const key of Object.keys(replies)) delete replies[key];
  replies.available = () => ({
    error: null,
    data: {
      next_cursor: null,
      items: [
        availableRow({ id: "q-later", title: "Vocabulary Check", due_at: hoursFromNow(72) }),
        availableRow({ id: "q-soon", title: "Grammar Basics", due_at: hoursFromNow(5) }),
        availableRow({
          id: "q-future",
          title: "Reading Test",
          opens_at: hoursFromNow(48),
          lock: { locked: true, reason: "Opens soon" },
        }),
      ],
    },
  });
  replies.history = () => ({
    error: null,
    data: {
      next_cursor: null,
      items: [
        {
          id: "q-old",
          attempt_id: "a1",
          quiz_id: "q-old",
          title: "Greetings Quiz",
          course: "Grade 7 English",
          class_name: "7A",
          submitted_at: hoursFromNow(-30),
          score_pct: 80,
          passed: true,
          attempt_no: 1,
        },
      ],
    },
  });
});

describe("QuizzesHubPage", () => {
  it("separates available, upcoming and completed quizzes", async () => {
    renderPage();
    expect(await screen.findByRole("tab", { name: "Available now" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Upcoming" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Completed" })).toBeVisible();
    expect(await screen.findByText("Grammar Basics")).toBeVisible();
    expect(await screen.findByText("Vocabulary Check")).toBeVisible();
    expect(screen.queryByText("Reading Test")).not.toBeInTheDocument();
  });

  it("highlights a quiz that closes within 24 hours and lists it first", async () => {
    renderPage();
    const soon = await screen.findByText("Grammar Basics");
    const soonCard = soon.closest("li") as HTMLElement;
    expect(soonCard).toHaveClass("border-danger-600");
    expect(within(soonCard).getByText(/Closing soon/)).toBeVisible();
    const later = screen.getByText("Vocabulary Check");
    expect(later.closest("li")).not.toHaveClass("border-danger-600");
    expect(soonCard).toBeInTheDocument();
  });

  it("starts the right quiz", async () => {
    const user = userEvent.setup();
    renderPage();
    const title = await screen.findByText("Grammar Basics");
    const card = title.closest("li") as HTMLElement;
    await user.click(within(card).getByRole("link", { name: "Start quiz" }));
    await waitFor(() =>
      expect(screen.getByTestId("where")).toHaveTextContent("/student/quizzes/q-soon"),
    );
  });

  it("shows why an upcoming quiz is not open", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Upcoming" }));
    const title = await screen.findByText("Reading Test");
    const card = title.closest("li") as HTMLElement;
    expect(within(card).getByText(/Opens soon/)).toBeVisible();
    expect(within(card).queryByRole("link", { name: "Start quiz" })).not.toBeInTheDocument();
  });

  it("shows the earned grade on completed quizzes and opens the result", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Completed" }));
    const title = await screen.findByText("Greetings Quiz");
    const card = title.closest("li") as HTMLElement;
    expect(within(card).getByText(/80%/)).toBeVisible();
    expect(within(card).getByText("Passed")).toBeVisible();
    await user.click(within(card).getByRole("link", { name: /View result/ }));
    await waitFor(() =>
      expect(screen.getByTestId("where")).toHaveTextContent("/student/quizzes/q-old/result/a1"),
    );
  });

  it("searches by quiz title", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByRole("searchbox", { name: /Search by title/ }), "vocab");
    expect(screen.getByText("Vocabulary Check")).toBeVisible();
    expect(screen.queryByText("Grammar Basics")).not.toBeInTheDocument();
  });

  it("says so when no quizzes have been taken", async () => {
    replies.history = () => ({ error: null, data: { items: [], next_cursor: null } });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: /Completed/ }));
    expect(await screen.findByText("No quizzes taken yet.")).toBeVisible();
  });

  it("offers a retry when the quizzes cannot load", async () => {
    replies.available = () => ({ data: null, error: { message: "boom" } });
    renderPage();
    expect(await screen.findByRole("button", { name: "Try again" })).toBeVisible();
  });
});

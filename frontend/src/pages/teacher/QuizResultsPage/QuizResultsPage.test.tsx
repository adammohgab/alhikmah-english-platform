import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import { ToastContext, type ToastContextValue } from "@/app/providers/toast-context";
import QuizResultsPage from "./index";

const rpc = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<unknown>>();

vi.mock("@/shared/api/supabase", () => ({
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => rpc(fn, args) },
}));

const sound: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};
const toast: ToastContextValue = {
  show: vi.fn(() => "t"),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
  toasts: [],
};

const results = {
  summary: {
    title: "Unit 3 Verbs",
    status: "Open",
    attempts: 5,
    completion_rate: 80,
    average_score: 64,
    highest: 95,
    lowest: 20,
    avg_time_s: 410,
    pass_mark: 60,
  },
  students: [
    {
      student: { id: "u1", full_name: "Amal Student" },
      attempts_used: 1,
      attempts_allowed: 1,
      score_pct: 95,
      status: "passed",
    },
    {
      student: { id: "u2", full_name: "Bilal Student" },
      attempts_used: 1,
      attempts_allowed: 1,
      score_pct: 20,
      status: "not_passed",
    },
    {
      student: { id: "u3", full_name: "Chadia Student" },
      attempts_used: 0,
      attempts_allowed: 1,
      score_pct: null,
      status: "not_attempted",
    },
  ],
  items: [
    {
      question: { id: "q1", position: 1, prompt: "Easy question" },
      percent_correct: 90,
      common_wrong: null,
    },
    {
      question: { id: "q2", position: 2, prompt: "Tricky tense" },
      percent_correct: 25,
      common_wrong: { answer: "goed", count: 7 },
      avg_time_s: 40,
    },
  ],
};

function renderPage() {
  rpc.mockImplementation((fn: string) => {
    if (fn === "quiz_results") return Promise.resolve({ data: results, error: null });
    if (fn === "grant_extra_attempt") return Promise.resolve({ data: { ok: true }, error: null });
    return Promise.resolve({ data: null, error: { message: `unexpected ${fn}` } });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <ToastContext.Provider value={toast}>
          <MemoryRouter initialEntries={["/teacher/quizzes/z1/results"]}>
            <Routes>
              <Route path="/teacher/quizzes/:quizId/results" element={<QuizResultsPage />} />
            </Routes>
          </MemoryRouter>
        </ToastContext.Provider>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

describe("QuizResultsPage", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.mocked(toast.show).mockClear();
  });

  it("draws the class score distribution", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Unit 3 Verbs" })).toBeInTheDocument();
    const chart = screen.getByRole("img", { name: /Score distribution of 2 students/ });
    expect(chart).toBeInTheDocument();
    expect(screen.getByText("Average").nextSibling).toHaveTextContent("64%");
  });

  it("lists the hardest question first and highlights low success", async () => {
    renderPage();
    const list = await screen.findByRole("list", { name: "Questions, hardest first" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Tricky tense");
    expect(rows[0]).toHaveAttribute("data-low-success");
    expect(rows[0]).toHaveTextContent("goed");
    expect(rows[0]).toHaveTextContent("Might be too hard");
    expect(rows[1]).not.toHaveAttribute("data-low-success");
    expect(screen.getByText("1 question under 50%")).toBeInTheDocument();
  });

  it("grants an extra attempt for the chosen student and refreshes the table", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Grant extra attempt to Bilal Student" }),
    );
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("grant_extra_attempt", { quiz_id: "z1", student_id: "u2" }),
    );
    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Extra attempt granted to Bilal Student" }),
      ),
    );
    await waitFor(() =>
      expect(rpc.mock.calls.filter(([fn]) => fn === "quiz_results")).toHaveLength(2),
    );
  });

  it("shows an error when granting fails", async () => {
    const user = userEvent.setup();
    renderPage();
    rpc.mockImplementation((fn: string) =>
      fn === "grant_extra_attempt"
        ? Promise.resolve({ data: null, error: { message: "Not authorized" } })
        : Promise.resolve({ data: results, error: null }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Grant extra attempt to Amal Student" }),
    );
    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })),
    );
  });
});

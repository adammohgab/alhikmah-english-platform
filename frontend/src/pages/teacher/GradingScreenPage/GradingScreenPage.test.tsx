import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import { ToastContext, type ToastContextValue } from "@/app/providers/toast-context";
import GradingScreenPage from "./index";

const { rpc, invoke } = vi.hoisted(() => ({
  rpc: vi.fn<(fn: string, args: Record<string, unknown>) => Promise<unknown>>(),
  invoke: vi.fn(),
}));

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => rpc(fn, args),
    functions: { invoke },
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
const toast: ToastContextValue = {
  show: vi.fn(() => "t"),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
  toasts: [],
};

const submission = {
  submission: {
    id: "s1",
    assignment_id: "as1",
    assignment_title: "Essay 1",
    student: { id: "u1", full_name: "Amal Student" },
    class: { id: "c1", name: "Grade 8 A" },
    status: "submitted",
  },
  questions: [
    {
      question_id: "q1",
      position: 1,
      prompt: "Pick the verb",
      question_type: "multiple_choice",
      max_points: 2,
      is_writing: false,
      student_answer: "run",
      correct_answer: "run",
      auto_score: 2,
    },
    {
      question_id: "q2",
      position: 2,
      prompt: "Describe your weekend",
      question_type: "short_answer",
      max_points: 10,
      is_writing: true,
      student_answer: "I went to the market with my family.",
      ai: {
        score: 8,
        confidence: 0.9,
        comment: "Clear and correct.",
        criteria: { grammar: 5, vocab: 1 },
      },
    },
  ],
  rubric: {
    title: "Writing",
    max_score: 10,
    criteria: [
      {
        id: "grammar",
        name: "Grammar",
        levels: [
          { label: "Weak", points: 1 },
          { label: "Great", points: 5 },
        ],
      },
      {
        id: "vocab",
        name: "Vocabulary",
        levels: [
          { label: "Weak", points: 1 },
          { label: "Great", points: 5 },
        ],
      },
    ],
  },
  comments: [],
  neighbors: { prev: null, next: "s2" },
};

function renderPage() {
  rpc.mockImplementation((fn: string) => {
    if (fn === "get_submission_for_grading")
      return Promise.resolve({ data: submission, error: null });
    if (fn === "lock_submission_for_grading")
      return Promise.resolve({ data: { attempt_id: "s1" }, error: null });
    if (fn === "save_grade")
      return Promise.resolve({ data: { attempt_id: "s1", score: 12 }, error: null });
    return Promise.resolve({ data: null, error: { message: `unexpected ${fn}` } });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <ToastContext.Provider value={toast}>
          <MemoryRouter initialEntries={["/teacher/grading/s1"]}>
            <Routes>
              <Route path="/teacher/grading/:submissionId" element={<GradingScreenPage />} />
              <Route path="/teacher/grading" element={<p>Queue page</p>} />
            </Routes>
          </MemoryRouter>
        </ToastContext.Provider>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

describe("GradingScreenPage", () => {
  beforeEach(() => {
    rpc.mockReset();
    invoke.mockReset();
    vi.mocked(toast.show).mockClear();
  });

  it("shows the student's work beside the rubric and takes the grading lock", async () => {
    renderPage();
    expect(await screen.findByText("I went to the market with my family.")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Grammar" })).toBeInTheDocument();
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("lock_submission_for_grading", { attempt_id: "s1" }),
    );
  });

  it("recalculates the score as soon as a rubric level is tapped", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("I went to the market with my family.");
    expect(screen.getByTestId("total-score")).toHaveTextContent("Total 2 / 12");

    const grammar = screen.getByRole("radiogroup", { name: "Grammar" });
    await user.click(within(grammar).getByRole("radio", { name: /Great/ }));
    expect(screen.getByTestId("score-q2")).toHaveTextContent("5 / 10");
    expect(screen.getByTestId("total-score")).toHaveTextContent("Total 7 / 12");

    const vocab = screen.getByRole("radiogroup", { name: "Vocabulary" });
    await user.click(within(vocab).getByRole("radio", { name: /Great/ }));
    expect(screen.getByTestId("score-q2")).toHaveTextContent("10 / 10");
    expect(screen.getByTestId("total-score")).toHaveTextContent("Total 12 / 12");
  });

  it("runs AI pre-grade and only applies its suggestions after teacher confirmation", async () => {
    const user = userEvent.setup();
    invoke.mockResolvedValue({
      data: {
        success: true,
        draft_grade: {
          criteria_evaluations: [
            { criterion_name: "Grammar", score: 5, explanation: "Accurate verb forms." },
            { criterion_name: "Vocabulary", score: 1, explanation: "Word choice is limited." },
          ],
          suggested_teacher_comment: "Good start. Add more descriptive vocabulary.",
        },
      },
      error: null,
    });
    renderPage();
    await screen.findByText("I went to the market with my family.");
    await user.click(screen.getByRole("button", { name: "Run AI Pre-Grade" }));
    expect(await screen.findByText("Accurate verb forms.")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith(
      "ai-grade-submission",
      expect.objectContaining({
        body: expect.objectContaining({ attempt_id: "s1", question_id: "q2" }),
      }),
    );
    expect(screen.getByTestId("score-q2")).toHaveTextContent("— / 10");
    await user.click(screen.getAllByRole("button", { name: "Use in draft" })[0]);
    expect(screen.getByTestId("score-q2")).toHaveTextContent("5 / 10");
    expect(screen.getByText("Accepted into teacher draft")).toBeInTheDocument();
  });

  it("refuses to save while a writing answer is unscored", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("I went to the market with my family.");
    await user.click(screen.getByRole("button", { name: /Save & Next/ }));
    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error", title: "Grade was not saved" }),
      ),
    );
    expect(rpc).not.toHaveBeenCalledWith("save_grade", expect.anything());
  });

  it("saves with Ctrl+Enter through save_grade and opens the next student", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("I went to the market with my family.");
    await user.click(screen.getByRole("button", { name: /Accept AI score/ }));
    expect(screen.getByTestId("total-score")).toHaveTextContent("Total 10 / 12");

    await user.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("save_grade", {
        attempt_id: "s1",
        rubric_scores: { q1: 2, q2: 8 },
        feedback: "",
        final_score: 10,
      }),
    );
  });
});

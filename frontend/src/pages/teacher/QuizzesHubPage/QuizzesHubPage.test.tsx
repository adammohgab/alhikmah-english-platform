import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import { ToastContext, type ToastContextValue } from "@/app/providers/toast-context";
import type { QuizRow } from "./api";
import { availableActions, passTone, percent, totalLive } from "./rules";
import QuizzesHubPage from "./index";

const rpc = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<unknown>>();
let attempts: Array<{ assessment_id: string }> = [];

vi.mock("@/shared/api/supabase", () => {
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      rpc: (fn: string, args: Record<string, unknown>) => rpc(fn, args),
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: attempts, error: null }) }),
      }),
      channel: () => channel,
      removeChannel: () => Promise.resolve("ok"),
    },
  };
});

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

const quiz = (id: string, extra: Partial<QuizRow> = {}): QuizRow => ({
  id,
  title: `Quiz ${id}`,
  classes: [{ id: "c1", name: "Grade 8 A" }],
  unit: null,
  question_count: 10,
  time_limit_min: 20,
  attempts_allowed: 2,
  status: "open",
  attempts_taken: 12,
  avg_score: 72.4,
  pass_rate: 80,
  ...extra,
});

function renderPage() {
  rpc.mockImplementation((fn) => {
    if (fn === "teacher_classes_summary") {
      return Promise.resolve({ data: [{ class: { id: "c1", name: "Grade 8 A" } }], error: null });
    }
    if (fn === "list_quizzes") {
      return Promise.resolve({
        data: {
          items: [
            quiz("a"),
            quiz("b", {
              status: "scheduled",
              avg_score: null,
              pass_rate: null,
              time_limit_min: null,
            }),
          ],
          next_cursor: null,
        },
        error: null,
      });
    }
    return Promise.resolve({ data: {}, error: null });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <ToastContext.Provider value={toast}>
          <MemoryRouter>
            <QuizzesHubPage />
          </MemoryRouter>
        </ToastContext.Provider>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

describe("QuizzesHubPage (TC-16)", () => {
  beforeEach(() => {
    rpc.mockReset();
    attempts = [{ assessment_id: "a" }, { assessment_id: "a" }, { assessment_id: "a" }];
  });

  it("lists quizzes with status, question count, time limit, average score and pass rate", async () => {
    renderPage();
    const card = (await screen.findByText("Quiz a")).closest("li")!;
    expect(within(card).getByText("Open")).toBeInTheDocument();
    expect(within(card).getByText("10 questions")).toBeInTheDocument();
    expect(within(card).getByText("20 min")).toBeInTheDocument();
    expect(within(card).getByText("72%")).toBeInTheDocument();
    expect(within(card).getByText("80% pass rate")).toBeInTheDocument();
    expect(within(card).getByText("Grade 8 A")).toBeInTheDocument();
  });

  it("shows live attempts on the quiz and in the summary", async () => {
    renderPage();
    expect(await screen.findByTestId("live-a")).toHaveTextContent("3 students in quiz now");
    expect(screen.getByTestId("live-summary")).toHaveTextContent(
      "3 students are taking a quiz right now",
    );
    expect(screen.queryByTestId("live-b")).not.toBeInTheDocument();
  });

  it("links to the builder and the results page", async () => {
    renderPage();
    const card = (await screen.findByText("Quiz a")).closest("li")!;
    expect(within(card).getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/teacher/quizzes/a/edit",
    );
    expect(within(card).getByRole("link", { name: "View results" })).toHaveAttribute(
      "href",
      "/teacher/quizzes/a",
    );
    expect(screen.getByRole("link", { name: /New quiz/ })).toHaveAttribute(
      "href",
      "/teacher/quizzes/new",
    );
  });

  it("filters by status through the server", async () => {
    renderPage();
    await screen.findByText("Quiz a");
    await userEvent.click(screen.getByRole("button", { name: "Scheduled" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("list_quizzes", { status: "scheduled" }));
  });

  it("closes an open quiz after confirmation", async () => {
    renderPage();
    const card = (await screen.findByText("Quiz a")).closest("li")!;
    await userEvent.click(within(card).getByRole("button", { name: "Close" }));
    await userEvent.click(await screen.findByRole("button", { name: "Close quiz" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("close_assessment_early", { kind: "quiz", id: "a" }),
    );
  });
});

describe("quiz rules", () => {
  it("formats and classifies", () => {
    expect(percent(72.4)).toBe("72%");
    expect(percent(null)).toBe("—");
    expect(passTone(59)).toBe("watch");
    expect(passTone(60)).toBe("good");
  });

  it("totals live attempts across listed quizzes only", () => {
    expect(totalLive([quiz("a"), quiz("b")], { a: 2, b: 1, other: 9 })).toBe(3);
  });

  it("offers open-early only for scheduled quizzes with questions", () => {
    expect(availableActions(quiz("a", { status: "scheduled" }))).toEqual({
      openEarly: true,
      close: false,
    });
    expect(availableActions(quiz("a", { status: "scheduled", question_count: 0 })).openEarly).toBe(
      false,
    );
    expect(availableActions(quiz("a", { status: "open" }))).toEqual({
      openEarly: false,
      close: true,
    });
    expect(availableActions(quiz("a", { status: "closed" }))).toEqual({
      openEarly: false,
      close: false,
    });
  });
});

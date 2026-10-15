import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import DashboardPage from "./index";

const rpc = vi.fn<(fn: string, args: unknown) => Promise<unknown>>();

const sound: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

vi.mock("@/shared/api/supabase", () => ({
  supabase: { rpc: (fn: string, args: unknown) => rpc(fn, args) },
}));

const classA = { id: "c1", name: "Grade 8 A", grade_level: "8" };

function respond(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    teacher_grading_queue_summary: [
      {
        assignment_id: "a1",
        title: "Essay 1",
        class: classA,
        waiting: 9,
        ai_ready: 3,
        oldest_at: null,
      },
      {
        assignment_id: "a2",
        title: "Quiz review",
        class: classA,
        waiting: 5,
        ai_ready: 0,
        oldest_at: null,
      },
    ],
    teacher_attention_students: [],
    teacher_activity_feed: { items: [], next_cursor: null },
    teacher_classes_summary: [
      {
        class: classA,
        students: 24,
        avg_progress: 61,
        avg_score: 78,
        awaiting_grading: 14,
        join_code_enabled: true,
        active_today: 50,
      },
    ],
    teacher_deadlines: [],
    ...overrides,
  };
  rpc.mockImplementation((fn: string) => {
    const value = defaults[fn];
    return Promise.resolve(
      value instanceof Error
        ? { data: null, error: { message: value.message } }
        : { data: value, error: null },
    );
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

describe("Teacher DashboardPage (TC-01)", () => {
  beforeEach(() => rpc.mockReset());

  it("shows the urgent grading banner with the total waiting, linked to the queue", async () => {
    respond();
    renderPage();
    const banner = await screen.findByTestId("urgent-grading-banner");
    expect(banner).toHaveTextContent("14 submissions awaiting grading");
    expect(banner).toHaveAttribute("href", "/teacher/grading");
  });

  it("renders class cards with live student counts", async () => {
    respond();
    renderPage();
    const region = await screen.findByRole("region", { name: "My classes" });
    expect(await within(region).findByText("Grade 8 A")).toBeInTheDocument();
    expect(within(region).getByText("24")).toBeInTheDocument();
    expect(within(region).getByText("50%")).toBeInTheDocument();
  });

  it("links the quick actions to their creation flows", async () => {
    respond();
    renderPage();
    await screen.findByRole("link", { name: "Open Grade 8 A" });
    expect(screen.getByRole("link", { name: /Create Assignment/ })).toHaveAttribute(
      "href",
      "/teacher/assignments/new",
    );
    expect(screen.getByRole("link", { name: /Launch Quiz/ })).toHaveAttribute(
      "href",
      "/teacher/quizzes/new",
    );
    expect(screen.getByRole("link", { name: /Post Announcement/ })).toHaveAttribute(
      "href",
      "/teacher/announcements/new",
    );
  });

  it("filters the activity feed through the RPC", async () => {
    respond();
    renderPage();
    await screen.findByRole("link", { name: "Open Grade 8 A" });
    await userEvent.click(screen.getByRole("button", { name: "Quizzes" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("teacher_activity_feed", { filter: "quizzes" }),
    );
  });

  it("isolates a failing widget with a retry state", async () => {
    respond({ teacher_deadlines: new Error("boom") });
    renderPage();
    expect(await screen.findByText(/Upcoming deadlines could not be loaded/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Grade 8 A" })).toBeInTheDocument();
  });

  it("guides a new teacher with no classes", async () => {
    respond({ teacher_classes_summary: [], teacher_grading_queue_summary: [] });
    renderPage();
    expect(await screen.findByRole("link", { name: "Create a class" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Build a course" })).toBeInTheDocument();
  });
});

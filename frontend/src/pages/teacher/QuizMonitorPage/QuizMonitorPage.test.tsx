import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import { ToastContext, type ToastContextValue } from "@/app/providers/toast-context";
import QuizMonitorPage from "./index";

const rpc = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<unknown>>();
type ChangeHandler = () => void;
let onChange: ChangeHandler | null = null;
let onStatus: ((status: string) => void) | null = null;
const removeChannel = vi.fn();
const channelName = vi.fn<(name: string) => void>();
const changeFilter = vi.fn<(filter: unknown) => void>();

vi.mock("@/shared/api/supabase", () => {
  const channel = {
    on: (_type: string, filter: unknown, handler: ChangeHandler) => {
      changeFilter(filter);
      onChange = handler;
      return channel;
    },
    subscribe: (cb: (status: string) => void) => {
      onStatus = cb;
      return channel;
    },
  };
  return {
    supabase: {
      rpc: (fn: string, args: Record<string, unknown>) => rpc(fn, args),
      channel: (name: string) => {
        channelName(name);
        return channel;
      },
      removeChannel: (c: unknown) => {
        removeChannel(c);
      },
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

function snapshot(questionOfAmal: number) {
  const now = Date.now();
  const iso = (offsetSec: number) => new Date(now + offsetSec * 1000).toISOString();
  return {
    server_time: iso(0),
    quiz: { id: "z1", title: "Unit 3 Verbs", question_count: 10 },
    students: [
      { student: { id: "u1", full_name: "Amal Student" }, attempt_id: "att1", status: "in_progress", current_question: questionOfAmal, started_at: iso(-300), submitted_at: null, deadline_at: iso(600), last_seen_at: iso(-3) },
      { student: { id: "u2", full_name: "Bilal Student" }, attempt_id: "att2", status: "in_progress", current_question: 2, started_at: iso(-300), submitted_at: null, deadline_at: iso(600), last_seen_at: iso(-70) },
      { student: { id: "u3", full_name: "Chadia Student" }, attempt_id: null, status: "not_started", current_question: null, started_at: null, submitted_at: null, deadline_at: null, last_seen_at: null },
      { student: { id: "u4", full_name: "Dina Student" }, attempt_id: "att4", status: "submitted", current_question: 10, started_at: iso(-500), submitted_at: iso(-100), deadline_at: iso(600), last_seen_at: iso(-100) },
    ],
  };
}

let current = snapshot(4);

function renderPage() {
  rpc.mockImplementation((fn: string) => {
    if (fn === "quiz_live_state") return Promise.resolve({ data: current, error: null });
    if (fn === "extend_quiz_time" || fn === "force_submit_attempt")
      return Promise.resolve({ data: { ok: true }, error: null });
    return Promise.resolve({ data: null, error: { message: `unexpected ${fn}` } });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <ToastContext.Provider value={toast}>
          <MemoryRouter initialEntries={["/teacher/quizzes/z1/monitor"]}>
            <Routes>
              <Route path="/teacher/quizzes/:quizId/monitor" element={<QuizMonitorPage />} />
            </Routes>
          </MemoryRouter>
        </ToastContext.Provider>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

describe("QuizMonitorPage", () => {
  beforeEach(() => {
    rpc.mockReset();
    removeChannel.mockClear();
    channelName.mockClear();
    changeFilter.mockClear();
    vi.mocked(toast.show).mockClear();
    current = snapshot(4);
    onChange = null;
    onStatus = null;
  });

  it("shows each student's question, time and connection status", async () => {
    renderPage();
    const grid = await screen.findByRole("list", { name: "Students" });
    const cards = within(grid).getAllByRole("listitem");
    expect(cards).toHaveLength(4);
    expect(cards[0]).toHaveTextContent("Amal Student");
    expect(cards[0]).toHaveTextContent("4 / 10");
    expect(cards[0]).toHaveTextContent("Active");
    expect(cards[1]).toHaveTextContent("Idle");
    expect(cards[2]).toHaveTextContent("Not started");
    expect(cards[3]).toHaveTextContent("Submitted");
    expect(screen.getByText("2 in progress")).toBeInTheDocument();
    expect(screen.getByText("1 idle or offline")).toBeInTheDocument();
  });

  it("subscribes to this quiz's attempts and updates the grid without a reload", async () => {
    renderPage();
    await screen.findByRole("list", { name: "Students" });
    expect(channelName).toHaveBeenCalledWith("quiz-monitor:z1");
    expect(changeFilter).toHaveBeenCalledWith(
      expect.objectContaining({ table: "assessment_attempts", filter: "assessment_id=eq.z1" }),
    );

    act(() => onStatus?.("SUBSCRIBED"));
    expect(await screen.findByText("Live")).toBeInTheDocument();

    current = snapshot(7);
    act(() => onChange?.());
    await waitFor(() => expect(screen.getByText("7 / 10")).toBeInTheDocument());
  });

  it("extends the class time after confirmation", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /Extend time for class/ }));
    await user.click(await screen.findByRole("button", { name: "Add 5 minutes" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("extend_quiz_time", { quiz_id: "z1", minutes: 5 }),
    );
    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Added 5 minutes for the class" }),
      ),
    );
  });

  it("force submits only the chosen student's attempt after confirmation", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Force submit Bilal Student" }));
    expect(rpc).not.toHaveBeenCalledWith("force_submit_attempt", expect.anything());
    await user.click(await screen.findByRole("button", { name: "Submit now" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("force_submit_attempt", { attempt_id: "att2" }),
    );
  });

  it("stops listening when the page closes", async () => {
    const view = renderPage();
    await screen.findByRole("list", { name: "Students" });
    view.unmount();
    expect(removeChannel).toHaveBeenCalled();
  });
});

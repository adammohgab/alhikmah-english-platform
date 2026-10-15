import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import { ToastContext, type ToastContextValue } from "@/app/providers/toast-context";
import GradingQueuePage from "./index";

const rpc = vi.fn<(fn: string, args: unknown) => Promise<unknown>>();

vi.mock("@/shared/api/supabase", () => ({
  supabase: { rpc: (fn: string, args: unknown) => rpc(fn, args) },
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

const base = {
  assignment_id: "a1",
  assignment_title: "Essay 1",
  assessment_kind: "essay",
  class: { id: "c1", name: "Grade 8 A" },
  ai_status: "off",
};

const items = [
  {
    ...base,
    submission_id: "s-new",
    student: { id: "u2", full_name: "Newer Student" },
    submitted_at: "2026-10-14T10:00:00Z",
    status: "waiting",
  },
  {
    ...base,
    submission_id: "s-old",
    student: { id: "u1", full_name: "Older Student" },
    submitted_at: "2026-10-02T10:00:00Z",
    status: "ai_graded",
    ai_status: "done",
    ai_confidence: 0.9,
  },
  {
    ...base,
    submission_id: "s-done",
    student: { id: "u3", full_name: "Finished Student" },
    submitted_at: "2026-10-01T10:00:00Z",
    status: "graded",
  },
];

function renderPage() {
  rpc.mockImplementation((fn: string) => {
    const data: Record<string, unknown> = {
      grading_queue: { items, next_cursor: null },
      teacher_classes_summary: [{ class: { id: "c1", name: "Grade 8 A" } }],
      teacher_grading_queue_summary: [{ waiting: 2, ai_ready: 1 }],
    };
    return Promise.resolve({ data: data[fn] ?? [], error: null });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <ToastContext.Provider value={toast}>
          <MemoryRouter initialEntries={["/teacher/grading"]}>
            <Routes>
              <Route path="/teacher/grading" element={<GradingQueuePage />} />
              <Route path="/teacher/grading/:id" element={<p>Grading screen</p>} />
            </Routes>
          </MemoryRouter>
        </ToastContext.Provider>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

describe("GradingQueuePage (TC-20)", () => {
  beforeEach(() => rpc.mockReset());

  it("lists only pending submissions in one queue, oldest first, with the AI badge", async () => {
    renderPage();
    const names = (await screen.findAllByText(/Student$/)).map((node) => node.textContent);
    expect(names).toEqual(["Older Student", "Newer Student"]);
    expect(screen.queryByText("Finished Student")).not.toBeInTheDocument();
    expect(screen.getByText(/AI pre-graded · 90%/)).toBeInTheDocument();
  });

  it("Start Grading Next opens the oldest pending submission", async () => {
    renderPage();
    const button = await screen.findByRole("button", { name: /Start Grading Next/ });
    await within(document.body).findByText("Older Student");
    await userEvent.click(button);
    expect(await screen.findByText("Grading screen")).toBeInTheDocument();
  });

  it("shows the totals from the queue summary", async () => {
    renderPage();
    expect(await screen.findByText("Waiting")).toBeInTheDocument();
    expect(await screen.findByText("2")).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import { ToastContext, type ToastContextValue } from "@/app/providers/toast-context";
import type { AssignmentRow } from "./api";
import { availableActions, dueLabel, submissionLabel, submissionShare } from "./rules";
import AssignmentsHubPage from "./index";

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

const open = {
  id: "a1",
  title: "Essay 1",
  classes: [{ id: "c1", name: "Grade 8 A" }],
  due_at: "2099-01-01T00:00:00Z",
  status: "open",
  submitted: 22,
  total: 28,
  waiting_to_grade: 6,
  avg_score: 71,
};
const draft = {
  ...open,
  id: "a2",
  title: "Draft essay",
  status: "draft",
  submitted: 0,
  waiting_to_grade: 0,
};

function renderPage(props: { classId?: string } = {}) {
  rpc.mockImplementation((fn) => {
    if (fn === "list_assignments")
      return Promise.resolve({ data: { items: [open, draft], next_cursor: null }, error: null });
    if (fn === "teacher_classes_summary")
      return Promise.resolve({ data: [{ class: { id: "c1", name: "Grade 8 A" } }], error: null });
    return Promise.resolve({ data: {}, error: null });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <ToastContext.Provider value={toast}>
          <MemoryRouter>
            <AssignmentsHubPage {...props} />
          </MemoryRouter>
        </ToastContext.Provider>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

describe("AssignmentsHubPage (TC-13)", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("shows the submission counter and the ungraded pill", async () => {
    renderPage();
    expect(await screen.findByText("Essay 1")).toBeInTheDocument();
    expect(screen.getAllByText("22/28 submitted").length).toBeGreaterThan(0);
    expect(screen.getByTestId("ungraded-a1")).toHaveTextContent("6 ungraded");
    expect(screen.queryByTestId("ungraded-a2")).not.toBeInTheDocument();
  });

  it("Grade Submissions opens the grading queue filtered to the assignment", async () => {
    renderPage();
    await screen.findByText("Essay 1");
    const links = screen.getAllByRole("link", { name: "Grade Submissions" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/teacher/grading?assignment=a1");
  });

  it("filters by status and by the shell's active class through the server", async () => {
    renderPage({ classId: "c1" });
    await screen.findByText("Essay 1");
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith(
        "list_assignments",
        expect.objectContaining({ class_id: "c1" }),
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Draft" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith(
        "list_assignments",
        expect.objectContaining({ status: "draft", class_id: "c1" }),
      ),
    );
  });

  it("duplicates an assignment through the contract RPC", async () => {
    renderPage();
    await screen.findByText("Essay 1");
    await userEvent.click(screen.getAllByRole("button", { name: "Duplicate" })[0]);
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("duplicate_assessment", { kind: "assignment", id: "a1" }),
    );
  });
});

describe("assignment rules", () => {
  const row = { ...open, status: "open" } as AssignmentRow;

  it("labels due dates and submissions", () => {
    const now = Date.parse("2026-10-16T12:00:00Z");
    expect(dueLabel(null, now)).toBe("No due date");
    expect(dueLabel("2026-10-19T12:00:00Z", now)).toBe("Due in 3 days");
    expect(dueLabel("2026-10-15T12:00:00Z", now)).toMatch(/^Overdue/);
    expect(submissionLabel(row)).toBe("22/28 submitted");
    expect(submissionShare({ ...row, total: 0 })).toBe(0);
  });

  it("offers grading only once an assignment is open or closed", () => {
    expect(availableActions({ ...row, status: "draft" }).grade).toBe(false);
    expect(availableActions({ ...row, status: "scheduled" }).grade).toBe(false);
    expect(availableActions(row)).toEqual({ grade: true, closeEarly: true });
    expect(availableActions({ ...row, status: "closed" })).toEqual({
      grade: true,
      closeEarly: false,
    });
  });
});

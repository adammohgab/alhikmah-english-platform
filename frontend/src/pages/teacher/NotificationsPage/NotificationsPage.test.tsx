import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import { ToastContext, type ToastContextValue } from "@/app/providers/toast-context";
import { AuthContext, type AuthContextValue } from "@/app/providers/auth-context";
import type { NotificationRow } from "./api";
import { categorize, destinationFor } from "./rules";
import NotificationsPage from "./index";

const rpc = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<unknown>>();
let rows: Array<Record<string, unknown>> = [];
let realtime: (() => void) | undefined;

vi.mock("@/shared/api/supabase", () => {
  const builder = (head: boolean) => {
    const b = {
      eq: () => b,
      lt: () => b,
      order: () => b,
      limit: () => b,
      then: (resolve: (value: unknown) => unknown) =>
        resolve(
          head
            ? { data: null, error: null, count: rows.filter((row) => !row["is_read"]).length }
            : { data: rows, error: null },
        ),
    };
    return b;
  };
  const channel = {
    on: (_type: string, _filter: unknown, callback: () => void) => {
      realtime = callback;
      return channel;
    },
    subscribe: () => channel,
  };
  return {
    supabase: {
      from: () => ({
        select: (_cols: string, options?: { head: boolean }) => builder(Boolean(options?.head)),
      }),
      rpc: (fn: string, args: Record<string, unknown>) => rpc(fn, args),
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
const auth: AuthContextValue = {
  isAuthenticated: true,
  isLoading: false,
  signOut: () => Promise.resolve(),
  user: {
    id: "t1",
    username: "rana",
    fullName: "Rana Teacher",
    role: "teacher",
    adminLevel: null,
    status: "active",
    mustChangePassword: false,
  },
};

const row = (id: string, kind: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind,
  title: `Title ${id}`,
  body: `Body ${id}`,
  payload: {},
  link: null,
  priority: "normal",
  is_read: false,
  created_at: "2026-10-15T08:00:00Z",
  ...extra,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <SoundContext.Provider value={sound}>
          <ToastContext.Provider value={toast}>
            <MemoryRouter initialEntries={["/teacher/notifications"]}>
              <Routes>
                <Route path="/teacher/notifications" element={<NotificationsPage />} />
                <Route path="/teacher/grading/:id" element={<p>Grading screen</p>} />
              </Routes>
            </MemoryRouter>
          </ToastContext.Provider>
        </SoundContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("NotificationsPage (TC-28)", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ error: null });
    realtime = undefined;
    rows = [
      row("1", "submission_received", { payload: { submission_id: "sub-9" } }),
      row("2", "join_request", { payload: { class_id: "c1" } }),
      row("3", "admin_message", { is_read: true }),
    ];
  });

  it("shows the unread badge and filters by category", async () => {
    renderPage();
    expect(await screen.findByTestId("unread-badge")).toHaveTextContent("2 unread");
    await userEvent.click(screen.getByRole("button", { name: "Submissions" }));
    expect(screen.getByText("Title 1")).toBeInTheDocument();
    expect(screen.queryByText("Title 2")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "System notices" }));
    expect(screen.getByText("Title 3")).toBeInTheDocument();
  });

  it("opens the grading screen and marks the notification read on click", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Title 1/ }));
    expect(await screen.findByText("Grading screen")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("mark_notifications_read", { ids: ["1"] });
  });

  it("marks everything read", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Mark all as read/ }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("mark_notifications_read", { all: true }));
  });

  it("refreshes when a realtime event arrives", async () => {
    renderPage();
    await screen.findByText("Title 1");
    rows = [row("4", "submission_late"), ...rows];
    realtime?.();
    expect(await screen.findByText("Title 4")).toBeInTheDocument();
    expect(await screen.findByTestId("unread-badge")).toHaveTextContent("3 unread");
  });
});

describe("notification rules", () => {
  const base: NotificationRow = {
    id: "x",
    kind: "x",
    title: "t",
    body: "b",
    payload: {},
    link: null,
    priority: "normal",
    is_read: false,
    created_at: "2026-10-15T08:00:00Z",
  };

  it("categorizes event kinds", () => {
    expect(categorize("late_submission")).toBe("submissions");
    expect(categorize("student_joined_by_code")).toBe("class_requests");
    expect(categorize("admin_course_removed")).toBe("system");
    expect(categorize("streak_milestone")).toBeNull();
  });

  it("prefers an in-app link, ignores external ones, then falls back to the payload", () => {
    expect(destinationFor({ ...base, link: "/teacher/grading/7" })).toBe("/teacher/grading/7");
    expect(destinationFor({ ...base, link: "https://evil.example" })).toBeNull();
    expect(destinationFor({ ...base, link: "//evil.example" })).toBeNull();
    expect(destinationFor({ ...base, payload: { submission_id: "s1" } })).toBe(
      "/teacher/grading/s1",
    );
    expect(destinationFor({ ...base, kind: "join_request", payload: { class_id: "c1" } })).toBe(
      "/teacher/classes/c1/students",
    );
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/app/providers/auth-context";
import { ToastContext, type ToastContextValue } from "@/app/providers/toast-context";
import ProfilePage from "./index";

interface Result {
  data: unknown;
  error: { message: string; code?: string } | null;
}
const tables: Record<string, Result> = {};
const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];

function query(result: Result) {
  return Object.assign(Promise.resolve(result), { eq: () => query(result) });
}

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    from: (table: string) => ({ select: () => query(tables[table] ?? { data: [], error: null }) }),
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: null, error: null });
    },
  },
}));

const auth: AuthContextValue = {
  isAuthenticated: true,
  isLoading: false,
  signOut: () => Promise.resolve(),
  user: {
    id: "student-1",
    username: "sara",
    fullName: "Sara Ali",
    role: "student",
    adminLevel: null,
    status: "active",
    mustChangePassword: false,
  },
};
const toast: ToastContextValue = {
  show: vi.fn(() => "toast"),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
  toasts: [],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastContext.Provider value={toast}>
        <AuthContext.Provider value={auth}>
          <ProfilePage />
        </AuthContext.Provider>
      </ToastContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  rpcCalls.length = 0;
  tables.profiles = {
    data: [{ id: "student-1", username: "sara", display_name: "Sara Ali", avatar_url: null }],
    error: null,
  };
  tables.student_stats = {
    data: [{ total_xp: 700, current_level: 5, current_streak: 4, longest_streak: 12 }],
    error: null,
  };
  tables.lesson_progress = {
    data: [{ lesson_id: "l1" }, { lesson_id: "l2" }, { lesson_id: "l2" }],
    error: null,
  };
  tables.quiz_attempts = {
    data: [{ score_pct: 80 }, { score_pct: 90 }, { score_pct: null }],
    error: null,
  };
  tables.class_enrollments = {
    data: [{ classes: { name: "Grade 8A", grade_level: "8", is_archived: false } }],
    error: null,
  };
  tables.badge_definitions = {
    data: [
      {
        id: "b1",
        name: "On a Roll",
        description: "Keep a streak.",
        icon_url: null,
        category: "streak",
      },
      { id: "b2", name: "Quiz Star", description: "Ace a quiz.", icon_url: null, category: "quiz" },
      {
        id: "b3",
        name: "Bookworm",
        description: "Finish lessons.",
        icon_url: null,
        category: "learning",
      },
      {
        id: "b4",
        name: "Newcomer",
        description: "Start learning.",
        icon_url: null,
        category: "learning",
      },
    ],
    error: null,
  };
  tables.user_badges = {
    data: [
      { badge_id: "b1", awarded_at: "2026-10-01T10:00:00Z", is_pinned: true },
      { badge_id: "b2", awarded_at: "2026-10-02T10:00:00Z", is_pinned: false },
      { badge_id: "b3", awarded_at: "2026-10-03T10:00:00Z", is_pinned: true },
      { badge_id: "b4", awarded_at: "2026-10-04T10:00:00Z", is_pinned: true },
    ],
    error: null,
  };
});

describe("ProfilePage", () => {
  it("shows student identity and lifetime learning stats from saved records", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "My profile" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sara Ali" })).toBeInTheDocument();
    expect(screen.getByText("Grade 8")).toBeInTheDocument();
    expect(screen.getByTestId("stat-total-xp")).toHaveTextContent("700");
    expect(screen.getByTestId("stat-lessons-completed")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-quiz-average")).toHaveTextContent("85%");
    expect(screen.getByTestId("stat-longest-streak")).toHaveTextContent("12");
  });

  it("shows up to three pinned badges with tooltip descriptions", async () => {
    renderPage();
    const list = await screen.findByRole("list", { name: "Pinned badges" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(
      within(list).getByRole("button", { name: /On a Roll: Keep a streak/ }),
    ).toBeInTheDocument();
    expect(
      within(list).getByRole("button", { name: /Bookworm: Finish lessons/ }),
    ).toBeInTheDocument();
  });

  it("lets the student choose earned badges and saves pins through the server RPC", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Change pinned badges" }));
    const dialog = await screen.findByRole("dialog", { name: "Change pinned badges" });
    const badgeList = within(dialog).getByRole("list", { name: "Earned badges to pin" });
    await user.click(within(badgeList).getByRole("button", { name: /On a Roll/ }));
    await user.click(within(badgeList).getByRole("button", { name: /Quiz Star/ }));
    await user.click(within(dialog).getByRole("button", { name: "Save badges (2/3)" }));
    expect(rpcCalls).toContainEqual({
      name: "pin_badges",
      args: { student_id: "student-1", badge_ids: ["b3", "b2"] },
    });
  });

  it("shows a clear empty quiz state instead of inventing an average", async () => {
    tables.quiz_attempts = { data: [{ score_pct: null }], error: null };
    renderPage();
    expect(await screen.findByTestId("stat-quiz-average")).toHaveTextContent("—");
    expect(screen.getByTestId("stat-quiz-average")).toHaveTextContent(
      "Complete a quiz to see your average",
    );
  });

  it("shows a retryable error when profile records fail to load", async () => {
    tables.profiles = { data: null, error: { message: "profile query failed" } };
    renderPage();
    expect(await screen.findByText("Your profile could not load")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});

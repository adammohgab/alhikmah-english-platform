import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/app/providers/auth-context";
import { ToastContext, type ToastContextValue } from "@/app/providers/toast-context";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import AchievementsPage from "./index";

interface Result {
  data: unknown;
  error: { message: string } | null;
}

const tables: Record<string, Result> = {};
const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];

function chain(result: Result) {
  return Object.assign(Promise.resolve(result), { eq: () => chain(result) });
}

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => chain(tables[table] ?? { data: [], error: null }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: { pinned: args["badge_ids"] }, error: null });
    },
  },
}));

const toast: ToastContextValue = {
  show: vi.fn(() => "toast"),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
  toasts: [],
};

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
    fullName: "Sara",
    role: "student",
    adminLevel: null,
    status: "active",
    mustChangePassword: false,
  },
};

const definitions = [
  {
    id: "b1",
    code: "on_a_roll",
    name: "On a Roll",
    description: "Keep a 3-day streak.",
    category: "streak",
    requirement_json: { days: 3, rarity: "common" },
  },
  {
    id: "b2",
    code: "week_warrior",
    name: "Week Warrior",
    description: "Keep a 7-day streak.",
    category: "streak",
    requirement_json: { days: 7, rarity: "rare" },
  },
  {
    id: "b3",
    code: "quiz_starter",
    name: "Quiz Starter",
    description: "Pass your first quiz.",
    category: "quiz",
    requirement_json: { count: 1 },
  },
  {
    id: "b4",
    code: "night_owl",
    name: "Night Owl",
    description: "Finish a lesson after 21:00.",
    category: "secret",
    requirement_json: { secret: true },
  },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <ToastContext.Provider value={toast}>
          <AuthContext.Provider value={auth}>
            <MemoryRouter>
              <AchievementsPage />
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastContext.Provider>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  rpcCalls.length = 0;
  tables["badge_definitions"] = { data: definitions, error: null };
  tables["user_badges"] = {
    data: [{ badge_id: "b1", awarded_at: "2026-10-01T10:00:00Z", is_pinned: false }],
    error: null,
  };
  tables["student_stats"] = { data: [{ total_xp: 500, current_streak: 5 }], error: null };
  tables["lesson_progress"] = { data: [], error: null };
});

describe("AchievementsPage", () => {
  it("shows how many badges are earned out of the catalog", async () => {
    renderPage();
    expect(await screen.findByTestId("earned-summary")).toHaveTextContent("1 of 4 badges earned");
  });

  it("shows earn dates, percent progress, locked and secret badges", async () => {
    renderPage();
    expect(
      await screen.findByRole("button", { name: "On a Roll, Earned Oct 1, 2026" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Week Warrior, 71% there" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Quiz Starter, Locked" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Secret badge, Locked" })).toBeVisible();
  });

  it("narrows the grid with the category tabs", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("list", { name: "Badges" });
    await user.click(screen.getByRole("tab", { name: "Quizzes" }));
    const list = screen.getByRole("list", { name: "Badges" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText("Quiz Starter")).toBeInTheDocument();
  });

  it("filters by status", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("list", { name: "Badges" });
    await user.click(screen.getByRole("button", { name: "Unlocked" }));
    const list = screen.getByRole("list", { name: "Badges" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });

  it("opens the badge dialog and pins an unlocked badge", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^On a Roll/ }));
    const dialog = await screen.findByRole("dialog", { name: "On a Roll" });
    expect(within(dialog).getByText("Keep a 3-day streak.")).toBeInTheDocument();
    expect(within(dialog).getByText("+20 XP")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Pin to Profile" }));
    await waitFor(() => expect(rpcCalls).toHaveLength(1));
    expect(rpcCalls[0]).toEqual({
      fn: "pin_badges",
      args: { student_id: "me", badge_ids: ["b1"] },
    });
  });

  it("shows progress and no pin button for a locked badge", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^Week Warrior/ }));
    const dialog = await screen.findByRole("dialog", { name: "Week Warrior" });
    expect(within(dialog).getByText("5 of 7 (71%)")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Pin/ })).toBeNull();
  });

  it("blocks a fourth pin", async () => {
    tables["badge_definitions"] = {
      data: [
        ...definitions,
        {
          id: "b5",
          code: "extra",
          name: "Extra",
          description: "Another one.",
          category: "xp",
          requirement_json: { threshold: 100 },
        },
      ],
      error: null,
    };
    tables["user_badges"] = {
      data: [
        { badge_id: "b1", awarded_at: "2026-10-01T10:00:00Z", is_pinned: true },
        { badge_id: "b2", awarded_at: "2026-10-02T10:00:00Z", is_pinned: true },
        { badge_id: "b3", awarded_at: "2026-10-03T10:00:00Z", is_pinned: true },
        { badge_id: "b5", awarded_at: "2026-10-04T10:00:00Z", is_pinned: false },
      ],
      error: null,
    };
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^Extra/ }));
    const dialog = await screen.findByRole("dialog", { name: "Extra" });
    expect(
      within(dialog).getByRole("button", { name: "Pin limit reached (3 of 3)" }),
    ).toBeDisabled();
  });

  it("shows a retry state when loading fails", async () => {
    tables["badge_definitions"] = { data: null, error: { message: "boom" } };
    renderPage();
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

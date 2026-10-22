import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/app/providers/auth-context";
import { ToastContext, type ToastContextValue } from "@/app/providers/toast-context";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import DashboardPage from "./index";

interface Result {
  data: unknown;
  error: { message: string } | null;
}

type Handler = (columns: string) => Result;

const handlers: Record<string, Handler> = {};
const rpcs: Record<string, () => Result> = {};

interface FakeQuery extends PromiseLike<Result> {
  eq: () => FakeQuery;
  in: () => FakeQuery;
  gte: () => FakeQuery;
  order: () => FakeQuery;
  limit: () => FakeQuery;
  maybeSingle: () => Promise<Result>;
}

function query(table: string, columns: string): FakeQuery {
  const run = (): Result => handlers[table]?.(columns) ?? { data: [], error: null };
  const self: FakeQuery = {
    eq: () => self,
    in: () => self,
    gte: () => self,
    order: () => self,
    limit: () => self,
    maybeSingle: () => Promise.resolve(run()),
    then: (onFulfilled, onRejected) => Promise.resolve(run()).then(onFulfilled, onRejected),
  };
  return self;
}

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    from: (table: string) => ({ select: (columns: string) => query(table, columns) }),
    rpc: (fn: string) => Promise.resolve(rpcs[fn]?.() ?? { data: null, error: null }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: "me" } } } }),
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
    fullName: "Sara Ahmed",
    role: "student",
    adminLevel: null,
    status: "active",
    mustChangePassword: false,
  },
};

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <ToastContext.Provider value={toast}>
          <AuthContext.Provider value={auth}>
            <MemoryRouter initialEntries={["/student"]}>
              <Routes>
                <Route path="/student" element={<DashboardPage />} />
                <Route path="*" element={<Where />} />
              </Routes>
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastContext.Provider>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

const ok = (data: unknown): Result => ({ data, error: null });

const course = {
  id: "c1",
  title: "Grade 7 English",
  units: [
    {
      id: "u1",
      title: "Greetings",
      order_index: 1,
      lessons: [
        { id: "l1", title: "Hello", order_index: 1 },
        { id: "l2", title: "Introductions", order_index: 2 },
        { id: "l3", title: "Goodbye", order_index: 3 },
      ],
    },
  ],
};

beforeEach(() => {
  for (const key of Object.keys(handlers)) delete handlers[key];
  for (const key of Object.keys(rpcs)) delete rpcs[key];
  rpcs["my_deadlines"] = () => ok([]);
  handlers["profiles"] = () => ok({ display_name: "Sara Ahmed", avatar_url: null });
  handlers["student_stats"] = () =>
    ok({
      total_xp: 450,
      current_level: 3,
      current_coins: 75,
      current_streak: 4,
      streak_freeze_count: 1,
    });
  handlers["user_settings"] = () => ok({ user_id: "me", daily_goal: "regular" });
  handlers["xp_ledger"] = () => ok([{ amount: 50 }, { amount: 40 }]);
  handlers["courses"] = (columns) => (columns === "id" ? ok([{ id: "c1" }]) : ok(course));
  handlers["lesson_progress"] = (columns) =>
    columns.includes("lessons(")
      ? ok([
          {
            lesson_id: "l2",
            is_completed: false,
            lessons: { id: "l2", units: { course_id: "c1" } },
          },
          {
            lesson_id: "l1",
            is_completed: true,
            lessons: { id: "l1", units: { course_id: "c1" } },
          },
        ])
      : ok([{ lesson_id: "l1" }]);
});

describe("DashboardPage", () => {
  it("greets the student with their level badge and rank", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /^Good (morning|afternoon|evening), Sara$/,
      }),
    ).toBeVisible();
    expect(await screen.findByText("Level 3")).toBeVisible();
    expect(screen.getByText("Newcomer")).toBeVisible();
    expect(screen.getByRole("group", { name: "Coins: 75" })).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Level 3, 10 percent to level 4" }),
    ).toBeInTheDocument();
  });

  it("fills the daily XP bar in proportion to today's earnings", async () => {
    renderPage();
    const bar = await screen.findByRole("progressbar", { name: "Daily XP goal" });
    expect(bar).toHaveAttribute("aria-valuenow", "90");
    expect(bar).toHaveAttribute("aria-valuemax", "120");
    expect(bar).toHaveAttribute("aria-valuetext", "90 of 120 XP today");
    expect(screen.getByText("30 XP to go today.")).toBeVisible();
  });

  it("uses the goal chosen in settings", async () => {
    handlers["user_settings"] = () => ok({ user_id: "me", daily_goal: "serious" });
    renderPage();
    const bar = await screen.findByRole("progressbar", { name: "Daily XP goal" });
    expect(bar).toHaveAttribute("aria-valuemax", "240");
  });

  it("resumes the unfinished lesson with the right lesson link", async () => {
    const user = userEvent.setup();
    renderPage();
    const card = (await screen.findByRole("heading", { name: "Continue learning" })).closest(
      "section",
    );
    expect(card).not.toBeNull();
    const scope = within(card as HTMLElement);
    expect(await scope.findByText("Introductions")).toBeVisible();
    expect(scope.getByText("1 of 3 lessons done")).toBeVisible();
    await user.click(scope.getByRole("button", { name: "Resume" }));
    await waitFor(() =>
      expect(screen.getByTestId("where")).toHaveTextContent(
        "/student/courses/c1/units/u1/lessons/l2",
      ),
    );
  });

  it("offers the first lesson to a student with no progress", async () => {
    handlers["lesson_progress"] = () => ok([]);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Start your first lesson" }));
    await waitFor(() =>
      expect(screen.getByTestId("where")).toHaveTextContent(
        "/student/courses/c1/units/u1/lessons/l1",
      ),
    );
  });

  it("shows a retry when the lesson cannot load, without hiding the rest", async () => {
    handlers["courses"] = () => ({ data: null, error: { message: "boom" } });
    renderPage();
    expect(await screen.findByRole("button", { name: "Try again" })).toBeVisible();
    expect(await screen.findByRole("progressbar", { name: "Daily XP goal" })).toBeVisible();
  });

  it("shows the quests and deadlines widgets beside the main cards", async () => {
    rpcs["my_deadlines"] = () =>
      ok([
        {
          kind: "quiz",
          id: "q1",
          title: "Unit 1 Quiz",
          course: "Grade 7 English",
          due_at: new Date(Date.now() + 3 * 3_600_000).toISOString(),
          status: "not_started",
          action: "start",
          overdue: false,
        },
      ]);
    handlers["quest_instances"] = () =>
      ok([
        {
          id: "qi1",
          current_count: 1,
          is_completed: false,
          is_claimed: false,
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          quest_templates: {
            title: "Finish a lesson",
            description: null,
            quest_type: "daily",
            target_count: 3,
            xp_reward: 20,
            coin_reward: 5,
          },
        },
      ]);
    renderPage();
    expect(await screen.findByRole("heading", { name: "Daily quests" })).toBeVisible();
    expect(await screen.findByText("Finish a lesson")).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Upcoming deadlines" })).toBeVisible();
    expect(await screen.findByText("Unit 1 Quiz")).toBeVisible();
  });

  it("explains when no course is assigned", async () => {
    handlers["courses"] = () => ok([]);
    handlers["lesson_progress"] = () => ok([]);
    renderPage();
    expect(await screen.findByText(/No courses are assigned to you yet/)).toBeVisible();
  });
});

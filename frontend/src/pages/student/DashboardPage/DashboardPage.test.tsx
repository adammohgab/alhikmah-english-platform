import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/app/providers/auth-context";
import { ToastProvider } from "@/app/providers/ToastProvider";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import DashboardPage from "./index";

interface Result {
  data: unknown;
  error: { message: string } | null;
}

type Handler = (columns: string) => Result;

const handlers: Record<string, Handler> = {};

type RpcHandler = (args: Record<string, unknown>) => Result;

const rpcHandlers: Record<string, RpcHandler> = {};
const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

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
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcHandlers[fn]?.(args) ?? { data: [], error: null });
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: "me" } } } }),
    },
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
        <AuthContext.Provider value={auth}>
          <ToastProvider>
            <MemoryRouter initialEntries={["/student"]}>
              <Routes>
                <Route path="/student" element={<DashboardPage />} />
                <Route path="*" element={<Where />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </AuthContext.Provider>
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

const HOUR = 3_600_000;
const inHours = (hours: number): string => new Date(Date.now() + hours * HOUR).toISOString();

const quest = (id: string, title: string, count: number, target: number, extra = {}) => ({
  id,
  current_count: count,
  is_completed: count >= target,
  is_claimed: false,
  expires_at: inHours(10),
  quest_templates: {
    title,
    description: null,
    quest_type: "daily",
    target_count: target,
    xp_reward: 30,
    coin_reward: 10,
  },
  ...extra,
});

beforeEach(() => {
  for (const key of Object.keys(handlers)) delete handlers[key];
  for (const key of Object.keys(rpcHandlers)) delete rpcHandlers[key];
  rpcCalls.length = 0;
  rpcHandlers["generate_daily_quests"] = () => ok({ instance_ids: [] });
  rpcHandlers["my_deadlines"] = () => ok([]);
  handlers["quest_instances"] = () => ok([]);
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
    const scope = within(card!);
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

  it("explains when no course is assigned", async () => {
    handlers["courses"] = () => ok([]);
    handlers["lesson_progress"] = () => ok([]);
    renderPage();
    expect(await screen.findByText(/No courses are assigned to you yet/)).toBeVisible();
  });

  describe("deadlines widget", () => {
    const deadlines = () =>
      ok([
        {
          kind: "assignment",
          id: "a-later",
          title: "Essay: My Town",
          course: "Grade 7A",
          due_at: inHours(72),
          status: "not_started",
          action: "start",
          overdue: false,
        },
        {
          kind: "quiz",
          id: "q-soon",
          title: "Unit 2 Quiz",
          course: "Grade 7A",
          due_at: inHours(5),
          status: "in_progress",
          action: "continue",
          overdue: false,
        },
        {
          kind: "assignment",
          id: "a-late",
          title: "Homework: Verbs",
          course: "Grade 7A",
          due_at: inHours(-2),
          status: "not_started",
          action: "start",
          overdue: true,
        },
      ]);

    it("asks for 5 deadlines and lists them soonest first, overdue on top", async () => {
      rpcHandlers["my_deadlines"] = deadlines;
      renderPage();
      const heading = await screen.findByRole("heading", { name: "Upcoming deadlines" });
      const scope = within(heading.closest("section")!);
      const links = await scope.findAllByRole("link", { name: /Verbs|Unit 2 Quiz|My Town/ });
      expect(links.map((link) => link.textContent)).toEqual([
        expect.stringContaining("Homework: Verbs"),
        expect.stringContaining("Unit 2 Quiz"),
        expect.stringContaining("Essay: My Town"),
      ]);
      expect(rpcCalls.find((call) => call.fn === "my_deadlines")?.args).toEqual({ limit: 5 });
    });

    it("marks overdue items in the danger color and items due within 24 hours with a clock tag", async () => {
      rpcHandlers["my_deadlines"] = deadlines;
      renderPage();
      const late = await screen.findByRole("link", { name: /Homework: Verbs/ });
      expect(late).toHaveClass("border-danger-600");
      expect(within(late).getByText("Homework: Verbs")).toHaveClass("text-danger-600");
      expect(within(late).getByText(/^Overdue by 2h/)).toBeVisible();

      const soon = await screen.findByRole("link", { name: /Unit 2 Quiz/ });
      expect(soon).not.toHaveClass("border-danger-600");
      expect(within(soon).getByText(/^Due in 4h|^Due in 5h/)).toBeVisible();
      expect(soon.querySelector(".animate-ping")).not.toBeNull();
      expect(within(soon).getByText("Continue")).toBeVisible();

      const later = await screen.findByRole("link", { name: /Essay: My Town/ });
      expect(later.querySelector(".animate-ping")).toBeNull();
      expect(within(later).getByText("Start")).toBeVisible();
    });

    it("opens the quiz start page and the assignment page from a deadline", async () => {
      rpcHandlers["my_deadlines"] = deadlines;
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("link", { name: /Unit 2 Quiz/ }));
      await waitFor(() =>
        expect(screen.getByTestId("where")).toHaveTextContent("/student/quizzes/q-soon"),
      );
    });

    it("opens an assignment's page", async () => {
      rpcHandlers["my_deadlines"] = deadlines;
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("link", { name: /Homework: Verbs/ }));
      await waitFor(() =>
        expect(screen.getByTestId("where")).toHaveTextContent("/student/assignments/a-late"),
      );
    });

    it("says nothing is due when the list is empty", async () => {
      renderPage();
      expect(await screen.findByText("Nothing due")).toBeVisible();
    });

    it("shows a retry for deadlines without hiding the rest of the page", async () => {
      rpcHandlers["my_deadlines"] = () => ({ data: null, error: { message: "boom" } });
      renderPage();
      expect(await screen.findByText(/Your deadlines could not load/)).toBeVisible();
      expect(await screen.findByRole("progressbar", { name: "Daily XP goal" })).toBeVisible();
    });
  });

  describe("quests widget", () => {
    it("shows 3 daily quests with the live counters from the database", async () => {
      handlers["quest_instances"] = () =>
        ok([
          quest("q1", "Finish a lesson", 1, 1),
          quest("q2", "Earn 50 XP", 20, 50),
          quest("q3", "Play a game", 0, 2),
          quest("q4", "A fourth quest", 0, 1),
        ]);
      renderPage();
      const heading = await screen.findByRole("heading", { name: "Daily quests" });
      const scope = within(heading.closest("section")!);
      expect(await scope.findByText("Finish a lesson")).toBeVisible();
      expect(scope.queryByText("A fourth quest")).toBeNull();
      expect(scope.getByRole("progressbar", { name: "Earn 50 XP" })).toHaveAttribute(
        "aria-valuenow",
        "20",
      );
      expect(scope.getByText("20 / 50")).toBeVisible();
      expect(scope.getByText("0 of 3 claimed today")).toBeVisible();
    });

    it("claims a finished quest with the quick-claim button", async () => {
      handlers["quest_instances"] = () =>
        ok([quest("q1", "Finish a lesson", 1, 1), quest("q2", "Earn 50 XP", 20, 50)]);
      rpcHandlers["claim_quest_reward"] = () =>
        ok({ xp: 30, coins: 10, streak_freeze_awarded: false });
      const user = userEvent.setup();
      renderPage();
      const claim = await screen.findByRole("button", { name: "Claim reward for Finish a lesson" });
      expect(screen.getByRole("button", { name: "Earn 50 XP: keep going" })).toBeDisabled();
      await user.click(claim);
      await waitFor(() =>
        expect(rpcCalls.find((call) => call.fn === "claim_quest_reward")?.args).toEqual({
          instance_id: "q1",
        }),
      );
    });

    it("shows a claimed quest as claimed and cannot claim it again", async () => {
      handlers["quest_instances"] = () =>
        ok([quest("q1", "Finish a lesson", 1, 1, { is_claimed: true })]);
      renderPage();
      expect(
        await screen.findByRole("button", { name: "Finish a lesson: claimed" }),
      ).toBeDisabled();
      expect(screen.getByText("1 of 1 claimed today")).toBeVisible();
    });

    it("shows a retry for quests without hiding the rest of the page", async () => {
      rpcHandlers["generate_daily_quests"] = () => ({ data: null, error: { message: "boom" } });
      renderPage();
      expect(await screen.findByText(/Your quests could not load/)).toBeVisible();
      expect(await screen.findByRole("progressbar", { name: "Daily XP goal" })).toBeVisible();
    });
  });
});

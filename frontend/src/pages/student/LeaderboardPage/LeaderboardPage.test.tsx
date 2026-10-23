import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/app/providers/auth-context";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import LeaderboardPage from "./index";

interface Result {
  data: unknown;
  error: { message: string } | null;
}

const enrollments: { current: Result } = { current: { data: [], error: null } };
const boards: Record<string, Result> = {};
const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];

function chain(result: Result) {
  const promise = Promise.resolve(result);
  return Object.assign(promise, { eq: () => chain(result) });
}

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    from: () => ({ select: () => chain(enrollments.current) }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      const key = `${String(args["class_id"])}:${String(args["timeframe"])}`;
      return Promise.resolve(boards[key] ?? { data: null, error: { message: "no board" } });
    },
  },
}));

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
const sound: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

function entry(rank: number, id: string, name: string, xp: number) {
  return {
    rank,
    student_id: id,
    display_name: name,
    avatar_url: null,
    equipped_badge: null,
    xp,
  };
}

function boardOf(entries: ReturnType<typeof entry>[], timeframe: string) {
  return { data: { class_id: "c1", timeframe, my_rank: null, entries }, error: null };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <AuthContext.Provider value={auth}>
          <MemoryRouter>
            <LeaderboardPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

const weekEntries = [
  entry(1, "u1", "Layla", 900),
  entry(2, "u2", "Omar", 700),
  entry(3, "u3", "Huda", 650),
  entry(4, "u4", "Karim", 500),
  entry(5, "me", "Sara", 420),
];

beforeEach(() => {
  rpcCalls.length = 0;
  enrollments.current = {
    data: [{ class_id: "c1", classes: { name: "Grade 8A", grade_level: "8", is_archived: false } }],
    error: null,
  };
  for (const key of Object.keys(boards)) delete boards[key];
  boards["c1:week"] = boardOf(weekEntries, "week");
  boards["c1:month"] = boardOf(
    [entry(1, "me", "Sara", 2000), entry(2, "u1", "Layla", 1800)],
    "month",
  );
  boards["c1:all_time"] = boardOf(weekEntries, "all_time");
});

describe("LeaderboardPage", () => {
  it("renders the podium with medals and the ranked list", async () => {
    renderPage();
    const first = await screen.findByTestId("podium-1");
    expect(within(first).getByText("Layla")).toBeInTheDocument();
    expect(within(first).getByText(/gold medal/i)).toBeInTheDocument();
    expect(within(screen.getByTestId("podium-2")).getByText(/silver medal/i)).toBeInTheDocument();
    expect(within(screen.getByTestId("podium-3")).getByText(/bronze medal/i)).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "Ranking" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText("Karim")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Sara")).toBeInTheDocument();
  });

  it("asks for this week first and pins the student's standing", async () => {
    renderPage();
    const bar = await screen.findByTestId("my-rank-bar");
    expect(rpcCalls[0]).toEqual({
      fn: "get_leaderboard",
      args: { class_id: "c1", timeframe: "week" },
    });
    expect(bar).toHaveTextContent("You are 5th with 420 XP");
    expect(screen.getByTestId("rank-message")).toHaveTextContent("81 XP to pass Karim");
    expect(screen.getByTestId("my-row")).toHaveAttribute("aria-current", "true");
  });

  it("switches period and reloads the board", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("my-rank-bar");

    await user.click(screen.getByRole("tab", { name: "This Month" }));
    expect(await screen.findByText("You are 1st with 2,000 XP")).toBeInTheDocument();
    expect(screen.getByTestId("rank-message")).toHaveTextContent("You lead by 200 XP");
    expect(rpcCalls[rpcCalls.length - 1]?.args["timeframe"]).toBe("month");
  });

  it("tells the student when names are hidden", async () => {
    boards["c1:week"] = boardOf(
      [entry(1, "u1", "Student 1", 900), entry(2, "me", "Sara", 700)],
      "week",
    );
    renderPage();
    expect(await screen.findByText(/names are hidden on this board/i)).toBeInTheDocument();
  });

  it("explains when the student is not in a class", async () => {
    enrollments.current = { data: [], error: null };
    renderPage();
    expect(await screen.findByText("You are not in a class yet")).toBeInTheDocument();
    expect(rpcCalls).toHaveLength(0);
  });

  it("shows an error with a retry when the board fails", async () => {
    boards["c1:week"] = { data: null, error: { message: "boom" } };
    renderPage();
    expect(await screen.findByText("The leaderboard could not load")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});

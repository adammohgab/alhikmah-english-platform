import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/app/providers/auth-context";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import GamesHubPage from "./index";

interface Result {
  data: unknown;
  error: { message: string } | null;
}

const tables: Record<string, Result> = {};

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => Promise.resolve(tables[table] ?? { data: [], error: null }),
      }),
    }),
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
    id: "student-1",
    username: "sara",
    fullName: "Sara",
    role: "student",
    adminLevel: null,
    status: "active",
    mustChangePassword: false,
  },
};

const games = [
  {
    id: "g1",
    slug: "vocabulary-match",
    title: "Vocabulary Match",
    description: "Pair words with meanings.",
  },
  {
    id: "g2",
    slug: "grammar-challenge",
    title: "Grammar Challenge",
    description: "Choose the right form.",
  },
  { id: "g3", slug: "timed-quiz", title: "Timed Quiz", description: "Race the clock." },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <AuthContext.Provider value={auth}>
          <MemoryRouter>
            <GamesHubPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

/** The game grid is a <ul> whose tiles are nested lists of skill chips, so count direct children. */
function gameCards(list: HTMLElement): HTMLElement[] {
  return Array.from(list.children).filter((child): child is HTMLElement => child.tagName === "LI");
}

beforeEach(() => {
  tables["games"] = { data: games, error: null };
  tables["game_daily_featured"] = {
    data: [{ game_id: "g2", bonus_multiplier: 1.5 }],
    error: null,
  };
  tables["game_sessions"] = {
    data: [
      { game_id: "g1", score: 1240, played_at: new Date().toISOString() },
      { game_id: "g1", score: 800, played_at: "2020-01-01T00:00:00Z" },
    ],
    error: null,
  };
});

describe("GamesHubPage", () => {
  it("highlights today's featured game with the animated bonus badge", async () => {
    renderPage();
    const banner = await screen.findByRole("region", { name: "Grammar Challenge" });
    expect(within(banner).getByText("Daily featured game")).toBeInTheDocument();
    expect(within(banner).getByTestId("bonus-badge")).toHaveTextContent("1.5x XP");
    expect(within(banner).getByTestId("bonus-badge")).toHaveClass("games-hub-bonus");
  });

  it("shows the personal best on every game card and today's plays", async () => {
    renderPage();
    const list = await screen.findByRole("list", { name: "Games" });
    const cards = gameCards(list);
    expect(cards).toHaveLength(3);
    expect(within(cards[0]!).getByText("1,240")).toBeInTheDocument();
    expect(within(cards[1]!).getByText("Not played yet")).toBeInTheDocument();
    expect(screen.getByTestId("daily-play")).toHaveTextContent("1 game today");
  });

  it("links each game to its game screen", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: "Play Timed Quiz" });
    expect(link).toHaveAttribute("href", "/student/games/timed-quiz/play");
  });

  it("filters the grid by skill", async () => {
    const user = userEvent.setup();
    renderPage();
    const list = await screen.findByRole("list", { name: "Games" });
    await user.click(screen.getByRole("button", { name: "Speed" }));
    expect(gameCards(list)).toHaveLength(1);
    expect(within(list).getByRole("heading", { name: "Timed Quiz" })).toBeInTheDocument();
    expect(within(list).queryByRole("heading", { name: "Vocabulary Match" })).toBeNull();
  });

  it("shows a retry state when loading fails", async () => {
    tables["games"] = { data: null, error: { message: "boom" } };
    renderPage();
    expect(await screen.findByText("The arcade could not open")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows an empty state when the catalog has no games", async () => {
    tables["games"] = { data: [], error: null };
    tables["game_daily_featured"] = { data: [], error: null };
    renderPage();
    expect(await screen.findByText("The arcade is closed for now")).toBeInTheDocument();
  });
});

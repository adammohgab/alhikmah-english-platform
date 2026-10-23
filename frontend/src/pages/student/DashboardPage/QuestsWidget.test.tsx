import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastContext, type ToastContextValue } from "@/app/providers/toast-context";
import { QuestsWidget } from "./QuestsWidget";

interface Reply {
  data: unknown;
  error: { message: string } | null;
}

const rpc = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    rpc,
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: "me" } } } }) },
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: state.rows, error: null } satisfies Reply),
      }),
    }),
  },
}));

const show = vi.fn(() => "toast");
const toast: ToastContextValue = { show, dismiss: vi.fn(), dismissAll: vi.fn(), toasts: [] };

function instance(
  id: string,
  title: string,
  count: number,
  flags: { done?: boolean; claimed?: boolean } = {},
) {
  return {
    id,
    current_count: count,
    is_completed: flags.done ?? false,
    is_claimed: flags.claimed ?? false,
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    quest_templates: {
      title,
      description: null,
      quest_type: "daily",
      target_count: 3,
      xp_reward: 20,
      coin_reward: 5,
    },
  };
}

function renderWidget() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastContext.Provider value={toast}>
        <MemoryRouter>
          <QuestsWidget />
        </MemoryRouter>
      </ToastContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  show.mockClear();
  rpc.mockReset();
  rpc.mockImplementation((fn: string) =>
    Promise.resolve(
      fn === "claim_quest_reward"
        ? { data: { xp: 20, coins: 5, streak_freeze_awarded: false }, error: null }
        : { data: null, error: null },
    ),
  );
  state.rows = [
    instance("qi1", "Finish a lesson", 3, { done: true }),
    instance("qi2", "Play a game", 1),
    instance("qi3", "Review words", 3, { done: true, claimed: true }),
  ];
});

describe("QuestsWidget", () => {
  it("shows the three daily quests with their live progress counters", async () => {
    renderWidget();
    expect(await screen.findByText("Finish a lesson")).toBeVisible();
    expect(screen.getByText("Play a game")).toBeVisible();
    expect(screen.getAllByText("3/3")).toHaveLength(2);
    expect(screen.getByText("1/3")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Play a game progress" })).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    expect(screen.getByText("1 of 3 claimed")).toBeVisible();
  });

  it("offers a quick claim only on a completed, unclaimed quest", async () => {
    renderWidget();
    await screen.findByText("Finish a lesson");
    expect(screen.getAllByRole("button", { name: /Claim reward/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Claim reward: Finish a lesson" })).toBeVisible();
    expect(screen.getByText("Claimed")).toBeVisible();
  });

  it("claims through the database and marks the quest claimed", async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn !== "claim_quest_reward") return Promise.resolve({ data: null, error: null });
      // The database now holds the quest as claimed, so the follow-up refetch agrees.
      state.rows = [
        instance("qi1", "Finish a lesson", 3, { done: true, claimed: true }),
        ...state.rows.slice(1),
      ];
      return Promise.resolve({
        data: { xp: 20, coins: 5, streak_freeze_awarded: false },
        error: null,
      });
    });
    const user = userEvent.setup();
    renderWidget();
    await user.click(await screen.findByRole("button", { name: "Claim reward: Finish a lesson" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("claim_quest_reward", { instance_id: "qi1" }),
    );
    await waitFor(() =>
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ type: "reward", description: "+20 XP, +5 coins" }),
      ),
    );
    const row = screen.getByText("Finish a lesson").closest("li") as HTMLElement;
    await waitFor(() => expect(within(row).getByText("Claimed")).toBeVisible());
  });

  it("explains a failed claim", async () => {
    rpc.mockImplementation((fn: string) =>
      Promise.resolve(
        fn === "claim_quest_reward"
          ? { data: null, error: { message: "Quest has expired" } }
          : { data: null, error: null },
      ),
    );
    const user = userEvent.setup();
    renderWidget();
    await user.click(await screen.findByRole("button", { name: "Claim reward: Finish a lesson" }));
    await waitFor(() =>
      expect(show).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error", description: "This quest has expired." }),
      ),
    );
  });

  it("links to all quests", async () => {
    renderWidget();
    expect(await screen.findByRole("link", { name: "All quests" })).toHaveAttribute(
      "href",
      "/student/quests",
    );
  });

  it("says so when there are no quests today", async () => {
    state.rows = [];
    renderWidget();
    expect(await screen.findByText("No quests today")).toBeVisible();
  });

  it("offers a retry when the quests cannot load", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    renderWidget();
    expect(await screen.findByRole("button", { name: "Try again" })).toBeVisible();
  });
});

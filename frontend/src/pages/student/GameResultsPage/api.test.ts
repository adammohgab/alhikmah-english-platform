import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordGameResult } from "./api";

const { supabaseMock, queryCalls } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn(), rpc: vi.fn() },
  queryCalls: [] as Array<{ table: string; column: string; value: string | boolean }>,
}));

vi.mock("@/shared/api/supabase", () => ({ supabase: supabaseMock }));

const result = {
  score: 120,
  accuracy: 75,
  durationSeconds: 60,
  correctAnswers: 3,
  totalQuestions: 4,
};

function query(data: unknown, error: { message: string; code?: string } | null = null) {
  const builder = {
    eq: vi.fn((column: string, value: string | boolean) => {
      queryCalls.push({ table: currentTable, column, value });
      return builder;
    }),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: (resolve: (value: { data: unknown; error: typeof error }) => unknown) =>
      Promise.resolve({ data, error }).then(resolve),
  };
  return builder;
}

let currentTable = "";

beforeEach(() => {
  vi.clearAllMocks();
  queryCalls.length = 0;
  supabaseMock.from.mockImplementation((table: string) => {
    currentTable = table;
    const data = table === "games" ? { id: "game-1", title: "Word Builder" } : { score: 90 };
    return { select: vi.fn(() => query(data)) };
  });
  supabaseMock.rpc.mockResolvedValue({
    data: {
      session_id: "session-1",
      score: result.score,
      accuracy: result.accuracy,
      xp_awarded: 12,
      coins_awarded: 5,
      featured_multiplier: 1,
    },
    error: null,
  });
});

describe("recordGameResult", () => {
  it("reads the signed-in student's best and saves through the deployed RPC contract", async () => {
    const recorded = await recordGameResult("word-builder", "student-1", result);

    expect(queryCalls).toContainEqual({
      table: "game_sessions",
      column: "student_id",
      value: "student-1",
    });
    expect(supabaseMock.rpc).toHaveBeenCalledWith("record_game_session", {
      game_slug: "word-builder",
      score: 120,
      accuracy: 75,
      duration: 60,
    });
    expect(recorded).toEqual({
      gameTitle: "Word Builder",
      previousBest: 90,
      sessionId: "session-1",
      score: 120,
      accuracy: 75,
      xpAwarded: 12,
      coinsAwarded: 5,
    });
  });

  it("surfaces RPC errors instead of presenting a saved result", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: "Please wait before submitting another game result" },
    });

    await expect(recordGameResult("word-builder", "student-1", result)).rejects.toThrow(
      "Please wait before submitting another game result",
    );
  });

  it("rejects an unexpected reward response", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { session_id: "session-1" }, error: null });

    await expect(recordGameResult("word-builder", "student-1", result)).rejects.toThrow(
      "incomplete reward details",
    );
  });
});

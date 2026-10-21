import { z } from "zod";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import { supabase } from "@/shared/api/supabase";
import type { GameResultInput } from "./rules";

const gameRowSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
});

const personalBestRowSchema = z.object({
  score: z.coerce.number().int().nonnegative(),
});

const recordedResultSchema = z
  .object({
    session_id: z.string().min(1),
    score: z.coerce.number().int().nonnegative(),
    accuracy: z.coerce.number().finite().min(0).max(100),
    xp_awarded: z.coerce.number().int().nonnegative(),
    coins_awarded: z.coerce.number().int().nonnegative(),
  })
  .passthrough();

interface DbResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface QueryBuilder extends PromiseLike<DbResult> {
  eq(column: string, value: string | boolean): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  limit(count: number): QueryBuilder;
  maybeSingle(): PromiseLike<DbResult>;
}

interface GameResultsClient {
  from(table: string): { select(columns: string): QueryBuilder };
  rpc(functionName: string, args: Record<string, unknown>): PromiseLike<DbResult>;
}

const client = (): GameResultsClient => supabase as unknown as GameResultsClient;

function throwIfError(error: DbResult["error"]): void {
  if (error) throw new Error(normalizeApiError(error).message);
}

export interface RecordedGameResult {
  gameTitle: string;
  previousBest: number;
  sessionId: string;
  score: number;
  accuracy: number;
  xpAwarded: number;
  coinsAwarded: number;
}

export async function recordGameResult(
  gameSlug: string,
  studentId: string,
  result: GameResultInput,
): Promise<RecordedGameResult> {
  if (!gameSlug.trim()) throw new Error("This game result is missing a game ID.");
  if (!studentId.trim()) throw new Error("Your session has ended. Please sign in again.");

  const gameResponse = await client()
    .from("games")
    .select("id, title")
    .eq("slug", gameSlug)
    .eq("is_active", true)
    .maybeSingle();
  throwIfError(gameResponse.error);
  const game = gameRowSchema.safeParse(gameResponse.data);
  if (!game.success) throw new Error("This game is not available right now.");

  const bestResponse = await client()
    .from("game_sessions")
    .select("score")
    .eq("game_id", game.data.id)
    .eq("student_id", studentId)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(bestResponse.error);

  let previousBest = 0;
  if (bestResponse.data !== null) {
    const best = personalBestRowSchema.safeParse(bestResponse.data);
    if (!best.success)
      throw new Error("Your previous best score came back in an unexpected shape.");
    previousBest = best.data.score;
  }

  const rpcResponse = await client().rpc("record_game_session", {
    game_slug: gameSlug,
    score: result.score,
    accuracy: result.accuracy,
    duration: result.durationSeconds,
  });
  throwIfError(rpcResponse.error);

  const recordedResult = recordedResultSchema.safeParse(rpcResponse.data);
  if (!recordedResult.success) {
    throw new Error("The game was submitted, but the server returned incomplete reward details.");
  }

  return {
    gameTitle: game.data.title,
    previousBest,
    sessionId: recordedResult.data.session_id,
    score: recordedResult.data.score,
    accuracy: recordedResult.data.accuracy,
    xpAwarded: recordedResult.data.xp_awarded,
    coinsAwarded: recordedResult.data.coins_awarded,
  };
}

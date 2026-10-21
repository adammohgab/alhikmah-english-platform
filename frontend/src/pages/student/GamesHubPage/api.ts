import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Games hub data layer (STUDENT-SPEC ST-21, ECONOMY-AND-GAMES §9)
   Reads the minigame catalog (`games`), today's featured game (`game_daily_featured`) and the
   signed-in student's own sessions (`game_sessions`, RLS limits it to their rows). The
   personal best of a game is the highest score among those sessions. Results are validated
   with zod; the generated Database type does not describe the games tables yet.
   ======================================== */

export const GAMES_HUB_KEY = "student-games-hub";

const gameRow = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  icon_url: z.string().nullish(),
});

const featuredRow = z.object({
  game_id: z.string(),
  bonus_multiplier: z.coerce.number().positive().nullish(),
});

const sessionRow = z.object({
  game_id: z.string(),
  score: z.number(),
  played_at: z.string().nullish(),
});

export type GameRow = z.infer<typeof gameRow>;
export type FeaturedRow = z.infer<typeof featuredRow>;
export type SessionRow = z.infer<typeof sessionRow>;

export interface GamesHubData {
  games: GameRow[];
  featured: FeaturedRow | null;
  sessions: SessionRow[];
}

interface DbError {
  message: string;
  code?: string;
}

interface Filterable extends PromiseLike<{ data: unknown; error: DbError | null }> {
  eq(column: string, value: string | boolean): Filterable;
}

interface LooseClient {
  from(table: string): { select(columns: string): Filterable };
}

async function load<T>(request: Filterable, schema: z.ZodType<T>, what: string): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${what} came back in an unexpected shape.`);
  return parsed.data;
}

/**
 * Loads everything the hub shows in one round trip.
 * `today` is the UTC day key (YYYY-MM-DD), the same day boundary the server uses to apply the
 * featured-game bonus (`app_now()::date`).
 */
export async function fetchGamesHub(studentId: string, today: string): Promise<GamesHubData> {
  const client = supabase as unknown as LooseClient;
  const [games, featured, sessions] = await Promise.all([
    load(
      client.from("games").select("id, slug, title, description, icon_url").eq("is_active", true),
      z.array(gameRow),
      "The game list",
    ),
    load(
      client
        .from("game_daily_featured")
        .select("game_id, bonus_multiplier")
        .eq("featured_date", today),
      z.array(featuredRow),
      "Today's featured game",
    ),
    load(
      client.from("game_sessions").select("game_id, score, played_at").eq("student_id", studentId),
      z.array(sessionRow),
      "Your scores",
    ),
  ]);
  return { games, featured: featured[0] ?? null, sessions };
}

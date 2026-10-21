import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Quests data layer (STUDENT-SPEC ST-24, ECONOMY-AND-GAMES section 4)

   Today's daily quests are created on demand by `generate_daily_quests` (idempotent), then the
   student's own `quest_instances` are read with their template. Rewards are claimed with
   `claim_quest_reward`, which returns the XP and coins actually granted. The generated
   `Database` type does not describe these yet, so calls use a narrow signature and zod.
   ======================================== */

const questRow = z.object({
  id: z.string(),
  current_count: z.number().int().nonnegative(),
  is_completed: z.boolean(),
  is_claimed: z.boolean(),
  expires_at: z.string().nullable(),
  quest_templates: z.object({
    title: z.string(),
    description: z.string().nullable(),
    quest_type: z.enum(["daily", "weekly"]),
    target_count: z.number().int().positive(),
    xp_reward: z.number().int().nonnegative(),
    coin_reward: z.number().int().nonnegative(),
  }),
});

const claimResult = z.object({
  xp: z.number().int().nonnegative(),
  coins: z.number().int().nonnegative(),
  streak_freeze_awarded: z.boolean(),
});

export type QuestState = "active" | "ready" | "claimed";

export interface Quest {
  id: string;
  title: string;
  description: string | null;
  kind: "daily" | "weekly";
  progress: number;
  target: number;
  xp: number;
  coins: number;
  state: QuestState;
  expiresAt: string | null;
}

export interface QuestBoard {
  daily: Quest[];
  weekly: Quest[];
}

export interface ClaimReward {
  xp: number;
  coins: number;
  freezeAwarded: boolean;
}

interface LooseResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface LooseQuery extends PromiseLike<LooseResult> {
  order: (column: string, options: { ascending: boolean }) => LooseQuery;
}

interface LooseClient {
  from: (table: string) => { select: (columns: string) => LooseQuery };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<LooseResult>;
}

const client = (): LooseClient => supabase as unknown as LooseClient;

function toQuest(row: z.infer<typeof questRow>): Quest {
  const template = row.quest_templates;
  const done = row.is_completed || row.current_count >= template.target_count;
  return {
    id: row.id,
    title: template.title,
    description: template.description,
    kind: template.quest_type,
    progress: Math.min(row.current_count, template.target_count),
    target: template.target_count,
    xp: template.xp_reward,
    coins: template.coin_reward,
    state: row.is_claimed ? "claimed" : done && row.is_completed ? "ready" : "active",
    expiresAt: row.expires_at,
  };
}

export async function fetchQuests(): Promise<QuestBoard> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("Your session has ended. Please sign in again.");

  const generated = await client().rpc("generate_daily_quests", { student_id: userId });
  if (generated.error) throw new Error(normalizeApiError(generated.error).message);

  const result = await client()
    .from("quest_instances")
    .select(
      "id, current_count, is_completed, is_claimed, expires_at, quest_templates(title, description, quest_type, target_count, xp_reward, coin_reward)",
    )
    .order("created_at", { ascending: true });
  if (result.error) throw new Error(normalizeApiError(result.error).message);

  const rows = z.array(questRow).parse(result.data);
  const now = Date.now();
  const live = rows.filter((row) => row.expires_at === null || Date.parse(row.expires_at) > now);
  const quests = live.map(toQuest);
  return {
    daily: quests.filter((quest) => quest.kind === "daily").slice(0, 3),
    weekly: quests.filter((quest) => quest.kind === "weekly").slice(0, 3),
  };
}

export async function claimQuest(questId: string): Promise<ClaimReward> {
  const result = await client().rpc("claim_quest_reward", { instance_id: questId });
  if (result.error) {
    const message = result.error.message;
    throw new Error(
      message === "Quest has expired"
        ? "This quest has expired."
        : message === "Quest is incomplete or already claimed"
          ? "This reward is not ready or was already claimed."
          : normalizeApiError(result.error).message,
    );
  }
  const parsed = claimResult.safeParse(result.data);
  if (!parsed.success) throw new Error("The reward was claimed but the reply was unexpected.");
  return {
    xp: parsed.data.xp,
    coins: parsed.data.coins,
    freezeAwarded: parsed.data.streak_freeze_awarded,
  };
}

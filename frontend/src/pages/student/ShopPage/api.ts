import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Shop data layer (STUDENT-SPEC ST-27, ECONOMY-AND-GAMES section 6)

   Reads `shop_items`, the student's own `user_inventory` rows and `student_stats` (coins, level),
   and buys through the `purchase_shop_item` RPC, which checks level and coins and deducts them
   in one transaction. Rows are parsed by zod so a schema drift shows a visible error instead of
   a blank shop. The generated `Database` type does not describe these tables yet, so calls go
   through a narrow explicit signature.
   ======================================== */

export type ShopTab = "themes" | "avatar" | "stickers" | "powerups" | "other";

export type Rarity = "common" | "rare" | "epic" | "legendary";

const itemRow = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  coin_price: z.number().int().nonnegative(),
  required_level: z.number().int().nullable(),
  asset_url: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

const inventoryRow = z.object({
  item_id: z.string(),
  is_equipped: z.boolean().nullable(),
});

const statsRow = z.object({
  current_coins: z.coerce.number().int().nonnegative(),
  current_level: z.number().int().positive(),
});

const purchaseResult = z.object({
  coins: z.object({ balance: z.coerce.number().int().nonnegative() }),
});

export interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  tab: ShopTab;
  price: number;
  requiredLevel: number;
  rarity: Rarity | null;
  assetUrl: string | null;
  /** The RPC can equip only themes and avatar items. */
  equippable: boolean;
}

export interface ShopSnapshot {
  items: ShopItem[];
  /** item id to equipped flag, for items the student owns. */
  owned: Record<string, boolean>;
  coins: number;
  level: number;
}

const TAB_BY_CATEGORY: Record<string, ShopTab> = {
  theme: "themes",
  themes: "themes",
  avatar: "avatar",
  avatar_item: "avatar",
  outfit: "avatar",
  accessory: "avatar",
  background: "avatar",
  sticker: "stickers",
  stickers: "stickers",
  sticker_pack: "stickers",
  power_up: "powerups",
  powerup: "powerups",
  power_ups: "powerups",
  streak_freeze: "powerups",
};

const RARITIES: readonly string[] = ["common", "rare", "epic", "legendary"];

function rarityOf(metadata: Record<string, unknown> | null): Rarity | null {
  const value = metadata?.["rarity"];
  return typeof value === "string" && RARITIES.includes(value) ? (value as Rarity) : null;
}

interface LoosePostgrest {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => PromiseLike<LooseResult>;
      maybeSingle: () => PromiseLike<LooseResult>;
    } & PromiseLike<LooseResult>;
  };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<LooseResult>;
}

interface LooseResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

const client = (): LoosePostgrest => supabase as unknown as LoosePostgrest;

function unwrap(result: LooseResult, what: string): unknown {
  if (result.error) throw new Error(normalizeApiError(result.error).message);
  if (result.data === null || result.data === undefined) {
    throw new Error(`${what} came back empty.`);
  }
  return result.data;
}

export async function fetchShop(): Promise<ShopSnapshot> {
  const [itemsResult, inventoryResult, statsResult] = await Promise.all([
    client()
      .from("shop_items")
      .select(
        "id, sku, name, description, category, coin_price, required_level, asset_url, metadata",
      )
      .eq("is_available", true),
    client().from("user_inventory").select("item_id, is_equipped"),
    client().from("student_stats").select("current_coins, current_level").maybeSingle(),
  ]);

  const rows = z.array(itemRow).parse(unwrap(itemsResult, "The shop"));
  const inventory = z.array(inventoryRow).parse(unwrap(inventoryResult, "Your inventory"));
  const stats = statsRow.parse(unwrap(statsResult, "Your balance"));

  const items = rows.map<ShopItem>((row) => {
    const tab = TAB_BY_CATEGORY[row.category.toLowerCase()] ?? "other";
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      tab,
      price: row.coin_price,
      requiredLevel: row.required_level ?? 1,
      rarity: rarityOf(row.metadata),
      assetUrl: row.asset_url,
      equippable: tab === "themes" || tab === "avatar",
    };
  });

  return {
    items,
    owned: Object.fromEntries(inventory.map((row) => [row.item_id, row.is_equipped === true])),
    coins: stats.current_coins,
    level: stats.current_level,
  };
}

/** Buys one item. Resolves with the new coin balance reported by the server. */
export async function purchaseItem(itemId: string): Promise<number> {
  const result = await client().rpc("purchase_shop_item", { item_id: itemId });
  if (result.error) {
    const message =
      result.error.message === "Insufficient coins"
        ? "You do not have enough coins for this item."
        : result.error.message === "Required level not reached"
          ? "You have not reached the level for this item yet."
          : result.error.message === "Item already owned"
            ? "You already own this item."
            : normalizeApiError(result.error).message;
    throw new Error(message);
  }
  const parsed = purchaseResult.safeParse(result.data);
  if (!parsed.success) throw new Error("The purchase went through but the reply was unexpected.");
  return parsed.data.coins.balance;
}

export async function equipItem(itemId: string): Promise<void> {
  const result = await client().rpc("equip_inventory_item", { item_id: itemId });
  if (result.error) throw new Error(normalizeApiError(result.error).message);
}

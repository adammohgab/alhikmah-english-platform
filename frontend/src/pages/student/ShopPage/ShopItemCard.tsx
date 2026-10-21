import { Coins, Lock } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import type { Rarity, ShopItem } from "./api";

/* One shop item: name, rarity tag, coin price, and a single clear action.
   The action is derived from the student's level and coins, so a button is never offered
   that the purchase RPC would refuse. */

const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export interface ShopItemCardProps {
  item: ShopItem;
  /** Present when the student owns the item. */
  owned: { equipped: boolean } | undefined;
  coins: number;
  level: number;
  busy: boolean;
  onBuy: (item: ShopItem) => void;
  onEquip: (item: ShopItem) => void;
}

export function ShopItemCard({
  item,
  owned,
  coins,
  level,
  busy,
  onBuy,
  onEquip,
}: ShopItemCardProps) {
  const levelLocked = level < item.requiredLevel;
  const missing = item.price - coins;

  let action;
  if (owned?.equipped) {
    action = (
      <Button variant="secondary" disabled className="w-full">
        Equipped
      </Button>
    );
  } else if (owned) {
    action = item.equippable ? (
      <Button variant="secondary" loading={busy} onClick={() => onEquip(item)} className="w-full">
        Equip
      </Button>
    ) : (
      <Button variant="secondary" disabled className="w-full">
        Owned
      </Button>
    );
  } else if (levelLocked) {
    action = (
      <Button disabled className="w-full">
        <Lock size={16} aria-hidden="true" />
        <span>Unlocks at level {item.requiredLevel}</span>
      </Button>
    );
  } else if (missing > 0) {
    action = (
      <Button disabled className="w-full">
        Need {missing} more {missing === 1 ? "coin" : "coins"}
      </Button>
    );
  } else {
    action = (
      <Button onClick={() => onBuy(item)} className="w-full">
        Buy
      </Button>
    );
  }

  return (
    <li className="flex flex-col gap-3 rounded-[20px] border-2 border-stroke bg-surface-0 p-4 shadow-[2px_2px_0px_#000]">
      <div className="flex h-28 items-center justify-center overflow-hidden rounded-[14px] border-2 border-stroke bg-[var(--world-soft,#ffd93d)]">
        {item.assetUrl ? (
          <img src={item.assetUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <span aria-hidden="true" className="font-display text-[40px] text-stroke">
            {item.name.slice(0, 1)}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-display text-[18px] leading-tight text-stroke [overflow-wrap:anywhere]">
          {item.name}
        </h3>
        {item.rarity && (
          <span className="w-fit rounded-full border-2 border-stroke bg-[var(--world-main,#ffb84d)] px-2 text-[12px] font-bold text-stroke">
            {RARITY_LABEL[item.rarity]}
          </span>
        )}
        {item.description && <p className="text-[14px] text-muted">{item.description}</p>}
      </div>
      <p className="flex items-center gap-1 font-bold text-stroke">
        <Coins size={18} aria-hidden="true" />
        <span>{item.price.toLocaleString()}</span>
        <span className="sr-only">coins</span>
      </p>
      {action}
    </li>
  );
}

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { useToast } from "@/shared/hooks/useToast";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/Tabs";
import {
  equipItem,
  fetchShop,
  purchaseItem,
  type ShopItem,
  type ShopSnapshot,
  type ShopTab,
} from "./api";
import { PurchaseDialog } from "./PurchaseDialog";
import { ShopItemCard } from "./ShopItemCard";

/* Arcade shop (STUDENT-SPEC ST-27, ECONOMY-AND-GAMES section 6).
   Category tabs, item cards with price / level gate / Buy-Equipped state, and a confirmation
   dialog showing the balance before and after. Buying goes through `purchase_shop_item`; the
   balance in the header counts to the server's new value as soon as it replies. */

const SHOP_KEY = ["student", "shop"] as const;

const TABS: ReadonlyArray<{ id: ShopTab; label: string; empty: string }> = [
  { id: "themes", label: "Themes", empty: "No themes in the shop right now." },
  { id: "avatar", label: "Avatar items", empty: "No avatar items in the shop right now." },
  { id: "stickers", label: "Stickers", empty: "No sticker packs in the shop right now." },
  { id: "powerups", label: "Power-ups", empty: "No power-ups in the shop right now." },
  { id: "other", label: "More", empty: "Nothing else in the shop right now." },
];

/** Counts the displayed balance toward `target`; jumps straight there when motion is reduced. */
function useCountedNumber(target: number): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      from.current = target;
      setShown(target);
      return;
    }
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / 600);
      const value = Math.round(start + (target - start) * t);
      from.current = value;
      setShown(value);
      if (t < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}

export default function ShopPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ShopTab>("themes");
  const [pending, setPending] = useState<ShopItem | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const shop = useQuery({ queryKey: SHOP_KEY, queryFn: fetchShop });
  const coins = shop.data?.coins ?? 0;
  const shownCoins = useCountedNumber(coins);

  const buy = useMutation({
    mutationFn: (item: ShopItem) => purchaseItem(item.id),
    onSuccess: (balance, item) => {
      queryClient.setQueryData<ShopSnapshot>(SHOP_KEY, (current) =>
        current
          ? { ...current, coins: balance, owned: { ...current.owned, [item.id]: false } }
          : current,
      );
      setPending(null);
      setPurchaseError(null);
      toast.show({ title: `${item.name} is yours!`, type: "reward" });
      void queryClient.invalidateQueries({ queryKey: SHOP_KEY });
    },
    onError: (error: Error) => {
      setPurchaseError(error.message);
      // Level or coins may have changed elsewhere: refresh so the cards tell the truth.
      void queryClient.invalidateQueries({ queryKey: SHOP_KEY });
    },
  });

  const equip = useMutation({
    mutationFn: (item: ShopItem) => equipItem(item.id),
    onSuccess: (_result, item) => {
      toast.show({ title: `${item.name} equipped`, type: "success" });
      void queryClient.invalidateQueries({ queryKey: SHOP_KEY });
    },
    onError: (error: Error) =>
      toast.show({ title: "Could not equip", description: error.message, type: "error" }),
  });

  const visibleTabs = TABS.filter(
    (entry) =>
      entry.id !== "other" || (shop.data?.items.some((item) => item.tab === "other") ?? false),
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[28px] leading-tight text-stroke">Shop</h1>
        <p
          aria-label={`Your coins: ${coins}`}
          className="font-display flex items-center gap-2 rounded-full border-2 border-stroke bg-[var(--world-main,#ffb84d)] px-4 py-2 text-[20px] text-stroke shadow-[2px_2px_0px_#000]"
        >
          <Coins size={22} aria-hidden="true" />
          <span aria-hidden="true">{shownCoins.toLocaleString()}</span>
        </p>
      </header>

      {shop.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <Skeleton key={n} shape="rect" className="h-64 w-full" />
          ))}
        </div>
      ) : shop.isError ? (
        <ErrorState
          description="The shop could not load. Check your connection and try again."
          onRetry={() => void shop.refetch()}
        />
      ) : (
        <Tabs value={tab} onValueChange={(value) => setTab(value as ShopTab)}>
          <TabsList aria-label="Shop categories">
            {visibleTabs.map((entry) => (
              <TabsTrigger key={entry.id} value={entry.id}>
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {visibleTabs.map((entry) => {
            const items = shop.data.items
              .filter((item) => item.tab === entry.id)
              .sort((a, b) => a.price - b.price);
            return (
              <TabsContent key={entry.id} value={entry.id} className="mt-4">
                {items.length === 0 ? (
                  <EmptyState size="sm" title={entry.empty} />
                ) : (
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => {
                      const flag = shop.data.owned[item.id];
                      return (
                        <ShopItemCard
                          key={item.id}
                          item={item}
                          owned={flag === undefined ? undefined : { equipped: flag }}
                          coins={shop.data.coins}
                          level={shop.data.level}
                          busy={equip.isPending && equip.variables?.id === item.id}
                          onBuy={(chosen) => {
                            setPurchaseError(null);
                            setPending(chosen);
                          }}
                          onEquip={(chosen) => equip.mutate(chosen)}
                        />
                      );
                    })}
                  </ul>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <PurchaseDialog
        item={pending}
        coins={coins}
        busy={buy.isPending}
        error={purchaseError}
        onConfirm={() => pending && buy.mutate(pending)}
        onCancel={() => setPending(null)}
      />
    </main>
  );
}

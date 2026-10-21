import { useEffect, useRef, useState } from "react";
import { Coins } from "lucide-react";
import { useSound } from "@/shared/hooks/useSound";
import { cn } from "@/shared/lib/utils/cn";

export interface CoinCounterProps {
  /** Current authoritative coin balance supplied by student stats. */
  balance: number | null;
  className?: string;
  /** Optional compact mode for narrow headers. */
  compact?: boolean;
}

interface CoinGain {
  amount: number;
  id: number;
}

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

/**
 * Animated student coin balance. It never changes the balance itself: the parent remains
 * responsible for supplying the authoritative value after a reward or purchase.
 */
export function CoinCounter({ balance, className, compact = false }: CoinCounterProps) {
  const { play } = useSound();
  const previousBalance = useRef<number | null>(null);
  const gainId = useRef(0);
  const [gain, setGain] = useState<CoinGain | null>(null);
  const displayBalance = balance !== null && Number.isFinite(balance) ? balance : null;
  const formattedBalance = displayBalance === null ? null : NUMBER_FORMAT.format(displayBalance);

  useEffect(() => {
    if (displayBalance === null) return;

    const previous = previousBalance.current;
    previousBalance.current = displayBalance;
    // Do not announce or play a sound for the initial data load or an unchanged balance.
    if (previous === null || displayBalance === previous) return;
    if (displayBalance < previous) {
      setGain(null);
      return;
    }

    const amount = displayBalance - previous;
    gainId.current += 1;
    setGain({ amount, id: gainId.current });
    play("coin");
  }, [displayBalance, play]);

  useEffect(() => {
    if (gain === null) return;
    const timeout = window.setTimeout(() => {
      setGain((current) => (current?.id === gainId.current ? null : current));
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [gain]);

  const label =
    displayBalance === null ? "Coins loading" : `Coins: ${NUMBER_FORMAT.format(displayBalance)}`;

  return (
    <div
      className={cn(
        "relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-stroke bg-surface-0 px-3 font-heading text-[15px] font-semibold tabular-nums leading-none text-stroke shadow-retro-sm",
        compact && "h-8 gap-1 px-2 text-[13px]",
        className,
      )}
      role="group"
      aria-label={label}
    >
      <Coins
        aria-hidden="true"
        size={compact ? 17 : 20}
        strokeWidth={2.5}
        className="shrink-0 fill-[#ffd93d] stroke-stroke"
      />
      <span
        key={displayBalance ?? "loading"}
        aria-hidden="true"
        className="inline-block animate-[coin-roll_260ms_ease-out] motion-reduce:animate-none"
      >
        {formattedBalance ?? "–"}
      </span>
      {gain !== null && (
        <span
          key={gain.id}
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-1 left-1/2 z-10 inline-flex -translate-x-1/2 animate-[coin-float_1700ms_ease-out_forwards] items-center gap-1 whitespace-nowrap rounded-full border-2 border-stroke bg-[#ffd93d] px-2 py-1 font-heading text-[12px] font-bold leading-none text-stroke shadow-retro-sm motion-reduce:animate-none motion-reduce:opacity-100"
        >
          <Coins size={13} aria-hidden="true" />+{NUMBER_FORMAT.format(gain.amount)}
        </span>
      )}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {gain !== null && displayBalance !== null
          ? `You earned ${NUMBER_FORMAT.format(gain.amount)} coins. New balance: ${NUMBER_FORMAT.format(displayBalance)} coins.`
          : ""}
      </span>
      <style>{`
        @keyframes coin-roll {
          0% { opacity: .35; transform: translateY(-7px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes coin-float {
          0% { opacity: 0; transform: translate(-50%, 5px) scale(.85); }
          12% { opacity: 1; transform: translate(-50%, -2px) scale(1.05); }
          72% { opacity: 1; transform: translate(-50%, -23px) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -31px) scale(.95); }
        }
      `}</style>
    </div>
  );
}

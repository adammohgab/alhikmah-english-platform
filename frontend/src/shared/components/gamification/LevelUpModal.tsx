import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Award, Check, Coins, Copy, Crown, Gift, Share2, Sparkles, Star } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { Dialog } from "@/shared/components/ui/Dialog";
import { useEffectsTier } from "@/shared/hooks/useEffectsTier";
import { useSound } from "@/shared/hooks/useSound";
import { cn } from "@/shared/lib/utils/cn";

export interface LevelUpReward {
  /** Stable identifier for the reward, such as `avatar-hat-starlight`. */
  id: string;
  name: string;
  description?: string;
  kind: "coins" | "cosmetic" | "title" | "feature" | "other";
  /** Optional display value, e.g. `+50`. */
  value?: string;
  /** Optional URL or asset path for a reward preview. */
  imageUrl?: string;
}

export interface LevelUpModalProps {
  /** Current level. A change from `previousLevel` opens the celebration automatically. */
  level: number;
  /** Previous level; pass the level before the XP award to trigger the modal. */
  previousLevel?: number;
  /** Controlled visibility override. When omitted, visibility follows level changes. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Newly unlocked rewards. Defaults to the standard level-up reward preview. */
  rewards?: LevelUpReward[];
  /** Optional rank label displayed beneath the level number. */
  rankName?: string;
  /** Optional custom heading. */
  title?: string;
  /** Called when the student continues back to their current activity. */
  onContinue?: () => void;
  className?: string;
}

const DEFAULT_REWARDS: LevelUpReward[] = [
  { id: "level-up-coins", name: "Bonus coins", value: "+50 Coins", kind: "coins", description: "Added to your rewards" },
  { id: "avatar-hat", name: "New Avatar Hat", kind: "cosmetic", description: "Unlocked in the shop" },
  { id: "student-title", name: "New Title", kind: "title", description: "A fresh title for your profile" },
];

const REWARD_ICONS = {
  coins: Coins,
  cosmetic: Gift,
  title: Crown,
  feature: Sparkles,
  other: Star,
} as const;

/**
 * A level-up takeover for the student's active page. It can be controlled directly, or
 * opened automatically when `level` rises above `previousLevel`. Keep rewards supplied
 * by the caller authoritative so the UI never grants coins or unlocks items itself.
 */
export function LevelUpModal({
  level,
  previousLevel,
  open: controlledOpen,
  onOpenChange,
  rewards = DEFAULT_REWARDS,
  rankName,
  title,
  onContinue,
  className,
}: LevelUpModalProps) {
  const [autoOpen, setAutoOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastLevel = useRef<number | undefined>(previousLevel);
  const { tier: effectsTier, prefersReducedMotion } = useEffectsTier();
  const { play } = useSound();
  const motionAllowed = effectsTier !== "low" && !prefersReducedMotion;
  const isOpen = controlledOpen ?? autoOpen;
  const shareText = useMemo(
    () => `🎉 I reached Level ${level}${rankName ? ` — ${rankName}` : ""} on Al Hikmah English! Keep learning with me.`,
    [level, rankName],
  );

  useEffect(() => {
    if (previousLevel === undefined) {
      lastLevel.current = level;
      return;
    }
    const oldLevel = lastLevel.current ?? previousLevel;
    if (level > oldLevel) {
      if (controlledOpen === undefined) setAutoOpen(true);
    }
    lastLevel.current = level;
  }, [level, previousLevel, controlledOpen]);

  useEffect(() => {
    if (!isOpen) return;
    play("fanfare");
    if (!motionAllowed || typeof confetti !== "function") return;
    const colors = ["#ffb84d", "#2fd6a3", "#ffd93d", "#ff6fa5", "#8b7cff"];
    void confetti({ particleCount: 90, spread: 72, startVelocity: 42, origin: { x: 0.12, y: 0.68 }, colors, zIndex: 100 });
    void confetti({ particleCount: 90, spread: 72, startVelocity: 42, origin: { x: 0.88, y: 0.68 }, colors, zIndex: 100 });
    void confetti({ particleCount: 70, spread: 100, startVelocity: 32, origin: { x: 0.5, y: 0.45 }, colors, zIndex: 100 });
  }, [isOpen, motionAllowed, play]);

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setAutoOpen(next);
    onOpenChange?.(next);
  };

  const share = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Level Up!", text: shareText });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
    } catch {
      // Sharing can be cancelled by the student or blocked by browser permissions.
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={setOpen}
      title={title ?? `Level ${level} Unlocked!`}
      description="You learned, you grew, and you earned this moment."
      size="lg"
      className={cn("max-h-[90dvh] overflow-y-auto", className)}
    >
      <div className="flex flex-col items-center gap-5 px-1 pb-2 pt-3 text-center">
        <div className="relative grid h-40 w-40 place-items-center" aria-label={`Level ${level}`}>
          <div aria-hidden="true" className={cn("absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,var(--world-main,#ffb84d)_12deg,transparent_24deg)] opacity-70", motionAllowed && "animate-[spin_18s_linear_infinite]", "motion-reduce:animate-none")} />
          <div aria-hidden="true" className="absolute inset-3 rounded-full border-2 border-dashed border-[var(--world-deep,#8f4300)]/50" />
          <div className={cn("relative grid h-28 w-28 place-items-center rounded-full border-[3px] border-stroke bg-[var(--world-main,#ffb84d)] text-stroke shadow-retro-md", motionAllowed && "motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500", "motion-reduce:animate-none")}>
            <div className="flex flex-col items-center leading-none">
              <span className="text-[11px] font-black uppercase tracking-[0.2em]">Level</span>
              <span className="font-heading text-5xl font-black tabular-nums">{level}</span>
            </div>
          </div>
          <Sparkles aria-hidden="true" className="absolute right-1 top-5 text-[var(--world-deep,#8f4300)]" size={25} />
          <Star aria-hidden="true" className="absolute bottom-4 left-0 text-[var(--world-pop,#2fd6a3)]" size={22} />
        </div>

        <div className="space-y-1">
          <p className="font-heading text-2xl font-black text-ink">{title ?? "Amazing work!"}</p>
          <p className="text-sm text-muted">{rankName ? `Your new rank: ${rankName}` : "Your next adventure starts now."}</p>
        </div>

        <section className="w-full max-w-md text-left" aria-labelledby="level-up-rewards-heading">
          <h3 id="level-up-rewards-heading" className="mb-2 flex items-center gap-2 font-heading text-base font-bold text-ink">
            <Award size={19} aria-hidden="true" /> Your new rewards
          </h3>
          <ul className="space-y-2">
            {rewards.map((reward) => {
              const Icon = REWARD_ICONS[reward.kind];
              return (
                <li key={reward.id} className="flex items-center gap-3 rounded-xl border-2 border-stroke/15 bg-surface-1 p-3">
                  {reward.imageUrl ? (
                    <img src={reward.imageUrl} alt="" className="h-11 w-11 rounded-lg object-cover" />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-stroke/15 bg-[var(--world-soft,#fff1bd)] text-[var(--world-deep,#8f4300)]"><Icon size={22} aria-hidden="true" /></span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">{reward.name}</span>
                    {reward.description && <span className="block text-xs text-muted">{reward.description}</span>}
                  </span>
                  {reward.value && <span className="shrink-0 text-sm font-black text-[var(--world-deep,#8f4300)]">{reward.value}</span>}
                  <Check aria-hidden="true" size={17} className="shrink-0 text-[var(--world-pop,#16865f)]" />
                </li>
              );
            })}
          </ul>
        </section>

        <div className="w-full max-w-md rounded-xl border-2 border-dashed border-[var(--world-deep,#8f4300)]/40 bg-[var(--world-soft,#fff1bd)] p-4 text-stroke">
          <div className="mb-2 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider"><Sparkles size={15} aria-hidden="true" /> Level-up card</div>
          <p className="font-heading text-lg font-black">Level {level}{rankName ? ` · ${rankName}` : ""}</p>
          <p className="mt-1 text-sm">{shareText}</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => void share()}>
            {copied ? <Check size={16} /> : typeof navigator !== "undefined" && navigator.share ? <Share2 size={16} /> : <Copy size={16} />}
            {copied ? "Copied!" : "Share your achievement"}
          </Button>
        </div>

        <Button type="button" className="w-full max-w-md" onClick={() => { setOpen(false); onContinue?.(); }}>
          Continue learning
        </Button>
      </div>
    </Dialog>
  );
}

export default LevelUpModal;

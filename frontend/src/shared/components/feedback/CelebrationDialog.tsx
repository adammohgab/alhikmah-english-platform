import { useLayoutEffect, useRef, type ReactNode } from "react";
import confetti from "canvas-confetti";
import { Trophy } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { Dialog, DialogClose } from "@/shared/components/ui/Dialog";
import { Button } from "@/shared/components/ui/Button";
import { useEffectsTier } from "@/shared/hooks/useEffectsTier";

/* ========================================
   CelebrationDialog (Feedback & Loading, GLOBAL-STYLES-SPEC §8.7 "Large")
   The Large celebration modal: level ups, rank ups, certificates, streak milestones, perfect
   quizzes, Epic/Legendary shop reveals. A full-screen takeover built on the Arcade Dialog
   (focus trapped, title announced, Escape and overlay click close it, page scroll locked —
   spec's "Lenis stopped").

   Contents
     hero     a big world-colored medal sticker that pops in with an overshoot spring; swap
              this slot for a Rive/Lottie hero object when those assets land (§30 motion
              stack) — the surrounding dialog and queue stay the same
     confetti two side cannons plus a center burst on open, in the live world colors
     rewards  an optional summary of what was earned, as bordered rows
     actions  a Continue button (plus the corner close); every celebration is skippable with
              a click or Escape and never blocks reading results (§8.7)

   Reduced motion / low effects tier (§8.9): no confetti and no spring — the medal appears
   with a short 150 ms fade, per the spec's "static sticker and a short fade".
   ======================================== */

export interface CelebrationReward {
  /** What was earned, for example "XP earned". */
  label: string;
  /** The amount, for example "+250". */
  value?: string | undefined;
}

export interface CelebrationDialogProps {
  open: boolean;
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** The headline, for example "Level 5 Reached!". Announced when the dialog opens. */
  title: ReactNode;
  /** One supporting line under the headline. */
  description?: ReactNode | undefined;
  /** Reward summary rows under the hero. */
  rewards?: CelebrationReward[] | undefined;
  /** Hero icon override. Default a trophy. */
  icon?: ReactNode | undefined;
  /** Label of the continue button. Default "Continue". */
  continueLabel?: string | undefined;
}

const MEDAL = 128;

function worldColors(): string[] {
  if (typeof window === "undefined") return ["#ffb84d", "#2fd6a3", "#ffd3a6", "#8f4300"];
  const css = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => {
    const value = css.getPropertyValue(name).trim();
    return value.length > 0 ? value : fallback;
  };
  return [
    pick("--world-main", "#ffb84d"),
    pick("--world-pop", "#2fd6a3"),
    pick("--world-soft", "#ffd3a6"),
    pick("--world-deep", "#8f4300"),
    "#ffd93d",
  ];
}

export function CelebrationDialog({
  open,
  onOpenChange,
  title,
  description,
  rewards,
  icon,
  continueLabel = "Continue",
}: CelebrationDialogProps) {
  const { tier: fxTier, prefersReducedMotion } = useEffectsTier();
  const motionAllowed = fxTier !== "low" && !prefersReducedMotion;
  const medalRef = useRef<HTMLDivElement | null>(null);

  // Open sequence: side cannons + center burst, then the medal pop. Runs when the dialog
  // opens (the layer mounts only while open); colors follow the live world variables.
  useLayoutEffect(() => {
    if (!open) return;
    const colors = worldColors();

    if (motionAllowed && typeof confetti === "function") {
      const options = { colors, disableForReducedMotion: true, zIndex: 60 };
      void confetti({
        ...options,
        particleCount: 70,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.7 },
      });
      void confetti({
        ...options,
        particleCount: 70,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.7 },
      });
      void confetti({ ...options, particleCount: 90, spread: 100, origin: { x: 0.5, y: 0.4 } });
    }

    const medal = medalRef.current;
    if (medal && typeof medal.animate === "function") {
      if (motionAllowed) {
        medal.animate(
          [
            { opacity: 0, transform: "scale(0.4) rotate(-12deg)" },
            { opacity: 1, transform: "scale(1.06) rotate(2deg)", offset: 0.7 },
            { opacity: 1, transform: "scale(1) rotate(0deg)" },
          ],
          { duration: 500, easing: "ease-out", fill: "backwards" },
        );
      } else {
        medal.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 150,
          easing: "ease-out",
          fill: "backwards",
        });
      }
    }
  }, [open, motionAllowed]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={title}
      description={description}
    >
      <div className="flex flex-col items-center gap-5 px-2 pb-2 pt-4 text-center">
        <div
          ref={medalRef}
          aria-hidden="true"
          className={cn(
            "grid place-items-center rounded-full border-[3px] border-stroke",
            "bg-[var(--world-main,#ffb84d)] text-stroke shadow-retro-md",
          )}
          style={{ width: MEDAL, height: MEDAL }}
        >
          {icon ?? <Trophy size={56} strokeWidth={2.5} />}
        </div>

        {rewards !== undefined && rewards.length > 0 && (
          <ul className="w-full max-w-sm overflow-hidden rounded-[12px] border-2 border-stroke bg-surface-50 text-left">
            {rewards.map((reward) => (
              <li
                key={reward.label}
                className="flex items-center justify-between gap-4 border-b-2 border-stroke/10 px-4 py-2.5 last:border-b-0"
              >
                <span className="font-body text-[14px] font-medium text-muted">{reward.label}</span>
                {reward.value !== undefined && (
                  <span className="font-heading text-[16px] font-semibold text-stroke">
                    {reward.value}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <DialogClose asChild>
          <Button className="w-full max-w-sm">{continueLabel}</Button>
        </DialogClose>
      </div>
    </Dialog>
  );
}

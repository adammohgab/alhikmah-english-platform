import { useEffect, useState } from "react";
import { Coins, Sparkles } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { Dialog } from "@/shared/components/ui/Dialog";
import { useSound } from "@/shared/hooks/useSound";
import type { ClaimReward } from "./api";

/* Reward ceremony: the chest shakes, springs open, and the rewards the server actually granted
   fly out with a fanfare. Stages are timed, and the motion drops to the final state at once
   when the student prefers reduced motion. */

type Stage = "shake" | "open" | "reveal";

const KEYFRAMES = `
@keyframes chest-shake { 0%,100% { transform: rotate(0) } 20% { transform: rotate(-8deg) } 40% { transform: rotate(8deg) } 60% { transform: rotate(-6deg) } 80% { transform: rotate(6deg) } }
@keyframes chest-lid { from { transform: rotate(0) } to { transform: rotate(-70deg) } }
@keyframes chest-burst { from { opacity: 0; transform: translate(0, 0) scale(.4) } 30% { opacity: 1 } to { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1) } }
`;

const SPARKS = [
  { dx: "-70px", dy: "-90px" },
  { dx: "-30px", dy: "-120px" },
  { dx: "30px", dy: "-120px" },
  { dx: "70px", dy: "-90px" },
  { dx: "-95px", dy: "-50px" },
  { dx: "95px", dy: "-50px" },
] as const;

export interface ChestDialogProps {
  reward: ClaimReward | null;
  onClose: () => void;
}

export function ChestDialog({ reward, onClose }: ChestDialogProps) {
  const { play } = useSound();
  const [stage, setStage] = useState<Stage>("shake");

  useEffect(() => {
    if (!reward) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setStage("reveal");
      play("fanfare");
      return;
    }
    setStage("shake");
    const open = window.setTimeout(() => {
      setStage("open");
      play("pop");
    }, 900);
    const reveal = window.setTimeout(() => {
      setStage("reveal");
      play("fanfare");
    }, 1500);
    return () => {
      window.clearTimeout(open);
      window.clearTimeout(reveal);
    };
  }, [reward, play]);

  const opened = stage !== "shake";

  return (
    <Dialog
      open={reward !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Treasure chest"
      description={stage === "reveal" ? "Here is what you earned." : "Opening your chest…"}
      size="sm"
      footer={
        <Button onClick={onClose} disabled={stage !== "reveal"}>
          Awesome!
        </Button>
      }
    >
      <style>{KEYFRAMES}</style>
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="relative h-32 w-40" aria-hidden="true">
          {SPARKS.map((spark, index) => (
            <span
              key={index}
              style={
                {
                  "--dx": spark.dx,
                  "--dy": spark.dy,
                  animation: stage === "shake" ? undefined : "chest-burst 900ms ease-out both",
                  animationDelay: `${index * 60}ms`,
                } as React.CSSProperties
              }
              className="absolute left-1/2 top-8 h-4 w-4 rounded-full border-2 border-stroke bg-[var(--world-soft,#ffd93d)] opacity-0"
            />
          ))}
          <div
            style={{
              animation: stage === "shake" ? "chest-shake 450ms ease-in-out infinite" : undefined,
            }}
            className="absolute inset-x-0 bottom-0 h-20 rounded-b-[14px] border-2 border-stroke bg-[var(--world-deep,#e07a2e)]"
          >
            <div className="absolute inset-x-0 top-6 h-3 border-y-2 border-stroke bg-[var(--world-soft,#ffd93d)]" />
          </div>
          <div
            style={{
              transformOrigin: "left bottom",
              animation: opened ? "chest-lid 350ms cubic-bezier(.3,1.6,.5,1) both" : undefined,
            }}
            className="absolute inset-x-0 bottom-20 h-10 rounded-t-[20px] border-2 border-stroke bg-[var(--world-main,#ffb84d)]"
          />
        </div>
        <div
          role="status"
          className="font-display flex min-h-14 items-center gap-6 text-[24px] text-stroke"
        >
          {stage === "reveal" && reward && (
            <>
              {reward.xp > 0 && (
                <span className="flex items-center gap-2">
                  <Sparkles aria-hidden="true" /> +{reward.xp} XP
                </span>
              )}
              {reward.coins > 0 && (
                <span className="flex items-center gap-2">
                  <Coins aria-hidden="true" /> +{reward.coins} coins
                </span>
              )}
            </>
          )}
        </div>
        {stage === "reveal" && reward?.freezeAwarded && (
          <p className="text-center text-[16px] font-bold text-stroke">
            Bonus: you found a streak freeze!
          </p>
        )}
      </div>
    </Dialog>
  );
}

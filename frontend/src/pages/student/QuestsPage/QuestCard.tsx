import { Check, Coins, Sparkles } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import type { Quest } from "./api";

/* One quest: title, live progress meter, reward, and a Claim button that unlocks only when the
   quest is completed. A claimed quest shows a check instead. */

export interface QuestCardProps {
  quest: Quest;
  busy: boolean;
  onClaim: (quest: Quest) => void;
}

export function QuestCard({ quest, busy, onClaim }: QuestCardProps) {
  const claimed = quest.state === "claimed";
  return (
    <li className="flex flex-col gap-3 rounded-[20px] border-2 border-stroke bg-surface-0 p-4 shadow-[2px_2px_0px_#000]">
      <div className="min-w-0">
        <h3 className="font-display text-[18px] leading-tight text-stroke [overflow-wrap:anywhere]">
          {quest.title}
        </h3>
        {quest.description && <p className="text-[14px] text-muted">{quest.description}</p>}
      </div>
      <ProgressBar
        value={quest.progress}
        max={quest.target}
        label={quest.title}
        valueText={`${quest.progress} of ${quest.target}`}
      />
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] font-bold text-stroke">
        <span>
          {quest.progress} / {quest.target}
        </span>
        <span className="flex items-center gap-1">
          <Sparkles size={16} aria-hidden="true" />
          {quest.xp} XP
        </span>
        <span className="flex items-center gap-1">
          <Coins size={16} aria-hidden="true" />
          {quest.coins} coins
        </span>
      </p>
      {claimed ? (
        <Button variant="secondary" disabled className="w-full">
          <Check size={16} aria-hidden="true" />
          <span>Claimed</span>
        </Button>
      ) : (
        <Button
          sound="coin"
          disabled={quest.state !== "ready"}
          loading={busy}
          onClick={() => onClaim(quest)}
          className="w-full"
        >
          {quest.state === "ready" ? "Claim reward" : "Keep going"}
        </Button>
      )}
    </li>
  );
}

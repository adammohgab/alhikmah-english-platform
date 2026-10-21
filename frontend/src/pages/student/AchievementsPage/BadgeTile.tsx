import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { cn } from "@/shared/lib/utils/cn";
import { BadgeArt } from "./BadgeArt";
import { formatEarnedDate, RARITY_LABEL } from "./rules";
import type { Badge } from "./rules";

/* One badge in the gallery. The whole tile is a button that opens the badge dialog. Unlocked
   badges show their earn date, locked ones a progress bar with a percentage when the page can
   measure it. State is spelled out in words, never carried by color alone. */

function stateLabel(badge: Badge): string {
  if (badge.status === "earned") {
    const date = formatEarnedDate(badge.earnedAt);
    return date ? `Earned ${date}` : "Earned";
  }
  if (badge.progress) return `${badge.progress.percent}% there`;
  return "Locked";
}

export function BadgeTile({ badge, onOpen }: { badge: Badge; onOpen: (badge: Badge) => void }) {
  const unlocked = badge.status === "earned";
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(badge)}
        aria-label={`${badge.name}, ${stateLabel(badge)}${badge.pinned ? ", pinned" : ""}`}
        className={cn(
          "flex h-full w-full flex-col items-center gap-2 rounded-[20px] border-2 border-stroke p-4 text-center shadow-retro-sm transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          unlocked ? "bg-surface-0" : "bg-surface-100",
        )}
      >
        <BadgeArt badge={badge} size="md" />
        <span className="font-heading text-base font-bold leading-tight text-stroke">
          {badge.name}
        </span>
        {unlocked && badge.rarity && (
          <span className="text-xs font-bold uppercase tracking-wide text-muted">
            {RARITY_LABEL[badge.rarity]}
          </span>
        )}
        <span className="text-sm font-semibold text-muted">{stateLabel(badge)}</span>
        {badge.pinned && (
          <span className="rounded-full border-2 border-stroke bg-world-amber-300 px-2 text-xs font-bold text-stroke">
            Pinned
          </span>
        )}
        {badge.progress && (
          <ProgressBar
            className="w-full"
            value={badge.progress.value}
            max={badge.progress.target}
            label={`${badge.name} progress`}
            valueText={`${badge.progress.percent}%, ${badge.progress.value} of ${badge.progress.target}`}
          />
        )}
      </button>
    </li>
  );
}

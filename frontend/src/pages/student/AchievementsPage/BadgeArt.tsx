import type { ComponentType } from "react";
import { BookOpen, ClipboardCheck, Flame, Sparkles } from "lucide-react";
import type { LucideProps } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import type { Badge, GroupId, Rarity } from "./rules";

/* The illustrated badge: the catalog icon when there is one, otherwise a glyph for the badge's
   group. Earned badges are in full color on a rarity plate; locked ones are a flat gray
   silhouette. */

const GROUP_ICON: Record<GroupId, ComponentType<LucideProps>> = {
  streaks: Flame,
  learning: BookOpen,
  quizzes: ClipboardCheck,
  events: Sparkles,
};

const RARITY_PLATE: Record<Rarity, string> = {
  common: "bg-surface-100",
  rare: "bg-world-sky-300",
  epic: "bg-world-violet-300",
  legendary: "bg-world-amber-300",
};

export function BadgeArt({ badge, size }: { badge: Badge; size: "md" | "lg" }) {
  const unlocked = badge.status === "earned";
  const box = size === "lg" ? "h-24 w-24" : "h-16 w-16";
  const glyph = size === "lg" ? 48 : 32;
  const Icon = GROUP_ICON[badge.group];
  const plate = unlocked ? RARITY_PLATE[badge.rarity ?? "common"] : "bg-surface-100";

  return (
    <div
      aria-hidden="true"
      data-testid={unlocked ? "badge-art-unlocked" : "badge-art-locked"}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 border-stroke",
        box,
        plate,
      )}
    >
      {badge.hidden ? (
        <span className="font-heading text-3xl font-bold text-muted">?</span>
      ) : badge.iconUrl ? (
        <img
          src={badge.iconUrl}
          alt=""
          className={cn(
            "h-3/4 w-3/4 object-contain",
            !unlocked && "brightness-0 opacity-30 grayscale",
          )}
        />
      ) : (
        <Icon
          size={glyph}
          strokeWidth={2.5}
          className={unlocked ? "text-stroke" : "text-muted opacity-60"}
        />
      )}
    </div>
  );
}

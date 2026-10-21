import { Button } from "@/shared/components/ui/Button";
import { Dialog } from "@/shared/components/ui/Dialog";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { BadgeArt } from "./BadgeArt";
import { formatEarnedDate, MAX_PINS, RARITY_LABEL } from "./rules";
import type { Badge } from "./rules";

/* Badge detail: what it takes to earn it, the XP it pays, progress, and for unlocked badges the
   "Pin to Profile" action (up to three pins). */

export interface BadgeDialogProps {
  badge: Badge | null;
  pinnedCount: number;
  busy: boolean;
  onTogglePin: (badge: Badge) => void;
  onClose: () => void;
}

export function BadgeDialog({ badge, pinnedCount, busy, onTogglePin, onClose }: BadgeDialogProps) {
  const full = badge !== null && !badge.pinned && pinnedCount >= MAX_PINS;
  const earnedOn = badge ? formatEarnedDate(badge.earnedAt) : null;

  return (
    <Dialog
      open={badge !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={badge?.name ?? "Badge"}
      description={badge?.description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {badge?.status === "earned" && (
            <Button loading={busy} disabled={full} onClick={() => onTogglePin(badge)}>
              {badge.pinned
                ? "Unpin from Profile"
                : full
                  ? `Pin limit reached (${MAX_PINS} of ${MAX_PINS})`
                  : "Pin to Profile"}
            </Button>
          )}
        </>
      }
    >
      {badge && (
        <div className="flex flex-col items-center gap-4 text-stroke">
          <BadgeArt badge={badge} size="lg" />
          <dl className="grid w-full grid-cols-2 gap-2 text-center">
            <div className="rounded-[12px] border-2 border-stroke bg-surface-100 px-2 py-1.5">
              <dt className="text-xs font-bold text-muted">XP reward</dt>
              <dd className="font-heading text-lg font-bold">
                {badge.xpReward === null ? "Not listed" : `+${badge.xpReward} XP`}
              </dd>
            </div>
            <div className="rounded-[12px] border-2 border-stroke bg-surface-100 px-2 py-1.5">
              <dt className="text-xs font-bold text-muted">Rarity</dt>
              <dd className="font-heading text-lg font-bold">
                {badge.rarity ? RARITY_LABEL[badge.rarity] : "Not listed"}
              </dd>
            </div>
          </dl>
          {badge.status === "earned" ? (
            <p className="text-sm font-bold">
              {earnedOn ? `Earned ${earnedOn}` : "Earned"}
              {badge.pinned ? " · Pinned to your profile" : ""}
            </p>
          ) : badge.progress ? (
            <div className="flex w-full flex-col gap-1">
              <p className="text-sm font-bold">
                {badge.progress.value} of {badge.progress.target} ({badge.progress.percent}%)
              </p>
              <ProgressBar
                value={badge.progress.value}
                max={badge.progress.target}
                label={`${badge.name} progress`}
                valueText={`${badge.progress.percent}%`}
              />
            </div>
          ) : (
            <p className="text-sm font-bold">{badge.hint ?? "Not unlocked yet"}</p>
          )}
          {full && (
            <p className="text-center text-sm font-semibold text-muted">
              You can pin up to {MAX_PINS} badges. Unpin one to pin this badge.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

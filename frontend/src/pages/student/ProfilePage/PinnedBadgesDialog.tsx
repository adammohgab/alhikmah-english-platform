import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { Dialog, DialogClose } from "@/shared/components/ui/Dialog";
import { cn } from "@/shared/lib/utils/cn";
import { BadgeArt } from "../AchievementsPage/BadgeArt";
import { MAX_PINS, type Badge } from "../AchievementsPage/rules";

/* "Change Pinned Badges" modal: pick up to three earned badges, then save in one step. */

export interface PinnedBadgesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  earned: readonly Badge[];
  initial: readonly string[];
  saving: boolean;
  onSave: (ids: string[]) => void;
}

export function PinnedBadgesDialog({
  open,
  onOpenChange,
  earned,
  initial,
  saving,
  onSave,
}: PinnedBadgesDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change pinned badges"
      description={`Choose up to ${MAX_PINS} badges to show on your profile.`}
      size="lg"
    >
      {open && <Picker earned={earned} initial={initial} saving={saving} onSave={onSave} />}
    </Dialog>
  );
}

function Picker({
  earned,
  initial,
  saving,
  onSave,
}: Pick<PinnedBadgesDialogProps, "earned" | "initial" | "saving" | "onSave">) {
  const [selected, setSelected] = useState<string[]>([...initial]);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length >= MAX_PINS
          ? current
          : [...current, id],
    );

  if (earned.length === 0) {
    return <p className="text-sm text-muted">Earn your first badge and it will show up here.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {earned.map((badge) => {
          const on = selected.includes(badge.id);
          const full = !on && selected.length >= MAX_PINS;
          return (
            <li key={badge.id}>
              <button
                type="button"
                aria-pressed={on}
                disabled={full}
                onClick={() => toggle(badge.id)}
                className={cn(
                  "relative flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-stroke p-3 text-center",
                  on ? "bg-world-amber-300 shadow-sm" : "bg-surface-0",
                  full && "opacity-50",
                )}
              >
                {on && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-stroke bg-surface-0">
                    <Check size={12} strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
                <BadgeArt badge={badge} size="md" />
                <span className="text-sm font-semibold">{badge.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted" aria-live="polite">
          {selected.length} of {MAX_PINS} selected
        </span>
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button loading={saving} onClick={() => onSave(selected)}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

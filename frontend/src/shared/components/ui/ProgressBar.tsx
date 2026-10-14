import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils/cn";
import type { WorldId } from "@/shared/hooks/useWorld";

/* ========================================
   Arcade ProgressBar (Gamification, GLOBAL-STYLES-SPEC §10 "Progress bar")
   A chunky pill: a 2px solid ink outline around a paper track, filled by a world `main`
   bar whose width follows the value. The width is transitioned (CSS, 500 ms ease-out), which
   reads as a smooth fill when the value changes; the transition drops on the "low" effects
   tier and for reduced motion (spec §8.9).

   The fill reads the live world variables so it morphs with the theme; `world` pins the bar
   to one world. Announced as a progressbar with `aria-valuenow` / `aria-valuemin` /
   `aria-valuemax` and an optional `valueText`.
   ======================================== */

export interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
  /** Current progress; values outside [0, max] are clamped. */
  value: number;
  /** The value that means "full". Default 100. */
  max?: number | undefined;
  /** Pins the bar to one world instead of the current one. */
  world?: WorldId | undefined;
  /** Accessible name. Pass the translated text. Default "Progress". */
  label?: string | undefined;
  /** Spoken value, for example "3 of 5 lessons". Default "{value} of {max}". */
  valueText?: string | undefined;
}

const FILL_MOTION =
  "transition-[width] duration-500 ease-out motion-reduce:transition-none [[data-effects-tier=low]_&]:transition-none";

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  { value, max = 100, world, label = "Progress", valueText, className, style, ...rest },
  ref,
) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const clamped = Number.isFinite(value) ? Math.min(safeMax, Math.max(0, value)) : 0;
  const percent = (clamped / safeMax) * 100;

  const rootStyle: CSSProperties = { ...style };

  return (
    <div
      ref={ref}
      {...rest}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
      data-world={world}
      style={rootStyle}
      className={cn(
        "h-4 overflow-hidden rounded-full border-2 border-stroke bg-surface-0",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full bg-[var(--world-main,#ffb84d)]", FILL_MOTION)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
});

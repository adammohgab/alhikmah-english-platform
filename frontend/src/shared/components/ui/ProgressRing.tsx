import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/utils/cn";
import type { WorldId } from "@/shared/hooks/useWorld";

/* ========================================
   Arcade ProgressRing (Gamification, GLOBAL-STYLES-SPEC §10 "progress ring")
   A standalone circular indicator: an SVG ring that charts a percentage of the perimeter,
   clockwise from 12 o'clock, with optional content (a number, an icon) centered inside.
     track   white band inside a 2px solid ink outline that hugs it inside and out
     arc     world `main`, round caps; the caps are included in the length, so the arc ends
             exactly at `value / max` of the perimeter
   Total diameter is `size + 2 * (strokeWidth + 2)`.

   Only the dash length is transitioned (not on the "low" effects tier, spec §8.9, or for
   reduced motion). The arc reads the live world variables, so it follows the current world;
   `world` pins it to one world. Announced as a progressbar with `aria-valuenow` /
   `aria-valuemin` / `aria-valuemax` and an optional `valueText`. For a ring around an
   Avatar, use `LevelRing`.
   ======================================== */

export interface ProgressRingProps extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
  /** Current progress; values outside [0, max] are clamped. */
  value: number;
  /** The value that means "full". Default 100. */
  max?: number | undefined;
  /** Diameter in px of the inner circle (including any centered children). Default 48. */
  size?: number | undefined;
  /** Band width in px. Default scales with `size`. */
  strokeWidth?: number | undefined;
  /** Pins the ring to one world instead of the current one. */
  world?: WorldId | undefined;
  /** Accessible name. Pass the translated text. Default "Progress". */
  label?: string | undefined;
  /** Spoken value, for example "Level 7". Default "{value} of {max}". */
  valueText?: string | undefined;
  /** Content centered inside the ring. */
  children?: ReactNode;
}

/** Ink outline hugging the band, in px. */
const OUTLINE = 2;

const DASH_MOTION =
  "transition-[stroke-dasharray] duration-500 ease-out motion-reduce:transition-none [[data-effects-tier=low]_&]:transition-none";

export const ProgressRing = forwardRef<HTMLDivElement, ProgressRingProps>(function ProgressRing(
  {
    value,
    max = 100,
    size = 48,
    strokeWidth,
    world,
    label = "Progress",
    valueText,
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const clamped = Number.isFinite(value) ? Math.min(safeMax, Math.max(0, value)) : 0;
  const percent = (clamped / safeMax) * 100;

  const band = strokeWidth ?? Math.max(4, Math.round(size / 10));
  const total = size + 2 * (band + OUTLINE);
  const center = total / 2;
  // Center lines: the band sits inside the outline that hugs it on both edges.
  const bandRadius = size / 2 + band / 2;
  const outlineRadius = size / 2 + (band + OUTLINE) / 2;
  const circumference = 2 * Math.PI * bandRadius;
  const arcLength = (circumference * percent) / 100;

  // Round caps add band/2 at both ends, so the dash is shortened by `band` and moved forward
  // by band/2. The visible arc, caps included, then spans exactly `arcLength`.
  const isFull = percent >= 100;
  const dash = Math.max(0, arcLength - band);

  const rootStyle: CSSProperties = { width: total, height: total, ...style };

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
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        width={total}
        height={total}
        viewBox={`0 0 ${total} ${total}`}
        fill="none"
        className="absolute inset-0 overflow-visible"
      >
        <circle
          cx={center}
          cy={center}
          r={outlineRadius}
          strokeWidth={band + OUTLINE}
          className="stroke-stroke"
        />
        <circle
          cx={center}
          cy={center}
          r={bandRadius}
          strokeWidth={band}
          className="stroke-surface-0"
        />
        {percent > 0 && (
          <circle
            cx={center}
            cy={center}
            r={bandRadius}
            strokeWidth={band}
            strokeLinecap={isFull ? "butt" : "round"}
            strokeDasharray={isFull ? undefined : `${dash} ${circumference}`}
            strokeDashoffset={isFull ? undefined : -band / 2}
            transform={`rotate(-90 ${center} ${center})`}
            className={cn("stroke-[color:var(--world-main,#ffb84d)]", DASH_MOTION)}
          />
        )}
      </svg>
      {children != null && (
        <div className="relative inline-flex items-center justify-center">{children}</div>
      )}
    </div>
  );
});

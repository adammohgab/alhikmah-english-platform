import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/utils/cn";
import type { WorldId } from "@/shared/hooks/useWorld";

/* ========================================
   Arcade LevelRing (GLOBAL-STYLES-SPEC §10 "Progress bar ... progress ring", §13)

   An SVG ring drawn around its child (an Avatar) that charts a percentage of the perimeter,
   clockwise from 12 o'clock:
     content circle   `size` px, the child. The child owns its own 2px solid ink border, and that
                      border is what separates the ring from the content.
     band             `strokeWidth` px, flush against the child: white track, world `main` arc,
                      round caps. The caps are included in the length, so the arc ends exactly at
                      `value` percent of the perimeter.
     outline          a 2px solid ink line on the outer edge of the band.
   Total diameter is `size + 2 * (strokeWidth + 2)`.

   The ring reads the live world variables, so it follows the current world; `world` pins it to
   one world. Only the dash length is transitioned (not on the "low" effects tier, spec §8.9, or for
   reduced motion). It is announced as a progressbar with the rounded percent.
   ======================================== */

export interface LevelRingProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "role"> {
  /** Progress around the perimeter, 0 to 100. Values outside the range are clamped. */
  value: number;
  /** Diameter in px of the content circle (the child, border included). */
  size: number;
  /** Band width in px. Default scales with `size`. */
  strokeWidth?: number | undefined;
  /** Pins the ring to one world instead of the current one. */
  world?: WorldId | undefined;
  /** Accessible name. Pass the translated text. Default "Level progress". */
  label?: string | undefined;
  /** Spoken value, for example "Level 7, 42 percent to level 8". Default is the percent. */
  valueText?: string | undefined;
  /** The content, normally an `Avatar` with the same diameter as `size`. */
  children?: ReactNode;
}

/** Ink outline on the outer edge of the band, in px. */
const OUTLINE = 2;

const DASH_MOTION =
  "transition-[stroke-dasharray] duration-500 ease-out motion-reduce:transition-none [[data-effects-tier=low]_&]:transition-none";

export const LevelRing = forwardRef<HTMLDivElement, LevelRingProps>(function LevelRing(
  {
    value,
    size,
    strokeWidth,
    world,
    label = "Level progress",
    valueText,
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  const percent = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  const band = strokeWidth ?? Math.max(2, Math.round(size / 14));
  const total = size + 2 * (band + OUTLINE);
  const center = total / 2;
  // Center lines: the band hugs the content circle, the outline sits just outside it.
  const bandRadius = size / 2 + band / 2;
  const outlineRadius = size / 2 + (band + OUTLINE) / 2;
  const circumference = 2 * Math.PI * bandRadius;
  const arcLength = (circumference * percent) / 100;

  // Round caps add band/2 at both ends, so the dash is shortened by `band` and moved forward by
  // band/2. The visible arc, caps included, then spans exactly `arcLength`.
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
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
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
      <div className="relative inline-flex">{children}</div>
    </div>
  );
});

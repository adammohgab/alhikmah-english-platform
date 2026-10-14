import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { Shield, Star } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import type { WorldId } from "@/shared/hooks/useWorld";

/* ========================================
   Arcade LevelIndicator (GLOBAL-STYLES-SPEC §6.2, §10 "Chip and tag")

   The student's level as a compact pill: a mini star or shield, then "Level 7".
   Solid 2px ink outline, hard 2px shadow, ink text on the world `main` fill, with the icon in the
   world `pop` accent. All colors read the live world variables, so the pill takes the color of
   the world the student is in and morphs with it; `world` pins it to one world instead.
   The text carries the meaning, so the icon is decorative and hidden from assistive tech.
   ======================================== */

export type LevelIndicatorIcon = "star" | "shield";
export type LevelIndicatorSize = "sm" | "md";

export interface LevelIndicatorProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** The student's level. Shown as a whole number, never below 0. */
  level: number;
  /** Mini icon before the text. Default `star`. */
  icon?: LevelIndicatorIcon | undefined;
  /** Word before the number. Pass the translated word. Default "Level". */
  label?: string | undefined;
  /** `sm` is 24px tall, `md` is 32px. Default `md`. */
  size?: LevelIndicatorSize | undefined;
  /** Ink fill with light text, for dark ("Night") surfaces. */
  inverted?: boolean | undefined;
  /** Pins the pill to one world instead of the current one. */
  world?: WorldId | undefined;
}

const SIZE_STYLES: Record<LevelIndicatorSize, { pill: string; icon: number }> = {
  sm: { pill: "h-6 gap-1 pl-1.5 pr-2 text-[12px]", icon: 12 },
  md: { pill: "h-8 gap-1.5 pl-2 pr-3 text-[13px]", icon: 16 },
};

const PILL_BASE =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border-2 font-body font-bold leading-none tabular-nums";

/* Fills read the live world variables (they morph with the theme); fallbacks match tokens.css. */
const PILL_LIGHT =
  "border-stroke bg-[var(--world-main,#ffb84d)] text-stroke shadow-[2px_2px_0_0_var(--stroke,#1a1530)]";
const PILL_INVERTED =
  "border-[color:var(--world-tint,#fff1e3)] bg-stroke text-[color:var(--world-tint,#fff1e3)] shadow-[2px_2px_0_0_var(--world-main,#ffb84d)]";

const ICON_LIGHT = "fill-[var(--world-pop,#2fd6a3)] stroke-stroke";
const ICON_INVERTED = "fill-[var(--world-main,#ffb84d)] stroke-[color:var(--world-tint,#fff1e3)]";

export const LevelIndicator = forwardRef<HTMLSpanElement, LevelIndicatorProps>(
  function LevelIndicator(
    {
      level,
      icon = "star",
      label = "Level",
      size = "md",
      inverted = false,
      world,
      className,
      ...rest
    },
    ref,
  ) {
    const sizeStyle = SIZE_STYLES[size];
    const whole = Number.isFinite(level) ? Math.max(0, Math.trunc(level)) : 0;
    const Icon = icon === "shield" ? Shield : Star;

    return (
      <span
        ref={ref}
        {...rest}
        data-world={world}
        className={cn(PILL_BASE, sizeStyle.pill, inverted ? PILL_INVERTED : PILL_LIGHT, className)}
      >
        <Icon
          aria-hidden="true"
          size={sizeStyle.icon}
          strokeWidth={2.5}
          className={cn("shrink-0", inverted ? ICON_INVERTED : ICON_LIGHT)}
        />
        <span>
          {label} {whole}
        </span>
      </span>
    );
  },
);

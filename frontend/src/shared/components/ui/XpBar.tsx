import { forwardRef, useEffect, useLayoutEffect, useRef } from "react";
import type { CSSProperties, HTMLAttributes, Ref } from "react";
import { cn } from "@/shared/lib/utils/cn";
import type { WorldId } from "@/shared/hooks/useWorld";

/* ========================================
   XpBar (Gamification, GLOBAL-STYLES-SPEC §10, §8 "XP gain")
   The level XP gauge: a chunky pill (2px ink outline, paper track) whose world `main` fill
   carries animated diagonal stripes in world `deep` (spec §5: stripes in `deep` over the
   world fills) and a Fredoka numerical label above the track.

   Feel
     stripes  march diagonally forever (a one-second linear loop; the loop distance is the
              16 px stripe period mapped along the 45° axis), skipped on the "low" effects
              tier and for reduced motion (spec §8.9)
     pulse    when the XP value increases, the fill does a quick jelly bump and the label
              pops, echoing the "+XP chip pulses" moment (spec §8); also skipped when motion
              is off

   The fill reads the live world variables, so it morphs with the theme; `world` pins it to
   one world. Announced as a progressbar with `aria-valuenow` / `aria-valuemin` /
   `aria-valuemax` and a default `valueText` of "{value} of {max} XP".
   ======================================== */

export interface XpBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
  /** Current XP within the level; values outside [0, max] are clamped. */
  value: number;
  /** XP needed to reach the next level. Default 1000. */
  max?: number | undefined;
  /** Pins the bar to one world instead of the current one. */
  world?: WorldId | undefined;
  /** Accessible name. Pass the translated text. Default "XP progress". */
  label?: string | undefined;
  /** Spoken value. Default "{value} of {max} XP". */
  valueText?: string | undefined;
  /** Shows the "{value} / {max} XP" label above the track. Default `true`. */
  showLabel?: boolean | undefined;
}

/* Stripes: 8px `deep` / 8px gap at -45°. The 16px period sits along the gradient axis, so
   shifting x by 16·√2 ≈ 22.63 px slides the pattern exactly one full period — the seamless
   loop distance. */
const STRIPE_PERIOD_PX = 16;
const STRIPE_LOOP_PX = STRIPE_PERIOD_PX * Math.SQRT2;
const STRIPE_DURATION_MS = 1000;

const PULSE_MS = 350;

function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return document.documentElement.getAttribute("data-effects-tier") !== "low";
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

/** Diagonal stripe overlay. The parent fill clips it to the pill. */
function Stripes({ stripeRef }: { stripeRef?: Ref<HTMLSpanElement> }) {
  return (
    <span
      ref={stripeRef}
      aria-hidden="true"
      className="absolute inset-0 rounded-[inherit] opacity-25"
      style={{
        backgroundImage:
          "repeating-linear-gradient(-45deg, var(--world-deep, #8f4300) 0 8px, transparent 8px 16px)",
      }}
    />
  );
}

export const XpBar = forwardRef<HTMLDivElement, XpBarProps>(function XpBar(
  {
    value,
    max = 1000,
    world,
    label = "XP progress",
    valueText,
    showLabel = true,
    className,
    style,
    ...rest
  },
  ref,
) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1000;
  const clamped = Number.isFinite(value) ? Math.min(safeMax, Math.max(0, value)) : 0;
  const percent = (clamped / safeMax) * 100;

  const fillRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const previousValue = useRef<number | null>(null);

  /* Stripes march forever; the fill mounts once per XpBar instance, so the effect is the loop. */
  useLayoutEffect(() => {
    const stripes = stripeRef.current;
    if (!stripes || !motionAllowed() || typeof stripes.animate !== "function") return;
    stripes.animate(
      [{ backgroundPosition: "0px 0px" }, { backgroundPosition: `${STRIPE_LOOP_PX}px 0px` }],
      { duration: STRIPE_DURATION_MS, easing: "linear", iterations: Infinity },
    );
  }, []);

  /* Pulse when the value increases (not on mount, not on decrease). */
  useEffect(() => {
    const previous = previousValue.current;
    previousValue.current = clamped;
    if (previous === null || clamped <= previous) return;
    if (!motionAllowed()) return;

    const fill = fillRef.current;
    if (fill && typeof fill.animate === "function") {
      fill.animate(
        [{ transform: "scaleY(1)" }, { transform: "scaleY(1.3)" }, { transform: "scaleY(1)" }],
        { duration: PULSE_MS, easing: "ease-out" },
      );
    }
    const label = labelRef.current;
    if (label && typeof label.animate === "function") {
      label.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }],
        { duration: PULSE_MS, easing: "ease-out" },
      );
    }
  }, [clamped]);

  const spoken = valueText ?? `${formatCount(clamped)} of ${formatCount(safeMax)} XP`;

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
      aria-valuetext={spoken}
      data-world={world}
      style={rootStyle}
      className={cn("flex w-full flex-col gap-1", className)}
    >
      {showLabel && (
        <span
          ref={labelRef}
          aria-hidden="true"
          className="self-end font-heading text-[13px] font-semibold leading-none text-stroke"
        >
          {formatCount(clamped)} / {formatCount(safeMax)} XP
        </span>
      )}
      <div className="h-5 overflow-hidden rounded-full border-2 border-stroke bg-surface-0">
        <div
          ref={fillRef}
          className="relative h-full rounded-full bg-[var(--world-main,#ffb84d)] transition-[width] duration-500 ease-out motion-reduce:transition-none [[data-effects-tier=low]_&]:transition-none"
          style={{ width: `${percent}%` }}
        >
          <Stripes stripeRef={stripeRef} />
        </div>
      </div>
    </div>
  );
});

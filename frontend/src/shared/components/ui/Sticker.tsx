import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   Sticker (GLOBAL-STYLES-SPEC §6.4 "Rotation and stickers", §8.4 "Cards and stickers")

   A die-cut sticker: the artwork, a white paper border, a solid ink outline and a hard ink
   drop shadow planted behind it. It rests at a small angle (-6 to +6 degrees, spec §6.4).
   On hover it tilts a little further, lifts and pops, with a springy overshoot, and the
   shadow grows; all of that is `transform` only, so it runs on the compositor at 60fps
   (spec §6.1 forbids animating box-shadow, which is why the shadow is its own layer).

   Motion is throttled in CSS, with no JS and no provider required:
     - `prefers-reduced-motion: reduce` switches the hover motion off at once (the resting angle
       is a static pose and stays);
     - the effects tier (EffectsProvider sets data-effects-tier on <html>) allows it on the
       high tier only: low and balanced stay static, as do devices without hover. With no
       EffectsProvider mounted there is no tier, so only the media preferences apply.
   The Sticker is decorative or informational and not interactive. Inside it, the artwork is
   clipped to the sticker shape, so do not put focusable controls in it; wrap the Sticker in
   a Button if it must be pressed.
   ======================================== */

export type StickerShape = "squircle" | "pill" | "circle";

export interface StickerProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  /** Resting angle in degrees, clamped to -6..6 (spec §6.4). Default 0. */
  rotate?: number | undefined;
  /** Extra degrees added on hover, in the direction of the resting angle. 0..6, default 3. */
  tilt?: number | undefined;
  /** Outline shape. `circle` is square and centers its content. Default `squircle`. */
  shape?: StickerShape | undefined;
  /** Draws the hard ink drop shadow. Default true. */
  shadow?: boolean | undefined;
}

const MAX_REST_DEGREES = 6;
const MAX_TILT_DEGREES = 6;

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : 0;

/* Ink outline radius, and the matching radius of the white paper's inside edge (outline 2px +
   paper 4px smaller), so the artwork follows the sticker's shape. */
const SHAPE_STYLES: Record<StickerShape, { outer: string; inner: string; layout: string }> = {
  squircle: { outer: "rounded-[14px]", inner: "rounded-[8px]", layout: "" },
  pill: { outer: "rounded-full", inner: "rounded-full", layout: "" },
  circle: {
    outer: "rounded-full",
    inner: "rounded-full",
    layout: "aspect-square items-center justify-center",
  },
};

/*
 * `--sticker-live` is 1 when hover motion is allowed and 0 when it is not; every hover offset
 * is multiplied by it, so a tier or a media query switches the whole effect off in one place.
 */
const ROOT_BASE =
  "relative inline-block align-middle [--sticker-live:1] [transform:rotate(var(--sticker-rest))] " +
  "[[data-effects-tier=balanced]_&]:[--sticker-live:0] " +
  "[[data-effects-tier=low]_&]:[--sticker-live:0] " +
  "motion-reduce:[--sticker-live:0] " +
  "[@media(hover:none)]:[--sticker-live:0]";

const SPRING =
  "transition-transform duration-[260ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] " +
  "[[data-effects-tier=low]_&]:transition-none";

/* Hover: tilt further, lift 2px and pop 5%. will-change is only set while hovering.
   Each Tailwind class stays whole inside one string: Tailwind finds classes by scanning text. */
const ROOT_HOVER_WILL_CHANGE = "hover:will-change-transform";
const ROOT_HOVER_TRANSFORM =
  "hover:[transform:rotate(calc(var(--sticker-rest)_+_var(--sticker-tilt)_*_var(--sticker-live)))_translateY(calc(-2px_*_var(--sticker-live)))_scale(calc(1_+_0.05_*_var(--sticker-live)))]";

/* The shadow rests 3px down and right, and grows to 5px while the sticker lifts. */
const SHADOW_BASE = "[transform:translate(3px,3px)] group-hover:will-change-transform";
const SHADOW_HOVER =
  "group-hover:[transform:translate(calc(3px_+_2px_*_var(--sticker-live)),calc(3px_+_2px_*_var(--sticker-live)))]";

export const Sticker = forwardRef<HTMLDivElement, StickerProps>(function Sticker(
  { children, rotate = 0, tilt = 3, shape = "squircle", shadow = true, className, style, ...rest },
  ref,
) {
  const shapeStyle = SHAPE_STYLES[shape];
  const restDegrees = clamp(rotate, -MAX_REST_DEGREES, MAX_REST_DEGREES);
  const tiltDegrees = clamp(tilt, 0, MAX_TILT_DEGREES) * (restDegrees < 0 ? -1 : 1);

  const vars = {
    "--sticker-rest": `${restDegrees}deg`,
    "--sticker-tilt": `${tiltDegrees}deg`,
  } as CSSProperties;

  return (
    <div
      ref={ref}
      {...rest}
      style={{ ...vars, ...style }}
      className={cn(
        "group",
        ROOT_BASE,
        SPRING,
        ROOT_HOVER_WILL_CHANGE,
        ROOT_HOVER_TRANSFORM,
        className,
      )}
    >
      {shadow && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 bg-stroke",
            shapeStyle.outer,
            SPRING,
            SHADOW_BASE,
            SHADOW_HOVER,
          )}
        />
      )}
      {/* Ink outline (2px) around a white paper border (4px) around the artwork. */}
      <div
        className={cn(
          "relative flex border-2 border-stroke bg-surface-0 p-1",
          shapeStyle.outer,
          shapeStyle.layout,
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center justify-center overflow-hidden",
            shapeStyle.inner,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
});

import { forwardRef } from "react";
import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/utils/cn";
import type { WorldId } from "@/shared/hooks/useWorld";

/* ========================================
   Arcade containers (GLOBAL-STYLES-SPEC §6.1 outline + shadow, §6.2 squircle, §10 "Card")

   Surface          the base: a solid 2px ink outline, a hard black offset shadow (no blur),
                    a fill and a radius. Nothing else.
   RetroContainer   a Surface plus an optional header band that attaches to its top edge.
   Card             lives in Card.tsx: a RetroContainer for content cards.

   Shadow depths follow tokens.css: sm 2px, md 4px, lg 8px, always down and to the right.
   Every container renders as `div`, `section` or `article` through the `as` prop, so the
   page keeps its semantic structure.

   Hoverable containers lift 4px (`-translate-y-1`) and the shadow grows one step. Only the
   transform is transitioned; the shadow swaps at once (spec §6.1: never animate box-shadow).
   The transition is dropped on the "low" effects tier and for reduced motion (spec §8.9).
   ======================================== */

/** The tags a container may render as. */
export type SurfaceTag = "div" | "section" | "article";
/** Shadow depth: `sm` 2px, `md` 4px, `lg` 8px. `none` removes the shadow. */
export type SurfaceShadow = "none" | "sm" | "md" | "lg";
/** Corner radius: `md` 12px, `lg` 20px, `xl` 24px (the card squircle). */
export type SurfaceRadius = "md" | "lg" | "xl";
/** Fill: `paper` is the white sticker paper, `tint` and `soft` follow the current world. */
export type SurfaceTone = "paper" | "tint" | "soft";
/** Inner spacing: `none`, `sm` 12px, `md` 20px, `lg` 32px. */
export type SurfacePadding = "none" | "sm" | "md" | "lg";
/** World accent fill of a header band. */
export type HeaderBandTone = "main" | "soft" | "pop";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  /** Element to render. Default `div`. */
  as?: SurfaceTag | undefined;
  /** Shadow depth. Default `md`. */
  shadow?: SurfaceShadow | undefined;
  /** Corner radius. Default `xl`. */
  radius?: SurfaceRadius | undefined;
  /** Fill. Default `paper`. */
  tone?: SurfaceTone | undefined;
  /** Inner spacing. Default `md`. */
  padding?: SurfacePadding | undefined;
  /** Pins the container (and its band) to one world instead of the current one. */
  world?: WorldId | undefined;
  /** Lifts on hover: moves up 4px and the shadow grows one step. Default `false`. */
  hoverable?: boolean | undefined;
}

export interface RetroContainerProps extends Omit<SurfaceProps, "padding"> {
  /** Content of the header band. The band is not rendered when this is empty. */
  header?: ReactNode;
  /** World accent fill of the header band. Default `main`. */
  headerTone?: HeaderBandTone | undefined;
  /** Inner spacing of the body, below the header band. Default `md`. */
  padding?: SurfacePadding | undefined;
}

/* Spec §6.1: hard offset shadows in black, from the `retro-*` shadow tokens in tailwind.config. */
const SHADOW: Record<SurfaceShadow, string> = {
  none: "",
  sm: "shadow-retro-sm",
  md: "shadow-retro-md",
  lg: "shadow-retro-lg",
};

/* One step bigger on hover. `lg` grows to 12px (spec shadow-xl). */
const SHADOW_HOVER: Record<SurfaceShadow, string> = {
  none: "",
  sm: "hover:shadow-retro-md",
  md: "hover:shadow-retro-lg",
  lg: "hover:shadow-[12px_12px_0_0_#000]",
};

const HOVER_LIFT =
  "transition-transform duration-150 ease-out hover:-translate-y-1 motion-reduce:transition-none [[data-effects-tier=low]_&]:transition-none";

const RADIUS: Record<SurfaceRadius, string> = {
  md: "rounded-[12px]",
  lg: "rounded-[20px]",
  xl: "rounded-[24px]",
};

/* The band sits inside the 2px border, so its top corners are the outer radius minus 2px. */
const BAND_RADIUS: Record<SurfaceRadius, string> = {
  md: "rounded-t-[10px]",
  lg: "rounded-t-[18px]",
  xl: "rounded-t-[22px]",
};

/* Fills read the live world variables (they morph with the theme); fallbacks match tokens.css. */
const TONE: Record<SurfaceTone, string> = {
  paper: "bg-surface-0",
  tint: "bg-[var(--world-tint,#fff1e3)]",
  soft: "bg-[var(--world-soft,#ffd93d)]",
};

const BAND_TONE: Record<HeaderBandTone, string> = {
  main: "bg-[var(--world-main,#ffb84d)]",
  soft: "bg-[var(--world-soft,#ffd93d)]",
  pop: "bg-[var(--world-pop,#2fd6a3)]",
};

const PADDING: Record<SurfacePadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-8",
};

/* A 2px ink rule under the band closes it against the body. Ink text on every world fill. */
const BAND_BASE =
  "card-header-band flex min-h-12 shrink-0 items-center gap-2 border-b-2 border-stroke px-5 py-3 font-heading text-[18px] font-semibold leading-tight text-stroke";

/** A solid-outlined, hard-shadowed box. The base of every retro container. */
export const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface(
  {
    as = "div",
    shadow = "md",
    radius = "xl",
    tone = "paper",
    padding = "md",
    world,
    hoverable = false,
    className,
    ...rest
  },
  ref,
) {
  const Tag: ElementType = as;
  const setRef = (node: HTMLElement | null) => {
    if (typeof ref === "function") ref(node);
    else if (ref !== null) ref.current = node;
  };

  return (
    <Tag
      ref={setRef}
      {...rest}
      data-world={world}
      className={cn(
        "relative border-2 border-stroke text-stroke",
        RADIUS[radius],
        TONE[tone],
        SHADOW[shadow],
        PADDING[padding],
        hoverable && HOVER_LIFT,
        hoverable && SHADOW_HOVER[shadow],
        className,
      )}
    />
  );
});

/** A Surface with an optional header band attached to its top edge. */
export const RetroContainer = forwardRef<HTMLElement, RetroContainerProps>(function RetroContainer(
  { header, headerTone = "main", padding = "md", radius = "xl", className, children, ...rest },
  ref,
) {
  const hasHeader = header !== undefined && header !== null && header !== false;

  return (
    <Surface
      ref={ref}
      {...rest}
      radius={radius}
      padding="none"
      className={cn("flex flex-col", className)}
    >
      {hasHeader && (
        <div className={cn(BAND_BASE, BAND_RADIUS[radius], BAND_TONE[headerTone])}>{header}</div>
      )}
      <div className={cn("min-w-0 flex-1", PADDING[padding])}>{children}</div>
    </Surface>
  );
});

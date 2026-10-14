import { useLayoutEffect, useRef, forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils/cn";
import type { WorldId } from "@/shared/hooks/useWorld";

/* ========================================
   Arcade Skeleton (Feedback & Loading, GLOBAL-STYLES-SPEC §8 "Loading", §5 "Halftone")
   A sticker placeholder for content that has not loaded yet. Size it with `className`
   (`h-4 w-full`, `h-24`, …) so it matches the layout dimensions of what it stands in for;
   `shape` rounds it like the thing it replaces.

   Feel: a gentle breathing pulse (opacity 1 → 0.72 → 1, 1.8 s) over a halftone dot pattern in
   world `deep` — a soft shimmer, never the aggressive full flash (spec §8). Motion is skipped
   under prefers-reduced-motion and `data-effects-tier="low"` (spec §8.9).

   Accessibility: with the default `label` the block is a polite `role="status"` announcing
   "Loading…"; pass `label={null}` for purely decorative skeletons inside a group that already
   announces the loading state. The dots read the live world variables; `world` pins them.
   ======================================== */

export type SkeletonShape = "rect" | "circle" | "text";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Corner rounding of the placeholder: `rect` (rounded block, default), `circle`
      (fully round — give it a square `className`), or `text` (a 16px-tall line). */
  shape?: SkeletonShape | undefined;
  /** Pins the dot pattern to one world instead of the current one. */
  world?: WorldId | undefined;
  /**
   * Screen-reader text announcing the loading state; renders the block as a polite
   * `role="status"`. Default "Loading…". Pass `null` to make the skeleton purely
   * decorative (use one announcing wrapper for a whole skeleton group).
   */
  label?: string | null | undefined;
}

const PULSE_MS = 1800;

const SHAPE_CLASS: Record<SkeletonShape, string> = {
  rect: "rounded-[10px]",
  circle: "rounded-full",
  text: "h-4 w-full rounded-full",
};

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { shape = "rect", world, label = "Loading…", className, style, ...rest },
  ref,
) {
  const innerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.documentElement.getAttribute("data-effects-tier") === "low") return;
    if (typeof el.animate !== "function") return;
    el.animate([{ opacity: 1 }, { opacity: 0.72 }, { opacity: 1 }], {
      duration: PULSE_MS,
      easing: "ease-in-out",
      iterations: Infinity,
    });
  }, []);

  const setRefs = (node: HTMLDivElement | null) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <div
      ref={setRefs}
      role={label ? "status" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      data-world={world}
      style={style}
      {...rest}
      className={cn("relative bg-surface-200", SHAPE_CLASS[shape], className)}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-[inherit]"
        style={{
          backgroundImage: "radial-gradient(var(--world-deep, #8f4300) 1.5px, transparent 1.5px)",
          backgroundSize: "10px 10px",
          opacity: 0.12,
        }}
      />
    </div>
  );
});

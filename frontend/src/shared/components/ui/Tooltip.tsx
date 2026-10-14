import { useLayoutEffect, useRef, type ComponentPropsWithoutRef, type Ref } from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   Arcade Tooltip (Overlays & Feedback, Contextual Help)
   Built on Radix Tooltip, which supplies the WAI-ARIA tooltip pattern: the trigger is
   described via `aria-describedby` (the content carries `role="tooltip"` and its id is wired
   automatically), the tooltip shows on hover AND keyboard focus with a 200 ms delay, and it
   never steals focus — the content is not focusable, so the parent element keeps it while the
   tooltip reads. Escape dismisses it; moving focus or the pointer away hides it.

   Look
     bubble  dark ink fill (`bg-stroke`), white body text, 2px ink border, crisp 10px rounded
             corners, small 2px black offset shadow
     arrow   filled to match the bubble
     motion  a quick fade-and-pop entrance, skipped under prefers-reduced-motion and
             `data-effects-tier="low"` (spec §8.9)

   Wrap the tree (or just the tooltip) in `Tooltip.Provider`; it supplies the 200 ms delay and
   groups neighboring tooltips so quick hopping between triggers feels instant. Positioning
   uses Radix's collision detection (`avoidCollisions`) with a viewport padding, so the bubble
   always stays on screen.
   ======================================== */

/* ---- Bubble ---- */

const CONTENT_BASE =
  "z-50 max-w-xs select-none rounded-[10px] border-2 border-stroke bg-stroke px-3 py-1.5 text-[13px] font-medium leading-snug text-surface-0 shadow-retro-sm outline-none";

/* ---- Entrance ----
   Radix mounts the content only while open, so the layout effect runs once per open. */

const ENTRANCE_MS = 120;
const ENTRANCE_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return document.documentElement.getAttribute("data-effects-tier") !== "low";
}

function useEntrance(): Ref<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !motionAllowed() || typeof el.animate !== "function") return;
    el.animate(
      [
        { opacity: 0, transform: "scale(0.9)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: ENTRANCE_MS, easing: ENTRANCE_EASING, fill: "backwards" },
    );
  }, []);

  return ref;
}

/* ---- Styled parts ---- */

function TooltipContent({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  ...props
}: ComponentPropsWithoutRef<typeof RadixTooltip.Content>) {
  const entranceRef = useEntrance();
  return (
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        ref={entranceRef}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        {...props}
        className={cn(CONTENT_BASE, className)}
      />
    </RadixTooltip.Portal>
  );
}

/* ---- Namespaced component ---- */

function TooltipProvider({
  delayDuration = 200,
  ...props
}: ComponentPropsWithoutRef<typeof RadixTooltip.Provider>) {
  return <RadixTooltip.Provider delayDuration={delayDuration} {...props} />;
}

function TooltipRoot(props: ComponentPropsWithoutRef<typeof RadixTooltip.Root>) {
  return <RadixTooltip.Root {...props} />;
}

export const Tooltip = Object.assign(TooltipRoot, {
  /** Wrap your tree once (or wrap each tooltip) to set the 200 ms delay and group
      neighboring tooltips. */
  Provider: TooltipProvider,
  /** The element (usually a help `IconButton`, via `asChild`) the tooltip describes. Shows
      the tooltip on hover and keyboard focus without taking focus itself. */
  Trigger: RadixTooltip.Trigger,
  /** The dark speech bubble. Renders through a portal with collision detection. */
  Content: TooltipContent,
  /** Filled arrow matching the bubble; place inside `Content`. */
  Arrow: function TooltipArrow({
    className,
    ...props
  }: ComponentPropsWithoutRef<typeof RadixTooltip.Arrow>) {
    return <RadixTooltip.Arrow {...props} className={cn("fill-stroke", className)} />;
  },
});

export type TooltipProps = ComponentPropsWithoutRef<typeof RadixTooltip.Root>;
export type TooltipContentProps = ComponentPropsWithoutRef<typeof RadixTooltip.Content>;

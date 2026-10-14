import { useLayoutEffect, useRef, type ComponentPropsWithoutRef, type Ref } from "react";
import * as RadixPopover from "@radix-ui/react-popover";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   Arcade Popover (Overlays & Feedback, Contextual Help)
   Built on Radix Popover, which supplies the WAI-ARIA window pattern: the trigger is
   `aria-expanded` / `aria-haspopup="dialog"`, the panel is `role="dialog"` with its title and
   description wired through `PopoverTitle` / `PopoverDescription` (aria-labelledby /
   aria-describedby), and Escape or an outside click closes it.

   Look — the Surface recipe for floating panels:
     panel   solid 2px ink outline, hard 4px black offset shadow (`shadow-retro-md`),
             crisp 12px rounded corners, paper fill, inner spacing like a small card
     title   Fredoka heading; description in muted body text
     motion  a quick fade-and-pop entrance, skipped under prefers-reduced-motion and
             `data-effects-tier="low"` (spec §8.9)

   Use it for rich contextual help: XP formulas, badge requirements, setting explainers.
   Positioning uses Radix's collision detection (`avoidCollisions`) with a viewport padding,
   and the panel caps its height to the available viewport space so tall content scrolls
   (opting out of Lenis with `data-lenis-prevent`, spec: nested scroll areas).
   ======================================== */

/* ---- Panel ---- */

const CONTENT_BASE =
  "z-50 flex max-w-[calc(100vw-1rem)] flex-col overflow-y-auto overscroll-contain rounded-[12px] border-2 border-stroke bg-surface-0 p-5 text-stroke shadow-retro-md outline-none";

/* ---- Entrance ----
   Radix mounts the content only while open, so the layout effect runs once per open.
   Exit is immediate. */

const ENTRANCE_MS = 160;
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
        { opacity: 0, transform: "scale(0.92)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: ENTRANCE_MS, easing: ENTRANCE_EASING, fill: "backwards" },
    );
  }, []);

  return ref;
}

/* ---- Styled parts ---- */

function PopoverContent({
  className,
  align = "center",
  sideOffset = 6,
  collisionPadding = 8,
  ...props
}: ComponentPropsWithoutRef<typeof RadixPopover.Content>) {
  const entranceRef = useEntrance();
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        ref={entranceRef}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        data-lenis-prevent
        {...props}
        className={cn(
          CONTENT_BASE,
          "max-h-[min(24rem,var(--radix-popover-content-available-height))]",
          className,
        )}
      />
    </RadixPopover.Portal>
  );
}

/* ---- Namespaced component ---- */

function PopoverRoot(props: ComponentPropsWithoutRef<typeof RadixPopover.Root>) {
  return <RadixPopover.Root {...props} />;
}

export const Popover = Object.assign(PopoverRoot, {
  /** The button (or any element, via `asChild`) that opens the popover. */
  Trigger: RadixPopover.Trigger,
  /** The styled panel. Renders through a portal with collision detection. */
  Content: PopoverContent,
  /** Accessible name of the panel; wire it through `aria-labelledby` automatically. */
  Title: function PopoverTitle({
    className,
    ...props
  }: ComponentPropsWithoutRef<typeof RadixPopover.Title>) {
    return (
      <RadixPopover.Title
        {...props}
        className={cn("font-heading text-[18px] font-semibold leading-tight", className)}
      />
    );
  },
  /** Accessible description; announced after the title automatically. */
  Description: function PopoverDescription({
    className,
    ...props
  }: ComponentPropsWithoutRef<typeof RadixPopover.Description>) {
    return (
      <RadixPopover.Description
        {...props}
        className={cn("text-[14px] leading-snug text-muted", className)}
      />
    );
  },
  /** Filled arrow pointing at the trigger; place inside `Content`. */
  Arrow: function PopoverArrow({
    className,
    ...props
  }: ComponentPropsWithoutRef<typeof RadixPopover.Arrow>) {
    return <RadixPopover.Arrow {...props} className={cn("fill-surface-0", className)} />;
  },
  /** Wrap a button (use `asChild`) to dismiss the popover on click. */
  Close: RadixPopover.Close,
});

export type PopoverProps = ComponentPropsWithoutRef<typeof RadixPopover.Root>;
export type PopoverContentProps = ComponentPropsWithoutRef<typeof RadixPopover.Content>;

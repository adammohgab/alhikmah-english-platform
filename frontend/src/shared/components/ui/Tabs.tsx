import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   Arcade Tabs (GLOBAL-STYLES-SPEC §10 "Tabs", §8.4 "Form controls")

   Built on Radix Tabs, so the ARIA tabs pattern and the keyboard model come from the primitive:
     Tab                    moves focus into the tab list (on the selected tab), then to the panel
     Arrow Left / Right     move focus to the previous or next tab and select it (they wrap;
                            Up and Down do the same when `orientation="vertical"`)
     Home / End             first and last tab
     Disabled tabs are skipped. Roles are `tablist`, `tab` (with `aria-selected`) and `tabpanel`.
   Direction: Radix does not read the page direction, so `Tabs` reads `<html dir>` for you.
   Under `dir="rtl"` the arrow keys flip. Pass `dir` to override.

   Look: a pill-shaped list with a 2px ink outline and a hard 2px shadow. One pill (world `main`
   fill, 2px ink outline) sits behind the selected tab and slides to the next one. Labels are ink
   on every surface, so selected and unselected tabs keep the same high contrast; selection is
   also carried by the pill outline, never by color alone. Inactive tabs take a `soft` tint on
   hover.

   The pill is measured, not animated by a layout library: it follows the selected tab through a
   MutationObserver (selection) and a ResizeObserver (size, fonts, window), and moves with a
   `transform` transition plus a width transition on the overshoot curve. It does not animate on
   first paint, the "low" effects tier drops the motion, and the global reduced-motion rule in
   base.css finishes it instantly.

   Usage:
     <Tabs defaultValue="all">
       <TabsList aria-label="Lesson filter">
         <TabsTrigger value="all">All</TabsTrigger>
         <TabsTrigger value="done">Done</TabsTrigger>
       </TabsList>
       <TabsContent value="all">...</TabsContent>
       <TabsContent value="done">...</TabsContent>
     </Tabs>
   Give every list an accessible name (`aria-label` or `aria-labelledby`).
   ======================================== */

export type TabsSize = "sm" | "md";

function documentDirection(): "ltr" | "rtl" {
  if (typeof document === "undefined") return "ltr";
  return document.documentElement.dir === "rtl" ? "rtl" : "ltr";
}

/* ---------- Root ---------- */

export type TabsProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Root>;

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  { dir, className, ...rest },
  ref,
) {
  return (
    <TabsPrimitive.Root
      ref={ref}
      dir={dir ?? documentDirection()}
      className={cn("flex flex-col", className)}
      {...rest}
    />
  );
});

/* ---------- List with the sliding pill ---------- */

export interface TabsListProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  /** `sm` is 32px tall, `md` is 40px. Default `md`. */
  size?: TabsSize | undefined;
  /** Stretches the list to the full width and gives every tab an equal share. */
  fullWidth?: boolean | undefined;
}

interface PillBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* Overshoot on release; the "low" effects tier drops the transition (spec §8.9). */
const PILL_MOTION =
  "transition-[transform,width] duration-[200ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] [[data-effects-tier=low]_&]:transition-none";

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(function TabsList(
  { size = "md", fullWidth = false, className, children, ...rest },
  ref,
) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<PillBox | null>(null);
  const [animate, setAnimate] = useState(false);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  // Follow the selected tab: selection changes, size changes, fonts and window resizes.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (!active) {
        setBox(null);
        return;
      }
      const next: PillBox = {
        x: active.offsetLeft,
        y: active.offsetTop,
        w: active.offsetWidth,
        h: active.offsetHeight,
      };
      setBox((prev) =>
        prev?.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h
          ? prev
          : next,
      );
    };

    measure();

    const mutations = new MutationObserver(measure);
    mutations.observe(list, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
    const resizes = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    resizes?.observe(list);
    window.addEventListener("resize", measure);
    // Web fonts change label widths after the first paint.
    void document.fonts?.ready.then(measure);

    return () => {
      cancelled = true;
      mutations.disconnect();
      resizes?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // No slide on first paint: the pill appears in place, then transitions are switched on.
  useEffect(() => {
    if (box === null || animate) return undefined;
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [box, animate]);

  return (
    <TabsPrimitive.List
      ref={setRefs}
      data-size={size}
      data-full={fullWidth ? "true" : undefined}
      className={cn(
        "group relative max-w-full items-center gap-1 overflow-x-auto rounded-full border-2 border-stroke bg-surface-0 p-1 shadow-retro-sm",
        fullWidth ? "flex w-full" : "inline-flex",
        className,
      )}
      {...rest}
    >
      {box !== null && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-0 top-0 rounded-full border-2 border-stroke bg-[var(--world-main,#ffb84d)]",
            animate && PILL_MOTION,
          )}
          style={{ width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)` }}
        />
      )}
      {children}
    </TabsPrimitive.List>
  );
});

/* ---------- Trigger ---------- */

export interface TabsTriggerProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  /**
   * Set to `false` when no `TabsContent` exists for this tab (SegmentedControl). It drops the
   * `aria-controls` link, which would otherwise point to an element that is not in the page.
   * Default `true`.
   */
  panel?: boolean | undefined;
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(function TabsTrigger(
  { panel = true, className, ...rest },
  ref,
) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      // Radix spreads these props last, so an explicit `undefined` removes `aria-controls`.
      {...(panel ? null : ({ "aria-controls": undefined } as object))}
      className={cn(
        "relative z-10 inline-flex h-10 shrink-0 touch-manipulation select-none items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-transparent bg-transparent px-5 font-heading text-[15px] font-semibold text-stroke [-webkit-tap-highlight-color:transparent]",
        "group-data-[size=sm]:h-8 group-data-[size=sm]:px-4 group-data-[size=sm]:text-[14px]",
        "group-data-[full=true]:flex-1",
        "data-[state=inactive]:enabled:hover:bg-[var(--world-soft,#ffd93d)]",
        "data-[disabled]:cursor-not-allowed data-[disabled]:text-muted",
        "[&_svg]:shrink-0 [&_svg]:[stroke-width:2.5]",
        className,
      )}
      {...rest}
    />
  );
});

/* ---------- Content ---------- */

export type TabsContentProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Content>;

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(function TabsContent(
  { className, ...rest },
  ref,
) {
  return <TabsPrimitive.Content ref={ref} className={cn("mt-4", className)} {...rest} />;
});

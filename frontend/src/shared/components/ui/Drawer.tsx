import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { IconButton } from "./IconButton";

/* ========================================
   Arcade Drawer (Overlays & Feedback, Mobile Drawer Specs)
   Radix Dialog gives the WAI-ARIA modal pattern: role="dialog", title/description announced,
   focus trapped while open and restored on dismiss, Escape and overlay click close it.

   Responsive (same breakpoint as Tailwind `md`, 768px), chosen automatically:
     < 768px    bottom sheet: slides up, drag handle on top, swipe down to dismiss
     >= 768px   right slide-over: full height, for inspector sheets or Copilot chats

   Swipe to dismiss (handle only, so the body keeps scrolling normally): the sheet follows the
   finger, then dismisses when dragged past 35% of its height or released faster than 0.5 px/ms
   downward; otherwise it springs back. Keyboard users have Escape and the close button.

   Look: backdrop `bg-black/40 backdrop-blur-sm`, 2px ink outline, hard retro shadow, squircle
   corners on the free edge. Motion is skipped under prefers-reduced-motion and
   `data-effects-tier="low"`. Slots match Dialog: title, description, children, footer.
   ======================================== */

export type DrawerSize = "sm" | "md" | "lg";

export interface DrawerProps {
  /** Controlled open state. */
  open?: boolean | undefined;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** Element that opens the drawer; focus returns to it on dismiss. Must accept a ref and props. */
  trigger?: ReactNode | undefined;
  /** Accessible name of the drawer. Required: it is announced when the drawer opens. */
  title: ReactNode;
  /** Accessible description, announced after the title. */
  description?: ReactNode | undefined;
  /** Body content. Scrolls inside the panel. */
  children?: ReactNode | undefined;
  /** Action slot rendered in a bar at the bottom. */
  footer?: ReactNode | undefined;
  /** Desktop panel max width: 384px, 448px (default) or 576px. Ignored on mobile. */
  size?: DrawerSize | undefined;
  /** Shows the corner close button. Default `true`. */
  showCloseButton?: boolean | undefined;
  /** Accessible name of the close button. Default "Close". */
  closeLabel?: string | undefined;
  /** Extra classes for the panel. */
  className?: string | undefined;
}

const DESKTOP_SIZE: Record<DrawerSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
};

const PANEL_BASE = "fixed z-50 flex flex-col border-stroke bg-surface-0 text-stroke outline-none";
const PANEL_BOTTOM =
  "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-[24px] border-x-2 border-t-2 shadow-[0_-4px_0_0_#000]";
const PANEL_RIGHT =
  "inset-y-0 right-0 w-full rounded-l-[24px] border-y-2 border-l-2 shadow-[-8px_0_0_0_#000]";

/* ---- Breakpoint ---- */

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeDesktop(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getDesktopSnapshot(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DESKTOP_QUERY).matches;
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, () => false);
}

/* ---- Motion ----
   Radix's Presence only delays unmount for CSS animations, so the entrance runs through the Web
   Animations API from a layout effect (before first paint). Exit on Escape / overlay is immediate;
   a swipe dismiss animates the sheet away first. */

const SLIDE_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const SLIDE_DURATION_MS = 320;
const DISMISS_DISTANCE_RATIO = 0.35;
const DISMISS_VELOCITY_PX_PER_MS = 0.5;
const VELOCITY_WINDOW_MS = 100;

function motionAllowed(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return document.documentElement.getAttribute("data-effects-tier") !== "low";
}

interface DragState {
  pointerId: number;
  startY: number;
  dy: number;
  samples: Array<{ y: number; t: number }>;
}

/** Pointer handlers for the drag handle: follow the finger, then dismiss or spring back. */
function useSheetDrag(panelRef: RefObject<HTMLElement>, onDismiss: () => void) {
  const drag = useRef<DragState | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      dy: 0,
      samples: [{ y: event.clientY, t: event.timeStamp }],
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    const panel = panelRef.current;
    if (state?.pointerId !== event.pointerId || !panel) return;
    state.dy = Math.max(0, event.clientY - state.startY);
    state.samples.push({ y: event.clientY, t: event.timeStamp });
    if (state.samples.length > 8) state.samples.shift();
    panel.style.transform = `translateY(${state.dy}px)`;
  };

  const finish = (event: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    const state = drag.current;
    const panel = panelRef.current;
    if (state?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (!panel) return;

    const recent = state.samples.filter((s) => event.timeStamp - s.t <= VELOCITY_WINDOW_MS);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const elapsed = first && last ? last.t - first.t : 0;
    const velocity = first && last && elapsed > 0 ? (last.y - first.y) / elapsed : 0;

    const shouldDismiss =
      !cancelled &&
      state.dy > 0 &&
      (state.dy > panel.offsetHeight * DISMISS_DISTANCE_RATIO ||
        velocity > DISMISS_VELOCITY_PX_PER_MS);

    const animated = motionAllowed() && typeof panel.animate === "function";

    if (shouldDismiss) {
      if (!animated) {
        onDismiss();
        return;
      }
      panel.style.transform = "translateY(100%)";
      panel
        .animate([{ transform: `translateY(${state.dy}px)` }, { transform: "translateY(100%)" }], {
          duration: 180,
          easing: "ease-in",
        })
        .finished.then(onDismiss, onDismiss);
      return;
    }

    panel.style.transform = "";
    if (animated && state.dy > 0) {
      panel.animate([{ transform: `translateY(${state.dy}px)` }, { transform: "translateY(0)" }], {
        duration: 260,
        easing: SLIDE_EASING,
      });
    }
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => finish(event, false),
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => finish(event, true),
  };
}

/** The overlay and panel pair. Mounted by the Portal only while open, so the effect is the entrance. */
function DrawerLayer({
  isDesktop,
  size,
  className,
  hasDescription,
  onDismiss,
  children,
}: {
  isDesktop: boolean;
  size: DrawerSize;
  className: string | undefined;
  hasDescription: boolean;
  onDismiss: () => void;
  children: (handleProps: ReturnType<typeof useSheetDrag>) => ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const handleProps = useSheetDrag(panelRef, onDismiss);

  useLayoutEffect(() => {
    if (!motionAllowed()) return;
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (overlay && typeof overlay.animate === "function") {
      overlay.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 200,
        easing: "ease-out",
        fill: "backwards",
      });
    }
    if (panel && typeof panel.animate === "function") {
      const from = isDesktop ? "translateX(100%)" : "translateY(100%)";
      const to = isDesktop ? "translateX(0)" : "translateY(0)";
      panel.animate([{ transform: from }, { transform: to }], {
        duration: SLIDE_DURATION_MS,
        easing: SLIDE_EASING,
        fill: "backwards",
      });
    }
    // Runs once per open; the layer remounts each time the drawer opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <RadixDialog.Overlay
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      />
      {/* Without a Description, an explicit undefined drops the dangling aria-describedby. */}
      <RadixDialog.Content
        ref={panelRef}
        {...(hasDescription ? {} : { "aria-describedby": undefined })}
        data-side={isDesktop ? "right" : "bottom"}
        className={cn(
          PANEL_BASE,
          isDesktop ? cn(PANEL_RIGHT, DESKTOP_SIZE[size]) : PANEL_BOTTOM,
          className,
        )}
      >
        {children(handleProps)}
      </RadixDialog.Content>
    </>
  );
}

export function Drawer({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  size = "md",
  showCloseButton = true,
  closeLabel = "Close",
  className,
}: DrawerProps) {
  const isDesktop = useIsDesktop();
  const hasDescription = description !== undefined && description !== null && description !== false;
  const hasBody = children !== undefined && children !== null && children !== false;
  const hasFooter = footer !== undefined && footer !== null && footer !== false;

  /* Open state is held here (controlled or not) so a swipe dismiss can close an uncontrolled drawer. */
  const [innerOpen, setInnerOpen] = useState(defaultOpen ?? false);
  const isOpen = open ?? innerOpen;
  const setOpen = (next: boolean) => {
    if (open === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  };

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={setOpen}>
      {trigger !== undefined && trigger !== null && (
        <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      )}
      <RadixDialog.Portal>
        <div className="contents">
          <DrawerLayer
            isDesktop={isDesktop}
            size={size}
            className={className}
            hasDescription={hasDescription}
            onDismiss={() => setOpen(false)}
          >
            {(handleProps) => (
              <>
                {!isDesktop && (
                  /* Decorative: the swipe is a touch shortcut; Escape and the close button remain. */
                  <div
                    aria-hidden="true"
                    data-drawer-handle
                    {...handleProps}
                    className="flex h-8 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
                  >
                    <span className="h-1.5 w-12 rounded-full bg-stroke/40" />
                  </div>
                )}

                <header
                  className={cn(
                    "flex flex-col gap-1 px-6",
                    isDesktop ? "pt-6" : "pt-1",
                    showCloseButton && "pr-16",
                    !hasBody && !hasFooter && "pb-6",
                  )}
                >
                  <RadixDialog.Title className="font-heading text-[20px] font-semibold leading-tight text-stroke">
                    {title}
                  </RadixDialog.Title>
                  {hasDescription ? (
                    <RadixDialog.Description className="text-[15px] leading-snug text-muted">
                      {description}
                    </RadixDialog.Description>
                  ) : null}
                </header>

                {showCloseButton && (
                  <RadixDialog.Close asChild>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label={closeLabel}
                      className={cn("absolute right-3", isDesktop ? "top-3" : "top-8")}
                    >
                      <X size={20} aria-hidden="true" />
                    </IconButton>
                  </RadixDialog.Close>
                )}

                {hasBody && (
                  <div
                    data-lenis-prevent
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4"
                  >
                    {children}
                  </div>
                )}

                {hasFooter && (
                  <footer
                    className={cn(
                      "flex flex-wrap items-center justify-end gap-3 border-t-2 border-stroke px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
                      !hasBody && "mt-4",
                    )}
                  >
                    {footer}
                  </footer>
                )}
              </>
            )}
          </DrawerLayer>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Wrap a button in the `footer` slot to make it dismiss the drawer (use with `asChild`). */
export const DrawerClose = RadixDialog.Close;

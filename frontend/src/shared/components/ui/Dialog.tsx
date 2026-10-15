import { forwardRef, useLayoutEffect, useRef, type ReactNode } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { IconButton } from "./IconButton";
import { Surface } from "./Surface";

/* ========================================
   Arcade Dialog / Modal (Overlays & Feedback)
   Built on Radix Dialog, which supplies the WAI-ARIA Dialog (Modal) pattern:
     role="dialog" + aria-modal, title and description wired through aria-labelledby /
     aria-describedby (screen readers announce both), focus trap while open, focus restored to the
     trigger on dismiss, closes on Escape and on overlay click, page scroll locked.

   Look
     backdrop   `bg-black/40 backdrop-blur-sm`
     panel      Surface: solid 2px ink outline, hard retro shadow (lg), squircle 24, paper fill
     entrance   panel scales in and fades with spring physics (underdamped spring sampled into a
                CSS `linear()` easing, cubic-bezier overshoot where `linear()` is unsupported)
     motion     skipped under prefers-reduced-motion and `data-effects-tier="low"`

   Slots: `title` (required, announced), `description`, `children` (body), `footer` (actions) and
   an optional close button. Use `DialogClose` inside `footer` for buttons that dismiss.
   `Modal` is the same component under its UI-kit alias.
   ======================================== */

export type DialogSize = "sm" | "md" | "lg";

export interface DialogProps {
  /** Controlled open state. */
  open?: boolean | undefined;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** Element that opens the dialog; focus returns to it on dismiss. Must accept a ref and props. */
  trigger?: ReactNode | undefined;
  /** Accessible name of the dialog. Required: it is announced when the dialog opens. */
  title: ReactNode;
  /** Accessible description, announced after the title. */
  description?: ReactNode | undefined;
  /** Body content. Scrolls inside the panel when taller than the viewport. */
  children?: ReactNode | undefined;
  /** Action slot rendered in a bar at the bottom, right-aligned. */
  footer?: ReactNode | undefined;
  /** Panel max width: 384px, 512px (default) or 672px. */
  size?: DialogSize | undefined;
  /** Shows the corner close button. Default `true`. */
  showCloseButton?: boolean | undefined;
  /** Accessible name of the close button. Default "Close". */
  closeLabel?: string | undefined;
  /** Extra classes for the panel. */
  className?: string | undefined;
}

const SIZE: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

/* ---- Spring entrance ----
   Radix's Presence only delays unmount for CSS animations, so the entrance runs through the Web
   Animations API from a layout effect (no keyframes needed in tailwind/globals, applied before
   first paint). Exit is immediate. */

const SPRING_DURATION_MS = 450;
const OVERSHOOT_FALLBACK = "cubic-bezier(0.34, 1.56, 0.64, 1)";

/** Samples x(t) of a damped spring (damping ratio 0.6, ~9% overshoot) into a CSS linear() easing. */
function buildSpringEasing(): string {
  const zeta = 0.6;
  const omega = 12;
  const omegaD = omega * Math.sqrt(1 - zeta * zeta);
  const points: string[] = [];
  const steps = 40;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x =
      i === steps
        ? 1
        : 1 -
          Math.exp(-zeta * omega * t) *
            (Math.cos(omegaD * t) + ((zeta * omega) / omegaD) * Math.sin(omegaD * t));
    points.push(String(Math.round(x * 1000) / 1000));
  }
  return `linear(${points.join(", ")})`;
}

let springEasing: string | undefined;

function getSpringEasing(): string {
  if (springEasing === undefined) {
    const supported =
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("animation-timing-function", "linear(0, 1)");
    springEasing = supported ? buildSpringEasing() : OVERSHOOT_FALLBACK;
  }
  return springEasing;
}

function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return document.documentElement.getAttribute("data-effects-tier") !== "low";
}

/** The overlay and panel pair. Mounted by the Portal only while open, so the effect is the entrance. */
const DialogLayer = forwardRef<
  HTMLDivElement,
  {
    size: DialogSize;
    className: string | undefined;
    hasDescription: boolean;
    children: ReactNode;
  }
>(function DialogLayer(
  {
    size,
    className,
    hasDescription,
    children,
  },
  ref,
) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!motionAllowed()) return;

    if (overlay && typeof overlay.animate === "function") {
      overlay.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 200,
        easing: "ease-out",
        fill: "backwards",
      });
    }
    if (panel && typeof panel.animate === "function") {
      panel.animate(
        [
          { opacity: 0, transform: "scale(0.85) translateY(12px)", offset: 0 },
          { opacity: 1, transform: "scale(1) translateY(0)", offset: 1 },
        ],
        { duration: SPRING_DURATION_MS, easing: getSpringEasing(), fill: "backwards" },
      );
    }
  }, []);

  return (
    <>
      <RadixDialog.Overlay
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      />
      {/* The wrapper centers the panel so the animated transform is free of positioning. */}
      <div ref={ref} className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Without a Description, an explicit undefined drops the dangling aria-describedby. */}
        <RadixDialog.Content asChild {...(hasDescription ? {} : { "aria-describedby": undefined })}>
          <Surface
            ref={panelRef}
            shadow="lg"
            radius="xl"
            padding="none"
            className={cn(
              "pointer-events-auto relative flex max-h-[calc(100dvh-2rem)] w-full flex-col",
              SIZE[size],
              className,
            )}
          >
            {children}
          </Surface>
        </RadixDialog.Content>
      </div>
    </>
  );
});

export function Dialog({
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
}: DialogProps) {
  const hasDescription = description !== undefined && description !== null && description !== false;
  const hasBody = children !== undefined && children !== null && children !== false;
  const hasFooter = footer !== undefined && footer !== null && footer !== false;

  const rootProps: RadixDialog.DialogProps = {};
  if (open !== undefined) rootProps.open = open;
  if (defaultOpen !== undefined) rootProps.defaultOpen = defaultOpen;
  if (onOpenChange !== undefined) rootProps.onOpenChange = onOpenChange;

  return (
    <RadixDialog.Root {...rootProps}>
      {trigger !== undefined && trigger !== null && (
        <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      )}
      <RadixDialog.Portal>
        <DialogLayer size={size} className={className} hasDescription={hasDescription}>
          <header
            className={cn(
              "flex flex-col gap-1 px-6 pt-6",
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
                className="absolute right-3 top-3"
              >
                <X size={20} aria-hidden="true" />
              </IconButton>
            </RadixDialog.Close>
          )}

          {hasBody && (
            <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {children}
            </div>
          )}

          {hasFooter && (
            <footer
              className={cn(
                "flex flex-wrap items-center justify-end gap-3 border-t-2 border-stroke px-6 py-4",
                !hasBody && "mt-4",
              )}
            >
              {footer}
            </footer>
          )}
        </DialogLayer>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** UI-kit alias: the same modal dialog. */
export const Modal = Dialog;

/** Wrap a button in the `footer` slot to make it dismiss the dialog (use with `asChild`). */
export const DialogClose = RadixDialog.Close;

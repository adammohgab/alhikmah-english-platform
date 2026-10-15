import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   Arcade Accordion (GLOBAL-STYLES-SPEC §10 "Selection", §10.1 "Dense data screens")

   Built on Radix Accordion, so the ARIA accordion pattern and the keyboard model come from the
   primitive:
     Enter / Space          toggle the focused item
     Arrow Down / Up        move focus to the next or previous header (wraps)
     Home / End             first and last header
     Tab                    moves through headers and any controls inside open panels
   Each header is a heading (`h3` by default) holding one native button with `aria-expanded` and
   `aria-controls`. Each panel is a `region` labelled by its button. A closed panel is
   `visibility: hidden`, so assistive tech and the Tab key skip it and only an open panel is
   read. Disabled items are skipped by the arrow keys.

   Modes
     type="single"     one open item at a time. `collapsible` defaults to `true` here, so the
                       open item can be closed again (pass `collapsible={false}` to forbid it).
     type="multiple"   any number of open items.
   Both support `defaultValue` or `value` with `onValueChange` (a string for single, a string
   array for multiple).

   Look: each item is a card with a 2px ink outline, radius 14 and a hard 2px shadow. The open
   header takes the world `tint` fill. The chevron turns 180 degrees when the item opens.
   Labels are ink on every state. A disabled item is a dashed, shadowless card with muted text.

   Motion: the panel opens by animating `grid-template-rows` from `0fr` to `1fr`, which follows
   the real content height with no measuring and no JavaScript, and `visibility` switches at the
   end of the collapse. The "low" effects tier drops the motion, and the global reduced-motion
   rule in base.css finishes it instantly. Text inside a closed panel is not found by the
   browser's find-in-page (it is hidden on purpose).

   Usage:
     <Accordion type="single" defaultValue="q1">
       <AccordionItem value="q1">
         <AccordionTrigger>How do I join a class?</AccordionTrigger>
         <AccordionContent>Enter the 6-character code from your teacher.</AccordionContent>
       </AccordionItem>
     </Accordion>
   Use `level` on a trigger to match the page's heading order (2 to 6).
   ======================================== */

function documentDirection(): "ltr" | "rtl" {
  if (typeof document === "undefined") return "ltr";
  return document.documentElement.dir === "rtl" ? "rtl" : "ltr";
}

/* ---------- Root ---------- */

export type AccordionProps = ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>;

export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(function Accordion(props, ref) {
  // Radix props are a union on `type`, so they are spread whole instead of being destructured.
  const collapsible =
    props.type === "single" && props.collapsible === undefined ? { collapsible: true } : null;

  return (
    <AccordionPrimitive.Root
      ref={ref}
      {...props}
      {...collapsible}
      dir={props.dir ?? documentDirection()}
      className={cn("flex w-full flex-col gap-3", props.className)}
    />
  );
});

/* ---------- Item ---------- */

export type AccordionItemProps = ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>;

export const AccordionItem = forwardRef<HTMLDivElement, AccordionItemProps>(function AccordionItem(
  { className, ...rest },
  ref,
) {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn(
        "overflow-hidden rounded-[14px] border-2 border-stroke bg-surface-0 text-stroke shadow-retro-sm",
        "data-[disabled]:border-dashed data-[disabled]:border-muted data-[disabled]:bg-surface-200 data-[disabled]:shadow-none",
        className,
      )}
      {...rest}
    />
  );
});

/* ---------- Trigger ---------- */

export interface AccordionTriggerProps extends ComponentPropsWithoutRef<
  typeof AccordionPrimitive.Trigger
> {
  /** Heading level of the header, 2 to 6. Default 3. */
  level?: 2 | 3 | 4 | 5 | 6 | undefined;
}

export const AccordionTrigger = forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  function AccordionTrigger({ level = 3, className, children, ...rest }, ref) {
    const Heading = `h${level}` as const;

    return (
      <AccordionPrimitive.Header asChild>
        <Heading className="m-0 flex">
          <AccordionPrimitive.Trigger
            ref={ref}
            className={cn(
              "group flex min-h-12 w-full touch-manipulation items-center justify-between gap-4 bg-transparent px-5 py-3 text-start font-heading text-[16px] font-semibold text-stroke [-webkit-tap-highlight-color:transparent]",
              "hover:bg-[var(--world-soft,#ffd93d)] data-[state=open]:bg-[var(--world-tint,#fff1e3)] data-[state=open]:hover:bg-[var(--world-soft,#ffd93d)]",
              "focus-visible:-outline-offset-4",
              "disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent",
              className,
            )}
            {...rest}
          >
            <span className="min-w-0 flex-1">{children}</span>
            <ChevronDown
              aria-hidden="true"
              className="h-5 w-5 shrink-0 transition-transform duration-[160ms] ease-out [stroke-width:3] group-data-[state=open]:rotate-180 [[data-effects-tier=low]_&]:transition-none"
            />
          </AccordionPrimitive.Trigger>
        </Heading>
      </AccordionPrimitive.Header>
    );
  },
);

/* ---------- Content ---------- */

export type AccordionContentProps = ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>;

export const AccordionContent = forwardRef<HTMLDivElement, AccordionContentProps>(
  function AccordionContent({ className, children, ...rest }, ref) {
    return (
      <AccordionPrimitive.Content
        ref={ref}
        // Always mounted so the height can animate; `invisible` hides a closed panel from
        // assistive tech and from the Tab key once the collapse finishes.
        forceMount
        className={cn(
          "grid grid-rows-[0fr] transition-[grid-template-rows,visibility] duration-[160ms] ease-out",
          "data-[state=closed]:invisible data-[state=open]:grid-rows-[1fr]",
          "[[data-effects-tier=low]_&]:transition-none",
        )}
        {...rest}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "border-t border-[rgba(26,21,48,0.12)] px-5 pb-4 pt-3 font-body text-[15px] text-stroke",
              className,
            )}
          >
            {children}
          </div>
        </div>
      </AccordionPrimitive.Content>
    );
  },
);

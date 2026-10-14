import { useLayoutEffect, useRef, type ComponentPropsWithoutRef, type Ref } from "react";
import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   Arcade DropdownMenu (Overlays & Feedback, Menus)
   Built on Radix DropdownMenu, which supplies the WAI-ARIA Menu pattern: the trigger has
   aria-haspopup / aria-expanded, the panel is role="menu" with role="menuitem(-checkbox/-radio)"
   items, arrow keys walk the items, Home/End jump, typeahead jumps by label, and
   Escape or an item selection closes and returns focus to the trigger.

   Look
     panel   solid 2px ink outline, hard 4px black offset shadow (`shadow-retro-md`),
             crisp 12px rounded corners, paper fill
     items   hover / keyboard-walk highlight fills with the active world color
             (`--world-soft`), a pressed item dips into `--world-main`; danger items
             highlight red instead
     extras  icons, right-aligned keyboard shortcuts, checkmarks, labels, separators,
             and sub-menus (Sub / SubTrigger / SubContent)

   The panel entrance pops in with a short overshoot; motion is skipped under
   prefers-reduced-motion and `data-effects-tier="low"` (spec §8.9). Scrolling inside the
   panel opts out of Lenis with `data-lenis-prevent` (spec: nested scroll areas).
   ======================================== */

/* ---- Panel ---- */

const CONTENT_BASE =
  "z-50 min-w-[180px] max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-[12px] border-2 border-stroke bg-surface-0 p-1.5 text-stroke shadow-retro-md outline-none";
const SUB_CONTENT_BASE =
  "z-50 min-w-[160px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[12px] border-2 border-stroke bg-surface-0 p-1.5 text-stroke shadow-retro-md outline-none";

/* ---- Items ---- */

const ITEM_BASE =
  "relative flex cursor-default select-none items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[14px] font-medium leading-none outline-none transition-colors duration-100 [&_svg]:shrink-0 [&_svg]:[stroke-width:2.5]";

/* Hover / keyboard-walk highlight, plus the pressed dip. Danger items highlight red instead. */
const ITEM_HIGHLIGHT =
  "data-[highlighted]:bg-[var(--world-soft,#ffd93d)] data-[highlighted]:text-stroke data-[highlighted]:active:bg-[var(--world-main,#ffb84d)]";
const ITEM_HIGHLIGHT_DANGER =
  "text-danger-600 data-[highlighted]:bg-danger-100 data-[highlighted]:text-danger-600 data-[highlighted]:active:bg-danger-600 data-[highlighted]:active:text-surface-0";

function itemClass(danger: boolean | undefined, className?: string): string {
  return cn(ITEM_BASE, danger ? ITEM_HIGHLIGHT_DANGER : ITEM_HIGHLIGHT, className);
}

/* ---- Entrance ----
   Radix mounts the content only while open, so the layout effect runs once per open.
   Exit is immediate (menus must feel snappy). */

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

export type DropdownMenuItemProps = ComponentPropsWithoutRef<typeof RadixDropdownMenu.Item> & {
  /** Red danger styling for destructive actions (Delete account, Reset progress). */
  danger?: boolean | undefined;
};

function DropdownMenuItem({ danger, className, children, ...props }: DropdownMenuItemProps) {
  return (
    <RadixDropdownMenu.Item {...props} className={itemClass(danger, className)}>
      {children}
    </RadixDropdownMenu.Item>
  );
}

export type DropdownMenuCheckboxItemProps = ComponentPropsWithoutRef<
  typeof RadixDropdownMenu.CheckboxItem
> & {
  danger?: boolean | undefined;
};

function DropdownMenuCheckboxItem({
  danger,
  className,
  children,
  ...props
}: DropdownMenuCheckboxItemProps) {
  return (
    <RadixDropdownMenu.CheckboxItem {...props} className={cn(itemClass(danger), "pl-9", className)}>
      {children}
      <RadixDropdownMenu.ItemIndicator className="absolute left-2.5 inline-flex items-center justify-center">
        <Check size={16} aria-hidden="true" />
      </RadixDropdownMenu.ItemIndicator>
    </RadixDropdownMenu.CheckboxItem>
  );
}

export type DropdownMenuRadioItemProps = ComponentPropsWithoutRef<
  typeof RadixDropdownMenu.RadioItem
> & {
  danger?: boolean | undefined;
};

function DropdownMenuRadioItem({
  danger,
  className,
  children,
  ...props
}: DropdownMenuRadioItemProps) {
  return (
    <RadixDropdownMenu.RadioItem {...props} className={cn(itemClass(danger), "pl-9", className)}>
      {children}
      <RadixDropdownMenu.ItemIndicator className="absolute left-2.5 inline-flex items-center justify-center">
        <span className="block h-2 w-2 rounded-full bg-current" />
      </RadixDropdownMenu.ItemIndicator>
    </RadixDropdownMenu.RadioItem>
  );
}

export type DropdownMenuSubTriggerProps = ComponentPropsWithoutRef<
  typeof RadixDropdownMenu.SubTrigger
> & {
  danger?: boolean | undefined;
};

function DropdownMenuSubTrigger({
  danger,
  className,
  children,
  ...props
}: DropdownMenuSubTriggerProps) {
  return (
    <RadixDropdownMenu.SubTrigger
      {...props}
      className={cn(
        itemClass(danger),
        "data-[state=open]:bg-[var(--world-soft,#ffd93d)]",
        className,
      )}
    >
      {children}
      <ChevronRight size={16} aria-hidden="true" className="ml-auto" />
    </RadixDropdownMenu.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixDropdownMenu.SubContent>) {
  return (
    <RadixDropdownMenu.SubContent
      sideOffset={4}
      {...props}
      className={cn(SUB_CONTENT_BASE, className)}
    />
  );
}

function DropdownMenuContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixDropdownMenu.Content>) {
  const entranceRef = useEntrance();
  return (
    <RadixDropdownMenu.Portal>
      <RadixDropdownMenu.Content
        ref={entranceRef}
        data-lenis-prevent
        sideOffset={6}
        {...props}
        className={cn(
          CONTENT_BASE,
          "max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))]",
          className,
        )}
      />
    </RadixDropdownMenu.Portal>
  );
}

/* ---- Keyboard shortcut tag ---- */

export type DropdownMenuShortcutProps = ComponentPropsWithoutRef<"span">;

export function DropdownMenuShortcut({ className, ...props }: DropdownMenuShortcutProps) {
  return (
    <span
      {...props}
      className={cn("ml-auto pl-6 text-[12px] font-semibold tracking-widest text-muted", className)}
    />
  );
}

/* ---- Namespaced component ---- */

function DropdownMenuRoot(props: RadixDropdownMenu.DropdownMenuProps) {
  return <RadixDropdownMenu.Root {...props} />;
}

export const DropdownMenu = Object.assign(DropdownMenuRoot, {
  /** The button (or any element, via `asChild`) that opens the menu. */
  Trigger: RadixDropdownMenu.Trigger,
  /** The styled panel. Renders through a portal with collision detection. */
  Content: DropdownMenuContent,
  Group: RadixDropdownMenu.Group,
  Item: DropdownMenuItem,
  CheckboxItem: DropdownMenuCheckboxItem,
  RadioGroup: RadixDropdownMenu.RadioGroup,
  RadioItem: DropdownMenuRadioItem,
  ItemIndicator: RadixDropdownMenu.ItemIndicator,
  Label: function DropdownMenuLabel({
    className,
    ...props
  }: ComponentPropsWithoutRef<typeof RadixDropdownMenu.Label>) {
    return (
      <RadixDropdownMenu.Label
        {...props}
        className={cn(
          "px-2.5 py-1.5 font-heading text-[11px] font-semibold uppercase tracking-[0.08em] text-muted",
          className,
        )}
      />
    );
  },
  Separator: function DropdownMenuSeparator({
    className,
    ...props
  }: ComponentPropsWithoutRef<typeof RadixDropdownMenu.Separator>) {
    return (
      <RadixDropdownMenu.Separator
        {...props}
        className={cn("-mx-1.5 my-1 h-[2px] bg-stroke/10", className)}
      />
    );
  },
  Sub: RadixDropdownMenu.Sub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
  Shortcut: DropdownMenuShortcut,
});

export type DropdownMenuProps = RadixDropdownMenu.DropdownMenuProps;

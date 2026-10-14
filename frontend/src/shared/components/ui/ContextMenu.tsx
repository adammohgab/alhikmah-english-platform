import { useLayoutEffect, useRef, type ComponentPropsWithoutRef, type Ref } from "react";
import * as RadixContextMenu from "@radix-ui/react-context-menu";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   Arcade ContextMenu (Overlays & Feedback, Menus)
   Built on Radix ContextMenu, the right-click sibling of DropdownMenu: the trigger region
   carries role="application"-safe right-click handling, the panel is role="menu", arrow keys
   walk the items, Home/End jump, typeahead jumps by label, and Escape or an item selection
   closes and returns focus. The trigger itself is the area that opens the menu on context
   click (desktop) and long-press (mobile).

   Look — identical to DropdownMenu:
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

function itemClass(danger: boolean | undefined): string {
  return cn(ITEM_BASE, danger ? ITEM_HIGHLIGHT_DANGER : ITEM_HIGHLIGHT);
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

export type ContextMenuItemProps = ComponentPropsWithoutRef<typeof RadixContextMenu.Item> & {
  /** Red danger styling for destructive actions (Delete, Remove). */
  danger?: boolean | undefined;
};

function ContextMenuItem({ danger, className, children, ...props }: ContextMenuItemProps) {
  return (
    <RadixContextMenu.Item {...props} className={cn(itemClass(danger), className)}>
      {children}
    </RadixContextMenu.Item>
  );
}

export type ContextMenuCheckboxItemProps = ComponentPropsWithoutRef<
  typeof RadixContextMenu.CheckboxItem
> & {
  danger?: boolean | undefined;
};

function ContextMenuCheckboxItem({
  danger,
  className,
  children,
  ...props
}: ContextMenuCheckboxItemProps) {
  return (
    <RadixContextMenu.CheckboxItem {...props} className={cn(itemClass(danger), "pl-9", className)}>
      {children}
      <RadixContextMenu.ItemIndicator className="absolute left-2.5 inline-flex items-center justify-center">
        <Check size={16} aria-hidden="true" />
      </RadixContextMenu.ItemIndicator>
    </RadixContextMenu.CheckboxItem>
  );
}

export type ContextMenuRadioItemProps = ComponentPropsWithoutRef<
  typeof RadixContextMenu.RadioItem
> & {
  danger?: boolean | undefined;
};

function ContextMenuRadioItem({
  danger,
  className,
  children,
  ...props
}: ContextMenuRadioItemProps) {
  return (
    <RadixContextMenu.RadioItem {...props} className={cn(itemClass(danger), "pl-9", className)}>
      {children}
      <RadixContextMenu.ItemIndicator className="absolute left-2.5 inline-flex items-center justify-center">
        <span className="block h-2 w-2 rounded-full bg-current" />
      </RadixContextMenu.ItemIndicator>
    </RadixContextMenu.RadioItem>
  );
}

export type ContextMenuSubTriggerProps = ComponentPropsWithoutRef<
  typeof RadixContextMenu.SubTrigger
> & {
  danger?: boolean | undefined;
};

function ContextMenuSubTrigger({
  danger,
  className,
  children,
  ...props
}: ContextMenuSubTriggerProps) {
  return (
    <RadixContextMenu.SubTrigger
      {...props}
      className={cn(
        itemClass(danger),
        "data-[state=open]:bg-[var(--world-soft,#ffd93d)]",
        className,
      )}
    >
      {children}
      <ChevronRight size={16} aria-hidden="true" className="ml-auto" />
    </RadixContextMenu.SubTrigger>
  );
}

function ContextMenuSubContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixContextMenu.SubContent>) {
  return (
    <RadixContextMenu.SubContent
      sideOffset={4}
      {...props}
      className={cn(SUB_CONTENT_BASE, className)}
    />
  );
}

function ContextMenuContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixContextMenu.Content>) {
  const entranceRef = useEntrance();
  return (
    <RadixContextMenu.Portal>
      <RadixContextMenu.Content
        ref={entranceRef}
        data-lenis-prevent
        {...props}
        className={cn(
          CONTENT_BASE,
          "max-h-[min(24rem,var(--radix-context-menu-content-available-height))]",
          className,
        )}
      />
    </RadixContextMenu.Portal>
  );
}

/* ---- Keyboard shortcut tag ---- */

export type ContextMenuShortcutProps = ComponentPropsWithoutRef<"span">;

export function ContextMenuShortcut({ className, ...props }: ContextMenuShortcutProps) {
  return (
    <span
      {...props}
      className={cn("ml-auto pl-6 text-[12px] font-semibold tracking-widest text-muted", className)}
    />
  );
}

/* ---- Namespaced component ---- */

function ContextMenuRoot(props: RadixContextMenu.ContextMenuProps) {
  return <RadixContextMenu.Root {...props} />;
}

export const ContextMenu = Object.assign(ContextMenuRoot, {
  /** The region that opens the menu on right-click / long-press. Use `asChild` to attach it
      to your own element without adding a wrapper node. */
  Trigger: RadixContextMenu.Trigger,
  /** The styled panel. Renders through a portal at the pointer position. */
  Content: ContextMenuContent,
  Group: RadixContextMenu.Group,
  Item: ContextMenuItem,
  CheckboxItem: ContextMenuCheckboxItem,
  RadioGroup: RadixContextMenu.RadioGroup,
  RadioItem: ContextMenuRadioItem,
  ItemIndicator: RadixContextMenu.ItemIndicator,
  Label: function ContextMenuLabel({
    className,
    ...props
  }: ComponentPropsWithoutRef<typeof RadixContextMenu.Label>) {
    return (
      <RadixContextMenu.Label
        {...props}
        className={cn(
          "px-2.5 py-1.5 font-heading text-[11px] font-semibold uppercase tracking-[0.08em] text-muted",
          className,
        )}
      />
    );
  },
  Separator: function ContextMenuSeparator({
    className,
    ...props
  }: ComponentPropsWithoutRef<typeof RadixContextMenu.Separator>) {
    return (
      <RadixContextMenu.Separator
        {...props}
        className={cn("-mx-1.5 my-1 h-[2px] bg-stroke/10", className)}
      />
    );
  },
  Sub: RadixContextMenu.Sub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
  Shortcut: ContextMenuShortcut,
});

export type ContextMenuProps = RadixContextMenu.ContextMenuProps;

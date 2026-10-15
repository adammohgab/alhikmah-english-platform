import { forwardRef } from "react";
import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import type { WorldId } from "@/shared/hooks/useWorld";

/* ========================================
   Arcade Chip (GLOBAL-STYLES-SPEC §6.2 "Chip and tag", §10 "Chip and tag", "Selection")

   One pill with three behaviors, chosen by the props you pass:
     tag          no handlers          a static label
     clickable    `onClick` / `selected`  a filter or selectable tag (a native <button>)
     removable    `onRemove`           an extra remove <button>; Backspace or Delete also removes

   Keyboard and focus: every interactive part is a real <button>, so the global
   :focus-visible ring from base.css (2px ink ring, 2px offset) shows on it, and nothing here
   clips or hides it (the face has no overflow:hidden). A removable chip has no focus target
   that cannot also remove it: Backspace or Delete on the chip button or the remove button both
   call `onRemove`. After a removal the caller owns focus: move it to a neighbor or a container.

   Look: pill, solid 2px ink outline, hard 2px shadow planted behind a face that only animates
   with `transform` (same technique as Button; spec §6.1 forbids animating box-shadow).
   Unselected chips use the world `soft` fill; selected chips use `main` plus a thick check, so
   selection is never color alone. Ink text everywhere on world fills (spec §3.2).
   ======================================== */

export type ChipSize = "sm" | "md";

export interface ChipProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  "children" | "onClick" | "onKeyDown"
> {
  children: ReactNode;
  /**
   * Selected state of a toggle chip. When defined (true or false) the chip is clickable and
   * announces `aria-pressed`. Selected chips show the `main` fill and a check.
   */
  selected?: boolean | undefined;
  /** Makes the chip a clickable button (a filter, or any action). */
  onClick?: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined;
  /**
   * Makes the chip removable. Called when the remove button is clicked or activated, and when
   * Backspace or Delete is pressed while the chip or its remove button has focus.
   */
  onRemove?:
    | ((event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>) => void)
    | undefined;
  /** Accessible name of the remove button. Defaults to "Remove <label>" for text labels. */
  removeLabel?: string | undefined;
  /** Leading icon (skill chips carry one). Decorative: hidden from assistive tech. */
  icon?: ReactNode;
  /** `sm` is 28px tall, `md` is 32px. Default `md`. */
  size?: ChipSize | undefined;
  /** Ink fill with light text, for dark ("Night") surfaces. Selected chips keep the `main` fill. */
  inverted?: boolean | undefined;
  /** Pins the chip to one world instead of the current one (skill chips use their skill world). */
  world?: WorldId | undefined;
  disabled?: boolean | undefined;
}

interface ChipSizeStyle {
  face: string;
  pad: string;
  padRemovable: string;
  remove: string;
}

const SIZE_STYLES: Record<ChipSize, ChipSizeStyle> = {
  sm: { face: "h-7 text-[12px]", pad: "px-2.5", padRemovable: "pl-2.5 pr-1", remove: "w-6" },
  md: { face: "h-8 text-[13px]", pad: "px-3", padRemovable: "pl-3 pr-1", remove: "w-7" },
};

const FACE_BASE =
  "relative inline-flex items-stretch whitespace-nowrap select-none rounded-full border-2 font-body font-bold leading-none";

/* Hover lifts the face 1px, press sinks it onto the planted shadow (spec §6.1 "pressed").
   Fast, and dropped on the "low" effects tier (spec §8.9). */
const FACE_PHYSICS =
  "transition-transform duration-[120ms] ease-out [[data-effects-tier=low]_&]:transition-none group-hover:-translate-x-px group-hover:-translate-y-px group-active:translate-x-[2px] group-active:translate-y-[2px] group-active:duration-[80ms]";

/* Fills read the live world variables (they morph with the theme); fallbacks match tokens.css. */
const FACE_REST = "border-stroke bg-[var(--world-soft,#ffd93d)] text-stroke";
const FACE_SELECTED = "border-stroke bg-[var(--world-main,#ffb84d)] text-stroke";
const FACE_INVERTED =
  "border-[color:var(--world-tint,#fff1e3)] bg-stroke text-[color:var(--world-tint,#fff1e3)]";
/* Spec §10: disabled is a soft grey fill with a dashed outline and no shadow, never invisible. */
const FACE_DISABLED = "border-dashed border-muted bg-surface-200 text-muted";

const SHADOW_REST = "bg-stroke";
const SHADOW_INVERTED = "bg-[var(--world-main,#ffb84d)]";

const PART_BASE = "inline-flex items-center bg-transparent text-inherit";

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  {
    children,
    selected,
    onClick,
    onRemove,
    removeLabel,
    icon,
    size = "md",
    inverted = false,
    world,
    disabled = false,
    className,
    ...rest
  },
  ref,
) {
  const sizeStyle = SIZE_STYLES[size];
  const clickable = onClick !== undefined || selected !== undefined;
  const removable = onRemove !== undefined;
  const interactive = (clickable || removable) && !disabled;
  const isSelected = selected === true;

  let faceColor = FACE_REST;
  if (disabled) faceColor = FACE_DISABLED;
  else if (isSelected) faceColor = FACE_SELECTED;
  else if (inverted) faceColor = FACE_INVERTED;

  const accessibleRemoveLabel =
    removeLabel ?? (typeof children === "string" ? `Remove ${children}` : "Remove");

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (onRemove === undefined || disabled) return;
    if (event.key === "Backspace" || event.key === "Delete") {
      // Stops the key from also acting as browser "back" navigation or editing an ancestor field.
      event.preventDefault();
      onRemove(event);
    }
  };

  const content = (
    <>
      {isSelected && <Check aria-hidden="true" size={14} strokeWidth={3} className="shrink-0" />}
      {icon !== undefined && (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center [&_svg]:shrink-0">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </>
  );

  const labelPadding = removable ? sizeStyle.padRemovable : sizeStyle.pad;
  const labelClasses = cn(PART_BASE, "gap-1.5", labelPadding);

  return (
    <span
      ref={ref}
      {...rest}
      data-world={world}
      data-selected={selected === undefined ? undefined : isSelected}
      className={cn("group relative inline-flex align-middle", className)}
    >
      {!disabled && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 translate-x-[2px] translate-y-[2px] rounded-full",
            inverted && !isSelected ? SHADOW_INVERTED : SHADOW_REST,
          )}
        />
      )}
      <span className={cn(FACE_BASE, sizeStyle.face, faceColor, interactive && FACE_PHYSICS)}>
        {clickable ? (
          <button
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            aria-keyshortcuts={removable ? "Backspace Delete" : undefined}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            className={cn(
              labelClasses,
              "touch-manipulation",
              removable ? "rounded-l-full" : "rounded-full",
              disabled ? "cursor-not-allowed" : "cursor-pointer",
            )}
          >
            {content}
          </button>
        ) : (
          <span className={labelClasses}>{content}</span>
        )}
        {removable && (
          <button
            type="button"
            disabled={disabled}
            aria-label={accessibleRemoveLabel}
            aria-keyshortcuts="Backspace Delete"
            onClick={onRemove}
            onKeyDown={handleKeyDown}
            className={cn(
              PART_BASE,
              "touch-manipulation justify-center rounded-r-full pr-0.5",
              sizeStyle.remove,
              disabled
                ? "cursor-not-allowed"
                : "cursor-pointer hover:bg-[var(--world-tint,#fff1e3)] hover:text-stroke",
            )}
          >
            <X aria-hidden="true" size={14} strokeWidth={3} />
          </button>
        )}
      </span>
    </span>
  );
});

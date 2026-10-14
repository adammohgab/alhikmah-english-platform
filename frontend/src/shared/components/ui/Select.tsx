import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   Arcade Select (GLOBAL-STYLES-SPEC §10 "Input, textarea, select", "Selection")

   Built on Radix Select, so the full keyboard model comes from the primitive:
     Tab                    focuses the trigger
     Space / Enter / Down   open the list (Up also opens it)
     Arrow Up / Down        move the highlight
     Home / End             jump to the first or last option
     Space / Enter          choose the highlighted option and close
     Escape                 close without changing the value
     Type a character       jump to the matching option (typeahead)
   The trigger exposes `role="combobox"`, the list `role="listbox"`, options `role="option"`.

   Look: the trigger is a white field with a 2px ink outline, radius 14 and a small hard shadow
   that grows to the full 2px shadow on keyboard focus and while open. The popover is a white
   panel with a 2px ink outline and the hard 4px retro shadow (no blur). The highlighted option
   takes the world `soft` fill plus an ink inset outline, and the chosen option carries a thick
   check, so neither state is color alone.

   Usage:
     <Select
       aria-label="Level"
       placeholder="Pick a level"
       value={level}
       onValueChange={setLevel}
       options={[{ value: "a1", label: "A1" }, { value: "a2", label: "A2" }]}
     />
   An option `value` must not be an empty string: Radix reserves "" for "no selection".
   ======================================== */

export interface SelectOption {
  /** Unique, non-empty value. */
  value: string;
  /** What the person sees in the list and in the trigger. */
  label: string;
  disabled?: boolean | undefined;
}

export interface SelectOptionGroup {
  /** Visible group heading. */
  label: string;
  options: readonly SelectOption[];
}

export interface SelectProps extends Omit<
  ComponentPropsWithoutRef<typeof SelectPrimitive.Root>,
  "children"
> {
  /** Flat options, or labelled groups of options (a divider is drawn between groups). */
  options: ReadonlyArray<SelectOption | SelectOptionGroup>;
  /** Shown in the trigger while nothing is selected. */
  placeholder?: string | undefined;
  /** Connects the trigger to a visible `<label>` (or to `FormField`). */
  id?: string | undefined;
  /** Accessible name of the trigger when there is no visible label. */
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  "aria-describedby"?: string | undefined;
  /** Marks the trigger as invalid for assistive tech and gives it a danger outline. */
  "aria-invalid"?: boolean | undefined;
  /** Classes for the trigger (use it for width; the trigger is full width by default). */
  className?: string | undefined;
}

function isGroup(entry: SelectOption | SelectOptionGroup): entry is SelectOptionGroup {
  return "options" in entry;
}

/* Hard, blur-free shadow ladder (spec §6.1): xs at rest, sm on focus or open, md for the popover. */
const TRIGGER_BASE =
  "group relative flex min-h-11 w-full touch-manipulation items-center justify-between gap-3 rounded-[14px] border-2 border-stroke bg-surface-0 px-4 py-2 text-start font-body text-[15px] text-stroke shadow-[1px_1px_0_#000] [-webkit-tap-highlight-color:transparent] data-[placeholder]:text-muted data-[state=open]:shadow-retro-sm focus-visible:shadow-retro-sm aria-[invalid=true]:border-danger-600";

/* Spec §10: disabled is a soft grey-tint fill with a dashed outline and no shadow, never invisible. */
const TRIGGER_DISABLED =
  "disabled:cursor-not-allowed disabled:border-dashed disabled:border-muted disabled:bg-surface-200 disabled:text-muted disabled:shadow-none";

const CONTENT =
  "relative z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-[8rem] overflow-hidden rounded-[14px] border-2 border-stroke bg-surface-0 text-stroke shadow-retro-md";

const ITEM =
  "relative flex min-h-11 cursor-pointer select-none items-center rounded-[10px] py-2 pe-3 ps-9 font-body text-[15px] text-stroke outline-none data-[highlighted]:bg-[var(--world-soft,#ffd93d)] data-[highlighted]:outline data-[highlighted]:outline-2 data-[highlighted]:-outline-offset-2 data-[highlighted]:outline-stroke data-[state=checked]:font-semibold data-[disabled]:pointer-events-none data-[disabled]:text-muted data-[disabled]:opacity-60";

const SCROLL_BUTTON =
  "flex h-8 cursor-default items-center justify-center bg-surface-0 text-stroke";

function SelectItem({ option }: { option: SelectOption }) {
  return (
    <SelectPrimitive.Item value={option.value} disabled={option.disabled === true} className={ITEM}>
      <SelectPrimitive.ItemIndicator className="absolute start-3 inline-flex items-center justify-center">
        <Check aria-hidden="true" className="h-4 w-4 [stroke-width:4]" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    options,
    placeholder,
    id,
    className,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <SelectPrimitive.Root disabled={disabled} {...rest}>
      <SelectPrimitive.Trigger
        ref={ref}
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        className={cn(TRIGGER_BASE, TRIGGER_DISABLED, className)}
      >
        <span className="min-w-0 flex-1 truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown
            aria-hidden="true"
            className="h-5 w-5 shrink-0 transition-transform duration-[160ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] [stroke-width:3] group-data-[state=open]:rotate-180 [[data-effects-tier=low]_&]:transition-none"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        {/* data-lenis-prevent: nested scroll areas must scroll normally (spec §8.3). */}
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={8}
          data-lenis-prevent=""
          className={CONTENT}
        >
          <SelectPrimitive.ScrollUpButton className={SCROLL_BUTTON}>
            <ChevronUp aria-hidden="true" className="h-4 w-4 [stroke-width:3]" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1.5">
            {options.map((entry, index) =>
              isGroup(entry) ? (
                <SelectPrimitive.Group key={`group-${entry.label}`}>
                  {index > 0 && (
                    <SelectPrimitive.Separator className="-mx-1.5 my-1.5 h-0.5 bg-stroke" />
                  )}
                  <SelectPrimitive.Label className="px-3 py-1.5 font-heading text-[13px] font-semibold text-muted">
                    {entry.label}
                  </SelectPrimitive.Label>
                  {entry.options.map((option) => (
                    <SelectItem key={option.value} option={option} />
                  ))}
                </SelectPrimitive.Group>
              ) : (
                <SelectItem key={entry.value} option={entry} />
              ),
            )}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className={SCROLL_BUTTON}>
            <ChevronDown aria-hidden="true" className="h-4 w-4 [stroke-width:3]" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
});

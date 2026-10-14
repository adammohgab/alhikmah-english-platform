import { forwardRef, useId } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   Arcade RadioGroup (GLOBAL-STYLES-SPEC §10 "Selection", §8.4 "Form controls: radio dot grows
   with overshoot")

   Built on Radix RadioGroup, so the whole keyboard model comes from the primitive:
     Tab              enters the group on the checked item (or the first item when none is checked)
     Arrow keys       move focus AND select the next or previous item, wrapping at the ends
                      (Down/Right next, Up/Left previous; `dir` flips left and right for RTL)
     Space            selects the focused item
   Disabled items are skipped by the arrow keys. The group exposes `role="radiogroup"`.

   Usage:
     <RadioGroup value={v} onValueChange={setV} aria-label="Level">
       <RadioGroupItem value="a" label="Beginner" />
       <RadioGroupItem value="b" label="Advanced" />
     </RadioGroup>

   Look: 2px ink outline circle with a hard 2px shadow. The checked circle takes the world `main`
   fill and a solid ink center dot that grows with overshoot, so state is never color alone and
   the checked state keeps a high contrast ink-on-fill ratio. Only `transform` is animated.
   ======================================== */

export type RadioGroupProps = ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>;

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup(
  { className, ...rest },
  ref,
) {
  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      className={cn(
        "flex gap-3",
        rest.orientation === "horizontal" ? "flex-row flex-wrap gap-x-6" : "flex-col",
        className,
      )}
      {...rest}
    />
  );
});

export interface RadioGroupItemProps extends Omit<
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>,
  "children"
> {
  /**
   * Visible label, rendered after the circle. Clicking it selects the item. Without a label,
   * give the item an `aria-label` or `aria-labelledby`.
   */
  label?: ReactNode;
}

/* Overshoot on release; the "low" effects tier drops the transition (spec §8.9). */
const MOTION =
  "transition-transform duration-[160ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] [[data-effects-tier=low]_&]:transition-none";

const RADIO_BASE =
  "relative inline-flex h-6 w-6 shrink-0 touch-manipulation items-center justify-center rounded-full border-2 border-stroke bg-surface-0 p-0 text-stroke shadow-retro-sm [-webkit-tap-highlight-color:transparent]";

const RADIO_STATE = "data-[state=checked]:bg-[var(--world-main,#ffb84d)]";

const RADIO_PRESS =
  "enabled:active:translate-x-[2px] enabled:active:translate-y-[2px] enabled:active:shadow-none enabled:active:duration-[90ms] enabled:active:ease-out";

/* Spec §10: disabled is a soft grey-tint fill with a dashed outline and no shadow, never invisible. */
const RADIO_DISABLED =
  "disabled:cursor-not-allowed disabled:border-dashed disabled:border-muted disabled:bg-surface-200 disabled:text-muted disabled:shadow-none";

export const RadioGroupItem = forwardRef<HTMLButtonElement, RadioGroupItemProps>(
  function RadioGroupItem({ label, id, className, disabled, ...rest }, ref) {
    const generatedId = useId();
    const controlId = id ?? generatedId;

    const radio = (
      <RadioGroupPrimitive.Item
        ref={ref}
        id={controlId}
        disabled={disabled}
        className={cn(
          RADIO_BASE,
          RADIO_STATE,
          MOTION,
          RADIO_PRESS,
          RADIO_DISABLED,
          label ? null : className,
        )}
        {...rest}
      >
        <RadioGroupPrimitive.Indicator
          forceMount
          className={cn(
            "block h-2.5 w-2.5 scale-0 rounded-full bg-current data-[state=checked]:scale-100",
            MOTION,
          )}
        />
      </RadioGroupPrimitive.Item>
    );

    if (!label) return radio;

    return (
      <label
        htmlFor={controlId}
        className={cn(
          "inline-flex items-center gap-3 font-body text-[15px] text-stroke",
          disabled === true ? "cursor-not-allowed text-muted" : "cursor-pointer",
          className,
        )}
      >
        {radio}
        <span>{label}</span>
      </label>
    );
  },
);

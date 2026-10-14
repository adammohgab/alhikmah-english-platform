import { forwardRef, useId } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   Arcade Checkbox (GLOBAL-STYLES-SPEC §10 "Selection", §8.4 "Form controls")

   Built on Radix Checkbox, so keyboard behavior, `aria-checked` (including "mixed" for the
   indeterminate state) and form participation come from the primitive:
     Space    toggles
     Tab      moves focus (the global :focus-visible ring from base.css shows on the button)

   Look: 2px ink outline square, hard 2px shadow, white fill when off. Checked and indeterminate
   take the world `main` fill with a thick ink glyph, so state is never color alone and the
   checked state keeps a high contrast ink-on-fill ratio. The glyph pops in with the same
   overshoot curve as Button. Only `transform` is animated (spec §6.1: no box-shadow animation).
   Pressing sinks the box by the shadow offset, like Button. The "low" effects tier drops motion.
   ======================================== */

export interface CheckboxProps extends Omit<
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
  "children"
> {
  /**
   * Visible label, rendered after the box. Clicking it toggles the checkbox. Without a label,
   * give the checkbox an `aria-label` or `aria-labelledby` (or connect it through `FormField`).
   */
  label?: ReactNode;
}

/* Overshoot on release; the "low" effects tier drops the transition (spec §8.9). */
const MOTION =
  "transition-transform duration-[160ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] [[data-effects-tier=low]_&]:transition-none";

const BOX_BASE =
  "group relative inline-flex h-6 w-6 shrink-0 touch-manipulation items-center justify-center rounded-[6px] border-2 border-stroke bg-surface-0 p-0 text-stroke shadow-retro-sm [-webkit-tap-highlight-color:transparent]";

const BOX_STATE =
  "data-[state=checked]:bg-[var(--world-main,#ffb84d)] data-[state=indeterminate]:bg-[var(--world-main,#ffb84d)]";

const BOX_PRESS =
  "enabled:active:translate-x-[2px] enabled:active:translate-y-[2px] enabled:active:shadow-none enabled:active:duration-[90ms] enabled:active:ease-out";

/* Spec §10: disabled is a soft grey-tint fill with a dashed outline and no shadow, never invisible. */
const BOX_DISABLED =
  "disabled:cursor-not-allowed disabled:border-dashed disabled:border-muted disabled:bg-surface-200 disabled:text-muted disabled:shadow-none";

const GLYPH =
  "flex items-center justify-center scale-0 data-[state=checked]:scale-100 data-[state=indeterminate]:scale-100";

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { label, id, className, disabled, ...rest },
  ref,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;

  const box = (
    <CheckboxPrimitive.Root
      ref={ref}
      id={controlId}
      disabled={disabled}
      className={cn(BOX_BASE, BOX_STATE, MOTION, BOX_PRESS, BOX_DISABLED, label ? null : className)}
      {...rest}
    >
      <CheckboxPrimitive.Indicator forceMount className={cn(GLYPH, MOTION)}>
        <Check
          aria-hidden="true"
          className="h-4 w-4 [stroke-width:4] group-data-[state=indeterminate]:hidden"
        />
        <Minus
          aria-hidden="true"
          className="hidden h-4 w-4 [stroke-width:4] group-data-[state=indeterminate]:block"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label) return box;

  return (
    <label
      htmlFor={controlId}
      className={cn(
        "inline-flex items-center gap-3 font-body text-[15px] text-stroke",
        disabled === true ? "cursor-not-allowed text-muted" : "cursor-pointer",
        className,
      )}
    >
      {box}
      <span>{label}</span>
    </label>
  );
});

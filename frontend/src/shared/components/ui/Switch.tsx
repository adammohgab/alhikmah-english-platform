import { forwardRef, useId } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/shared/lib/utils/cn";
import { useSound, type SoundName } from "@/shared/hooks/useSound";

/* ========================================
   Arcade Switch (GLOBAL-STYLES-SPEC §10 "Selection", §8.4 "Form controls", §8.8 "Sound system")

   Built on Radix Switch, so the keyboard model and semantics come from the primitive:
     Space / Enter    toggles (Radix handles Enter on the button)
     Tab              moves focus (the global :focus-visible ring from base.css shows)
   The control exposes `role="switch"` with `aria-checked`.

   Look: a 56 x 32 pill track with a 2px ink outline and a hard 2px shadow. Off is a grey-tint
   track; on takes the world `main` fill. The 24px thumb slides with an overshoot curve, and
   the on state is also carried by the thumb position, so state is never color alone. Pressing
   sinks the whole switch by the shadow offset, like Button. Only `transform` is animated.
   The thumb offset is mirrored under `dir="rtl"`.

   Sound: toggling plays `sound` when the switch turns on and `soundOff` when it turns off,
   through SoundProvider (so mute, volume and the 80 ms repeat gap apply). Pass `sound={false}`
   to make the switch silent.
   ======================================== */

export interface SwitchProps extends Omit<
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
  "children"
> {
  /**
   * Visible label, rendered after the track. Clicking it toggles the switch. Without a label,
   * give the switch an `aria-label` or `aria-labelledby` (or connect it through `FormField`).
   */
  label?: ReactNode;
  /** Sprite played when the switch turns on. `false` makes the switch silent. Default `pop`. */
  sound?: SoundName | false | undefined;
  /** Sprite played when the switch turns off. Ignored when `sound` is `false`. Default `click`. */
  soundOff?: SoundName | undefined;
}

/* Overshoot on release; the "low" effects tier drops the transition (spec §8.9). */
const MOTION =
  "transition-transform duration-[160ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] [[data-effects-tier=low]_&]:transition-none";

const TRACK_BASE =
  "relative inline-flex h-8 w-14 shrink-0 touch-manipulation items-center rounded-full border-2 border-stroke bg-surface-200 p-0 shadow-retro-sm [-webkit-tap-highlight-color:transparent]";

const TRACK_STATE = "data-[state=checked]:bg-[var(--world-main,#ffb84d)]";

const TRACK_PRESS =
  "enabled:active:translate-x-[2px] enabled:active:translate-y-[2px] enabled:active:shadow-none enabled:active:duration-[90ms] enabled:active:ease-out";

/* Spec §10: disabled is a soft grey-tint fill with a dashed outline and no shadow, never invisible. */
const TRACK_DISABLED =
  "disabled:cursor-not-allowed disabled:border-dashed disabled:border-muted disabled:bg-surface-200 disabled:shadow-none";

/* The track's padding box is 52px wide: 2px gap + 24px thumb (+ 24px of travel) + 2px gap. */
const THUMB =
  "pointer-events-none block h-6 w-6 translate-x-[2px] rounded-full border-2 border-stroke bg-surface-0 data-[state=checked]:translate-x-[26px] rtl:-translate-x-[2px] rtl:data-[state=checked]:-translate-x-[26px] data-[disabled]:border-muted";

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { label, sound = "pop", soundOff = "click", id, className, disabled, onCheckedChange, ...rest },
  ref,
) {
  const { play } = useSound();
  const generatedId = useId();
  const controlId = id ?? generatedId;

  const handleCheckedChange = (checked: boolean) => {
    if (sound !== false) play(checked ? sound : soundOff);
    onCheckedChange?.(checked);
  };

  const track = (
    <SwitchPrimitive.Root
      ref={ref}
      id={controlId}
      disabled={disabled}
      onCheckedChange={handleCheckedChange}
      className={cn(
        TRACK_BASE,
        TRACK_STATE,
        MOTION,
        TRACK_PRESS,
        TRACK_DISABLED,
        label ? null : className,
      )}
      {...rest}
    >
      <SwitchPrimitive.Thumb className={cn(THUMB, MOTION)} />
    </SwitchPrimitive.Root>
  );

  if (!label) return track;

  return (
    <label
      htmlFor={controlId}
      className={cn(
        "inline-flex items-center gap-3 font-body text-[15px] text-stroke",
        disabled === true ? "cursor-not-allowed text-muted" : "cursor-pointer",
        className,
      )}
    >
      {track}
      <span>{label}</span>
    </label>
  );
});

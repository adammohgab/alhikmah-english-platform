import { forwardRef } from "react";
import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { cn } from "@/shared/lib/utils/cn";
import { useSound, type SoundName } from "@/shared/hooks/useSound";

/* ========================================
   Arcade Button (GLOBAL-STYLES-SPEC §6.1, §8.4, §10)

   Structure (all inside one native <button>):
     <button>            stable hit area, owns the base.css focus ring and `className`
       <span shadow/>    solid ink block, planted at +2px/+2px and never animated
       <span face>       outlined surface that moves
   Only the face animates, and only with `transform` (spec §6.1: no box-shadow
   animation). The visible shadow is the gap between the face and the planted block:
     rest   face (0, 0)      -> 2px shadow
     hover  face (-2px,-2px) -> 4px shadow (shadow expand)
     active face (+2px,+2px) -> 0px shadow (flattened, the button sinks into the page)
   Hover is tracked on the <button> (group), not on the face, so the moving face
   cannot flicker the hover state at its edges.
   ======================================== */

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg" | "pill";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` takes the active color world. Default `primary`. */
  variant?: ButtonVariant | undefined;
  /** `pill` is the md height with fully rounded ends. Default `md`. */
  size?: ButtonSize | undefined;
  /**
   * Shows the retro spinner and blocks clicks. The button stays focusable
   * (`aria-disabled` + `aria-busy`, not `disabled`) so keyboard focus is not lost
   * while an action is running.
   */
  loading?: boolean | undefined;
  /** Sprite played on click. `false` makes the button silent. Default `click`. */
  sound?: SoundName | false | undefined;
  /**
   * Circular icon-only layout. Use `IconButton` instead of setting this:
   * it also makes `aria-label` mandatory.
   */
  iconOnly?: boolean | undefined;
}

interface SizeStyle {
  radius: string;
  face: string;
  iconFace: string;
}

const SIZE_STYLES: Record<ButtonSize, SizeStyle> = {
  sm: { radius: "rounded-[10px]", face: "h-9 px-4 text-[13px]", iconFace: "h-9 w-9" },
  md: { radius: "rounded-[12px]", face: "h-11 px-5 text-[15px]", iconFace: "h-11 w-11" },
  lg: { radius: "rounded-[16px]", face: "h-14 px-7 text-[18px]", iconFace: "h-14 w-14" },
  pill: { radius: "rounded-full", face: "h-11 px-6 text-[15px]", iconFace: "h-11 w-11" },
};

/* Fills read the live world variables (they morph with the theme); fallbacks match tokens.css.
   Danger and success use the spec §3.3 semantic fills, always with ink text. */
const VARIANT_FACE: Record<ButtonVariant, string> = {
  primary: "border-stroke bg-[var(--world-main,#ffb84d)] text-stroke",
  secondary: "border-stroke bg-surface-0 text-stroke",
  outline: "border-stroke bg-[var(--world-tint,#fff1e3)] text-stroke",
  ghost: "border-transparent bg-transparent text-stroke",
  danger: "border-stroke bg-[#F2566A] text-stroke",
  success: "border-stroke bg-[#1FBF7A] text-stroke",
};

/* Extra feedback for variants whose fill is not already a distinct surface. */
const VARIANT_HOVER_FILL: Partial<Record<ButtonVariant, string>> = {
  outline: "group-hover:bg-[var(--world-soft,#ffd93d)]",
  ghost: "group-hover:bg-[var(--world-soft,#ffd93d)]",
};

const VARIANT_ACTIVE_FILL: Partial<Record<ButtonVariant, string>> = {
  ghost: "group-active:bg-[var(--world-soft,#ffd93d)]",
};

const FACE_BASE =
  "relative flex items-center justify-center gap-2 whitespace-nowrap select-none rounded-[inherit] border-2 font-heading font-semibold leading-none [&_svg]:shrink-0 [&_svg]:[stroke-width:2.5]";

/* Release springs back with overshoot; the "low" effects tier drops the transition (spec §8.9). */
const FACE_MOTION =
  "transition-transform duration-[160ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] [[data-effects-tier=low]_&]:transition-none";

/* Shadowed variants: lift on hover, sink by the full shadow offset on press. */
const FACE_PHYSICS =
  "group-hover:-translate-x-[2px] group-hover:-translate-y-[2px] group-active:translate-x-[2px] group-active:translate-y-[2px] group-active:duration-[90ms] group-active:ease-out";

/* Ghost has no shadow to collapse, so it only dips. */
const FACE_PHYSICS_FLAT =
  "group-active:translate-y-[2px] group-active:duration-[90ms] group-active:ease-out";

/* Spec §10: disabled is a soft grey-tint fill with a dashed outline and no shadow, never invisible. */
const FACE_DISABLED = "border-dashed border-muted bg-surface-200 text-muted";

function RetroSpinner() {
  return (
    <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
      <span className="block h-[18px] w-[18px] animate-spin rounded-[3px] border-[3px] border-current border-t-transparent [animation-timing-function:steps(8,end)]" />
    </span>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    sound = "click",
    iconOnly = false,
    disabled,
    className,
    children,
    onClick,
    "aria-disabled": ariaDisabled,
    ...rest
  },
  ref,
) {
  const { play } = useSound();

  const sizeStyle = SIZE_STYLES[size];
  const hasShadow = variant !== "ghost" && disabled !== true;
  const interactive = disabled !== true && !loading;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      // Also stops implicit form submission, which is dispatched as a click on a submit button.
      event.preventDefault();
      return;
    }
    if (sound !== false) play(sound);
    onClick?.(event);
  };

  let cursor: string | null = null;
  if (disabled === true) cursor = "cursor-not-allowed";
  else if (loading) cursor = "cursor-progress";

  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      disabled={disabled}
      aria-busy={loading ? true : undefined}
      aria-disabled={loading ? true : ariaDisabled}
      onClick={handleClick}
      className={cn(
        "group relative inline-flex touch-manipulation bg-transparent p-0 [-webkit-tap-highlight-color:transparent]",
        iconOnly ? "rounded-full" : sizeStyle.radius,
        cursor,
        className,
      )}
    >
      {hasShadow && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 translate-x-[2px] translate-y-[2px] rounded-[inherit] bg-stroke"
        />
      )}
      <span
        className={cn(
          FACE_BASE,
          FACE_MOTION,
          iconOnly ? sizeStyle.iconFace : cn("flex-1", sizeStyle.face),
          disabled === true ? FACE_DISABLED : VARIANT_FACE[variant],
          interactive && (variant === "ghost" ? FACE_PHYSICS_FLAT : FACE_PHYSICS),
          interactive && VARIANT_HOVER_FILL[variant],
          interactive && VARIANT_ACTIVE_FILL[variant],
        )}
      >
        <span
          className={cn("inline-flex items-center justify-center gap-2", loading && "opacity-0")}
        >
          {children}
        </span>
        {loading && <RetroSpinner />}
      </span>
    </button>
  );
});

import { forwardRef } from "react";
import { Button, type ButtonProps, type ButtonSize } from "./Button";

/* ========================================
   Arcade IconButton: the circular, icon-only Button (GLOBAL-STYLES-SPEC §10 "icon (circle)").
   Same variants, press physics, sound and loading behavior as Button; it only changes the
   shape and requires an accessible name, since there is no visible text.
   Icons should be Lucide at 16/20/24 px; stroke width is set to 2.5 by the face.
   ======================================== */

export type IconButtonSize = Exclude<ButtonSize, "pill">;

export interface IconButtonProps extends Omit<ButtonProps, "size" | "iconOnly" | "aria-label"> {
  /** Accessible name. Required because the button has no visible text. */
  "aria-label": string;
  /** 36px, 44px or 56px circle. Default `md`. */
  size?: IconButtonSize | undefined;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = "md", children, ...rest },
  ref,
) {
  return (
    <Button ref={ref} size={size} iconOnly {...rest}>
      {children}
    </Button>
  );
});

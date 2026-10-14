import { forwardRef } from "react";
import { RetroContainer, type RetroContainerProps } from "@/shared/components/ui/Surface";

/* ========================================
   Arcade Card (GLOBAL-STYLES-SPEC §10 "Card": white fill, ink outline, hard shadow, squircle 24)

   A content card: a RetroContainer with the card defaults.
     outline   solid 2px ink
     shadow    hard black offset, `shadow` = "sm" (2px), "md" (4px, default) or "lg" (8px)
     header    optional band (class `card-header-band`) in a world accent color, attached to the
               top edge; `header` is its content and `headerTone` is main, soft or pop
     hover     `hoverable` lifts the card 4px and grows the shadow one step
     tag       `as` renders a div (default), section or article

   Sizes, fills and radii are the Surface props (`padding`, `tone`, `radius`, `world`).
   ======================================== */

export type CardProps = RetroContainerProps;

export const Card = forwardRef<HTMLElement, CardProps>(function Card(props, ref) {
  return <RetroContainer ref={ref} {...props} />;
});

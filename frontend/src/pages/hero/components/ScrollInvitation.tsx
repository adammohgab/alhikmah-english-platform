import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";

interface ScrollInvitationProps {
  visible: boolean;
}

/**
 * Bottom ~10vh of the first viewport. Connects hero to the rest of the page.
 * Small 6–12px float with smooth easing — never a bouncing advertisement.
 * Fades out once the user begins scrolling.
 */
export function ScrollInvitation({ visible }: ScrollInvitationProps) {
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "flex h-[10dvh] flex-col items-center justify-center gap-1 transition-opacity duration-500",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
        Explore the platform
      </p>
      <span className="hero-scroll-arrow inline-flex h-8 w-8 items-center justify-center text-white/80">
        <ChevronDown size={20} strokeWidth={1.5} />
      </span>
    </div>
  );
}

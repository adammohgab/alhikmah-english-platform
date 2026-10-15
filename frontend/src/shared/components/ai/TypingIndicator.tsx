import { cn } from "@/shared/lib/utils/cn";
import { PipAvatar } from "./PipAvatar";

/* Three pulsing dots (or Pip thinking, with `withAvatar`). One polite status announcement,
   no looping speech. The pulse only runs when the user has not asked for reduced motion. */

export interface TypingIndicatorProps {
  /** Announced to screen readers. Default "Pip is thinking". */
  label?: string | undefined;
  /** Shows Pip's thinking pose next to the dots. */
  withAvatar?: boolean | undefined;
  className?: string | undefined;
}

export function TypingIndicator({
  label = "Pip is thinking",
  withAvatar = false,
  className,
}: TypingIndicatorProps) {
  return (
    <div role="status" className={cn("inline-flex items-center gap-2", className)}>
      {withAvatar && <PipAvatar size={32} thinking />}
      <span aria-hidden="true" className="flex h-6 items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{ animationDelay: `${i * 160}ms` }}
            className="h-2.5 w-2.5 rounded-full border-2 border-stroke bg-[var(--world-main,#ffb84d)] motion-safe:animate-pulse"
          />
        ))}
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

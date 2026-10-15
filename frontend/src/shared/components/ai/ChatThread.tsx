import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { Button } from "../ui/Button";

/* Scrollable message list that follows streaming text without jitter.
   - Sticks to the bottom only while the reader is already at (or near) the bottom. Scrolling up
     to read earlier messages is never fought; "Jump to latest" brings the reader back.
   - Follows growth with a ResizeObserver, applying at most one instant scroll per frame
     (no smooth scrolling, which stutters when tokens arrive faster than the animation).
   - Turns off the browser's own scroll anchoring so it cannot fight the explicit scroll.
   - role="log" announces added messages politely; a streaming reply is a single node growing
     (aria-busy on the message), so it is not re-read token by token.
   Give it a height from the parent (for example `min-h-0 flex-1`). */

const NEAR_BOTTOM_PX = 48;

export interface ChatThreadProps {
  children: ReactNode;
  /** Accessible name of the conversation. Default "Conversation". */
  label?: string | undefined;
  className?: string | undefined;
}

export function ChatThread({ children, label = "Conversation", className }: ChatThreadProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const frame = useRef(0);
  const [away, setAway] = useState(false);

  const toBottom = () => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    const inner = content.current;
    if (!inner || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!pinned.current || frame.current !== 0) return;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = 0;
        toBottom();
      });
    });
    observer.observe(inner);
    toBottom();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
    pinned.current = atBottom;
    setAway((previous) => (previous === !atBottom ? previous : !atBottom));
  };

  const jump = () => {
    pinned.current = true;
    setAway(false);
    toBottom();
  };

  /* eslint-disable jsx-a11y/no-noninteractive-tabindex -- keyboard users need to scroll the conversation */
  return (
    <div className={cn("relative flex min-h-0 flex-col", className)}>
      <div
        ref={scroller}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={label}
        tabIndex={0}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-stroke"
      >
        <div ref={content} data-lenis-prevent className="flex flex-col gap-4 p-4">
          {children}
        </div>
      </div>
      {away && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            sound={false}
            onClick={jump}
            className="pointer-events-auto"
          >
            <ArrowDown size={16} aria-hidden="true" />
            <span>Jump to latest</span>
          </Button>
        </div>
      )}
    </div>
  );
  /* eslint-enable jsx-a11y/no-noninteractive-tabindex */
}

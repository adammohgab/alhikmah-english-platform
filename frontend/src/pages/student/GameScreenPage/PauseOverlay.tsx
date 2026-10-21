import { useEffect, useRef } from "react";
import { Play, Volume2, VolumeX, X } from "lucide-react";

export interface PauseOverlayProps {
  gameName: string;
  muted: boolean;
  onResume: () => void;
  onExit: () => void;
  onToggleMute: () => void;
}

/** Accessible pause dialog. The parent shell freezes game time while this is open. */
export function PauseOverlay({
  gameName,
  muted,
  onResume,
  onExit,
  onToggleMute,
}: PauseOverlayProps) {
  const resumeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resumeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onResume();
        return;
      }
      if (event.key !== "Tab") return;
      const buttons =
        dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      const firstButton = buttons?.[0];
      const lastButton = buttons?.[buttons.length - 1];
      if (!firstButton || !lastButton) return;
      if (event.shiftKey && document.activeElement === firstButton) {
        event.preventDefault();
        lastButton.focus();
      } else if (!event.shiftKey && document.activeElement === lastButton) {
        event.preventDefault();
        firstButton.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onResume]);

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[#14112A]/80 p-4">
      <section
        ref={dialogRef}
        aria-labelledby="game-pause-title"
        aria-describedby="game-pause-description"
        aria-modal="true"
        role="dialog"
        className="w-full max-w-sm border-2 border-[#1A1530] bg-white p-6 text-center text-[#1A1530] shadow-[6px_6px_0_#0B0919]"
      >
        <div
          className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full border-2 border-[#1A1530] bg-[#FFE27A] text-3xl shadow-[3px_3px_0_#1A1530]"
          aria-hidden="true"
        >
          Ⅱ
        </div>
        <p className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-[#4A4566]">
          Game paused
        </p>
        <h2 id="game-pause-title" className="text-3xl font-black">
          Take a breather!
        </h2>
        <p id="game-pause-description" className="mb-6 mt-2 text-sm text-[#4A4566]">
          {gameName} is on hold. Your round timer will resume when you do.
        </p>
        <div className="grid gap-3">
          <button
            ref={resumeRef}
            type="button"
            onClick={onResume}
            className="inline-flex min-h-12 items-center justify-center gap-2 border-2 border-[#1A1530] bg-[#B9F27C] px-4 font-black shadow-[3px_3px_0_#1A1530] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#315D13] active:translate-y-0 active:shadow-none"
          >
            <Play size={18} aria-hidden="true" /> Resume game
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex min-h-11 items-center justify-center gap-2 border-2 border-[#1A1530] bg-white px-4 font-bold hover:bg-[#F3F0FF] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#5B4ACB]"
          >
            {muted ? (
              <VolumeX size={18} aria-hidden="true" />
            ) : (
              <Volume2 size={18} aria-hidden="true" />
            )}
            Sound {muted ? "off" : "on"}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="inline-flex min-h-11 items-center justify-center gap-2 border-2 border-[#1A1530] bg-[#FFD8D8] px-4 font-bold hover:bg-[#FFC2C2] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#8F2424]"
          >
            <X size={18} aria-hidden="true" /> Exit game
          </button>
        </div>
      </section>
    </div>
  );
}

export default PauseOverlay;

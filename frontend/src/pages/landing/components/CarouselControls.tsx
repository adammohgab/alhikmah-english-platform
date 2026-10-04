import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { AUTOPLAY_MS, HERO_SLIDES } from "@/pages/landing/data";
import { cn } from "@/shared/lib/utils/cn";

interface CarouselControlsProps {
  index: number;
  paused: boolean;
  onSelect: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onTogglePause: () => void;
  /** Horizontal, denser layout for below-lg, where the 20vw side column
   * gets replaced by a single stacked column and there's no room for a
   * left rail. */
  compact?: boolean;
}

/**
 * hero.md §11:
 *   01 ━━━━━━━━━
 *   02 ━━━━━
 *   03 ━━━━━
 *   04 ━━━━━
 * A vertical stack, each row its own number + progress bar, the active
 * row's bar longer and filling live over the autoplay period. Lives in the
 * hero's left ~20vw column on desktop; collapses to a compact horizontal
 * row under the slide on smaller screens.
 */
export function CarouselControls({
  index,
  paused,
  onSelect,
  onPrev,
  onNext,
  onTogglePause,
  compact = false,
}: CarouselControlsProps) {
  return (
    <div className={cn("flex gap-4", compact ? "flex-row items-center" : "flex-row items-center")}>
      <div
        className={cn("flex", compact ? "flex-row items-center gap-4" : "flex-row items-center gap-4")}
        role="tablist"
        aria-label="Featured slides"
      >
        {HERO_SLIDES.map((slide, i) => {
          const isActive = i === index;
          return (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Show ${slide.title}`}
              onClick={() => onSelect(i)}
              className="group flex min-h-[40px] items-center gap-3 rounded-sm py-1 pe-1"
            >
              <span
                className={cn(
                  "font-sans text-[12px] font-semibold tabular-nums transition-colors duration-100",
                  isActive ? "text-white" : "text-white/45 group-hover:text-white/75",
                )}
              >
                {slide.indexLabel}
              </span>
              <span
                className={cn(
                  "relative h-[3px] overflow-hidden rounded-full bg-white/20 transition-[width] duration-300 ease-out",
                  compact ? (isActive ? "w-16" : "w-6") : isActive ? "w-32" : "w-12",
                )}
              >
                {isActive && (
                  <span
                    key={`progress-${index}-${paused}`}
                    className="hero-progress-fill absolute inset-y-0 left-0 rounded-full bg-gold-500"
                    style={{
                      animationDuration: `${AUTOPLAY_MS}ms`,
                      animationPlayState: paused ? "paused" : "running",
                    }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className={cn("flex items-center gap-2", compact ? "ms-2" : "ms-2")}>
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous slide"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 text-white/80 transition-colors duration-100 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={18} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={onTogglePause}
          aria-label={paused ? "Resume automatic rotation" : "Pause automatic rotation"}
          aria-pressed={paused}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 text-white/80 transition-colors duration-100 hover:bg-white/10 hover:text-white"
        >
          {paused ? <Play size={18} strokeWidth={1.5} /> : <Pause size={18} strokeWidth={1.5} />}
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next slide"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 text-white/80 transition-colors duration-100 hover:bg-white/10 hover:text-white"
        >
          <ArrowRight size={18} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

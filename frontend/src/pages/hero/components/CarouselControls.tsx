import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { AUTOPLAY_MS, HERO_SLIDES } from "@/pages/hero/data";
import { cn } from "@/shared/lib/utils/cn";

interface CarouselControlsProps {
  index: number;
  paused: boolean;
  onSelect: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onTogglePause: () => void;
}

/**
 * Subtle progress + manual navigation. Active slide has a longer indicator
 * that fills over the autoplay period. Manual use pauses rotation.
 */
export function CarouselControls({
  index,
  paused,
  onSelect,
  onPrev,
  onNext,
  onTogglePause,
}: CarouselControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="flex items-center gap-2.5" role="tablist" aria-label="Featured slides">
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
              className="group flex min-h-[40px] min-w-[40px] items-center gap-2 rounded-sm px-1"
            >
              <span
                className={cn(
                  "font-sans text-[12px] font-semibold tabular-nums transition-colors duration-100",
                  isActive ? "text-white" : "text-white/50 group-hover:text-white/80",
                )}
              >
                {slide.indexLabel}
              </span>
              <span
                className={cn(
                  "relative h-[3px] overflow-hidden rounded-full bg-white/20",
                  isActive ? "w-16" : "w-7",
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

      <div className="ms-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePause}
          aria-label={paused ? "Resume automatic rotation" : "Pause automatic rotation"}
          aria-pressed={paused}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/20 text-white/85 transition-colors duration-100 hover:bg-white/10 hover:text-white"
        >
          {paused ? <Play size={20} strokeWidth={1.5} /> : <Pause size={20} strokeWidth={1.5} />}
        </button>
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous slide"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/20 text-white/85 transition-colors duration-100 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next slide"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/20 text-white/85 transition-colors duration-100 hover:bg-white/10 hover:text-white"
        >
          <ArrowRight size={20} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

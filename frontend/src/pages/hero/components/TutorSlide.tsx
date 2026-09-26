import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";

interface TutorSlideProps {
  active: boolean;
}

type TutorPhase = 0 | 1 | 2 | 3;

/**
 * Slide 03 — AI Tutor. Alive conversation interface: question appears,
 * thinking indicator, response reveals, key phrase highlights.
 */
export function TutorSlide({ active }: TutorSlideProps) {
  const [phase, setPhase] = useState<TutorPhase>(0);

  useEffect(() => {
    if (!active) {
      setPhase(0);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPhase(3);
      return;
    }
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setPhase(1), 900));
    timers.push(window.setTimeout(() => setPhase(2), 2200));
    timers.push(window.setTimeout(() => setPhase(3), 3400));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [active]);

  return (
    <div className="grid h-full w-full grid-cols-1 items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-12">
      <div className="max-w-xl">
        <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.18em] text-gold-500">
          Meet your AI tutor
        </p>
        <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1.1] text-white sm:text-5xl lg:text-6xl">
          Ask questions.
          <br />
          Keep learning.
        </h2>
        <p className="mt-4 max-w-md font-sans text-[15px] leading-6 text-white/75">
          Practice English and get instant guidance — grammar, vocabulary and explanations
          tuned to your grade.
        </p>
        <Link
          to="/ai-tutor"
          tabIndex={active ? 0 : -1}
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-md bg-gold-500 px-5 font-sans text-[15px] font-semibold text-navy-900 transition-colors duration-100 hover:bg-gold-600"
        >
          Start practicing
          <ArrowRight size={20} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </div>

      <div className="flex items-center justify-center" aria-hidden={!active}>
        <div className="w-full max-w-[440px] rounded-lg border border-white/12 bg-white p-5 text-ink-900 shadow-elevation-3">
          <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            AI Tutor — Grade 10
          </p>
          <div className="mt-3 space-y-3" aria-live="polite">
            <div
              className={cn(
                "ml-auto w-fit max-w-[90%] rounded-md rounded-br-sm bg-navy-900 px-3 py-2.5 font-sans text-[14px] text-white transition-all duration-300",
                phase >= 0 && active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
              )}
            >
              Why do we use &ldquo;had been&rdquo; here?
            </div>

            {phase === 1 && (
              <div className="flex w-fit items-center gap-1.5 rounded-md rounded-bl-sm border border-line-200 bg-surface-50 px-3 py-2.5">
                <span className="hero-thinking-dot" />
                <span className="hero-thinking-dot" />
                <span className="hero-thinking-dot" />
                <span className="sr-only">AI Tutor is thinking</span>
              </div>
            )}

            {phase >= 2 && (
              <div className="w-fit max-w-[95%] rounded-md rounded-bl-sm border border-line-200 bg-surface-50 px-3 py-2.5 font-sans text-[14px] leading-6 text-ink-900">
                We use it to describe an action that continued up to another moment in the
                past —{" "}
                <mark
                  className={cn(
                    "rounded-sm px-1 transition-colors duration-500",
                    phase >= 3 ? "bg-gold-500/40" : "bg-transparent",
                  )}
                >
                  the past perfect continuous
                </mark>
                .
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

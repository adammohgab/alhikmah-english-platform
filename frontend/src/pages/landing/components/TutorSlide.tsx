import { useEffect, useState } from "react";
import { BookOpen, GraduationCap, Languages, MessageCircle } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { HeroSlideCopy } from "@/pages/landing/components/HeroSlideCopy";

interface TutorSlideProps {
  active: boolean;
}

type TutorPhase = 0 | 1 | 2 | 3;

const TUTOR_CAPABILITIES = [
  { icon: BookOpen, label: "Grammar explanations" },
  { icon: Languages, label: "Vocabulary practice" },
  { icon: MessageCircle, label: "Instant answers" },
  { icon: GraduationCap, label: "Tuned to Grade 10" },
];

/**
 * Slide 03 — AI Tutor. Copy on the left; on the right, a conversation that
 * plays out live (question → thinking → response → highlighted phrase)
 * next to a short list of what the tutor actually does.
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
    <div className="grid h-full w-full grid-cols-1 items-center gap-6 px-4 pt-16 sm:px-6 lg:grid-cols-10 lg:gap-6 lg:px-8 lg:pt-12">
      <div className="lg:col-span-5 flex flex-col justify-center">
        <HeroSlideCopy
          active={active}
          eyebrow="Meet your AI tutor"
          heading={
            <>
              Ask questions.
              <br />
              Keep learning.
            </>
          }
          body="Practice English and get instant guidance — grammar, vocabulary and explanations tuned to your grade."
          ctaLabel="Start practicing"
          ctaHref="/ai-tutor"
        />
      </div>

      <div
        className="grid grid-cols-1 gap-5 lg:col-span-5 lg:grid-cols-2"
        aria-hidden={!active}
      >
        <div className="flex h-full w-full flex-col rounded-lg bg-surface-0 p-6 text-ink-900 shadow-elevation-3">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            AI Tutor — Grade 10
          </p>
          <div className="mt-4 flex-1 space-y-3 overflow-y-auto" aria-live="polite">
            <div
              className={cn(
                "ml-auto w-fit max-w-[90%] rounded-md rounded-br-sm bg-navy-900 px-4 py-3 font-sans text-[14px] text-white transition-all duration-300",
                phase >= 0 && active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
              )}
            >
              Why do we use &ldquo;had been&rdquo; here?
            </div>

            {phase === 1 && (
              <div className="flex w-fit items-center gap-1.5 rounded-md rounded-bl-sm border border-line-200 bg-surface-50 px-4 py-3">
                <span className="hero-thinking-dot" />
                <span className="hero-thinking-dot" />
                <span className="hero-thinking-dot" />
                <span className="sr-only">AI Tutor is thinking</span>
              </div>
            )}

            {phase >= 2 && (
              <div className="w-fit max-w-[95%] rounded-md rounded-bl-sm border border-line-200 bg-surface-50 px-4 py-3 font-sans text-[14px] leading-6 text-ink-900">
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

        <div className="hidden h-full w-full flex-col rounded-lg bg-surface-0 p-6 text-ink-900 shadow-elevation-3 lg:flex">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            What the tutor does
          </p>
          <ul className="mt-4 flex-1 space-y-3.5 overflow-y-auto">
            {TUTOR_CAPABILITIES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 font-sans text-[14px] font-medium">
                <Icon size={18} strokeWidth={1.5} className="shrink-0 text-navy-500" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

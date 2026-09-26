import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

interface GameSlideProps {
  active: boolean;
}

/**
 * Slide 02 — Educational Game. Polished preview of Grammar Challenge with
 * subtle movement: floating card, animated score, highlighted answer.
 * Energetic but never chaotic.
 */
export function GameSlide({ active }: GameSlideProps) {
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!active) {
      setScore(0);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setScore(1280);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const target = 1280;
    const tick = (now: number) => {
      const t = Math.min((now - start) / 1600, 1);
      setScore(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <div className="grid h-full w-full grid-cols-1 items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-12">
      <div className="max-w-xl">
        <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.18em] text-gold-500">
          New game
        </p>
        <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1.1] text-white sm:text-5xl lg:text-6xl">
          Grammar
          <br />
          Challenge.
        </h2>
        <p className="mt-4 max-w-md font-sans text-[15px] leading-6 text-white/75">
          Test your grammar. Beat your score. Improve your English — one timed round at a
          time.
        </p>
        <Link
          to="/games/grammar"
          tabIndex={active ? 0 : -1}
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-md bg-gold-500 px-5 font-sans text-[15px] font-semibold text-navy-900 transition-colors duration-100 hover:bg-gold-600"
        >
          Play now
          <ArrowRight size={20} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </div>

      <div className="flex items-center justify-center" aria-hidden={!active}>
        <div className="hero-game-card w-full max-w-[440px] rounded-lg border border-white/12 bg-white p-5 text-ink-900 shadow-elevation-3">
          <div className="flex items-center justify-between">
            <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-500">
              Grammar Challenge — Round 03
            </p>
            <p className="font-sans text-[13px] font-semibold tabular-nums text-navy-900">
              {score.toLocaleString()} pts
            </p>
          </div>
          <p className="mt-4 font-sans text-[15px] font-medium">
            Choose the correct sentence:
          </p>
          <ul className="mt-3 space-y-2">
            <li className="rounded-md border border-line-200 bg-surface-50 px-3 py-2.5 font-sans text-[14px] text-ink-700">
              She don&apos;t like reading stories.
            </li>
            <li className="flex items-center justify-between rounded-md border border-success-600 bg-success-100 px-3 py-2.5 font-sans text-[14px] font-semibold text-ink-900">
              She doesn&apos;t like reading stories.
              <Check size={20} strokeWidth={1.5} className="text-success-600" aria-label="Correct answer" />
            </li>
            <li className="rounded-md border border-line-200 bg-surface-0 px-3 py-2.5 font-sans text-[14px] text-ink-700">
              She not likes reading stories.
            </li>
          </ul>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-100">
            <div className="hero-game-progress h-full w-2/3 rounded-full bg-navy-900" />
          </div>
        </div>
      </div>
    </div>
  );
}

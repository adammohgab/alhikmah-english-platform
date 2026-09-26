import { useCallback, useEffect, useRef, useState } from "react";
import { AUTOPLAY_MS } from "@/pages/hero/data";

interface HeroCarouselApi {
  index: number;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  togglePause: () => void;
  goTo: (i: number) => void;
  next: () => void;
  prev: () => void;
}

/**
 * 10s autoplay, manual interaction pauses rotation temporarily,
 * resumes after inactivity. Pauses when tab hidden or reduced-motion.
 */
export function useHeroCarousel(total: number): HeroCarouselApi {
  const [index, setIndex] = useState(0);
  const [hoverPaused, setPaused] = useState(false);
  const [manualHold, setManualHold] = useState(false);
  const timer = useRef<number | null>(null);
  const resumeTimer = useRef<number | null>(null);

  const pokeManualHold = useCallback(() => {
    setManualHold(true);
    if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setManualHold(false), 20_000);
  }, []);

  const goTo = useCallback(
    (i: number) => {
      setIndex(((i % total) + total) % total);
      pokeManualHold();
    },
    [total, pokeManualHold],
  );

  const next = useCallback(() => {
    setIndex((prev) => (prev + 1) % total);
    pokeManualHold();
  }, [total, pokeManualHold]);

  const prev = useCallback(() => {
    setIndex((prev) => (prev - 1 + total) % total);
    pokeManualHold();
  }, [total, pokeManualHold]);

  const togglePause = useCallback(() => {
    const effectivelyPaused = hoverPaused || manualHold;
    if (effectivelyPaused) {
      setPaused(false);
      setManualHold(false);
    } else {
      setPaused(true);
    }
  }, [hoverPaused, manualHold]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const effectivelyPaused = hoverPaused || manualHold || reduced || document.hidden;

    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (effectivelyPaused) return;

    timer.current = window.setTimeout(() => {
      setIndex((prev) => (prev + 1) % total);
    }, AUTOPLAY_MS);

    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [index, hoverPaused, manualHold, total]);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    };
  }, []);

  return { index, paused: hoverPaused || manualHold, setPaused, togglePause, goTo, next, prev };
}

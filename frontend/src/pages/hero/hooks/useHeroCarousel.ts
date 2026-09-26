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
 * Explicit pause button toggles paused state independently.
 */
export function useHeroCarousel(total: number): HeroCarouselApi {
  const [index, setIndex] = useState(0);
  const [hoverPaused, setPaused] = useState(false);
  const [manualHold, setManualHold] = useState(false);
  const [explicitPaused, setExplicitPaused] = useState(false);
  const timer = useRef<number | null>(null);
  const resumeTimer = useRef<number | null>(null);
  const isTransitioning = useRef(false);

  const pokeManualHold = useCallback(() => {
    setManualHold(true);
    if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setManualHold(false), 15_000);
  }, []);

  const goTo = useCallback(
    (i: number) => {
      if (isTransitioning.current) return;
      isTransitioning.current = true;
      setIndex(((i % total) + total) % total);
      pokeManualHold();
      setTimeout(() => { isTransitioning.current = false; }, 1000);
    },
    [total, pokeManualHold],
  );

  const next = useCallback(() => {
    if (isTransitioning.current) return;
    isTransitioning.current = true;
    setIndex((prev) => (prev + 1) % total);
    pokeManualHold();
    setTimeout(() => { isTransitioning.current = false; }, 1000);
  }, [total, pokeManualHold]);

  const prev = useCallback(() => {
    if (isTransitioning.current) return;
    isTransitioning.current = true;
    setIndex((prev) => (prev - 1 + total) % total);
    pokeManualHold();
    setTimeout(() => { isTransitioning.current = false; }, 1000);
  }, [total, pokeManualHold]);

  const togglePause = useCallback(() => {
    setExplicitPaused((prev) => {
      const next = !prev;
      if (next) {
        setManualHold(false);
        if (resumeTimer.current !== null) {
          window.clearTimeout(resumeTimer.current);
          resumeTimer.current = null;
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const effectivelyPaused = hoverPaused || manualHold || explicitPaused || reduced || document.hidden;

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
  }, [index, hoverPaused, manualHold, explicitPaused, total]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      // Timer effect will handle resume/pause based on document.hidden
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    };
  }, []);

  return { index, paused: hoverPaused || manualHold || explicitPaused, setPaused, togglePause, goTo, next, prev };
}
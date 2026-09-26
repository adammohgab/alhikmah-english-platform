import { useEffect, useRef } from "react";
import gsap from "gsap";
import { HERO_SLIDES, TRANSITION_MS } from "@/pages/hero/data";
import { MagazineSlide } from "@/pages/hero/components/MagazineSlide";
import { GameSlide } from "@/pages/hero/components/GameSlide";
import { TutorSlide } from "@/pages/hero/components/TutorSlide";
import { CourseSlide } from "@/pages/hero/components/CourseSlide";
import { CarouselControls } from "@/pages/hero/components/CarouselControls";
import type { useHeroCarousel } from "@/pages/hero/hooks/useHeroCarousel";
import { usePrefersReducedMotion } from "@/pages/hero/hooks/usePrefersReducedMotion";

type CarouselApi = ReturnType<typeof useHeroCarousel>;

interface HeroCarouselProps {
  carousel: CarouselApi;
}

/** English alphabet letters for decorative background */
const ENGLISH_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
];

/** Color palette for background letters */
const BG_COLORS = [
  "#D4A02B", // gold
  "#F5D76E", // light gold
  "#1E5FA8", // info blue
  "#3B82F6", // bright blue
  "#1F7A4D", // success green
  "#4ADE80", // light green
  "#A66A0A", // amber
  "#F97316", // orange
  "#EC4899", // pink
  "#8B5CF6", // purple
];

/** Decorative background with appearing/disappearing English letters and lines */
function HeroBackground({ reduced }: { reduced: boolean }) {
  const lettersRef = useRef<Array<{ char: string; x: number; y: number; size: number; opacity: number; delay: number; rot: number; color: string; phase: number }>>([]);
  const linesRef = useRef<Array<{ x1: number; y1: number; x2: number; y2: number; opacity: number; color: string }>>([]);

  useEffect(() => {
    if (reduced) return;

    // Initialize letters - appear/disappear at random positions (2x more)
    for (let i = 0; i < 50; i++) {
      lettersRef.current.push({
        char: ENGLISH_LETTERS[Math.floor(Math.random() * ENGLISH_LETTERS.length)],
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1.8 + Math.random() * 3,
        opacity: 0,
        delay: Math.random() * 4000,
        rot: Math.random() * 360,
        color: BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)],
        phase: Math.random() * 10000,
      });
    }

    // Initialize subtle lines
    for (let i = 0; i < 8; i++) {
      linesRef.current.push({
        x1: Math.random() * 100,
        y1: Math.random() * 100,
        x2: Math.random() * 100,
        y2: Math.random() * 100,
        opacity: 0.02 + Math.random() * 0.04,
        color: BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)],
      });
    }

    // Animation loop - regenerate letters periodically
    let animationFrame: number;
    const animate = () => {
      const now = Date.now();
      lettersRef.current.forEach((letter, i) => {
        const cycle = 8000 + (i * 120);
        const cyclePos = (now + letter.phase) % cycle;
        const fadeIn = 1000;
        const hold = 2000;
        const fadeOut = 1000;
        const totalVisible = fadeIn + hold + fadeOut;

        if (cyclePos < fadeIn) {
          letter.opacity = (cyclePos / fadeIn) * (0.08 + Math.random() * 0.12);
        } else if (cyclePos < fadeIn + hold) {
          letter.opacity = 0.08 + Math.random() * 0.12;
        } else if (cyclePos < totalVisible) {
          letter.opacity = ((totalVisible - cyclePos) / fadeOut) * (0.08 + Math.random() * 0.12);
        } else {
          letter.opacity = 0;
          // Move to new random position when invisible
          if (cyclePos === totalVisible + 10) {
            letter.x = Math.random() * 100;
            letter.y = Math.random() * 100;
            letter.char = ENGLISH_LETTERS[Math.floor(Math.random() * ENGLISH_LETTERS.length)];
            letter.color = BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];
            letter.size = 1.8 + Math.random() * 3;
            letter.rot = Math.random() * 360;
          }
        }
      });

      if (!reduced) animationFrame = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, [reduced]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      {/* Appearing/disappearing letters */}
      <div className="absolute inset-0" style={{ transform: "translateZ(0)" }}>
        {lettersRef.current.map((letter, i) => (
          <span
            key={`letter-${i}`}
            className="absolute select-none font-serif hero-bg-letter transition-opacity duration-1000"
            style={{
              left: `${letter.x}%`,
              top: `${letter.y}%`,
              fontSize: `${letter.size}rem`,
              opacity: reduced ? 0 : letter.opacity,
              color: letter.color,
              transform: `translate(-50%, -50%) rotate(${letter.rot}deg)`,
              pointerEvents: "none",
              filter: letter.opacity > 0.05 ? "drop-shadow(0 0 8px currentColor)" : "none",
            }}
          >
            {letter.char}
          </span>
        ))}
      </div>

      {/* Subtle decorative lines */}
      <div className="absolute inset-0" style={{ transform: "translateZ(0)" }}>
        {linesRef.current.map((line, i) => (
          <svg
            key={`line-${i}`}
            className="absolute hero-bg-line"
            style={{
              left: `${Math.min(line.x1, line.x2)}%`,
              top: `${Math.min(line.y1, line.y2)}%`,
              width: `${Math.abs(line.x2 - line.x1)}%`,
              height: `${Math.abs(line.y2 - line.y1)}%`,
              opacity: line.opacity,
              pointerEvents: "none",
            }}
            preserveAspectRatio="none"
          >
            <line
              x1="0"
              y1="0"
              x2="100%"
              y2="100%"
              stroke={line.color}
              strokeWidth="0.5"
              strokeDasharray="8,16"
              strokeLinecap="round"
            />
          </svg>
        ))}
      </div>
    </div>
  );
}

/**
 * 90dvh featured carousel. Spatial move/scale transition (700–1200ms),
 * never a hard cut or plain fade — except under reduced-motion.
 *
 * No scroll-linked animation lives here on purpose: this component owns a
 * fixed-height block, so nothing about it should read or react to page
 * scroll position. Mixing that in is what caused the "sometimes scrolls you
 * back" bug — a scrub effect kept fighting Lenis's inertia on a document
 * that's barely taller than one viewport.
 */
export function HeroCarousel({ carousel }: HeroCarouselProps) {
  const { index, paused, setPaused, togglePause, goTo, next, prev } = carousel;
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const reduced = usePrefersReducedMotion();

  // Slide transitions: current moves/scales out, next settles in.
  useEffect(() => {
    const ctx = gsap.context(() => {
      HERO_SLIDES.forEach((_, i) => {
        const el = slideRefs.current[i];
        if (!el) return;
        if (reduced) {
          gsap.set(el, { autoAlpha: i === index ? 1 : 0, x: 0, scale: 1 });
          return;
        }
        if (i === index) {
          gsap.fromTo(
            el,
            { autoAlpha: 0, x: i === 0 ? 48 : 64, scale: 0.985 },
            {
              autoAlpha: 1,
              x: 0,
              scale: 1,
              duration: TRANSITION_MS / 1000,
              ease: "power3.out",
              overwrite: "auto",
            },
          );
        } else {
          gsap.to(el, {
            autoAlpha: 0,
            x: i < index ? -56 : 56,
            scale: 0.985,
            duration: TRANSITION_MS / 1000,
            ease: "power3.out",
            overwrite: "auto",
          });
        }
      });
    });
    return () => ctx.revert();
  }, [index, reduced]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    }
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured experiences"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="relative flex h-[90dvh] w-full flex-col overflow-hidden bg-navy-900"
    >
      {/* Decorative English-themed background */}
      <HeroBackground reduced={reduced} />

      {/* Top scrim only — keeps the navbar/logo legible over any slide without
          a heavy nav background or decorative background typography. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-navy-900/70 via-navy-900/25 to-transparent"
      />

      <div className="relative h-full w-full pt-16">
        {HERO_SLIDES.map((slide, i) => (
          <div
            key={slide.id}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            aria-hidden={i !== index}
            className="absolute inset-0"
            style={{ visibility: i === index ? "visible" : "hidden" }}
          >
            {slide.id === "magazine" && <MagazineSlide active={i === index} />}
            {slide.id === "game" && <GameSlide active={i === index} />}
            {slide.id === "tutor" && <TutorSlide active={i === index} />}
            {slide.id === "course" && <CourseSlide active={i === index} />}
          </div>
        ))}

        {/* Horizontal carousel controls at bottom left for all screen sizes */}
        <div className="absolute left-4 bottom-5 z-20 flex items-center px-4 sm:px-6">
          <CarouselControls
            index={index}
            paused={paused}
            onSelect={goTo}
            onPrev={prev}
            onNext={next}
            onTogglePause={togglePause}
            compact
          />
        </div>
      </div>
    </section>
  );
}

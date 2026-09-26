import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HERO_SLIDES, TRANSITION_MS } from "@/pages/hero/data";
import { MagazineSlide } from "@/pages/hero/components/MagazineSlide";
import { GameSlide } from "@/pages/hero/components/GameSlide";
import { TutorSlide } from "@/pages/hero/components/TutorSlide";
import { CourseSlide } from "@/pages/hero/components/CourseSlide";
import { CarouselControls } from "@/pages/hero/components/CarouselControls";
import type { useHeroCarousel } from "@/pages/hero/hooks/useHeroCarousel";
import { usePrefersReducedMotion } from "@/pages/hero/hooks/usePrefersReducedMotion";

gsap.registerPlugin(ScrollTrigger);

type CarouselApi = ReturnType<typeof useHeroCarousel>;

interface HeroCarouselProps {
  carousel: CarouselApi;
}

/**
 * 90vh featured carousel. Spatial move/scale transition (700–1200ms),
 * never a hard cut or plain fade — except under reduced-motion.
 */
export function HeroCarousel({ carousel }: HeroCarouselProps) {
  const { index, paused, setPaused, togglePause, goTo, next, prev } = carousel;
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
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

  // Hero drifts away gently as the user scrolls into the next section.
  useEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      if (!sectionRef.current || !contentRef.current) return;
      gsap.to(contentRef.current, {
        y: 90,
        autoAlpha: 0.25,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, [reduced]);

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
      ref={sectionRef}
      aria-roledescription="carousel"
      aria-label="Featured experiences"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="relative flex h-[90vh] min-h-[560px] w-full flex-col overflow-hidden bg-navy-900"
    >
      {/* Backdrop typography — quiet, oversized, never decoration-first. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute -bottom-8 left-0 select-none whitespace-nowrap font-serif text-[22vw] font-semibold leading-none text-white/[0.04]">
          ENGLISH
        </span>
        <div className="absolute inset-0 bg-navy-900/10" />
      </div>

      <div ref={contentRef} className="relative flex h-full flex-col pt-16">
        <div className="relative flex-1">
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
        </div>

        <div className="relative mx-auto w-full max-w-[1440px] px-4 pb-5 sm:px-6 lg:px-8">
          <CarouselControls
            index={index}
            paused={paused}
            onSelect={goTo}
            onPrev={prev}
            onNext={next}
            onTogglePause={togglePause}
          />
        </div>
      </div>
    </section>
  );
}

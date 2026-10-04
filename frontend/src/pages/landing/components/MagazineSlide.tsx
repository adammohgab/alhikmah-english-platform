import { useRef } from "react";
import { MAGAZINE_PAGES } from "@/pages/hero/data";
import { HeroSlideCopy } from "@/pages/hero/components/HeroSlideCopy";

interface MagazineSlideProps {
  active: boolean;
}

/**
 * Slide 01 — Weekly Magazine. The magazine visually dominates the
 * viewport, sitting in an actual open-book frame: a cover-stock mat
 * around the spread, a spine crease shadow where the two pages meet, and
 * a soft "resting on a surface" shadow beneath. Hover nudges the spread
 * toward the cursor — perspective only, never a spinning 3D book.
 */
export function MagazineSlide({ active }: MagazineSlideProps) {
  const spreadRef = useRef<HTMLDivElement>(null);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = spreadRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1400px) rotateY(${px * 5}deg) rotateX(${-py * 4}deg) translate3d(${px * 8}px, ${py * 6}px, 0)`;
  };

  const onMouseLeave = () => {
    const el = spreadRef.current;
    if (!el) return;
    el.style.transform = "perspective(1400px) rotateY(0deg) rotateX(0deg) translate3d(0,0,0)";
  };

  return (
    <div className="grid h-full w-full grid-cols-1 items-center gap-6 px-4 pt-16 sm:px-6 lg:grid-cols-10 lg:items-center lg:gap-6 lg:px-8 lg:pt-12">
      <div className="lg:col-span-5">
        <div className="mb-4">
          <span className="inline-flex items-center rounded-full border border-gold-500/40 bg-gold-500/10 px-5 py-2 font-sans text-[16px] font-semibold uppercase tracking-[0.18em] text-gold-500">
            English Weekly — magazine
          </span>
        </div>
        <HeroSlideCopy
          active={active}
          eyebrow=""
          heading={
            <>
              This week&apos;s
              <br />
              English, in print.
            </>
          }
          body="Stories, vocabulary and ideas from across the school — the newest edition leads the platform this week."
          ctaLabel="Read full magazine"
          ctaHref="/magazine"
        />
      </div>

      <div className="flex justify-center lg:col-span-5 h-full" aria-hidden={!active}>
        {/* The frame: a cover-stock mat the pages sit inside, like an open
            magazine resting on a surface — not a floating cutout image. */}
        <div className="hero-magazine-frame w-full max-w-none h-full">
          <div
            ref={spreadRef}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            className="hero-magazine-spread relative flex w-full h-full gap-[3px] transition-transform duration-300 ease-out"
          >
            <div className="hero-magazine-page relative w-1/2 h-full overflow-hidden rounded-l-[6px]">
              <img
                src={MAGAZINE_PAGES.page1}
                alt={MAGAZINE_PAGES.alt1}
                className="block h-full w-full object-cover object-top"
                loading="eager"
                draggable={false}
              />
            </div>
            <div className="hero-magazine-page relative w-1/2 h-full overflow-hidden rounded-r-[6px]">
              <img
                src={MAGAZINE_PAGES.page2}
                alt={MAGAZINE_PAGES.alt2}
                className="block h-full w-full object-cover object-top"
                loading="eager"
                draggable={false}
              />
            </div>
            {/* Spine crease — the two pages meeting at the fold. */}
            <div className="hero-magazine-spine pointer-events-none absolute inset-y-0 left-1/2 w-6 -translate-x-1/2" />
          </div>
        </div>
      </div>
    </div>
  );
}

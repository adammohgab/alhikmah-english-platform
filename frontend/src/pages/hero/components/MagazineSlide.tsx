import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { MAGAZINE_PAGES } from "@/pages/hero/data";

interface MagazineSlideProps {
  active: boolean;
}

/**
 * Slide 01 — Weekly Magazine. Two real pages dominate the viewport with
 * slight perspective, subtle shadow, page separation and gentle parallax.
 * Hover moves the spread slightly toward the cursor. No aggressive 3D.
 */
export function MagazineSlide({ active }: MagazineSlideProps) {
  const spreadRef = useRef<HTMLDivElement>(null);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = spreadRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1200px) rotateY(${px * 6}deg) rotateX(${-py * 6}deg) translate3d(${px * 10}px, ${py * 8}px, 0)`;
  };

  const onMouseLeave = () => {
    const el = spreadRef.current;
    if (!el) return;
    el.style.transform = "perspective(1200px) rotateY(0deg) rotateX(0deg) translate3d(0,0,0)";
  };

  return (
    <div
      className="grid h-full w-full grid-cols-1 items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-12"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <div className="max-w-xl">
        <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.18em] text-gold-500">
          English Weekly — Issue 024
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.1] text-white sm:text-5xl lg:text-6xl">
          This week&apos;s
          <br />
          English, in print.
        </h1>
        <p className="mt-4 max-w-md font-sans text-[15px] leading-6 text-white/75">
          Stories, vocabulary and ideas from across the school — the newest issue leads the
          platform this week.
        </p>
        <Link
          to="/magazine"
          tabIndex={active ? 0 : -1}
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-md bg-gold-500 px-5 font-sans text-[15px] font-semibold text-navy-900 transition-colors duration-100 hover:bg-gold-600"
        >
          Read full issue
          <ArrowRight size={20} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </div>

      <div className="flex items-center justify-center" aria-hidden={!active}>
        <div
          ref={spreadRef}
          className="hero-magazine-spread flex w-full max-w-[560px] items-stretch justify-center gap-1 transition-transform duration-300 ease-out sm:gap-2"
        >
          <img
            src={MAGAZINE_PAGES.page1}
            alt={MAGAZINE_PAGES.alt1}
            className="aspect-[3/4] w-1/2 rounded-[4px] border border-white/15 bg-white object-cover shadow-elevation-3"
            loading="eager"
            draggable={false}
          />
          <img
            src={MAGAZINE_PAGES.page2}
            alt={MAGAZINE_PAGES.alt2}
            className="aspect-[3/4] w-1/2 rounded-[4px] border border-white/15 bg-white object-cover shadow-elevation-3"
            loading="eager"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}

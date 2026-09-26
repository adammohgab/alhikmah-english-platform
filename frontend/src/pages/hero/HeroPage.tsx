import { Navbar } from "@/shared/layout/Navbar";
import { HeroCarousel } from "@/pages/hero/components/HeroCarousel";
import { ScrollInvitation } from "@/pages/hero/components/ScrollInvitation";
import { useHeroCarousel } from "@/pages/hero/hooks/useHeroCarousel";
import { useLenis } from "@/pages/hero/hooks/useLenis";
import { useScrollNavbar } from "@/pages/hero/hooks/useScrollNavbar";
import { HERO_SLIDES } from "@/pages/hero/data";

/**
 * Hero page — Section 01 only (100vh total: 90vh carousel + 10vh scroll
 * invitation). Thin composer: wires hooks + shared layout + hero components.
 */
export function HeroPage() {
  useLenis();
  const { hidden, solid, scrollY } = useScrollNavbar();
  const carousel = useHeroCarousel(HERO_SLIDES.length);

  return (
    <div className="w-full bg-navy-900">
      <Navbar hidden={hidden} solid={solid} />
      <main>
        {/* Exactly one viewport tall — 90dvh carousel + 10dvh scroll
            invitation — never more, so there is no dead scroll zone below
            the hero for the browser's momentum scrolling to rubber-band
            against. dvh (not vh) keeps this stable while mobile browser
            chrome shows/hides during a scroll. */}
        <div className="flex h-[100dvh] flex-col overflow-hidden">
          <HeroCarousel carousel={carousel} />
          <div className="bg-navy-900">
            <ScrollInvitation visible={scrollY < 80} />
          </div>
        </div>
      </main>
    </div>
  );
}

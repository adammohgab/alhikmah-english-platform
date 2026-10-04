import { Navbar } from "@/shared/layout/Navbar";
import { Footer } from "@/shared/layout/Footer";
import { HeroCarousel } from "@/pages/landing/components/HeroCarousel";
import { ScrollInvitation } from "@/pages/landing/components/ScrollInvitation";
import { LandingSections } from "@/pages/landing/components/LandingSections";
import { useHeroCarousel } from "@/pages/landing/hooks/useHeroCarousel";
import { useLenis } from "@/pages/landing/hooks/useLenis";
import { useScrollNavbar } from "@/pages/landing/hooks/useScrollNavbar";
import { HERO_SLIDES } from "@/pages/landing/data";

/**
 * Home page — hero (100vh: 90vh carousel + 10vh scroll invitation) followed
 * by the full platform story (sections 02–12) and the footer. Thin composer:
 * wires hooks + shared layout + page sections.
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

        <LandingSections />
      </main>
      <Footer />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import gsap from "gsap";
import Lenis from "lenis";
import { SCHOOL_LOGO_SRC } from "@/shared/config/branding";
import { getRoleHomePath } from "@/app/guards/guard-utils";
import { useAuth } from "@/app/providers/auth-context";
import { PublicFooter } from "@/shared/components/layout/PublicFooter";
import { PublicHeader } from "@/shared/components/layout/PublicHeader";
import { Button } from "@/shared/components/ui/Button";
import { CurriculumSection } from "./CurriculumSection";
import { FeaturesSection } from "./FeaturesSection";
import { HeroSection } from "./HeroSection";

/* ========================================
   LandingPage: SH-01 "/" (SHARED-SPEC §5, PUB-03)

   Assembles the public landing page: PublicHeader, <main> with the Hero, Features and
   Curriculum sections and the sign-in banner, then PublicFooter. The header and footer are
   layout pieces, so this page renders them itself (the same way the other public pages do).

   Testimonials: the task text lists them, but the repo holds no real quotes and SHARED-SPEC
   SH-01 has no testimonial section. The page never invents testimonials, so none is rendered.
   Add the section here once the school supplies real, approved quotes.

   Smooth scroll (GLOBAL-STYLES-SPEC §8.3): one Lenis instance runs on the document while this
   page is mounted. It is driven from the GSAP ticker (`autoRaf` off), touch keeps native
   momentum (`syncTouch` off), and it is not created at all under `prefers-reduced-motion` or on
   the "low" effects tier, so those visitors get native scroll. It reacts when either setting
   changes while the page is open. The mobile menu of PublicHeader locks the page by setting
   `overflow: hidden` on <body>; the page watches that and pauses Lenis while it is set.
   In-page anchors from other pages ("/#curriculum") scroll to the section below the sticky
   header through Lenis, or through plain scrolling when Lenis is off. Anchor clicks inside this
   page (the hero "Explore" link) are handled by the section itself.

   SEO and OpenGraph: the title, the description and the OpenGraph and Twitter tags are set
   while the page is mounted, and the previous values are restored when it unmounts, so no
   other route inherits them. The share image is the school logo (the only image asset the
   repo holds) as an absolute URL, with its alt text. Replace `SHARE_IMAGE` with a dedicated
   1200 x 630 image once the school provides one.

   Layout shift (CLS): every section renders at its final size on the first paint. Nothing is
   lazy-loaded or inserted after load, and the only motion is `transform` and `opacity`.
   Class strings live in constants so the Tailwind class sorter treats them as plain data.
   ======================================== */

const MAIN_ID = "main-content";
const PLATFORM_NAME = "Al Hikmah English Platform";
const PAGE_TITLE = `Practice English every day | ${PLATFORM_NAME}`;
const PAGE_DESCRIPTION =
  "Lessons, quizzes, games and an AI tutor in one place for the students and teachers of Al Hikmah. Level up as you learn.";
const SHARE_IMAGE = SCHOOL_LOGO_SRC;
const SHARE_IMAGE_ALT = "Al Hikmah Private School logo";

const HEADER_HEIGHT_PX = 64;
const LOGIN_PATH = "/login";
const HELP_PATH = "/help";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const TIER_ATTRIBUTE = "data-effects-tier";
const LENIS_DURATION_S = 1.1;

const BANNER_CLASS =
  "w-full border-t-2 border-stroke bg-[var(--world-main,#ffb84d)] px-4 py-16 sm:px-6 md:py-24";
const BANNER_INNER_CLASS =
  "mx-auto flex w-full max-w-[1200px] flex-col items-center gap-6 text-center";
const BANNER_HEADING_CLASS =
  "font-heading text-3xl font-bold leading-tight text-stroke md:text-5xl";
const BANNER_TEXT_CLASS = "max-w-xl font-body text-lg font-semibold text-stroke md:text-xl";
const BANNER_HELP_CLASS =
  "rounded-[6px] font-body text-[15px] font-semibold text-stroke underline underline-offset-4 hover:decoration-2";

/* ---------- Motion switch ---------- */

function readMotionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  const reduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;
  return !reduced && document.documentElement.getAttribute(TIER_ATTRIBUTE) !== "low";
}

/** True while motion is allowed: no reduced-motion preference and not the "low" effects tier. */
function useMotionAllowed(): boolean {
  const [allowed, setAllowed] = useState<boolean>(readMotionAllowed);

  useEffect(() => {
    const update = () => setAllowed(readMotionAllowed());
    update();
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    query.addEventListener("change", update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [TIER_ATTRIBUTE],
    });
    return () => {
      query.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  return allowed;
}

/* ---------- Smooth scroll and anchors ---------- */

function useLandingScroll(motionAllowed: boolean): void {
  const { hash } = useLocation();
  const lenisRef = useRef<Lenis | null>(null);

  // One Lenis instance on the document, driven from the GSAP ticker (spec §8.3).
  useEffect(() => {
    if (!motionAllowed) return undefined;

    const lenis = new Lenis({
      duration: LENIS_DURATION_S,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 1,
      syncTouch: false,
      autoRaf: false,
    });
    lenisRef.current = lenis;

    const tick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // PublicHeader's mobile menu locks the page with `overflow: hidden` on <body>.
    const syncLock = () => {
      if (document.body.style.overflow === "hidden") lenis.stop();
      else lenis.start();
    };
    const observer = new MutationObserver(syncLock);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    syncLock();

    return () => {
      observer.disconnect();
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [motionAllowed]);

  // Anchors arriving from other pages, such as the header link "/#curriculum".
  useEffect(() => {
    if (hash === "") return;
    const target = document.getElementById(hash.slice(1));
    if (target === null) return;

    const lenis = lenisRef.current;
    if (lenis !== null) {
      lenis.scrollTo(target, { offset: -HEADER_HEIGHT_PX });
      return;
    }
    const top = target.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT_PX;
    window.scrollTo({ top, behavior: "auto" });
  }, [hash]);
}

/* ---------- SEO and OpenGraph ---------- */

interface MetaTag {
  attribute: "name" | "property";
  key: string;
  content: string;
}

/** Title, description, OpenGraph and Twitter tags, restored when the page unmounts. */
function useSeo(title: string, description: string, image: string | null, imageAlt: string): void {
  useEffect(() => {
    const pageUrl = new URL(import.meta.env.BASE_URL, window.location.origin).href;
    const tags: MetaTag[] = [
      { attribute: "name", key: "description", content: description },
      { attribute: "property", key: "og:type", content: "website" },
      { attribute: "property", key: "og:site_name", content: PLATFORM_NAME },
      { attribute: "property", key: "og:title", content: title },
      { attribute: "property", key: "og:description", content: description },
      { attribute: "property", key: "og:url", content: pageUrl },
      { attribute: "name", key: "twitter:card", content: "summary" },
      { attribute: "name", key: "twitter:title", content: title },
      { attribute: "name", key: "twitter:description", content: description },
    ];
    if (image !== null) {
      const imageUrl = new URL(image, window.location.origin).href;
      tags.push(
        { attribute: "property", key: "og:image", content: imageUrl },
        { attribute: "property", key: "og:image:alt", content: imageAlt },
        { attribute: "name", key: "twitter:image", content: imageUrl },
        { attribute: "name", key: "twitter:image:alt", content: imageAlt },
      );
    }

    const previousTitle = document.title;
    document.title = title;

    const restore: Array<() => void> = [];
    for (const { attribute, key, content } of tags) {
      const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      if (existing !== null) {
        const previous = existing.getAttribute("content");
        existing.setAttribute("content", content);
        restore.push(() => {
          if (previous === null) existing.removeAttribute("content");
          else existing.setAttribute("content", previous);
        });
      } else {
        const created = document.createElement("meta");
        created.setAttribute(attribute, key);
        created.setAttribute("content", content);
        document.head.appendChild(created);
        restore.push(() => {
          created.remove();
        });
      }
    }

    return () => {
      document.title = previousTitle;
      for (const undo of restore) undo();
    };
  }, [title, description, image, imageAlt]);
}

/* ---------- Sign-in banner (SH-01 section 8) ---------- */

function LoginBanner() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user } = useAuth();
  const homePath = isAuthenticated && user !== null ? getRoleHomePath(user.role) : null;
  const headingId = "login-banner-heading";

  const handleClick = () => {
    void navigate(homePath ?? LOGIN_PATH);
  };

  return (
    <section aria-labelledby={headingId} data-world="violet" className={BANNER_CLASS}>
      <div className={BANNER_INNER_CLASS}>
        <h2 id={headingId} className={BANNER_HEADING_CLASS}>
          Ready to continue?
        </h2>
        <p className={BANNER_TEXT_CLASS}>Sign in with the username your school gave you.</p>
        <Button variant="secondary" size="lg" loading={isLoading} onClick={handleClick}>
          {homePath === null ? "Sign in" : "Open my dashboard"}
        </Button>
        {homePath === null && (
          <Link to={HELP_PATH} className={BANNER_HELP_CLASS}>
            Need help signing in?
          </Link>
        )}
      </div>
    </section>
  );
}

/* ---------- Page ---------- */

export default function LandingPage() {
  const motionAllowed = useMotionAllowed();
  useSeo(PAGE_TITLE, PAGE_DESCRIPTION, SHARE_IMAGE, SHARE_IMAGE_ALT);
  useLandingScroll(motionAllowed);

  return (
    <>
      <PublicHeader mainId={MAIN_ID} />
      <main id={MAIN_ID}>
        <HeroSection />
        <FeaturesSection />
        <CurriculumSection />
        <LoginBanner />
      </main>
      <PublicFooter />
    </>
  );
}

export { LandingPage };

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode, RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, BookOpen, Star } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { SegmentedControl, type SegmentedOption } from "@/shared/components/ui/SegmentedControl";
import { Squiggle } from "@/shared/components/ui/Squiggle";
import { Sticker } from "@/shared/components/ui/Sticker";
import { DEFAULT_WORLD, isWorldId, type WorldId } from "@/shared/hooks/useWorld";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   HeroSection (PUB-01, SHARED-SPEC SH-01 section 1, GLOBAL-STYLES-SPEC §8)

   Left: the Caveat welcome badge, the one h1 of the page (Fredoka), a one-sentence subline, the
   primary arcade button "Sign In to Learn" (goes to /login) and the text link "Explore" (scrolls
   to the features section). Right: abstract art built from CSS shapes and four stickers, with a
   switcher that previews the color world of each skill. Under 1024px the art sits below the text
   and is cropped to a short height.

   World preview: the switcher only sets `data-world` on this section. The app world, the theme
   and the stored profile are untouched, so the preview never leaks to other pages. The button,
   the art and the switcher all read the same world variables, so one choice recolors the hero.
     Vocabulary rose, Grammar violet, Reading sky, Writing amber, Listening mint, Translation coral
   (the skill mapping from tokens.css, the same one CurriculumSection uses).

   Motion budget (SH spec: the hero entrance is the only orchestrated animation on the page):
     - Entrance: five blocks fade and rise once, 480ms, staggered by 90ms.
     - Floating: each sticker drifts on translateY only, 3.2 to 4.6s, and pauses while it is
       off screen (IntersectionObserver). The Sticker keeps its own spring hover tilt, so the
       drift runs on a wrapper and never competes with the sticker's transform.
     - Both run through the Web Animations API on the compositor (transform and opacity only).
     - Both are skipped under `prefers-reduced-motion` and on the "low" effects tier
       (`<html data-effects-tier>`), and they react when either changes while the page is open.
       Without motion the hero is simply drawn in its final state.

   The art, stickers and switcher caption hold no data. The page needs no provider except the
   router and the sound context the shared Button already requires.
   Class strings live in constants so the Tailwind class sorter treats them as plain data.
   ======================================== */

const LOGIN_PATH = "/login";
const EXPLORE_TARGET_ID = "features";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const TIER_ATTRIBUTE = "data-effects-tier";
const ENTRANCE_SELECTOR = "[data-entrance]";

const ENTRANCE_DURATION_MS = 480;
const ENTRANCE_STAGGER_MS = 90;
const ENTRANCE_EASING = "cubic-bezier(0.215, 0.61, 0.355, 1)";

const WORLD_OPTIONS: readonly (SegmentedOption & { value: WorldId; name: string })[] = [
  { value: "rose", label: "Vocabulary", name: "Vocabulary" },
  { value: "violet", label: "Grammar", name: "Grammar" },
  { value: "sky", label: "Reading", name: "Reading" },
  { value: "amber", label: "Writing", name: "Writing" },
  { value: "mint", label: "Listening", name: "Listening" },
  { value: "coral", label: "Translation", name: "Translation" },
];

const SECTION_CLASS =
  "relative w-full overflow-hidden bg-[var(--world-tint,#fff1e3)] px-4 pb-16 pt-10 sm:px-6 md:pb-24 md:pt-16";
const CONTAINER_CLASS =
  "mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-8";
const TEXT_COLUMN_CLASS = "flex flex-col items-start gap-6";
const WELCOME_CLASS =
  "inline-block -rotate-2 rounded-full border-2 border-stroke bg-[var(--world-soft,#ffd93d)] px-4 py-1 font-accent text-2xl font-bold text-stroke shadow-retro-sm";
const HEADING_CLASS =
  "font-heading text-4xl font-bold leading-[1.1] text-stroke sm:text-5xl lg:text-7xl";
const SUBLINE_CLASS = "max-w-xl font-body text-lg font-medium text-muted md:text-xl";
const ACTIONS_CLASS = "flex flex-wrap items-center gap-x-8 gap-y-4";
const EXPLORE_CLASS =
  "inline-flex h-14 items-center gap-2 rounded-[12px] font-heading text-[18px] font-semibold text-stroke underline decoration-2 underline-offset-4 hover:decoration-[var(--world-main,#ffb84d)] [&_svg]:[stroke-width:2.5]";
const QUIET_CLASS = "font-body text-[15px] font-medium text-muted";
const ART_COLUMN_CLASS = "flex flex-col items-center gap-6 lg:-mr-12 lg:items-end";
const ART_CLASS =
  "relative h-72 w-full max-w-md sm:h-96 sm:max-w-xl lg:h-[30rem] lg:max-w-none lg:pr-12";
const DISC_CLASS =
  "absolute right-4 top-4 h-56 w-56 rounded-full border-2 border-stroke bg-[var(--world-main,#ffb84d)] shadow-retro-lg sm:h-72 sm:w-72 lg:right-16 lg:h-96 lg:w-96";
const PAGE_CLASS =
  "absolute bottom-6 left-4 flex h-40 w-32 -rotate-6 flex-col gap-3 rounded-[12px] border-2 border-stroke bg-surface-0 p-3 shadow-retro-md sm:h-52 sm:w-40 lg:left-12 lg:h-64 lg:w-52 lg:p-5";
const PAGE_LINE_CLASS = "h-2 rounded-full bg-[var(--world-soft,#ffd93d)]";
const PAGE_LINE_WIDTHS: readonly string[] = ["w-3/4", "w-full", "w-2/3", "w-5/6"];
const STICKER_FACE_CLASS = "flex items-center justify-center bg-[var(--world-soft,#ffd93d)]";
const ALPHA_FACE_CLASS = "h-16 w-20 font-heading text-4xl font-bold text-stroke";
const HELLO_FACE_CLASS = "h-12 w-28 font-accent text-3xl font-bold text-stroke";
const ICON_FACE_CLASS = "h-14 w-14";
const STICKER_ICON_CLASS = "h-7 w-7 text-stroke [stroke-width:2.5]";
const EXPLORE_ICON_CLASS = "h-5 w-5";
const ALPHA_POSITION_CLASS = "absolute left-6 top-2 sm:left-12 lg:left-20";
const HELLO_POSITION_CLASS = "absolute bottom-24 right-2 sm:right-8 lg:right-20";
const STAR_POSITION_CLASS = "absolute right-6 top-0 sm:right-14 lg:right-32";
const BOOK_POSITION_CLASS = "absolute bottom-2 right-24 sm:right-36 lg:right-56";
const SWITCHER_BLOCK_CLASS = "flex w-full max-w-full flex-col items-center gap-3 lg:items-end";
const SWITCHER_CLASS = "max-w-full";
const SWITCHER_CAPTION_CLASS = "font-body text-[15px] font-medium text-muted";

/* ---------- Motion ---------- */

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

interface FloatingStickerProps {
  children: ReactNode;
  /** Position classes of the wrapper (it is absolutely placed inside the art). */
  className: string;
  /** Drift height in px. */
  distance: number;
  /** One drift up, in ms. The drift alternates, so a full cycle is twice this. */
  duration: number;
  /** Start offset in ms, so the stickers never move in step. */
  delay: number;
  motionAllowed: boolean;
}

/** Wraps a sticker in a box that drifts up and down. Pauses while the box is off screen. */
function FloatingSticker({
  children,
  className,
  distance,
  duration,
  delay,
  motionAllowed,
}: FloatingStickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!motionAllowed || element === null || typeof element.animate !== "function") {
      return undefined;
    }

    const animation = element.animate(
      [{ transform: "translateY(0)" }, { transform: `translateY(${-distance}px)` }],
      { duration, delay, direction: "alternate", iterations: Infinity, easing: "ease-in-out" },
    );

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) animation.play();
          else animation.pause();
        }
      });
      observer.observe(element);
    }

    return () => {
      observer?.disconnect();
      animation.cancel();
    };
  }, [motionAllowed, distance, duration, delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Fades and lifts every `[data-entrance]` block inside `root` once, before the first paint. */
function useEntrance(root: RefObject<HTMLElement>, motionAllowed: boolean): void {
  useLayoutEffect(() => {
    const container = root.current;
    if (!motionAllowed || container === null) return undefined;

    const animations: Animation[] = [];
    container.querySelectorAll<HTMLElement>(ENTRANCE_SELECTOR).forEach((element, index) => {
      if (typeof element.animate !== "function") return;
      animations.push(
        element.animate(
          [
            { opacity: 0, transform: "translateY(16px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: ENTRANCE_DURATION_MS,
            delay: index * ENTRANCE_STAGGER_MS,
            easing: ENTRANCE_EASING,
            fill: "backwards",
          },
        ),
      );
    });

    return () => {
      for (const animation of animations) animation.cancel();
    };
  }, [root, motionAllowed]);
}

/* ---------- Section ---------- */

export interface HeroSectionProps {
  /** Id of the section. Default `hero`. */
  id?: string | undefined;
}

/** Landing page hero: headline, Sign In and Explore actions, floating stickers, world preview. */
export function HeroSection({ id = "hero" }: HeroSectionProps) {
  const navigate = useNavigate();
  const motionAllowed = useMotionAllowed();
  const [world, setWorld] = useState<WorldId>(DEFAULT_WORLD);

  const textColumnRef = useRef<HTMLDivElement>(null);
  useEntrance(textColumnRef, motionAllowed);

  const headingId = `${id}-heading`;
  const worldName = WORLD_OPTIONS.find((option) => option.value === world)?.name ?? "";

  const handleSignIn = () => {
    void navigate(LOGIN_PATH);
  };

  const handleExplore = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(EXPLORE_TARGET_ID);
    if (target === null) return;
    event.preventDefault();
    const reduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const handleWorldChange = (next: string) => {
    if (isWorldId(next)) setWorld(next);
  };

  return (
    <section id={id} aria-labelledby={headingId} data-world={world} className={SECTION_CLASS}>
      <div className={CONTAINER_CLASS}>
        <div ref={textColumnRef} className={TEXT_COLUMN_CLASS}>
          <div data-entrance="">
            <p className={WELCOME_CLASS}>Welcome to Al Hikmah</p>
          </div>
          <div data-entrance="">
            <h1 id={headingId} className={HEADING_CLASS}>
              Practice English{" "}
              <Squiggle variant="wavy" tone="pop" drawOn="mount" delay={600}>
                every day
              </Squiggle>
              .
            </h1>
          </div>
          <div data-entrance="">
            <p className={SUBLINE_CLASS}>
              Lessons, quizzes, games and an AI tutor in one place. Level up as you learn.
            </p>
          </div>
          <div data-entrance="" className={ACTIONS_CLASS}>
            <Button size="lg" onClick={handleSignIn}>
              Sign In to Learn
            </Button>
            <a href={`#${EXPLORE_TARGET_ID}`} onClick={handleExplore} className={EXPLORE_CLASS}>
              Explore
              <ArrowDown aria-hidden="true" focusable="false" className={EXPLORE_ICON_CLASS} />
            </a>
          </div>
          <div data-entrance="">
            <p className={QUIET_CLASS}>For students and teachers of Al Hikmah.</p>
          </div>
        </div>

        <div className={ART_COLUMN_CLASS}>
          <div aria-hidden="true" className={ART_CLASS}>
            <div className={DISC_CLASS} />
            <div className={PAGE_CLASS}>
              {PAGE_LINE_WIDTHS.map((width) => (
                <span key={width} className={cn(PAGE_LINE_CLASS, width)} />
              ))}
            </div>
            <FloatingSticker
              className={ALPHA_POSITION_CLASS}
              distance={8}
              duration={3200}
              delay={0}
              motionAllowed={motionAllowed}
            >
              <Sticker rotate={-5}>
                <span className={cn(STICKER_FACE_CLASS, ALPHA_FACE_CLASS)}>Aa</span>
              </Sticker>
            </FloatingSticker>
            <FloatingSticker
              className={HELLO_POSITION_CLASS}
              distance={6}
              duration={3800}
              delay={400}
              motionAllowed={motionAllowed}
            >
              <Sticker rotate={4} shape="pill">
                <span className={cn(STICKER_FACE_CLASS, HELLO_FACE_CLASS)}>Hello!</span>
              </Sticker>
            </FloatingSticker>
            <FloatingSticker
              className={STAR_POSITION_CLASS}
              distance={10}
              duration={4200}
              delay={800}
              motionAllowed={motionAllowed}
            >
              <Sticker rotate={-3} shape="circle">
                <span className={cn(STICKER_FACE_CLASS, ICON_FACE_CLASS)}>
                  <Star className={STICKER_ICON_CLASS} />
                </span>
              </Sticker>
            </FloatingSticker>
            <FloatingSticker
              className={BOOK_POSITION_CLASS}
              distance={7}
              duration={4600}
              delay={1200}
              motionAllowed={motionAllowed}
            >
              <Sticker rotate={5}>
                <span className={cn(STICKER_FACE_CLASS, ICON_FACE_CLASS)}>
                  <BookOpen className={STICKER_ICON_CLASS} />
                </span>
              </Sticker>
            </FloatingSticker>
          </div>

          <div className={SWITCHER_BLOCK_CLASS}>
            <SegmentedControl
              aria-label="Preview the colors of a skill"
              options={WORLD_OPTIONS}
              value={world}
              onValueChange={handleWorldChange}
              className={SWITCHER_CLASS}
            />
            <p aria-live="polite" className={SWITCHER_CAPTION_CLASS}>
              Previewing the {worldName} colors
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

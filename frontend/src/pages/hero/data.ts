import type { HeroSlideMeta } from "@/pages/hero/types";

/** 10 seconds per slide — enough time to understand before it changes. */
export const AUTOPLAY_MS = 10_000;

/** Slide transition: spatial move/scale, 700–1200ms. */
export const TRANSITION_MS = 900;

export const HERO_SLIDES: HeroSlideMeta[] = [
  {
    id: "magazine",
    indexLabel: "01",
    eyebrow: "English Weekly — Issue 024",
    title: "The Weekly Magazine",
    ctaLabel: "Read full issue",
    ctaHref: "/magazine",
  },
  {
    id: "game",
    indexLabel: "02",
    eyebrow: "New game",
    title: "Grammar Challenge",
    ctaLabel: "Play now",
    ctaHref: "/games/grammar",
  },
  {
    id: "tutor",
    indexLabel: "03",
    eyebrow: "Meet your AI tutor",
    title: "Ask. Practice. Get guidance.",
    ctaLabel: "Start practicing",
    ctaHref: "/ai-tutor",
  },
  {
    id: "course",
    indexLabel: "04",
    eyebrow: "New this week",
    title: "Unit 04 — Stories and Ideas",
    ctaLabel: "Start lesson",
    ctaHref: "/courses",
  },
];

export const MAGAZINE_PAGES = {
  page1: "https://i.ibb.co/LXGkZtr6/magazine-1.png",
  page2: "https://i.ibb.co/Z1vKngsH/magazine-2.png",
  alt1: "English Weekly magazine issue 24, page 1",
  alt2: "English Weekly magazine issue 24, page 2",
};

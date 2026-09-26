export type HeroSlideId = "magazine" | "game" | "tutor" | "course";

export interface HeroSlideMeta {
  id: HeroSlideId;
  indexLabel: string;
  eyebrow: string;
  title: string;
  ctaLabel: string;
  ctaHref: string;
}

import type { WorldId } from "@/shared/hooks/useWorld";
import type { GameRow, GamesHubData, SessionRow } from "./api";

/* Pure rules for the games hub: skills and their worlds, the presentation of each catalog game,
   personal bests, today's plays and the featured-game bonus. */

export type SkillId = "vocabulary" | "spelling" | "grammar" | "speed";

export interface Skill {
  id: SkillId;
  label: string;
  world: WorldId;
}

/** Filter order. Worlds follow the spec's skill colors (Vocabulary rose, Grammar violet);
 * Spelling is a writing skill (amber) and Speed takes the energetic coral. */
export const SKILLS: readonly Skill[] = [
  { id: "vocabulary", label: "Vocabulary", world: "rose" },
  { id: "spelling", label: "Spelling", world: "amber" },
  { id: "grammar", label: "Grammar", world: "violet" },
  { id: "speed", label: "Speed", world: "coral" },
];

export type GameIconId =
  "match" | "builder" | "grammar" | "reading" | "sentence" | "spelling" | "quiz" | "arcade";

interface GamePresentation {
  skills: readonly SkillId[];
  icon: GameIconId;
}

/** The catalog table holds the title and description; the skills a game trains and its arcade
 * badge are presentation, keyed by slug. The array order is the order of the grid. */
const PRESENTATION: ReadonlyArray<readonly [string, GamePresentation]> = [
  ["vocabulary-match", { skills: ["vocabulary"], icon: "match" }],
  ["word-builder", { skills: ["vocabulary", "spelling"], icon: "builder" }],
  ["grammar-challenge", { skills: ["grammar"], icon: "grammar" }],
  ["reading-challenge", { skills: ["vocabulary"], icon: "reading" }],
  ["sentence-builder", { skills: ["grammar"], icon: "sentence" }],
  ["spelling", { skills: ["spelling"], icon: "spelling" }],
  ["timed-quiz", { skills: ["speed", "grammar"], icon: "quiz" }],
];

const FALLBACK: GamePresentation = { skills: [], icon: "arcade" };

export function presentationFor(slug: string): GamePresentation {
  return PRESENTATION.find(([key]) => key === slug)?.[1] ?? FALLBACK;
}

export const skillById = (id: SkillId): Skill =>
  SKILLS.find((skill) => skill.id === id) ?? (SKILLS[0] as Skill);

/** The day key the server uses for the featured game: the UTC calendar day. */
export const utcDayKey = (date: Date): string => date.toISOString().slice(0, 10);

function playedOn(session: SessionRow): string | null {
  if (!session.played_at) return null;
  const date = new Date(session.played_at);
  return Number.isNaN(date.getTime()) ? null : utcDayKey(date);
}

export interface GameCard {
  id: string;
  slug: string;
  title: string;
  description: string;
  iconUrl: string | null;
  icon: GameIconId;
  skills: SkillId[];
  /** The student's highest score in this game, or null when they have never played it. */
  bestScore: number | null;
  playsToday: number;
  isFeatured: boolean;
}

export interface FeaturedGame {
  card: GameCard;
  multiplier: number;
}

export interface GamesHub {
  cards: GameCard[];
  featured: FeaturedGame | null;
  /** Sessions the student finished today, across all games. */
  playedToday: number;
}

const orderOf = (slug: string): number => {
  const index = PRESENTATION.findIndex(([key]) => key === slug);
  return index === -1 ? PRESENTATION.length : index;
};

export function buildGamesHub(data: GamesHubData, today: string): GamesHub {
  const bests = new Map<string, number>();
  const plays = new Map<string, number>();
  let playedToday = 0;
  for (const session of data.sessions) {
    const best = bests.get(session.game_id);
    if (best === undefined || session.score > best) bests.set(session.game_id, session.score);
    if (playedOn(session) === today) {
      playedToday += 1;
      plays.set(session.game_id, (plays.get(session.game_id) ?? 0) + 1);
    }
  }

  const toCard = (game: GameRow): GameCard => {
    const look = presentationFor(game.slug);
    return {
      id: game.id,
      slug: game.slug,
      title: game.title,
      description: game.description?.trim() ?? "",
      iconUrl: game.icon_url ?? null,
      icon: look.icon,
      skills: [...look.skills],
      bestScore: bests.get(game.id) ?? null,
      playsToday: plays.get(game.id) ?? 0,
      isFeatured: data.featured?.game_id === game.id,
    };
  };

  const cards = data.games
    .map(toCard)
    .sort((a, b) => orderOf(a.slug) - orderOf(b.slug) || a.title.localeCompare(b.title));
  const featuredCard = cards.find((card) => card.isFeatured);
  return {
    cards,
    featured: featuredCard
      ? { card: featuredCard, multiplier: data.featured?.bonus_multiplier ?? 1.5 }
      : null,
    playedToday,
  };
}

export const filterBySkill = (cards: GameCard[], skill: SkillId | "all"): GameCard[] =>
  skill === "all" ? cards : cards.filter((card) => card.skills.includes(skill));

const scoreFormat = new Intl.NumberFormat("en-US");

export const formatScore = (score: number): string => scoreFormat.format(Math.round(score));

/** 1.5 -> "1.5x", 2 -> "2x". */
export const formatMultiplier = (multiplier: number): string => `${Number(multiplier.toFixed(2))}x`;

/** The game screen route (ST-22). The game slug is the game's id in the URL. */
export const playPath = (slug: string): string => `/student/games/${encodeURIComponent(slug)}/play`;

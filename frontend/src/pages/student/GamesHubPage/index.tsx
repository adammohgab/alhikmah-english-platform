import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Gamepad2,
  Headphones,
  Layers,
  ListOrdered,
  Puzzle,
  Star,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import { useAuth } from "@/shared/hooks/useAuth";
import type { WorldId } from "@/shared/hooks/useWorld";
import { Chip } from "@/shared/components/ui/Chip";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Sticker } from "@/shared/components/ui/Sticker";
import { cn } from "@/shared/lib/utils/cn";
import { GAMES_HUB_KEY, fetchGamesHub } from "./api";
import {
  SKILLS,
  buildGamesHub,
  filterBySkill,
  formatMultiplier,
  formatScore,
  playPath,
  skillById,
  utcDayKey,
} from "./rules";
import type { GameCard, GameIconId, SkillId } from "./rules";
import "./games-hub.css";

/* ========================================
   Games hub (STUDENT-SPEC ST-21, task STU-GAM-03)

   The arcade hall at /student/games: a hero banner for today's featured game with its XP bonus
   multiplier and an animated bonus badge, then the grid of minigames with an illustrated
   arcade badge, the skills each one trains, the student's personal best and today's plays.
   Filter chips narrow the grid by skill. "Play" opens the game screen (ST-22).
   ======================================== */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 shadow-retro-sm";
const PLAY_LINK =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[12px] border-2 border-stroke px-4 font-heading text-base font-bold text-stroke shadow-retro-sm transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 after:absolute after:inset-0 after:rounded-[16px] after:content-['']";

/* Static class strings per world: Tailwind finds classes by scanning the text. */
const WORLD_FILL: Record<WorldId, string> = {
  coral: "bg-world-coral-300",
  amber: "bg-world-amber-300",
  mint: "bg-world-mint-300",
  sky: "bg-world-sky-300",
  violet: "bg-world-violet-300",
  rose: "bg-world-rose-300",
};

const WORLD_BUTTON: Record<WorldId, string> = {
  coral: "bg-world-coral-400",
  amber: "bg-world-amber-400",
  mint: "bg-world-mint-400",
  sky: "bg-world-sky-400",
  violet: "bg-world-violet-400",
  rose: "bg-world-rose-400",
};

const GAME_ICONS: Record<GameIconId, ComponentType<LucideProps>> = {
  match: Layers,
  builder: Puzzle,
  grammar: BookOpen,
  reading: BookOpen,
  sentence: ListOrdered,
  spelling: Headphones,
  quiz: Timer,
  arcade: Gamepad2,
};

/** A game's own world is the world of the first skill it trains. */
function worldOf(card: GameCard): WorldId {
  const first = card.skills[0];
  return first ? skillById(first).world : "amber";
}

function Poster({ card, size }: { card: GameCard; size: "md" | "lg" }) {
  const Icon = GAME_ICONS[card.icon];
  const box = size === "lg" ? "h-28 w-28 sm:h-32 sm:w-32" : "h-20 w-20";
  const glyph = size === "lg" ? 56 : 40;
  return (
    <Sticker rotate={size === "lg" ? -3 : 2} shape="squircle">
      <div
        className={cn("flex items-center justify-center", box, WORLD_FILL[worldOf(card)])}
        aria-hidden="true"
      >
        {card.iconUrl ? (
          <img src={card.iconUrl} alt="" className="h-3/4 w-3/4 object-contain" />
        ) : (
          <Icon size={glyph} strokeWidth={2.5} className="text-stroke" />
        )}
      </div>
    </Sticker>
  );
}

function SkillChips({ skills }: { skills: SkillId[] }) {
  if (skills.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
      {skills.map((id) => {
        const skill = skillById(id);
        return (
          <li key={id}>
            <Chip size="sm" world={skill.world}>
              {skill.label}
            </Chip>
          </li>
        );
      })}
    </ul>
  );
}

function BonusBadge({ multiplier }: { multiplier: number }) {
  return (
    <span
      className="games-hub-bonus inline-flex items-center gap-1 rounded-full border-2 border-stroke bg-world-amber-300 px-3 py-1 font-heading text-base font-bold text-stroke shadow-retro-sm"
      data-testid="bonus-badge"
    >
      <Zap size={16} strokeWidth={3} aria-hidden="true" />
      {formatMultiplier(multiplier)} XP
    </span>
  );
}

function FeaturedBanner({ card, multiplier }: { card: GameCard; multiplier: number }) {
  const world = worldOf(card);
  return (
    <section
      aria-labelledby="featured-game-title"
      className={cn(
        "relative flex flex-col gap-4 rounded-[24px] border-2 border-stroke p-5 shadow-retro-md sm:flex-row sm:items-center sm:gap-6 sm:p-6",
        WORLD_FILL[world],
      )}
    >
      <Poster card={card} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-heading text-sm font-bold uppercase tracking-wide text-stroke">
            Daily featured game
          </p>
          <BonusBadge multiplier={multiplier} />
        </div>
        <h2 id="featured-game-title" className="font-heading text-3xl font-bold text-stroke">
          {card.title}
        </h2>
        <p className="text-base font-semibold text-stroke">
          Play it today and earn {formatMultiplier(multiplier)} XP.
          {card.description ? ` ${card.description}` : ""}
        </p>
        {card.bestScore !== null && (
          <p className="text-sm font-bold text-stroke">
            Your best: {formatScore(card.bestScore)}
          </p>
        )}
      </div>
      <Link
        to={playPath(card.slug)}
        className={cn(PLAY_LINK, "self-start bg-surface-0 sm:self-center")}
      >
        Play {card.title}
      </Link>
    </section>
  );
}

function GameTile({ card, multiplier }: { card: GameCard; multiplier: number | null }) {
  const world = worldOf(card);
  return (
    <li
      className={cn(
        PANEL,
        "relative flex flex-col gap-3 p-4 transition-transform hover:-translate-y-0.5 motion-reduce:transition-none",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Poster card={card} size="md" />
        {multiplier !== null && <BonusBadge multiplier={multiplier} />}
      </div>
      <div className="min-w-0">
        <h3 className="font-heading text-xl font-bold text-stroke">{card.title}</h3>
        {card.description && (
          <p className="mt-1 text-sm font-semibold text-muted">{card.description}</p>
        )}
      </div>
      <SkillChips skills={card.skills} />
      <dl className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-[12px] border-2 border-stroke bg-surface-100 px-2 py-1.5">
          <dt className="flex items-center justify-center gap-1 text-xs font-bold text-muted">
            <Trophy size={12} aria-hidden="true" />
            Your best
          </dt>
          <dd className="font-heading text-lg font-bold text-stroke">
            {card.bestScore === null ? "Not played yet" : formatScore(card.bestScore)}
          </dd>
        </div>
        <div className="rounded-[12px] border-2 border-stroke bg-surface-100 px-2 py-1.5">
          <dt className="flex items-center justify-center gap-1 text-xs font-bold text-muted">
            <Star size={12} aria-hidden="true" />
            Plays today
          </dt>
          <dd className="font-heading text-lg font-bold text-stroke">{card.playsToday}</dd>
        </div>
      </dl>
      <Link
        to={playPath(card.slug)}
        aria-label={`Play ${card.title}`}
        className={cn(PLAY_LINK, WORLD_BUTTON[world])}
      >
        Play
      </Link>
    </li>
  );
}

function LoadingGrid() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <Skeleton className="h-44 w-full rounded-[24px]" label="Loading the arcade" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-72 w-full rounded-[20px]" label={null} />
        ))}
      </div>
    </div>
  );
}

export default function GamesHubPage() {
  const { user } = useAuth();
  const studentId = user?.id;
  const today = useMemo(() => utcDayKey(new Date()), []);
  const [skill, setSkill] = useState<SkillId | "all">("all");

  const query = useQuery({
    queryKey: [GAMES_HUB_KEY, studentId, today],
    queryFn: () => fetchGamesHub(studentId as string, today),
    enabled: studentId !== undefined,
  });

  const hub = useMemo(
    () => (query.data ? buildGamesHub(query.data, today) : null),
    [query.data, today],
  );
  const visible = hub ? filterBySkill(hub.cards, skill) : [];
  const skillLabel = skill === "all" ? "" : skillById(skill).label;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-4xl font-bold text-stroke">Arcade</h1>
          <p className="text-base font-semibold text-muted">
            Quick solo games that train your English. Beat your own best score.
          </p>
        </div>
        {hub && (
          <p
            className="rounded-full border-2 border-stroke bg-surface-0 px-4 py-1.5 font-heading text-base font-bold text-stroke shadow-retro-sm"
            data-testid="daily-play"
          >
            Daily play: {hub.playedToday} {hub.playedToday === 1 ? "game" : "games"} today
          </p>
        )}
      </header>

      {query.isError ? (
        <ErrorState
          size="lg"
          title="The arcade could not open"
          description="We could not load the games. Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
      ) : !hub ? (
        <LoadingGrid />
      ) : hub.cards.length === 0 ? (
        <EmptyState
          size="lg"
          title="The arcade is closed for now"
          description="No games are available yet. Check back soon."
        />
      ) : (
        <>
          {hub.featured && (
            <FeaturedBanner card={hub.featured.card} multiplier={hub.featured.multiplier} />
          )}

          <div
            role="group"
            aria-label="Filter games by skill"
            className="flex flex-wrap items-center gap-2"
          >
            <Chip selected={skill === "all"} onClick={() => setSkill("all")}>
              All
            </Chip>
            {SKILLS.map((item) => (
              <Chip
                key={item.id}
                world={item.world}
                selected={skill === item.id}
                onClick={() => setSkill(item.id)}
              >
                {item.label}
              </Chip>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              size="md"
              title="No games for this skill yet"
              description={`There are no ${skillLabel.toLowerCase()} games right now. Try another skill.`}
              actionLabel="Show all games"
              onAction={() => setSkill("all")}
            />
          ) : (
            <ul
              aria-label="Games"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {visible.map((card) => (
                <GameTile
                  key={card.id}
                  card={card}
                  multiplier={card.isFeatured ? (hub.featured?.multiplier ?? null) : null}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

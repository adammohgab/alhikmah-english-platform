import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Flame,
  Gamepad2,
  GraduationCap,
  ListChecks,
  Lock,
  Medal,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/Badge";
import { Card } from "@/shared/components/ui/Card";
import { Sticker } from "@/shared/components/ui/Sticker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/Tabs";
import type { WorldId } from "@/shared/hooks/useWorld";

/* ========================================
   FeaturesSection (PUB-02, SHARED-SPEC SH-01 sections 2, 4 and 5)

   Three blocks on the public landing page:
     1. The six gamification pillars as a card grid: 1 column on mobile, 2 on tablet and 3 on
        desktop. Every card is pinned to one world (`data-world`), so its header band and dots
        read the same world variables everywhere on the page.
     2. The AI Tutor ("Pip"): an asymmetric two-column block. The wording follows AI-BEHAVIOR
        (English and study help only, teachers stay in charge of grades).
     3. A tab switcher with the student, teacher and parent point of view. Parent accounts are
        out of scope for v1 (STUDENT-SPEC, TEACHER-SPEC and ADMIN-SPEC list a parent view as a
        later release), so that tab says so instead of describing screens that do not exist.

   Pillar facts come from ECONOMY-AND-GAMES: levels 1 to 60, three daily quests, seven solo
   games, streak milestones, 40 starter badges and class, grade and school boards. The page
   states the rules and never calculates XP, coins or scores, so it holds no user data.

   World mapping (fixed, one world per pillar, none repeated):
     XP and levels amber, Daily quests mint, Arcade minigames rose,
     Streaks coral, Badges violet, Leaderboards sky.
   The AI card uses violet and the three perspective panels use amber, sky and rose.

   Motion: cards lift on hover through the shared Card (transform only, dropped on the low
   effects tier and under reduced motion). This file adds no animation of its own.
   Class strings live in constants so the Tailwind class sorter and the lint rules treat them
   as plain data.
   ======================================== */

interface Pillar {
  id: string;
  title: string;
  summary: string;
  facts: readonly string[];
  world: WorldId;
  Icon: LucideIcon;
}

const PILLARS: readonly Pillar[] = [
  {
    id: "xp",
    title: "XP and levels",
    summary: "Lessons, activities and quizzes earn XP. XP moves you up through the levels.",
    facts: ["60 levels in total", "Rank titles from Newcomer to Grandmaster"],
    world: "amber",
    Icon: Zap,
  },
  {
    id: "quests",
    title: "Daily quests",
    summary: "Three new quests every day, plus weekly goals, give each study session a target.",
    facts: ["Quests range from easy to hard", "Finish all three for a bonus chest"],
    world: "mint",
    Icon: Target,
  },
  {
    id: "games",
    title: "Arcade minigames",
    summary: "Seven solo games of two to three minutes cover words, grammar, reading and spelling.",
    facts: ["Easy, Medium and Hard levels", "Beat the clock or your own best score"],
    world: "rose",
    Icon: Gamepad2,
  },
  {
    id: "streaks",
    title: "Streaks",
    summary: "Study on consecutive days to grow a streak, and earn a reward at each milestone.",
    facts: ["Milestones at 3, 7, 14, 30, 60 and 100 days", "A streak freeze covers one missed day"],
    world: "coral",
    Icon: Flame,
  },
  {
    id: "badges",
    title: "Badges",
    summary: "Collect badges for what you do, from Common to Legendary.",
    facts: ["A starter catalog of 40 badges", "Four rarity levels"],
    world: "violet",
    Icon: Medal,
  },
  {
    id: "leaderboards",
    title: "Leaderboards",
    summary: "Weekly XP boards show where you stand among your classmates.",
    facts: ["Class, grade and school boards", "Weekly boards reset every Monday"],
    world: "sky",
    Icon: Trophy,
  },
];

const TUTOR_ABILITIES: readonly string[] = [
  "Explains a lesson in short, clear steps",
  "Checks your writing and points out what to fix",
  "Quizzes you on what you just studied",
  "Answers your questions about English",
];

interface Perspective {
  id: string;
  label: string;
  heading: string;
  points: readonly string[];
  world: WorldId;
  Icon: LucideIcon;
  note?: string;
}

const PERSPECTIVES: readonly Perspective[] = [
  {
    id: "student",
    label: "Student",
    heading: "Learn at your own pace",
    points: [
      "Continue your courses with lessons, activities and quizzes",
      "Earn XP, keep your streak and finish the daily quests",
      "Ask Pip to explain a lesson or check your writing",
    ],
    world: "amber",
    Icon: GraduationCap,
  },
  {
    id: "teacher",
    label: "Teacher",
    heading: "Stay in charge of every grade",
    points: [
      "Plan lessons and build quizzes with help from AI",
      "Review each AI feedback draft before a student sees it",
      "Follow the progress of your classes at a glance",
    ],
    world: "sky",
    Icon: ListChecks,
  },
  {
    id: "parent",
    label: "Parent",
    heading: "What the school sets up for your child",
    points: [
      "The school creates each account, and students sign in with the username they were given",
      "Teachers stay responsible for every grade",
      "Pip only helps with English and study questions",
    ],
    world: "rose",
    Icon: Users,
    note: "A parent view is coming later",
  },
];

const SECTION_CLASS = "w-full bg-surface-50 px-4 py-16 sm:px-6 md:py-24";
const CONTAINER_CLASS = "mx-auto flex w-full max-w-[1200px] flex-col gap-16 md:gap-24";
const BLOCK_CLASS = "flex flex-col gap-8";
const INTRO_CLASS = "flex max-w-2xl flex-col gap-3";
const EYEBROW_CLASS = "font-accent text-2xl text-stroke";
const HEADING_CLASS = "font-heading text-3xl font-bold leading-tight text-stroke md:text-5xl";
const SUBHEADING_CLASS = "font-heading text-2xl font-bold leading-tight text-stroke md:text-3xl";
const LEAD_CLASS = "font-body text-base font-medium text-muted md:text-lg";
const PILLAR_GRID_CLASS = "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3";
const CARD_TITLE_CLASS = "font-heading text-[18px] font-semibold leading-tight text-stroke";
const CARD_BODY_CLASS = "flex flex-col gap-4";
const CARD_TEXT_CLASS = "font-body text-base text-stroke";
const FACT_LIST_CLASS = "flex flex-col gap-2";
const FACT_ITEM_CLASS = "flex items-start gap-2 font-body text-[15px] font-medium text-muted";
const FACT_DOT_CLASS =
  "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-stroke bg-[var(--world-pop,#2fd6a3)]";
const ICON_CLASS = "h-5 w-5 shrink-0 text-stroke [stroke-width:2.5]";
const TAB_ICON_CLASS = "h-4 w-4";
const AI_LAYOUT_CLASS = "grid grid-cols-1 items-start gap-8 lg:grid-cols-[5fr_7fr] lg:gap-12";
const AI_TEXT_CLASS = "flex flex-col items-start gap-4";
const AI_STICKER_FACE_CLASS =
  "flex h-16 w-16 items-center justify-center bg-[var(--world-soft,#ffd93d)]";
const AI_STICKER_ICON_CLASS = "h-10 w-10 text-stroke [stroke-width:2]";
const AI_LIMIT_LIST_CLASS = "flex flex-col gap-2 font-body text-[15px] font-semibold text-stroke";
const AI_LIMIT_ITEM_CLASS = "flex items-center gap-2";
const ABILITY_LIST_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2";
const ABILITY_ITEM_CLASS =
  "flex items-start gap-3 rounded-[12px] border-2 border-stroke bg-surface-0 p-3 font-body text-[15px] font-medium text-stroke shadow-retro-sm";
const PERSPECTIVE_HEAD_CLASS = "flex flex-wrap items-center gap-3";
const PERSPECTIVE_LIST_CLASS = "flex flex-col gap-3";
const PERSPECTIVE_ITEM_CLASS = "flex items-start gap-3 font-body text-base font-medium text-stroke";

export interface FeaturesSectionProps {
  /** Anchor id of the section, the target of the header link. Default `features`. */
  id?: string | undefined;
}

function PillarCard({ pillar, idPrefix }: { pillar: Pillar; idPrefix: string }) {
  const { id, title, summary, facts, world, Icon } = pillar;
  const titleId = `${idPrefix}-pillar-${id}`;

  return (
    <Card
      as="article"
      world={world}
      hoverable
      aria-labelledby={titleId}
      header={
        <>
          <Icon aria-hidden="true" focusable="false" className={ICON_CLASS} />
          <h3 id={titleId} className={CARD_TITLE_CLASS}>
            {title}
          </h3>
        </>
      }
    >
      <div className={CARD_BODY_CLASS}>
        <p className={CARD_TEXT_CLASS}>{summary}</p>
        <ul className={FACT_LIST_CLASS}>
          {facts.map((fact) => (
            <li key={fact} className={FACT_ITEM_CLASS}>
              <span aria-hidden="true" className={FACT_DOT_CLASS} />
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function TutorBlock({ idPrefix }: { idPrefix: string }) {
  const headingId = `${idPrefix}-tutor-heading`;
  const abilitiesId = `${idPrefix}-tutor-abilities`;

  return (
    <div className={AI_LAYOUT_CLASS}>
      <div className={AI_TEXT_CLASS}>
        <Sticker rotate={-4} shape="circle" aria-hidden="true">
          <span className={AI_STICKER_FACE_CLASS}>
            <Bot aria-hidden="true" focusable="false" className={AI_STICKER_ICON_CLASS} />
          </span>
        </Sticker>
        <p className={EYEBROW_CLASS}>Your study companion</p>
        <h3 id={headingId} className={SUBHEADING_CLASS}>
          Meet Pip, the AI Tutor
        </h3>
        <p className={LEAD_CLASS}>
          Pip helps you when you get stuck, in short and friendly answers.
        </p>
        <ul className={AI_LIMIT_LIST_CLASS}>
          <li className={AI_LIMIT_ITEM_CLASS}>
            <Lock aria-hidden="true" focusable="false" className={ICON_CLASS} />
            The tutor only helps with English and study questions.
          </li>
          <li className={AI_LIMIT_ITEM_CLASS}>
            <ListChecks aria-hidden="true" focusable="false" className={ICON_CLASS} />
            Your teacher stays in charge of your grades.
          </li>
        </ul>
      </div>
      <Card
        as="section"
        world="violet"
        aria-labelledby={abilitiesId}
        header={
          <>
            <Bot aria-hidden="true" focusable="false" className={ICON_CLASS} />
            <h4 id={abilitiesId} className={CARD_TITLE_CLASS}>
              What Pip can do
            </h4>
          </>
        }
      >
        <ul className={ABILITY_LIST_CLASS}>
          {TUTOR_ABILITIES.map((ability) => (
            <li key={ability} className={ABILITY_ITEM_CLASS}>
              <span aria-hidden="true" className={FACT_DOT_CLASS} />
              {ability}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function PerspectiveTabs({ idPrefix }: { idPrefix: string }) {
  const headingId = `${idPrefix}-views-heading`;

  return (
    <div className={BLOCK_CLASS}>
      <div className={INTRO_CLASS}>
        <h3 id={headingId} className={SUBHEADING_CLASS}>
          One platform, three points of view
        </h3>
        <p className={LEAD_CLASS}>Pick a role to see what it gets from the platform.</p>
      </div>
      <Tabs defaultValue="student">
        <TabsList aria-labelledby={headingId}>
          {PERSPECTIVES.map(({ id, label, Icon }) => (
            <TabsTrigger key={id} value={id}>
              <Icon aria-hidden="true" focusable="false" className={TAB_ICON_CLASS} />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {PERSPECTIVES.map(({ id, heading, points, world, Icon, note }) => (
          <TabsContent key={id} value={id}>
            <Card
              as="section"
              world={world}
              header={
                <div className={PERSPECTIVE_HEAD_CLASS}>
                  <Icon aria-hidden="true" focusable="false" className={ICON_CLASS} />
                  <h4 className={CARD_TITLE_CLASS}>{heading}</h4>
                  {note !== undefined && <Badge world={world}>{note}</Badge>}
                </div>
              }
            >
              <ul className={PERSPECTIVE_LIST_CLASS}>
                {points.map((point) => (
                  <li key={point} className={PERSPECTIVE_ITEM_CLASS}>
                    <span aria-hidden="true" className={FACT_DOT_CLASS} />
                    {point}
                  </li>
                ))}
              </ul>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/** Landing page features: the gamification pillars, the AI Tutor and the role views (PUB-02). */
export function FeaturesSection({ id = "features" }: FeaturesSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section id={id} aria-labelledby={headingId} className={SECTION_CLASS}>
      <div className={CONTAINER_CLASS}>
        <div className={BLOCK_CLASS}>
          <div className={INTRO_CLASS}>
            <p className={EYEBROW_CLASS}>Learn, play and level up</p>
            <h2 id={headingId} className={HEADING_CLASS}>
              Six ways the platform keeps you going
            </h2>
            <p className={LEAD_CLASS}>
              Every lesson you finish earns rewards, so your progress is easy to see.
            </p>
          </div>
          <div className={PILLAR_GRID_CLASS}>
            {PILLARS.map((pillar) => (
              <PillarCard key={pillar.id} pillar={pillar} idPrefix={id} />
            ))}
          </div>
        </div>
        <TutorBlock idPrefix={id} />
        <PerspectiveTabs idPrefix={id} />
      </div>
    </section>
  );
}

import { useInsertionEffect } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils/cn";
import { Tooltip } from "@/shared/components/ui/Tooltip";

/* ========================================
   StreakFlame (STU-GAM-17; ECONOMY-AND-GAMES §3.5 "Streaks", GLOBAL-STYLES-SPEC §8.7)

   Shows the student's current streak as a flame that grows with the streak, plus a freeze
   shield badge with the number of streak freezes owned. The backend owns every number
   (ECONOMY-AND-GAMES intro): this component only displays and animates what it is given.

   Tiers (days of current streak)
     0        cold       an unlit grey flame, no motion
     1 to 6   sparks     a small flame with a few rising sparks
     7 to 29  blaze      the full orange fire with embers
     30+      radiant    a larger blue flame with pulsing halo rings and more embers

   Freeze shield
     Ice-blue shield with the count of freezes owned. At 0 it is a dashed, empty shield. A freeze
     is used automatically by the backend (section 3.5), so the shield is status only.

   Tooltip (Radix, hover and keyboard focus)
     Days count and whether today's streak action is done, tomorrow's target, the freeze rules.

   Motion is throttled in CSS with no provider required (same approach as Sticker):
     - prefers-reduced-motion: reduce shows a static flame (the global killswitch in base.css
       also pauses every keyframe);
     - effects tier (EffectsProvider sets data-effects-tier on <html>): low is static with no
       embers, balanced runs the flicker with 3 embers, high runs everything.
   All animation is transform and opacity only, so it stays on the compositor.
   ======================================== */

export type StreakFlameSize = "sm" | "md" | "lg";

export interface StreakFlameProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Current streak in days, as computed by the backend. */
  streakDays: number;
  /** Streak freezes the student owns (power-up, max 3). */
  freezes?: number | undefined;
  /** True once a streak action (lesson, activity, quiz, assignment, practice set) was done today. */
  doneToday?: boolean | undefined;
  /** True when a freeze was consumed at the last day boundary to save the streak. */
  freezeUsed?: boolean | undefined;
  /** Flame height: sm 28px, md 40px, lg 64px. Default `md`. */
  size?: StreakFlameSize | undefined;
  /** Shows the days number beside the flame. Default true. */
  showCount?: boolean | undefined;
}

/* ---- Tiers ---- */

type FlameTier = "cold" | "sparks" | "blaze" | "radiant";

const BLAZE_FROM_DAYS = 7;
const RADIANT_FROM_DAYS = 30;
/** Streak milestones that pay once each (ECONOMY-AND-GAMES §3.5). */
const MILESTONE_DAYS = [3, 7, 14, 30, 60, 100] as const;
/** Streak freeze cap (ECONOMY-AND-GAMES §3.5, §6.3). */
const MAX_FREEZES = 3;

function tierFor(days: number): FlameTier {
  if (days <= 0) return "cold";
  if (days < BLAZE_FROM_DAYS) return "sparks";
  if (days < RADIANT_FROM_DAYS) return "blaze";
  return "radiant";
}

function wholeCount(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

interface TierLook {
  /** Flame scale inside the 64x80 artwork box. */
  scale: number;
  outer: string;
  inner: string;
  core: string;
  ember: string;
  embers: number;
}

const LOOKS: Record<FlameTier, TierLook> = {
  cold: {
    scale: 0.7,
    outer: "#EEF0F5",
    inner: "#FFFFFF",
    core: "#FFFFFF",
    ember: "#EEF0F5",
    embers: 0,
  },
  sparks: {
    scale: 0.62,
    outer: "#FF9A3D",
    inner: "#FFD93D",
    core: "#FFF6C2",
    ember: "#FFB84D",
    embers: 4,
  },
  blaze: {
    scale: 0.92,
    outer: "#FF6B3D",
    inner: "#FFB02E",
    core: "#FFF1A8",
    ember: "#FFB84D",
    embers: 6,
  },
  radiant: {
    scale: 1,
    outer: "#2F7BFF",
    inner: "#4DD8FF",
    core: "#E8FBFF",
    ember: "#8CDCFF",
    embers: 9,
  },
};

/* ---- Embers ----
   Fixed spread so the particles never look random on re-render. x is the start in the 64 wide
   box, dx the sideways drift, rise how far it climbs, in SVG user units. */

interface Ember {
  x: number;
  dx: number;
  rise: number;
  size: number;
  delay: number;
  duration: number;
}

const EMBERS: readonly Ember[] = [
  { x: 28, dx: -6, rise: 34, size: 2.2, delay: 0, duration: 1.6 },
  { x: 38, dx: 7, rise: 40, size: 1.8, delay: 0.5, duration: 1.9 },
  { x: 32, dx: 2, rise: 46, size: 2.6, delay: 1.0, duration: 2.1 },
  { x: 22, dx: -10, rise: 38, size: 1.6, delay: 0.3, duration: 1.8 },
  { x: 42, dx: 11, rise: 36, size: 2, delay: 0.8, duration: 1.7 },
  { x: 33, dx: -3, rise: 52, size: 1.7, delay: 1.3, duration: 2.3 },
  { x: 26, dx: 5, rise: 44, size: 1.5, delay: 0.15, duration: 2 },
  { x: 40, dx: -5, rise: 48, size: 2.1, delay: 1.1, duration: 2.2 },
  { x: 31, dx: 9, rise: 56, size: 1.4, delay: 0.65, duration: 2.4 },
];
/* Embers past this index are dropped on the balanced tier (spec §8.9: lightweight bursts). */
const BALANCED_EMBERS = 3;

/* ---- Styles ----
   Keyframes live here because this component owns no stylesheet. They are added to <head> once,
   not per instance. Everything is gated in CSS (no JS tier lookup, no provider required). */

const STYLE_ID = "streak-flame-styles";

const STYLES = `
.sf-flame{transform-box:fill-box;transform-origin:50% 100%}
.sf-flame--live{animation:sf-flicker 1.4s ease-in-out infinite}
.sf-inner{transform-box:fill-box;transform-origin:50% 100%;animation:sf-flicker 0.9s ease-in-out infinite reverse}
.sf-ember{transform-box:fill-box;transform-origin:50% 50%;opacity:0;animation:sf-ember var(--sf-dur,2s) ease-out var(--sf-delay,0s) infinite}
.sf-halo{transform-box:fill-box;transform-origin:50% 50%;animation:sf-halo 2.4s ease-out infinite}
.sf-halo--b{animation-delay:1.2s}
.sf-shield--pop{animation:sf-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) 1}
@keyframes sf-flicker{0%,100%{transform:scale(1,1) rotate(0deg)}30%{transform:scale(0.96,1.05) rotate(-1.5deg)}60%{transform:scale(1.03,0.97) rotate(1.2deg)}}
@keyframes sf-ember{0%{opacity:0;transform:translate(0,0) scale(1)}15%{opacity:1}100%{opacity:0;transform:translate(var(--sf-dx,0),calc(var(--sf-rise,40px) * -1)) scale(0.3)}}
@keyframes sf-halo{0%{opacity:0.7;transform:scale(0.7)}100%{opacity:0;transform:scale(1.25)}}
@keyframes sf-pop{0%{transform:scale(0.6)}100%{transform:scale(1)}}
[data-effects-tier="low"] .sf-flame,[data-effects-tier="low"] .sf-inner,[data-effects-tier="low"] .sf-halo,[data-effects-tier="low"] .sf-shield--pop{animation:none}
[data-effects-tier="low"] .sf-ember{display:none}
[data-effects-tier="balanced"] .sf-halo,[data-effects-tier="balanced"] .sf-ember[data-extra="true"]{display:none}
@media (prefers-reduced-motion:reduce){.sf-flame,.sf-inner,.sf-halo,.sf-shield--pop{animation:none}.sf-ember{display:none}}
`;

function useFlameStyles(): void {
  useInsertionEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLES;
    document.head.appendChild(style);
  }, []);
}

/* ---- Artwork ---- */

const INK = "var(--stroke,#1a1530)";

/* One flame drawn in a 64 x 80 box, base at y 76. */
const OUTER_PATH =
  "M32 4 C35 16 50 24 50 47 C50 63 42 76 32 76 C22 76 14 63 14 47 C14 39 18 33 22 29 C22 37 26 41 28 41 C26 29 28 14 32 4 Z";
const INNER_PATH =
  "M32 34 C34 41 42 45 42 56 C42 65 38 72 32 72 C26 72 22 65 22 56 C22 49 28 45 28 39 C30 41 31 40 32 34 Z";

const SIZE_PX: Record<StreakFlameSize, number> = { sm: 28, md: 40, lg: 64 };
const COUNT_TEXT: Record<StreakFlameSize, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
};

interface FlameArtProps {
  tier: FlameTier;
  look: TierLook;
}

function FlameArt({ tier, look }: FlameArtProps) {
  const lit = tier !== "cold";
  const embers = EMBERS.slice(0, look.embers);

  return (
    <>
      {tier === "radiant" ? (
        <>
          <circle
            className="sf-halo"
            cx="32"
            cy="46"
            r="28"
            fill="none"
            stroke={look.inner}
            strokeWidth="2"
          />
          <circle
            className="sf-halo sf-halo--b"
            cx="32"
            cy="46"
            r="28"
            fill="none"
            stroke={look.outer}
            strokeWidth="2"
          />
        </>
      ) : null}

      {/* Scales around the base of the flame (32, 76) so every tier sits on the same floor. */}
      <g transform={`translate(32 76) scale(${look.scale}) translate(-32 -76)`}>
        <g className={cn("sf-flame", lit && "sf-flame--live")}>
          <path
            d={OUTER_PATH}
            fill={look.outer}
            stroke={INK}
            strokeWidth={lit ? 3 : 3.5}
            strokeLinejoin="round"
            strokeDasharray={lit ? undefined : "5 4"}
          />
          {lit ? (
            <g className="sf-inner">
              <path
                d={INNER_PATH}
                fill={look.inner}
                stroke={INK}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <ellipse cx="32" cy="64" rx="6" ry="7" fill={look.core} />
            </g>
          ) : null}
        </g>
      </g>

      {embers.map((ember, index) => (
        <circle
          key={index}
          className="sf-ember"
          data-extra={index >= BALANCED_EMBERS ? "true" : undefined}
          cx={ember.x}
          cy={tier === "sparks" ? 52 : 34}
          r={ember.size}
          fill={look.ember}
          stroke={INK}
          strokeWidth="0.8"
          style={
            {
              "--sf-dx": `${ember.dx}px`,
              "--sf-rise": `${ember.rise}px`,
              "--sf-dur": `${ember.duration}s`,
              "--sf-delay": `${ember.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

interface ShieldProps {
  count: number;
  justUsed: boolean;
}

/* 22 x 26 ice-blue shield with the count of freezes owned. */
function FreezeShield({ count, justUsed }: ShieldProps) {
  const owned = count > 0;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 22 26"
      className={cn("h-[22px] w-[18px]", justUsed && "sf-shield--pop")}
    >
      <path
        d="M11 2 L20 5 V12 C20 18 16 22 11 24 C6 22 2 18 2 12 V5 Z"
        fill={owned ? "#8CDCFF" : "#F5F7FA"}
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeDasharray={owned ? undefined : "3 2.5"}
      />
      <text
        x="11"
        y="16.5"
        textAnchor="middle"
        className="font-heading"
        fontSize="11"
        fontWeight="700"
        fill={owned ? INK : "#4A4566"}
      >
        {count}
      </text>
    </svg>
  );
}

/* ---- Tooltip copy ---- */

function nextMilestone(days: number): number | undefined {
  return MILESTONE_DAYS.find((milestone) => milestone > days);
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

interface TooltipLines {
  title: string;
  status: string;
  target: string;
  milestone: string | undefined;
  freezes: string;
  rules: string;
}

function tooltipLines(
  days: number,
  freezes: number,
  doneToday: boolean | undefined,
  freezeUsed: boolean,
): TooltipLines {
  const next = days + 1;

  let status: string;
  let target: string;
  if (days === 0) {
    status = "No streak yet.";
    target = "Finish a lesson, activity, quiz, assignment or practice set to start a 1-day streak.";
  } else if (doneToday === true) {
    status = "Active: you already did a streak action today.";
    target = `Tomorrow's target: do one more learning action to reach ${next} days.`;
  } else if (doneToday === false) {
    status = freezeUsed ? "Freeze used: it saved your streak." : "Not done yet today.";
    target = `Do one learning action today to keep the streak and reach ${next} days.`;
  } else {
    status = freezeUsed ? "Freeze used: it saved your streak." : "Keep it going.";
    target = `Do one learning action each day to reach ${next} days.`;
  }
  if (days > 0 && doneToday === true && freezeUsed) {
    status = "Active. A freeze saved your streak and you did a streak action today.";
  }

  const milestone = nextMilestone(days);

  return {
    title: `${days}-day streak`,
    status,
    target,
    milestone: milestone === undefined ? undefined : `Next milestone reward at ${milestone} days.`,
    freezes:
      freezes > 0
        ? `You have ${freezes} streak ${plural(freezes, "freeze", "freezes")}${
            freezes >= MAX_FREEZES ? " (the most you can hold)" : ""
          }.`
        : "You have no streak freezes. You can get one in the Shop.",
    rules:
      "A freeze is used automatically if you miss exactly one day. Missing two or more days in a row breaks the streak, even with freezes. Games and AI chat alone do not count.",
  };
}

/* ---- Component ---- */

/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- keyboard users need the streak tooltip */
export function StreakFlame({
  streakDays,
  freezes,
  doneToday,
  freezeUsed = false,
  size = "md",
  showCount = true,
  className,
  ...rest
}: StreakFlameProps) {
  useFlameStyles();

  const days = wholeCount(streakDays);
  const owned = wholeCount(freezes);
  const tier = tierFor(days);
  const look = LOOKS[tier];
  const height = SIZE_PX[size];
  const lines = tooltipLines(days, owned, doneToday, freezeUsed);

  const accessibleLabel = [
    `Streak: ${days} ${plural(days, "day", "days")}`,
    doneToday === true ? "done today" : doneToday === false && days > 0 ? "not done today" : "",
    `${owned} streak ${plural(owned, "freeze", "freezes")}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Tooltip.Provider>
      <Tooltip>
        <Tooltip.Trigger asChild>
          <span
            {...rest}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the tooltip trigger must be focusable so keyboard users can read the streak details
            tabIndex={0}
            role="img"
            aria-label={accessibleLabel}
            data-streak-tier={tier}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-stroke focus-visible:ring-offset-2",
              className,
            )}
          >
            <span
              aria-hidden="true"
              className="relative inline-block shrink-0"
              style={{ height, width: Math.round(height * 0.8) }}
            >
              <svg viewBox="0 0 64 80" focusable="false" className="h-full w-full overflow-visible">
                <FlameArt tier={tier} look={look} />
              </svg>
              <span className="absolute -bottom-1 -right-2.5">
                <FreezeShield count={owned} justUsed={freezeUsed} />
              </span>
            </span>
            {showCount ? (
              <span
                aria-hidden="true"
                className={cn(
                  "ml-2 font-heading font-bold tabular-nums leading-none text-stroke",
                  COUNT_TEXT[size],
                )}
              >
                {days}
              </span>
            ) : null}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom" className="max-w-[260px]">
          <p className="font-heading text-sm font-bold">{lines.title}</p>
          <p className="mt-1">{lines.status}</p>
          <p className="mt-1">{lines.target}</p>
          {lines.milestone !== undefined ? <p className="mt-1">{lines.milestone}</p> : null}
          <p className="mt-2 border-t border-surface-0/30 pt-2">{lines.freezes}</p>
          <p className="mt-1">{lines.rules}</p>
          <Tooltip.Arrow />
        </Tooltip.Content>
      </Tooltip>
    </Tooltip.Provider>
  );
}
/* eslint-enable jsx-a11y/no-noninteractive-tabindex */

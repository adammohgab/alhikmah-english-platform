import { useEffect, useId, useInsertionEffect, useRef, useState } from "react";
import { Minus, X } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { PipAvatar } from "@/shared/components/ai/PipAvatar";

/* ========================================
   PipCompanion (STU-GAM-18; GLOBAL-STYLES-SPEC §11 "Characters")

   A small floating Pip (the owl from the AI Tutor) in the bottom-right corner of the student
   dashboard and lesson pages. Collapsed, it is a mini owl badge with a dot when there is
   something new to read. Pressed, it opens a speech bubble with one short, friendly line.

   What Pip says is chosen from the numbers the caller passes in (the backend owns XP and
   streaks; this widget only displays). First match wins:
     1. streak at risk      streakDays > 0 and doneToday is false
     2. close to a level    xpToNextLevel is 1 to 50  ("You are 20 XP away from leveling up!")
     3. lesson hint         context "lesson" with a `lessonHint`
     4. start a streak      streakDays is 0 and doneToday is false
     5. done for today      doneToday is true
     6. encouragement       a fixed line for the context

   Non-intrusive by design
     - starts collapsed; never moves focus, never opens by itself, never blocks the page;
     - the wrapper ignores pointer events and only the owl and the bubble take them, so
       buttons and content underneath stay clickable;
     - the bubble has a collapse button and a "Hide Pip" button; Escape collapses; hiding lasts
       for the browser session (sessionStorage), and a new tip never reopens the bubble;
     - on phones it sits above the 56px bottom tab bar and the iOS home indicator.

   Mount it only where Pip belongs. Spec §11 keeps character art out of quizzes, assignment
   solving, forms, tables and settings, so the page that renders this decides where it appears.

   Motion is CSS only and throttled with no provider: prefers-reduced-motion and the low
   effects tier (data-effects-tier on <html>) make Pip static.
   ======================================== */

export type PipContext = "dashboard" | "lesson";

export interface PipCompanionProps {
  /** Page type. Picks the fallback encouragement and enables `lessonHint`. */
  context: PipContext;
  /** XP still needed for the next level, from the backend. Omit when unknown or at max level. */
  xpToNextLevel?: number | undefined;
  /** Current streak in days, from the backend. */
  streakDays?: number | undefined;
  /** True once a streak action was done today; false if not; undefined when unknown. */
  doneToday?: boolean | undefined;
  /** A hint for the current lesson, shown on lesson pages. Plain text. */
  lessonHint?: string | undefined;
  /** Start with the bubble open. Default false (collapsed). */
  defaultExpanded?: boolean | undefined;
  /** Called when the student hides Pip for the session. */
  onHide?: (() => void) | undefined;
  className?: string | undefined;
}

/* ---- Advice ---- */

type AdviceKind = "streak" | "level" | "hint" | "start" | "done" | "cheer";

interface Advice {
  /** Changes whenever the message changes, so "unread" resets for a new tip. */
  id: string;
  kind: AdviceKind;
  text: string;
}

/** Level-up nudges only appear when the next level is this close. */
const LEVEL_NUDGE_MAX_XP = 50;

const CHEER: Record<PipContext, string> = {
  dashboard: "Ready when you are. One small step today keeps you moving!",
  lesson: "Take your time. Every new word you learn counts!",
};

function wholeCount(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function pickAdvice(props: Pick<PipCompanionProps, "context" | "xpToNextLevel" | "streakDays" | "doneToday" | "lessonHint">): Advice {
  const { context, doneToday, lessonHint } = props;
  const days = wholeCount(props.streakDays);
  const xp = wholeCount(props.xpToNextLevel);

  if (days > 0 && doneToday === false) {
    return {
      id: `streak:${days}`,
      kind: "streak",
      text: `Your ${days}-day streak is waiting! Finish one lesson, activity, quiz or practice set today to keep it.`,
    };
  }
  if (xp > 0 && xp <= LEVEL_NUDGE_MAX_XP) {
    return {
      id: `level:${xp}`,
      kind: "level",
      text: `You are ${xp} XP away from leveling up!`,
    };
  }
  const hint = lessonHint?.trim();
  if (context === "lesson" && hint) {
    return { id: `hint:${hint}`, kind: "hint", text: hint };
  }
  if (days === 0 && doneToday === false) {
    return {
      id: "start",
      kind: "start",
      text: "Start a streak today: finish one lesson, activity, quiz or practice set.",
    };
  }
  if (doneToday === true) {
    return {
      id: "done",
      kind: "done",
      text: "Great work today! Come back tomorrow to keep your streak growing.",
    };
  }
  return { id: `cheer:${context}`, kind: "cheer", text: CHEER[context] };
}

/* ---- Session persistence ----
   Storage can be unavailable (private mode, blocked cookies). Then Pip simply stays hidden
   only until the page reloads: the in-memory state still works, so nothing is lost. */

const HIDDEN_KEY = "alhikmah.pip.hidden";

function readHidden(): boolean {
  try {
    return window.sessionStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

function persistHidden(): boolean {
  try {
    window.sessionStorage.setItem(HIDDEN_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/* ---- Styles ---- */

const STYLE_ID = "pip-companion-styles";

const STYLES = `
.pip-bob{animation:pip-bob 3.2s ease-in-out infinite}
.pip-bob--alert{animation:pip-wiggle 3.2s ease-in-out infinite}
.pip-bubble{transform-origin:100% 100%;animation:pip-pop 0.18s cubic-bezier(0.34,1.56,0.64,1) 1}
@keyframes pip-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes pip-wiggle{0%,60%,100%{transform:rotate(0deg)}68%{transform:rotate(-8deg)}76%{transform:rotate(7deg)}84%{transform:rotate(-4deg)}92%{transform:rotate(0deg)}}
@keyframes pip-pop{0%{opacity:0;transform:scale(0.92)}100%{opacity:1;transform:scale(1)}}
[data-effects-tier="low"] .pip-bob,[data-effects-tier="low"] .pip-bubble{animation:none}
@media (prefers-reduced-motion:reduce){.pip-bob,.pip-bubble{animation:none}}
`;

function usePipStyles(): void {
  useInsertionEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLES;
    document.head.appendChild(style);
  }, []);
}

/* ---- Component ---- */

const ICON_BUTTON =
  "inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-stroke bg-surface-0 text-stroke outline-none transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-stroke focus-visible:ring-offset-2";

export function PipCompanion({
  context,
  xpToNextLevel,
  streakDays,
  doneToday,
  lessonHint,
  defaultExpanded = false,
  onHide,
  className,
}: PipCompanionProps) {
  usePipStyles();

  const advice = pickAdvice({ context, xpToNextLevel, streakDays, doneToday, lessonHint });
  const [hidden, setHidden] = useState<boolean>(readHidden);
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  const [seenId, setSeenId] = useState<string | null>(defaultExpanded ? advice.id : null);
  const owlRef = useRef<HTMLButtonElement>(null);
  const bubbleId = useId();

  /* An open bubble counts as read, including a tip that changes while it is open. */
  useEffect(() => {
    if (expanded) setSeenId(advice.id);
  }, [expanded, advice.id]);

  if (hidden) return null;

  const unread = !expanded && seenId !== advice.id;

  const collapse = () => {
    setExpanded(false);
    owlRef.current?.focus();
  };

  const hide = () => {
    persistHidden();
    setHidden(true);
    onHide?.();
  };

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-4 z-30 flex flex-col items-end gap-2",
        "bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] md:bottom-6",
        className,
      )}
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded) {
          event.stopPropagation();
          collapse();
        }
      }}
    >
      {expanded ? (
        <div
          id={bubbleId}
          role="region"
          aria-label="Pip's tip"
          className="pip-bubble pointer-events-auto relative w-[min(18rem,calc(100vw-2rem))] rounded-[14px] border-2 border-stroke bg-surface-0 p-3 pr-2 shadow-retro-sm"
        >
          <div className="flex items-start gap-2">
            <p className="flex-1 pt-1 font-body text-[15px] font-semibold leading-snug text-stroke">
              {advice.text}
            </p>
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                className={ICON_BUTTON}
                aria-label="Collapse Pip"
                onClick={collapse}
              >
                <Minus aria-hidden="true" size={16} strokeWidth={3} />
              </button>
              <button
                type="button"
                className={ICON_BUTTON}
                aria-label="Hide Pip for this session"
                onClick={hide}
              >
                <X aria-hidden="true" size={16} strokeWidth={3} />
              </button>
            </div>
          </div>
          {/* Tail pointing down at the owl. */}
          <span
            aria-hidden="true"
            className="absolute -bottom-[7px] right-6 h-3 w-3 rotate-45 border-b-2 border-r-2 border-stroke bg-surface-0"
          />
        </div>
      ) : null}

      <button
        ref={owlRef}
        type="button"
        aria-expanded={expanded}
        aria-controls={expanded ? bubbleId : undefined}
        aria-label={
          expanded
            ? "Pip, your study buddy. Collapse the tip"
            : unread
              ? "Pip, your study buddy. You have a new tip"
              : "Pip, your study buddy. Open the tip"
        }
        onClick={() => setExpanded((open) => !open)}
        className={cn(
          "pointer-events-auto relative rounded-full border-2 border-stroke bg-[var(--world-tint,#fff7e0)] p-1 shadow-retro-sm outline-none transition-transform",
          "hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-stroke focus-visible:ring-offset-2",
        )}
      >
        <span className={cn("block", unread ? "pip-bob pip-bob--alert" : "pip-bob")}>
          <PipAvatar size={expanded ? 52 : 40} />
        </span>
        {unread ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-stroke bg-[var(--world-pop,#2fd6a3)]"
          />
        ) : null}
      </button>
    </div>
  );
}

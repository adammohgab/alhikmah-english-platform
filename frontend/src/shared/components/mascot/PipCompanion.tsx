import { useMemo, useState } from "react";
import { Flame, X, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { PipAvatar } from "@/shared/components/ai/PipAvatar";
import { cn } from "@/shared/lib/utils/cn";

export type PipCompanionContext = "dashboard" | "lesson" | "quest" | "shop" | "general";

export interface PipCompanionProps {
  /** Current page or activity, used to tailor Pip's advice. */
  context?: PipCompanionContext;
  /** XP still needed to reach the next level. Omit when unavailable. */
  xpToNextLevel?: number;
  /** Current consecutive-day learning streak. Omit when unavailable. */
  streakDays?: number;
  /** Current lesson title, when shown on a lesson page. */
  lessonTitle?: string;
  /** Optional custom message takes priority over the built-in contextual advice. */
  message?: string;
  /** Hide the companion for pages where floating UI is not appropriate. */
  disabled?: boolean;
  className?: string;
}

const CONTEXT_MESSAGES: Record<PipCompanionContext, string> = {
  dashboard: "Ready for a little progress? Pick one small quest and let's do it!",
  lesson: "Take it one step at a time. A short break after this section can help it stick.",
  quest: "You're on a quest! Read each step carefully and celebrate the progress you make.",
  shop: "Your coins are earned through learning. Check your rewards before you spend them!",
  general: "Every small step counts. Keep going — you've got this!",
};

<<<<<<< HEAD
/** A small, dismissible student companion. It uses the existing Pip sticker artwork. */
=======
function wholeCount(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function pickAdvice(
  props: Pick<
    PipCompanionProps,
    "context" | "xpToNextLevel" | "streakDays" | "doneToday" | "lessonHint"
  >,
): Advice {
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

>>>>>>> 396e3f56b4bb9fc3d6568f7fba82333a823da2b2
export function PipCompanion({
  context = "general",
  xpToNextLevel,
  streakDays,
  lessonTitle,
  message,
  disabled = false,
  className,
}: PipCompanionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const advice = useMemo(() => {
    if (message?.trim()) return message.trim();
    if (typeof xpToNextLevel === "number" && xpToNextLevel >= 0) {
      if (xpToNextLevel === 0)
        return "Level-up time! Check your progress and see what you've unlocked.";
      if (xpToNextLevel <= 25)
        return `You're only ${xpToNextLevel} XP away from leveling up. One more little win!`;
    }
    if (typeof streakDays === "number" && streakDays > 0) {
      return streakDays === 1
        ? "Your learning streak has started! Come back tomorrow to keep it going."
        : `Amazing — you're on a ${streakDays}-day learning streak. Keep it going!`;
    }
    if (context === "lesson" && lessonTitle?.trim()) {
      return `Let's make progress on “${lessonTitle.trim()}”. Focus on one idea at a time.`;
    }
    return CONTEXT_MESSAGES[context];
  }, [context, lessonTitle, message, streakDays, xpToNextLevel]);

  if (disabled || dismissed) return null;

  return (
<<<<<<< HEAD
    <aside
      aria-label="Pip learning companion"
=======
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- only listens for Escape bubbling up from the focusable controls inside
    <div
>>>>>>> 396e3f56b4bb9fc3d6568f7fba82333a823da2b2
      className={cn(
        "pointer-events-none fixed bottom-20 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 sm:bottom-6 sm:right-6",
        className,
      )}
    >
      {!collapsed && (
        <section
          aria-live="polite"
          className="pointer-events-auto relative w-[min(19rem,calc(100vw-2rem))] rounded-2xl border-2 border-stroke bg-surface-0 p-3 text-stroke shadow-retro-md"
        >
          <span
            aria-hidden="true"
            className="absolute -bottom-2 right-7 h-4 w-4 rotate-45 border-b-2 border-r-2 border-stroke bg-surface-0"
          />
          <div className="relative flex items-start gap-3">
            <div className="rounded-xl border-2 border-stroke bg-[var(--world-tint,#fff1bd)] p-1.5 motion-safe:animate-[bounce_2.8s_ease-in-out_infinite] motion-reduce:animate-none">
              <PipAvatar size={42} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-1.5 font-heading text-sm font-bold">
                Pip{" "}
                <Sparkles
                  aria-hidden="true"
                  size={14}
                  className="text-[var(--world-deep,#a85b13)]"
                />
                {typeof streakDays === "number" && streakDays > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-stroke bg-[var(--world-soft,#fff1bd)] px-2 py-0.5 text-xs font-semibold">
                    <Flame aria-hidden="true" size={12} /> {streakDays} day
                    {streakDays === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed">{advice}</p>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss Pip companion"
              className="pointer-events-auto -mr-1 -mt-1 rounded-lg p-1 text-muted transition hover:bg-surface-100 hover:text-stroke focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="pointer-events-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted transition hover:bg-surface-100 hover:text-stroke focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke"
            >
              <ChevronDown size={14} /> Minimize
            </button>
          </div>
        </section>
      )}

      <div className="flex items-center gap-2">
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="pointer-events-auto inline-flex items-center gap-1 rounded-full border-2 border-stroke bg-surface-0 px-3 py-2 text-xs font-bold text-stroke shadow-retro-sm transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke"
          >
            <ChevronUp size={14} /> Pip's tip
          </button>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand Pip companion" : "Minimize Pip companion"}
          title={collapsed ? "Open Pip's tip" : "Minimize Pip"}
          className="pointer-events-auto relative grid h-14 w-14 place-items-center rounded-2xl border-2 border-stroke bg-[var(--world-soft,#fff1bd)] shadow-retro-md transition hover:-translate-y-1 hover:rotate-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke active:translate-y-0 active:shadow-none motion-reduce:transform-none"
        >
          <PipAvatar size={42} />
          {collapsed && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-stroke bg-[var(--world-pop,#ff6fa5)]"
            />
          )}
        </button>
      </div>
    </aside>
  );
}

export default PipCompanion;

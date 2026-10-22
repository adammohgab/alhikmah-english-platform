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

/** A small, dismissible student companion. It uses the existing Pip sticker artwork. */
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
      if (xpToNextLevel === 0) return "Level-up time! Check your progress and see what you've unlocked.";
      if (xpToNextLevel <= 25) return `You're only ${xpToNextLevel} XP away from leveling up. One more little win!`;
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
    <aside
      aria-label="Pip learning companion"
      className={cn("fixed bottom-20 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 sm:bottom-6 sm:right-6", className)}
    >
      {!collapsed && (
        <section
          aria-live="polite"
          className="relative w-[min(19rem,calc(100vw-2rem))] rounded-2xl border-2 border-stroke bg-surface-0 p-3 text-ink shadow-[4px_5px_0_var(--color-stroke,rgba(25,25,25,0.9))] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
        >
          <span aria-hidden="true" className="absolute -bottom-2 right-7 h-4 w-4 rotate-45 border-b-2 border-r-2 border-stroke bg-surface-0" />
          <div className="relative flex items-start gap-3">
            <div className="rounded-xl border-2 border-stroke bg-[var(--world-tint,#fff1bd)] p-1.5 motion-safe:animate-[bounce_2.8s_ease-in-out_infinite] motion-reduce:animate-none">
              <PipAvatar size={42} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-1.5 font-heading text-sm font-bold">
                Pip <Sparkles aria-hidden="true" size={14} className="text-[var(--world-deep,#a85b13)]" />
                {typeof streakDays === "number" && streakDays > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-stroke bg-[var(--world-soft,#fff1bd)] px-2 py-0.5 text-xs font-semibold">
                    <Flame aria-hidden="true" size={12} /> {streakDays} day{streakDays === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed">{advice}</p>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss Pip companion"
              className="-mr-1 -mt-1 rounded-lg p-1 text-ink/70 transition hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink/70 transition hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke"
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
            className="inline-flex items-center gap-1 rounded-full border-2 border-stroke bg-surface-0 px-3 py-2 text-xs font-bold text-ink shadow-[2px_3px_0_var(--color-stroke,rgba(25,25,25,0.9))] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke"
          >
            <ChevronUp size={14} /> Pip's tip
          </button>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand Pip companion" : "Minimize Pip companion"}
          title={collapsed ? "Open Pip's tip" : "Minimize Pip"}
          className="relative grid h-14 w-14 place-items-center rounded-2xl border-2 border-stroke bg-[var(--world-soft,#fff1bd)] shadow-[3px_4px_0_var(--color-stroke,rgba(25,25,25,0.9))] transition hover:-translate-y-1 hover:rotate-2 active:translate-y-0 active:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke motion-reduce:transform-none"
        >
          <PipAvatar size={42} />
          {collapsed && <span aria-hidden="true" className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-stroke bg-[var(--world-pop,#ff6fa5)]" />}
        </button>
      </div>
    </aside>
  );
}

export default PipCompanion;

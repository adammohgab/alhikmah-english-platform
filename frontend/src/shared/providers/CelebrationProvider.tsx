import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import confetti from "canvas-confetti";
import { PartyPopper } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { useEffectsTier } from "@/shared/hooks/useEffectsTier";
import { useSound, type SoundName } from "@/shared/hooks/useSound";
import { CelebrationDialog } from "@/shared/components/feedback/CelebrationDialog";

/* ========================================
   CelebrationProvider + useCelebration (GLOBAL-STYLES-SPEC §8.7 "Celebration system")

   Three tiers, queued (spec: "celebrations queue", displayed one after another, never
   overlapping):
     small   coin ding + a subtle confetti burst at the trigger element (correct answers,
             coin earned, quest progress)
     medium  full-screen confetti shower + fanfare + a tappable sticker banner (quest
             claimed, quiz passed, badge earned, streak day)
     large   the CelebrationDialog takeover with hero, confetti cannons and reward summary
             (level up, certificate, streak milestone)

   Rules implemented from §8.7 / §8.9:
     - at most one Large per 10 seconds — extra Large requests are downgraded to Medium
     - every celebration is skippable: click/tap the banner, press Escape, or close the dialog
     - small and Medium auto-dismiss after a short display; Large waits for the user
     - reduced motion / low effects tier: no confetti at all (lightweight fallback), the
       banner fades in instead of springing, and the dialog medal fades in — "a static
       sticker and a short fade"
     - sound: `SoundProvider.play` no-ops while muted / before the first gesture, so the
       sound mute preference is honored without extra wiring; pass `sound: false` to
       silence a specific celebration
   ======================================== */

export type CelebrationTier = "small" | "medium" | "large";

export interface CelebrationOptions {
  /** How big the moment is. */
  tier: CelebrationTier;
  /** Headline: "Level 5 Reached!", "Quiz passed!", "+50 coins". */
  title: string;
  /** One supporting line (banner and dialog). */
  description?: string | undefined;
  /** Banner / dialog hero icon override. Default a party popper (banner) or trophy (dialog). */
  icon?: ReactNode | undefined;
  /** Reward summary rows for the Large dialog. */
  rewards?: Array<{ label: string; value?: string }> | undefined;
  /** Small tier: element (or viewport point) the burst originates from. Default viewport center. */
  origin?: HTMLElement | null | { x: number; y: number } | undefined;
  /** Small / Medium: ms before auto-dismissing. Default 1600 (small) / 2800 (medium). */
  duration?: number | undefined;
  /** Sound override. Default `coin` (small) / `fanfare` (medium, large). `false` is silent. */
  sound?: SoundName | false | undefined;
}

interface QueuedCelebration {
  id: number;
  tier: CelebrationTier;
  title: string;
  description?: string | undefined;
  icon?: ReactNode | undefined;
  rewards?: Array<{ label: string; value?: string }> | undefined;
  origin?: CelebrationOptions["origin"];
  duration?: number | undefined;
  sound?: SoundName | false | undefined;
}

export interface CelebrationContextValue {
  /** Queues a celebration; it plays as soon as every earlier one has finished. */
  celebrate: (options: CelebrationOptions) => void;
  /** Skips the celebration currently on display. */
  dismiss: () => void;
}

const CelebrationContext = createContext<CelebrationContextValue | null>(null);

/* ---- Tuning ---- */

const DEFAULT_DURATION: Record<"small" | "medium", number> = { small: 1600, medium: 2800 };
const DEFAULT_SOUND: Record<CelebrationTier, SoundName> = {
  small: "coin",
  medium: "fanfare",
  large: "fanfare",
};
/** Spec §8.7: at most one Large celebration per 10 seconds. */
const LARGE_COOLDOWN_MS = 10_000;

/* ---- Confetti helpers (canvas-confetti, spec §5 and §30) ---- */

function worldColors(): string[] {
  if (typeof window === "undefined") return ["#ffb84d", "#2fd6a3", "#ffd3a6", "#8f4300"];
  const css = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => {
    const value = css.getPropertyValue(name).trim();
    return value.length > 0 ? value : fallback;
  };
  return [
    pick("--world-main", "#ffb84d"),
    pick("--world-pop", "#2fd6a3"),
    pick("--world-soft", "#ffd3a6"),
    pick("--world-deep", "#8f4300"),
    "#ffd93d",
  ];
}

function resolveOrigin(origin: CelebrationOptions["origin"]): { x: number; y: number } {
  if (!origin) return { x: 0.5, y: 0.5 };
  if (origin instanceof HTMLElement) {
    const rect = origin.getBoundingClientRect();
    return {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    };
  }
  return origin;
}

/* ---- Medium banner (sticker toast, tap to skip) ---- */

function CelebrationBanner({
  celebration,
  onSkip,
  motionAllowed,
}: {
  celebration: QueuedCelebration;
  onSkip: () => void;
  motionAllowed: boolean;
}) {
  const bannerRef = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    const el = bannerRef.current;
    if (!el || typeof el.animate !== "function") return;
    if (!motionAllowed) {
      // Spec §8.9: static sticker and a short fade.
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 150,
        easing: "ease-out",
        fill: "backwards",
      });
      return;
    }
    el.animate(
      [
        { opacity: 0, transform: "translateY(-24px) scale(0.85) rotate(-6deg)" },
        { opacity: 1, transform: "translateY(0) scale(1) rotate(-2deg)" },
      ],
      { duration: 380, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "backwards" },
    );
  }, [motionAllowed, celebration.id]);

  return (
    // Tapping the banner skips it; Escape and the auto-dismiss timer also do.
    // The wrapper carries role="status" so screen readers announce the celebration;
    // the inner button is the skip affordance.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4"
    >
      <button
        ref={bannerRef}
        type="button"
        onClick={onSkip}
        data-lenis-prevent
        className={cn(
          "pointer-events-auto flex max-w-full cursor-pointer items-center gap-3",
          "-rotate-2 rounded-[12px] border-2 border-stroke px-5 py-3 text-left",
          "bg-[var(--world-main,#ffb84d)] text-stroke shadow-retro-md",
          "transition-transform duration-100 ease-out active:translate-y-[2px] active:rotate-0",
        )}
      >
        <span aria-hidden="true" className="shrink-0 [&_svg]:[stroke-width:2.5]">
          {celebration.icon ?? <PartyPopper size={24} />}
        </span>
        <span className="min-w-0">
          <span className="block font-heading text-[16px] font-semibold leading-tight">
            {celebration.title}
          </span>
          {celebration.description !== undefined && (
            <span className="block text-[13px] font-medium leading-snug opacity-80">
              {celebration.description}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

/* ---- Provider ---- */

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const { tier: fxTier, prefersReducedMotion } = useEffectsTier();
  const { play } = useSound();
  const motionAllowed = fxTier !== "low" && !prefersReducedMotion;

  /* The first item is the one on display; the rest wait. Sequential by construction. */
  const [queue, setQueue] = useState<QueuedCelebration[]>([]);
  const active = queue[0] ?? null;
  const nextId = useRef(1);
  const largeShownAt = useRef<number | null>(null);
  const playRef = useRef(play);
  playRef.current = play;

  const dismiss = useCallback(() => setQueue((prev) => prev.slice(1)), []);

  const celebrate = useCallback((options: CelebrationOptions) => {
    const { tier: requestedTier, ...rest } = options;
    let tier = requestedTier;
    // Spec §8.7: at most one Large per 10 seconds; extras downgrade to Medium.
    if (
      tier === "large" &&
      largeShownAt.current !== null &&
      Date.now() - largeShownAt.current < LARGE_COOLDOWN_MS
    ) {
      tier = "medium";
    }
    const entry: QueuedCelebration = { id: nextId.current, tier, ...rest };
    nextId.current += 1;
    setQueue((prev) => [...prev, entry]);
  }, []);

  /* Fire the sound and the particles once per displayed celebration. */
  useLayoutEffect(() => {
    if (!active) return;
    const sound = active.sound ?? DEFAULT_SOUND[active.tier];
    if (sound !== false) playRef.current(sound);

    if (typeof confetti !== "function") return;
    const colors = worldColors();
    const particleBudget = fxTier === "high" ? 1 : fxTier === "balanced" ? 0.5 : 0;

    if (active.tier === "small" && particleBudget > 0) {
      void confetti({
        particleCount: Math.round(90 * particleBudget),
        spread: 70,
        startVelocity: 28,
        scalar: 0.85,
        ticks: 130,
        gravity: 0.9,
        origin: resolveOrigin(active.origin),
        colors,
        disableForReducedMotion: true,
        zIndex: 70,
      });
    }
    if (active.tier === "medium" && particleBudget > 0) {
      void confetti({
        particleCount: Math.round(120 * particleBudget),
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.7 },
        colors,
        disableForReducedMotion: true,
        zIndex: 70,
      });
      void confetti({
        particleCount: Math.round(120 * particleBudget),
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.7 },
        colors,
        disableForReducedMotion: true,
        zIndex: 70,
      });
    }
  }, [active, fxTier]);

  /* Record Large display times for the cooldown rule. */
  useEffect(() => {
    if (active?.tier === "large") largeShownAt.current = Date.now();
  }, [active]);

  /* Small and Medium auto-dismiss; Large waits for the user (dialog buttons / Escape). */
  useEffect(() => {
    if (!active || active.tier === "large") return;
    const timeout = window.setTimeout(dismiss, active.duration ?? DEFAULT_DURATION[active.tier]);
    return () => window.clearTimeout(timeout);
  }, [active, dismiss]);

  /* Spec §8.7: skippable with Escape. The Large dialog handles its own Escape through
     Radix (it also closes the overlay), so the global listener only covers the rest. */
  useEffect(() => {
    if (!active || active.tier === "large") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, dismiss]);

  const value = useMemo<CelebrationContextValue>(
    () => ({ celebrate, dismiss }),
    [celebrate, dismiss],
  );

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {active?.tier === "medium" && (
        <CelebrationBanner
          key={active.id}
          celebration={active}
          onSkip={dismiss}
          motionAllowed={motionAllowed}
        />
      )}
      {active?.tier === "large" && (
        <CelebrationDialog
          open
          onOpenChange={(open) => {
            if (!open) dismiss();
          }}
          title={active.title}
          description={active.description}
          rewards={active.rewards}
          icon={active.icon}
        />
      )}
    </CelebrationContext.Provider>
  );
}

/**
 * Triggers and controls celebrations. Must be used inside `<CelebrationProvider>`.
 *
 * ```tsx
 * const { celebrate } = useCelebration();
 * celebrate({ tier: "large", title: "Level 5 Reached!", rewards: [{ label: "XP earned", value: "+250" }] });
 * celebrate({ tier: "small", title: "+10 coins", origin: buttonRef.current });
 * ```
 */
// The celebration task owns this single file and mandates the hook co-located with the
// provider (the toast pattern of a separate *-context.ts file is outside the ownership).
// eslint-disable-next-line react-refresh/only-export-components
export function useCelebration(): CelebrationContextValue {
  const value = useContext(CelebrationContext);
  if (!value) {
    throw new Error("useCelebration must be used inside <CelebrationProvider>");
  }
  return value;
}

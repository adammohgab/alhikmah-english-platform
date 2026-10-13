import { createContext, useContext } from "react";

/* ========================================
   Effects tiers: the performance governor's model (CONTRIBUTING §4 "Effects Tiers").
   - low:      CSS only; no 3D, no confetti, minimal CSS transitions.
   - balanced: lightweight particle bursts, standard 2D motion.
   - high:     full 60fps GSAP ticker, interactive stickers, 3D celebratory stages.
   ======================================== */

export const EFFECTS_TIERS = ["low", "balanced", "high"] as const;
export type EffectsTier = (typeof EFFECTS_TIERS)[number];

export interface BatteryStatus {
  /** 0 to 1, as reported by the Battery Status API. */
  level: number;
  charging: boolean;
}

/** Everything the tier is derived from. Any hardware hint may be missing on a given browser. */
export interface EffectsSignals {
  prefersReducedMotion: boolean;
  /** `navigator.hardwareConcurrency` */
  hardwareConcurrency: number | undefined;
  /** `navigator.deviceMemory`, in GB (Chromium only). */
  deviceMemory: number | undefined;
  /** Battery Status API (Chromium only); null when unavailable or not yet read. */
  battery: BatteryStatus | null;
}

/* Thresholds: at or below a LOW_SPEC value is low; at or below a MID_SPEC value is balanced. */
export const LOW_SPEC_MAX_CORES = 2;
export const LOW_SPEC_MAX_MEMORY_GB = 2;
export const MID_SPEC_MAX_CORES = 4;
export const MID_SPEC_MAX_MEMORY_GB = 4;
/**
 * Browsers expose no "battery saver" flag, so it is approximated the way OSes switch it on:
 * unplugged with 20% or less charge left.
 */
export const BATTERY_SAVER_MAX_LEVEL = 0.2;

export function isBatterySaver(battery: BatteryStatus | null): boolean {
  return battery !== null && !battery.charging && battery.level <= BATTERY_SAVER_MAX_LEVEL;
}

function usable(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Pure tier decision.
 * - `prefers-reduced-motion` always wins and forces low.
 * - Low-spec hardware is low; mid-spec is balanced; otherwise high.
 * - With no hardware hints at all, balanced (the cautious middle) is chosen.
 * - Battery saver caps a high device at balanced.
 */
export function resolveEffectsTier(signals: EffectsSignals): EffectsTier {
  if (signals.prefersReducedMotion) return "low";

  const cores = usable(signals.hardwareConcurrency);
  const memory = usable(signals.deviceMemory);

  if (
    (cores !== undefined && cores <= LOW_SPEC_MAX_CORES) ||
    (memory !== undefined && memory <= LOW_SPEC_MAX_MEMORY_GB)
  ) {
    return "low";
  }

  if (cores === undefined && memory === undefined) return "balanced";

  const midSpec =
    (cores !== undefined && cores <= MID_SPEC_MAX_CORES) ||
    (memory !== undefined && memory <= MID_SPEC_MAX_MEMORY_GB);
  if (midSpec) return "balanced";

  return isBatterySaver(signals.battery) ? "balanced" : "high";
}

export interface EffectsContextValue {
  /** The active tier, mirrored on `<html data-effects-tier>`. */
  tier: EffectsTier;
  /** Live value of the OS `prefers-reduced-motion` setting. When true the tier is low. */
  prefersReducedMotion: boolean;
  /** 3D scenes (WebGL canvases) may render: high tier only. */
  canRender3D: boolean;
  /** Complex animation (GSAP, particle bursts, celebrations) may run: balanced and high. */
  canAnimateComplex: boolean;
}

export const EffectsContext = createContext<EffectsContextValue | null>(null);

export function useEffectsTier(): EffectsContextValue {
  const value = useContext(EffectsContext);
  if (!value) {
    throw new Error("useEffectsTier must be used inside <EffectsProvider>");
  }
  return value;
}

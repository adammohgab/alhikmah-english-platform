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

/* ========================================
   Personal effects preferences (STUDENT-SPEC ST-31 "Appearance" and "Sound and effects").
   A person's own choice sits on top of the automatic tier: reduced motion forces low, and a
   picked tier replaces the automatic one. Cached in localStorage so it applies before the
   account settings load; the settings page saves the same values to `user_settings`.
   ======================================== */

export const EFFECTS_STORAGE_KEY = "alhikmah.effects";

export interface EffectsPreferences {
  /** The tier the person picked, or null to keep the automatic choice. */
  tier: EffectsTier | null;
  /** The person's own reduced-motion switch (the OS setting still applies on top). */
  reducedMotion: boolean;
}

export const DEFAULT_EFFECTS_PREFERENCES: EffectsPreferences = { tier: null, reducedMotion: false };

export function isEffectsTier(value: unknown): value is EffectsTier {
  return typeof value === "string" && (EFFECTS_TIERS as readonly string[]).includes(value);
}

/** Reads the cached preferences; anything missing or malformed falls back to the defaults. */
export function readEffectsPreferences(): EffectsPreferences {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(EFFECTS_STORAGE_KEY);
  } catch {
    // Storage blocked: the choice simply won't persist across reloads.
  }
  if (!raw) return DEFAULT_EFFECTS_PREFERENCES;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_EFFECTS_PREFERENCES;
    const { tier, reducedMotion } = parsed as Record<string, unknown>;
    return {
      tier: isEffectsTier(tier) ? tier : null,
      reducedMotion: reducedMotion === true,
    };
  } catch {
    // Corrupt cached value: use the defaults and overwrite it on the next change.
    return DEFAULT_EFFECTS_PREFERENCES;
  }
}

export function writeEffectsPreferences(preferences: EffectsPreferences): void {
  try {
    window.localStorage.setItem(EFFECTS_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage blocked or full: the choice simply won't persist across reloads.
  }
}

export interface EffectsContextValue {
  /** The active tier, mirrored on `<html data-effects-tier>`. */
  tier: EffectsTier;
  /** True when the OS setting or the person's own switch asks for reduced motion. The tier is low. */
  prefersReducedMotion: boolean;
  /** The person's own choices, before the automatic tier is applied. */
  preferences: EffectsPreferences;
  /** Applies a change to the person's choices at once, everywhere in the app. */
  setPreferences: (patch: Partial<EffectsPreferences>) => void;
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

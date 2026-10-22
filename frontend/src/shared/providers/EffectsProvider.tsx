import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  EffectsContext,
  readEffectsPreferences,
  resolveEffectsTier,
  writeEffectsPreferences,
  type EffectsPreferences,
  type BatteryStatus,
  type EffectsContextValue,
} from "@/shared/hooks/useEffectsTier";

/* Browser APIs missing from lib.dom. */
interface BatteryManager extends EventTarget {
  readonly level: number;
  readonly charging: boolean;
}
type HintedNavigator = Navigator & {
  deviceMemory?: number;
  getBattery?: () => Promise<BatteryManager>;
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const TIER_ATTRIBUTE = "data-effects-tier";
const STYLE_ELEMENT_ID = "alhikmah-effects-runtime";

/* Low tier: minimal CSS transitions (150 ms fades, GLOBAL-STYLES-SPEC §8.9 "Minimal"). */
const LOW_TIER_CSS = [
  `:root[${TIER_ATTRIBUTE}="low"],`,
  `:root[${TIER_ATTRIBUTE}="low"] *,`,
  `:root[${TIER_ATTRIBUTE}="low"] *::before,`,
  `:root[${TIER_ATTRIBUTE}="low"] *::after { transition-duration: 150ms !important; }`,
].join("\n");

function readReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export interface EffectsProviderProps {
  children: ReactNode;
}

/**
 * The performance governor. Picks low, balanced or high from the OS reduced-motion setting,
 * CPU cores, device memory and battery state; re-evaluates live when any of them change;
 * and mirrors the result on `<html data-effects-tier>`.
 */
export function EffectsProvider({ children }: EffectsProviderProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readReducedMotion);
  const [battery, setBattery] = useState<BatteryStatus | null>(null);
  const [preferences, setPreferencesState] = useState<EffectsPreferences>(readEffectsPreferences);
  const preferencesRef = useRef(preferences);
  const [hardware] = useState(() => {
    const nav = navigator as HintedNavigator;
    return { hardwareConcurrency: nav.hardwareConcurrency, deviceMemory: nav.deviceMemory };
  });

  // OS reduced-motion toggle: applies the moment it changes, no reload.
  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    setPrefersReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
    };
  }, []);

  // Battery status (Chromium only): level and charging changes re-evaluate the tier.
  useEffect(() => {
    const nav = navigator as HintedNavigator;
    if (typeof nav.getBattery !== "function") return;

    let cancelled = false;
    let manager: BatteryManager | null = null;
    const sync = () => {
      if (manager) setBattery({ level: manager.level, charging: manager.charging });
    };

    void nav.getBattery().then(
      (resolved) => {
        if (cancelled) return;
        manager = resolved;
        sync();
        resolved.addEventListener("levelchange", sync);
        resolved.addEventListener("chargingchange", sync);
      },
      () => {
        // Battery API blocked (permissions policy): the tier uses the other signals only.
      },
    );

    return () => {
      cancelled = true;
      manager?.removeEventListener("levelchange", sync);
      manager?.removeEventListener("chargingchange", sync);
    };
  }, []);

  // The person's own choices: applied at once, cached for the next visit.
  const setPreferences = useCallback((patch: Partial<EffectsPreferences>) => {
    const next = { ...preferencesRef.current, ...patch };
    preferencesRef.current = next;
    setPreferencesState(next);
    writeEffectsPreferences(next);
  }, []);

  // Reduced motion from the OS or from the person's own switch always forces the low tier.
  const reduceMotion = prefersReducedMotion || preferences.reducedMotion;
  const tier = useMemo(
    () =>
      reduceMotion
        ? "low"
        : (preferences.tier ??
          resolveEffectsTier({ prefersReducedMotion: false, battery, ...hardware })),
    [reduceMotion, preferences.tier, battery, hardware],
  );

  // Mirror the tier on <html> so CSS can react to it.
  useLayoutEffect(() => {
    document.documentElement.setAttribute(TIER_ATTRIBUTE, tier);
    return () => {
      document.documentElement.removeAttribute(TIER_ATTRIBUTE);
    };
  }, [tier]);

  // The stylesheet that implements "minimal CSS transitions" on the low tier.
  useLayoutEffect(() => {
    const style = document.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = LOW_TIER_CSS;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  const value = useMemo<EffectsContextValue>(
    () => ({
      tier,
      prefersReducedMotion: reduceMotion,
      preferences,
      setPreferences,
      canRender3D: tier === "high",
      canAnimateComplex: tier !== "low",
    }),
    [tier, reduceMotion, preferences, setPreferences],
  );

  return <EffectsContext.Provider value={value}>{children}</EffectsContext.Provider>;
}

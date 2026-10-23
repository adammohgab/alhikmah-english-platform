import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  EffectsContext,
  resolveEffectsTier,
  type BatteryStatus,
  type EffectsContextValue,
  type EffectsPreferences,
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

  const [preferences, setPreferencesState] = useState<EffectsPreferences>({
    reducedMotion: false,
    tier: null,
  });
  const setPreferences = useCallback((patch: Partial<EffectsPreferences>) => {
    setPreferencesState((previous) => ({ ...previous, ...patch }));
  }, []);

  const tier = useMemo(() => {
    const automatic = resolveEffectsTier({ prefersReducedMotion, battery, ...hardware });
    if (prefersReducedMotion || preferences.reducedMotion) return "low" as const;
    return preferences.tier ?? automatic;
  }, [prefersReducedMotion, battery, hardware, preferences]);

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
      preferences,
      setPreferences,
      prefersReducedMotion,
      canRender3D: tier === "high",
      canAnimateComplex: tier !== "low",
    }),
    [tier, preferences, setPreferences, prefersReducedMotion],
  );

  return <EffectsContext.Provider value={value}>{children}</EffectsContext.Provider>;
}

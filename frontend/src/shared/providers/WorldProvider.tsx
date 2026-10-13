import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_WORLD,
  WORLD_IDS,
  WORLD_STORAGE_KEY,
  WorldContext,
  isWorldId,
  readStored,
  writeStored,
  type WorldContextValue,
  type WorldId,
} from "@/shared/hooks/useWorld";

export interface WorldProviderProps {
  children: ReactNode;
  /**
   * The world saved on the user's profile. When it is a valid world it wins over
   * localStorage, on mount and whenever it changes (e.g. after login or on another device).
   */
  profileWorld?: WorldId | null | undefined;
  /**
   * Called when the user switches world, so the owner of profile settings can save it.
   * Not called for changes that originate from the profile or from another tab.
   */
  onWorldChange?: ((world: WorldId) => void) | undefined;
}

function applyWorldAttribute(world: WorldId): void {
  document.documentElement.setAttribute("data-world", world);
}

/**
 * Owns the active world. Mirrors it on `<html data-world>`; palette variables and the
 * animated morph between worlds come from ThemeProvider.
 */
export function WorldProvider({ children, profileWorld, onWorldChange }: WorldProviderProps) {
  const [world, setWorldState] = useState<WorldId>(() => {
    if (isWorldId(profileWorld)) return profileWorld;
    const stored = readStored(WORLD_STORAGE_KEY);
    return isWorldId(stored) ? stored : DEFAULT_WORLD;
  });

  const worldRef = useRef(world);
  const onWorldChangeRef = useRef(onWorldChange);
  useLayoutEffect(() => {
    worldRef.current = world;
    onWorldChangeRef.current = onWorldChange;
  });

  // Keep <html data-world> in step with state (covers profile- and tab-driven changes).
  useLayoutEffect(() => {
    applyWorldAttribute(world);
    return () => {
      document.documentElement.removeAttribute("data-world");
    };
  }, [world]);

  // The profile is the source of truth for signed-in users.
  useEffect(() => {
    if (!isWorldId(profileWorld)) return;
    setWorldState(profileWorld);
    writeStored(WORLD_STORAGE_KEY, profileWorld);
  }, [profileWorld]);

  // Another tab switched world.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === WORLD_STORAGE_KEY && isWorldId(event.newValue)) {
        setWorldState(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setWorld = useCallback((next: WorldId) => {
    if (!isWorldId(next) || next === worldRef.current) return;
    // Write the attribute right away rather than waiting for the next render.
    applyWorldAttribute(next);
    worldRef.current = next;
    setWorldState(next);
    writeStored(WORLD_STORAGE_KEY, next);
    onWorldChangeRef.current?.(next);
  }, []);

  const value = useMemo<WorldContextValue>(
    () => ({ world, worlds: WORLD_IDS, setWorld }),
    [world, setWorld],
  );

  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>;
}

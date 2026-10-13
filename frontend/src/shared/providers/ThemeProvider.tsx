import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  CANDY_POP,
  DEFAULT_THEME_ID,
  STARTER_THEMES,
  THEME_STORAGE_KEY,
  ThemeContext,
  WORLD_IDS,
  WORLD_TOKENS,
  readStored,
  themeVariableName,
  writeStored,
  type ThemeContextValue,
  type ThemeDefinition,
} from "@/shared/hooks/useWorld";

export interface ThemeProviderProps {
  children: ReactNode;
  /** Purchasable or admin-published themes, already validated upstream (contrast checks live in AD-18). */
  themes?: readonly ThemeDefinition[] | undefined;
  /** The theme id saved on the user's profile (`profiles.equipped_theme`). Wins over localStorage. */
  profileThemeId?: string | null | undefined;
  /** Called when the user applies a theme, so the owner of profile settings can save it. */
  onThemeChange?: ((id: string) => void) | undefined;
}

const MORPH_MS = 600;
/* GSAP "power2.inOut" (spec §8.2 "morph") expressed as a CSS curve. */
const MORPH_EASE = "cubic-bezier(0.455, 0.03, 0.515, 0.955)";
const STYLE_ELEMENT_ID = "alhikmah-world-runtime";
const MORPH_FLAG = "data-world-morph";

/**
 * Registering `--world-<token>` as `<color>` is what lets the browser interpolate them.
 * Initial values match tokens.css so nothing changes if a world is not applied yet.
 */
const INITIAL_VALUES: Record<(typeof WORLD_TOKENS)[number], string> = {
  main: "#ffb84d",
  tint: "#fff1e3",
  soft: "#ffd93d",
  pop: "#2fd6a3",
  deep: "#8f4300",
};

function buildRuntimeCss(): string {
  const properties = WORLD_TOKENS.map(
    (token) =>
      `@property --world-${token} { syntax: "<color>"; inherits: true; initial-value: ${INITIAL_VALUES[token]}; }`,
  ).join("\n");

  const mappings = WORLD_IDS.map((world) => {
    const declarations = WORLD_TOKENS.map(
      (token) => `--world-${token}: var(${themeVariableName(world, token)});`,
    ).join(" ");
    return `:root[data-world="${world}"], [data-world="${world}"] { ${declarations} }`;
  }).join("\n");

  const transitioned = WORLD_TOKENS.map(
    (token) => `--world-${token} var(--world-morph-duration) var(--world-morph-ease)`,
  ).join(", ");

  return [
    properties,
    `:root { --world-morph-duration: ${MORPH_MS}ms; --world-morph-ease: ${MORPH_EASE}; }`,
    mappings,
    // Gated on the flag so the very first paint (reload) never animates.
    `:root[${MORPH_FLAG}], :root[${MORPH_FLAG}] [data-world] { transition: ${transitioned}; }`,
  ].join("\n");
}

const RUNTIME_CSS = buildRuntimeCss();

/**
 * Owns the active theme (a full re-skin: all world palettes at once). Writes the palettes as
 * `--w-<world>-<token>` variables on `<html>`, maps them to `--world-<token>` per `[data-world]`,
 * and animates `--world-*` between values so every consumer of those variables morphs.
 */
export function ThemeProvider({
  children,
  themes,
  profileThemeId,
  onThemeChange,
}: ThemeProviderProps) {
  const registry = useMemo(() => {
    const byId = new Map<string, ThemeDefinition>();
    for (const theme of [...STARTER_THEMES, ...(themes ?? [])]) {
      if (!byId.has(theme.id)) byId.set(theme.id, theme);
    }
    return byId;
  }, [themes]);

  // Held as an id, not a theme, so a stored purchased theme resolves once its definition loads.
  const [themeId, setThemeId] = useState<string>(
    () => profileThemeId ?? readStored(THEME_STORAGE_KEY) ?? DEFAULT_THEME_ID,
  );

  const theme = useMemo(
    () => registry.get(themeId) ?? registry.get(DEFAULT_THEME_ID) ?? CANDY_POP,
    [registry, themeId],
  );

  const registryRef = useRef(registry);
  const themeIdRef = useRef(themeId);
  const onThemeChangeRef = useRef(onThemeChange);
  useLayoutEffect(() => {
    registryRef.current = registry;
    themeIdRef.current = themeId;
    onThemeChangeRef.current = onThemeChange;
  });

  // Runtime stylesheet + the flag that enables transitions after the first paint.
  useLayoutEffect(() => {
    const style = document.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = RUNTIME_CSS;
    document.head.appendChild(style);

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        document.documentElement.setAttribute(MORPH_FLAG, "");
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      document.documentElement.removeAttribute(MORPH_FLAG);
      style.remove();
    };
  }, []);

  // Apply every world palette at once.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const names: string[] = [];
    for (const world of WORLD_IDS) {
      for (const token of WORLD_TOKENS) {
        const name = themeVariableName(world, token);
        root.style.setProperty(name, theme.worlds[world][token]);
        names.push(name);
      }
    }
    return () => {
      for (const name of names) root.style.removeProperty(name);
    };
  }, [theme]);

  // The profile is the source of truth for signed-in users.
  useEffect(() => {
    if (!profileThemeId) return;
    setThemeId(profileThemeId);
    writeStored(THEME_STORAGE_KEY, profileThemeId);
  }, [profileThemeId]);

  // Another tab applied a theme.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY && event.newValue) {
        setThemeId(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setTheme = useCallback((id: string) => {
    if (!registryRef.current.has(id) || id === themeIdRef.current) return;
    themeIdRef.current = id;
    setThemeId(id);
    writeStored(THEME_STORAGE_KEY, id);
    onThemeChangeRef.current?.(id);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, themes: Array.from(registry.values()), setTheme }),
    [theme, registry, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

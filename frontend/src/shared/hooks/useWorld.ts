import { createContext, useContext } from "react";

/* ========================================
   World + theme model (GLOBAL-STYLES-SPEC §3 and §4)
   Shared by WorldProvider and ThemeProvider. Lives here because
   `react-refresh/only-export-components` forbids non-component
   exports from the provider .tsx files.
   ======================================== */

/** The six color worlds. Skill mapping follows tokens.css. */
export const WORLD_IDS = ["coral", "amber", "mint", "sky", "violet", "rose"] as const;
export type WorldId = (typeof WORLD_IDS)[number];

/** Nearest of the six to the "Learn" (Sunshine) area world, which is the app default. */
export const DEFAULT_WORLD: WorldId = "amber";

export function isWorldId(value: unknown): value is WorldId {
  return typeof value === "string" && (WORLD_IDS as readonly string[]).includes(value);
}

/** The five tokens every world defines (spec §3.2). */
export const WORLD_TOKENS = ["main", "tint", "soft", "pop", "deep"] as const;
export type WorldToken = (typeof WORLD_TOKENS)[number];
export type WorldPalette = Record<WorldToken, string>;

/** A theme is a complete replacement set of world palettes (spec §4). */
export interface ThemeDefinition {
  id: string;
  name: string;
  worlds: Record<WorldId, WorldPalette>;
}

export const WORLD_STORAGE_KEY = "alhikmah.world";
export const THEME_STORAGE_KEY = "alhikmah.theme";
export const DEFAULT_THEME_ID = "candy-pop";

/** Name of the per-world variable a theme writes: `--w-<world>-<token>`. */
export function themeVariableName(world: WorldId, token: WorldToken): string {
  return `--w-${world}-${token}`;
}

/* ---------- Free starter themes ---------- */

/** "Candy Pop": values taken verbatim from spec §3.2 for the six skill worlds. */
export const CANDY_POP: ThemeDefinition = {
  id: DEFAULT_THEME_ID,
  name: "Candy Pop",
  worlds: {
    // Translation (Lime)
    coral: { main: "#b6e83c", tint: "#f4fbdd", soft: "#ddf39a", pop: "#9b7bff", deep: "#4a6600" },
    // Writing (Tangerine)
    amber: { main: "#ff9a3d", tint: "#fff1e3", soft: "#ffd3a6", pop: "#2fd6a3", deep: "#8f4300" },
    // Listening (Mint)
    mint: { main: "#35dca8", tint: "#e6fbf3", soft: "#b5f0da", pop: "#ff6fa5", deep: "#0b6b4b" },
    // Reading (Sky)
    sky: { main: "#4db8ff", tint: "#e8f6ff", soft: "#bce4ff", pop: "#ff7a59", deep: "#0b5c99" },
    // Grammar (Blueberry)
    violet: { main: "#7c8cff", tint: "#ecefff", soft: "#c9cfff", pop: "#ffb84d", deep: "#2b3499" },
    // Vocabulary (Bubblegum)
    rose: { main: "#ff6fa5", tint: "#ffedf4", soft: "#ffc7dc", pop: "#ffd93d", deep: "#9b1b52" },
  },
};

function mixWithWhite(hex: string, amount: number): string {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return `#${channels
    .map((c) =>
      Math.round(c + (255 - c) * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function soften(palette: WorldPalette): WorldPalette {
  return {
    ...palette,
    main: mixWithWhite(palette.main, 0.28),
    pop: mixWithWhite(palette.pop, 0.28),
  };
}

/**
 * "Sorbet": the same system with softer, more pastel mains (spec §4).
 * Mains and pops are Candy Pop blended 28% toward white; lightening can only
 * raise ink-on-main contrast, and tint/soft/deep are unchanged.
 */
export const SORBET: ThemeDefinition = {
  id: "sorbet",
  name: "Sorbet",
  worlds: {
    coral: soften(CANDY_POP.worlds.coral),
    amber: soften(CANDY_POP.worlds.amber),
    mint: soften(CANDY_POP.worlds.mint),
    sky: soften(CANDY_POP.worlds.sky),
    violet: soften(CANDY_POP.worlds.violet),
    rose: soften(CANDY_POP.worlds.rose),
  },
};

export const STARTER_THEMES: readonly ThemeDefinition[] = [CANDY_POP, SORBET];

/* ---------- Storage (localStorage may be blocked, e.g. private mode) ---------- */

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage blocked: the preference simply won't persist across reloads.
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked or full: the preference simply won't persist across reloads.
  }
}

/* ---------- Contexts and hooks ---------- */

export interface WorldContextValue {
  /** The active world, mirrored on `<html data-world>`. */
  world: WorldId;
  /** All selectable worlds, in display order. */
  worlds: readonly WorldId[];
  /** Switch world: updates `data-world` immediately, persists, and notifies the profile owner. */
  setWorld: (next: WorldId) => void;
}

export const WorldContext = createContext<WorldContextValue | null>(null);

export function useWorld(): WorldContextValue {
  const value = useContext(WorldContext);
  if (!value) {
    throw new Error("useWorld must be used inside <WorldProvider>");
  }
  return value;
}

export interface ThemeContextValue {
  /** The resolved active theme (falls back to Candy Pop if the stored id is unknown). */
  theme: ThemeDefinition;
  /** Every selectable theme: starters plus any supplied to the provider. */
  themes: readonly ThemeDefinition[];
  /** Apply a theme by id with a world-morph; no-op for unknown ids. */
  setTheme: (id: string) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return value;
}

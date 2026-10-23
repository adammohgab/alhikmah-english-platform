import { createContext, useContext } from "react";

/* ========================================
   Sound model (GLOBAL-STYLES-SPEC §8.8 "Sound system")
   Shared by SoundProvider and every component that plays a sound.
   ======================================== */

/** The sprite names defined in assets/audio/sprites.json. */
export const SOUND_NAMES = [
  "click",
  "success",
  "fanfare",
  "coin",
  "whoosh",
  "buzz",
  "pop",
] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

/** Shape of assets/audio/sprites.json. Sprite values are Howler's [startMs, durationMs]. */
export interface SpriteManifest {
  /** Audio file names, most preferred format first, found in assets/audio. */
  src: readonly string[];
  sprite: Record<SoundName, readonly [number, number]>;
}

/** Master volume default and ON by default (spec §8.8). */
export const DEFAULT_VOLUME = 0.35;
export const SOUND_STORAGE_KEY = "alhikmah.sound";

/** The same sound is never retriggered faster than this (spec §8.8 rate limit). */
export const MIN_REPEAT_GAP_MS = 80;

export interface SoundSettings {
  /** Master volume, 0 to 1. */
  volume: number;
  muted: boolean;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = { volume: DEFAULT_VOLUME, muted: false };

export function clampVolume(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
}

/** Reads saved settings; anything missing or malformed falls back to the defaults. */
export function readSoundSettings(): SoundSettings {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(SOUND_STORAGE_KEY);
  } catch {
    // Storage blocked: settings simply won't persist across reloads.
  }
  if (!raw) return DEFAULT_SOUND_SETTINGS;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_SOUND_SETTINGS;
    const { volume, muted } = parsed as Record<string, unknown>;
    return {
      volume: typeof volume === "number" ? clampVolume(volume) : DEFAULT_SOUND_SETTINGS.volume,
      muted: typeof muted === "boolean" ? muted : DEFAULT_SOUND_SETTINGS.muted,
    };
  } catch {
    // Corrupt saved value: use the defaults and overwrite it on the next change.
    return DEFAULT_SOUND_SETTINGS;
  }
}

export function writeSoundSettings(settings: SoundSettings): void {
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked or full: settings simply won't persist across reloads.
  }
}

export interface SoundContextValue {
  /**
   * Plays a sprite. Does nothing (silently) while muted, before the first user gesture,
   * while the audio is still loading, or when no audio file exists.
   */
  play: (name: SoundName) => void;
  /** Master volume, 0 to 1. */
  volume: number;
  setVolume: (volume: number) => void;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;
}

const SILENT_SOUND_CONTEXT: SoundContextValue = {
  play: () => undefined,
  volume: DEFAULT_VOLUME,
  setVolume: () => undefined,
  muted: false,
  setMuted: () => undefined,
  toggleMute: () => undefined,
};

export const SoundContext = createContext<SoundContextValue>(SILENT_SOUND_CONTEXT);

export function useSound(): SoundContextValue {
  return useContext(SoundContext);
}

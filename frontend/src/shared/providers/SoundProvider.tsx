import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Howl, Howler } from "howler";
import spritesJson from "@/assets/audio/sprites.json";
import {
  MIN_REPEAT_GAP_MS,
  SoundContext,
  clampVolume,
  readSoundSettings,
  writeSoundSettings,
  type SoundContextValue,
  type SoundName,
  type SoundSettings,
  type SpriteManifest,
} from "@/shared/hooks/useSound";

/* JSON imports type arrays as number[], so the [start, duration] tuples need this one cast. */
const manifest = spritesJson as unknown as SpriteManifest;

/*
 * Audio files found in src/assets/audio, as URLs. With no files the object is empty, so the
 * app stays silent without making a single (404) request. Files are bundled as assets, never
 * inlined into JS.
 */
const audioFiles = import.meta.glob<string>("../../assets/audio/*.{webm,mp3,ogg,m4a,wav}", {
  query: "?url",
  import: "default",
  eager: true,
});

interface ResolvedSources {
  src: string[];
  /* Explicit formats, because a hashed or inlined asset URL may not end in the file extension. */
  format: string[];
}

function resolveSources(): ResolvedSources {
  const resolved: ResolvedSources = { src: [], format: [] };
  for (const name of manifest.src) {
    const key = Object.keys(audioFiles).find((path) => path.endsWith(`/${name}`));
    const url = key === undefined ? undefined : audioFiles[key];
    if (url === undefined) continue;
    resolved.src.push(url);
    resolved.format.push(name.slice(name.lastIndexOf(".") + 1).toLowerCase());
  }
  return resolved;
}

type HowlerGlobal = typeof Howler;

interface AudioEngine {
  howl: Howl;
  howler: HowlerGlobal;
}

export interface SoundProviderProps {
  children: ReactNode;
}

/**
 * Arcade sound effects from one Howler audio sprite. Howler is loaded lazily and only after
 * the first pointer or key event, so no AudioContext exists before a user gesture and the
 * browser's autoplay policy never logs a warning. Volume and mute persist in localStorage.
 * With no audio files, a failed load or a blocked storage, everything degrades to silence.
 */
export function SoundProvider({ children }: SoundProviderProps) {
  const [settings, setSettings] = useState<SoundSettings>(readSoundSettings);

  const settingsRef = useRef(settings);
  const engineRef = useRef<AudioEngine | null>(null);
  const lastPlayedRef = useRef<Partial<Record<SoundName, number>>>({});
  useLayoutEffect(() => {
    settingsRef.current = settings;
  });

  // Push volume and mute to Howler (master controls: they affect every sound at once).
  const applyToEngine = useCallback((next: SoundSettings) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.howler.volume(next.volume);
    engine.howler.mute(next.muted || document.hidden);
  }, []);

  // Unlock on the first pointer or key event, then load Howler and the sprite.
  useEffect(() => {
    let disposed = false;

    const load = async () => {
      const { src, format } = resolveSources();
      if (src.length === 0) return; // No audio assets: stay silent.

      const { Howl: HowlClass, Howler: howler } = await import("howler");
      if (disposed) return;

      const howl: Howl = new HowlClass({
        src,
        format,
        sprite: { ...manifest.sprite } as Record<string, [number, number]>,
        preload: true,
        onloaderror: () => {
          // Missing or undecodable audio: fall back to silence.
          howl.unload();
          if (engineRef.current?.howl === howl) engineRef.current = null;
        },
      });
      engineRef.current = { howl, howler };
      applyToEngine(settingsRef.current);
    };

    const events = ["pointerdown", "keydown"] as const;
    const unlock = () => {
      for (const event of events) window.removeEventListener(event, unlock, true);
      void load();
    };
    for (const event of events) window.addEventListener(event, unlock, true);

    return () => {
      disposed = true;
      for (const event of events) window.removeEventListener(event, unlock, true);
      engineRef.current?.howl.unload();
      engineRef.current = null;
    };
  }, [applyToEngine]);

  // A hidden tab is muted automatically; the user's own mute choice is restored on return.
  useEffect(() => {
    const onVisibility = () => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.howler.mute(document.hidden || settingsRef.current.muted);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const update = useCallback(
    (patch: Partial<SoundSettings>) => {
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      applyToEngine(next); // Instant: do not wait for a render.
      setSettings(next);
      writeSoundSettings(next);
    },
    [applyToEngine],
  );

  const setVolume = useCallback(
    (volume: number) => {
      update({ volume: clampVolume(volume) });
    },
    [update],
  );
  const setMuted = useCallback(
    (muted: boolean) => {
      update({ muted });
    },
    [update],
  );
  const toggleMute = useCallback(() => {
    update({ muted: !settingsRef.current.muted });
  }, [update]);

  const play = useCallback((name: SoundName) => {
    const engine = engineRef.current;
    if (!engine || settingsRef.current.muted || document.hidden) return;
    if (engine.howl.state() !== "loaded") return; // Never queue a sound to play late.

    const now = performance.now();
    const last = lastPlayedRef.current[name];
    if (last !== undefined && now - last < MIN_REPEAT_GAP_MS) return;
    lastPlayedRef.current[name] = now;

    engine.howl.play(name);
  }, []);

  const value = useMemo<SoundContextValue>(
    () => ({
      play,
      volume: settings.volume,
      setVolume,
      muted: settings.muted,
      setMuted,
      toggleMute,
    }),
    [play, settings.volume, settings.muted, setVolume, setMuted, toggleMute],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

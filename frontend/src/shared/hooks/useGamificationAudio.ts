import { useCallback, useEffect, useMemo, useRef } from "react";
import spritesJson from "@/assets/audio/sprites.json";
import { useSound, type SoundName, type SpriteManifest } from "./useSound";

/* ========================================
   useGamificationAudio (GLOBAL-STYLES-SPEC 8.8 "Sound system", task STU-GAM-16)

   Named arcade cues for gamification moments (coins, streak, quest, chest, badge, level up),
   built by layering the sprites SoundProvider already ships. Pure utility: it renders nothing
   and never touches UI; callers invoke a cue when the event happens.

   Polyphony without clipping. Cues are short sequences of sprites, each started after its own
   delay. Every start goes through one small scheduler per hook that
     - keeps at most MAX_VOICES sounds ringing together (one more is allowed for the fanfare),
       and drops a quiet layer instead of stacking it on a full mix,
     - never restarts a fanfare that is still playing, so a celebration is not cut off or doubled,
     - spaces any two starts by at least MIN_START_GAP_MS, so attacks do not pile into one spike.
   Master volume stays Howler's (the provider's setting); no layer is ever louder than a single
   sprite.

   Mute is honored in two places: `play` from SoundProvider is a no-op while muted or hidden and
   mutes Howler's master output at once (so a sound already ringing goes silent immediately),
   and this hook cancels every cue still waiting on a timer the moment mute turns on.
   ======================================== */

const manifest = spritesJson as unknown as SpriteManifest;

const MAX_VOICES = 3;
const MIN_START_GAP_MS = 60;

/** Sound that must never be doubled while it rings. */
const EXCLUSIVE: SoundName = "fanfare";

interface Step {
  sound: SoundName;
  /** Milliseconds after the cue is triggered. */
  at: number;
}

const durationOf = (sound: SoundName): number => manifest.sprite[sound][1];

export interface GamificationAudio {
  /** Coins gained: a ding, or a short run of dings for bigger amounts (1 / 25+ / 100+). */
  coinGain: (amount?: number) => void;
  /** The streak continued today: a bright ding with a coin sparkle. */
  streakContinued: () => void;
  /** A quest reached its target: pop, then success. */
  questComplete: () => void;
  /** Chest sequence: shake whoosh, pop open, fanfare, coin shower. */
  chestOpen: () => void;
  /** A badge was awarded: pop, success and a coin sparkle. */
  badgeAwarded: () => void;
  /** Level up: whoosh into the fanfare, then a coin shower over its tail. */
  levelUp: () => void;
  /** The plain celebration fanfare. */
  fanfare: () => void;
  /** Cancels every cue still waiting to start. */
  stopAll: () => void;
}

function coinSteps(amount: number): Step[] {
  const dings = amount >= 100 ? 3 : amount >= 25 ? 2 : 1;
  return Array.from({ length: dings }, (_, index) => ({ sound: "coin", at: index * 110 }));
}

export function useGamificationAudio(): GamificationAudio {
  const { play, muted } = useSound();

  const playRef = useRef(play);
  useEffect(() => {
    playRef.current = play;
  }, [play]);

  const timers = useRef(new Set<number>());
  const voices = useRef<Array<{ sound: SoundName; endsAt: number }>>([]);
  const lastStart = useRef(Number.NEGATIVE_INFINITY);

  const stopAll = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current.clear();
  }, []);

  // `schedule` and `start` call each other (a start that is too close to the last one waits),
  // so the timer callback reaches `start` through a ref.
  const startRef = useRef<(sound: SoundName) => void>(() => undefined);

  const schedule = useCallback((sound: SoundName, delay: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      startRef.current(sound);
    }, delay);
    timers.current.add(id);
  }, []);

  const start = useCallback(
    (sound: SoundName) => {
      const now = performance.now();
      voices.current = voices.current.filter((voice) => voice.endsAt > now);

      if (sound === EXCLUSIVE && voices.current.some((voice) => voice.sound === EXCLUSIVE)) return;
      const limit = sound === EXCLUSIVE ? MAX_VOICES + 1 : MAX_VOICES;
      if (voices.current.length >= limit) return;

      const wait = lastStart.current + MIN_START_GAP_MS - now;
      if (wait > 0) {
        schedule(sound, wait);
        return;
      }
      lastStart.current = now;
      voices.current.push({ sound, endsAt: now + durationOf(sound) });
      playRef.current(sound);
    },
    [schedule],
  );

  useEffect(() => {
    startRef.current = start;
  }, [start]);

  const run = useCallback(
    (steps: readonly Step[]) => {
      for (const step of steps) {
        if (step.at <= 0) start(step.sound);
        else schedule(step.sound, step.at);
      }
    },
    [schedule, start],
  );

  // Mute silences active voices in SoundProvider, so they must no longer occupy scheduler slots.
  useEffect(() => {
    if (!muted) return;
    stopAll();
    voices.current = [];
    lastStart.current = Number.NEGATIVE_INFINITY;
  }, [muted, stopAll]);

  useEffect(() => stopAll, [stopAll]);

  return useMemo<GamificationAudio>(
    () => ({
      coinGain: (amount = 1) => run(coinSteps(amount)),
      streakContinued: () =>
        run([
          { sound: "success", at: 0 },
          { sound: "coin", at: 140 },
        ]),
      questComplete: () =>
        run([
          { sound: "pop", at: 0 },
          { sound: "success", at: 100 },
        ]),
      chestOpen: () =>
        run([
          { sound: "whoosh", at: 0 },
          { sound: "pop", at: 650 },
          { sound: "fanfare", at: 800 },
          { sound: "coin", at: 1200 },
          { sound: "coin", at: 1330 },
        ]),
      badgeAwarded: () =>
        run([
          { sound: "pop", at: 0 },
          { sound: "success", at: 110 },
          { sound: "coin", at: 280 },
        ]),
      levelUp: () =>
        run([
          { sound: "whoosh", at: 0 },
          { sound: "fanfare", at: 160 },
          { sound: "coin", at: 1100 },
          { sound: "coin", at: 1230 },
          { sound: "coin", at: 1360 },
        ]),
      fanfare: () => run([{ sound: "fanfare", at: 0 }]),
      stopAll,
    }),
    [run, stopAll],
  );
}

/* eslint-disable react-refresh/only-export-components -- pure scoring helpers are exported for tests; this file owns them */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Mic, Pause, Play, RotateCcw, Square, Volume2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import { Button } from "@/shared/components/ui/Button";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { SegmentedControl } from "@/shared/components/ui/SegmentedControl";
import { useSound } from "@/shared/hooks/useSound";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   Pronunciation trainer (task STU-GAM-15)

   1. Listen: the model voice comes from the `tts-synthesize` edge function (British or American,
      normal speed or 0.75x). The slow version is synthesized slowly on the server, so it keeps the
      pitch of a real slow voice instead of a deepened, stretched recording.
   2. Record: the microphone is captured with MediaRecorder (so the student can replay themselves)
      while an AnalyserNode drives a live waveform. The waveform bars are moved straight on the DOM
      from requestAnimationFrame, so there is no React render per frame and the motion stays smooth.
   3. Score: the browser's speech recognition (SpeechRecognition, set to en-GB or en-US) listens to
      the same take. Its best alternative is aligned word by word with the target and scored on
      spelling similarity and on a phonetic key of each word, then lightly weighted by the
      recognizer's own confidence. The score is an estimate of how recognizable the speech was, and
      it is explained to the student that way.

   Browsers without SpeechRecognition (for example Firefox) can still record and replay; the score
   is replaced by a clear notice.
   ======================================== */

/* ---------- pure helpers ---------- */

export type Accent = "british" | "american";

export const ACCENT_LANG: Record<Accent, string> = { british: "en-GB", american: "en-US" };
export const NORMAL_SPEED = 1;
export const SLOW_SPEED = 0.75;
export const MAX_RECORDING_SECONDS = 15;

export type WordStatus = "correct" | "close" | "missed";

export interface WordResult {
  /** Target word, normalized (lower case, no punctuation). */
  word: string;
  /** What the recognizer heard in that position, or null when the word was skipped. */
  heard: string | null;
  /** 0 to 1. */
  similarity: number;
  status: WordStatus;
}

export interface SpokenAlternative {
  transcript: string;
  /** 0 to 1, or null when the browser does not report one. */
  confidence: number | null;
}

export interface PronunciationResult {
  /** 0 to 100. */
  accuracy: number;
  label: string;
  words: WordResult[];
  /** The transcript the score is based on. */
  heard: string;
  accent: Accent;
}

/** Lower case, no accents or punctuation, apostrophes removed ("don't" is "dont"). */
export function normalizeWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word !== "");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = (previous[j - 1] ?? 0) + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1);
      const deletion = (previous[j] ?? 0) + 1;
      const insertion = (row[j - 1] ?? 0) + 1;
      row.push(Math.min(substitution, deletion, insertion));
    }
    previous = row;
  }
  return previous[b.length] ?? 0;
}

/** 1 for identical strings, 0 for nothing in common. */
export function textSimilarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
}

const isVowel = (ch: string): boolean => ch.length === 1 && "aeiou".includes(ch);
const inSet = (set: string, ch: string): boolean => ch.length === 1 && set.includes(ch);

/**
 * A compact, Metaphone-style consonant skeleton of an English word, so that words that are spelled
 * differently but sound alike get partial credit ("nite" and "night"). It is built from spelling
 * rules, not from a pronunciation dictionary, so it is an approximation. Voiced and unvoiced
 * consonants stay distinct ("bed" is not "bet"). Vowels are dropped except at the start.
 */
export function phoneticKey(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w === "") return "";

  if (/^(kn|gn|pn|ps|wr)/.test(w)) w = w.slice(1);
  else if (w.startsWith("wh")) w = `w${w.slice(2)}`;
  else if (w.startsWith("x")) w = `s${w.slice(1)}`;

  let key = "";
  for (let i = 0; i < w.length; i += 1) {
    const c = w.charAt(i);
    const prev = w.charAt(i - 1);
    const next = w.charAt(i + 1);
    const next2 = w.charAt(i + 2);
    const last = i === w.length - 1;

    if (c === prev && c !== "c") continue;

    switch (c) {
      case "a":
      case "e":
      case "i":
      case "o":
      case "u":
        if (i === 0) key += "A";
        break;
      case "b":
        if (!(prev === "m" && last)) key += "B";
        break;
      case "c":
        if (next === "h") {
          key += "X";
          i += 1;
        } else if (next === "k") {
          key += "K";
          i += 1;
        } else if (next === "i" && next2 === "a") {
          key += "X";
        } else if (inSet("eiy", next)) {
          key += "S";
        } else {
          key += "K";
        }
        break;
      case "d":
        if (next === "g" && inSet("eiy", next2)) {
          key += "J";
          i += 2;
        } else {
          key += "D";
        }
        break;
      case "g":
        if (next === "h") {
          if (i === 0) {
            key += "G";
            i += 1;
          } else if (isVowel(next2)) {
            key += "G";
            i += 1;
          } else {
            i += 1; // silent "gh" as in "night" or "though"
          }
        } else if (next === "n" && i + 1 === w.length - 1) {
          // silent "g" in a word-final "gn" as in "sign"
        } else if (inSet("eiy", next)) {
          key += "J";
        } else {
          key += "G";
        }
        break;
      case "h":
        if (isVowel(next) && !inSet("cgpst", prev)) key += "H";
        break;
      case "k":
        key += "K";
        break;
      case "p":
        if (next === "h") {
          key += "F";
          i += 1;
        } else {
          key += "P";
        }
        break;
      case "q":
        key += "K";
        break;
      case "s":
        if (next === "h") {
          key += "X";
          i += 1;
        } else if (next === "i" && (next2 === "o" || next2 === "a")) {
          key += "X";
        } else if (next === "c" && next2 === "h") {
          key += "SK";
          i += 2;
        } else {
          key += "S";
        }
        break;
      case "t":
        if (next === "h") {
          key += "0";
          i += 1;
        } else if (next === "i" && (next2 === "o" || next2 === "a")) {
          key += "X";
        } else if (next === "c" && next2 === "h") {
          key += "X";
          i += 2;
        } else {
          key += "T";
        }
        break;
      case "w":
        if (isVowel(next)) key += "W";
        break;
      case "x":
        key += "KS";
        break;
      case "y":
        if (isVowel(next)) key += "Y";
        break;
      default:
        // f, j, l, m, n, r, v, z (and digits) stand for themselves
        key += c.toUpperCase();
    }
  }
  return key;
}

/**
 * How close one heard word is to the target word, 0 to 1. An exact match is 1. Anything else is
 * the better of spelling similarity and (discounted) phonetic similarity, then squared, so a near
 * miss is "close" but never counts as a pass.
 */
export function wordSimilarity(target: string, heard: string): number {
  if (target === heard) return 1;
  const targetKey = phoneticKey(target);
  const heardKey = phoneticKey(heard);
  const phonetic =
    targetKey === "" || heardKey === "" ? 0 : textSimilarity(targetKey, heardKey) * 0.7;
  const best = Math.max(textSimilarity(target, heard), phonetic);
  return best * best;
}

export function statusFor(similarity: number): WordStatus {
  if (similarity >= 0.85) return "correct";
  if (similarity >= 0.4) return "close";
  return "missed";
}

export function scoreLabel(accuracy: number): string {
  if (accuracy >= 90) return "Excellent";
  if (accuracy >= 75) return "Good";
  if (accuracy >= 50) return "Getting there";
  return "Keep practising";
}

/**
 * Aligns the target words with the heard words (edit-distance alignment where substituting a
 * similar word is cheap). `matches[i]` is the index of the heard word for target word `i`, or
 * null when it was skipped; `extras` counts heard words that matched nothing.
 */
export function alignWords(
  target: readonly string[],
  heard: readonly string[],
): { matches: Array<number | null>; extras: number } {
  const n = target.length;
  const m = heard.length;
  const width = m + 1;
  const table = new Float64Array((n + 1) * width);
  const get = (i: number, j: number): number => table[i * width + j] ?? 0;
  const substitution = (i: number, j: number): number =>
    1 - wordSimilarity(target[i - 1] ?? "", heard[j - 1] ?? "");

  for (let i = 1; i <= n; i += 1) table[i * width] = i;
  for (let j = 1; j <= m; j += 1) table[j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      table[i * width + j] = Math.min(
        get(i - 1, j - 1) + substitution(i, j),
        get(i - 1, j) + 1,
        get(i, j - 1) + 1,
      );
    }
  }

  const matches: Array<number | null> = Array.from({ length: n }, () => null);
  let extras = 0;
  let i = n;
  let j = m;
  const EPSILON = 1e-9;
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      Math.abs(get(i, j) - (get(i - 1, j - 1) + substitution(i, j))) < EPSILON
    ) {
      matches[i - 1] = j - 1;
      i -= 1;
      j -= 1;
    } else if (i > 0 && Math.abs(get(i, j) - (get(i - 1, j) + 1)) < EPSILON) {
      i -= 1;
    } else {
      extras += 1;
      j -= 1;
    }
  }
  return { matches, extras };
}

/**
 * Scores what the recognizer heard against the target. Every alternative the browser returned is
 * tried and the best one counts, because the recognizer's top guess is sometimes a different word
 * than the student actually said. Returns null when there is nothing to score.
 */
export function scoreAttempt(
  target: string,
  alternatives: readonly SpokenAlternative[],
  accent: Accent,
): PronunciationResult | null {
  const targetWords = normalizeWords(target);
  if (targetWords.length === 0) return null;

  let best: PronunciationResult | null = null;
  let bestTotal = -1;
  for (const alternative of alternatives) {
    const spoken = normalizeWords(alternative.transcript);
    if (spoken.length === 0) continue;

    const { matches, extras } = alignWords(targetWords, spoken);
    const words: WordResult[] = targetWords.map((word, index) => {
      const spokenIndex = matches[index];
      const heard =
        spokenIndex === null || spokenIndex === undefined ? null : (spoken[spokenIndex] ?? null);
      const similarity = heard === null ? 0 : wordSimilarity(word, heard);
      return { word, heard, similarity, status: statusFor(similarity) };
    });

    const raw =
      words.reduce((sum, entry) => sum + entry.similarity, 0) / (targetWords.length + 0.5 * extras);
    const confidence =
      alternative.confidence === null ? 1 : Math.min(1, Math.max(0, alternative.confidence));
    const total = raw * (0.85 + 0.15 * confidence);

    if (total > bestTotal) {
      bestTotal = total;
      const accuracy = Math.max(0, Math.min(100, Math.round(total * 100)));
      best = {
        accuracy,
        label: scoreLabel(accuracy),
        words,
        heard: alternative.transcript.trim(),
        accent,
      };
    }
  }
  return best;
}

/**
 * Builds one transcript per alternative rank from the final results of a recognition session
 * (a long phrase can arrive as several final results). A confidence of 0 is how some browsers say
 * "unknown", so it is reported as null.
 */
export function collectAlternatives(
  finals: ReadonlyArray<ReadonlyArray<{ transcript: string; confidence: number }>>,
): SpokenAlternative[] {
  const ranks = Math.max(0, ...finals.map((result) => result.length));
  const alternatives: SpokenAlternative[] = [];
  for (let rank = 0; rank < ranks; rank += 1) {
    const parts = finals
      .map((result) => result[rank] ?? result[0])
      .filter((part): part is { transcript: string; confidence: number } => part !== undefined);
    const known = parts.filter((part) => part.confidence > 0);
    alternatives.push({
      transcript: parts
        .map((part) => part.transcript.trim())
        .join(" ")
        .trim(),
      confidence:
        known.length === 0
          ? null
          : known.reduce((sum, part) => sum + part.confidence, 0) / known.length,
    });
  }
  return alternatives;
}

export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** First recording format this browser supports (Safari records mp4, Chrome and Firefox webm). */
export function pickMimeType(isSupported: (type: string) => boolean): string | undefined {
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(
    isSupported,
  );
}

/* ---------- browser speech recognition (not in lib.dom) ---------- */

interface RecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}
interface RecognitionResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  readonly [index: number]: RecognitionAlternativeLike | undefined;
}
interface RecognitionEventLike {
  readonly results: {
    readonly length: number;
    readonly [index: number]: RecognitionResultLike | undefined;
  };
}
interface RecognitionErrorEventLike {
  readonly error: string;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionConstructor = new () => RecognitionLike;

export function getSpeechRecognition(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/* ---------- model audio (tts-synthesize edge function) ---------- */

const ttsResponse = z.object({ audioUrl: z.string().min(1) });

/* Signed URLs last an hour (backend spec section 2); refresh well before that. */
const AUDIO_URL_TTL_MS = 50 * 60 * 1000;

async function fetchModelAudioUrl(text: string, accent: Accent, speed: number): Promise<string> {
  const response = await supabase.functions.invoke<unknown>("tts-synthesize", {
    body: { text, accent, speed, format: "mp3" },
  });
  if (response.error) throw new Error(normalizeApiError(response.error).message);
  const parsed = ttsResponse.safeParse(response.data);
  if (!parsed.success) throw new Error("The pronunciation service returned an unexpected answer.");
  return parsed.data.audioUrl;
}

/* ---------- waveform ---------- */

const WAVE_BARS = 40;
const WAVE_MID = 20;
const WAVE_MAX_HEIGHT = 36;
const WAVE_MIN_HEIGHT = 2;

function flattenBars(bars: ReadonlyArray<SVGRectElement | null>) {
  for (const bar of bars) {
    bar?.setAttribute("height", String(WAVE_MIN_HEIGHT));
    bar?.setAttribute("y", String(WAVE_MID - WAVE_MIN_HEIGHT / 2));
  }
}

/* ---------- component ---------- */

export interface PronunciationTrainerProps {
  /** The word or short phrase to practise (the speech service accepts up to 1000 characters). */
  text: string;
  /** Phonetic spelling shown under the word, for example "/ˈkɒf.i/". Display only. */
  phonetic?: string | undefined;
  /** Voice and recognition accent to start with. Default British. */
  defaultAccent?: Accent | undefined;
  /** Called once each time a recording has been scored. */
  onScored?: ((result: PronunciationResult) => void) | undefined;
  className?: string | undefined;
}

type Phase = "idle" | "recording" | "scoring" | "done";
type ModelState = "idle" | "loading" | "playing";

const ACCENT_OPTIONS = [
  { value: "british", label: "British" },
  { value: "american", label: "American" },
] as const;

const STATUS_STYLE: Record<WordStatus, { box: string; glyph: string; spoken: string }> = {
  correct: { box: "border-success-600 bg-success-100", glyph: "✓", spoken: "correct" },
  close: { box: "border-stroke bg-[var(--world-soft,#ffd93d)]", glyph: "≈", spoken: "close" },
  missed: { box: "border-danger-600 bg-danger-100", glyph: "✗", spoken: "missed" },
};

export function PronunciationTrainer({
  text,
  phonetic,
  defaultAccent = "british",
  onScored,
  className,
}: PronunciationTrainerProps) {
  const headingId = useId();
  const { play } = useSound();

  const [accent, setAccent] = useState<Accent>(defaultAccent);
  const [slow, setSlow] = useState(false);
  const [modelState, setModelState] = useState<ModelState>("idle");
  const [modelError, setModelError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [heardLive, setHeardLive] = useState("");
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);

  const speechSupported = useMemo(() => getSpeechRecognition() !== null, []);

  /* Latest props and phase for callbacks that outlive a render (recognizer events, timers). */
  const latest = useRef({ text, accent, onScored, play });
  useLayoutEffect(() => {
    latest.current = { text, accent, onScored, play };
  });
  const phaseRef = useRef<Phase>("idle");
  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const modelAudio = useRef<HTMLAudioElement | null>(null);
  const modelToken = useRef(0);
  const urlCache = useRef(new Map<string, { url: string; at: number }>());

  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioContext = useRef<AudioContext | null>(null);
  const frame = useRef(0);
  const bars = useRef<Array<SVGRectElement | null>>([]);
  const startedAt = useRef(0);
  const recognition = useRef<RecognitionLike | null>(null);
  const finals = useRef<RecognitionResultLike[]>([]);
  const recognitionError = useRef<string | null>(null);
  const finished = useRef(true);
  const scoreTimer = useRef(0);
  const replayAudio = useRef<HTMLAudioElement | null>(null);

  /* ----- model audio ----- */

  const stopModel = useCallback(() => {
    modelToken.current += 1;
    const audio = modelAudio.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    }
    modelAudio.current = null;
    setModelState("idle");
  }, []);

  const playModel = useCallback(async () => {
    stopModel();
    const token = modelToken.current;
    const speed = slow ? SLOW_SPEED : NORMAL_SPEED;
    const cacheKey = `${accent}|${speed}|${text}`;
    setModelError(null);
    setModelState("loading");
    try {
      const cached = urlCache.current.get(cacheKey);
      let url = cached && Date.now() - cached.at < AUDIO_URL_TTL_MS ? cached.url : null;
      if (url === null) {
        url = await fetchModelAudioUrl(text, accent, speed);
        urlCache.current.set(cacheKey, { url, at: Date.now() });
      }
      if (token !== modelToken.current) return; // stopped or replaced while loading

      const audio = new Audio(url);
      modelAudio.current = audio;
      audio.onended = () => {
        if (token === modelToken.current) setModelState("idle");
      };
      audio.onerror = () => {
        if (token !== modelToken.current) return;
        urlCache.current.delete(cacheKey);
        setModelError("The model pronunciation could not be played. Try again.");
        setModelState("idle");
      };
      await audio.play();
      if (token === modelToken.current) setModelState("playing");
    } catch (error) {
      if (token !== modelToken.current) return;
      setModelError(
        error instanceof Error && error.name !== "NotAllowedError"
          ? error.message
          : "Your browser blocked the audio. Tap Listen again.",
      );
      setModelState("idle");
    }
  }, [accent, slow, stopModel, text]);

  /* ----- capture teardown ----- */

  const releaseCapture = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void audioContext.current?.close().catch(() => undefined);
    audioContext.current = null;
    flattenBars(bars.current);
  }, []);

  /** Stops everything without touching React state (used on unmount and before a reset). */
  const abortCapture = useCallback(() => {
    window.clearTimeout(scoreTimer.current);
    finished.current = true;
    const rec = recorder.current;
    if (rec) {
      rec.ondataavailable = null;
      rec.onstop = null;
      if (rec.state !== "inactive") rec.stop();
    }
    recorder.current = null;
    const recognizer = recognition.current;
    if (recognizer) {
      recognizer.onresult = null;
      recognizer.onerror = null;
      recognizer.onend = null;
      recognizer.abort();
    }
    recognition.current = null;
    replayAudio.current?.pause();
    replayAudio.current = null;
    releaseCapture();
  }, [releaseCapture]);

  const resetAttempt = useCallback(() => {
    abortCapture();
    stopModel();
    chunks.current = [];
    finals.current = [];
    recognitionError.current = null;
    phaseRef.current = "idle";
    setPhase("idle");
    setElapsed(0);
    setHeardLive("");
    setResult(null);
    setMicError(null);
    setNotice(null);
    setRecordingUrl(null);
    setReplaying(false);
  }, [abortCapture, stopModel]);

  // A new word or accent starts a fresh attempt; unmounting releases the microphone.
  useEffect(() => {
    resetAttempt();
  }, [text, accent, resetAttempt]);
  useEffect(
    () => () => {
      abortCapture();
      modelToken.current += 1;
      modelAudio.current?.pause();
    },
    [abortCapture],
  );
  useEffect(
    () => () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    },
    [recordingUrl],
  );

  /* ----- scoring ----- */

  const finishScoring = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    window.clearTimeout(scoreTimer.current);

    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();

    const alternatives = collectAlternatives(
      finals.current.map((entry) =>
        Array.from({ length: entry.length }, (_, index) => entry[index]).filter(
          (alt): alt is RecognitionAlternativeLike => alt !== undefined,
        ),
      ),
    );
    const { text: target, accent: spokenAccent, onScored: report, play: sound } = latest.current;
    const scored = scoreAttempt(target, alternatives, spokenAccent);
    const failure = recognitionError.current;

    if (scored) {
      setResult(scored);
      report?.(scored);
      if (scored.accuracy >= 80) sound("success");
    } else if (failure === "not-allowed" || failure === "service-not-allowed") {
      setMicError(
        "Speech scoring is blocked. Allow the microphone and speech recognition in your browser, then try again.",
      );
    } else if (failure === "network") {
      setMicError("Speech scoring needs an internet connection. Check it and try again.");
    } else if (failure === "audio-capture") {
      setMicError("No microphone was found. Connect one and try again.");
    } else {
      setNotice("We didn't hear a word. Move closer to the microphone and try again.");
    }
    setHeardLive("");
    changePhase("done");
    releaseCapture();
  }, [changePhase, releaseCapture]);

  const stopRecording = useCallback(() => {
    if (phaseRef.current !== "recording") return;
    const recognizer = recognition.current;
    if (recognizer) {
      changePhase("scoring");
      try {
        recognizer.stop();
      } catch {
        finishScoring();
        return;
      }
      // The recognizer normally ends by itself; this guards against one that never does.
      scoreTimer.current = window.setTimeout(finishScoring, 5000);
    } else {
      finished.current = true;
      const rec = recorder.current;
      if (rec && rec.state !== "inactive") rec.stop();
      releaseCapture();
      changePhase("done");
    }
  }, [changePhase, finishScoring, releaseCapture]);

  // Clock: ticks while recording and ends the take at the limit.
  useEffect(() => {
    if (phase !== "recording") return undefined;
    const timer = window.setInterval(() => {
      const seconds = (performance.now() - startedAt.current) / 1000;
      setElapsed(Math.min(seconds, MAX_RECORDING_SECONDS));
      if (seconds >= MAX_RECORDING_SECONDS) stopRecording();
    }, 100);
    return () => {
      window.clearInterval(timer);
    };
  }, [phase, stopRecording]);

  /* ----- recording ----- */

  const startRecording = async () => {
    if (phaseRef.current === "recording" || phaseRef.current === "scoring") return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicError("Recording is not supported in this browser. Try Chrome, Edge or Safari.");
      return;
    }
    stopModel();
    setMicError(null);
    setNotice(null);
    setResult(null);
    setRecordingUrl(null);
    setReplaying(false);
    replayAudio.current?.pause();
    replayAudio.current = null;

    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setMicError(
        name === "NotFoundError"
          ? "No microphone was found. Connect one and try again."
          : "Microphone access was blocked. Allow it in your browser settings to practise speaking.",
      );
      return;
    }

    try {
      stream.current = media;
      chunks.current = [];
      finals.current = [];
      recognitionError.current = null;
      finished.current = false;

      const mimeType = pickMimeType((type) => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = rec;
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType !== "" ? rec.mimeType : (mimeType ?? "audio/webm");
        const clip = new Blob(chunks.current, { type });
        if (clip.size > 0) setRecordingUrl(URL.createObjectURL(clip));
      };

      // Live waveform: one bar per slice of the microphone signal, eased so it never jitters.
      const Context =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Context) {
        const context = new Context();
        audioContext.current = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(media).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        const levels = new Float32Array(WAVE_BARS);
        const slice = Math.floor(samples.length / WAVE_BARS);
        const draw = () => {
          analyser.getByteTimeDomainData(samples);
          for (let bar = 0; bar < WAVE_BARS; bar += 1) {
            let peak = 0;
            for (let k = 0; k < slice; k += 1) {
              const deviation = Math.abs((samples[bar * slice + k] ?? 128) - 128) / 128;
              if (deviation > peak) peak = deviation;
            }
            const target = Math.min(1, peak * 2.5);
            const current = levels[bar] ?? 0;
            // Quick attack, slow release.
            const eased = current + (target - current) * (target > current ? 0.5 : 0.12);
            levels[bar] = eased;
            const height = Math.max(WAVE_MIN_HEIGHT, eased * WAVE_MAX_HEIGHT);
            const element = bars.current[bar];
            element?.setAttribute("height", height.toFixed(2));
            element?.setAttribute("y", (WAVE_MID - height / 2).toFixed(2));
          }
          frame.current = requestAnimationFrame(draw);
        };
        frame.current = requestAnimationFrame(draw);
      }

      // Speech recognition listens to the same take, in the chosen accent.
      const Recognition = getSpeechRecognition();
      if (Recognition) {
        const recognizer = new Recognition();
        recognizer.lang = ACCENT_LANG[latest.current.accent];
        recognizer.continuous = false;
        recognizer.interimResults = true;
        recognizer.maxAlternatives = 3;
        recognizer.onresult = (event) => {
          const done: RecognitionResultLike[] = [];
          let interim = "";
          for (const entry of event.results as unknown as RecognitionResultLike[]) {
            if (!entry) continue;
            if (entry.isFinal) done.push(entry);
            else interim += `${entry[0]?.transcript ?? ""} `;
          }
          finals.current = done;
          setHeardLive(interim.trim());
        };
        recognizer.onerror = (event) => {
          if (event.error !== "aborted") recognitionError.current = event.error;
        };
        recognizer.onend = () => {
          // It also ends by itself once the student stops talking.
          if (phaseRef.current === "recording") changePhase("scoring");
          finishScoring();
        };
        recognition.current = recognizer;
        try {
          recognizer.start();
        } catch {
          recognition.current = null;
          setNotice("Speech scoring could not start, so this take is recorded without a score.");
        }
      }

      rec.start();
      startedAt.current = performance.now();
      setElapsed(0);
      changePhase("recording");
    } catch {
      abortCapture();
      setMicError("The recording could not start. Reload the page and try again.");
    }
  };

  /* ----- replay of the student's own take ----- */

  const toggleReplay = () => {
    if (!recordingUrl) return;
    if (replayAudio.current && !replayAudio.current.paused) {
      replayAudio.current.pause();
      return;
    }
    const audio = replayAudio.current ?? new Audio(recordingUrl);
    audio.onplay = () => setReplaying(true);
    audio.onpause = () => setReplaying(false);
    audio.onended = () => setReplaying(false);
    audio.onerror = () => {
      setReplaying(false);
      setMicError("Your recording could not be played back.");
    };
    replayAudio.current = audio;
    stopModel();
    audio.currentTime = 0;
    void audio.play().catch(() => {
      setReplaying(false);
      setMicError("Your browser blocked playback. Tap Play my recording again.");
    });
  };

  /* ----- render ----- */

  const recording = phase === "recording";
  const scoring = phase === "scoring";
  const remaining = MAX_RECORDING_SECONDS - elapsed;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col gap-4 rounded-[20px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-muted">Say this out loud</p>
          <p
            id={headingId}
            dir="ltr"
            lang={ACCENT_LANG[accent]}
            className="font-display break-words text-3xl font-extrabold leading-tight text-stroke"
          >
            {text}
          </p>
          {phonetic && (
            <p dir="ltr" className="mt-1 text-lg text-muted">
              {phonetic}
            </p>
          )}
        </div>
        <SegmentedControl
          aria-label="Accent"
          options={ACCENT_OPTIONS}
          value={accent}
          onValueChange={(value) => {
            if (value === "british" || value === "american") setAccent(value);
          }}
        />
      </div>

      {/* Listen */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => (modelState === "playing" ? stopModel() : void playModel())}
          loading={modelState === "loading"}
          disabled={recording || scoring}
        >
          {modelState === "playing" ? (
            <>
              <Pause size={18} aria-hidden="true" /> Stop
            </>
          ) : (
            <>
              <Volume2 size={18} aria-hidden="true" /> Listen
            </>
          )}
        </Button>
        <button
          type="button"
          aria-pressed={slow}
          disabled={recording || scoring}
          onClick={() => setSlow((value) => !value)}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-[12px] border-2 border-stroke px-4 font-heading text-[15px] font-semibold leading-none text-stroke",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke",
            "disabled:cursor-not-allowed disabled:border-dashed disabled:bg-surface-200 disabled:text-muted",
            slow
              ? "bg-[var(--world-main,#ffb84d)] shadow-retro-sm"
              : "bg-surface-0 shadow-[2px_2px_0_0_var(--stroke,#1a1530)]",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "grid h-4 w-4 place-items-center rounded-[4px] border-2 border-stroke text-[10px]",
              slow ? "bg-stroke text-surface-0" : "bg-surface-0",
            )}
          >
            {slow ? "✓" : ""}
          </span>
          Slow (0.75×)
        </button>
      </div>
      {modelError && (
        <p
          role="alert"
          className="rounded-[10px] border-2 border-danger-600 bg-danger-100 px-3 py-2 text-sm font-bold text-stroke"
        >
          {modelError}
        </p>
      )}

      {/* Record */}
      <div className="flex flex-col gap-3">
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          role="img"
          aria-label={recording ? "Live microphone waveform" : "Microphone waveform"}
          data-testid="pronunciation-waveform"
          className="h-14 w-full rounded-[10px] border-2 border-stroke bg-surface-100"
        >
          {Array.from({ length: WAVE_BARS }, (_, index) => {
            const width = 100 / WAVE_BARS;
            return (
              <rect
                key={index}
                ref={(element) => {
                  bars.current[index] = element;
                }}
                x={index * width + width * 0.15}
                y={WAVE_MID - WAVE_MIN_HEIGHT / 2}
                width={width * 0.7}
                height={WAVE_MIN_HEIGHT}
                rx={0.4}
                className={
                  recording ? "fill-[var(--world-main,#ffb84d)]" : "fill-[var(--ink,#1a1a2e)]"
                }
                opacity={recording ? 1 : 0.4}
              />
            );
          })}
        </svg>

        <div className="flex flex-wrap items-center gap-3">
          {recording ? (
            <Button variant="danger" onClick={stopRecording}>
              <Square size={18} aria-hidden="true" /> Stop
            </Button>
          ) : (
            <Button onClick={() => void startRecording()} loading={scoring}>
              <Mic size={18} aria-hidden="true" /> {phase === "done" ? "Record again" : "Record"}
            </Button>
          )}
          <output
            aria-live="off"
            data-testid="pronunciation-clock"
            className="rounded-[10px] border-2 border-stroke bg-surface-0 px-2 py-0.5 text-sm font-extrabold tabular-nums"
          >
            {formatClock(elapsed)} / {formatClock(MAX_RECORDING_SECONDS)}
          </output>
          {recording && (
            <span role="status" className="text-sm font-bold">
              Recording… {formatClock(remaining)} left
            </span>
          )}
          {scoring && (
            <span role="status" className="text-sm font-bold">
              Checking your pronunciation…
            </span>
          )}
        </div>

        {recording && heardLive !== "" && (
          <p dir="ltr" className="text-sm text-muted">
            Hearing: “{heardLive}”
          </p>
        )}
        {!speechSupported && (
          <p className="rounded-[10px] border-2 border-dashed border-stroke px-3 py-2 text-sm text-muted">
            This browser can record you but cannot score speech. Use Chrome, Edge or Safari for an
            accuracy score, or play your recording back and compare it by ear.
          </p>
        )}
        {micError && (
          <p
            role="alert"
            className="rounded-[10px] border-2 border-danger-600 bg-danger-100 px-3 py-2 text-sm font-bold text-stroke"
          >
            {micError}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-[10px] border-2 border-stroke px-3 py-2 text-sm font-bold"
          >
            {notice}
          </p>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="flex flex-col gap-3 rounded-[16px] border-2 border-stroke bg-[var(--world-tint,#fff1e3)] p-3">
          <div role="status" className="flex items-baseline gap-3">
            <span
              data-testid="pronunciation-accuracy"
              className="font-display text-4xl font-extrabold tabular-nums text-stroke"
            >
              {result.accuracy}%
            </span>
            <span className="font-heading text-lg font-semibold text-stroke">{result.label}</span>
          </div>
          <ProgressBar
            value={result.accuracy}
            label="Pronunciation accuracy"
            valueText={`${result.accuracy} percent, ${result.label}`}
          />
          <ul className="flex flex-wrap gap-2" aria-label="Word by word">
            {result.words.map((entry, index) => {
              const style = STATUS_STYLE[entry.status];
              return (
                <li
                  key={`${entry.word}-${index}`}
                  dir="ltr"
                  className={cn("rounded-[10px] border-2 px-3 py-1 text-stroke", style.box)}
                >
                  <span aria-hidden="true" className="mr-1 font-extrabold">
                    {style.glyph}
                  </span>
                  <span className="font-heading font-semibold">{entry.word}</span>
                  <span className="sr-only"> ({style.spoken})</span>
                  {entry.status !== "correct" && (
                    <span className="block text-xs">
                      {entry.heard ? `heard “${entry.heard}”` : "not heard"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p dir="ltr" className="text-sm text-muted">
            We heard: “{result.heard}”. The score estimates how clearly a speech recogniser
            understood you, so a different accent or a noisy room can lower it.
          </p>
        </div>
      )}

      {recordingUrl && phase === "done" && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={toggleReplay}>
            {replaying ? (
              <>
                <Pause size={18} aria-hidden="true" /> Pause
              </>
            ) : (
              <>
                <Play size={18} aria-hidden="true" /> Play my recording
              </>
            )}
          </Button>
          <Button variant="ghost" onClick={resetAttempt}>
            <RotateCcw size={18} aria-hidden="true" /> Clear
          </Button>
        </div>
      )}
    </section>
  );
}

export default PronunciationTrainer;

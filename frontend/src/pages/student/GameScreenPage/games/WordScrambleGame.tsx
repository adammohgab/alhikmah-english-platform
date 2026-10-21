import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Check, RotateCcw, Volume2 } from "lucide-react";

export interface ScrambleWord {
  word: string;
  hint?: string;
  pronunciation?: string;
}

export interface WordScrambleGameResult {
  score: number;
  correct: number;
  attempted: number;
  accuracy: number;
  elapsedSeconds: number;
  bestCombo: number;
}

export interface WordScrambleGameProps {
  isActive?: boolean;
  durationSeconds?: number;
  words?: ScrambleWord[];
  onScoreChange?: (score: number) => void;
  onComboChange?: (combo: number) => void;
  onComplete?: (result: WordScrambleGameResult) => void;
}

const DEFAULT_WORDS: ScrambleWord[] = [
  { word: "planet", hint: "A large object that travels around a star." },
  { word: "garden", hint: "A place where flowers or vegetables grow." },
  { word: "bright", hint: "Giving out lots of light." },
  { word: "journey", hint: "A trip from one place to another." },
  { word: "whisper", hint: "To speak very quietly." },
  { word: "curious", hint: "Eager to learn or know something." },
  { word: "library", hint: "A place where you can borrow books." },
  { word: "picture", hint: "An image or drawing." },
  { word: "rainbow", hint: "A colourful arc seen after rain." },
  { word: "teacher", hint: "A person who helps students learn." },
];

function normalizedDuration(seconds: number): number {
  return Number.isFinite(seconds) ? Math.max(1, Math.floor(seconds)) : 60;
}

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function shuffleLetters(word: string): string[] {
  const letters = word.toUpperCase().split("");
  if (new Set(letters).size < 2) return letters;

  const original = letters.join("");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    for (let index = letters.length - 1; index > 0; index -= 1) {
      const otherIndex = Math.floor(Math.random() * (index + 1));
      [letters[index], letters[otherIndex]] = [letters[otherIndex]!, letters[index]!];
    }
    if (letters.join("") !== original) return letters;
  }

  return [...letters.slice(1), letters[0]!];
}

function playCorrectSound(): void {
  if (typeof window === "undefined") return;
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(1175, context.currentTime + 0.09);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.23);
    window.setTimeout(() => void context.close(), 400);
  } catch (error) {
    console.warn("Word Scramble sound could not be played.", error);
  }
}

function speakWord(word: string): void {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) {
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn("Word pronunciation could not be played.", error);
  }
}

function canPlayPronunciation(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

export default function WordScrambleGame({
  isActive = true,
  durationSeconds = 60,
  words = DEFAULT_WORDS,
  onScoreChange,
  onComboChange,
  onComplete,
}: WordScrambleGameProps) {
  const duration = normalizedDuration(durationSeconds);
  const safeWords = useMemo(
    () => words.filter((item) => typeof item.word === "string" && item.word.trim().length > 1),
    [words],
  );
  const [wordIndex, setWordIndex] = useState(0);
  const [tileLetters, setTileLetters] = useState(() =>
    shuffleLetters((safeWords[0]?.word ?? DEFAULT_WORDS[0]!.word).trim()),
  );
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [remaining, setRemaining] = useState(duration);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [roundFinished, setRoundFinished] = useState(false);
  const completedRef = useRef(false);
  const remainingRef = useRef(duration);
  const currentWord = safeWords.length ? safeWords[wordIndex % safeWords.length] : DEFAULT_WORDS[0];
  const answer = currentWord!.word.trim().toUpperCase();
  const chosenWord = selectedIds.map((id) => tileLetters[id] ?? "").join("");
  const accuracy = attempted === 0 ? 0 : Math.round((correct / attempted) * 100);

  const finishRound = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setRoundFinished(true);
    onComplete?.({
      score,
      correct,
      attempted,
      accuracy: attempted === 0 ? 0 : Math.round((correct / attempted) * 100),
      elapsedSeconds: Math.max(0, duration - remaining),
      bestCombo,
    });
  }, [attempted, bestCombo, correct, duration, onComplete, remaining, score]);

  useEffect(() => {
    if (!isActive || roundFinished || safeWords.length === 0 || remainingRef.current === 0) return;
    const interval = window.setInterval(() => {
      setRemaining((time) => {
        if (time <= 1) {
          window.clearInterval(interval);
          remainingRef.current = 0;
          return 0;
        }
        remainingRef.current = time - 1;
        return remainingRef.current;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isActive, roundFinished, safeWords.length]);

  useEffect(() => {
    if (safeWords.length > 0 && remaining === 0 && !roundFinished) finishRound();
  }, [finishRound, remaining, roundFinished, safeWords.length]);

  useEffect(() => {
    onScoreChange?.(score);
  }, [onScoreChange, score]);

  useEffect(() => {
    onComboChange?.(combo);
  }, [combo, onComboChange]);

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  useEffect(() => {
    if (!feedback || !isActive || roundFinished) return;
    const timeout = window.setTimeout(
      () => {
        if (feedback.kind === "success") {
          const nextIndex = (wordIndex + 1) % safeWords.length;
          const nextWord = safeWords[nextIndex];
          setWordIndex(nextIndex);
          setTileLetters(shuffleLetters((nextWord?.word ?? DEFAULT_WORDS[0]!.word).trim()));
          setSelectedIds([]);
        }
        setFeedback(null);
      },
      feedback.kind === "success" ? 450 : 800,
    );
    return () => window.clearTimeout(timeout);
  }, [feedback, isActive, roundFinished, safeWords, wordIndex]);

  const insertTile = (tileId: number, slotIndex: number) => {
    setSelectedIds((current) => {
      const previousIndex = current.indexOf(tileId);
      const withoutTile = previousIndex === -1 ? current : current.filter((id) => id !== tileId);
      const insertionIndex = Math.max(0, Math.min(slotIndex, withoutTile.length));
      return [
        ...withoutTile.slice(0, insertionIndex),
        tileId,
        ...withoutTile.slice(insertionIndex),
      ];
    });
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>, slotIndex: number) => {
    event.preventDefault();
    if (!isActive || roundFinished || remaining === 0 || feedback) return;
    const tileId = Number(event.dataTransfer.getData("text/plain"));
    if (Number.isInteger(tileId) && tileId >= 0 && tileId < tileLetters.length) {
      insertTile(tileId, slotIndex);
    }
  };

  const submitAnswer = () => {
    if (
      roundFinished ||
      !isActive ||
      remaining === 0 ||
      feedback ||
      selectedIds.length !== answer.length
    ) {
      return;
    }
    setAttempted((value) => value + 1);
    if (chosenWord === answer) {
      const nextCombo = combo + 1;
      const earned = 10 + Math.min(combo, 10) * 2;
      setScore((value) => value + earned);
      setCombo(nextCombo);
      setBestCombo((value) => Math.max(value, nextCombo));
      setCorrect((value) => value + 1);
      playCorrectSound();
      setFeedback({ kind: "success", text: `Correct! +${earned} points` });
    } else {
      setCombo(0);
      setFeedback({ kind: "error", text: "Not quite — try again!" });
    }
  };

  const toggleTile = (tileId: number) => {
    if (!isActive || roundFinished || remaining === 0 || feedback) return;
    setSelectedIds((current) =>
      current.includes(tileId) ? current.filter((id) => id !== tileId) : [...current, tileId],
    );
  };

  const clearSelection = () => {
    if (!isActive || roundFinished || feedback) return;
    setSelectedIds([]);
  };

  if (!safeWords.length) {
    return (
      <p
        className="mx-auto max-w-2xl rounded-[20px] border-2 border-stroke bg-surface-0 p-6 text-center font-semibold shadow-retro-md"
        role="status"
      >
        No scramble words are available yet.
      </p>
    );
  }

  return (
    <section
      data-world="rose"
      className="mx-auto w-full max-w-3xl text-stroke"
      aria-label="Word Scramble game"
    >
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3" aria-label="Game statistics">
        <div className="rounded-[16px] border-2 border-stroke bg-world-rose-100 p-3 text-center shadow-retro-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Time left</p>
          <p
            className={`font-heading text-2xl font-bold tabular-nums ${remaining <= 10 ? "animate-pulse text-[#b3261e] motion-reduce:animate-none" : ""}`}
            aria-live="off"
          >
            {formatTime(remaining)}
          </p>
        </div>
        <div className="rounded-[16px] border-2 border-stroke bg-world-amber-200 p-3 text-center shadow-retro-sm">
          <p className="text-xs font-bold uppercase tracking-wide">Points</p>
          <p className="font-heading text-2xl font-bold tabular-nums" aria-live="polite">
            {score}
          </p>
        </div>
        <div className="rounded-[16px] border-2 border-stroke bg-world-mint-100 p-3 text-center shadow-retro-sm">
          <p className="text-xs font-bold uppercase tracking-wide">Accuracy</p>
          <p className="font-heading text-2xl font-bold tabular-nums">{accuracy}%</p>
        </div>
      </div>

      <div className="rounded-[24px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-md sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-1 font-heading text-xs font-bold uppercase tracking-[0.2em] text-world-rose-700">
              Word {wordIndex + 1}
            </p>
            <h2 className="font-heading text-2xl font-bold sm:text-3xl">Unscramble the letters</h2>
            <p className="mt-2 text-sm text-muted">
              Tap the letters in order or drag them into the answer slots.
            </p>
          </div>
          <button
            type="button"
            onClick={() => speakWord(currentWord!.pronunciation ?? currentWord!.word)}
            disabled={roundFinished || !isActive || !canPlayPronunciation()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-stroke bg-world-violet-100 px-3 font-heading font-bold shadow-retro-sm hover:bg-world-violet-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-stroke disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Hear word pronunciation"
          >
            <Volume2 size={18} aria-hidden="true" /> Hear word
          </button>
        </div>

        {currentWord!.hint && (
          <p className="mb-5 rounded-[14px] border-2 border-stroke bg-world-amber-100 p-3 text-sm">
            <strong>Hint:</strong> {currentWord!.hint}
          </p>
        )}

        <div
          className="mb-6 flex min-h-[4.5rem] flex-wrap items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-world-rose-500 bg-world-rose-50 p-3"
          aria-label={`Answer slots, ${selectedIds.length} of ${answer.length} letters selected`}
        >
          {Array.from({ length: answer.length }, (_, slotIndex) => {
            const tileId = selectedIds[slotIndex];
            return (
              <button
                key={`slot-${slotIndex}`}
                type="button"
                draggable={tileId !== undefined && !roundFinished && isActive && !feedback}
                onDragStart={(event) => {
                  if (tileId !== undefined) {
                    event.dataTransfer.setData("text/plain", String(tileId));
                    event.dataTransfer.effectAllowed = "move";
                  }
                }}
                onClick={() => tileId !== undefined && toggleTile(tileId)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, slotIndex)}
                disabled={roundFinished || !isActive || remaining === 0 || Boolean(feedback)}
                className={`grid h-12 w-10 place-items-center rounded-[10px] border-2 border-stroke text-xl font-bold focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-world-rose-700 sm:h-14 sm:w-12 ${tileId === undefined ? "bg-surface-0" : "bg-world-rose-200 shadow-retro-sm"} disabled:cursor-default`}
                aria-label={
                  tileId === undefined
                    ? `Empty answer slot ${slotIndex + 1}`
                    : `Remove ${tileLetters[tileId]} from answer slot ${slotIndex + 1}`
                }
              >
                {tileId === undefined ? "" : tileLetters[tileId]}
              </button>
            );
          })}
        </div>

        <div
          className="mb-6 flex flex-wrap justify-center gap-2"
          aria-label="Available letter tiles"
        >
          {tileLetters.map((letter, tileId) => {
            const selected = selectedIds.includes(tileId);
            return (
              <button
                key={`${wordIndex}-${tileId}`}
                type="button"
                draggable={!roundFinished && isActive && !selected && !feedback}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", String(tileId));
                  event.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => toggleTile(tileId)}
                disabled={
                  selected || roundFinished || !isActive || remaining === 0 || Boolean(feedback)
                }
                className={`grid h-12 w-11 place-items-center rounded-[10px] border-2 border-stroke font-heading text-xl font-bold transition motion-reduce:transition-none sm:h-14 sm:w-12 ${selected ? "bg-surface-200 opacity-50" : "bg-surface-0 shadow-retro-sm hover:-translate-y-0.5 hover:bg-world-amber-200"} focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-world-rose-700 disabled:cursor-not-allowed`}
                aria-label={`Letter ${letter}${selected ? ", already selected" : ""}`}
              >
                {letter}
              </button>
            );
          })}
        </div>

        <div
          className="mb-5 rounded-[12px] border-2 border-dashed border-transparent p-2 text-center text-xs text-muted focus-within:border-world-rose-500"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!isActive || roundFinished || remaining === 0 || feedback) return;
            const tileId = Number(event.dataTransfer.getData("text/plain"));
            if (Number.isInteger(tileId) && tileId >= 0 && tileId < tileLetters.length) {
              toggleTile(tileId);
            }
          }}
        >
          Drop a letter here or tap the tiles above
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={clearSelection}
            disabled={selectedIds.length === 0 || roundFinished || !isActive || Boolean(feedback)}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-stroke bg-surface-0 px-4 font-heading font-bold shadow-retro-sm hover:bg-world-violet-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-stroke disabled:opacity-50"
          >
            <RotateCcw size={17} aria-hidden="true" /> Clear
          </button>
          <button
            type="button"
            onClick={submitAnswer}
            disabled={
              selectedIds.length !== answer.length ||
              roundFinished ||
              !isActive ||
              remaining === 0 ||
              Boolean(feedback)
            }
            className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-stroke bg-world-rose-300 px-6 font-heading font-bold shadow-retro-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            <Check size={18} aria-hidden="true" /> Check word
          </button>
        </div>

        {feedback && (
          <p
            className={`mt-5 rounded-[14px] border-2 border-stroke p-3 text-center font-heading text-lg font-bold shadow-retro-sm ${feedback.kind === "success" ? "bg-world-mint-200" : "bg-world-amber-200"}`}
            role="status"
            aria-live="polite"
          >
            {feedback.text}
          </p>
        )}
      </div>

      {roundFinished && (
        <div
          className="mt-6 rounded-[24px] border-2 border-stroke bg-world-rose-200 p-6 text-center shadow-retro-md"
          role="status"
          aria-live="polite"
        >
          <p className="font-heading text-xs font-bold uppercase tracking-[0.2em]">
            Round complete!
          </p>
          <h3 className="my-2 font-heading text-3xl font-bold">{score} points</h3>
          <p className="font-semibold">
            {correct} correct · {attempted} attempts · {accuracy}% accuracy ·{" "}
            {Math.max(0, duration - remaining)}s elapsed
          </p>
        </div>
      )}
    </section>
  );
}

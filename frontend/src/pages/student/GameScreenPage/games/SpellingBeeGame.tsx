import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Volume2 } from "lucide-react";

export interface SpellingBeeGameResult {
  score: number;
  correct: number;
  attempted: number;
  accuracy: number;
  elapsedSeconds: number;
}

export interface SpellingBeeGameProps {
  isActive?: boolean;
  durationSeconds?: number;
  onScoreChange?: (score: number) => void;
  onComboChange?: (combo: number) => void;
  onComplete?: (result: SpellingBeeGameResult) => void;
}

const WORDS = [
  { word: "adventure", hint: "An exciting or unusual experience." },
  { word: "beautiful", hint: "Pleasant to look at." },
  { word: "knowledge", hint: "Information and skills gained by learning." },
  { word: "discover", hint: "To find something for the first time." },
  { word: "important", hint: "Having great meaning or value." },
  { word: "elephant", hint: "A large animal with a trunk." },
  { word: "calendar", hint: "A chart showing days, weeks, and months." },
];
const FALLBACK_WORD = WORDS[0] ?? {
  word: "adventure",
  hint: "An exciting or unusual experience.",
};

const hasSpeechSynthesis =
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  typeof SpeechSynthesisUtterance !== "undefined";

function speakWord(word: string) {
  if (!hasSpeechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.78;
  window.speechSynthesis.speak(utterance);
}

export default function SpellingBeeGame({
  isActive = true,
  durationSeconds = 60,
  onScoreChange,
  onComboChange,
  onComplete,
}: SpellingBeeGameProps) {
  const duration = Number.isFinite(durationSeconds) ? Math.max(0, Math.floor(durationSeconds)) : 60;
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [remaining, setRemaining] = useState(duration);
  const [feedback, setFeedback] = useState("");
  const done = useRef(false);
  const item = WORDS[index % WORDS.length] ?? FALLBACK_WORD;

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    if (hasSpeechSynthesis) window.speechSynthesis.cancel();
    onComplete?.({
      score,
      correct,
      attempted,
      accuracy: attempted === 0 ? 0 : Math.round((correct / attempted) * 100),
      elapsedSeconds: Math.max(0, duration - remaining),
    });
  }, [attempted, correct, duration, onComplete, remaining, score]);

  useEffect(() => {
    if (!isActive || done.current || remaining === 0) return;
    const interval = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isActive, remaining]);

  useEffect(() => {
    if (remaining === 0) finish();
  }, [finish, remaining]);

  useEffect(() => {
    onScoreChange?.(score);
  }, [onScoreChange, score]);

  useEffect(() => {
    onComboChange?.(combo);
  }, [combo, onComboChange]);

  useEffect(
    () => () => {
      if (hasSpeechSynthesis) window.speechSynthesis.cancel();
    },
    [],
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isActive || done.current || !answer.trim()) return;

    const isCorrect = answer.trim().toLowerCase() === item.word;
    setAttempted((value) => value + 1);
    if (isCorrect) {
      setScore((value) => value + 10 + combo * 2);
      setCorrect((value) => value + 1);
      setCombo((value) => value + 1);
      setFeedback("Correct! Great spelling.");
      setIndex((value) => value + 1);
      setAnswer("");
    } else {
      setCombo(0);
      setFeedback("Not quite. Listen again and try this word once more.");
    }
  };

  return (
    <section
      aria-label="Spelling Bee game"
      className="mx-auto w-full max-w-xl rounded-[24px] border-2 border-stroke bg-[var(--world-tint,#fff8db)] p-4 text-stroke shadow-[4px_4px_0px_#1a1530] sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="border-2 border-stroke bg-[var(--world-soft,#ffea94)] px-3 py-1 font-heading font-bold">
          Spelling Bee
        </span>
        <span aria-label={`${remaining} seconds remaining`} className="font-mono font-bold">
          {remaining}s
        </span>
      </div>

      <div className="mt-5 text-center">
        <h2 className="font-heading text-2xl font-bold">Listen, then spell the word</h2>
        <p className="mt-2 text-muted">Hint: {item.hint}</p>
        <button
          type="button"
          onClick={() => speakWord(item.word)}
          disabled={!isActive || !hasSpeechSynthesis || remaining === 0}
          className="mt-4 inline-flex min-h-12 items-center gap-2 border-2 border-stroke bg-[var(--world-main,#ffd23f)] px-5 font-heading font-bold shadow-[2px_2px_0px_#1a1530] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#315d13] active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Volume2 size={18} aria-hidden="true" />
          Hear the word
        </button>
        {!hasSpeechSynthesis && (
          <p className="mt-2 text-sm text-muted">
            Audio playback is not available in this browser.
          </p>
        )}
      </div>

      <form onSubmit={submit} className="mt-5 flex gap-2">
        <label className="sr-only" htmlFor="spelling-answer">
          Type the word you hear
        </label>
        <input
          id="spelling-answer"
          autoComplete="off"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          disabled={!isActive || remaining === 0 || done.current}
          className="min-h-12 min-w-0 flex-1 border-2 border-stroke bg-white px-4 text-lg tracking-wide outline-none focus-visible:ring-4 focus-visible:ring-[var(--world-pop,#4db8ff)] disabled:bg-[var(--world-tint,#fff8db)]"
          placeholder="Type the word…"
        />
        <button
          type="submit"
          disabled={!isActive || !answer.trim() || remaining === 0 || done.current}
          aria-label="Check spelling"
          className="grid min-h-12 min-w-12 place-items-center border-2 border-stroke bg-[#1fbf7a] px-3 shadow-[2px_2px_0px_#1a1530] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#0b6b45] active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check aria-hidden="true" />
        </button>
      </form>

      <p role="status" aria-live="polite" className="mt-3 min-h-6 text-center font-semibold">
        {feedback}
      </p>
      <div className="mt-3 flex flex-wrap justify-between gap-2 border-2 border-stroke bg-white p-3 text-sm">
        <span>
          Score <strong>{score}</strong>
        </span>
        <span>
          Combo <strong>{combo}</strong>
        </span>
        <span>
          Accuracy <strong>{attempted ? Math.round((correct / attempted) * 100) : 0}%</strong>
        </span>
      </div>

      {remaining === 0 && (
        <p
          role="status"
          className="mt-4 border-2 border-stroke bg-[var(--world-soft,#ffea94)] p-3 text-center font-bold"
        >
          Round complete! Score: {score}
        </p>
      )}
    </section>
  );
}

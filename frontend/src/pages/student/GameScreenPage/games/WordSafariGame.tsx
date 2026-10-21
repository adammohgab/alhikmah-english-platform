import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Target } from "lucide-react";

export interface WordSafariGameResult {
  score: number;
  correct: number;
  attempted: number;
  accuracy: number;
  elapsedSeconds: number;
}

export interface WordSafariGameProps {
  isActive?: boolean;
  durationSeconds?: number;
  onScoreChange?: (score: number) => void;
  onComboChange?: (combo: number) => void;
  onComplete?: (result: WordSafariGameResult) => void;
}

interface SafariRound {
  target: string;
  options: string[];
  hint: string;
  animal: string;
}

const FIRST_ROUND: SafariRound = {
  target: "LION",
  options: ["LION", "TREE", "RIVER", "CLOUD"],
  hint: "Find the animal known as the king of the jungle.",
  animal: "🦁",
};

const ROUNDS: SafariRound[] = [
  FIRST_ROUND,
  {
    target: "ZEBRA",
    options: ["GRASS", "ZEBRA", "WATER", "STONE"],
    hint: "Find the striped animal.",
    animal: "🦓",
  },
  {
    target: "MONKEY",
    options: ["MONKEY", "LEAF", "SUN", "ROCK"],
    hint: "Find the animal that loves to climb.",
    animal: "🐒",
  },
  {
    target: "GIRAFFE",
    options: ["BUSH", "GIRAFFE", "POND", "SAND"],
    hint: "Find the tallest land animal.",
    animal: "🦒",
  },
  {
    target: "TIGER",
    options: ["TIGER", "VINE", "LAKE", "FERN"],
    hint: "Find the big cat with dark stripes.",
    animal: "🐅",
  },
  {
    target: "PANDA",
    options: ["PANDA", "CAVE", "RAIN", "MOSS"],
    hint: "Find the black-and-white bear.",
    animal: "🐼",
  },
];

export default function WordSafariGame({
  isActive = true,
  durationSeconds = 60,
  onScoreChange,
  onComboChange,
  onComplete,
}: WordSafariGameProps) {
  const duration = Number.isFinite(durationSeconds) ? Math.max(0, Math.floor(durationSeconds)) : 60;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [remaining, setRemaining] = useState(duration);
  const [feedback, setFeedback] = useState("Spot the target word as it passes through the safari.");
  const [movementPaused, setMovementPaused] = useState(false);
  const done = useRef(false);
  const item = ROUNDS[round % ROUNDS.length] ?? FIRST_ROUND;

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
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

  const chooseWord = (word: string) => {
    if (!isActive || done.current || remaining === 0) return;
    setAttempted((value) => value + 1);
    if (word === item.target) {
      setScore((value) => value + 10 + combo * 2);
      setCombo((value) => value + 1);
      setCorrect((value) => value + 1);
      setFeedback(`Great spotting! You found ${item.target.toLowerCase()}.`);
      setRound((value) => value + 1);
    } else {
      setCombo(0);
      setFeedback(`Not that one. ${item.hint}`);
    }
  };

  return (
    <section
      aria-label="Word Safari game"
      className="mx-auto w-full max-w-2xl rounded-[24px] border-2 border-stroke bg-[var(--world-tint,#e9f9ea)] p-4 text-stroke shadow-[4px_4px_0px_#1a1530] sm:p-6"
    >
      <style>{`
        @keyframes safari-pass {
          from { left: -28%; }
          to { left: 108%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .safari-word { animation: none !important; left: 50% !important; transform: translate(-50%, -50%); }
        }
        .safari-word:focus-visible { animation-play-state: paused !important; left: 50% !important; transform: translate(-50%, -50%); }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="border-2 border-stroke bg-[var(--world-soft,#bfeec2)] px-3 py-1 font-heading font-bold">
          Word Safari
        </span>
        <div className="flex items-center gap-3">
          <span aria-label={`${remaining} seconds remaining`} className="font-mono font-bold">
            {remaining}s
          </span>
          <button
            type="button"
            aria-pressed={movementPaused}
            aria-label={movementPaused ? "Resume word movement" : "Pause word movement"}
            onClick={() => setMovementPaused((paused) => !paused)}
            className="inline-flex min-h-10 items-center gap-2 border-2 border-stroke bg-white px-3 font-bold focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#1b6a24]"
          >
            {movementPaused ? (
              <Play size={16} aria-hidden="true" />
            ) : (
              <Pause size={16} aria-hidden="true" />
            )}
            {movementPaused ? "Resume movement" : "Pause movement"}
          </button>
        </div>
      </div>

      <div className="mt-5 border-2 border-stroke bg-[var(--world-deep,#1b6a24)] p-4 text-center text-white sm:p-5">
        <div className="text-4xl" aria-hidden="true">
          {item.animal}
        </div>
        <h2 className="mt-2 font-heading text-2xl font-bold">Find: {item.target}</h2>
        <p className="mt-1 text-sm">{item.hint}</p>
      </div>

      <div
        aria-label="Passing word choices"
        className="relative mt-4 h-56 overflow-hidden border-2 border-stroke bg-[var(--world-soft,#bfeec2)]"
      >
        {item.options.map((word, index) => (
          <button
            key={`${round}-${word}`}
            type="button"
            aria-label={`Choose ${word}`}
            disabled={!isActive || remaining === 0 || done.current}
            onClick={() => chooseWord(word)}
            style={{
              top: `${12 + index * 22}%`,
              animationDelay: `${index * -0.9}s`,
              animationDuration: "4.2s",
              animationIterationCount: "infinite",
              animationName: "safari-pass",
              animationPlayState: movementPaused ? "paused" : "running",
              animationTimingFunction: "linear",
            }}
            className="safari-word absolute min-h-11 -translate-y-1/2 whitespace-nowrap border-2 border-stroke bg-white px-4 font-heading font-bold shadow-[2px_2px_0px_#1a1530] hover:bg-[var(--world-main,#5fd068)] focus-visible:z-10 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#1b6a24] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {word}
          </button>
        ))}
      </div>

      <p role="status" aria-live="polite" className="mt-4 min-h-6 text-center font-semibold">
        {feedback}
      </p>
      <div className="mt-3 flex flex-wrap justify-between gap-2 border-2 border-stroke bg-white p-3 text-sm">
        <span>
          Score <strong>{score}</strong>
        </span>
        <span>
          Combo <strong>{combo}</strong>
        </span>
        <span className="inline-flex items-center gap-1">
          <Target size={15} aria-hidden="true" />
          Accuracy <strong>{attempted ? Math.round((correct / attempted) * 100) : 0}%</strong>
        </span>
      </div>

      {remaining === 0 && (
        <p
          role="status"
          className="mt-4 border-2 border-stroke bg-[var(--world-soft,#bfeec2)] p-3 text-center font-bold"
        >
          Safari complete! Score: {score}
        </p>
      )}
    </section>
  );
}

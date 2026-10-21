import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, RotateCcw } from "lucide-react";

export interface SentenceBuilderGameResult {
  score: number;
  correct: number;
  attempted: number;
  accuracy: number;
  elapsedSeconds: number;
}

export interface SentenceBuilderGameProps {
  isActive?: boolean;
  durationSeconds?: number;
  onScoreChange?: (score: number) => void;
  onComboChange?: (combo: number) => void;
  onComplete?: (result: SentenceBuilderGameResult) => void;
}

interface WordTile {
  id: number;
  word: string;
}

const SENTENCES = [
  "The little cat is sleeping.",
  "We learn something new every day.",
  "My friends play in the park.",
  "She reads a book after school.",
  "Birds can fly across the sky.",
  "Please remember to drink water.",
];
const FALLBACK_SENTENCE = "The little cat is sleeping.";

function shuffleTiles(words: string[]): WordTile[] {
  const tiles = words.map((word, id) => ({ id, word }));
  for (let index = tiles.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    const currentTile = tiles[index];
    const otherTile = tiles[otherIndex];
    if (currentTile && otherTile) {
      tiles[index] = otherTile;
      tiles[otherIndex] = currentTile;
    }
  }
  if (tiles.length > 1 && tiles.every((tile, index) => tile.word === words[index])) {
    const firstTile = tiles[0];
    const secondTile = tiles[1];
    if (firstTile && secondTile) {
      tiles[0] = secondTile;
      tiles[1] = firstTile;
    }
  }
  return tiles;
}

export default function SentenceBuilderGame({
  isActive = true,
  durationSeconds = 60,
  onScoreChange,
  onComboChange,
  onComplete,
}: SentenceBuilderGameProps) {
  const duration = Number.isFinite(durationSeconds) ? Math.max(0, Math.floor(durationSeconds)) : 60;
  const [round, setRound] = useState(0);
  const [placedIds, setPlacedIds] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [remaining, setRemaining] = useState(duration);
  const [feedback, setFeedback] = useState(
    "Tap or focus a word and press Enter to build the sentence.",
  );
  const done = useRef(false);
  const target = (SENTENCES[round % SENTENCES.length] ?? FALLBACK_SENTENCE).replace(/[.!?]$/, "");
  const tiles = useMemo(() => shuffleTiles(target.split(" ")), [target]);
  const placedTiles = placedIds.flatMap((id) => {
    const tile = tiles.find((candidate) => candidate.id === id);
    return tile ? [tile] : [];
  });
  const placedSet = new Set(placedIds);

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

  const placeTile = (tileId: number) => {
    if (!isActive || done.current || remaining === 0 || placedSet.has(tileId)) return;
    setPlacedIds((current) => [...current, tileId]);
    setFeedback("");
  };

  const checkSentence = () => {
    if (!isActive || done.current || remaining === 0 || placedIds.length !== tiles.length) return;
    setAttempted((value) => value + 1);
    const submitted = placedTiles
      .map((tile) => tile.word)
      .join(" ")
      .toLowerCase();
    if (submitted === target.toLowerCase()) {
      setScore((value) => value + 10 + combo * 2);
      setCombo((value) => value + 1);
      setCorrect((value) => value + 1);
      setFeedback("Excellent sentence! You got it.");
      setRound((value) => value + 1);
      setPlacedIds([]);
    } else {
      setCombo(0);
      setFeedback("Almost! Rearrange the tiles or reset and try again.");
    }
  };

  return (
    <section
      aria-label="Sentence Builder game"
      className="mx-auto w-full max-w-2xl rounded-[24px] border-2 border-stroke bg-[var(--world-tint,#e8f6ff)] p-4 text-stroke shadow-[4px_4px_0px_#1a1530] sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="border-2 border-stroke bg-[var(--world-soft,#bce4ff)] px-3 py-1 font-heading font-bold">
          Sentence Builder
        </span>
        <span aria-label={`${remaining} seconds remaining`} className="font-mono font-bold">
          {remaining}s
        </span>
      </div>

      <h2 className="mt-5 text-center font-heading text-2xl font-bold">Build a sentence</h2>
      <p className="mt-1 text-center text-muted">Use every word tile in the correct order.</p>

      <div
        aria-label="Your sentence"
        className="mt-5 flex min-h-20 flex-wrap items-center justify-center gap-2 border-2 border-dashed border-stroke bg-white p-3"
      >
        {placedTiles.length > 0 ? (
          placedTiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              aria-label={`Remove ${tile.word} from your sentence`}
              disabled={!isActive || remaining === 0 || done.current}
              onClick={() => setPlacedIds((current) => current.filter((id) => id !== tile.id))}
              className="min-h-11 border-2 border-stroke bg-[var(--world-soft,#bce4ff)] px-3 py-2 font-semibold shadow-[2px_2px_0px_#1a1530] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#0b5c99] disabled:opacity-50"
            >
              {tile.word} <span aria-hidden="true">×</span>
            </button>
          ))
        ) : (
          <span className="text-sm text-muted">Your sentence goes here…</span>
        )}
      </div>

      <div aria-label="Available word tiles" className="mt-4 flex flex-wrap justify-center gap-2">
        {tiles.map((tile) => (
          <button
            key={`${round}-${tile.id}`}
            type="button"
            disabled={!isActive || remaining === 0 || done.current || placedSet.has(tile.id)}
            onClick={() => placeTile(tile.id)}
            className="min-h-12 border-2 border-stroke bg-white px-4 py-2 font-heading font-bold shadow-[2px_2px_0px_#1a1530] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#0b5c99] active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tile.word}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            setPlacedIds([]);
            setFeedback("Tiles reset. Try a new order.");
          }}
          disabled={!isActive || placedIds.length === 0 || remaining === 0 || done.current}
          className="inline-flex min-h-11 items-center gap-2 border-2 border-stroke bg-white px-4 font-bold shadow-[2px_2px_0px_#1a1530] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#0b5c99] disabled:opacity-40"
        >
          <RotateCcw size={16} aria-hidden="true" /> Reset
        </button>
        <button
          type="button"
          onClick={checkSentence}
          disabled={
            !isActive || placedIds.length !== tiles.length || remaining === 0 || done.current
          }
          className="inline-flex min-h-11 items-center gap-2 border-2 border-stroke bg-[#1fbf7a] px-5 font-bold shadow-[2px_2px_0px_#1a1530] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#0b6b45] disabled:opacity-40"
        >
          <Check size={16} aria-hidden="true" /> Check sentence
        </button>
      </div>

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
          className="mt-4 border-2 border-stroke bg-[var(--world-soft,#bce4ff)] p-3 text-center font-bold"
        >
          Round complete! Score: {score}
        </p>
      )}
    </section>
  );
}

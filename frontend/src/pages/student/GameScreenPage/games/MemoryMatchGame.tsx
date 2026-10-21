import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Trophy } from "lucide-react";

export interface MemoryMatchGameResult {
  score: number;
  correct: number;
  attempted: number;
  accuracy: number;
  elapsedSeconds: number;
}

export interface MemoryMatchGameProps {
  isActive?: boolean;
  durationSeconds?: number;
  onScoreChange?: (score: number) => void;
  onComboChange?: (combo: number) => void;
  onComplete?: (result: MemoryMatchGameResult) => void;
}

interface Card {
  id: number;
  pair: string;
  emoji: string;
  matched: boolean;
}

const PAIRS = [
  { pair: "lion", emoji: "🦁" },
  { pair: "fox", emoji: "🦊" },
  { pair: "frog", emoji: "🐸" },
  { pair: "panda", emoji: "🐼" },
  { pair: "owl", emoji: "🦉" },
  { pair: "turtle", emoji: "🐢" },
];

function makeCards(): Card[] {
  const cards = [...PAIRS, ...PAIRS].map((item, id) => ({
    id,
    pair: item.pair,
    emoji: item.emoji,
    matched: false,
  }));
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    const currentCard = cards[index];
    const otherCard = cards[otherIndex];
    if (currentCard && otherCard) {
      cards[index] = otherCard;
      cards[otherIndex] = currentCard;
    }
  }
  return cards;
}

export default function MemoryMatchGame({
  isActive = true,
  durationSeconds = 60,
  onScoreChange,
  onComboChange,
  onComplete,
}: MemoryMatchGameProps) {
  const duration = Number.isFinite(durationSeconds) ? Math.max(0, Math.floor(durationSeconds)) : 60;
  const [cards, setCards] = useState<Card[]>(makeCards);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [remaining, setRemaining] = useState(duration);
  const [feedback, setFeedback] = useState("Flip two cards to find matching animals.");
  const done = useRef(false);
  const resolving = useRef(false);
  const resolutionTimer = useRef<number | null>(null);
  const isComplete = cards.every((card) => card.matched);

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
    if (!isActive || done.current || remaining === 0 || isComplete) return;
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
  }, [isActive, isComplete, remaining]);

  useEffect(() => {
    if (remaining === 0 || isComplete) finish();
  }, [finish, isComplete, remaining]);

  useEffect(() => {
    onScoreChange?.(score);
  }, [onScoreChange, score]);

  useEffect(() => {
    onComboChange?.(combo);
  }, [combo, onComboChange]);

  useEffect(
    () => () => {
      if (resolutionTimer.current !== null) {
        window.clearTimeout(resolutionTimer.current);
      }
    },
    [],
  );

  const flip = (card: Card) => {
    if (
      !isActive ||
      done.current ||
      remaining === 0 ||
      card.matched ||
      flipped.includes(card.id) ||
      resolving.current
    ) {
      return;
    }

    if (flipped.length === 0) {
      setFlipped([card.id]);
      setFeedback(`You turned over ${card.pair}. Find its match.`);
      return;
    }

    const firstId = flipped[0];
    if (firstId === undefined) return;
    const firstCard = cards.find((candidate) => candidate.id === firstId);
    if (!firstCard) return;

    resolving.current = true;
    setFlipped([firstId, card.id]);
    setAttempted((value) => value + 1);

    const isMatch = firstCard.pair === card.pair;
    if (isMatch) {
      setCards((current) =>
        current.map((candidate) =>
          candidate.id === firstId || candidate.id === card.id
            ? { ...candidate, matched: true }
            : candidate,
        ),
      );
      setScore((value) => value + 10 + combo * 2);
      setCombo((value) => value + 1);
      setCorrect((value) => value + 1);
      setFeedback("Match found! Well done.");
    } else {
      setCombo(0);
      setFeedback("Not a match. Remember their places and try again.");
    }

    resolutionTimer.current = window.setTimeout(
      () => {
        setFlipped([]);
        resolving.current = false;
        resolutionTimer.current = null;
      },
      isMatch ? 450 : 750,
    );
  };

  const reset = () => {
    if (!isActive) return;
    if (resolutionTimer.current !== null) {
      window.clearTimeout(resolutionTimer.current);
      resolutionTimer.current = null;
    }
    resolving.current = false;
    done.current = false;
    setCards(makeCards());
    setFlipped([]);
    setScore(0);
    setCombo(0);
    setCorrect(0);
    setAttempted(0);
    setRemaining(duration);
    setFeedback("Flip two cards to find matching animals.");
  };

  return (
    <section
      aria-label="Memory Match game"
      className="mx-auto w-full max-w-2xl rounded-[24px] border-2 border-stroke bg-[var(--world-tint,#f9ebff)] p-4 text-stroke shadow-[4px_4px_0px_#1a1530] sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="border-2 border-stroke bg-[var(--world-soft,#ebc2ff)] px-3 py-1 font-heading font-bold">
          Memory Match
        </span>
        <span aria-label={`${remaining} seconds remaining`} className="font-mono font-bold">
          {remaining}s
        </span>
      </div>
      <h2 className="mt-4 text-center font-heading text-2xl font-bold">
        Find all the animal pairs
      </h2>
      <p className="mt-1 text-center text-muted">
        Choose two cards each turn. Matches earn points.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
        {cards.map((card) => {
          const revealed = card.matched || flipped.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => flip(card)}
              disabled={!isActive || remaining === 0 || done.current || card.matched}
              aria-label={
                revealed ? `${card.pair}${card.matched ? ", matched" : ""}` : "Hidden animal card"
              }
              aria-pressed={revealed}
              className={`flex aspect-square min-h-20 flex-col items-center justify-center border-2 border-stroke text-3xl shadow-[2px_2px_0px_#1a1530] transition-transform hover:-translate-y-0.5 focus-visible:z-10 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#7a1aa8] active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-70 sm:text-4xl ${
                revealed
                  ? "bg-white"
                  : "bg-[var(--world-main,#d26bff)] hover:bg-[var(--world-soft,#ebc2ff)]"
              } ${card.matched ? "ring-2 ring-[#1fbf7a]" : ""}`}
            >
              <span aria-hidden="true">{revealed ? card.emoji : "?"}</span>
              {revealed && <span className="mt-1 text-xs font-bold capitalize">{card.pair}</span>}
            </button>
          );
        })}
      </div>

      <p role="status" aria-live="polite" className="mt-4 min-h-6 text-center font-semibold">
        {feedback}
      </p>
      <div className="mt-3 flex flex-wrap justify-between gap-2 border-2 border-stroke bg-white p-3 text-sm">
        <span>
          Score <strong>{score}</strong>
        </span>
        <span>
          Pairs{" "}
          <strong>
            {correct}/{PAIRS.length}
          </strong>
        </span>
        <span>
          Accuracy <strong>{attempted ? Math.round((correct / attempted) * 100) : 0}%</strong>
        </span>
      </div>

      {(remaining === 0 || isComplete) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-stroke bg-[var(--world-soft,#ebc2ff)] p-4">
          <span className="font-bold">
            <Trophy className="mr-1 inline" size={18} aria-hidden="true" />
            Round complete! Score: {score}
          </span>
          <button
            type="button"
            onClick={reset}
            disabled={!isActive}
            className="inline-flex min-h-11 items-center gap-2 border-2 border-stroke bg-[var(--world-main,#d26bff)] px-3 font-bold shadow-[2px_2px_0px_#1a1530] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#7a1aa8] disabled:opacity-50"
          >
            <RotateCcw size={16} aria-hidden="true" /> Play again
          </button>
        </div>
      )}
    </section>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3, RotateCcw, Sparkles, Trophy } from "lucide-react";

export interface SpeedMatchWord {
  english: string;
  arabic: string;
}

export interface SpeedMatchGameResult {
  score: number;
  matches: number;
  elapsedSeconds: number;
}

export interface SpeedMatchGameProps {
  isActive?: boolean;
  durationSeconds?: number;
  words?: SpeedMatchWord[];
  onScoreChange?: (score: number) => void;
  onComplete?: (result: SpeedMatchGameResult) => void;
}

interface Card {
  id: string;
  pairId: number;
  text: string;
  language: "en" | "ar";
}

type Feedback = "idle" | "mismatch" | "matched";

const DEFAULT_WORDS: SpeedMatchWord[] = [
  { english: "apple", arabic: "تفاحة" },
  { english: "book", arabic: "كتاب" },
  { english: "water", arabic: "ماء" },
  { english: "school", arabic: "مدرسة" },
  { english: "friend", arabic: "صديق" },
  { english: "sun", arabic: "شمس" },
  { english: "moon", arabic: "قمر" },
  { english: "flower", arabic: "زهرة" },
  { english: "house", arabic: "بيت" },
  { english: "happy", arabic: "سعيد" },
  { english: "cat", arabic: "قطة" },
  { english: "family", arabic: "عائلة" },
];

function normalizeDuration(seconds: number): number {
  return Number.isFinite(seconds) ? Math.max(1, Math.floor(seconds)) : 60;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[otherIndex]] = [result[otherIndex]!, result[index]!];
  }
  return result;
}

function createCards(words: SpeedMatchWord[], round: number): Card[] {
  const source = words.length > 0 ? words : DEFAULT_WORDS;
  const pairs = Array.from({ length: 8 }, (_, pairId) => {
    const word = source[(round * 8 + pairId) % source.length]!;
    return [
      {
        id: `en-${round}-${pairId}`,
        pairId,
        text: word.english,
        language: "en" as const,
      },
      {
        id: `ar-${round}-${pairId}`,
        pairId,
        text: word.arabic,
        language: "ar" as const,
      },
    ];
  }).flat();
  return shuffle(pairs);
}

function playFeedbackTone(matched: boolean): void {
  if (typeof window === "undefined") return;
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = matched ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(matched ? 880 : 190, context.currentTime);
    if (matched) {
      oscillator.frequency.setValueAtTime(1175, context.currentTime + 0.09);
    }
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.21);
    window.setTimeout(() => void context.close(), 350);
  } catch (error) {
    console.warn("Speed Match sound could not be played.", error);
  }
}

export default function SpeedMatchGame({
  isActive = true,
  durationSeconds = 60,
  words = DEFAULT_WORDS,
  onScoreChange,
  onComplete,
}: SpeedMatchGameProps) {
  const safeWords = useMemo(
    () =>
      words.filter(
        (word) =>
          typeof word.english === "string" &&
          word.english.trim().length > 0 &&
          typeof word.arabic === "string" &&
          word.arabic.trim().length > 0,
      ),
    [words],
  );
  const duration = normalizeDuration(durationSeconds);
  const roundRef = useRef(0);
  const [cards, setCards] = useState(() =>
    createCards(safeWords.length > 0 ? safeWords : DEFAULT_WORDS, 0),
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [shakingIds, setShakingIds] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [matches, setMatches] = useState(0);
  const [remaining, setRemaining] = useState(duration);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [message, setMessage] = useState("Find the English word and its Arabic match!");
  const completedRef = useRef(false);
  const remainingRef = useRef(duration);

  const finishGame = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setFinished(true);
    onComplete?.({
      score,
      matches,
      elapsedSeconds: Math.max(0, duration - remainingRef.current),
    });
  }, [duration, matches, onComplete, score]);

  useEffect(() => {
    if (!isActive || finished || remainingRef.current === 0) return;
    const timer = window.setInterval(() => {
      setRemaining((current) => {
        const next = Math.max(0, current - 1);
        remainingRef.current = next;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finished, isActive]);

  useEffect(() => {
    if (remaining === 0 && !finished) finishGame();
  }, [finishGame, finished, remaining]);

  useEffect(() => {
    onScoreChange?.(score);
  }, [onScoreChange, score]);

  useEffect(() => {
    if (!isActive || finished || feedback === "idle") return;
    const timeout = window.setTimeout(
      () => {
        if (feedback === "mismatch") {
          setSelectedIds([]);
          setShakingIds([]);
          setMessage("Find the English word and its Arabic match!");
        } else {
          roundRef.current += 1;
          setCards(createCards(safeWords.length > 0 ? safeWords : DEFAULT_WORDS, roundRef.current));
          setMatchedIds([]);
          setMessage("A new set! Find your next match.");
        }
        setFeedback("idle");
      },
      feedback === "mismatch" ? 650 : 420,
    );
    return () => window.clearTimeout(timeout);
  }, [feedback, finished, isActive, safeWords]);

  const chooseCard = (card: Card) => {
    if (
      !isActive ||
      finished ||
      feedback !== "idle" ||
      matchedIds.includes(card.id) ||
      selectedIds.includes(card.id)
    ) {
      return;
    }

    const firstSelectedId = selectedIds[0];
    if (!firstSelectedId) {
      setSelectedIds([card.id]);
      return;
    }

    const firstCard = cards.find((item) => item.id === firstSelectedId);
    if (!firstCard) {
      setSelectedIds([card.id]);
      return;
    }

    setSelectedIds([firstCard.id, card.id]);
    if (firstCard.pairId === card.pairId && firstCard.language !== card.language) {
      setMatchedIds((current) => [...current, firstCard.id, card.id]);
      setSelectedIds([]);
      setScore((current) => current + 10);
      setMatches((current) => current + 1);
      setMessage("Amazing match! +10 points ✨");
      setFeedback("matched");
      playFeedbackTone(true);
    } else {
      setShakingIds([firstCard.id, card.id]);
      setMessage("Almost! Try another pair.");
      setFeedback("mismatch");
      playFeedbackTone(false);
    }
  };

  const restart = () => {
    completedRef.current = false;
    remainingRef.current = duration;
    roundRef.current = 0;
    setCards(createCards(safeWords.length > 0 ? safeWords : DEFAULT_WORDS, 0));
    setSelectedIds([]);
    setMatchedIds([]);
    setShakingIds([]);
    setScore(0);
    setMatches(0);
    setRemaining(duration);
    setFinished(false);
    setFeedback("idle");
    setMessage("Find the English word and its Arabic match!");
  };

  if (safeWords.length === 0) {
    return (
      <p
        className="mx-auto max-w-2xl rounded-[20px] border-2 border-stroke bg-surface-0 p-6 text-center font-semibold shadow-retro-md"
        role="status"
      >
        No matching words are available right now.
      </p>
    );
  }

  return (
    <section
      data-world="rose"
      className="mx-auto w-full max-w-3xl text-stroke"
      aria-label="Speed Match English-Arabic game"
    >
      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3" aria-label="Game statistics">
        <div className="rounded-[16px] border-2 border-stroke bg-world-violet-100 p-3 text-center shadow-retro-sm">
          <p className="flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wide text-muted">
            <Clock3 size={14} aria-hidden="true" /> Time left
          </p>
          <p
            className={`font-heading text-2xl font-bold tabular-nums ${remaining <= 10 ? "animate-pulse text-[#b3261e] motion-reduce:animate-none" : ""}`}
            aria-live="off"
          >
            {Math.floor(remaining / 60)
              .toString()
              .padStart(2, "0")}
            :{(remaining % 60).toString().padStart(2, "0")}
          </p>
        </div>
        <div className="rounded-[16px] border-2 border-stroke bg-world-amber-200 p-3 text-center shadow-retro-sm">
          <p className="text-xs font-bold uppercase tracking-wide">Points</p>
          <p className="font-heading text-2xl font-bold tabular-nums">{score}</p>
        </div>
        <div className="rounded-[16px] border-2 border-stroke bg-world-mint-100 p-3 text-center shadow-retro-sm">
          <p className="flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wide">
            <Trophy size={14} aria-hidden="true" /> Matches
          </p>
          <p className="font-heading text-2xl font-bold tabular-nums">{matches}</p>
        </div>
      </div>

      <div className="rounded-[24px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-md sm:p-6">
        <div
          className="mb-4 flex min-h-11 items-center justify-center gap-2 rounded-[12px] border-2 border-stroke bg-world-violet-50 px-3 py-2 text-center text-sm font-bold"
          aria-live="polite"
          role="status"
        >
          <Sparkles size={17} className="shrink-0 text-world-violet-700" aria-hidden="true" />
          <span>{finished ? "Time is up! Great effort." : message}</span>
        </div>

        <div
          className="grid grid-cols-4 gap-2 sm:gap-3"
          role="group"
          aria-label="Sixteen matching cards"
        >
          {cards.map((card) => {
            const isMatched = matchedIds.includes(card.id);
            const isSelected = selectedIds.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                disabled={!isActive || finished || feedback !== "idle" || isMatched}
                onClick={() => chooseCard(card)}
                lang={card.language === "ar" ? "ar" : "en"}
                dir={card.language === "ar" ? "rtl" : "ltr"}
                aria-label={`${card.language === "ar" ? "Arabic" : "English"}: ${card.text}${isMatched ? ", matched" : ""}`}
                aria-pressed={isSelected || isMatched}
                className={`relative flex min-h-[76px] items-center justify-center rounded-[14px] border-2 px-1 py-3 text-center text-sm font-bold transition-colors duration-150 motion-reduce:transition-none sm:min-h-[96px] sm:px-2 sm:text-base ${
                  isMatched
                    ? "speed-match-pop border-stroke bg-world-mint-200 text-stroke shadow-retro-sm"
                    : isSelected
                      ? "border-world-violet-700 bg-world-violet-100 text-stroke shadow-retro-sm"
                      : "border-stroke bg-surface-0 text-stroke shadow-retro-sm hover:-translate-y-0.5 hover:bg-world-amber-100 active:translate-y-0 disabled:cursor-default"
                } ${shakingIds.includes(card.id) ? "speed-match-shake border-[#b3261e] bg-world-rose-100" : ""}`}
              >
                {isMatched ? <span aria-hidden="true">⭐</span> : card.text}
              </button>
            );
          })}
        </div>

        {finished && (
          <div
            className="mt-5 rounded-[18px] border-2 border-stroke bg-world-amber-200 p-4 text-center shadow-retro-sm"
            role="status"
            aria-live="polite"
          >
            <p className="font-heading text-xl font-bold">Round complete!</p>
            <p className="mt-1 text-sm font-semibold">
              You found {matches} {matches === 1 ? "match" : "matches"} and earned {score} points.
            </p>
            <button
              type="button"
              onClick={restart}
              disabled={!isActive}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-stroke bg-surface-0 px-4 font-heading font-bold shadow-retro-sm transition-transform hover:-translate-y-0.5 disabled:opacity-50 motion-reduce:transition-none"
            >
              <RotateCcw size={16} aria-hidden="true" /> Play again
            </button>
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-xs font-medium text-muted">
        Tap one English card, then its Arabic translation. Every match earns 10 points.
      </p>
      <style>{`
        @keyframes speed-match-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px) rotate(-1deg); }
          75% { transform: translateX(4px) rotate(1deg); }
        }
        @keyframes speed-match-pop {
          0% { transform: scale(1); opacity: 1; }
          55% { transform: scale(1.12); opacity: .9; }
          100% { transform: scale(.55); opacity: 0; }
        }
        .speed-match-shake { animation: speed-match-shake .22s ease-in-out 2; }
        .speed-match-pop { animation: speed-match-pop .4s ease-in forwards; pointer-events: none; }
        @media (prefers-reduced-motion: reduce) {
          .speed-match-shake, .speed-match-pop { animation: none; }
        }
      `}</style>
    </section>
  );
}

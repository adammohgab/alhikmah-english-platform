import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, Zap } from "lucide-react";

export interface GrammarDashQuestion {
  sentence: string;
  highlighted: string;
  choices: [string, string];
  correctChoice: 0 | 1;
  explanation?: string;
}

export interface GrammarDashGameResult {
  score: number;
  correct: number;
  attempted: number;
  accuracy: number;
  elapsedSeconds: number;
  bestCombo: number;
}

export interface GrammarDashGameProps {
  isActive?: boolean;
  durationSeconds?: number;
  questions?: GrammarDashQuestion[];
  onScoreChange?: (score: number) => void;
  onComboChange?: (combo: number) => void;
  onComplete?: (result: GrammarDashGameResult) => void;
}

const DEFAULT_QUESTIONS: GrammarDashQuestion[] = [
  {
    sentence: "She go to school every day.",
    highlighted: "go",
    choices: ["goes", "going"],
    correctChoice: 0,
    explanation: "Use “goes” with she, he, or it in the present simple.",
  },
  {
    sentence: "They was playing in the park.",
    highlighted: "was",
    choices: ["were", "are"],
    correctChoice: 0,
    explanation: "Use “were” with they.",
  },
  {
    sentence: "I have two book in my bag.",
    highlighted: "book",
    choices: ["books", "bookes"],
    correctChoice: 0,
    explanation: "Use the plural form “books” after two.",
  },
  {
    sentence: "He is taller then his brother.",
    highlighted: "then",
    choices: ["than", "that"],
    correctChoice: 0,
    explanation: "Use “than” when comparing things.",
  },
  {
    sentence: "We did not went yesterday.",
    highlighted: "went",
    choices: ["go", "gone"],
    correctChoice: 0,
    explanation: "After “did not,” use the base verb “go.”",
  },
  {
    sentence: "There are a cat under the table.",
    highlighted: "are",
    choices: ["is", "be"],
    correctChoice: 0,
    explanation: "“A cat” is singular, so use “is.”",
  },
  {
    sentence: "My friends likes this game.",
    highlighted: "likes",
    choices: ["like", "liking"],
    correctChoice: 0,
    explanation: "Use “like” with the plural subject “friends.”",
  },
  {
    sentence: "I am interested on science.",
    highlighted: "on",
    choices: ["in", "at"],
    correctChoice: 0,
    explanation: "The usual expression is “interested in.”",
  },
  {
    sentence: "She has ate her lunch already.",
    highlighted: "ate",
    choices: ["eaten", "eat"],
    correctChoice: 0,
    explanation: "Use the past participle “eaten” with “has.”",
  },
  {
    sentence: "This is the most easiest question.",
    highlighted: "most easiest",
    choices: ["easiest", "more easiest"],
    correctChoice: 0,
    explanation: "“Easiest” already expresses the superlative.",
  },
];

function playFeedbackTone(correct: boolean, combo: number): void {
  if (typeof window === "undefined") return;
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(
      correct ? Math.min(600 + combo * 110, 1500) : 180,
      context.currentTime,
    );
    if (correct && combo >= 2) {
      oscillator.frequency.linearRampToValueAtTime(
        Math.min(900 + combo * 120, 1800),
        context.currentTime + 0.13,
      );
    }
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.1, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.19);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
    window.setTimeout(() => void context.close(), 350);
  } catch (error) {
    console.warn("Grammar Dash sound could not be played.", error);
  }
}

function comboMultiplier(combo: number): number {
  if (combo >= 3) return 3;
  if (combo >= 2) return 2;
  return 1;
}

export default function GrammarDashGame({
  isActive = true,
  durationSeconds = 60,
  questions = DEFAULT_QUESTIONS,
  onScoreChange,
  onComboChange,
  onComplete,
}: GrammarDashGameProps) {
  const duration = Number.isFinite(durationSeconds) ? Math.max(1, Math.floor(durationSeconds)) : 60;
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [remaining, setRemaining] = useState(duration);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    message: string;
    explanation?: string;
  } | null>(null);
  const [finished, setFinished] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [completedAnswers, setCompletedAnswers] = useState(false);
  const current = questions.length ? questions[questionIndex % questions.length] : null;
  const accuracy = attempted === 0 ? 0 : Math.round((correct / attempted) * 100);

  const finishGame = useCallback(() => {
    if (completedAnswers) return;
    setCompletedAnswers(true);
    setFinished(true);
    onComplete?.({
      score,
      correct,
      attempted,
      accuracy: attempted === 0 ? 0 : Math.round((correct / attempted) * 100),
      elapsedSeconds: Math.max(0, duration - remaining),
      bestCombo,
    });
  }, [attempted, bestCombo, completedAnswers, correct, duration, onComplete, remaining, score]);

  useEffect(() => {
    if (!isActive || finished || !current || remaining <= 0) return;
    const interval = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [current, finished, isActive, remaining]);

  useEffect(() => {
    if (remaining === 0 && !finished && current) finishGame();
  }, [current, finishGame, finished, remaining]);

  useEffect(() => {
    onScoreChange?.(score);
  }, [onScoreChange, score]);

  useEffect(() => {
    onComboChange?.(combo);
  }, [combo, onComboChange]);

  useEffect(() => {
    if (!feedback || !isActive || finished) return;
    const timeout = window.setTimeout(() => {
      setFeedback(null);
      setQuestionIndex((value) => value + 1);
      setAnswered(false);
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [feedback, finished, isActive]);

  const chooseAnswer = (choiceIndex: 0 | 1) => {
    if (!isActive || finished || remaining === 0 || !current || answered) return;
    setAnswered(true);
    setAttempted((value) => value + 1);

    const isCorrect = choiceIndex === current.correctChoice;
    const nextCombo = isCorrect ? combo + 1 : 0;
    const multiplier = comboMultiplier(nextCombo);
    const points = isCorrect ? 10 * multiplier : 0;
    if (isCorrect) {
      setScore((value) => value + points);
      setCorrect((value) => value + 1);
      setCombo(nextCombo);
      setBestCombo((value) => Math.max(value, nextCombo));
      setFeedback({
        correct: true,
        message: `Correct! +${points} points${multiplier > 1 ? ` · ${multiplier}× COMBO!` : ""}`,
        ...(current.explanation ? { explanation: current.explanation } : {}),
      });
    } else {
      setCombo(0);
      setFeedback({
        correct: false,
        message: "Not quite! Keep moving.",
        ...(current.explanation ? { explanation: current.explanation } : {}),
      });
    }
    playFeedbackTone(isCorrect, nextCombo);
  };

  if (!current) {
    return (
      <p
        className="mx-auto max-w-2xl rounded-[20px] border-2 border-stroke bg-surface-0 p-6 text-center font-semibold shadow-retro-md"
        role="status"
      >
        No grammar questions are available yet.
      </p>
    );
  }

  const highlightIndex = current.sentence.indexOf(current.highlighted);
  const hasHighlight = current.highlighted.length > 0 && highlightIndex >= 0;
  const sentenceBefore = hasHighlight
    ? current.sentence.slice(0, highlightIndex)
    : current.sentence;
  const sentenceAfter = hasHighlight
    ? current.sentence.slice(highlightIndex + current.highlighted.length)
    : "";
  const multiplier = comboMultiplier(combo);

  return (
    <section
      data-world="violet"
      aria-label="Grammar Dash game"
      className="mx-auto w-full max-w-3xl text-stroke"
    >
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3" aria-label="Game statistics">
        <div className="rounded-[16px] border-2 border-stroke bg-world-violet-100 p-3 text-center shadow-retro-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Time left</p>
          <p
            className={`font-heading text-2xl font-bold tabular-nums ${remaining <= 10 ? "animate-pulse text-[#b3261e] motion-reduce:animate-none" : ""}`}
            aria-live="off"
          >
            00:{String(remaining).padStart(2, "0")}
          </p>
        </div>
        <div className="rounded-[16px] border-2 border-stroke bg-world-amber-200 p-3 text-center shadow-retro-sm">
          <p className="text-xs font-bold uppercase tracking-wide">Score</p>
          <p className="font-heading text-2xl font-bold tabular-nums" aria-live="polite">
            {score}
          </p>
        </div>
        <div
          className={`rounded-[16px] border-2 border-stroke p-3 text-center shadow-retro-sm ${combo >= 3 ? "bg-world-rose-200" : "bg-world-mint-100"}`}
        >
          <p className="text-xs font-bold uppercase tracking-wide">Combo streak</p>
          <p
            className="flex items-center justify-center gap-1 font-heading text-2xl font-bold tabular-nums"
            aria-label={`${combo} correct in a row, ${multiplier} times multiplier`}
          >
            <Zap size={18} aria-hidden="true" />
            {combo}×
          </p>
          <p className="text-xs font-bold">{multiplier}× score</p>
        </div>
      </div>

      <div
        className={`relative overflow-hidden rounded-[24px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-md transition-colors sm:p-8 ${feedback ? (feedback.correct ? "bg-world-mint-50" : "bg-world-rose-50") : ""}`}
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 font-heading text-xs font-bold uppercase tracking-[0.2em] text-world-violet-700">
              Grammar Dash
            </p>
            <h2 className="font-heading text-xl font-bold sm:text-2xl">
              Fix it before time runs out!
            </h2>
          </div>
          <div className="flex items-center gap-2 rounded-full border-2 border-stroke bg-world-violet-100 px-3 py-2 text-sm font-bold">
            <Clock3 size={16} aria-hidden="true" /> Question {questionIndex + 1}
          </div>
        </div>

        <p className="mb-4 text-sm font-semibold text-muted">
          Choose the correct repair for the highlighted part:
        </p>
        <div
          className="mb-7 rounded-[18px] border-2 border-dashed border-world-violet-500 bg-world-violet-50 px-4 py-7 text-center font-heading text-xl font-bold leading-relaxed sm:px-6 sm:text-2xl"
          aria-live="polite"
        >
          {sentenceBefore}
          {hasHighlight && (
            <mark className="mx-1 rounded-[8px] border-2 border-stroke bg-world-amber-200 px-2 py-1 text-stroke underline decoration-[#b3261e] decoration-wavy">
              {current.highlighted}
            </mark>
          )}
          {sentenceAfter}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {current.choices.map((choice, index) => {
            const selectedCorrect = feedback !== null && index === current.correctChoice;
            const selectedWrong = feedback?.correct === false && index !== current.correctChoice;
            return (
              <button
                key={`${questionIndex}-${choice}`}
                type="button"
                disabled={!isActive || finished || remaining === 0 || answered}
                onClick={() => chooseAnswer(index === 0 ? 0 : 1)}
                className={`min-h-20 rounded-[16px] border-2 border-stroke px-4 py-4 text-left font-heading text-lg font-bold shadow-retro-md transition active:translate-x-1 active:translate-y-1 active:shadow-retro-sm disabled:cursor-not-allowed disabled:opacity-80 motion-reduce:transition-none sm:text-xl ${selectedCorrect ? "bg-world-mint-200" : selectedWrong ? "bg-world-rose-200" : index === 0 ? "bg-world-violet-100 hover:bg-world-violet-200" : "bg-world-sky-100 hover:bg-world-sky-200"}`}
                aria-label={`Choice ${index + 1}: ${choice}`}
              >
                <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-[8px] border-2 border-stroke bg-surface-0 text-sm">
                  {index === 0 ? "A" : "B"}
                </span>
                {choice}
                {selectedCorrect && (
                  <CheckCircle2 className="float-right mt-1" aria-label="Correct answer" />
                )}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div
            className={`mt-5 rounded-[16px] border-2 border-stroke p-4 text-center shadow-retro-sm ${feedback.correct ? "bg-world-mint-200" : "bg-world-amber-200"}`}
            role="status"
            aria-live="assertive"
          >
            <p className="font-heading text-lg font-bold">{feedback.message}</p>
            {feedback.explanation && (
              <p className="mt-1 text-sm font-semibold">{feedback.explanation}</p>
            )}
          </div>
        )}

        {combo >= 2 && !feedback && (
          <p className="mt-4 animate-pulse text-center font-heading text-sm font-bold uppercase tracking-widest text-world-violet-700 motion-reduce:animate-none">
            {combo}× streak — {multiplier}× score, keep it going!
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-world-violet-300 pt-4 text-sm font-semibold text-muted">
          <span>
            Accuracy: {accuracy}% · Best combo: {bestCombo}×
          </span>
          <span>
            {correct} correct out of {attempted} attempts
          </span>
        </div>
      </div>

      {finished && (
        <div
          className="mt-6 rounded-[24px] border-2 border-stroke bg-world-violet-700 p-6 text-center text-white shadow-retro-md"
          role="status"
          aria-live="polite"
        >
          <p className="mb-2 font-heading text-xs font-bold uppercase tracking-[0.25em] text-world-amber-200">
            Run complete
          </p>
          <h3 className="font-heading text-3xl font-bold">Time’s up!</h3>
          <p className="mt-2 text-lg font-bold">
            {score} points · {accuracy}% accuracy · Best combo {bestCombo}×
          </p>
        </div>
      )}
    </section>
  );
}

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  CircleHelp,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  WandSparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { StudentAppShell } from "@/shared/components/layout/StudentAppShell";
import type { StudentShellStats } from "@/shared/components/layout/StudentTopBar";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { cn } from "@/shared/lib/utils/cn";
import {
  dailyProgressKey,
  GRAMMAR_EXERCISES,
  GRAMMAR_RULES,
  GRAMMAR_TOPICS,
  isCorrectAnswer,
  type GrammarExercise,
  type GrammarTopic,
} from "./rules";

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 shadow-retro-sm";
const XP_PER_DRILL = 5;
const DAILY_GOAL = 5;

interface SavedDailyProgress {
  completedIds: string[];
  xp: number;
}

function readDailyProgress(): SavedDailyProgress {
  if (typeof window === "undefined") return { completedIds: [], xp: 0 };
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(dailyProgressKey()) ?? "null",
    ) as SavedDailyProgress | null;
    if (!parsed || !Array.isArray(parsed.completedIds) || typeof parsed.xp !== "number")
      return { completedIds: [], xp: 0 };
    return {
      completedIds: parsed.completedIds.filter((id) => typeof id === "string"),
      xp: Math.max(0, parsed.xp),
    };
  } catch {
    return { completedIds: [], xp: 0 };
  }
}

function saveDailyProgress(progress: SavedDailyProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(dailyProgressKey(), JSON.stringify(progress));
  } catch {
    /* Storage may be unavailable; the in-memory session still works. */
  }
}

function shuffleWords(sentence: string): string[] {
  const words = sentence.replace(/[.!?]$/, "").split(" ");
  // Deterministic but non-answer order, so the exercise remains stable between renders.
  if (words.length < 3) return words;
  const shuffled = [...words.slice(1), words[0]];
  if (shuffled.every((word, index) => word === words[index])) return [...words].reverse();
  return shuffled;
}

function ExerciseCard({
  exercise,
  completed,
  onComplete,
}: {
  exercise: GrammarExercise;
  completed: boolean;
  onComplete: (id: string, correct: boolean) => void;
}) {
  const [selected, setSelected] = useState("");
  const [wordOrder, setWordOrder] = useState<string[]>(() => shuffleWords(exercise.answer));
  const [builtWords, setBuiltWords] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const correct = isCorrectAnswer(
    exercise.kind === "unscramble" ? builtWords.join(" ") : selected,
    exercise.answer,
  );
  const hasAnswer = exercise.kind === "unscramble" ? builtWords.length > 0 : selected.length > 0;

  const submit = () => {
    if (!hasAnswer || checked) return;
    setChecked(true);
    onComplete(exercise.id, correct);
  };
  const reset = () => {
    setSelected("");
    setWordOrder(shuffleWords(exercise.answer));
    setBuiltWords([]);
    setChecked(false);
  };

  return (
    <article className={cn(PANEL, "overflow-hidden", completed && "border-world-mint-400")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-stroke/10 px-4 py-3 sm:px-5">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
          {exercise.kind === "unscramble" ? <WandSparkles size={15} /> : <CircleHelp size={15} />}
          {exercise.kind === "unscramble" ? "Sentence builder" : "Spot the grammar"}
        </span>
        <span className="rounded-full bg-world-amber-100 px-3 py-1 text-xs font-bold text-stroke">
          +{XP_PER_DRILL} XP
        </span>
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="font-heading text-lg font-bold text-stroke">{exercise.prompt}</h3>
        <p className="mt-2 text-sm text-muted">{exercise.instruction}</p>

        {exercise.kind === "unscramble" ? (
          <div className="mt-4 space-y-3">
            <div
              className="flex min-h-14 flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-stroke/25 bg-surface-100 p-3"
              aria-label="Your sentence"
            >
              {builtWords.length === 0 && (
                <span className="text-sm text-muted">
                  Tap the words below to build your sentence.
                </span>
              )}
              {builtWords.map((word, index) => (
                <button
                  key={`${word}-${index}`}
                  type="button"
                  disabled={checked}
                  onClick={() => {
                    setBuiltWords((current) => current.filter((_, i) => i !== index));
                    setWordOrder((current) => [...current, word]);
                  }}
                  className="rounded-lg border-2 border-stroke bg-world-sky-200 px-3 py-1.5 text-sm font-bold text-stroke disabled:cursor-default"
                  aria-label={`Remove ${word}`}
                >
                  {word}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {wordOrder.map((word, index) => (
                <button
                  key={`${word}-${index}`}
                  type="button"
                  disabled={checked}
                  onClick={() => {
                    setBuiltWords((current) => [...current, word]);
                    setWordOrder((current) => current.filter((_, i) => i !== index));
                  }}
                  className="rounded-lg border-2 border-stroke bg-surface-0 px-3 py-2 text-sm font-bold shadow-retro-sm transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-2">
            {exercise.options?.map((option) => {
              const active = selected === option;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={checked}
                  onClick={() => setSelected(option)}
                  className={cn(
                    "rounded-xl border-2 p-3 text-left text-sm font-semibold transition-colors",
                    active
                      ? "border-world-sky-500 bg-world-sky-100"
                      : "border-stroke/15 bg-surface-0 hover:bg-surface-100",
                    checked &&
                      active &&
                      (correct
                        ? "border-world-mint-500 bg-world-mint-100"
                        : "border-world-coral-500 bg-world-coral-100"),
                  )}
                  aria-pressed={active}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}

        {checked && (
          <div
            className={cn(
              "mt-4 rounded-xl border-2 p-4",
              correct
                ? "border-world-mint-400 bg-world-mint-100"
                : "border-world-coral-300 bg-world-coral-100",
            )}
            role="status"
            aria-live="polite"
          >
            <p className="flex items-center gap-2 font-heading font-bold">
              {correct ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              {correct ? "Correct! Nice work." : "Not quite — learn the rule."}
            </p>
            {!correct && (
              <p className="mt-2 text-sm">
                <strong>Correct answer:</strong> {exercise.answer}
              </p>
            )}
            <p className="mt-2 text-sm">{exercise.explanation}</p>
            <p className="mt-2 text-sm">
              <strong>Rule:</strong> {exercise.rule}
            </p>
            {correct && !completed && (
              <p className="mt-2 flex items-center gap-1 text-sm font-bold">
                <Zap size={15} /> You earned {XP_PER_DRILL} XP for this drill.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {!checked ? (
            <button
              type="button"
              onClick={submit}
              disabled={!hasAnswer}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-2 border-stroke bg-world-amber-300 px-4 font-heading font-bold text-stroke shadow-retro-sm transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Check answer <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-stroke bg-surface-0 px-4 font-heading font-bold shadow-retro-sm"
            >
              <RotateCcw size={16} /> Try again
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function GrammarPracticePage() {
  const [topic, setTopic] = useState<GrammarTopic>("Tenses");
  const [dailyProgress, setDailyProgress] = useState<SavedDailyProgress>(() => readDailyProgress());
  const [showRule, setShowRule] = useState(true);
  const exercises = useMemo(
    () => GRAMMAR_EXERCISES.filter((exercise) => exercise.topic === topic),
    [topic],
  );
  const completedSet = useMemo(
    () => new Set(dailyProgress.completedIds),
    [dailyProgress.completedIds],
  );
  const completedToday = dailyProgress.completedIds.length;
  const goalProgress = Math.min(completedToday, DAILY_GOAL);

  const handleComplete = (id: string, correct: boolean) => {
    if (!correct || dailyProgress.completedIds.includes(id)) return;
    const next = {
      completedIds: [...dailyProgress.completedIds, id],
      xp: dailyProgress.xp + XP_PER_DRILL,
    };
    setDailyProgress(next);
    saveDailyProgress(next);
  };

  const stats: StudentShellStats = {
    xpTotal: 0,
    level: 1,
    xpInLevel: 0,
    xpToNext: 100,
    coins: 0,
    streakDays: 0,
  };

  return (
    <StudentAppShell stats={stats}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:py-8">
        <header className="relative overflow-hidden rounded-[24px] border-2 border-stroke bg-world-violet-200 p-5 shadow-retro-md sm:p-7">
          <div
            className="absolute -right-5 -top-7 rotate-12 text-world-violet-400/60"
            aria-hidden="true"
          >
            <BookOpen size={150} />
          </div>
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-stroke bg-surface-0 px-3 py-1 text-xs font-bold uppercase tracking-wide">
              <Sparkles size={14} /> Grammar workout
            </span>
            <h1 className="mt-3 font-heading text-3xl font-extrabold text-stroke sm:text-4xl">
              Build stronger sentences.
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-stroke/80 sm:text-base">
              Review a small grammar rule, practise with quick challenges, and learn from every
              mistake.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-xl border-2 border-stroke bg-surface-0 px-3 py-2">
                <Zap size={18} />
                <span className="text-sm font-bold">{dailyProgress.xp} XP earned today</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border-2 border-stroke bg-surface-0 px-3 py-2">
                <Target size={18} />
                <span className="text-sm font-bold">
                  Daily goal: {goalProgress}/{DAILY_GOAL} drills
                </span>
              </div>
            </div>
          </div>
        </header>

        <section className={cn(PANEL, "p-4 sm:p-5")} aria-label="Daily practice progress">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
              <Trophy size={20} /> Your daily streak
            </h2>
            <span className="text-sm font-bold text-muted">
              {Math.round((goalProgress / DAILY_GOAL) * 100)}%
            </span>
          </div>
          <ProgressBar
            value={goalProgress}
            max={DAILY_GOAL}
            label="Daily grammar drill goal"
            valueText={`${goalProgress} of ${DAILY_GOAL} drills completed`}
          />
          <p className="mt-2 text-sm text-muted">
            Complete {DAILY_GOAL} drills today to reach your practice goal. XP and completed drills
            are saved on this device for today.
          </p>
        </section>

        <section aria-labelledby="topic-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="topic-heading" className="font-heading text-xl font-bold">
                Choose a topic
              </h2>
              <p className="mt-1 text-sm text-muted">
                Pick one area and practise at your own pace.
              </p>
            </div>
            <span className="text-xs font-semibold text-muted">
              {exercises.filter((exercise) => completedSet.has(exercise.id)).length}/
              {exercises.length} done in this topic
            </span>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Grammar topics">
            {GRAMMAR_TOPICS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTopic(item)}
                aria-pressed={topic === item}
                className={cn(
                  "min-h-10 rounded-xl border-2 border-stroke px-4 text-sm font-bold transition-transform hover:-translate-y-0.5",
                  topic === item
                    ? "bg-world-amber-300 shadow-retro-sm"
                    : "bg-surface-0 hover:bg-surface-100",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className={cn(PANEL, "overflow-hidden")} aria-labelledby="rule-heading">
          <button
            type="button"
            onClick={() => setShowRule((value) => !value)}
            aria-expanded={showRule}
            className="flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-stroke bg-world-sky-200">
                <BookOpen size={20} />
              </span>
              <span>
                <span className="block font-heading text-lg font-bold" id="rule-heading">
                  {topic}: quick rule guide
                </span>
                <span className="block text-sm text-muted">
                  A bite-sized reminder before you begin.
                </span>
              </span>
            </span>
            <span className="text-sm font-bold">{showRule ? "Hide" : "Show"}</span>
          </button>
          {showRule && (
            <div className="border-t-2 border-stroke/10 px-4 pb-5 pt-4 sm:px-5">
              <p className="text-sm text-muted">{GRAMMAR_RULES[topic].summary}</p>
              <div className="mt-3 rounded-xl bg-surface-100 p-4">
                <p className="text-sm font-semibold">{GRAMMAR_RULES[topic].rule}</p>
                <p className="mt-2 text-sm">
                  <strong>Example:</strong> <em>{GRAMMAR_RULES[topic].example}</em>
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4" aria-label={`${topic} exercises`}>
          <div>
            <h2 className="font-heading text-xl font-bold">Time to practise</h2>
            <p className="mt-1 text-sm text-muted">
              Check your answer to see an explanation straight away. Only correct answers count
              towards today's XP.
            </p>
          </div>
          {exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              completed={completedSet.has(exercise.id)}
              onComplete={handleComplete}
            />
          ))}
          {completedToday >= DAILY_GOAL && (
            <div className="flex items-center gap-3 rounded-2xl border-2 border-world-mint-500 bg-world-mint-100 p-4">
              <Check size={22} />
              <div>
                <p className="font-heading font-bold">Daily goal reached!</p>
                <p className="text-sm">Great work — keep practising to strengthen your grammar.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </StudentAppShell>
  );
}

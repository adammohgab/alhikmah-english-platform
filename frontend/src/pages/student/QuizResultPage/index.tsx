import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  Coins,
  GraduationCap,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import { supabase } from "@/shared/api/supabase";

interface RpcResult {
  data: unknown;
  error: { message: string } | null;
}
type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
const rpc: Rpc = (fn, args) => (supabase.rpc.bind(supabase) as unknown as Rpc)(fn, args);
type ReviewItem = Record<string, unknown> & {
  key?: string;
  id?: string;
  prompt?: { text?: string } | string;
  your_answer?: unknown;
  correct_answer?: unknown;
  correct?: boolean | null;
  explanation?: string;
  points_awarded?: number;
  points?: number;
  skill?: string;
};
interface Topic {
  skill?: string;
  accuracy?: number;
}
interface Award {
  xp?: number;
  coins?: number;
  celebration?: string;
}
interface ResultPayload {
  result?: Record<string, unknown>;
  review?: ReviewItem[];
  topics?: Topic[];
  award?: Award;
  quiz?: Record<string, unknown>;
  show_answers?: boolean;
  review_unlocked?: boolean;
}
const panel = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
function valueText(value: unknown): string {
  if (value == null || value === "") return "No answer";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) return value.map(valueText).join(", ");
  if (typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${valueText(v)}`)
      .join(" · ");
  return "";
}
function duration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
function numberFrom(obj: unknown, ...keys: string[]): number | null {
  if (typeof obj !== "object" || obj === null) return null;
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}
/** First non-empty string among the candidates. */
function firstText(...values: unknown[]): string | null {
  for (const value of values) if (typeof value === "string" && value.length > 0) return value;
  return null;
}
export default function QuizResultPage() {
  const { quizId = "", attemptId = "" } = useParams<{ quizId: string; attemptId: string }>();
  const [payload, setPayload] = useState<ResultPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "wrong">("all");
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!attemptId) {
        setError("Quiz attempt was not found.");
        setLoading(false);
        return;
      }
      try {
        const { data, error: rpcError } = await rpc("get_quiz_result", { attempt_id: attemptId });
        if (rpcError) throw new Error(rpcError.message);
        if (!data || typeof data !== "object")
          throw new Error("No result is available for this attempt yet.");
        if (alive) setPayload(data);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load the quiz result.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [attemptId]);
  const result = payload?.result ?? (payload as Record<string, unknown> | null);
  const score = numberFrom(result, "score_pct", "percentage", "score_percent");
  const points = numberFrom(result, "points", "points_earned");
  const maxPoints = numberFrom(result, "max_points", "points_possible", "total_points");
  const passedValue = result?.["passed"];
  const passed =
    typeof passedValue === "boolean"
      ? passedValue
      : score !== null && score >= (numberFrom(result, "pass_mark", "pass_mark_pct") ?? 60);
  const timeTaken = numberFrom(result, "time_spent_s", "time_taken_s", "duration_seconds");
  const xp = numberFrom(payload?.award, "xp") ?? 0;
  const coins = numberFrom(payload?.award, "coins") ?? 0;
  const reviewAllowed = payload?.review_unlocked !== false && payload?.show_answers !== false;
  const review = useMemo(() => payload?.review ?? [], [payload]);
  const visibleReview =
    filter === "wrong" ? review.filter((item) => item.correct === false) : review;
  const topics = payload?.topics ?? [];
  useEffect(() => {
    const award = payload?.award;
    if (
      (passed && score !== null && score >= 80) ||
      (passed && ["medium", "large"].includes(String(award?.celebration)))
    )
      setCelebrationOpen(true);
  }, [payload, passed, score]);
  useEffect(() => {
    if (celebrationOpen) continueRef.current?.focus();
  }, [celebrationOpen]);
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-700">
        Loading your quiz result…
      </main>
    );
  if (error || !payload)
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className={`${panel} text-center`}>
          <AlertCircle className="mx-auto mb-3 text-rose-600" size={36} />
          <h1 className="text-2xl font-bold">Result unavailable</h1>
          <p role="alert" className="mt-2 text-slate-600">
            {error ?? "No result found."}
          </p>
          <Link
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white"
            to={`/student/quizzes/${quizId}`}
          >
            <ArrowLeft size={16} />
            Back to quiz
          </Link>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-indigo-600">Quiz results</p>
            <h1 className="mt-1 text-3xl font-extrabold">
              {firstText(payload.quiz?.["title"], result?.["quiz_title"]) ?? "Quiz complete"}
            </h1>
            <p className="mt-2 text-slate-600">Here’s your score and what you can learn from it.</p>
          </div>
          <Link
            to={`/student/quizzes/${quizId}`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold hover:bg-slate-100"
          >
            <ArrowLeft size={16} />
            Back to quiz
          </Link>
        </header>
        <section className={`${panel} overflow-hidden`}>
          <div className="grid gap-6 md:grid-cols-[1fr_1.3fr]">
            <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 p-6 text-center">
              <div
                className={`grid h-24 w-24 place-items-center rounded-full border-8 ${passed ? "border-emerald-200 text-emerald-700" : "border-rose-200 text-rose-700"}`}
              >
                <span className="text-2xl font-black">
                  {score === null ? "—" : `${Math.round(score)}%`}
                </span>
              </div>
              <div
                className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
              >
                {passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {passed ? "Passed" : "Not passed"}
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Pass mark: {numberFrom(result ?? undefined, "pass_mark", "pass_mark_pct") ?? 60}%
              </p>
            </div>
            <div className="grid grid-cols-2 content-center gap-3">
              <div className="rounded-xl border p-4">
                <p className="text-sm text-slate-500">Points earned</p>
                <p className="mt-1 text-2xl font-extrabold">
                  {points ?? "—"}
                  {maxPoints !== null && (
                    <span className="text-base font-semibold text-slate-500"> / {maxPoints}</span>
                  )}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm text-slate-500">Time taken</p>
                <p className="mt-1 text-2xl font-extrabold">
                  {timeTaken === null ? "—" : duration(timeTaken)}
                </p>
              </div>
              <div className="rounded-xl border bg-amber-50 p-4">
                <p className="flex items-center gap-2 text-sm text-amber-800">
                  <Zap size={16} />
                  XP earned
                </p>
                <p className="mt-1 text-2xl font-extrabold text-amber-900">+{xp}</p>
              </div>
              <div className="rounded-xl border bg-yellow-50 p-4">
                <p className="flex items-center gap-2 text-sm text-yellow-800">
                  <Coins size={16} />
                  Coins earned
                </p>
                <p className="mt-1 text-2xl font-extrabold text-yellow-900">+{coins}</p>
              </div>
            </div>
          </div>
        </section>
        {topics.length > 0 && (
          <section className={panel}>
            <h2 className="text-xl font-bold">Topic breakdown</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use these skill areas to choose what to practise next.
            </p>
            <div className="mt-5 space-y-4">
              {topics.map((topic, i) => {
                const accuracy = Math.max(0, Math.min(100, Number(topic.accuracy ?? 0)));
                return (
                  <div key={`${topic.skill ?? "topic"}-${i}`}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span className="font-semibold">{topic.skill ?? "General"}</span>
                      <span className="text-slate-500">{Math.round(accuracy)}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${accuracy >= 70 ? "bg-emerald-500" : accuracy >= 45 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${accuracy}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Review your answers</h2>
              <p className="mt-1 text-sm text-slate-500">
                {reviewAllowed
                  ? `${review.length} questions in this review`
                  : "Answer review is currently locked by your teacher."}
              </p>
            </div>
            {reviewAllowed && review.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter("all")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${filter === "all" ? "bg-slate-900 text-white" : "border hover:bg-slate-50"}`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("wrong")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${filter === "wrong" ? "bg-slate-900 text-white" : "border hover:bg-slate-50"}`}
                >
                  Wrong only
                </button>
              </div>
            )}
          </div>
          {!reviewAllowed ? (
            <div className="mt-5 rounded-xl bg-slate-50 p-5 text-slate-600">
              <CircleHelp className="mb-2" />
              <p>
                Your score and topic breakdown are shown above. Your teacher has not unlocked answer
                explanations yet.
              </p>
            </div>
          ) : visibleReview.length === 0 ? (
            <p className="mt-5 rounded-xl bg-slate-50 p-5 text-slate-600">
              {filter === "wrong"
                ? "No incorrect answers in this attempt."
                : "No question-by-question review was returned."}
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {visibleReview.map((item, i) => {
                const prompt =
                  typeof item.prompt === "string" ? item.prompt : (item.prompt?.text ?? "Question");
                return (
                  <article
                    key={String(item.key ?? item.id ?? i)}
                    className={`rounded-xl border p-4 ${item.correct === true ? "border-emerald-200" : item.correct === false ? "border-rose-200" : "border-slate-200"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 ${item.correct === true ? "text-emerald-600" : item.correct === false ? "text-rose-600" : "text-slate-400"}`}
                      >
                        {item.correct === true ? (
                          <CheckCircle2 />
                        ) : item.correct === false ? (
                          <XCircle />
                        ) : (
                          <CircleHelp />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Question {i + 1}
                            {item.skill ? ` · ${item.skill}` : ""}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            {item.points_awarded ?? "—"} / {item.points ?? "—"} points
                          </span>
                        </div>
                        <h3 className="mt-1 font-bold">{prompt}</h3>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Your answer
                            </p>
                            <p className="mt-1 break-words">{valueText(item.your_answer)}</p>
                          </div>
                          <div className="rounded-lg bg-emerald-50 p-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                              Correct answer
                            </p>
                            <p className="mt-1 break-words">{valueText(item.correct_answer)}</p>
                          </div>
                        </div>
                        {item.explanation && (
                          <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                            <p className="font-semibold text-indigo-900">Explanation</p>
                            <p className="mt-1 text-sm text-indigo-950">{item.explanation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <section className="flex flex-wrap gap-3">
          <Link
            to={`/student/quizzes/${quizId}`}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700"
          >
            <RotateCcw size={17} />
            Back to quiz
          </Link>
          <Link
            to="/student/practice/grammar"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold hover:bg-slate-50"
          >
            <GraduationCap size={17} />
            Practise weak areas
          </Link>
          {passed && (
            <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
              <Trophy size={17} />
              Keep up the great work!
            </span>
          )}
        </section>
      </div>
      {celebrationOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="celebration-title"
            className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl"
          >
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-amber-700">
              <Sparkles size={32} />
            </div>
            <h2 id="celebration-title" className="mt-4 text-2xl font-extrabold">
              Excellent work!
            </h2>
            <p className="mt-2 text-slate-600">
              You passed with {score === null ? "a great result" : `${Math.round(score)}%`}.
            </p>
            <div className="mt-4 flex justify-center gap-4 text-sm font-bold">
              <span className="text-amber-700">+{xp} XP</span>
              <span className="text-yellow-700">+{coins} coins</span>
            </div>
            <button
              ref={continueRef}
              onClick={() => setCelebrationOpen(false)}
              className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white"
            >
              Continue
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Flag,
  Loader2,
  Menu,
  Send,
} from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import { QuestionRenderer } from "@/shared/components/questions/QuestionRenderer";
import type { QuestionRendererProps } from "@/shared/components/questions/QuestionRenderer";
import type {
  AudioSpellingQuestionData,
  Choice,
  FillBlankQuestionData,
  MatchingQuestionData,
  MultipleChoiceQuestionData,
  Question,
  QuestionPrompt,
  QuestionValueMap,
  ReorderQuestionData,
  ShortAnswerQuestionData,
} from "@/shared/components/questions/types";

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: LooseRpc = (fn, args) => (supabase.rpc.bind(supabase) as unknown as LooseRpc)(fn, args);
type Answer = QuestionValueMap[Question["type"]];
type AttemptQuestion = Record<string, unknown> & {
  id: string;
  question_type?: string;
  type?: string;
  prompt: unknown;
  options?: unknown;
  points?: number;
};
interface AttemptData {
  attempt_id: string;
  expires_at?: string | null;
  server_time?: string | null;
  questions?: AttemptQuestion[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asPrompt(value: unknown): QuestionPrompt {
  if (typeof value === "string") return { text: value };
  const record = asRecord(value);
  return { text: typeof record.text === "string" ? record.text : "" };
}

function asChoices(value: unknown): Choice[] {
  if (Array.isArray(value)) return value as Choice[];
  const nested = asRecord(value).choices;
  return Array.isArray(nested) ? (nested as Choice[]) : [];
}

function asStringList(value: unknown): string[] | undefined {
  return Array.isArray(value) ? (value as string[]) : undefined;
}

function normalizeQuestion(raw: AttemptQuestion): Question | null {
  const type = String(raw.type ?? raw.question_type ?? "").toLowerCase();
  const base = { id: raw.id, prompt: asPrompt(raw.prompt), explanation: undefined };
  const options = asRecord(raw.options);
  switch (type) {
    case "multiple_choice":
    case "multiple-choice":
    case "mcq":
      return {
        ...base,
        type: "multiple_choice",
        options: asChoices(raw.options),
        answer: undefined as MultipleChoiceQuestionData["answer"],
      };
    case "fill_blank":
    case "fill-blank":
      return {
        ...base,
        type: "fill_blank",
        wordBank: asStringList(options.wordBank) ?? asStringList(options.word_bank),
        answer: undefined as FillBlankQuestionData["answer"],
      };
    case "matching":
      return {
        ...base,
        type: "matching",
        options: (raw.options ?? { left: [], right: [] }) as MatchingQuestionData["options"],
        answer: undefined as MatchingQuestionData["answer"],
      };
    case "reorder":
      return {
        ...base,
        type: "reorder",
        options: (raw.options ?? { items: [] }) as ReorderQuestionData["options"],
        answer: undefined as ReorderQuestionData["answer"],
      };
    case "short_answer":
    case "short-answer":
      return {
        ...base,
        type: "short_answer",
        minWords: Number(raw.min_words ?? 0),
        maxWords: raw.max_words ? Number(raw.max_words) : undefined,
        answer: undefined as ShortAnswerQuestionData["answer"],
      };
    case "audio_spelling":
    case "audio-spelling":
      return {
        ...base,
        type: "audio_spelling",
        options: (raw.options ?? { tiles: [] }) as AudioSpellingQuestionData["options"],
        answer: undefined as AudioSpellingQuestionData["answer"],
      };
    default:
      return null;
  }
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)
    .toString()
    .padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}

export default function QuizAttemptPage() {
  const { quizId, attemptId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("Quiz attempt");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const deadlineRef = useRef<number | null>(null);
  const serverOffsetRef = useRef(0);
  const answersRef = useRef<Record<string, Answer>>({});
  const flagsRef = useRef<string[]>([]);
  const submittingRef = useRef(false);

  const beforeUnload = useCallback(
    (event: BeforeUnloadEvent) => {
      if (!submitted) {
        event.preventDefault();
        event.returnValue = "";
      }
    },
    [submitted],
  );

  const saveAnswers = useCallback(async () => {
    if (!attemptId || submitted || submittingRef.current) return;
    setSaving(true);
    try {
      const { error: saveError } = await rpc("save_quiz_answers", {
        attempt_id: attemptId,
        answers: answersRef.current,
      });
      if (saveError) throw new Error(saveError.message);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Could not save your answers: ${cause.message}`
          : "Could not save your answers.",
      );
    } finally {
      setSaving(false);
    }
  }, [attemptId, submitted]);

  const submitQuiz = useCallback(
    async (automatic = false) => {
      if (!attemptId || submittingRef.current || submitted) return;
      submittingRef.current = true;
      setSaving(true);
      try {
        // Save the latest response snapshot before invoking the server-side grader.
        const saved = await rpc("save_quiz_answers", {
          attempt_id: attemptId,
          answers: answersRef.current,
        });
        if (saved.error && !automatic) throw new Error(saved.error.message);
        const result = await rpc("submit_quiz_attempt", { attempt_id: attemptId });
        if (result.error) throw new Error(result.error.message);
        setSubmitted(true);
        setConfirmSubmit(false);
        setSubmitMessage(
          automatic ? "Time is up. Your quiz has been submitted." : "Your quiz has been submitted.",
        );
        window.removeEventListener("beforeunload", beforeUnload);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not submit the quiz. Please try again.",
        );
      } finally {
        setSaving(false);
        submittingRef.current = false;
      }
    },
    [attemptId, submitted, beforeUnload],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!quizId || !attemptId) {
        setError("Quiz attempt not found.");
        setLoading(false);
        return;
      }
      try {
        const { data, error: rpcError } = await rpc("start_quiz_attempt", {
          assessment_id: quizId,
        });
        if (rpcError) throw new Error(rpcError.message);
        const payload = data as AttemptData;
        if (payload?.attempt_id !== attemptId)
          throw new Error(
            "This attempt could not be verified. Return to the quiz page and reopen it.",
          );
        const normalized = (payload.questions ?? [])
          .map(normalizeQuestion)
          .filter((q): q is Question => q !== null);
        if (!normalized.length) throw new Error("This quiz has no supported questions to display.");
        if (cancelled) return;
        setQuestions(normalized);
        setTitle("Quiz attempt");
        if (payload.expires_at) {
          const serverNow = payload.server_time ? Date.parse(payload.server_time) : Date.now();
          serverOffsetRef.current = serverNow - Date.now();
          deadlineRef.current = Date.parse(payload.expires_at);
          setRemaining(Math.max(0, Math.ceil((deadlineRef.current - serverNow) / 1000)));
        }
      } catch (cause) {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Could not load this quiz attempt.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [quizId, attemptId]);

  useEffect(() => {
    if (submitted || loading) return;
    const timer = window.setInterval(() => {
      if (deadlineRef.current === null) return;
      const seconds = Math.max(
        0,
        Math.ceil((deadlineRef.current - (Date.now() + serverOffsetRef.current)) / 1000),
      );
      setRemaining(seconds);
      if (seconds <= 0) void submitQuiz(true);
    }, 250);
    return () => window.clearInterval(timer);
  }, [loading, submitted, submitQuiz]);

  useEffect(() => {
    if (loading || submitted) return;
    const interval = window.setInterval(() => void saveAnswers(), 30_000);
    return () => window.clearInterval(interval);
  }, [loading, submitted, saveAnswers]);

  useEffect(() => {
    if (!loading && !submitted) window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [loading, submitted, beforeUnload]);

  const question = questions[current];
  const answeredCount = useMemo(
    () =>
      questions.filter((q) => {
        const answer = answers[q.id];
        return (
          answer !== undefined &&
          answer !== null &&
          (typeof answer !== "object" ||
            Object.values(answer).some((v) =>
              Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim() !== "" : v != null,
            ))
        );
      }).length,
    [answers, questions],
  );

  const changeAnswer = (value: Answer) => {
    if (!question) return;
    const next = { ...answersRef.current, [question.id]: value };
    answersRef.current = next;
    setAnswers(next);
  };
  const goTo = (index: number) => {
    if (index < 0 || index >= questions.length) return;
    if (index !== current) void saveAnswers();
    setCurrent(index);
    setDrawerOpen(false);
  };
  const toggleFlag = () => {
    if (!question) return;
    const next = flagsRef.current.includes(question.id)
      ? flagsRef.current.filter((id) => id !== question.id)
      : [...flagsRef.current, question.id];
    flagsRef.current = next;
    setFlagged(next);
  };

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-700">
        <Loader2 className="animate-spin" /> <span className="sr-only">Loading quiz…</span>
      </main>
    );
  if (submitted)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <section className="w-full max-w-lg rounded-2xl border bg-white p-8 text-center shadow-sm">
          <Check className="mx-auto mb-3 text-emerald-600" size={42} />
          <h1 className="text-2xl font-bold">Quiz submitted</h1>
          <p className="mt-2 text-slate-600">{submitMessage}</p>
          <button
            className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
            onClick={() => navigate(`/student/quizzes/${quizId}`)}
          >
            Back to quiz
          </button>
        </section>
      </main>
    );
  if (error && !questions.length)
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-bold">Unable to open quiz</h1>
        <p className="mt-3 text-red-700">{error}</p>
        <button
          className="mt-5 rounded-lg border px-4 py-2"
          onClick={() => navigate(`/student/quizzes/${quizId}`)}
        >
          Back to quiz
        </button>
      </main>
    );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => {
              if (
                window.confirm(
                  "Leave this quiz? Your saved answers will remain, but the timer will continue.",
                )
              )
                navigate(`/student/quizzes/${quizId}`);
            }}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-slate-100"
          >
            <ArrowLeft size={18} /> Exit
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate font-bold">{title}</p>
            <p className="text-xs text-slate-500">
              Question {current + 1} of {questions.length} · {answeredCount} answered
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 font-mono font-bold ${remaining !== null && remaining < 60 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-800"}`}
            aria-live={
              remaining !== null && (remaining === 300 || remaining === 60) ? "assertive" : "off"
            }
          >
            <Clock3 size={17} />
            {remaining === null ? "Untimed" : formatTime(remaining)}
          </div>
          <button
            onClick={() => setConfirmSubmit(true)}
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <Send className="mr-2 inline" size={15} />
            Submit quiz
          </button>
        </div>
        <div className="h-1.5 bg-slate-100">
          <div
            className="h-full bg-indigo-600 transition-all"
            style={{ width: `${((current + 1) / Math.max(questions.length, 1)) * 100}%` }}
          />
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0 rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {question && (
            <>
              <div className="mb-6 flex items-start justify-between gap-3">
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700">
                  Question {current + 1}
                </span>
                {saving ? (
                  <span className="text-xs text-slate-500">Saving…</span>
                ) : (
                  <span className="text-xs text-emerald-700">Autosave enabled</span>
                )}
              </div>
              <div className="mb-8">
                <QuestionRenderer
                  {...({
                    question,
                    value: answers[question.id],
                    onChange: changeAnswer,
                  } as unknown as QuestionRendererProps)}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                <button
                  onClick={toggleFlag}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${flagged.includes(question.id) ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <Flag size={16} />
                  {flagged.includes(question.id) ? "Flagged for review" : "Flag for review"}
                </button>
                <div className="flex gap-2">
                  <button
                    disabled={current === 0}
                    onClick={() => goTo(current - 1)}
                    className="rounded-xl border px-4 py-2.5 font-semibold disabled:opacity-40"
                  >
                    <ArrowLeft className="mr-1 inline" size={16} />
                    Previous
                  </button>
                  <button
                    disabled={current === questions.length - 1}
                    onClick={() => goTo(current + 1)}
                    className="rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white disabled:opacity-40"
                  >
                    Next
                    <ArrowRight className="ml-1 inline" size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
        <aside className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Question navigator</h2>
            <span className="text-xs text-slate-500">
              {answeredCount}/{questions.length}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, i) => {
              const answer = answers[q.id];
              const isAnswered = answer !== undefined && answer !== null;
              const isFlagged = flagged.includes(q.id);
              return (
                <button
                  key={q.id}
                  onClick={() => goTo(i)}
                  aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ", unanswered"}${isFlagged ? ", flagged" : ""}`}
                  aria-current={i === current ? "step" : undefined}
                  className={`relative grid aspect-square place-items-center rounded-lg border text-sm font-bold ${i === current ? "border-indigo-600 bg-indigo-600 text-white ring-2 ring-indigo-200" : isFlagged ? "border-amber-400 bg-amber-50 text-amber-800" : isAnswered ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}
                >
                  {i + 1}
                  {isFlagged && (
                    <Flag
                      size={11}
                      className="absolute -right-1 -top-1 fill-amber-500 text-amber-700"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-5 space-y-2 text-xs text-slate-600">
            <p>
              <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-emerald-100 align-middle ring-1 ring-emerald-300" />
              Answered
            </p>
            <p>
              <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-amber-100 align-middle ring-1 ring-amber-400" />
              Flagged for review
            </p>
            <p>
              <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-slate-100 align-middle ring-1 ring-slate-300" />
              Unanswered
            </p>
          </div>
          <p className="mt-5 text-xs text-slate-500">
            {saving ? "Saving your answers…" : "Answers also save automatically every 30 seconds."}
          </p>
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm lg:hidden"
          >
            <Menu size={16} />
            {drawerOpen ? "Hide questions" : "Questions"}
          </button>
        </aside>
      </div>
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40 p-4 lg:hidden">
          <button
            type="button"
            aria-label="Close question drawer"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setDrawerOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="question-drawer-title"
            className="relative mt-auto rounded-2xl bg-white p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="question-drawer-title" className="font-bold">
                Questions
              </h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {questions.map((q, i) => (
                <button key={q.id} onClick={() => goTo(i)} className="rounded-lg border p-2">
                  {i + 1}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {confirmSubmit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 text-amber-600" />
              <div>
                <h2 id="submit-title" className="text-xl font-bold">
                  Submit this quiz?
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  You answered {answeredCount} of {questions.length} questions.
                </p>
                {questions.length - answeredCount > 0 && (
                  <p className="mt-2 text-sm font-semibold text-amber-700">
                    {questions.length - answeredCount} unanswered question(s).
                  </p>
                )}
                {flagged.length > 0 && (
                  <p className="mt-1 text-sm text-amber-700">
                    {flagged.length} question(s) flagged for review.
                  </p>
                )}
                <p className="mt-3 text-sm text-slate-500">
                  You cannot change answers after submitting.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmSubmit(false)}
                className="rounded-xl border px-4 py-2.5 font-semibold"
              >
                Keep working
              </button>
              <button
                disabled={saving}
                onClick={() => void submitQuiz(false)}
                className="rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Submitting…" : "Submit quiz"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

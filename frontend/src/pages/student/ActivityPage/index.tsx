import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import confetti from "canvas-confetti";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, Loader2, RotateCcw, Sparkles, Volume2 } from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import { QuestionRenderer } from "@/shared/components/questions/QuestionRenderer";
import type { Question, QuestionValue, QuestionValueMap } from "@/shared/components/questions/types";

type RpcResult = { data: unknown; error: { message: string } | null };
type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
const rpc: Rpc = (name, args) => (supabase.rpc.bind(supabase) as unknown as Rpc)(name, args);
type RawQuestion = Record<string, unknown> & { id: string; type?: string; question_type?: string; prompt?: unknown; options?: unknown; explanation?: string };
type ActivityPayload = { activity?: { id?: string; title?: string; description?: string; instructions?: string }; questions?: RawQuestion[]; state?: Record<string, unknown> };
type ReviewItem = { question_id?: string; correct?: boolean; explanation?: string; answer?: unknown };
type SubmitPayload = { score_pct?: number; per_question?: ReviewItem[]; award?: { xp?: number | { awarded?: number; amount?: number }; coins?: number | { awarded?: number; amount?: number }; xp_awarded?: number; coins_awarded?: number }; completed?: boolean };
type Answer = QuestionValueMap[Question["type"]];

function normalizeQuestion(raw: RawQuestion): Question | null {
  const type = String(raw.type ?? raw.question_type ?? "").toLowerCase().replaceAll("-", "_");
  const prompt = typeof raw.prompt === "string" ? { text: raw.prompt } : (raw.prompt ?? { text: "" });
  const base = { id: raw.id, prompt: prompt as { text: string }, explanation: raw.explanation };
  const options = raw.options as any;
  const answer = raw.answer as any;
  switch (type) {
    case "multiple_choice": case "mcq": return { ...base, type: "multiple_choice", options: Array.isArray(options) ? options : options?.choices ?? [], answer } as Question;
    case "fill_blank": return { ...base, type: "fill_blank", wordBank: options?.wordBank ?? options?.word_bank, answer } as Question;
    case "matching": return { ...base, type: "matching", options: options ?? { left: [], right: [] }, answer } as Question;
    case "reorder": case "sentence_ordering": return { ...base, type: "reorder", options: options ?? { items: [] }, answer } as Question;
    case "short_answer": return { ...base, type: "short_answer", minWords: Number(raw.min_words ?? 0), maxWords: raw.max_words ? Number(raw.max_words) : undefined, answer } as Question;
    case "audio_spelling": return { ...base, type: "audio_spelling", options: options ?? { tiles: [] }, answer } as Question;
    default: return null;
  }
}

function hasAnswer(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).some((item) => Array.isArray(item) ? item.length > 0 : typeof item === "string" ? item.trim().length > 0 : item != null);
  return true;
}

function playSuccess() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    [660, 880, 1100].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + index * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.09 + 0.16);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(context.currentTime + index * 0.09); oscillator.stop(context.currentTime + index * 0.09 + 0.17);
    });
    window.setTimeout(() => void context.close(), 700);
  } catch { /* Audio is an enhancement; never block activity progress. */ }
  try { if ("vibrate" in navigator) navigator.vibrate([35, 25, 50]); } catch { /* Unsupported device. */ }
}

function rewardNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const data = value as Record<string, unknown>;
    return Number(data.awarded ?? data.amount ?? data.xp ?? 0) || 0;
  }
  return 0;
}

export default function ActivityPage() {
  const { lessonId, activityId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("Practice activity");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<SubmitPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean | null>>({});
  const [celebrating, setCelebrating] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!activityId) { setError("This activity could not be found."); setLoading(false); return; }
      try {
        const response = await rpc("get_activity", { activity_id: activityId });
        if (response.error) throw new Error(response.error.message);
        const payload = response.data as ActivityPayload;
        const normalized = (payload?.questions ?? []).map(normalizeQuestion).filter((q): q is Question => q !== null);
        if (!normalized.length) throw new Error("This activity has no supported questions yet.");
        if (cancelled) return;
        setTitle(payload.activity?.title || "Practice activity");
        setDescription(payload.activity?.instructions || payload.activity?.description || "Work through each question, then check your answers.");
        setQuestions(normalized);
        const saved = payload.state?.answers;
        if (saved && typeof saved === "object") setAnswers(saved as Record<string, Answer>);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load this activity.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [activityId]);

  const question = questions[current];
  const answeredCount = useMemo(() => questions.filter((item) => hasAnswer(answers[item.id])).length, [answers, questions]);
  const changeAnswer = useCallback((value: Answer) => {
    if (!question || submittedRef.current) return;
    setAnswers((previous) => ({ ...previous, [question.id]: value }));
    setChecked((previous) => ({ ...previous, [question.id]: null }));
  }, [question]);

  const checkAnswer = useCallback(async () => {
    if (!question || !hasAnswer(answers[question.id])) return;
    setChecking(true);
    try {
      // The authoritative grade and rewards are returned by submit_activity; do not expose answer keys to the client.
      const response = await rpc("submit_activity", { activity_id: activityId, answers });
      if (response.error) throw new Error(response.error.message);
      const payload = (response.data ?? {}) as SubmitPayload;
      setResult(payload);
      setSubmitted(true);
      submittedRef.current = true;
      setCelebrating(true);
      playSuccess();
      confetti({ particleCount: 120, spread: 72, origin: { y: 0.65 }, scalar: 0.9 });
      window.setTimeout(() => setCelebrating(false), 4200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your answers could not be submitted. Please try again.");
    } finally { setChecking(false); }
  }, [activityId, answers, question]);

  if (loading) return <main className="grid min-h-[70vh] place-items-center text-slate-600"><Loader2 className="animate-spin" aria-hidden="true" /><span className="sr-only">Loading activity…</span></main>;
  if (error && !questions.length) return <main className="mx-auto max-w-2xl p-8"><h1 className="text-2xl font-bold text-slate-900">Unable to open activity</h1><p className="mt-3 text-red-700">{error}</p><button className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white" onClick={() => navigate(lessonId ? `/student/lessons/${lessonId}` : "/student")}>Back to lesson</button></main>;

  const score = typeof result?.score_pct === "number" ? Math.round(result.score_pct) : null;
  const award = result?.award;
  const xp = rewardNumber(award?.xp ?? award?.xp_awarded);
  const coins = rewardNumber(award?.coins ?? award?.coins_awarded);
  const review = result?.per_question ?? [];

  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <button onClick={() => navigate(lessonId ? `/student/lessons/${lessonId}` : "/student")} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 hover:bg-white hover:text-slate-900"><ArrowLeft size={17}/> Back to lesson</button>
        <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-700">Practice · {answeredCount}/{questions.length} answered</span>
      </header>

      {!submitted ? <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-indigo-700 to-violet-700 px-6 py-7 text-white sm:px-9"><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-100"><Sparkles size={17}/> INTERACTIVE PRACTICE</div><h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-indigo-100">{description}</p>}<div className="mt-5 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}/></div></div>
        <div className="grid gap-7 p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_190px]">
          <div className="min-w-0">
            <div className="mb-5 flex items-center justify-between gap-3"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">Question {current + 1} of {questions.length}</span>{checked[question?.id] === true && <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><CheckCircle2 size={17}/> Correct</span>}</div>
            {question && <QuestionRenderer question={question as any} value={answers[question.id] as any} onChange={changeAnswer as any}/>}
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><button disabled={current === 0} onClick={() => setCurrent((value) => Math.max(0, value - 1))} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft size={17}/> Previous</button>{current < questions.length - 1 ? <button onClick={() => setCurrent((value) => Math.min(questions.length - 1, value + 1))} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-700">Next question <ArrowRight size={17}/></button> : <button disabled={checking || answeredCount === 0} onClick={() => void checkAnswer()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{checking ? <Loader2 className="animate-spin" size={17}/> : <CheckCircle2 size={17}/>} {checking ? "Checking…" : "Check answers"}</button>}</div>
          </div>
          <aside className="rounded-2xl bg-slate-50 p-4"><h2 className="mb-3 text-sm font-bold text-slate-800">Question navigator</h2><div className="grid grid-cols-5 gap-2 md:grid-cols-4">{questions.map((item, index) => <button key={item.id} onClick={() => setCurrent(index)} aria-label={`Go to question ${index + 1}`} aria-current={current === index ? "step" : undefined} className={`aspect-square rounded-lg text-sm font-bold transition ${current === index ? "bg-indigo-600 text-white ring-2 ring-indigo-200" : hasAnswer(answers[item.id]) ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100"}`}>{index + 1}</button>)}</div><p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500"><CircleHelp size={15} className="mt-0.5 shrink-0"/> Green questions have an answer. Complete each question before checking your work.</p><div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3"><p className="text-xs font-semibold text-indigo-900">Tip</p><p className="mt-1 text-xs leading-relaxed text-indigo-800">Read each prompt carefully. You can revisit questions before submitting.</p></div></aside>
        </div>
      </section> : <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-6 py-10 text-center text-white sm:px-10"><div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-white/15"><CheckCircle2 size={36}/></div><p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-100">Activity complete</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Great effort!</h1><p className="mx-auto mt-3 max-w-xl text-emerald-50">Your answers have been submitted and your progress recorded.</p>{score !== null && <div className="mx-auto mt-6 inline-flex flex-col rounded-2xl bg-white/15 px-8 py-4"><span className="text-4xl font-black">{score}%</span><span className="text-sm text-emerald-50">Activity score</span></div>}</div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-8"><div className="rounded-2xl border border-amber-100 bg-amber-50 p-5"><div className="flex items-center gap-2 text-amber-700"><Sparkles size={20}/><span className="font-bold">XP earned</span></div><p className="mt-2 text-3xl font-black text-amber-900">+{xp}</p></div><div className="rounded-2xl border border-yellow-100 bg-yellow-50 p-5"><div className="flex items-center gap-2 text-yellow-700"><span className="text-xl">◈</span><span className="font-bold">Coins earned</span></div><p className="mt-2 text-3xl font-black text-yellow-900">+{coins}</p></div></div>
        {review.length > 0 && <div className="px-5 pb-5 sm:px-8 sm:pb-8"><h2 className="mb-3 text-lg font-bold text-slate-900">Answer review</h2><div className="space-y-3">{review.map((item, index) => <article key={item.question_id ?? index} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start gap-3">{item.correct ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={19}/> : <CircleHelp className="mt-0.5 shrink-0 text-amber-600" size={19}/>}<div><p className="font-semibold text-slate-800">Question {index + 1} · {item.correct ? "Correct" : "Review this answer"}</p>{item.explanation && <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.explanation}</p>}</div></div></article>)}</div></div>}
        <div className="flex flex-wrap justify-center gap-3 border-t border-slate-100 p-5 sm:p-7"><button onClick={() => navigate(lessonId ? `/student/lessons/${lessonId}` : "/student")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700"><ArrowLeft size={17}/> Return to lesson</button><button onClick={() => { setAnswers({}); setCurrent(0); setResult(null); setSubmitted(false); submittedRef.current = false; setChecked({}); setError(null); }} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700"><RotateCcw size={17}/> Practice again</button></div>
      </section>}
      {celebrating && <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 top-5 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-xl"><div className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Volume2 size={22}/></div><div><p className="font-extrabold text-slate-900">You did it!</p><p className="text-sm text-slate-600">Activity completed. Rewards are on their way.</p></div><Sparkles className="ml-auto text-amber-500" size={22}/></div>}
    </div>
  </main>;
}

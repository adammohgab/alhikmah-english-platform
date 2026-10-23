import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, Check, LoaderCircle, Sparkles, X } from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import { env } from "@/shared/config/env";

type QuestionType = "multiple_choice" | "fill_blank" | "matching" | "short_answer";
type GeneratedQuestion = {
  prompt: string;
  question_type: QuestionType;
  options: Record<string, unknown> | null;
  correct_answer: string | string[] | Record<string, unknown>;
  explanation: string;
  points: number;
  difficulty: "Easy" | "Medium" | "Hard";
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (count: number) => void;
};

const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "fill_blank", label: "Fill in the blank" },
  { value: "short_answer", label: "Short answer" },
  { value: "matching", label: "Matching" },
];
const db = supabase as any;

function parseGeneratedQuestions(text: string): GeneratedQuestion[] {
  const cleaned = text.trim();
  const start = cleaned.indexOf("[");
  if (start < 0) throw new Error("The AI response did not contain a question list. Try generating again.");
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let index = start; index < cleaned.length; index += 1) {
    const character = cleaned[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "[") depth += 1;
    else if (character === "]") {
      depth -= 1;
      if (depth === 0) { end = index; break; }
    }
  }
  if (end <= start) throw new Error("The AI response did not contain a complete question list. Try generating again.");
  const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("The AI response was not a valid question list.");
  const validTypes = new Set<QuestionType>(TYPE_OPTIONS.map((type) => type.value));
  const questions = parsed.map((item): GeneratedQuestion | null => {
    if (!item || typeof item !== "object") return null;
    const row = item as { prompt?: unknown; question_type?: unknown; correct_answer?: unknown; explanation?: unknown; options?: unknown; difficulty?: unknown; points?: unknown };
    const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
    const type = validTypes.has(row.question_type as QuestionType) ? row.question_type as QuestionType : "multiple_choice";
    const answer = row.correct_answer;
    const explanation = typeof row.explanation === "string" ? row.explanation.trim() : "";
    if (!prompt || answer == null || String(answer).trim() === "" || !explanation) return null;
    const choices = Array.isArray(row.options) ? row.options : row.options && typeof row.options === "object" ? (row.options as Record<string, unknown>)["choices"] : undefined;
    const options = type === "multiple_choice"
      ? { choices: Array.isArray(choices) ? choices.filter((choice): choice is string => typeof choice === "string" && Boolean(choice.trim())) : [] }
      : row.options && typeof row.options === "object" && !Array.isArray(row.options) ? row.options as Record<string, unknown> : null;
    if (type === "multiple_choice" && (options?.["choices"] as string[]).length < 3) return null;
    const difficulty = row.difficulty === "Easy" || row.difficulty === "Hard" ? row.difficulty : "Medium";
    const points = typeof row.points === "number" && Number.isFinite(row.points) && row.points > 0 ? row.points : 1;
    return { prompt, question_type: type, options, correct_answer: answer as GeneratedQuestion["correct_answer"], explanation, points, difficulty };
  }).filter((question): question is GeneratedQuestion => question !== null);
  if (questions.length < 5) throw new Error(`Only ${questions.length} valid questions were returned. Please try again or use a longer passage.`);
  return questions;
}

async function requestQuestionGeneration(args: {
  passage: string;
  grade: string;
  count: number;
  types: QuestionType[];
  signal: AbortSignal;
  onProgress: (text: string) => void;
}): Promise<GeneratedQuestion[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Please sign in again before generating questions.");
  const typeInstructions = args.types.map((type) => TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type).join(", ");
  const message = [
    "Create reading-comprehension questions grounded only in the supplied passage.",
    `Return exactly ${args.count} questions for ${args.grade}. Allowed types: ${typeInstructions}.`,
    'Output a single JSON array only. Each item must have prompt, question_type (multiple_choice, fill_blank, short_answer, matching), options (multiple choice uses {\"choices\":[3-4 strings]}, otherwise object or null), correct_answer, explanation (passage-based rationale), points (positive number), and difficulty (Easy, Medium, Hard). Every answer must be supported by the passage; no invented facts or duplicates. Multiple choice must have exactly one correct option.', 
    `TARGET GRADE: ${args.grade}`,
    "PASSAGE START",
    args.passage,
    "PASSAGE END",
  ].join("\n\n");
  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`, {
    method: "POST",
    signal: args.signal,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.VITE_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ message, workspace_state: { page: "/teacher/question-bank", grade_level: args.grade, subject: "English reading comprehension" } }),
  });
  if (!response.ok) {
    let detail = "The AI service could not generate questions. Please try again.";
    try {
      const body = await response.json() as { error?: { message?: string }; message?: string };
      detail = body.error?.message || body.message || detail;
    } catch { /* Keep the actionable fallback for non-JSON gateway responses. */ }
    throw new Error(detail);
  }
  if (!response.body) throw new Error("The AI service returned an empty response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
        if (!data) continue;
        try {
          const event = JSON.parse(data) as { chunk?: string; delta?: string; text?: string; message?: string; error?: { message?: string } };
          const chunk = event.delta ?? event.chunk ?? event.text;
          if (typeof chunk === "string") {
            fullText += chunk;
            args.onProgress(fullText);
          }
          if (event.error?.message) throw new Error(event.error.message);
        } catch (cause) {
          if (cause instanceof Error && cause.message !== "Unexpected end of JSON input") throw cause;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (!fullText.trim()) throw new Error("The AI service returned no question content. Please try again.");
  return parseGeneratedQuestions(fullText);
}

export default function AiQuestionGeneratorModal({ open, onClose, onSaved }: Props) {
  const [passage, setPassage] = useState("");
  const [grade, setGrade] = useState("Grade 8");
  const [count, setCount] = useState(5);
  const [types, setTypes] = useState<QuestionType[]>(["multiple_choice", "short_answer"]);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [chosen, setChosen] = useState<number[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [streamPreview, setStreamPreview] = useState("");
  const selectedCount = useMemo(() => chosen.length, [chosen]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setStreamPreview("");
  }, [open]);

  if (!open) return null;

  function toggleType(type: QuestionType) {
    setTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    const text = passage.trim();
    if (text.length < 80) {
      setError("Paste a passage of at least 80 characters so the questions can be grounded in the text.");
      return;
    }
    if (text.length > 1250) {
      setError("This AI endpoint accepts up to 1,250 passage characters per request. Please shorten the passage and try again.");
      return;
    }
    if (!types.length) {
      setError("Choose at least one question type.");
      return;
    }
    const controller = new AbortController();
    setGenerating(true); setError(""); setQuestions([]); setChosen([]); setStreamPreview("");
    try {
      const generated = await requestQuestionGeneration({ passage: text, grade, count, types, signal: controller.signal, onProgress: setStreamPreview });
      setQuestions(generated.slice(0, count));
      setChosen(generated.slice(0, count).map((_, index) => index));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate questions. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveSelected() {
    if (!chosen.length || saving) return;
    setSaving(true); setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Please sign in again before saving questions.");
      const payload = chosen.map((index) => questions[index]).filter(Boolean).map((question) => ({
        prompt: question.prompt,
        question_type: question.question_type,
        options: question.options,
        correct_answer: question.correct_answer,
        explanation: question.explanation,
        points: question.points,
        difficulty: question.difficulty,
        tags: ["Reading", grade],
        grade,
        is_public: false,
        author_id: authData.user.id,
      }));
      if (!payload.length) throw new Error("Select at least one valid question to add.");
      const { error: insertError } = await db.from("questions").insert(payload);
      if (insertError) throw insertError;
      onSaved(payload.length);
      setPassage(""); setQuestions([]); setChosen([]); setStreamPreview("");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add the selected questions to the question bank.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !generating && !saving) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="ai-question-generator-title" className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0px_#000] sm:rounded-2xl sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <div><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-indigo-700"><Sparkles size={14}/> Teacher AI tool</p><h2 id="ai-question-generator-title" className="mt-1 text-2xl font-bold text-slate-900">Generate questions from a passage</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">Create 5–10 passage-aligned questions, review the answer keys, then add only the questions you approve.</p></div>
        <button type="button" aria-label="Close question generator" disabled={generating || saving} onClick={onClose} className="rounded-lg border p-2 hover:bg-slate-50 disabled:opacity-50"><X size={18}/></button>
      </header>
      <form onSubmit={(event) => void generate(event)} className="mt-5 space-y-4">
        <label className="block text-sm font-semibold text-slate-800">Reading passage<textarea value={passage} onChange={(event) => setPassage(event.target.value)} rows={6} required maxLength={1250} placeholder="Paste the reading passage here (up to 1,250 characters)…" className="mt-1 w-full rounded-lg border-2 border-slate-300 p-3 font-normal focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"/><span className="mt-1 block text-xs font-normal text-slate-500">{passage.length.toLocaleString()} / 1,250 characters · Minimum 80 characters</span></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Target grade<select value={grade} onChange={(event) => setGrade(event.target.value)} className="mt-1 w-full rounded-lg border-2 border-slate-300 p-2.5 font-normal">{[7, 8, 9, 10, 11, 12].map((level) => <option key={level} value={`Grade ${level}`}>Grade {level}</option>)}</select></label>
          <label className="block text-sm font-semibold">Number of questions<select value={count} onChange={(event) => setCount(Number(event.target.value))} className="mt-1 w-full rounded-lg border-2 border-slate-300 p-2.5 font-normal">{[5, 6, 7, 8, 9, 10].map((amount) => <option key={amount} value={amount}>{amount} questions</option>)}</select></label>
        </div>
        <fieldset><legend className="text-sm font-semibold">Question types</legend><div className="mt-2 flex flex-wrap gap-2">{TYPE_OPTIONS.map((option) => <label key={option.value} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm ${types.includes(option.value) ? "border-indigo-600 bg-indigo-50 text-indigo-800" : "border-slate-200 bg-white text-slate-700"}`}><input type="checkbox" checked={types.includes(option.value)} onChange={() => toggleType(option.value)} className="accent-indigo-600"/>{option.label}</label>)}</div></fieldset>
        {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle size={17} className="mt-0.5 shrink-0"/><span>{error}</span></div>}
        {generating && <div role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800"><div className="flex items-center gap-2 font-semibold"><LoaderCircle size={16} className="animate-spin"/> Generating and validating questions…</div><p className="mt-1">The response is streamed from the teacher AI service. Please keep this window open.</p>{streamPreview && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs opacity-75">{streamPreview.slice(-360)}</p>}</div>}
        <div className="flex justify-end gap-2"><button type="button" disabled={generating || saving} onClick={onClose} className="rounded-lg border-2 border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button><button type="submit" disabled={generating || saving || passage.trim().length < 80 || !types.length} className="inline-flex items-center gap-2 rounded-lg border-2 border-slate-900 bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-[2px_2px_0px_#000] disabled:cursor-not-allowed disabled:opacity-50">{generating ? <LoaderCircle size={16} className="animate-spin"/> : <Sparkles size={16}/>} {generating ? "Generating…" : "Generate questions"}</button></div>
      </form>
      {questions.length > 0 && <section className="mt-6 border-t-2 border-slate-200 pt-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-lg font-bold">Review generated questions</h3><p className="text-sm text-slate-600">Select the questions to insert. Check the answer keys before adding them.</p></div><button type="button" onClick={() => setChosen(chosen.length === questions.length ? [] : questions.map((_, index) => index))} className="self-start text-sm font-semibold text-indigo-700">{chosen.length === questions.length ? "Deselect all" : "Select all"}</button></div>
        <div className="mt-3 space-y-3">{questions.map((question, index) => <article key={`${question.prompt}-${index}`} className={`rounded-xl border-2 p-4 ${chosen.includes(index) ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200 bg-white"}`}><div className="flex items-start gap-3"><input type="checkbox" aria-label={`Add question ${index + 1}`} checked={chosen.includes(index)} onChange={(event) => setChosen((current) => event.target.checked ? [...current, index] : current.filter((item) => item !== index))} className="mt-1 h-4 w-4 accent-indigo-600"/><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-slate-100 px-2 py-1">{TYPE_OPTIONS.find((option) => option.value === question.question_type)?.label}</span><span className="rounded-full bg-slate-100 px-2 py-1">{question.difficulty}</span><span className="rounded-full bg-slate-100 px-2 py-1">{question.points} pt{question.points === 1 ? "" : "s"}</span></div><h4 className="mt-2 font-semibold text-slate-900">{index + 1}. {question.prompt}</h4>{question.question_type === "multiple_choice" && <ul className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">{((question.options?.["choices"] as string[]) ?? []).map((choice, choiceIndex) => <li key={`${choice}-${choiceIndex}`} className="rounded-md border border-slate-200 bg-white px-2 py-1">{String.fromCharCode(65 + choiceIndex)}. {choice}</li>)}</ul>}<div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs font-bold uppercase text-emerald-800">Answer key</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-emerald-950">{typeof question.correct_answer === "string" ? question.correct_answer : JSON.stringify(question.correct_answer, null, 2)}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-600">Rationale</p><p className="mt-1 text-sm text-slate-700">{question.explanation}</p></div></div></div></div></article>)}</div>
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600">{selectedCount} of {questions.length} selected</p><button type="button" onClick={() => void saveSelected()} disabled={!chosen.length || saving || generating} className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-slate-900 bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[2px_2px_0px_#000] disabled:cursor-not-allowed disabled:opacity-50">{saving ? <LoaderCircle size={16} className="animate-spin"/> : <Check size={16}/>} {saving ? "Adding to Question Bank…" : `Add ${chosen.length} to Question Bank`}</button></div>
      </section>}
    </section>
  </div>;
}

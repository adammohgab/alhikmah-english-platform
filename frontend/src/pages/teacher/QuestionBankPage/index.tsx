import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { BookOpen, Copy, Download, Filter, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import AiQuestionGeneratorModal from "./AiQuestionGeneratorModal";

type QuestionType = "multiple_choice" | "fill_blank" | "matching" | "short_answer" | "audio_spelling" | "drag_drop" | "reorder";
type Difficulty = "Easy" | "Medium" | "Hard";
type Question = {
  id: string; prompt: string; question_type: QuestionType; options: Record<string, unknown> | unknown[] | null;
  correct_answer: unknown; explanation: string | null; points: number; difficulty: Difficulty | string | null;
  tags: string[] | null; created_at: string; updated_at: string; author_id: string | null; is_public?: boolean;
  times_used?: number; skill?: string; grade?: string;
};
const db = supabase as any;
const TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Multiple choice", fill_blank: "Fill in the blank", matching: "Matching", short_answer: "Short answer",
  audio_spelling: "Listening / spelling", drag_drop: "Drag and drop", reorder: "Reorder",
};
const TAGS = ["Grammar", "Vocabulary", "Reading", "Literature"];
const LEVELS = ["A1", "A2", "B1", "B2"];
const blankQuestion = (): Partial<Question> => ({ prompt: "", question_type: "multiple_choice", options: { choices: ["", ""] }, correct_answer: "", explanation: "", points: 1, difficulty: "Medium", tags: [] });
function prettyDate(value: string) { return value ? new Date(value).toLocaleDateString() : "—"; }
function answerText(value: unknown): string {
  if (value == null || value === "") return "No answer key provided";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

/** TC-19 question bank: searchable, faceted question library with editable previews and quiz insertion. */
export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [usedFilter, setUsedFilter] = useState("all");
  const [sort, setSort] = useState("updated");
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<Question | null>(null);
  const [editing, setEditing] = useState<Partial<Question> | null>(null);
  const [busy, setBusy] = useState(false);
  const [quizModal, setQuizModal] = useState(false);
  const [quizzes, setQuizzes] = useState<{ id: string; title: string }[]>([]);
  const [targetQuiz, setTargetQuiz] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [{ data: authData }, { data, error: queryError }] = await Promise.all([
        supabase.auth.getUser(),
        db.from("questions").select("id,prompt,question_type,options,correct_answer,explanation,points,difficulty,tags,created_at,updated_at,author_id,grade,is_public").order("updated_at", { ascending: false }).limit(1500),
      ]);
      if (queryError) throw queryError;
      setCurrentUser(authData.user?.id ?? null);
      const rows = (data ?? []) as Question[];
      let usage: Record<string, number> = {};
      if (rows.length) {
        const { data: links } = await db.from("assessment_questions").select("question_id");
        for (const link of links ?? []) usage[link.question_id] = (usage[link.question_id] ?? 0) + 1;
      }
      setQuestions(rows.map((q) => ({ ...q, times_used: usage[q.id] ?? 0 })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the question bank.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return questions.filter((q) => {
      const tags = q.tags ?? [];
      const matchesText = !term || `${q.prompt} ${tags.join(" ")} ${q.explanation ?? ""} ${TYPE_LABELS[q.question_type] ?? q.question_type}`.toLowerCase().includes(term);
      return matchesText && (typeFilter === "all" || q.question_type === typeFilter) &&
        (levelFilter === "all" || q.grade === levelFilter || tags.some((tag) => tag.toUpperCase() === levelFilter)) &&
        (tagFilter === "all" || tags.some((tag) => tag.toLowerCase() === tagFilter.toLowerCase())) &&
        (difficultyFilter === "all" || (q.difficulty ?? "").toLowerCase() === difficultyFilter.toLowerCase()) &&
        (sourceFilter === "all" || (sourceFilter === "mine" ? q.author_id === currentUser : q.author_id !== currentUser)) &&
        (usedFilter === "all" || (usedFilter === "used" ? (q.times_used ?? 0) > 0 : (q.times_used ?? 0) === 0));
    }).sort((a, b) => sort === "difficulty" ? ["Easy", "Medium", "Hard"].indexOf(a.difficulty ?? "Medium") - ["Easy", "Medium", "Hard"].indexOf(b.difficulty ?? "Medium") : sort === "used" ? (b.times_used ?? 0) - (a.times_used ?? 0) : sort === "prompt" ? a.prompt.localeCompare(b.prompt) : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [questions, search, typeFilter, levelFilter, tagFilter, difficultyFilter, sourceFilter, usedFilter, sort, currentUser]);
  const allVisibleSelected = filtered.length > 0 && filtered.every((q) => selected.includes(q.id));

  async function saveQuestion(event: FormEvent) {
    event.preventDefault(); if (!editing) return;
    setBusy(true); setError("");
    try {
      const payload = { prompt: String(editing.prompt ?? "").trim(), question_type: editing.question_type ?? "multiple_choice", options: editing.options ?? {}, correct_answer: editing.correct_answer ?? "", explanation: editing.explanation ?? "", points: Number(editing.points ?? 1), difficulty: editing.difficulty ?? "Medium", tags: editing.tags ?? [], grade: editing.grade ?? null, is_public: Boolean(editing.is_public), author_id: currentUser };
      if (!payload.prompt) throw new Error("Enter a question prompt first.");
      if (editing.id) {
        const { error: updateError } = await db.from("questions").update(payload).eq("id", editing.id);
        if (updateError) throw updateError;
        setNotice("Question updated.");
      } else {
        const { error: insertError } = await db.from("questions").insert(payload);
        if (insertError) throw insertError;
        setNotice("Question added to your bank.");
      }
      setEditing(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the question."); }
    finally { setBusy(false); }
  }
  async function duplicateQuestion(q: Question) {
    setBusy(true); setError("");
    try {
      const { error: insertError } = await db.from("questions").insert({ prompt: `${q.prompt} (copy)`, question_type: q.question_type, options: q.options, correct_answer: q.correct_answer, explanation: q.explanation, points: q.points, difficulty: q.difficulty, tags: q.tags ?? [], grade: q.grade ?? null, is_public: false, author_id: currentUser });
      if (insertError) throw insertError;
      setNotice("Question duplicated."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not duplicate question."); }
    finally { setBusy(false); }
  }
  async function deleteQuestions(ids: string[]) {
    if (!ids.length || !window.confirm(`Delete ${ids.length} question${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const { error: deleteError } = await db.from("questions").delete().in("id", ids);
      if (deleteError) throw deleteError;
      setSelected([]); setPreview(null); setNotice("Question(s) deleted."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete questions."); }
    finally { setBusy(false); }
  }
  async function openQuizPicker(ids: string[]) {
    setSelected(ids); setError("");
    try {
      const { data, error: quizError } = await db.from("assessments").select("id,title").eq("kind", "quiz").eq("status", "draft").order("updated_at", { ascending: false }).limit(100);
      if (quizError) throw quizError;
      setQuizzes(data ?? []); setTargetQuiz(data?.[0]?.id ?? ""); setQuizModal(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load quiz drafts."); }
  }
  async function addSelectedToQuiz(event: FormEvent) {
    event.preventDefault(); if (!targetQuiz || !selected.length) return;
    setBusy(true);
    try {
      const { data: existing, error: existingError } = await db.from("assessment_questions").select("question_id,order_index").eq("assessment_id", targetQuiz);
      if (existingError) throw existingError;
      const already = new Set((existing ?? []).map((r: { question_id: string }) => r.question_id));
      const toAdd = selected.filter((id) => !already.has(id));
      const start = Math.max(-1, ...(existing ?? []).map((r: { order_index: number }) => r.order_index ?? -1)) + 1;
      if (toAdd.length) {
        const { error: insertError } = await db.from("assessment_questions").insert(toAdd.map((question_id, index) => ({ assessment_id: targetQuiz, question_id, order_index: start + index })));
        if (insertError) throw insertError;
      }
      setNotice(toAdd.length ? `Added ${toAdd.length} question(s) to the quiz.` : "All selected questions are already in that quiz.");
      setQuizModal(false); setSelected([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add questions to the quiz."); }
    finally { setBusy(false); }
  }
  function exportQuestions(rows: Question[]) {
    const blob = new Blob([JSON.stringify(rows.map(({ id, prompt, question_type, options, correct_answer, explanation, points, difficulty, tags }) => ({ id, prompt, question_type, options, correct_answer, explanation, points, difficulty, tags })), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "question-bank-export.json"; link.click(); URL.revokeObjectURL(url);
  }
  function patchEditing(patch: Partial<Question>) { setEditing((current) => current ? { ...current, ...patch } : current); }

  return <main className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="mb-1 text-sm font-semibold uppercase tracking-wide text-indigo-600">Teacher workspace · TC-19</p><h1 className="text-3xl font-bold tracking-tight text-slate-900">Question bank</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Search, review, reuse, and organize curriculum questions in one place.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setAiOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"><Sparkles size={16}/> Generate with AI</button><button type="button" disabled title="Import is coming soon" className="rounded-lg border px-3 py-2 text-sm text-slate-400">Import · Coming soon</button><button type="button" onClick={() => setEditing(blankQuestion())} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Plus size={16}/> Add question</button></div>
    </header>
    {notice && <div role="status" className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}<button aria-label="Dismiss message" onClick={() => setNotice("")}><X size={16}/></button></div>}
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
    <section className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2 font-semibold text-slate-800"><Filter size={17}/> Filters <button className="ml-auto text-xs font-medium text-indigo-600" onClick={() => { setTypeFilter("all"); setLevelFilter("all"); setTagFilter("all"); setDifficultyFilter("all"); setSourceFilter("all"); setUsedFilter("all"); }}>Reset</button></div>
        <label className="mb-4 block text-sm font-medium text-slate-700">Source<select className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}><option value="all">All sources</option><option value="mine">Mine</option><option value="school">School library / others</option></select></label>
        <label className="mb-4 block text-sm font-medium text-slate-700">Question type<select className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">All types</option>{Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="mb-4 block text-sm font-medium text-slate-700">CEFR level<select className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}><option value="all">All levels</option>{LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label>
        <label className="mb-4 block text-sm font-medium text-slate-700">Difficulty<select className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal" value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}><option value="all">All difficulties</option>{["Easy", "Medium", "Hard"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="mb-4 block text-sm font-medium text-slate-700">Tags / topics<select className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}><option value="all">All topics</option>{TAGS.map((tag) => <option key={tag}>{tag}</option>)}</select></label>
        <label className="block text-sm font-medium text-slate-700">Usage history<select className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal" value={usedFilter} onChange={(e) => setUsedFilter(e.target.value)}><option value="all">Any usage</option><option value="used">Used in a quiz</option><option value="unused">Not used yet</option></select></label>
      </aside>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input aria-label="Search questions" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search prompts, explanations, or tags…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500"/></div>
          <label className="flex items-center gap-2 text-sm text-slate-600">Sort by<select className="rounded-lg border border-slate-300 p-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value)}><option value="updated">Recently edited</option><option value="difficulty">Difficulty</option><option value="used">Most used</option><option value="prompt">Prompt A–Z</option></select></label>
        </div>
        {selected.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg bg-indigo-50 p-3 text-sm"><strong>{selected.length} selected</strong><button onClick={() => void openQuizPicker(selected)} className="rounded-md bg-indigo-600 px-3 py-1.5 font-semibold text-white">Add to quiz</button><button onClick={() => exportQuestions(questions.filter((q) => selected.includes(q.id)))} className="rounded-md border bg-white px-3 py-1.5">Export</button><button onClick={() => void deleteQuestions(selected)} className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-red-700">Delete</button><button onClick={() => setSelected([])} className="ml-auto text-slate-600">Clear selection</button></div>}
        <div className="flex items-center justify-between px-1 text-sm text-slate-500"><span>{loading ? "Loading questions…" : `${filtered.length} question${filtered.length === 1 ? "" : "s"}`}</span><button onClick={() => exportQuestions(filtered)} className="inline-flex items-center gap-1.5 hover:text-indigo-700"><Download size={15}/> Export results</button></div>
        {loading ? <div className="rounded-xl border bg-white p-8 text-center text-slate-500">Loading your question bank…</div> : filtered.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><BookOpen className="mx-auto mb-3 text-slate-400" size={34}/><h2 className="font-semibold text-slate-800">{questions.length ? "No questions match these filters" : "Your question bank is empty"}</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{questions.length ? "Try changing your search or resetting the filters." : "Add a question to get started, or use Generate with AI to prepare drafts for review."}</p>{questions.length === 0 && <button onClick={() => setEditing(blankQuestion())} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Add your first question</button>}</div> : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"><input aria-label="Select all visible questions" type="checkbox" checked={allVisibleSelected} onChange={(e) => setSelected(e.target.checked ? Array.from(new Set([...selected, ...filtered.map((q) => q.id)])) : selected.filter((id) => !filtered.some((q) => q.id === id)))}/><span className="flex-1">Question · Type · Topic</span><span className="hidden sm:block">Usage</span><span>Actions</span></div>
          <div className="divide-y divide-slate-100">{filtered.map((q) => <article key={q.id} className="flex gap-3 px-4 py-4 hover:bg-slate-50/70"><input className="mt-1" aria-label={`Select ${q.prompt}`} type="checkbox" checked={selected.includes(q.id)} onChange={(e) => setSelected((old) => e.target.checked ? [...old, q.id] : old.filter((id) => id !== q.id))}/><button className="min-w-0 flex-1 text-left" onClick={() => setPreview(q)}><p className="line-clamp-2 font-medium text-slate-900">{q.prompt}</p><div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{TYPE_LABELS[q.question_type] ?? q.question_type}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{q.difficulty ?? "Unrated"}</span>{(q.tags ?? []).map((tag) => <span key={tag} className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600">{tag}</span>)}</div><p className="mt-2 text-xs text-slate-400">{q.points} point{q.points === 1 ? "" : "s"} · Edited {prettyDate(q.updated_at)}</p></button><div className="hidden min-w-14 text-center text-sm text-slate-600 sm:block">{q.times_used ?? 0}<p className="text-xs text-slate-400">uses</p></div><div className="flex flex-col gap-1 sm:flex-row"><button title="Preview" aria-label="Preview question" onClick={() => setPreview(q)} className="rounded-md p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"><BookOpen size={16}/></button><button title="Edit" aria-label="Edit question" onClick={() => setEditing({ ...q, tags: q.tags ?? [] })} className="rounded-md p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"><Pencil size={16}/></button><button title="Duplicate" aria-label="Duplicate question" disabled={busy} onClick={() => void duplicateQuestion(q)} className="rounded-md p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"><Copy size={16}/></button><button title="Add to quiz" aria-label="Add to quiz" onClick={() => void openQuizPicker([q.id])} className="rounded-md p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"><Plus size={16}/></button><button title="Export question" aria-label="Export question" onClick={() => exportQuestions([q])} className="rounded-md p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"><Download size={16}/></button><button title="Delete" aria-label="Delete question" onClick={() => void deleteQuestions([q.id])} className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 size={16}/></button></div></article>)}</div>
        </div>}
      </div>
    </section>


    {(preview || editing || quizModal) && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) { setPreview(null); setEditing(null); setQuizModal(false); setAiOpen(false); } }}>
      {preview && <section role="dialog" aria-modal="true" aria-labelledby="preview-title" className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Question preview</p><h2 id="preview-title" className="mt-1 text-xl font-bold">{preview.prompt}</h2></div><button aria-label="Close preview" onClick={() => setPreview(null)}><X/></button></div><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">{TYPE_LABELS[preview.question_type] ?? preview.question_type}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{preview.points} points</span><span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{preview.difficulty ?? "Unrated"}</span></div><div className="mt-5 rounded-xl border p-4"><h3 className="font-semibold">Student view</h3>{Array.isArray((preview.options as any)?.choices) ? <div className="mt-3 grid gap-2">{((preview.options as any).choices as string[]).map((choice, index) => <div key={`${choice}-${index}`} className="rounded-lg border px-3 py-2">{String.fromCharCode(65 + index)}. {choice}</div>)}</div> : <p className="mt-2 text-sm text-slate-500">Interactive answer area for {TYPE_LABELS[preview.question_type] ?? preview.question_type}.</p>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-emerald-50 p-3"><h3 className="text-sm font-semibold text-emerald-800">Answer key</h3><pre className="mt-1 whitespace-pre-wrap break-words text-sm text-emerald-900">{answerText(preview.correct_answer)}</pre></div><div className="rounded-lg bg-slate-50 p-3"><h3 className="text-sm font-semibold">Explanation</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{preview.explanation || "No explanation provided."}</p></div></div><div className="mt-5 flex flex-wrap justify-end gap-2"><button onClick={() => { setEditing({ ...preview, tags: preview.tags ?? [] }); setPreview(null); }} className="rounded-lg border px-4 py-2 text-sm">Edit</button><button onClick={() => void openQuizPicker([preview.id])} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Add to quiz</button></div></section>}
      {editing && <form onSubmit={(e) => void saveQuestion(e)} role="dialog" aria-modal="true" aria-labelledby="edit-title" className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"><div className="flex items-center justify-between"><h2 id="edit-title" className="text-xl font-bold">{editing.id ? "Edit question" : "Add question"}</h2><button type="button" aria-label="Close editor" onClick={() => setEditing(null)}><X/></button></div><label className="block text-sm font-medium">Prompt<textarea required rows={3} value={String(editing.prompt ?? "")} onChange={(e) => patchEditing({ prompt: e.target.value })} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">Question type<select className="mt-1 w-full rounded-lg border p-2 font-normal" value={String(editing.question_type ?? "multiple_choice")} onChange={(e) => patchEditing({ question_type: e.target.value as QuestionType })}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm font-medium">Difficulty<select className="mt-1 w-full rounded-lg border p-2 font-normal" value={String(editing.difficulty ?? "Medium")} onChange={(e) => patchEditing({ difficulty: e.target.value })}>{["Easy", "Medium", "Hard"].map((d) => <option key={d}>{d}</option>)}</select></label><label className="block text-sm font-medium">Points<input type="number" min="0" step="0.5" value={Number(editing.points ?? 1)} onChange={(e) => patchEditing({ points: Number(e.target.value) })} className="mt-1 w-full rounded-lg border p-2 font-normal"/></label><label className="block text-sm font-medium">CEFR / grade<input placeholder="e.g. A2" value={String(editing.grade ?? "")} onChange={(e) => patchEditing({ grade: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border p-2 font-normal"/></label></div><label className="block text-sm font-medium">Choices (one per line, for multiple choice)<textarea rows={3} value={Array.isArray((editing.options as any)?.choices) ? ((editing.options as any).choices as string[]).join("\n") : ""} onChange={(e) => patchEditing({ options: { ...((editing.options as object) ?? {}), choices: e.target.value.split("\n") } })} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="block text-sm font-medium">Answer key<textarea rows={2} value={typeof editing.correct_answer === "string" ? editing.correct_answer : answerText(editing.correct_answer)} onChange={(e) => patchEditing({ correct_answer: e.target.value })} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="block text-sm font-medium">Explanation<textarea rows={2} value={String(editing.explanation ?? "")} onChange={(e) => patchEditing({ explanation: e.target.value })} className="mt-1 w-full rounded-lg border p-3 font-normal"/></label><label className="block text-sm font-medium">Tags (comma-separated)<input value={(editing.tags ?? []).join(", ")} onChange={(e) => patchEditing({ tags: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} className="mt-1 w-full rounded-lg border p-2 font-normal"/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(editing.is_public)} onChange={(e) => patchEditing({ is_public: e.target.checked })}/> Share with school library</label><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save question"}</button></div></form>}
      {quizModal && <form onSubmit={(e) => void addSelectedToQuiz(e)} role="dialog" aria-modal="true" aria-labelledby="quiz-picker-title" className="w-full max-w-lg space-y-4 rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"><div className="flex items-center justify-between"><h2 id="quiz-picker-title" className="text-xl font-bold">Add to quiz draft</h2><button type="button" onClick={() => setQuizModal(false)} aria-label="Close quiz picker"><X/></button></div><p className="text-sm text-slate-600">Choose a draft quiz to insert {selected.length} selected question(s).</p>{quizzes.length ? <label className="block text-sm font-medium">Quiz draft<select required value={targetQuiz} onChange={(e) => setTargetQuiz(e.target.value)} className="mt-1 w-full rounded-lg border p-3 font-normal">{quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}</select></label> : <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No draft quizzes were found. Create a quiz draft first, then try again.</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setQuizModal(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={busy || !quizzes.length || !targetQuiz} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Adding…" : "Add questions"}</button></div></form>}

    </div>}
    <AiQuestionGeneratorModal
      open={aiOpen}
      onClose={() => setAiOpen(false)}
      onSaved={(count) => { setNotice(`Added ${count} AI-generated question${count === 1 ? "" : "s"} to your bank.`); void load(); }}
    />
  </main>;
}

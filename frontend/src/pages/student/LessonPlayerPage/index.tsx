import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookmarkPlus, BookOpen, Check, CheckCircle2, ChevronDown, Clock3, Download, Headphones, LoaderCircle, Pause, Play, Volume2 } from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import { Button } from "@/shared/components/ui/Button";
import { useToast } from "@/shared/hooks/useToast";

type Loose = Record<string, any>;
type LessonPayload = { lesson?: Loose; blocks?: Loose[]; prev_id?: string | null; next_id?: string | null; outline?: Loose[]; resources?: Loose[]; notes?: string | null; completed?: boolean; activities?: Loose[] };
const rpc = (fn: string, args: Record<string, unknown>) => (supabase.rpc.bind(supabase) as unknown as (name: string, params: Record<string, unknown>) => Promise<{data: any; error: {message: string} | null}>)(fn, args);
const str = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const array = (value: unknown): Loose[] => Array.isArray(value) ? value : [];
const blockType = (block: Loose) => str(block.type ?? block.block_type, "text").toLowerCase().replaceAll("-", "_");
const content = (block: Loose): Loose => block.content && typeof block.content === "object" ? block.content : block;

export default function LessonPlayerPage() {
  const { lessonId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const courseId = searchParams.get("courseId") ?? "";
  const unitId = searchParams.get("unitId") ?? "";
  const [payload, setPayload] = useState<LessonPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeBlock, setActiveBlock] = useState(0);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showTranscript, setShowTranscript] = useState<Record<string, boolean>>({});
  const [checkAnswers, setCheckAnswers] = useState<Record<string, number>>({});
  const [checkRevealed, setCheckRevealed] = useState<Record<string, boolean>>({});
  const [toolsOpen, setToolsOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const lesson = payload?.lesson ?? {};
  const blocks = useMemo(() => [...array(payload?.blocks)].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0)), [payload?.blocks]);
  const title = str(lesson.title, "Lesson");

  const loadLesson = useCallback(async () => {
    if (!lessonId) { setError("This lesson link is missing its lesson ID."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const args: Record<string, unknown> = { lesson_id: lessonId };
      if (courseId) args.course_id = courseId;
      const result = await rpc("get_lesson", args);
      if (result.error) throw new Error(result.error.message);
      const data = result.data as LessonPayload | null;
      if (!data) throw new Error("This lesson could not be found or is not available to your account.");
      setPayload(data); setNotes(str(data.notes)); setCompleted(Boolean(data.completed));
      const touched = await rpc("touch_lesson", { lesson_id: lessonId });
      if (touched.error) console.warn("Could not mark lesson as accessed", touched.error.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this lesson. Please try again.");
    } finally { setLoading(false); }
  }, [lessonId, courseId]);

  useEffect(() => { void loadLesson(); }, [loadLesson]);
  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  const speak = (text: string) => {
    if (!("speechSynthesis" in window) || !text.trim()) {
      toast.show({ title: "Audio is unavailable", description: "Your browser does not support speech playback.", type: "error" }); return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US"; utterance.rate = 0.9;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const saveNotes = async () => {
    setNotesSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Please sign in again to save your notes.");
      const { error: saveError } = await supabase.from("lesson_progress").upsert({
        student_id: authData.user.id, lesson_id: lessonId, course_id: courseId || null, notes,
      }, { onConflict: "student_id,lesson_id" });
      if (saveError) throw saveError;
      toast.show({ title: "Notes saved", description: "Your lesson notes have been saved.", type: "success" });
    } catch (cause) { toast.show({ title: "Could not save notes", description: cause instanceof Error ? cause.message : "Please try again.", type: "error" }); }
    finally { setNotesSaving(false); }
  };

  const completeLesson = async () => {
    if (completed) return;
    setCompleting(true);
    try {
      const idempotencyKey = globalThis.crypto?.randomUUID?.();
      if (!idempotencyKey) throw new Error("This browser cannot create a secure progress reference.");
      const result = await rpc("complete_lesson", { lesson_id: lessonId, course_id: courseId || null, idempotency_key: idempotencyKey });
      if (result.error) throw new Error(result.error.message);
      setCompleted(true);
      toast.show({ title: "Lesson complete!", description: "You earned 20 XP. Great work!", type: "success" });
      const activities = array(payload?.activities ?? lesson.activities);
      if (activities.length) {
        const first = activities[0];
        const activityId = str(first.id ?? first.activity_id);
        if (activityId && window.confirm("Lesson complete! Would you like to continue to the activities now?")) navigate(unitId ? `/student/units/${unitId}` : "/student/courses");
      }
    } catch (cause) { toast.show({ title: "Could not complete lesson", description: cause instanceof Error ? cause.message : "Please try again.", type: "error" }); }
    finally { setCompleting(false); }
  };

  const addWord = async (word: Loose) => {
    const id = word.vocab_item_id ?? word.id;
    if (!id) { toast.show({ title: "Word saved for review", description: `${str(word.word, "This word")} is highlighted in this lesson.`, type: "success" }); return; }
    const result = await rpc("add_words_to_library", { items: [{ word: str(word.word), part_of_speech: str(word.pos) || null, meaning: str(word.meaning) || null, arabic_meaning: str(word.arabic) || null, example: str(word.example) || null, vocab_item_id: id }], from: "lesson" });
    if (result.error) toast.show({ title: "Could not add word", description: result.error.message, type: "error" });
    else toast.show({ title: "Added to your library", description: str(word.word), type: "success" });
  };

  const renderBlock = (block: Loose, index: number) => {
    const c = content(block); const type = blockType(block); const key = str(block.id, `${type}-${index}`);
    if (["text", "introduction", "reading", "reading_passage", "dialogue"].includes(type)) {
      const html = str(c.html ?? c.text ?? c.body ?? c.passage ?? c.dialogue);
      const heading = str(c.title ?? c.heading, type === "introduction" ? "Introduction" : type === "dialogue" ? "Dialogue" : type === "reading" || type === "reading_passage" ? "Reading passage" : "");
      return <section key={key} id={key} className="scroll-mt-24 rounded-2xl border border-stroke bg-surface-0 p-5 sm:p-7">{heading && <h2 className="mb-3 font-display text-xl font-bold text-ink">{heading}</h2>}{html.includes("<") ? <div className="prose prose-slate max-w-none leading-8 text-ink" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="whitespace-pre-wrap text-base leading-8 text-ink">{html || "Lesson content will appear here."}</p>}</section>;
    }
    if (["keywords", "key_words", "vocabulary", "vocabulary_spotlight"].includes(type)) {
      const words = array(c.items ?? c.words ?? c.vocabulary);
      return <section key={key} id={key} className="scroll-mt-24 rounded-2xl border border-world-amber-300/50 bg-world-amber-100/40 p-5 sm:p-7"><div className="mb-4 flex items-center gap-2"><BookOpen size={20}/><h2 className="font-display text-xl font-bold text-ink">{str(c.title, "Vocabulary spotlight")}</h2></div><div className="grid gap-3 sm:grid-cols-2">{words.map((word, wi) => <article key={str(word.id, `${word.word}-${wi}`)} className="rounded-xl border border-stroke/30 bg-surface-0 p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-ink">{str(word.word, "Key word")}</h3>{word.pos && <span className="text-xs italic text-muted">{str(word.pos)}</span>}</div><button type="button" onClick={() => speak(str(word.word))} className="rounded-lg p-2 text-primary hover:bg-primary/10" aria-label={`Pronounce ${str(word.word)}`}><Volume2 size={18}/></button></div><p className="mt-2 text-sm text-ink">{str(word.meaning ?? word.arabic, "Meaning not provided.")}</p>{word.arabic && word.meaning && <p className="mt-1 text-sm text-muted" dir="rtl">{str(word.arabic)}</p>}{word.example && <p className="mt-2 border-l-2 border-primary/40 pl-3 text-sm italic text-muted">{str(word.example)}</p>}<button type="button" onClick={() => void addWord(word)} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary"><BookmarkPlus size={14}/> Add to my library</button></article>)}</div></section>;
    }
    if (type === "audio") {
      const transcript = str(c.transcript ?? c.text); const url = str(c.url ?? c.src ?? c.audio_url);
      return <section key={key} id={key} className="scroll-mt-24 rounded-2xl border border-stroke bg-surface-0 p-5 sm:p-7"><div className="mb-3 flex items-center gap-2"><Headphones size={20}/><h2 className="font-display text-xl font-bold">Audio pronunciation</h2></div>{url ? <audio controls preload="none" className="w-full" src={url}>Your browser does not support audio playback.</audio> : <button type="button" onClick={() => speak(transcript)} className="flex min-h-12 items-center gap-3 rounded-xl bg-primary px-4 font-bold text-white"><Play size={18}/> Play narration</button>}{transcript && <><button type="button" className="mt-3 text-sm font-semibold text-primary" onClick={() => setShowTranscript(v => ({...v, [key]: !v[key]}))}>{showTranscript[key] ? "Hide transcript" : "Show transcript"}</button>{showTranscript[key] && <p className="mt-3 rounded-xl bg-surface-1 p-4 leading-7">{transcript}</p>}</>}</section>;
    }
    if (type === "video") {
      const url = str(c.url ?? c.src); const transcript = str(c.transcript ?? c.captions);
      const embed = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)?.[1];
      return <section key={key} id={key} className="scroll-mt-24 rounded-2xl border border-stroke bg-surface-0 p-5 sm:p-7"><h2 className="mb-3 font-display text-xl font-bold">{str(c.title, "Lesson video")}</h2>{embed ? <div className="aspect-video overflow-hidden rounded-xl"><iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${embed}`} title={str(c.title, "Lesson video")} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div> : url ? <video controls playsInline className="aspect-video w-full rounded-xl bg-black" src={url} /> : <div className="flex aspect-video items-center justify-center rounded-xl bg-surface-1 text-muted"><Play className="mr-2"/> Video is not available yet</div>}{transcript && <button type="button" onClick={() => setShowTranscript(v => ({...v, [key]: !v[key]}))} className="mt-3 text-sm font-semibold text-primary">{showTranscript[key] ? "Hide captions" : "Show captions"}</button>}{showTranscript[key] && <p className="mt-2 rounded-xl bg-surface-1 p-4 leading-7">{transcript}</p>}</section>;
    }
    if (type === "image") { const url = str(c.url ?? c.src); return <figure key={key} id={key} className="scroll-mt-24 overflow-hidden rounded-2xl border border-stroke bg-surface-0 p-3">{url ? <img src={url} alt={str(c.alt, "Lesson illustration")} loading="lazy" className="mx-auto max-h-[32rem] rounded-xl object-contain"/> : <p className="p-8 text-center text-muted">{str(c.alt, "Illustration unavailable")}</p>}{c.caption && <figcaption className="p-2 text-center text-sm text-muted">{str(c.caption)}</figcaption>}</figure>; }
    if (type === "example") return <section key={key} id={key} className="scroll-mt-24 rounded-2xl border-l-4 border-primary bg-primary/5 p-5"><h2 className="font-bold">{str(c.title, "Example")}</h2><p className="mt-2 text-lg leading-8 text-ink">{str(c.sentence ?? c.text)}</p>{c.note && <p className="mt-2 text-sm text-muted">{str(c.note)}</p>}</section>;
    if (type === "check" || type === "check_yourself") { const questions = array(c.questions); return <section key={key} id={key} className="scroll-mt-24 rounded-2xl border border-stroke bg-surface-0 p-5 sm:p-7"><h2 className="mb-4 font-display text-xl font-bold">{str(c.title, "Check yourself")}</h2><div className="space-y-5">{questions.map((q, qi) => { const qid = str(q.id, `${key}-q${qi}`); const options = array(q.options ?? q.choices); const correct = Number(q.correct_index ?? q.answer_index ?? q.correctIndex ?? -1); return <div key={qid} className="rounded-xl bg-surface-1 p-4"><p className="font-semibold">{qi + 1}. {str(q.question ?? q.prompt)}</p><div className="mt-3 grid gap-2">{options.map((opt, oi) => <button type="button" key={oi} onClick={() => { setCheckAnswers(v => ({...v, [qid]: oi})); setCheckRevealed(v => ({...v, [qid]: true})); }} className={`rounded-lg border p-3 text-left text-sm ${checkAnswers[qid] === oi ? "border-primary bg-primary/10" : "border-stroke/40 bg-surface-0"}`}>{typeof opt === "string" ? opt : str(opt.text ?? opt.label)}</button>)}</div>{checkRevealed[qid] && <p className="mt-2 text-sm text-muted">{correct >= 0 ? checkAnswers[qid] === correct ? "Correct!" : "Not quite — try reviewing the lesson." : "Good try! Review the lesson and continue when ready."} {str(q.explanation)}</p>}</div>; })}</div></section>; }
    if (type === "resources") { const items = array(c.items); return <section key={key} className="rounded-2xl border border-stroke bg-surface-0 p-5"><h2 className="mb-3 font-bold">Resources</h2>{items.length ? items.map((item, i) => { const url = str(item.url); return <a key={i} href={url || undefined} target={url ? "_blank" : undefined} rel="noreferrer" className="flex items-center gap-2 py-2 text-sm font-semibold text-primary"><Download size={16}/>{str(item.label, `Resource ${i + 1}`)}</a>; }) : <p className="text-sm text-muted">No additional resources.</p>}</section>; }
    return <section key={key} id={key} className="rounded-2xl border border-stroke bg-surface-0 p-5"><h2 className="font-bold">{str(c.title, type.replaceAll("_", " "))}</h2><p className="mt-2 whitespace-pre-wrap leading-7">{str(c.text ?? c.html ?? c.description, "")}</p></section>;
  };

  if (loading) return <main className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center gap-3 px-4 text-muted"><LoaderCircle className="animate-spin"/> Loading your lesson…</main>;
  if (error) return <main className="mx-auto max-w-3xl px-4 py-12"><div className="rounded-2xl border border-red-300 bg-red-50 p-6"><h1 className="text-xl font-bold text-red-900">Could not open lesson</h1><p className="mt-2 text-sm text-red-800">{error}</p><Button className="mt-4" onClick={() => void loadLesson()}>Try again</Button></div></main>;

  return <main className="min-h-screen bg-surface-1/40 pb-28 text-ink">
    <header className="sticky top-0 z-30 border-b border-stroke bg-surface-0/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6"><Link to={unitId ? `/student/units/${unitId}` : "/student"} className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-muted hover:text-ink"><ArrowLeft size={17}/><span className="hidden sm:inline">Back</span></Link><div className="min-w-0 flex-1 text-center"><p className="truncate text-xs font-semibold text-muted">{str(lesson.course_title ?? lesson.unit_title, "Your learning journey")}</p><p className="truncate font-bold">{title}</p></div><button type="button" onClick={() => setToolsOpen(v => !v)} className="rounded-xl border border-stroke px-3 py-2 text-sm font-semibold">Tools <ChevronDown size={14} className="inline"/></button></div></header>
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5"><div className="rounded-2xl bg-primary/10 p-5 sm:p-7"><div className="flex flex-wrap items-center gap-2 text-xs font-bold text-primary"><span className="rounded-full bg-surface-0 px-3 py-1">{completed ? "Completed · Review mode" : "Interactive lesson"}</span><span className="inline-flex items-center gap-1"><Clock3 size={13}/>{Number(lesson.minutes ?? lesson.estimated_minutes ?? 10)} min</span>{array(lesson.skills).map((skill, i) => <span key={i} className="rounded-full border border-primary/20 px-2 py-1">{String(skill).replaceAll("_", " ")}</span>)}</div><h1 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">{title}</h1>{lesson.summary && <p className="mt-3 max-w-2xl leading-7 text-muted">{str(lesson.summary)}</p>}</div>
        {blocks.length ? blocks.map((block, i) => renderBlock(block, i)) : <section className="rounded-2xl border border-stroke bg-surface-0 p-6"><p className="text-muted">This lesson has no published content blocks yet.</p></section>}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stroke bg-surface-0 p-4"><Button variant="outline" disabled={!payload?.prev_id} onClick={() => payload?.prev_id && navigate(`/student/lessons/${payload.prev_id}${searchParams.size ? `?${searchParams.toString()}` : ""}`)}><ArrowLeft size={16} className="mr-2"/>Previous lesson</Button><Button onClick={() => void completeLesson()} disabled={completing || completed}>{completing ? <LoaderCircle size={16} className="mr-2 animate-spin"/> : completed ? <Check size={16} className="mr-2"/> : <CheckCircle2 size={16} className="mr-2"/>}{completed ? "Completed" : "Mark as complete"}</Button><Button variant="outline" disabled={!payload?.next_id} onClick={() => payload?.next_id && navigate(`/student/lessons/${payload.next_id}${searchParams.size ? `?${searchParams.toString()}` : ""}`)}>Next lesson <ArrowRight size={16} className="ml-2"/></Button></div>
      </div>
      <aside className={`${toolsOpen ? "block" : "hidden"} space-y-4 lg:sticky lg:top-20 lg:block lg:self-start`}><section className="rounded-2xl border border-stroke bg-surface-0 p-4"><h2 className="font-display text-lg font-bold">Lesson outline</h2><nav className="mt-3 space-y-1">{blocks.map((block, i) => { const key = str(block.id, `${blockType(block)}-${i}`); const label = str(content(block).title ?? content(block).heading, blockType(block).replaceAll("_", " ").replace(/^./, s => s.toUpperCase())); return <button key={key} type="button" onClick={() => { setActiveBlock(i); document.getElementById(key)?.scrollIntoView({behavior:"smooth",block:"start"}); }} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${activeBlock === i ? "bg-primary/10 font-bold text-primary" : "text-muted hover:bg-surface-1"}`}>{i + 1}. {label}</button>; })}</nav></section><section className="rounded-2xl border border-stroke bg-surface-0 p-4"><h2 className="font-display text-lg font-bold">My notes</h2><p className="mt-1 text-xs text-muted">Notes are private to your learning account.</p><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} maxLength={5000} placeholder="Write a reminder or a question…" className="mt-3 w-full resize-y rounded-xl border border-stroke bg-surface-0 p-3 text-sm outline-none focus:ring-2 focus:ring-primary"/><Button variant="outline" className="mt-2 w-full" disabled={notesSaving} onClick={() => void saveNotes()}>{notesSaving && <LoaderCircle size={15} className="mr-2 animate-spin"/>}Save notes</Button></section><section className="rounded-2xl border border-stroke bg-surface-0 p-4"><h2 className="font-display text-lg font-bold">Need a hand?</h2><p className="mt-1 text-sm text-muted">Ask the AI tutor about this lesson.</p><Button variant="outline" className="mt-3 w-full" onClick={() => navigate(`/student/ai-tutor?lessonId=${encodeURIComponent(lessonId)}&lessonTitle=${encodeURIComponent(title)}`)}>Ask AI Tutor</Button></section>{array(payload?.resources).length > 0 && <section className="rounded-2xl border border-stroke bg-surface-0 p-4"><h2 className="font-display text-lg font-bold">Resources</h2>{array(payload?.resources).map((resource, i) => <a key={i} href={str(resource.url) || undefined} className="mt-2 flex items-center gap-2 text-sm text-primary"><Download size={15}/>{str(resource.label, `Resource ${i+1}`)}</a>)}</section>}</aside>
    </div>
    {speaking && <div className="fixed bottom-24 right-4 z-40"><Button variant="outline" onClick={() => { window.speechSynthesis.cancel(); setSpeaking(false); }}><Pause size={16} className="mr-2"/>Stop narration</Button></div>}
  </main>;
}

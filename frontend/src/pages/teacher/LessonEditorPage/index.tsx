import { useCallback, useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useParams } from "react-router-dom";
import {
  ArrowDown, ArrowUp, Eye, EyeOff, FileAudio, FileImage, GripVertical, Headphones,
  ImagePlus, MessageCircle, Plus, Save, Sparkles, Trash2, Upload, Volume2, X,
} from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import { TeacherAppShell } from "@/shared/components/layout/TeacherAppShell";

type BlockType = "text" | "vocabulary" | "dialogue" | "audio" | "image" | "quiz";
type LessonBlock = { id: string; lesson_id: string; block_type: BlockType; content: Record<string, any>; order_index: number };
type Lesson = { id: string; title: string; description: string | null; unit_id: string; xp_reward: number };
const BLOCKS: { type: BlockType; label: string; description: string; icon: typeof Sparkles }[] = [
  { type: "text", label: "Text / Exposition", description: "Rich text lesson content", icon: Sparkles },
  { type: "vocabulary", label: "Vocabulary Spotlight", description: "Word, meaning and example", icon: Volume2 },
  { type: "dialogue", label: "Dialogue / Conversation", description: "Speaker turns", icon: MessageCircle },
  { type: "audio", label: "Audio Narration", description: "Attach an audio file", icon: Headphones },
  { type: "image", label: "Image Card", description: "Image with caption", icon: FileImage },
  { type: "quiz", label: "Interactive Quiz Question", description: "Multiple-choice check", icon: Sparkles },
];
const uid = () => globalThis.crypto?.randomUUID?.() ?? `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
function makeBlock(type: BlockType, lessonId: string, order: number): LessonBlock {
  const content: Record<string, any> = type === "text" ? { html: "<p>Write your lesson content here…</p>" }
    : type === "vocabulary" ? { word: "New word", meaning: "Meaning", example: "An example sentence." }
    : type === "dialogue" ? { turns: [{ speaker: "Speaker A", text: "Hello!" }, { speaker: "Speaker B", text: "Hi there!" }] }
    : type === "audio" ? { url: "", title: "Listen and learn", transcript: "" }
    : type === "image" ? { url: "", alt: "Learning illustration", caption: "" }
    : { question: "Check your understanding", options: ["Option A", "Option B", "Option C"], correctIndex: 0, explanation: "" };
  return { id: uid(), lesson_id: lessonId, block_type: type, content, order_index: order };
}

export default function LessonEditorPage() {
  const { lessonId = "" } = useParams();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setNotice("");
    try {
      const db = supabase as any;
      const { data: lessonData, error: lessonError } = await db.from("lessons").select("id,title,description,unit_id,xp_reward").eq("id", lessonId).single();
      if (lessonError) throw lessonError;
      const { data: blockData, error: blocksError } = await db.from("lesson_blocks").select("id,lesson_id,block_type,content,order_index").eq("lesson_id", lessonId).order("order_index", { ascending: true });
      if (blocksError) throw blocksError;
      setLesson(lessonData as Lesson);
      setBlocks(((blockData ?? []) as LessonBlock[]).map((b) => ({ ...b, content: b.content ?? {} })));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not load this lesson. Check the lesson link and your teacher permissions."); }
    finally { setLoading(false); }
  }, [lessonId]);
  useEffect(() => { void load(); }, [load]);

  const updateBlock = (id: string, patch: Partial<LessonBlock>) => setBlocks((old) => old.map((b) => b.id === id ? { ...b, ...patch, content: patch.content ? { ...b.content, ...patch.content } : b.content } : b));
  const addBlock = (type: BlockType) => setBlocks((old) => [...old, makeBlock(type, lessonId, old.length)]);
  const removeBlock = (id: string) => setBlocks((old) => old.filter((b) => b.id !== id).map((b, i) => ({ ...b, order_index: i })));
  const moveBlock = (id: string, to: number) => setBlocks((old) => {
    const from = old.findIndex((b) => b.id === id); if (from < 0 || to < 0 || to >= old.length) return old;
    const next = [...old]; const item = next.splice(from, 1)[0]; if (!item) return old; next.splice(to, 0, item);
    return next.map((b, i) => ({ ...b, order_index: i }));
  });
  const save = async () => {
    if (!lesson) return;
    setSaving(true); setNotice("");
    try {
      const db = supabase as any;
      const { error: lessonError } = await db.from("lessons").update({ title: lesson.title, description: lesson.description, xp_reward: lesson.xp_reward }).eq("id", lesson.id);
      if (lessonError) throw lessonError;
      const { error: deleteError } = await db.from("lesson_blocks").delete().eq("lesson_id", lesson.id);
      if (deleteError) throw deleteError;
      if (blocks.length) {
        const rows = blocks.map((b, i) => ({ lesson_id: lesson.id, block_type: b.block_type, content: b.content, order_index: i }));
        const { error: insertError } = await db.from("lesson_blocks").insert(rows);
        if (insertError) throw insertError;
      }
      await load(); setNotice("Lesson saved successfully.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save lesson blocks."); }
    finally { setSaving(false); }
  };
  const upload = async (block: LessonBlock, file?: File) => {
    if (!file) return;
    const isAudio = block.block_type === "audio";
    if (isAudio ? !file.type.startsWith("audio/") : !file.type.startsWith("image/")) { setNotice(isAudio ? "Choose an audio file." : "Choose an image file."); return; }
    setUploadingId(block.id); setNotice("");
    try {
      const path = `lessons/${lessonId}/${uid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { data, error } = await supabase.storage.from("lesson-media").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("lesson-media").getPublicUrl(data.path);
      updateBlock(block.id, { content: { url: urlData.publicUrl, ...(isAudio ? { title: block.content.title || file.name } : { alt: block.content.alt || file.name }) } });
      setNotice("Media uploaded. Save the lesson to keep the attachment.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Upload failed. Check the lesson-media storage bucket and its policies."); }
    finally { setUploadingId(null); }
  };

  return <TeacherAppShell classes={[]} pendingSubmissions={null} title="Lesson editor" fallbackTitle="Lesson editor">
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-bold uppercase tracking-widest text-amber-600">Teacher studio · TC-11</p><h1 className="mt-1 text-3xl font-black">Modular lesson editor</h1><p className="mt-2 text-sm text-slate-500">Build a student-ready lesson from rich content, vocabulary, dialogue, media and quick checks.</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => setPreview((v) => !v)} className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-800 px-4 py-2 font-bold hover:bg-slate-100">{preview ? <EyeOff size={18}/> : <Eye size={18}/>} {preview ? "Edit blocks" : "Live preview"}</button><button type="button" disabled={saving || loading || !lesson} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-amber-300 px-4 py-2 font-black shadow-[3px_3px_0_#0f172a] disabled:opacity-50"><Save size={18}/>{saving ? "Saving…" : "Save lesson"}</button></div>
      </div>
      {notice && <p role="status" className="mb-4 rounded-xl border border-slate-200 bg-white p-3 text-sm">{notice}</p>}
      {loading ? <div className="rounded-2xl border-2 border-slate-200 bg-white p-8">Loading lesson…</div> : !lesson ? <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-6">Lesson could not be loaded. Verify the lesson ID and teacher access, then refresh.</div> : <>
        <section className="mb-6 grid gap-4 rounded-2xl border-2 border-slate-200 bg-white p-5 md:grid-cols-[1fr_2fr_130px]">
          <label className="text-sm font-bold">Lesson title<input className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-base font-normal" value={lesson.title} onChange={(e) => setLesson({ ...lesson, title: e.target.value })}/></label>
          <label className="text-sm font-bold">Student-facing description<textarea className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-base font-normal" rows={2} value={lesson.description ?? ""} onChange={(e) => setLesson({ ...lesson, description: e.target.value })}/></label>
          <label className="text-sm font-bold">XP reward<input type="number" min={0} max={1000} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-base font-normal" value={lesson.xp_reward} onChange={(e) => setLesson({ ...lesson, xp_reward: Math.max(0, Number(e.target.value) || 0) })}/></label>
        </section>
        {preview ? <Preview lesson={lesson} blocks={blocks}/> : <div className="grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="rounded-2xl border-2 border-slate-200 bg-white p-4 lg:sticky lg:top-4"><h2 className="font-black">Add a block</h2><p className="mb-3 mt-1 text-xs text-slate-500">Choose a block to add it to the lesson.</p><div className="grid gap-2">{BLOCKS.map(({ type, label, description, icon: Icon }) => <button type="button" key={type} onClick={() => addBlock(type)} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50"><span className="rounded-lg bg-slate-100 p-2"><Icon size={18}/></span><span className="min-w-0"><span className="block text-sm font-bold">{label}</span><span className="block text-xs text-slate-500">{description}</span></span><Plus size={16} className="ml-auto shrink-0"/></button>)}</div></aside>
          <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Lesson flow <span className="text-sm font-medium text-slate-500">({blocks.length} blocks)</span></h2><span className="text-xs text-slate-500">Drag using the handle or use arrows</span></div>
            {blocks.length === 0 && <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center"><Sparkles className="mx-auto mb-3 text-amber-500"/><h3 className="font-black">Start with your first block</h3><p className="mt-1 text-sm text-slate-500">Add exposition, vocabulary, a conversation, media or a quiz question.</p></div>}
            {blocks.map((block, index) => <BlockCard key={block.id} block={block} index={index} total={blocks.length} updateBlock={updateBlock} removeBlock={removeBlock} moveBlock={moveBlock} upload={upload} uploading={uploadingId === block.id}/>)}</section>
        </div>}
      </>}
      <p className="mt-8 text-xs text-slate-400">Media uploads use the Supabase Storage bucket <code>lesson-media</code>. Preview is rendered from the same block data saved to <code>lesson_blocks</code>.</p>
    </main>
  </TeacherAppShell>;
}

function BlockCard({ block, index, total, updateBlock, removeBlock, moveBlock, upload, uploading }: { block: LessonBlock; index: number; total: number; updateBlock: (id: string, patch: Partial<LessonBlock>) => void; removeBlock: (id: string) => void; moveBlock: (id: string, to: number) => void; upload: (block: LessonBlock, file?: File) => Promise<void>; uploading: boolean }) {
  const meta = BLOCKS.find((b) => b.type === block.block_type)!;
  const patch = (values: Record<string, any>) => updateBlock(block.id, { content: { ...block.content, ...values } });
  const inputClass = "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm";
  return <article draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", block.id); e.dataTransfer.effectAllowed = "move"; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const dragged = e.dataTransfer.getData("text/plain"); if (dragged && dragged !== block.id) { const sourceIndex = document.querySelectorAll("[data-block-id]"); const ids = Array.from(sourceIndex).map((node) => (node as HTMLElement).dataset.blockId); const from = ids.indexOf(dragged); if (from >= 0) moveBlock(dragged, index); } }} data-block-id={block.id} className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
    <header className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2"><span title="Drag to reorder" className="cursor-grab text-slate-400"><GripVertical size={20}/></span><span className="rounded-md bg-amber-100 p-1.5 text-amber-800"><meta.icon size={16}/></span><div className="min-w-0 flex-1"><p className="text-sm font-black">{meta.label}</p><p className="text-xs text-slate-500">Block {index + 1}</p></div><button title="Move up" type="button" disabled={index === 0} onClick={() => moveBlock(block.id, index - 1)} className="rounded p-1 hover:bg-slate-200 disabled:opacity-30"><ArrowUp size={16}/></button><button title="Move down" type="button" disabled={index === total - 1} onClick={() => moveBlock(block.id, index + 1)} className="rounded p-1 hover:bg-slate-200 disabled:opacity-30"><ArrowDown size={16}/></button><button title="Delete block" type="button" onClick={() => removeBlock(block.id)} className="rounded p-1 text-rose-600 hover:bg-rose-50"><Trash2 size={16}/></button></header>
    <div className="space-y-3 p-4">{block.block_type === "text" && <RichTextBlock html={String(block.content.html ?? "")} onChange={(html) => patch({ html })}/>} 
      {block.block_type === "vocabulary" && <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Word or phrase<input className={inputClass} value={block.content.word ?? ""} onChange={(e) => patch({ word: e.target.value })}/></label><label className="text-xs font-bold">Meaning<input className={inputClass} value={block.content.meaning ?? ""} onChange={(e) => patch({ meaning: e.target.value })}/></label><label className="text-xs font-bold sm:col-span-2">Example sentence<textarea className={inputClass} rows={2} value={block.content.example ?? ""} onChange={(e) => patch({ example: e.target.value })}/></label></div>}
      {block.block_type === "dialogue" && <DialogueEditor turns={block.content.turns ?? []} onChange={(turns) => patch({ turns })}/>} 
      {block.block_type === "audio" && <><label className="text-xs font-bold">Audio title<input className={inputClass} value={block.content.title ?? ""} onChange={(e) => patch({ title: e.target.value })}/></label><MediaPicker accept="audio/*" uploading={uploading} onPick={(file) => void upload(block, file)} label="Upload audio"/><label className="text-xs font-bold">Transcript (optional)<textarea className={inputClass} rows={2} value={block.content.transcript ?? ""} onChange={(e) => patch({ transcript: e.target.value })}/></label>{block.content.url && <audio controls src={block.content.url} className="w-full"/>}</>}
      {block.block_type === "image" && <><MediaPicker accept="image/*" uploading={uploading} onPick={(file) => void upload(block, file)} label="Upload image"/><label className="text-xs font-bold">Image URL<input className={inputClass} value={block.content.url ?? ""} onChange={(e) => patch({ url: e.target.value })}/></label><label className="text-xs font-bold">Alt text<input className={inputClass} value={block.content.alt ?? ""} onChange={(e) => patch({ alt: e.target.value })}/></label><label className="text-xs font-bold">Caption<input className={inputClass} value={block.content.caption ?? ""} onChange={(e) => patch({ caption: e.target.value })}/></label>{block.content.url && <img src={block.content.url} alt={block.content.alt ?? ""} className="max-h-64 rounded-xl object-contain"/>}</>}
      {block.block_type === "quiz" && <QuizEditor content={block.content} onChange={patch}/>} 
    </div>
  </article>;
}

function RichTextBlock({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const editor = useEditor({ extensions: [StarterKit], content: html, onUpdate: ({ editor: current }) => onChange(current.getHTML()) });
  useEffect(() => { if (editor && editor.getHTML() !== html && !editor.isFocused) editor.commands.setContent(html || "<p></p>"); }, [editor, html]);
  return <div className="overflow-hidden rounded-xl border border-slate-300"><div className="flex gap-2 border-b bg-slate-50 px-3 py-2 text-xs text-slate-500">Rich text editor · headings · bold · lists</div><EditorContent editor={editor} className="min-h-[140px] p-3 [&_.tiptap]:min-h-[120px] [&_.tiptap]:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_h2]:text-xl [&_h2]:font-bold"/></div>;
}
function DialogueEditor({ turns, onChange }: { turns: { speaker?: string; text?: string }[]; onChange: (turns: { speaker: string; text: string }[]) => void }) {
  return <div className="space-y-2">{turns.map((turn, i) => <div key={i} className="grid gap-2 sm:grid-cols-[140px_1fr_auto]"><input aria-label={`Speaker ${i + 1}`} className="rounded-lg border p-2 text-sm" value={turn.speaker ?? ""} onChange={(e) => onChange(turns.map((t, j) => j === i ? { ...t, speaker: e.target.value } : { speaker: t.speaker ?? "", text: t.text ?? "" }))}/><input aria-label={`Dialogue line ${i + 1}`} className="rounded-lg border p-2 text-sm" value={turn.text ?? ""} onChange={(e) => onChange(turns.map((t, j) => j === i ? { ...t, text: e.target.value } : { speaker: t.speaker ?? "", text: t.text ?? "" }))}/><button type="button" onClick={() => onChange(turns.filter((_, j) => j !== i))} className="rounded-lg border px-2 text-rose-600" aria-label="Remove dialogue line"><X size={16}/></button></div>)}<button type="button" onClick={() => onChange([...turns, { speaker: `Speaker ${String.fromCharCode(65 + turns.length)}`, text: "" }])} className="rounded-lg border px-3 py-2 text-sm font-bold">+ Add dialogue turn</button></div>;
}
function QuizEditor({ content, onChange }: { content: Record<string, any>; onChange: (values: Record<string, any>) => void }) {
  const options: string[] = content.options ?? ["Option A", "Option B", "Option C"];
  return <div className="space-y-3"><label className="block text-xs font-bold">Question<textarea className="mt-1 w-full rounded-lg border p-2 text-sm" rows={2} value={content.question ?? ""} onChange={(e) => onChange({ question: e.target.value })}/></label>{options.map((option, i) => <div key={i} className="flex items-center gap-2"><input aria-label={`Correct answer option ${i + 1}`} type="radio" checked={Number(content.correctIndex ?? 0) === i} onChange={() => onChange({ correctIndex: i })}/><input aria-label={`Answer option ${i + 1}`} className="flex-1 rounded-lg border p-2 text-sm" value={option} onChange={(e) => onChange({ options: options.map((v, j) => i === j ? e.target.value : v) })}/><span className="text-xs text-slate-400">{Number(content.correctIndex ?? 0) === i ? "Correct" : ""}</span></div>)}<button type="button" onClick={() => onChange({ options: [...options, `Option ${String.fromCharCode(65 + options.length)}`] })} className="rounded-lg border px-3 py-2 text-sm font-bold">+ Add answer option</button><label className="block text-xs font-bold">Explanation after answer<textarea className="mt-1 w-full rounded-lg border p-2 text-sm" rows={2} value={content.explanation ?? ""} onChange={(e) => onChange({ explanation: e.target.value })}/></label></div>;
}
function MediaPicker({ accept, uploading, onPick, label }: { accept: string; uploading: boolean; onPick: (file?: File) => void; label: string }) {
  const id = useMemo(() => `media-${uid()}`, []);
  return <div className="flex flex-wrap items-center gap-3"><label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold hover:bg-slate-50">{accept.startsWith("audio") ? <FileAudio size={16}/> : <ImagePlus size={16}/>}<Upload size={15}/>{uploading ? "Uploading…" : label}</label><input id={id} type="file" accept={accept} disabled={uploading} className="sr-only" onChange={(e) => { onPick(e.target.files?.[0]); e.currentTarget.value = ""; }}/>{uploading && <span className="text-xs text-slate-500">Uploading to lesson storage…</span>}</div>;
}
function Preview({ lesson, blocks }: { lesson: Lesson; blocks: LessonBlock[] }) {
  return <section className="mx-auto max-w-3xl rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm sm:p-10"><div className="mb-6 border-b border-slate-200 pb-5"><p className="text-xs font-black uppercase tracking-widest text-amber-600">Lesson preview</p><h2 className="mt-2 text-3xl font-black">{lesson.title}</h2>{lesson.description && <p className="mt-2 text-slate-600">{lesson.description}</p>}<p className="mt-3 text-sm font-bold text-amber-700">✦ {lesson.xp_reward} XP</p></div><div className="space-y-6">{blocks.map((block) => <div key={block.id} className="min-w-0">{block.block_type === "text" && <div className="prose max-w-none [&_ul]:list-disc [&_ol]:list-decimal" dangerouslySetInnerHTML={{ __html: String(block.content.html ?? "") }}/>} {block.block_type === "vocabulary" && <div className="rounded-2xl border-l-4 border-amber-400 bg-amber-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-amber-700">Vocabulary spotlight</p><h3 className="mt-1 text-2xl font-black">{block.content.word}</h3><p>{block.content.meaning}</p><p className="mt-2 italic text-slate-600">“{block.content.example}”</p></div>} {block.block_type === "dialogue" && <div className="space-y-2">{(block.content.turns ?? []).map((turn: any, i: number) => <div key={i} className={`max-w-[90%] rounded-2xl p-3 ${i % 2 ? "ml-auto bg-sky-50" : "bg-slate-100"}`}><p className="text-xs font-bold text-slate-500">{turn.speaker}</p>{turn.text}</div>)}</div>} {block.block_type === "audio" && <div className="rounded-2xl bg-slate-50 p-4"><h3 className="mb-2 font-black"><Headphones className="mr-2 inline" size={18}/>{block.content.title}</h3>{block.content.url ? <audio controls src={block.content.url} className="w-full"/> : <p className="text-sm text-slate-500">Audio file has not been attached.</p>}{block.content.transcript && <p className="mt-2 text-sm">{block.content.transcript}</p>}</div>} {block.block_type === "image" && <figure>{block.content.url && <img src={block.content.url} alt={block.content.alt ?? ""} className="max-h-96 w-full rounded-2xl object-contain"/>}{block.content.caption && <figcaption className="mt-2 text-center text-sm text-slate-500">{block.content.caption}</figcaption>}</figure>} {block.block_type === "quiz" && <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-indigo-700">Quick check</p><h3 className="my-2 font-black">{block.content.question}</h3><div className="grid gap-2">{(block.content.options ?? []).map((option: string, i: number) => <div key={i} className="rounded-lg border bg-white p-3 text-sm">{option}</div>)}</div></div>}</div>)}</div>{blocks.length === 0 && <p className="text-center text-slate-500">Add blocks to see the lesson preview.</p>}</section>;
}

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { BookOpen, Check, ChevronDown, ChevronRight, Clock3, GripVertical, Layers3, Plus, Save, Settings2, Trash2, X } from "lucide-react";
import { supabase } from "@/shared/api/supabase";

type Lesson = {
  id: string;
  unit_id: string;
  title: string;
  position: number;
  minutes: number | null;
  xp_reward?: number;
  cefr_level?: string;
};
type Unit = {
  id: string;
  title: string;
  description?: string | null;
  position: number;
  lessons: Lesson[];
};
type SelectedNode = { type: "unit"; id: string } | { type: "lesson"; id: string } | null;
const db = supabase as any;
const levels = ["Pre-A1", "A1", "A2", "B1", "B2", "C1"];

/** Course outline editor. Native drag-and-drop keeps reordering available without an extra runtime dependency. */
export default function CourseBuilderPage() {
  const { courseId = "" } = useParams<{ courseId: string }>();
  const [courseTitle, setCourseTitle] = useState("Course outline");
  const [units, setUnits] = useState<Unit[]>([]);
  const [selected, setSelected] = useState<SelectedNode>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dragged, setDragged] = useState<{ type: "unit" | "lesson"; id: string; unitId?: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadOutline = useCallback(async () => {
    if (!courseId) {
      setError("Course ID is missing from the URL.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [{ data: course, error: courseError }, { data: unitRows, error: unitError }] = await Promise.all([
        db.from("courses").select("id,title").eq("id", courseId).maybeSingle(),
        db.from("course_units").select("position,unit:units(id,title,description,owner_course_id)").eq("course_id", courseId).order("position", { ascending: true }),
      ]);
      if (courseError) throw courseError;
      if (unitError) throw unitError;
      if (course?.title) setCourseTitle(course.title);
      const normalizedUnits = (unitRows ?? []).map((row: any) => ({ ...(Array.isArray(row.unit) ? row.unit[0] : row.unit), position: row.position }));
      const ids = normalizedUnits.map((unit: any) => unit.id);
      let lessonRows: any[] = [];
      if (ids.length) {
        const { data, error: lessonError } = await db.from("lessons").select("id,unit_id,title,position,minutes").in("unit_id", ids).order("position", { ascending: true });
        if (lessonError) throw lessonError;
        lessonRows = data ?? [];
      }
      setUnits(normalizedUnits.map((unit: any) => ({
        id: unit.id,
        title: unit.title ?? "Untitled unit",
        description: unit.description,
        position: unit.position ?? 0,
        lessons: lessonRows.filter((lesson) => lesson.unit_id === unit.id).map((lesson) => ({ ...lesson, minutes: lesson.minutes ?? 15, xp_reward: 10, cefr_level: "A1" })),
      })));
      setExpanded(Object.fromEntries(ids.map((id: string) => [id, true])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this course outline.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { void loadOutline(); }, [loadOutline]);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const queueSave = useCallback((next: Unit[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    setNotice("Changes pending…");
    saveTimer.current = setTimeout(async () => {
      try {
        for (const [unitIndex, unit] of next.entries()) {
          const { error: unitError } = await db.from("course_units").update({ position: unitIndex }).eq("course_id", courseId).eq("unit_id", unit.id);
          if (unitError) throw unitError;
          for (const [lessonIndex, lesson] of unit.lessons.entries()) {
            const { error: lessonError } = await db.from("lessons").update({ position: lessonIndex, unit_id: unit.id }).eq("id", lesson.id);
            if (lessonError) throw lessonError;
          }
        }
        setNotice("All changes saved");
        setError("");
      } catch (cause) {
        setNotice("Could not save changes");
        setError(cause instanceof Error ? cause.message : "Save failed. Your edits are still visible here.");
      } finally { setSaving(false); }
    }, 650);
  }, [courseId]);

  const updateOutline = (updater: (current: Unit[]) => Unit[]) => {
    setUnits((current) => {
      const next = updater(current).map((unit, position) => ({ ...unit, position, lessons: unit.lessons.map((lesson, lessonPosition) => ({ ...lesson, position: lessonPosition })) }));
      queueSave(next);
      return next;
    });
  };

  const addUnit = async () => {
    const title = `Unit ${units.length + 1}`;
    try {
      const { data, error: insertError } = await db.from("units").insert({ owner_course_id: courseId, title, status: "draft" }).select("id,title,description").single();
      if (insertError) throw insertError;
      const unit: Unit = { ...data, position: units.length, lessons: [] };
      setUnits((current) => [...current, unit]);
      setExpanded((current) => ({ ...current, [unit.id]: true }));
      setSelected({ type: "unit", id: unit.id });
      setNotice("Unit added");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add unit."); }
  };

  const addLesson = async (unitId: string) => {
    const unit = units.find((item) => item.id === unitId);
    if (!unit) return;
    try {
      const { data, error: insertError } = await db.from("lessons").insert({ unit_id: unitId, title: `Lesson ${unit.lessons.length + 1}`, position: unit.lessons.length, minutes: 15, status: "draft" }).select("id,unit_id,title,position,minutes").single();
      if (insertError) throw insertError;
      const lesson: Lesson = { ...data, xp_reward: 10, cefr_level: "A1" };
      setUnits((current) => current.map((item) => item.id === unitId ? { ...item, lessons: [...item.lessons, lesson] } : item));
      setExpanded((current) => ({ ...current, [unitId]: true }));
      setSelected({ type: "lesson", id: lesson.id });
      setDrawerOpen(true);
      setNotice("Lesson added");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add lesson."); }
  };

  const selectedUnit = selected?.type === "unit" ? units.find((unit) => unit.id === selected.id) : undefined;
  const selectedLesson = selected?.type === "lesson" ? units.flatMap((unit) => unit.lessons).find((lesson) => lesson.id === selected.id) : undefined;
  const totalLessons = useMemo(() => units.reduce((total, unit) => total + unit.lessons.length, 0), [units]);
  const totalMinutes = useMemo(() => units.reduce((total, unit) => total + unit.lessons.reduce((sum, lesson) => sum + (Number(lesson.minutes) || 0), 0), 0), [units]);

  const dropUnit = (targetId: string) => {
    if (!dragged || dragged.type !== "unit" || dragged.id === targetId) return;
    updateOutline((current) => {
      const from = current.findIndex((unit) => unit.id === dragged.id);
      const to = current.findIndex((unit) => unit.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current]; const [item] = next.splice(from, 1); if (!item) return current; next.splice(to, 0, item); return next;
    });
    setDragged(null);
  };
  const dropLesson = (targetUnitId: string, targetId: string) => {
    if (!dragged || dragged.type !== "lesson" || dragged.id === targetId) return;
    updateOutline((current) => {
      const next = current.map((unit) => ({ ...unit, lessons: [...unit.lessons] }));
      const sourceUnit = next.find((unit) => unit.id === dragged.unitId);
      const targetUnit = next.find((unit) => unit.id === targetUnitId);
      const from = sourceUnit?.lessons.findIndex((lesson) => lesson.id === dragged.id) ?? -1;
      if (!sourceUnit || !targetUnit || from < 0) return current;
      const [item] = sourceUnit.lessons.splice(from, 1);
      if (!item) return current;
      const to = targetUnit.lessons.findIndex((lesson) => lesson.id === targetId);
      targetUnit.lessons.splice(to < 0 ? targetUnit.lessons.length : to, 0, { ...item, unit_id: targetUnitId });
      return next;
    });
    setDragged(null);
  };

  const renameSelected = (field: "title" | "minutes" | "xp_reward" | "cefr_level", value: string) => {
    if (!selectedLesson) return;
    setUnits((current) => current.map((unit) => ({ ...unit, lessons: unit.lessons.map((lesson) => lesson.id === selectedLesson.id ? { ...lesson, [field]: field === "minutes" || field === "xp_reward" ? Number(value) : value } : lesson) })));
  };
  const saveLessonMetadata = async () => {
    if (!selectedLesson) return;
    try {
      const { error: saveError } = await db.from("lessons").update({ title: selectedLesson.title, minutes: selectedLesson.minutes }).eq("id", selectedLesson.id);
      if (saveError) throw saveError;
      setNotice("Lesson details saved"); setDrawerOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save lesson details."); }
  };

  return <main style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 22px", color: "#17202a", fontFamily: "Inter, system-ui, sans-serif" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      <div><p style={{ color: "#64748b", margin: "0 0 6px", fontSize: 13 }}>TEACHER WORKSPACE / COURSE DESIGN</p><h1 style={{ fontSize: 30, margin: 0 }}>{courseTitle}</h1><p style={{ color: "#64748b", marginBottom: 0 }}>Build a clear learning path by arranging units and lessons.</p></div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><span aria-live="polite" style={{ color: saving ? "#9a6700" : "#64748b", fontSize: 13 }}>{saving ? "Saving…" : notice || "Draft outline"}</span><button onClick={() => void loadOutline()} style={secondaryButton}><Save size={16} /> Refresh</button><button onClick={() => void addUnit()} style={primaryButton}><Plus size={17} /> Add unit</button></div>
    </header>
    {error && <div role="alert" style={{ background: "#fff1f0", border: "1px solid #fecaca", borderRadius: 10, padding: 12, marginBottom: 16, color: "#991b1b" }}>{error}</div>}
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
      <aside style={panelStyle}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #e8edf2" }}><h2 style={{ margin: 0, fontSize: 17 }}>Course outline</h2><p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>Drag units or lessons to reorder.</p></div>
        {loading ? <p style={{ padding: 18 }}>Loading outline…</p> : units.length === 0 ? <div style={{ padding: 24, textAlign: "center" }}><Layers3 size={30} color="#94a3b8" /><p>No units yet.</p><button onClick={() => void addUnit()} style={primaryButton}><Plus size={16} /> Create first unit</button></div> : <div style={{ padding: 10 }}>
          {units.map((unit, index) => <section key={unit.id} onDragOver={(event) => event.preventDefault()} onDrop={() => dropUnit(unit.id)} style={{ marginBottom: 9, border: dragged?.id === unit.id ? "1px dashed #2563eb" : "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
            <div draggable onDragStart={() => setDragged({ type: "unit", id: unit.id })} onDragEnd={() => setDragged(null)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 9px", background: selected?.type === "unit" && selected.id === unit.id ? "#eff6ff" : "#f8fafc", cursor: "grab" }}>
              <GripVertical size={17} color="#94a3b8" /><button aria-label={expanded[unit.id] ? "Collapse unit" : "Expand unit"} onClick={() => setExpanded((current) => ({ ...current, [unit.id]: !current[unit.id] }))} style={iconButton}>{expanded[unit.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
              <button onClick={() => setSelected({ type: "unit", id: unit.id })} style={{ border: 0, background: "transparent", textAlign: "left", flex: 1, fontWeight: 650, color: "#17202a", cursor: "pointer" }}>{index + 1}. {unit.title}</button><span style={{ fontSize: 11, color: "#64748b" }}>{unit.lessons.length}</span>
            </div>
            {expanded[unit.id] && <div style={{ padding: "5px 8px 9px 31px" }}>
              {unit.lessons.map((lesson) => <div key={lesson.id} draggable onDragStart={() => setDragged({ type: "lesson", id: lesson.id, unitId: unit.id })} onDragEnd={() => setDragged(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropLesson(unit.id, lesson.id)} style={{ display: "flex", alignItems: "center", gap: 7, borderRadius: 8, padding: "8px 6px", marginTop: 3, background: selected?.type === "lesson" && selected.id === lesson.id ? "#dbeafe" : "transparent", cursor: "grab" }}>
                <GripVertical size={15} color="#a0aec0" /><BookOpen size={15} color="#64748b" /><button onClick={() => { setSelected({ type: "lesson", id: lesson.id }); setDrawerOpen(true); }} style={{ ...textButton, flex: 1, textAlign: "left" }}>{lesson.title}</button><span style={{ color: "#64748b", fontSize: 11 }}>{lesson.minutes ?? 15}m</span>
              </div>)}
              <button onClick={() => void addLesson(unit.id)} style={{ ...textButton, display: "flex", alignItems: "center", gap: 6, color: "#2563eb", padding: "9px 4px 3px" }}><Plus size={15} /> Add lesson</button>
            </div>}
          </section>)}
          <button onClick={() => void addUnit()} style={{ ...secondaryButton, width: "100%", justifyContent: "center", marginTop: 4 }}><Plus size={16} /> Add unit</button>
        </div>}
      </aside>
      <section style={panelStyle}>
        {!selected && <div style={{ minHeight: 320, display: "grid", placeItems: "center", padding: 32, textAlign: "center" }}><div><Layers3 size={34} color="#94a3b8" /><h2 style={{ marginBottom: 8 }}>Select an item to edit</h2><p style={{ color: "#64748b", maxWidth: 360 }}>Choose a unit or lesson from the outline. You can also drag items to change their order.</p></div></div>}
        {selectedUnit && <div style={{ padding: 24 }}><div style={eyebrow}>UNIT SETTINGS</div><h2 style={{ margin: "8px 0 20px", fontSize: 23 }}>{selectedUnit.title}</h2><label style={labelStyle}>Unit title<input value={selectedUnit.title} onChange={(event) => setUnits((current) => current.map((unit) => unit.id === selectedUnit.id ? { ...unit, title: event.target.value } : unit))} onBlur={async () => { const { error: saveError } = await db.from("units").update({ title: selectedUnit.title }).eq("id", selectedUnit.id); if (saveError) setError(saveError.message); else setNotice("Unit title saved"); }} style={inputStyle} /></label><label style={labelStyle}>Description<textarea value={selectedUnit.description ?? ""} onChange={(event) => setUnits((current) => current.map((unit) => unit.id === selectedUnit.id ? { ...unit, description: event.target.value } : unit))} onBlur={async () => { const { error: saveError } = await db.from("units").update({ description: selectedUnit.description }).eq("id", selectedUnit.id); if (saveError) setError(saveError.message); else setNotice("Unit description saved"); }} rows={4} style={{ ...inputStyle, resize: "vertical" }} /></label><div style={{ background: "#f8fafc", borderRadius: 10, padding: 15, marginTop: 20 }}><strong>{selectedUnit.lessons.length} lessons</strong><p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13 }}>Add lessons to this unit and drag them into the desired sequence.</p><button onClick={() => void addLesson(selectedUnit.id)} style={{ ...primaryButton, marginTop: 12 }}><Plus size={16} /> Add lesson</button></div></div>}
        {selectedLesson && <div style={{ padding: 24 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><div><div style={eyebrow}>LESSON METADATA</div><h2 style={{ margin: "8px 0 4px", fontSize: 23 }}>Lesson details</h2><p style={{ color: "#64748b", marginTop: 0 }}>Set the title, estimated time, and learner level.</p></div><button aria-label="Close lesson details" onClick={() => setDrawerOpen(false)} style={iconButton}><X size={18} /></button></div>
          <label style={labelStyle}>Lesson title<input value={selectedLesson.title} onChange={(event) => renameSelected("title", event.target.value)} style={inputStyle} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}><label style={labelStyle}>Estimated duration (minutes)<span style={{ position: "relative", display: "block" }}><Clock3 size={16} style={{ position: "absolute", top: 13, left: 12, color: "#64748b" }} /><input type="number" min={1} max={240} value={selectedLesson.minutes ?? 15} onChange={(event) => renameSelected("minutes", event.target.value)} style={{ ...inputStyle, paddingLeft: 36 }} /></span></label><label style={labelStyle}>XP reward<input type="number" min={0} max={100} value={selectedLesson.xp_reward ?? 10} onChange={(event) => renameSelected("xp_reward", event.target.value)} style={inputStyle} /></label></div>
          <label style={labelStyle}>CEFR level<select value={selectedLesson.cefr_level ?? "A1"} onChange={(event) => renameSelected("cefr_level", event.target.value)} style={inputStyle}>{levels.map((level) => <option key={level}>{level}</option>)}</select></label>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 24 }}><button onClick={async () => { const { error: deleteError } = await db.from("lessons").delete().eq("id", selectedLesson.id); if (deleteError) { setError(deleteError.message); return; } setUnits((current) => current.map((unit) => ({ ...unit, lessons: unit.lessons.filter((lesson) => lesson.id !== selectedLesson.id) }))); setSelected(null); setDrawerOpen(false); setNotice("Lesson deleted"); }} style={secondaryButton}><Trash2 size={16} /> Delete lesson</button><button onClick={() => void saveLessonMetadata()} style={primaryButton}><Check size={16} /> Save details</button></div>
          {drawerOpen && <p style={{ color: "#64748b", fontSize: 12, marginTop: 14 }}><Settings2 size={13} style={{ verticalAlign: "middle" }} /> XP reward and CEFR level are editor fields; the current lessons table only persists title and duration.</p>}
        </div>}
      </section>
    </div>
    <footer style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 16, color: "#64748b", fontSize: 13 }}><span><Layers3 size={15} style={{ verticalAlign: "middle", marginRight: 5 }} />{units.length} units</span><span><BookOpen size={15} style={{ verticalAlign: "middle", marginRight: 5 }} />{totalLessons} lessons</span><span><Clock3 size={15} style={{ verticalAlign: "middle", marginRight: 5 }} />{totalMinutes} estimated minutes</span><span>{saving ? "Outline saving automatically" : "Outline order autosaves after changes"}</span></footer>
  </main>;
}

const panelStyle: CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 14, background: "#fff", boxShadow: "0 1px 2px rgba(15,23,42,.03)", overflow: "hidden" };
const primaryButton: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, border: "1px solid #1d4ed8", borderRadius: 9, padding: "10px 13px", background: "#2563eb", color: "white", fontWeight: 600, cursor: "pointer" };
const secondaryButton: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #cbd5e1", borderRadius: 9, padding: "9px 12px", background: "white", color: "#334155", fontWeight: 550, cursor: "pointer" };
const iconButton: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 4, border: 0, borderRadius: 6, background: "transparent", color: "#64748b", cursor: "pointer" };
const textButton: CSSProperties = { border: 0, background: "transparent", padding: 4, color: "#334155", cursor: "pointer", font: "inherit", fontSize: 13 };
const labelStyle: CSSProperties = { display: "block", fontSize: 13, fontWeight: 650, color: "#334155", marginTop: 17 };
const inputStyle: CSSProperties = { display: "block", boxSizing: "border-box", width: "100%", marginTop: 7, border: "1px solid #cbd5e1", borderRadius: 8, padding: "11px 12px", font: "inherit", fontSize: 14, color: "#17202a", background: "#fff" };
const eyebrow: CSSProperties = { fontSize: 11, letterSpacing: 1.1, fontWeight: 750, color: "#64748b" };

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Copy, Plus, Save, Trash2, BookOpenCheck, LockKeyhole, Users, RotateCcw } from "lucide-react";
import { supabase } from "@/shared/api/supabase";

type Level = { id: string; name: string; description: string };
type Criterion = { id: string; name: string; weight: number; scores: number[]; descriptions: string[] };
type RubricRow = { id: string; title: string; criteria: unknown; max_score: number; is_public: boolean; updated_at: string };
const db = supabase as any;
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const initialLevels: Level[] = [
  { id: "exemplary", name: "Exemplary", description: "Consistently exceeds expectations" },
  { id: "proficient", name: "Proficient", description: "Meets expectations" },
  { id: "developing", name: "Developing", description: "Partially meets expectations" },
  { id: "beginning", name: "Beginning", description: "Needs substantial support" },
];
const initialCriteria = (): Criterion[] => [
  { id: makeId(), name: "Content", weight: 1, scores: [4, 3, 2, 1], descriptions: ["Insightful, accurate and complete", "Accurate and relevant", "Some details missing", "Limited or inaccurate" ] },
  { id: makeId(), name: "Organization", weight: 1, scores: [4, 3, 2, 1], descriptions: ["Clear, logical flow", "Mostly well organized", "Some organization issues", "Difficult to follow"] },
  { id: makeId(), name: "Grammar", weight: 1, scores: [4, 3, 2, 1], descriptions: ["Accurate and varied", "Minor errors", "Errors sometimes affect meaning", "Frequent errors affect meaning"] },
  { id: makeId(), name: "Vocabulary", weight: 1, scores: [4, 3, 2, 1], descriptions: ["Precise and varied", "Appropriate word choice", "Limited or repetitive", "Often inaccurate"] },
];

/** TC- rubric designer: criteria-by-performance grid with weighted score and database persistence. */
export default function RubricsPage() {
  const [title, setTitle] = useState("Writing Assessment Rubric");
  const [levels, setLevels] = useState<Level[]>(initialLevels);
  const [criteria, setCriteria] = useState<Criterion[]>(initialCriteria);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rubrics, setRubrics] = useState<RubricRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const maxScore = useMemo(() => criteria.reduce((sum, item) => sum + Math.max(0, item.weight) * Math.max(0, ...item.scores), 0), [criteria]);

  async function loadRubrics() {
    setLoading(true); setError("");
    try {
      const { data, error: queryError } = await db.from("rubrics").select("id,title,criteria,max_score,is_public,updated_at").order("updated_at", { ascending: false }).limit(50);
      if (queryError) throw queryError;
      setRubrics((data ?? []) as RubricRow[]);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load saved rubrics."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadRubrics(); }, []);

  function updateCriterion(id: string, patch: Partial<Criterion>) { setCriteria((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)); }
  function updateCell(criterionId: string, levelIndex: number, patch: { score?: number; description?: string }) {
    setCriteria((current) => current.map((item) => {
      if (item.id !== criterionId) return item;
      const scores = [...item.scores]; const descriptions = [...item.descriptions];
      if (patch.score !== undefined) scores[levelIndex] = Math.max(0, Number.isFinite(patch.score) ? patch.score : 0);
      if (patch.description !== undefined) descriptions[levelIndex] = patch.description;
      return { ...item, scores, descriptions };
    }));
  }
  function addCriterion() { setCriteria((current) => [...current, { id: makeId(), name: `Criterion ${current.length + 1}`, weight: 1, scores: levels.map((_, i) => Math.max(0, levels.length - i)), descriptions: levels.map(() => "Describe performance at this level") }]); }
  function addLevel() {
    if (levels.length >= 6) { setNotice("A rubric can have up to 6 performance levels."); return; }
    const next = { id: makeId(), name: `Level ${levels.length + 1}`, description: "Describe this performance level" };
    setLevels((current) => [...current, next]);
    setCriteria((current) => current.map((item) => ({ ...item, scores: [...item.scores, 0], descriptions: [...item.descriptions, "Describe performance at this level"] })));
  }
  function removeLevel(index: number) {
    if (levels.length <= 2) { setNotice("Keep at least two performance levels."); return; }
    setLevels((current) => current.filter((_, i) => i !== index));
    setCriteria((current) => current.map((item) => ({ ...item, scores: item.scores.filter((_, i) => i !== index), descriptions: item.descriptions.filter((_, i) => i !== index) })));
  }
  function resetDraft() { setTitle("Untitled Rubric"); setLevels(initialLevels); setCriteria(initialCriteria()); setIsPublic(false); setActiveId(null); setNotice("New rubric draft started."); setError(""); }

  async function saveRubric() {
    if (!title.trim()) { setError("Enter a rubric title before saving."); return; }
    if (!criteria.length || criteria.some((item) => !item.name.trim())) { setError("Every criterion needs a name."); return; }
    setSaving(true); setError(""); setNotice("");
    const payload = criteria.map((item) => ({ id: item.id, name: item.name.trim(), weight: item.weight, levels: levels.map((level, index) => ({ id: level.id, name: level.name, description: level.description, points: item.scores[index] ?? 0, performance: item.descriptions[index] ?? "" })) }));
    try {
      const { data: authData } = await supabase.auth.getUser();
      const record = { title: title.trim(), criteria: payload, max_score: Number(maxScore.toFixed(2)), author_id: authData.user?.id ?? null, is_public: isPublic };
      const result = activeId
        ? await db.from("rubrics").update(record).eq("id", activeId).select("id,title,criteria,max_score,is_public,updated_at").single()
        : await db.from("rubrics").insert(record).select("id,title,criteria,max_score,is_public,updated_at").single();
      if (result.error) throw result.error;
      setActiveId(result.data.id); setNotice("Rubric saved successfully."); await loadRubrics();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save rubric. Check your connection and permissions."); }
    finally { setSaving(false); }
  }
  function openRubric(item: RubricRow) {
    const raw = Array.isArray(item.criteria) ? item.criteria as any[] : [];
    if (raw.length && raw[0]?.levels) {
      const savedLevels = raw[0].levels as any[];
      setLevels(savedLevels.map((level) => ({ id: String(level.id ?? makeId()), name: String(level.name ?? "Level"), description: String(level.description ?? "") })));
      setCriteria(raw.map((row) => ({ id: String(row.id ?? makeId()), name: String(row.name ?? "Criterion"), weight: Number(row.weight ?? 1), scores: (row.levels ?? []).map((level: any) => Number(level.points ?? 0)), descriptions: (row.levels ?? []).map((level: any) => String(level.performance ?? "")) })));
    } else { setLevels(initialLevels); setCriteria(initialCriteria()); }
    setTitle(item.title); setIsPublic(item.is_public); setActiveId(item.id); setNotice(`Loaded “${item.title}”.`); setError("");
  }
  async function duplicateRubric(item: RubricRow) { openRubric(item); setActiveId(null); setTitle(`${item.title} (Copy)`); setNotice("Copy loaded as a new draft. Save to create it."); }
  async function deleteRubric(item: RubricRow) {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    const { error: deleteError } = await db.from("rubrics").delete().eq("id", item.id);
    if (deleteError) setError(deleteError.message); else { setRubrics((current) => current.filter((r) => r.id !== item.id)); if (activeId === item.id) resetDraft(); setNotice("Rubric deleted."); }
  }

  return <main style={{ maxWidth: 1440, margin: "0 auto", padding: "28px 22px 56px", color: "var(--foreground, #172033)", fontFamily: "inherit" }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 22 }}>
      <div><div style={{ display: "flex", alignItems: "center", gap: 10, color: "#64748b", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}><BookOpenCheck size={17}/> Assessment tools</div><h1 style={{ fontSize: 30, margin: "8px 0 6px" }}>Rubric Designer</h1><p style={{ margin: 0, color: "#64748b" }}>Build clear performance criteria, set weighted scores, and reuse your rubric.</p></div>
      <div style={{ display: "flex", gap: 10 }}><button onClick={resetDraft} style={secondaryButton}><RotateCcw size={16}/> New rubric</button><button disabled={saving} onClick={() => void saveRubric()} style={primaryButton}><Save size={16}/> {saving ? "Saving…" : "Save rubric"}</button></div>
    </header>
    {error && <div role="alert" style={alertStyle}>{error}</div>}{notice && <div role="status" style={noticeStyle}>{notice}</div>}
    <section style={panelStyle}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1fr) minmax(220px,auto)", gap: 18, alignItems: "end" }}>
        <label style={labelStyle}>Rubric title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Essay writing rubric" style={inputStyle}/></label>
        <div><div style={labelStyle}>Template visibility</div><div style={{ display: "flex", gap: 8 }}><button onClick={() => setIsPublic(false)} style={isPublic ? secondaryButton : selectedButton}><LockKeyhole size={15}/> Private</button><button onClick={() => setIsPublic(true)} style={isPublic ? selectedButton : secondaryButton}><Users size={15}/> Shared template</button></div></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 22, marginBottom: 12 }}><div><h2 style={{ fontSize: 18, margin: 0 }}>Performance levels</h2><p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>Rename levels and describe what each level means.</p></div><button onClick={addLevel} style={secondaryButton}><Plus size={15}/> Add level</button></div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${levels.length}, minmax(150px, 1fr))`, gap: 10, overflowX: "auto", paddingBottom: 5 }}>{levels.map((level, index) => <div key={level.id} style={levelStyle}><input aria-label={`Level ${index + 1} name`} value={level.name} onChange={(e) => setLevels((current) => current.map((l, i) => i === index ? { ...l, name: e.target.value } : l))} style={{ ...inputStyle, fontWeight: 700, marginBottom: 7 }}/><textarea aria-label={`Level ${index + 1} description`} value={level.description} onChange={(e) => setLevels((current) => current.map((l, i) => i === index ? { ...l, description: e.target.value } : l))} rows={2} style={{ ...inputStyle, resize: "vertical", fontSize: 12 }}/><button aria-label={`Remove ${level.name}`} onClick={() => removeLevel(index)} style={tinyButton}><Trash2 size={13}/> Remove</button></div>)}</div>
    </section>
    <section style={{ ...panelStyle, marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}><div><h2 style={{ fontSize: 18, margin: 0 }}>Criteria and score grid</h2><p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>Points are multiplied by each criterion’s weight. The maximum score updates automatically.</p></div><button onClick={addCriterion} style={secondaryButton}><Plus size={15}/> Add criterion</button></div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 900, borderCollapse: "separate", borderSpacing: 0 }}><thead><tr><th style={thStyle}>Criterion / weight</th>{levels.map((level) => <th key={level.id} style={thStyle}>{level.name}</th>)}<th style={thStyle}>Max</th><th style={thStyle}> </th></tr></thead><tbody>{criteria.map((item) => <tr key={item.id}><td style={tdStyle}><input value={item.name} onChange={(e) => updateCriterion(item.id, { name: e.target.value })} aria-label="Criterion name" style={{ ...inputStyle, fontWeight: 700, minWidth: 140 }}/><label style={{ display: "block", fontSize: 12, color: "#64748b", marginTop: 8 }}>Weight<input type="number" min={0} step={0.25} value={item.weight} onChange={(e) => updateCriterion(item.id, { weight: Math.max(0, Number(e.target.value)) })} style={{ ...inputStyle, width: 90, marginTop: 4 }}/></label></td>{levels.map((level, index) => <td key={level.id} style={tdStyle}><label style={{ display: "block", fontSize: 12, color: "#64748b" }}>Points<input type="number" min={0} step={0.5} value={item.scores[index] ?? 0} onChange={(e) => updateCell(item.id, index, { score: Number(e.target.value) })} style={{ ...inputStyle, width: 90, marginTop: 4, marginBottom: 7 }}/></label><textarea aria-label={`${item.name}, ${level.name} description`} value={item.descriptions[index] ?? ""} onChange={(e) => updateCell(item.id, index, { description: e.target.value })} rows={3} style={{ ...inputStyle, minWidth: 130, resize: "vertical", fontSize: 12 }}/></td>)}<td style={{ ...tdStyle, fontWeight: 800, whiteSpace: "nowrap" }}>{(item.weight * Math.max(0, ...item.scores)).toFixed(2)}</td><td style={tdStyle}><button aria-label={`Remove ${item.name}`} onClick={() => setCriteria((current) => current.filter((row) => row.id !== item.id))} style={tinyButton}><Trash2 size={14}/></button></td></tr>)}</tbody></table></div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}><div style={{ background: "#eef2ff", borderRadius: 12, padding: "14px 22px", minWidth: 210 }}><div style={{ color: "#4338ca", fontSize: 12, fontWeight: 700 }}>TOTAL MAXIMUM SCORE</div><div style={{ color: "#312e81", fontSize: 30, fontWeight: 800 }}>{maxScore.toFixed(2)} <span style={{ fontSize: 14, fontWeight: 500 }}>points</span></div></div></div>
    </section>
    <section style={{ ...panelStyle, marginTop: 18 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}><div><h2 style={{ fontSize: 18, margin: 0 }}>Saved rubrics</h2><p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>Open an existing rubric to edit it, or duplicate it as a new draft.</p></div><button onClick={() => void loadRubrics()} style={secondaryButton}>Refresh</button></div>
      {loading ? <p style={{ color: "#64748b" }}>Loading saved rubrics…</p> : rubrics.length === 0 ? <p style={{ color: "#64748b" }}>No saved rubrics found yet. Save your first rubric above.</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>{rubrics.map((item) => <article key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}><div><strong>{item.title}</strong><div style={{ color: "#64748b", fontSize: 12, marginTop: 5 }}>{item.is_public ? "Shared template" : "Private rubric"} · Max {Number(item.max_score).toFixed(2)} pts</div></div>{item.is_public ? <Users size={16} color="#64748b"/> : <LockKeyhole size={16} color="#64748b"/>}</div><div style={{ display: "flex", gap: 7, marginTop: 14, flexWrap: "wrap" }}><button onClick={() => openRubric(item)} style={secondaryButton}>Edit</button><button onClick={() => void duplicateRubric(item)} style={secondaryButton}><Copy size={14}/> Duplicate</button><button onClick={() => void deleteRubric(item)} aria-label={`Delete ${item.title}`} style={tinyButton}><Trash2 size={14}/></button></div></article>)}</div>}
    </section>
  </main>;
}
const panelStyle: CSSProperties = { background: "var(--card, #fff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 16, padding: 20, boxShadow: "0 3px 12px rgba(15,23,42,.035)" };
const inputStyle: CSSProperties = { display: "block", boxSizing: "border-box", width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 10px", background: "var(--background, #fff)", color: "inherit", font: "inherit" };
const labelStyle: CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: "#475569" };
const primaryButton: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, border: 0, borderRadius: 9, background: "#4f46e5", color: "white", padding: "10px 15px", fontWeight: 700, cursor: "pointer" };
const secondaryButton: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #cbd5e1", borderRadius: 9, background: "transparent", color: "inherit", padding: "9px 12px", fontWeight: 600, cursor: "pointer" };
const selectedButton: CSSProperties = { ...secondaryButton, background: "#eef2ff", borderColor: "#818cf8", color: "#3730a3" };
const tinyButton: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #e2e8f0", borderRadius: 7, background: "transparent", color: "#64748b", padding: "5px 7px", cursor: "pointer", fontSize: 12 };
const levelStyle: CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 11, background: "#f8fafc", padding: 10, minWidth: 0 };
const thStyle: CSSProperties = { background: "#f1f5f9", color: "#334155", textAlign: "left", fontSize: 12, padding: "12px 10px", borderBottom: "1px solid #cbd5e1", verticalAlign: "top" };
const tdStyle: CSSProperties = { padding: 10, borderBottom: "1px solid #e2e8f0", verticalAlign: "top" };
const alertStyle: CSSProperties = { padding: "10px 14px", marginBottom: 12, borderRadius: 9, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" };
const noticeStyle: CSSProperties = { padding: "10px 14px", marginBottom: 12, borderRadius: 9, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" };

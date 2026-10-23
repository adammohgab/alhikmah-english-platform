import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  CircleAlert,
  GraduationCap,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/shared/api/supabase";

type Stage = 1 | 2 | 3 | 4;
type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
type Skill = "Grammar" | "Writing" | "Literature" | "Speaking";

interface UnitDraft {
  id: string;
  title: string;
  description: string;
  order_index: number;
}
interface JobRow {
  id: string;
  kind: string;
  status: JobStatus;
  result_payload: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
}
interface JobStep {
  id: string;
  step_index: number;
  name: string;
  status: string;
  progress_percent: number;
  log: string | null;
}

const SKILLS: Skill[] = ["Grammar", "Writing", "Literature", "Speaking"];
const CEFR = ["A1", "A2", "B1", "B2"] as const;
const gradeOptions = Array.from({ length: 6 }, (_, index) => index + 7);
const progressNames: Record<string, string> = {
  started: "Starting generation worker",
  outline: "Drafting course outline",
  expand_units: "Expanding units and lesson objectives",
  lesson_content: "Creating lesson content and practice",
  assemble: "Assembling your course draft",
  ai_course: "Generating course content",
  completed: "Generation complete",
  failed: "Generation failed",
};

const cardStyle: React.CSSProperties = {
  background: "var(--color-card, #fff)",
  border: "1px solid var(--color-border, #e2e8f0)",
  borderRadius: 18,
  padding: 24,
};
const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "11px 12px",
  font: "inherit",
  background: "var(--color-background, #fff)",
  color: "inherit",
};
const primaryButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: 0,
  borderRadius: 10,
  padding: "11px 16px",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 650,
  cursor: "pointer",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export default function CourseWizardPage() {
  const [stage, setStage] = useState<Stage>(1);
  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState(9);
  const [cefr, setCefr] = useState<(typeof CEFR)[number]>("B1");
  const [unitCount, setUnitCount] = useState(4);
  const [standards, setStandards] = useState("");
  const [skills, setSkills] = useState<Skill[]>(["Grammar", "Writing"]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobRow | null>(null);
  const [steps, setSteps] = useState<JobStep[]>([]);
  const [units, setUnits] = useState<UnitDraft[]>([]);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const progress = useMemo(() => {
    if (job?.status === "completed") return 100;
    if (steps.length) return Math.max(0, Math.min(99, Math.max(...steps.map((step) => step.progress_percent))));
    if (job?.status === "running") return 8;
    if (job?.status === "queued") return 2;
    return 0;
  }, [job?.status, steps]);

  const loadSnapshot = useCallback(async (id: string) => {
    const client = supabase as any;
    const [jobResult, stepsResult] = await Promise.all([
      client.from("jobs").select("id,kind,status,result_payload,error_message,created_at").eq("id", id).maybeSingle(),
      client.from("job_steps").select("id,step_index,name,status,progress_percent,log").eq("job_id", id).order("step_index", { ascending: true }),
    ]);
    if (jobResult.error) throw jobResult.error;
    if (!jobResult.data) throw new Error("The generation job could not be found.");
    setJob(jobResult.data as JobRow);
    setSteps((stepsResult.data ?? []) as JobStep[]);
    return jobResult.data as JobRow;
  }, []);

  const loadGeneratedDraft = useCallback(async (completedJob: JobRow) => {
    const payload = asObject(completedJob.result_payload);
    const reportedId = payload ? readString(payload.course_id) : null;
    if (!reportedId) throw new Error("Generation completed, but the worker did not return a course ID. Please check the course list before retrying.");
    const client = supabase as any;
    const { data: course, error: courseError } = await client.from("courses")
      .select("id,title,description").eq("id", reportedId).maybeSingle();
    if (courseError) throw courseError;
    if (!course) throw new Error("The generated draft course could not be loaded.");
    const { data: unitRows, error: unitError } = await client.from("units")
      .select("id,title,description,order_index").eq("course_id", reportedId).order("order_index", { ascending: true });
    if (unitError) throw unitError;
    setCourseId(course.id as string);
    setCourseTitle((course.title as string) ?? "Generated course");
    setUnits((unitRows ?? []) as UnitDraft[]);
    setStage(4);
  }, []);

  useEffect(() => {
    if (!jobId || stage !== 3) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const snapshot = await loadSnapshot(jobId);
        if (cancelled) return;
        if (snapshot.status === "completed") {
          await loadGeneratedDraft(snapshot);
          setMessage("Your course draft is ready to review. It has not been published to students.");
          return;
        }
        if (snapshot.status === "failed" || snapshot.status === "cancelled") {
          setError(snapshot.error_message || (snapshot.status === "cancelled" ? "Generation was cancelled." : "Course generation failed."));
          return;
        }
      } catch (pollError) {
        if (!cancelled) setError(errorMessage(pollError));
      }
      if (!cancelled) timer = setTimeout(poll, 2500);
    };
    void poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [jobId, stage, loadSnapshot, loadGeneratedDraft]);

  async function dispatchGeneration() {
    if (!topic.trim()) { setError("Enter a course topic before generating."); setStage(1); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const client = supabase as any;
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Sign in as a teacher before generating a course.");
      const inputParams = {
        topic: topic.trim(),
        title: topic.trim(),
        grade,
        level: cefr,
        cefr_target: cefr,
        num_units: unitCount,
        category: "english",
        lessons_per_unit: 5,
        standards: standards.trim(),
        skills_emphasis: skills,
        extra_notes: standards.trim() ? `Learning standards: ${standards.trim()}` : undefined,
        include_activities: true,
        include_quiz: true,
        include_vocabulary: true,
      };
      const { data, error: insertError } = await client.from("jobs").insert({
        kind: "ai_course",
        initiator_id: userId,
        input_params: inputParams,
        status: "queued",
      }).select("id,kind,status,result_payload,error_message,created_at").single();
      if (insertError) throw insertError;
      const created = data as JobRow;
      setJobId(created.id); setJob(created); setSteps([]); setStage(3);
      const { error: invokeError } = await supabase.functions.invoke(
        `job-runner?job_id=${encodeURIComponent(created.id)}&kind=ai_course`,
      );
      if (invokeError) {
        setMessage(`The job is queued. The background worker could not be nudged: ${invokeError.message}. The scheduled worker may still pick it up.`);
      }
    } catch (dispatchError) {
      setError(errorMessage(dispatchError));
    } finally { setBusy(false); }
  }

  async function saveReview() {
    if (!courseId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const client = supabase as any;
      const { error: courseUpdateError } = await client.from("courses").update({
        title: courseTitle.trim(),
      }).eq("id", courseId);
      if (courseUpdateError) throw courseUpdateError;
      for (const unit of units) {
        const { error: updateError } = await client.from("units").update({
          title: unit.title.trim(), description: unit.description.trim(),
        }).eq("id", unit.id).eq("course_id", courseId);
        if (updateError) throw updateError;
      }
      setMessage("Review saved. Your course remains a draft until you publish it.");
    } catch (saveError) { setError(errorMessage(saveError)); }
    finally { setBusy(false); }
  }

  async function regenerateUnit(unit: UnitDraft) {
    if (!courseId) return;
    setRegenerating(unit.id); setError(""); setMessage("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Your session has expired. Sign in and try again.");
      const client = supabase as any;
      const { data, error: insertError } = await client.from("jobs").insert({
        kind: "ai_course", initiator_id: userId, status: "queued",
        input_params: {
          topic: `${topic}: regenerate unit ${unit.order_index + 1} — ${unit.title}`,
          grade, level: cefr, category: "english", num_units: 1, lessons_per_unit: 5,
          skills_emphasis: skills, extra_notes: `Create a replacement unit for the existing course "${courseTitle}". Focus on: ${unit.description || unit.title}. Keep the level at ${cefr}.`,
          include_activities: true, include_quiz: true, include_vocabulary: true,
        },
      }).select("id").single();
      if (insertError) throw insertError;
      const newJobId = data.id as string;
      const { error: invokeError } = await supabase.functions.invoke(`job-runner?job_id=${encodeURIComponent(newJobId)}&kind=ai_course`);
      if (invokeError) throw invokeError;
      setMessage(`Regenerating “${unit.title}”… this may take a few minutes.`);
      let completed: JobRow | null = null;
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const { data: jobSnapshot, error: jobReadError } = await client.from("jobs")
          .select("id,kind,status,result_payload,error_message,created_at").eq("id", newJobId).maybeSingle();
        if (jobReadError) throw jobReadError;
        if (!jobSnapshot) throw new Error("The unit regeneration job could not be found.");
        if (jobSnapshot.status === "failed" || jobSnapshot.status === "cancelled") {
          throw new Error(jobSnapshot.error_message || "Unit regeneration did not complete.");
        }
        if (jobSnapshot.status === "completed") { completed = jobSnapshot as JobRow; break; }
      }
      if (!completed) throw new Error("Unit regeneration is taking longer than expected. Its generated draft may still be available in your courses.");
      const payload = asObject(completed.result_payload);
      const generatedCourseId = payload ? readString(payload.course_id) : null;
      if (!generatedCourseId) throw new Error("The regenerated draft did not include a course ID.");
      const { data: generatedUnits, error: generatedUnitsError } = await client.from("units")
        .select("title,description").eq("course_id", generatedCourseId).order("order_index", { ascending: true }).limit(1);
      if (generatedUnitsError) throw generatedUnitsError;
      const regenerated = (generatedUnits ?? [])[0] as { title?: string; description?: string | null } | undefined;
      if (!regenerated) throw new Error("The regeneration job completed without a replacement unit outline.");
      const replacement = { title: regenerated.title || unit.title, description: regenerated.description || "" };
      const { error: updateError } = await client.from("units").update(replacement)
        .eq("id", unit.id).eq("course_id", courseId);
      if (updateError) throw updateError;
      updateUnit(unit.id, replacement);
      setMessage(`Unit ${unit.order_index + 1} outline regenerated and updated. The generated companion draft is retained in your courses for you to review its lesson content.`);
    } catch (regenError) { setError(errorMessage(regenError)); }
    finally { setRegenerating(null); }
  }

  function updateUnit(id: string, patch: Partial<UnitDraft>) {
    setUnits((current) => current.map((unit) => unit.id === id ? { ...unit, ...patch } : unit));
  }
  function toggleSkill(skill: Skill) {
    setSkills((current) => current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]);
  }

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 20px 56px", color: "var(--color-foreground, #0f172a)" }}>
      <Link to="/teacher" style={{ display: "inline-flex", gap: 7, alignItems: "center", color: "#2563eb", textDecoration: "none", marginBottom: 22 }}><ArrowLeft size={17} /> Teacher dashboard</Link>
      <header style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 26 }}>
        <div style={{ width: 52, height: 52, borderRadius: 15, display: "grid", placeItems: "center", background: "#dbeafe", color: "#1d4ed8", flexShrink: 0 }}><Sparkles size={26} /></div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 5px", color: "#2563eb", fontWeight: 750, fontSize: 12, letterSpacing: 1.2 }}>TEACHER BUILDERS · TC-30</p>
          <h1 style={{ fontSize: "clamp(25px, 4vw, 34px)", margin: "0 0 8px", letterSpacing: -0.7 }}>AI Course Generation Wizard</h1>
          <p style={{ margin: 0, color: "var(--color-muted-foreground, #64748b)", lineHeight: 1.6 }}>Build a tailored English course, track generation progress, and review the draft before publishing.</p>
        </div>
      </header>

      <nav aria-label="Wizard progress" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginBottom: 20 }}>
        {(["Course plan", "Learning design", "Generate", "Review draft"] as const).map((label, index) => {
          const step = (index + 1) as Stage; const active = stage === step; const done = stage > step;
          return <div key={label} style={{ borderBottom: `3px solid ${active ? "#2563eb" : done ? "#16a34a" : "#e2e8f0"}`, padding: "10px 4px", color: active ? "#1d4ed8" : done ? "#15803d" : "#64748b", fontSize: 13, fontWeight: active || done ? 700 : 500 }}><span style={{ display: "inline-grid", placeItems: "center", width: 24, height: 24, borderRadius: 99, marginRight: 7, background: active ? "#dbeafe" : done ? "#dcfce7" : "#f1f5f9" }}>{done ? <Check size={14} /> : step}</span>{label}</div>;
        })}
      </nav>

      {error && <div role="alert" style={{ ...cardStyle, borderColor: "#fecaca", background: "#fff7f7", color: "#991b1b", padding: 14, marginBottom: 16, display: "flex", gap: 9 }}><CircleAlert size={19} /> <span>{error}</span></div>}
      {message && <div role="status" style={{ ...cardStyle, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534", padding: 14, marginBottom: 16 }}>{message}</div>}

      {stage === 1 && <section style={cardStyle}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 22 }}><BookOpen size={22} color="#2563eb" /><div><h2 style={{ margin: 0, fontSize: 21 }}>Course plan</h2><p style={{ margin: "5px 0 0", color: "#64748b" }}>Start with the topic and learner profile.</p></div></div>
        <label style={{ display: "block", fontWeight: 650, marginBottom: 7 }} htmlFor="course-topic">Course topic</label>
        <textarea id="course-topic" rows={3} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. English communication for real-world situations" style={{ ...fieldStyle, resize: "vertical", marginBottom: 18 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          <label style={{ display: "grid", gap: 7, fontWeight: 650 }}>CEFR target level<select value={cefr} onChange={(event) => setCefr(event.target.value as typeof cefr)} style={fieldStyle}>{CEFR.map((level) => <option key={level} value={level}>{level}{level === "A1" ? " · Beginner" : level === "A2" ? " · Elementary" : level === "B1" ? " · Intermediate" : " · Upper intermediate"}</option>)}</select></label>
          <label style={{ display: "grid", gap: 7, fontWeight: 650 }}>Target grade<select value={grade} onChange={(event) => setGrade(Number(event.target.value))} style={fieldStyle}>{gradeOptions.map((value) => <option key={value} value={value}>Grade {value}</option>)}</select></label>
          <label style={{ display: "grid", gap: 7, fontWeight: 650 }}>Number of units<select value={unitCount} onChange={(event) => setUnitCount(Number(event.target.value))} style={fieldStyle}>{[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value} {value === 1 ? "unit" : "units"}</option>)}</select></label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 26 }}><button style={primaryButton} onClick={() => { if (!topic.trim()) { setError("Enter a course topic to continue."); return; } setError(""); setStage(2); }}>Learning design <ArrowRight size={17} /></button></div>
      </section>}

      {stage === 2 && <section style={cardStyle}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 22 }}><GraduationCap size={23} color="#2563eb" /><div><h2 style={{ margin: 0, fontSize: 21 }}>Learning design</h2><p style={{ margin: "5px 0 0", color: "#64748b" }}>Add curriculum standards and prioritize the skills to emphasize.</p></div></div>
        <label htmlFor="learning-standards" style={{ display: "block", fontWeight: 650, marginBottom: 7 }}>Learning standards or objectives <span style={{ color: "#64748b", fontWeight: 400 }}>(optional)</span></label>
        <textarea id="learning-standards" rows={4} value={standards} onChange={(event) => setStandards(event.target.value)} placeholder="Paste school standards, curriculum outcomes, or specific learning objectives…" style={{ ...fieldStyle, resize: "vertical", marginBottom: 20 }} />
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ fontWeight: 700, marginBottom: 10 }}>Skill emphasis</legend><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>{SKILLS.map((skill) => <label key={skill} style={{ display: "flex", alignItems: "center", gap: 10, padding: 13, border: `1px solid ${skills.includes(skill) ? "#93c5fd" : "#e2e8f0"}`, borderRadius: 12, background: skills.includes(skill) ? "#eff6ff" : "transparent", cursor: "pointer" }}><input type="checkbox" checked={skills.includes(skill)} onChange={() => toggleSkill(skill)} />{skill}</label>)}</div></fieldset>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 26 }}><button style={{ ...primaryButton, background: "#e2e8f0", color: "#334155" }} onClick={() => { setError(""); setStage(1); }}><ArrowLeft size={17} /> Back</button><button disabled={busy || skills.length === 0} style={{ ...primaryButton, opacity: busy || skills.length === 0 ? .6 : 1 }} onClick={() => void dispatchGeneration()}>{busy ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={17} />} Generate course <ArrowRight size={17} /></button></div>
      </section>}

      {stage === 3 && <section style={cardStyle}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 22 }}><LoaderCircle size={23} color="#2563eb" /><div><h2 style={{ margin: 0, fontSize: 21 }}>Building your course</h2><p style={{ margin: "5px 0 0", color: "#64748b" }}>Generation runs in the background. This page checks job status and step progress automatically.</p></div></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9, fontWeight: 700 }}><span>{job?.status === "queued" ? "Waiting for worker" : job?.status === "failed" ? "Generation failed" : "Generation progress"}</span><span>{progress}%</span></div>
        <div role="progressbar" aria-label="Course generation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} style={{ height: 12, borderRadius: 99, overflow: "hidden", background: "#e2e8f0" }}><div style={{ height: "100%", width: `${progress}%`, borderRadius: 99, background: "linear-gradient(90deg, #2563eb, #7c3aed)", transition: "width 450ms ease" }} /></div>
        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>{(steps.length ? steps : [{ id: "waiting", step_index: 0, name: job?.status === "queued" ? "started" : "ai_course", status: "running", progress_percent: progress, log: "Waiting for background worker updates…" }]).map((step) => <div key={step.id} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: 12, border: "1px solid #e2e8f0", borderRadius: 12 }}><span style={{ marginTop: 2, color: step.status === "completed" ? "#16a34a" : step.status === "failed" ? "#dc2626" : "#2563eb" }}>{step.status === "completed" ? <CheckCircle2 size={19} /> : step.status === "failed" ? <CircleAlert size={19} /> : <LoaderCircle size={19} />}</span><div style={{ flex: 1 }}><strong>{progressNames[step.name] ?? step.name.replaceAll("_", " ")}</strong>{step.log && <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>{step.log}</p>}</div><span style={{ color: "#64748b", fontSize: 13 }}>{step.progress_percent}%</span></div>)}</div>
        {job?.status === "failed" && <button style={{ ...primaryButton, marginTop: 20 }} onClick={() => { setStage(2); setError(""); }}><RefreshCw size={17} /> Review inputs and try again</button>}
      </section>}

      {stage === 4 && <section style={cardStyle}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}><CheckCircle2 size={24} color="#16a34a" /><div style={{ flex: 1 }}><h2 style={{ margin: 0, fontSize: 21 }}>Review generated outline</h2><p style={{ margin: "5px 0 0", color: "#64748b" }}>Edit titles and descriptions before saving your review. The generated course remains a draft.</p></div><span style={{ padding: "5px 9px", borderRadius: 99, background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 750 }}>DRAFT</span></div>
        <label style={{ display: "grid", gap: 7, fontWeight: 700, marginBottom: 18 }}>Course title<input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} style={fieldStyle} /></label>
        <div style={{ display: "grid", gap: 14 }}>{units.map((unit, index) => <article key={unit.id} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}><div style={{ display: "flex", gap: 10, alignItems: "center" }}><span style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 10, background: "#eff6ff", color: "#1d4ed8", fontWeight: 800 }}>{index + 1}</span><strong>Unit {index + 1}</strong></div><button disabled={regenerating === unit.id} onClick={() => void regenerateUnit(unit)} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #cbd5e1", background: "transparent", color: "inherit", borderRadius: 9, padding: "7px 10px", cursor: "pointer", fontSize: 12 }}>{regenerating === unit.id ? <LoaderCircle size={14} /> : <RefreshCw size={14} />} Regenerate unit</button></div><label style={{ display: "grid", gap: 6, fontWeight: 650, marginBottom: 12 }}>Unit title<input value={unit.title} onChange={(event) => updateUnit(unit.id, { title: event.target.value })} style={fieldStyle} /></label><label style={{ display: "grid", gap: 6, fontWeight: 650 }}>Description<textarea rows={3} value={unit.description ?? ""} onChange={(event) => updateUnit(unit.id, { description: event.target.value })} style={{ ...fieldStyle, resize: "vertical" }} /></label></article>)}</div>
        {units.length === 0 && <p style={{ color: "#64748b" }}>No units were returned with this draft. Review the job result and try generation again if needed.</p>}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 24 }}><button style={{ ...primaryButton, background: "#e2e8f0", color: "#334155" }} onClick={() => { setStage(2); setError(""); setMessage(""); }}><ArrowLeft size={17} /> New generation</button><button disabled={busy || !courseId || !courseTitle.trim() || units.some((unit) => !unit.title.trim())} style={{ ...primaryButton, opacity: busy || !courseId || !courseTitle.trim() || units.some((unit) => !unit.title.trim()) ? .6 : 1 }} onClick={() => void saveReview()}>{busy ? <LoaderCircle size={17} /> : <Check size={17} />} Save review</button></div>
        {courseId && <p style={{ display: "flex", alignItems: "center", gap: 7, color: "#64748b", fontSize: 13, marginTop: 18 }}><Layers3 size={16} /> Draft course ID: <code>{courseId}</code></p>}
      </section>}
      <p style={{ textAlign: "center", color: "#64748b", fontSize: 12, marginTop: 20 }}>AI-generated materials are drafts. Review them for accuracy, curriculum alignment, and learner suitability before publishing.</p>
    </main>
  );
}

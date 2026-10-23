import { useMemo, useState } from "react";
import type { FormEvent } from "react";

export interface QuizQuestion {
  id: string;
  title: string;
  points: number;
}

export type ResultsVisibility = "immediately" | "after_due_date" | "never";

export interface QuizSettings {
  title: string;
  durationMinutes: number | null;
  maxAttempts: number;
  passingGrade: number;
  shuffle: boolean;
  resultsVisibility: ResultsVisibility;
}

interface Props {
  initial?: Partial<QuizSettings>;
  questions: QuizQuestion[];
  save: (settings: QuizSettings, questions: QuizQuestion[]) => Promise<void>;
  openQuestionBank: () => Promise<QuizQuestion[]>;
  createQuestion: () => Promise<QuizQuestion | null>;
  generateQuestionWithAi: () => Promise<QuizQuestion | null>;
}

const defaults: QuizSettings = {
  title: "",
  durationMinutes: null,
  maxAttempts: 1,
  passingGrade: 60,
  shuffle: false,
  resultsVisibility: "immediately",
};

const pageStyle = {
  maxWidth: 960,
  margin: "2rem auto",
  padding: "0 1rem 2rem",
  fontFamily: "system-ui, sans-serif",
  color: "#172033",
} as const;

const panelStyle = {
  border: "1px solid #dce2ea",
  borderRadius: 12,
  padding: 20,
  marginTop: 16,
  background: "#fff",
} as const;

const fieldStyle = {
  display: "grid",
  gap: 6,
  minWidth: 0,
} as const;

const inputStyle = {
  boxSizing: "border-box" as const,
  width: "100%",
  minHeight: 40,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "8px 10px",
  font: "inherit",
  background: "#fff",
};

const buttonStyle = {
  minHeight: 38,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "8px 12px",
  background: "#fff",
  color: "#172033",
  cursor: "pointer",
  font: "inherit",
} as const;

export default function QuizBuilderPage({
  initial,
  questions: initialQuestions,
  save,
  openQuestionBank,
  createQuestion,
  generateQuestionWithAi,
}: Props) {
  const [settings, setSettings] = useState<QuizSettings>({ ...defaults, ...initial });
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const totalPoints = useMemo(
    () => questions.reduce((sum, question) => sum + Math.max(0, Number(question.points) || 0), 0),
    [questions],
  );

  async function addQuestions(action: () => Promise<QuizQuestion[] | QuizQuestion | null>) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await action();
      const incoming = Array.isArray(result) ? result : result ? [result] : [];
      if (incoming.length) {
        setQuestions((current) => {
          const knownIds = new Set(current.map((question) => question.id));
          return [...current, ...incoming.filter((question) => !knownIds.has(question.id))];
        });
        setMessage(`${incoming.length} question${incoming.length === 1 ? "" : "s"} added.`);
      } else {
        setMessage("No questions were added.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add questions. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!settings.title.trim()) {
      setError("Enter a quiz title before saving.");
      return;
    }
    if (settings.durationMinutes !== null && (!Number.isFinite(settings.durationMinutes) || settings.durationMinutes < 1)) {
      setError("Duration must be at least 1 minute, or select Untimed.");
      return;
    }
    if (!Number.isInteger(settings.maxAttempts) || settings.maxAttempts < 1 || settings.maxAttempts > 5) {
      setError("Maximum attempts must be between 1 and 5.");
      return;
    }
    if (!Number.isFinite(settings.passingGrade) || settings.passingGrade < 0 || settings.passingGrade > 100) {
      setError("Passing grade must be between 0% and 100%.");
      return;
    }
    if (questions.some((question) => !Number.isFinite(question.points) || question.points < 0)) {
      setError("Each question must have a points value of 0 or more.");
      return;
    }

    setBusy(true);
    try {
      await save({ ...settings, title: settings.title.trim() }, questions);
      setMessage("Quiz saved successfully.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function updateSettings<K extends keyof QuizSettings>(key: K, value: QuizSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  function moveQuestion(index: number, delta: number) {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= questions.length) return;
    setQuestions((current) => {
      const reordered = [...current];
      const [moving] = reordered.splice(index, 1);
      if (!moving) return current;
      reordered.splice(nextIndex, 0, moving);
      return reordered;
    });
    setMessage("Question order updated.");
  }

  return (
    <main style={pageStyle}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p style={{ margin: "0 0 4px", color: "#64748b", fontSize: 14 }}>Teacher workspace / Quizzes</p>
          <h1 style={{ margin: 0, fontSize: 30 }}>Quiz Builder</h1>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>Set quiz rules, assemble questions, and review the total score.</p>
        </div>
        <button type="submit" form="quiz-builder-form" disabled={busy} style={{ ...buttonStyle, background: "#1d4ed8", color: "#fff", borderColor: "#1d4ed8", padding: "10px 18px" }}>
          {busy ? "Working…" : "Save quiz"}
        </button>
      </header>

      <form id="quiz-builder-form" onSubmit={(event) => void submit(event)}>
        <section aria-labelledby="settings-heading" style={panelStyle}>
          <h2 id="settings-heading" style={{ marginTop: 0 }}>Quiz settings</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label style={fieldStyle}>
              Quiz title
              <input style={inputStyle} required value={settings.title} placeholder="e.g. Unit 3 vocabulary quiz" onChange={(event) => updateSettings("title", event.target.value)} />
            </label>
            <label style={fieldStyle}>
              Maximum attempts
              <select style={inputStyle} value={settings.maxAttempts} onChange={(event) => updateSettings("maxAttempts", Number(event.target.value))}>
                {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} {value === 1 ? "attempt" : "attempts"}</option>)}
              </select>
            </label>
            <label style={fieldStyle}>
              Passing grade (%)
              <input style={inputStyle} type="number" min="0" max="100" step="1" value={settings.passingGrade} onChange={(event) => updateSettings("passingGrade", Number(event.target.value))} />
            </label>
            <label style={fieldStyle}>
              Results visibility
              <select style={inputStyle} value={settings.resultsVisibility} onChange={(event) => updateSettings("resultsVisibility", event.target.value as ResultsVisibility)}>
                <option value="immediately">Immediately after submission</option>
                <option value="after_due_date">After due date</option>
                <option value="never">Never show results</option>
              </select>
            </label>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginTop: 18 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
              <input type="checkbox" checked={settings.durationMinutes === null} onChange={(event) => updateSettings("durationMinutes", event.target.checked ? null : 30)} />
              Untimed quiz
            </label>
            {settings.durationMinutes !== null && (
              <label style={{ ...fieldStyle, width: 190 }}>
                Duration (minutes)
                <input style={inputStyle} type="number" min="1" step="1" required value={settings.durationMinutes} onChange={(event) => updateSettings("durationMinutes", event.target.value === "" ? 0 : Number(event.target.value))} />
              </label>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
              <input type="checkbox" checked={settings.shuffle} onChange={(event) => updateSettings("shuffle", event.target.checked)} />
              Shuffle questions for each attempt
            </label>
          </div>
          <p style={{ marginBottom: 0, color: "#64748b", fontSize: 14 }}>The passing grade is a percentage of the quiz's total available points.</p>
        </section>

        <section aria-labelledby="questions-heading" style={panelStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h2 id="questions-heading" style={{ margin: "0 0 4px" }}>Questions</h2>
              <p style={{ margin: 0, color: "#64748b" }}>{questions.length} {questions.length === 1 ? "question" : "questions"} · Total score: <strong style={{ color: "#172033" }}>{totalPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })} points</strong></p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" disabled={busy} style={buttonStyle} onClick={() => void addQuestions(openQuestionBank)}>Add from Question Bank</button>
              <button type="button" disabled={busy} style={buttonStyle} onClick={() => void addQuestions(createQuestion)}>Create New Question</button>
              <button type="button" disabled={busy} style={{ ...buttonStyle, background: "#eff6ff", borderColor: "#93c5fd" }} onClick={() => void addQuestions(generateQuestionWithAi)}>Generate with AI</button>
            </div>
          </div>

          {questions.length === 0 ? (
            <div style={{ border: "1px dashed #cbd5e1", borderRadius: 10, padding: "28px 16px", textAlign: "center", marginTop: 18 }}>
              <h3 style={{ margin: "0 0 6px" }}>Start building your quiz</h3>
              <p style={{ margin: 0, color: "#64748b" }}>Create a question, choose one from the bank, or let AI draft one for you.</p>
            </div>
          ) : (
            <ol style={{ display: "grid", gap: 10, paddingLeft: 24, marginTop: 20 }}>
              {questions.map((question, index) => (
                <li key={question.id} style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 10 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                      <strong>{question.title || "Untitled question"}</strong>
                      <div style={{ color: "#64748b", fontSize: 13 }}>Question {index + 1}</div>
                    </div>
                    <label style={{ ...fieldStyle, width: 120 }}>
                      Points
                      <input aria-label={`Points for ${question.title || `question ${index + 1}`}`} style={inputStyle} type="number" min="0" step="0.25" value={question.points} onChange={(event) => {
                        const value = event.target.value === "" ? 0 : Number(event.target.value);
                        setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, points: value } : item));
                        setMessage("");
                      }} />
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" style={buttonStyle} aria-label={`Move ${question.title} up`} title="Move up" disabled={busy || index === 0} onClick={() => moveQuestion(index, -1)}>↑</button>
                      <button type="button" style={buttonStyle} aria-label={`Move ${question.title} down`} title="Move down" disabled={busy || index === questions.length - 1} onClick={() => moveQuestion(index, 1)}>↓</button>
                      <button type="button" style={buttonStyle} disabled={busy} onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}>Remove</button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p style={{ margin: "16px 0 0", color: "#64748b", fontSize: 14 }}>Reorder questions with the arrows. Each question's points can be overridden; the total updates automatically.</p>
        </section>

        <section aria-label="Quiz rules reminder" style={{ ...panelStyle, background: "#f8fafc" }}>
          <strong>Quiz rules</strong>
          <p style={{ margin: "6px 0 0", color: "#475569" }}>Hints and power-ups are disabled in quizzes.</p>
        </section>
      </form>
      <p role="status" aria-live="polite" style={{ color: message ? "#166534" : "#64748b" }}>{message}</p>
      {error && <p role="alert" style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</p>}
    </main>
  );
}

import { useState } from "react";
import { LoaderCircle, Sparkles, X } from "lucide-react";
import { supabase } from "@/shared/api/supabase";

export interface RubricLevel {
  label: string;
  points: number;
  description: string;
}
export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  levels: RubricLevel[];
}
export interface GeneratedRubric {
  title: string;
  criteria: RubricCriterion[];
}
interface Props {
  open: boolean;
  onClose: () => void;
  onGenerated: (rubric: GeneratedRubric) => void;
}
const GENRES = ["Argumentative", "Narrative", "Expository"] as const;
const LEVELS = ["Beginning", "Developing", "Proficient", "Advanced"] as const;

function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start)
    throw new Error("The AI response did not contain a rubric. Please try again.");
  return JSON.parse(cleaned.slice(start, end + 1));
}
function validateRubric(value: unknown, title: string): GeneratedRubric {
  if (!value || typeof value !== "object")
    throw new Error("The generated rubric was not in the expected format.");
  const raw = value as { title?: unknown; criteria?: unknown };
  if (!Array.isArray(raw.criteria) || raw.criteria.length !== 4)
    throw new Error("The AI must return exactly four criteria. Please generate again.");
  const criteria = raw.criteria.map((item, index): RubricCriterion => {
    const criterion = item as { name?: unknown; description?: unknown; levels?: unknown };
    if (
      typeof criterion.name !== "string" ||
      !Array.isArray(criterion.levels) ||
      criterion.levels.length !== 4
    )
      throw new Error("One or more criteria are incomplete. Please generate again.");
    const levels = criterion.levels.map((level, levelIndex): RubricLevel => {
      const entry = level as { points?: unknown; description?: unknown };
      const points = Number(entry.points);
      if (
        typeof entry.description !== "string" ||
        !Number.isFinite(points) ||
        points < 0 ||
        points > 3
      )
        throw new Error("One or more performance levels are incomplete. Please generate again.");
      return { label: LEVELS[levelIndex], points, description: entry.description };
    });
    if (levels.some((level, i) => level.points !== i))
      throw new Error(
        "The rubric levels must use ascending scores from 0 to 3. Please generate again.",
      );
    return {
      id: `ai-${index + 1}-${crypto.randomUUID()}`,
      name: criterion.name,
      description: typeof criterion.description === "string" ? criterion.description : "",
      levels,
    };
  });
  return {
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title : `${title.trim()} Rubric`,
    criteria,
  };
}

export default function AiRubricGeneratorModal({ open, onClose, onGenerated }: Props) {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState<(typeof GENRES)[number]>("Argumentative");
  const [gradeLevel, setGradeLevel] = useState("Grade 8");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!open) return null;

  async function generate() {
    if (!title.trim()) {
      setError("Enter the assignment title or prompt first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = data.session?.access_token;
      if (!token)
        throw new Error("Your session has expired. Sign in again to use AI rubric generation.");
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: `Create a detailed writing rubric as strict JSON only, no markdown or commentary. Assignment title/prompt: ${title.trim()}. Writing genre: ${genre}. Grade level: ${gradeLevel}. Return exactly this schema: {"title":"string","criteria":[{"name":"string","description":"string","levels":[{"label":"Beginning","points":0,"description":"string"},{"label":"Developing","points":1,"description":"string"},{"label":"Proficient","points":2,"description":"string"},{"label":"Advanced","points":3,"description":"string"}]}]}. Exactly four criteria and four levels per criterion. Use observable genre-appropriate expectations and clearly differentiated age-appropriate descriptions. Points must be 0,1,2,3 in ascending order. Do not propose database actions or action cards.`,
          workspace_state: {
            page: "rubric_designer",
            grade_level: gradeLevel,
            subject: "English writing",
          },
        }),
      });
      if (!response.ok)
        throw new Error(
          (await response.text()).slice(0, 260) || `AI request failed (${response.status}).`,
        );
      const responseText = await response.text();
      let accumulated = "";
      for (const block of responseText.split(/\r?\n\r?\n/)) {
        for (const line of block.split(/\r?\n/).filter((entry) => entry.startsWith("data:"))) {
          try {
            const payload = JSON.parse(line.slice(5).trim()) as {
              chunk?: string;
              delta?: string;
              text?: string;
              message?: string;
            };
            accumulated += payload.chunk ?? payload.delta ?? "";
            if (!accumulated && payload.text) accumulated = payload.text;
            if (!accumulated && payload.message) accumulated = payload.message;
          } catch {
            /* Ignore malformed SSE events; final schema validation reports incomplete output. */
          }
        }
      }
      const generated = validateRubric(
        extractJson(accumulated.trim() ? accumulated : responseText),
        title,
      );
      onGenerated(generated);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not generate a rubric. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-rubric-title"
        className="w-full max-w-xl rounded-2xl border-2 border-stroke bg-surface-0 p-5 shadow-retro-lg"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-primary mb-1 flex items-center gap-2 text-sm font-bold">
              <Sparkles size={16} /> AI RUBRIC BUILDER
            </p>
            <h2 id="ai-rubric-title" className="font-heading text-2xl font-bold text-stroke">
              Generate Rubric with AI
            </h2>
            <p className="mt-1 text-sm text-muted">
              Generate four criteria with four performance levels each. Review and edit the draft
              before saving.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
            className="hover:bg-surface-2 rounded-lg p-2"
          >
            <X size={20} />
          </button>
        </header>
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-stroke">
            Assignment title or prompt
            <textarea
              rows={3}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Write an argument supporting a school policy change..."
              className="mt-1 w-full rounded-xl border-2 border-stroke bg-surface-0 p-3 font-normal"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-stroke">
              Writing genre
              <select
                value={genre}
                onChange={(event) => setGenre(event.target.value as (typeof GENRES)[number])}
                className="mt-1 w-full rounded-xl border-2 border-stroke bg-surface-0 p-3 font-normal"
              >
                {GENRES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-stroke">
              Grade level
              <select
                value={gradeLevel}
                onChange={(event) => setGradeLevel(event.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-stroke bg-surface-0 p-3 font-normal"
              >
                {Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`).map((item) => (
                  <option key={item}>{item}</option>
                ))}
                <option>University / Adult</option>
              </select>
            </label>
          </div>
          {error && (
            <p
              role="alert"
              className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
            >
              {error}
            </p>
          )}
          <footer className="flex flex-wrap justify-end gap-2 border-t border-stroke/20 pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-xl border-2 border-stroke px-4 py-2 font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !title.trim()}
              onClick={() => void generate()}
              className="bg-primary inline-flex items-center gap-2 rounded-xl border-2 border-stroke px-4 py-2 font-bold text-white disabled:opacity-60"
            >
              {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={17} />}
              {busy ? "Generating…" : "Generate draft"}
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}

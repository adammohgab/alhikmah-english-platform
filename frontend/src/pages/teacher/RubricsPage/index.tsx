import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Plus, Save, Sparkles } from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import AiRubricGeneratorModal from "./AiRubricGeneratorModal";
import type { GeneratedRubric, RubricCriterion } from "./AiRubricGeneratorModal";

const PANEL = "rounded-2xl border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm";
const inputClass = "w-full rounded-lg border-2 border-stroke bg-surface-0 p-2 text-sm";
type SavedRubric = {
  id: string;
  title: string;
  criteria: RubricCriterion[];
  max_score: number;
  updated_at?: string;
};

function normalizeCriteria(value: unknown): RubricCriterion[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw, index) => {
    const row = raw as Partial<RubricCriterion>;
    return {
      id: typeof row.id === "string" ? row.id : `criterion-${index + 1}`,
      name: typeof row.name === "string" ? row.name : `Criterion ${index + 1}`,
      description: typeof row.description === "string" ? row.description : "",
      levels: Array.isArray(row.levels)
        ? row.levels.map((level, levelIndex) => ({
            label:
              typeof level.label === "string"
                ? level.label
                : (["Beginning", "Developing", "Proficient", "Advanced"][levelIndex] ??
                  `Level ${levelIndex + 1}`),
            points: Number(level.points) || 0,
            description: typeof level.description === "string" ? level.description : "",
          }))
        : [],
    };
  });
}

export default function RubricsPage() {
  const [rubrics, setRubrics] = useState<SavedRubric[]>([]);
  const [draft, setDraft] = useState<GeneratedRubric>({ title: "Untitled rubric", criteria: [] });
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const maxScore = useMemo(
    () =>
      draft.criteria.reduce(
        (sum, criterion) => sum + Math.max(0, ...criterion.levels.map((level) => level.points)),
        0,
      ),
    [draft.criteria],
  );

  async function loadRubrics() {
    setLoading(true);
    try {
      const { data, error } = await (
        supabase.from("rubrics" as never) as unknown as {
          select: (columns: string) => {
            order: (
              column: string,
              options: { ascending: boolean },
            ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
          };
        }
      )
        .select("id,title,criteria,max_score,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      setRubrics(
        (data ?? []).map((raw) => {
          const item = raw as Record<string, unknown>;
          return {
            id: String(item.id),
            title: String(item.title ?? "Untitled rubric"),
            criteria: normalizeCriteria(item.criteria),
            max_score: Number(item.max_score) || 0,
            ...(typeof item.updated_at === "string" ? { updated_at: item.updated_at } : {}),
          };
        }),
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not load rubrics.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void loadRubrics();
  }, []);

  function receiveGenerated(generated: GeneratedRubric) {
    setDraft(generated);
    setSelectedId(null);
    setMessage("AI rubric added to the editor. Review and refine the criteria before saving.");
  }
  function updateCriterion(index: number, patch: Partial<RubricCriterion>) {
    setDraft((current) => ({
      ...current,
      criteria: current.criteria.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }
  function updateLevel(criterionIndex: number, levelIndex: number, description: string) {
    setDraft((current) => ({
      ...current,
      criteria: current.criteria.map((item, i) =>
        i === criterionIndex
          ? {
              ...item,
              levels: item.levels.map((level, j) =>
                j === levelIndex ? { ...level, description } : level,
              ),
            }
          : item,
      ),
    }));
  }
  async function saveDraft() {
    if (
      !draft.title.trim() ||
      draft.criteria.length !== 4 ||
      draft.criteria.some((item) => item.levels.length !== 4 || !item.name.trim())
    ) {
      setMessage(
        "A rubric needs a title, four named criteria, and four performance levels per criterion.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Sign in again before saving this rubric.");
      const payload = {
        title: draft.title.trim(),
        criteria: draft.criteria,
        max_score: maxScore,
        author_id: authData.user.id,
      };
      const client = supabase as unknown as {
        from: (table: string) => {
          insert: (value: unknown) => {
            select: (columns: string) => {
              single: () => Promise<{ data: unknown; error: { message: string } | null }>;
            };
          };
          update: (value: unknown) => {
            eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
          };
        };
      };
      if (selectedId) {
        const { error } = await client.from("rubrics").update(payload).eq("id", selectedId);
        if (error) throw new Error(error.message);
        setMessage("Rubric changes saved.");
      } else {
        const { data, error } = await client.from("rubrics").insert(payload).select("id").single();
        if (error) throw new Error(error.message);
        const newId = (data as { id?: string } | null)?.id;
        if (newId) setSelectedId(newId);
        setMessage("Rubric saved. It is ready to attach to an assignment.");
      }
      await loadRubrics();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not save the rubric.");
    } finally {
      setBusy(false);
    }
  }
  function newBlankRubric() {
    setSelectedId(null);
    setDraft({
      title: "New writing rubric",
      criteria: Array.from({ length: 4 }, (_, index) => ({
        id: `criterion-${index + 1}`,
        name: ["Ideas and Content", "Organization", "Language and Style", "Conventions"][index],
        description: "",
        levels: ["Beginning", "Developing", "Proficient", "Advanced"].map((label, points) => ({
          label,
          points,
          description: "",
        })),
      })),
    });
    setMessage("Blank rubric created. Fill in all level descriptions and save when ready.");
  }
  function editSaved(item: SavedRubric) {
    setSelectedId(item.id);
    setDraft({ title: item.title, criteria: item.criteria });
    setMessage(`Editing “${item.title}”.`);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-primary mb-1 text-sm font-bold uppercase tracking-wide">
            Teacher tools
          </p>
          <h1 className="font-heading text-3xl font-bold text-stroke">Rubric Designer</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Build clear scoring criteria, generate a tailored first draft with AI, then review and
            save your rubric.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={newBlankRubric}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-stroke bg-surface-0 px-4 py-2 font-bold"
          >
            <Plus size={17} /> Blank rubric
          </button>
          <button
            type="button"
            onClick={() => setGeneratorOpen(true)}
            className="bg-primary inline-flex items-center gap-2 rounded-xl border-2 border-stroke px-4 py-2 font-bold text-white"
          >
            <Sparkles size={17} /> Generate Rubric with AI
          </button>
        </div>
      </header>
      {message && (
        <p role="status" className="bg-surface-1 rounded-xl border border-stroke/30 p-3 text-sm">
          {message}
        </p>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className={PANEL}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-xl font-bold">Rubric grid</h2>
              <p className="text-sm text-muted">
                Edit the title, criterion names, and each performance description.
              </p>
            </div>
            <div className="text-sm font-bold">Maximum score: {maxScore}</div>
          </div>
          <label className="mb-4 block text-sm font-semibold">
            Rubric title
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
              className={`${inputClass} mt-1`}
            />
          </label>
          {draft.criteria.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-stroke/40 p-8 text-center">
              <BookOpenCheck className="mx-auto mb-2" />
              <p className="font-bold">Start with a rubric draft</p>
              <p className="mt-1 text-sm text-muted">
                Generate a rubric with AI or create a blank rubric to begin editing.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {draft.criteria.map((criterion, criterionIndex) => (
                <article
                  key={criterion.id}
                  className="overflow-hidden rounded-xl border-2 border-stroke/25"
                >
                  <div className="bg-surface-1 flex items-start gap-2 p-3">
                    <label className="flex-1 text-xs font-bold uppercase tracking-wide">
                      Criterion {criterionIndex + 1}
                      <input
                        value={criterion.name}
                        onChange={(event) =>
                          updateCriterion(criterionIndex, { name: event.target.value })
                        }
                        className={`${inputClass} mt-1 text-base font-bold normal-case tracking-normal`}
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 p-3 md:grid-cols-2">
                    {criterion.levels.map((level, levelIndex) => (
                      <label key={`${criterion.id}-${level.label}`} className="block text-sm">
                        <span className="mb-1 flex items-center justify-between gap-2 font-bold">
                          <span>{level.label}</span>
                          <span className="bg-surface-2 rounded-md px-2 py-0.5 text-xs">
                            {level.points} pts
                          </span>
                        </span>
                        <textarea
                          rows={3}
                          value={level.description}
                          onChange={(event) =>
                            updateLevel(criterionIndex, levelIndex, event.target.value)
                          }
                          placeholder={`Describe ${level.label.toLowerCase()} performance…`}
                          className={inputClass}
                        />
                      </label>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-stroke/20 pt-4">
            <button
              type="button"
              disabled={busy || draft.criteria.length !== 4}
              onClick={() => void saveDraft()}
              className="bg-primary inline-flex items-center gap-2 rounded-xl border-2 border-stroke px-4 py-2 font-bold text-white disabled:opacity-50"
            >
              <Save size={17} />
              {busy ? "Saving…" : selectedId ? "Save changes" : "Save rubric"}
            </button>
          </div>
        </section>
        <aside className={`${PANEL} space-y-3`}>
          <h2 className="font-heading text-lg font-bold">Saved rubrics</h2>
          {loading ? (
            <p className="text-sm text-muted">Loading rubrics…</p>
          ) : rubrics.length === 0 ? (
            <p className="text-sm text-muted">No saved rubrics yet.</p>
          ) : (
            rubrics.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => editSaved(item)}
                className={`block w-full rounded-xl border-2 p-3 text-left ${selectedId === item.id ? "border-primary bg-primary/5" : "border-stroke/25 hover:border-stroke"}`}
              >
                <span className="block font-bold">{item.title}</span>
                <span className="mt-1 block text-xs text-muted">
                  {item.criteria.length} criteria · {item.max_score} max points
                </span>
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => void loadRubrics()}
            className="w-full rounded-lg border border-stroke/30 px-3 py-2 text-sm font-semibold"
          >
            Refresh list
          </button>
        </aside>
      </div>
      <AiRubricGeneratorModal
        open={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onGenerated={receiveGenerated}
      />
    </main>
  );
}

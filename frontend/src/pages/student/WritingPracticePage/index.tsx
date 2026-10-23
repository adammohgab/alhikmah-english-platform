import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ListChecks, Save, Sparkles } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { SegmentedControl } from "@/shared/components/ui/SegmentedControl";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Textarea } from "@/shared/components/ui/Textarea";
import { useAuth } from "@/shared/hooks/useAuth";
import { useToast } from "@/shared/hooks/useToast";
import {
  DRAFTS_KEY,
  MAX_CHARS,
  fetchDrafts,
  requestFeedback,
  saveDraft,
  type Draft,
  type WritingFeedback,
} from "./api";
import {
  OUTLINES,
  PROMPTS,
  PROMPT_TYPES,
  STARTERS,
  wordCount,
  type PromptType,
  type WritingPrompt,
} from "./prompts";

/* Writing workshop (ST-18): pick a prompt, write with sentence starters, autosave in the
   background and ask the AI for a grammar and vocabulary review. */

const AUTOSAVE_MS = 1500;
type SaveState = "idle" | "saving" | "saved" | "error";

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

export default function WritingPracticePage() {
  const { user } = useAuth();
  const studentId = user?.id;
  const toast = useToast();
  const queryClient = useQueryClient();

  const [type, setType] = useState<PromptType>("story");
  const [prompt, setPrompt] = useState<WritingPrompt | null>(null);
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const draftId = useRef<string | null>(null);
  const savedText = useRef("");
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const editor = useRef<HTMLTextAreaElement>(null);

  const title = prompt?.title ?? "Free writing";

  const drafts = useQuery({
    queryKey: [DRAFTS_KEY, studentId],
    queryFn: () => fetchDrafts(studentId!),
    enabled: studentId !== undefined,
  });

  /* Saves are queued one after another so the first save always finishes (and yields the draft
     id) before the next one starts. */
  const persist = useCallback(
    (finished = false): Promise<string | null> => {
      if (!studentId) return Promise.resolve(null);
      const snapshot = text;
      if (snapshot.trim() === "") return Promise.resolve(draftId.current);
      if (!finished && snapshot === savedText.current && draftId.current) {
        return Promise.resolve(draftId.current);
      }
      const run = chain.current.then(async () => {
        setSaveState("saving");
        try {
          const id = await saveDraft({
            studentId,
            draftId: draftId.current,
            title,
            text: snapshot,
            finished,
          });
          draftId.current = id;
          savedText.current = snapshot;
          setSaveState("saved");
          void queryClient.invalidateQueries({ queryKey: [DRAFTS_KEY, studentId] });
          return id;
        } catch {
          setSaveState("error");
          return null;
        }
      });
      chain.current = run;
      return run;
    },
    [studentId, text, title, queryClient],
  );

  useEffect(() => {
    if (text === savedText.current) return;
    const timer = window.setTimeout(() => void persist(), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [text, persist]);

  const check = useMutation({
    mutationFn: async () => {
      const id = await persist();
      if (!id) throw new Error("Your draft could not be saved, so it could not be checked.");
      return requestFeedback(text.trim(), prompt?.task ?? null, id);
    },
    onSuccess: (result) => {
      setFeedback(result);
      setShowScore(false);
      void queryClient.invalidateQueries({ queryKey: [DRAFTS_KEY, studentId] });
    },
    onError: (error: Error) =>
      toast.show({
        title: "Could not check your writing",
        description: error.message,
        type: "error",
      }),
  });

  const finish = useMutation({
    mutationFn: () => persist(true),
    onSuccess: (id) => {
      if (id) toast.show({ title: "Draft finished", type: "success" });
    },
  });

  const insertStarter = (phrase: string) => {
    const area = editor.current;
    const start = area?.selectionStart ?? text.length;
    const end = area?.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const needsSpace = before !== "" && !/\s$/.test(before);
    const insert = `${needsSpace ? " " : ""}${phrase} `;
    const next = `${before}${insert}${text.slice(end)}`.slice(0, MAX_CHARS);
    setText(next);
    const caret = Math.min(start + insert.length, next.length);
    window.requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(caret, caret);
    });
  };

  const startNew = (chosen: WritingPrompt | null) => {
    draftId.current = null;
    savedText.current = "";
    setPrompt(chosen);
    setText("");
    setFeedback(null);
    setSaveState("idle");
  };

  const openDraft = (draft: Draft) => {
    draftId.current = draft.id;
    savedText.current = draft.text;
    setPrompt(PROMPTS.find((item) => item.title === draft.title) ?? null);
    setText(draft.text);
    setFeedback(draft.feedback);
    setShowScore(false);
    setSaveState("saved");
  };

  const words = wordCount(text);
  const range = prompt?.range ?? null;
  const prompts = useMemo(() => PROMPTS.filter((item) => item.type === type), [type]);
  const activeType: PromptType = prompt?.type ?? type;
  const empty = text.trim() === "";

  const rangeNote = !range
    ? null
    : words < range[0]
      ? `${range[0] - words} more words to reach the goal`
      : words > range[1]
        ? "Above the suggested length"
        : "Right in the suggested range";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-[28px] font-bold leading-tight text-stroke">
          Writing workshop
        </h1>
        <p className="text-sm text-muted">
          Choose a prompt or write freely. Your draft saves by itself.
        </p>
      </header>

      <section aria-labelledby="prompts-heading" className="flex flex-col gap-3">
        <h2 id="prompts-heading" className="font-heading text-xl font-bold text-stroke">
          Prompts
        </h2>
        <SegmentedControl
          aria-label="Prompt type"
          value={type}
          onValueChange={(value) => setType(value as PromptType)}
          options={PROMPT_TYPES.map((item) => ({ value: item.id, label: item.label }))}
        />
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {prompts.map((item) => {
            const active = prompt?.id === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => startNew(item)}
                  className={`flex h-full w-full flex-col gap-1 rounded-2xl border-2 border-stroke p-4 text-left shadow-sm ${active ? "bg-world-amber-300" : "bg-surface-0"}`}
                >
                  <span className="text-base font-bold text-stroke">{item.title}</span>
                  <span className="text-sm text-muted">{item.task}</span>
                  <span className="text-xs text-muted">
                    For: {item.audience} · {item.range[0]}–{item.range[1]} words
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {prompt && (
          <div>
            <Button variant="ghost" size="sm" onClick={() => startNew(null)}>
              Switch to free writing
            </Button>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <section aria-label="Editor" className="flex flex-col gap-3">
          <div className="rounded-2xl border-2 border-stroke bg-surface-100 p-3">
            <p className="text-sm font-bold text-stroke">{title}</p>
            {prompt && <p className="text-sm text-muted">{prompt.task}</p>}
          </div>

          <details className="rounded-2xl border-2 border-stroke bg-surface-0 p-3">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold">
              <ListChecks size={16} aria-hidden="true" /> Planning outline
            </summary>
            <ol className="mt-2 list-decimal pl-5 text-sm">
              {OUTLINES[activeType].map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>

          <div className="flex flex-col gap-2">
            <p id="starters-label" className="text-sm font-bold text-stroke">
              Sentence starters
            </p>
            <ul aria-labelledby="starters-label" className="flex flex-wrap gap-2">
              {STARTERS[activeType].map((phrase) => (
                <li key={phrase}>
                  <Chip size="sm" onClick={() => insertStarter(phrase)}>
                    {phrase}
                  </Chip>
                </li>
              ))}
            </ul>
          </div>

          <Textarea
            ref={editor}
            label="Your writing"
            value={text}
            maxLength={MAX_CHARS}
            rows={14}
            onChange={(event) => setText(event.target.value)}
            helperText={`${words} words${range ? ` · goal ${range[0]}–${range[1]}` : ""}${rangeNote ? ` · ${rangeNote}` : ""}`}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button loading={check.isPending} disabled={empty} onClick={() => check.mutate()}>
              <Sparkles size={16} aria-hidden="true" />
              Check with AI
            </Button>
            <Button
              variant="secondary"
              disabled={empty}
              loading={finish.isPending}
              onClick={() => finish.mutate()}
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              Finish
            </Button>
            <span className="ml-auto flex items-center gap-1 text-sm text-muted" aria-live="polite">
              <Save size={14} aria-hidden="true" />
              {saveState === "saving" && "Saving…"}
              {saveState === "saved" && "Draft saved"}
              {saveState === "error" && "Could not save. Retrying on your next edit."}
              {saveState === "idle" && "Not saved yet"}
            </span>
          </div>
        </section>

        <aside aria-label="Feedback" className="flex flex-col gap-3">
          <FeedbackPanel
            feedback={feedback}
            loading={check.isPending}
            showScore={showScore}
            onShowScore={() => setShowScore(true)}
          />
        </aside>
      </div>

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="font-heading text-xl font-bold text-stroke">
          My drafts
        </h2>
        {drafts.isError ? (
          <ErrorState
            size="sm"
            description="Your drafts could not load."
            onRetry={() => void drafts.refetch()}
          />
        ) : !drafts.data ? (
          <Skeleton shape="rect" className="h-16 w-full" label="Loading drafts" />
        ) : drafts.data.length === 0 ? (
          <p className="text-sm text-muted">
            No drafts yet. Start writing and one will appear here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {drafts.data.map((draft) => (
              <li key={draft.id}>
                <button
                  type="button"
                  onClick={() => openDraft(draft)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-stroke bg-surface-0 p-3 text-left"
                >
                  <span className="min-w-0 truncate font-bold">{draft.title}</span>
                  <span className="shrink-0 text-sm text-muted">
                    {draft.wordCount} words · {dateFormat.format(new Date(draft.savedAt))}
                    {draft.finished ? " · Finished" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

interface FeedbackPanelProps {
  feedback: WritingFeedback | null;
  loading: boolean;
  showScore: boolean;
  onShowScore: () => void;
}

function FeedbackPanel({ feedback, loading, showScore, onShowScore }: FeedbackPanelProps) {
  if (loading) {
    return <Skeleton shape="rect" className="h-64 w-full" label="Checking your writing" />;
  }
  if (!feedback) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-stroke p-4 text-sm text-muted">
        Press “Check with AI” to get feedback on grammar, vocabulary and structure.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-stroke bg-surface-0 p-4 shadow-sm">
      <div>
        <h2 className="font-heading text-lg font-bold text-stroke">AI feedback</h2>
        <p className="text-xs text-muted">Preliminary. The AI might be wrong.</p>
      </div>
      <p className="text-sm">{feedback.summary}</p>
      <p className="text-sm font-semibold">{feedback.praise}</p>

      <FeedbackList title="What went well" items={feedback.strengths} />
      <FeedbackList title="To improve" items={feedback.areas_for_improvement} />

      {feedback.inline_corrections.length > 0 && (
        <div>
          <h3 className="text-sm font-bold">Corrections</h3>
          <ul className="mt-1 flex flex-col gap-2">
            {feedback.inline_corrections.map((item, index) => (
              <li
                key={`${item.original}-${index}`}
                className="rounded-xl bg-surface-100 p-2 text-sm"
              >
                <span className="text-xs font-bold uppercase text-muted">{item.category}</span>
                <p>
                  <del>{item.original}</del> → <strong>{item.suggestion}</strong>
                </p>
                <p className="text-muted">{item.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showScore ? (
        <p className="text-sm font-bold" data-testid="writing-score">
          Score {feedback.overall_score} of 4 · Level {feedback.cefr_level}
        </p>
      ) : (
        <Button variant="secondary" size="sm" onClick={onShowScore}>
          Show my scores
        </Button>
      )}
    </div>
  );
}

function FeedbackList({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-bold">{title}</h3>
      <ul className="list-disc pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

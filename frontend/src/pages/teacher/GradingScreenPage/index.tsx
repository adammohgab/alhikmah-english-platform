import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bot, MessageSquarePlus, Wand2 } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { useToast } from "@/shared/hooks/useToast";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Textarea } from "@/shared/components/ui/Textarea";
import { AudioFeedbackRecorder } from "@/shared/components/teacher/AudioFeedbackRecorder";
import {
  addInlineComment,
  fetchSubmission,
  GradingApiError,
  lockSubmission,
  saveGrade,
} from "./api";
import type { GradingQuestion, InlineComment, SubmissionForGrading } from "./api";
import {
  buildSavePayload,
  clamp,
  computeTotals,
  countWords,
  scoreFromRubric,
  selectionFromPoints,
  splitHighlights,
} from "./scoring";
import type { Rubric, RubricSelection } from "./scoring";

/* ========================================
   Grading screen (TEACHER-SPEC TC-21, task TCH-CORE-14)

   Left: the student's work, question by question. Select any text in a writing answer to attach
   an inline margin note. Right: the rubric evaluator (click a level to award points; the score
   recalculates at once), AI pre-grade suggestions, the overall comment and a voice note.
   Cmd/Ctrl + Enter saves through the `save_grade` RPC and opens the next student in the queue.
   The submission is locked for this teacher while the page is open (10-minute lock, refreshed).
   ======================================== */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm";
const LOCK_REFRESH_MS = 4 * 60 * 1000;
const LOCKED_CODE = "55P03";

type Scores = Record<string, number | null>;
type Selections = Record<string, RubricSelection>;

interface DraftComment {
  questionId: string;
  quote: string;
  start: number;
  end: number;
}

function initialScores(data: SubmissionForGrading): Scores {
  const scores: Scores = {};
  for (const q of data.questions) scores[q.question_id] = q.teacher_score ?? null;
  return scores;
}

function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** Character offset of a point inside `container`'s text (marks and plain text count alike). */
function offsetWithin(container: HTMLElement, node: Node, offset: number): number {
  const probe = document.createRange();
  probe.selectNodeContents(container);
  probe.setEnd(node, offset);
  return probe.toString().length;
}

function AnswerText({
  question,
  comments,
  onSelect,
}: {
  question: GradingQuestion;
  comments: InlineComment[];
  onSelect: (draft: DraftComment) => void;
}) {
  const text = question.student_answer ?? "";
  const ref = useRef<HTMLDivElement>(null);
  const segments = useMemo(
    () =>
      splitHighlights(
        text,
        comments.map((c) => ({ id: c.id, start: c.start_offset, end: c.end_offset })),
      ),
    [text, comments],
  );

  const captureSelection = () => {
    const container = ref.current;
    const selection = window.getSelection();
    if (!container || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
      return;
    }
    const start = offsetWithin(container, range.startContainer, range.startOffset);
    const end = offsetWithin(container, range.endContainer, range.endOffset);
    const quote = text.slice(start, end);
    if (end <= start || quote.trim() === "") return;
    onSelect({ questionId: question.question_id, quote, start, end });
  };

  return (
    // A focusable read-only textbox: text can be selected with the pointer or Shift + arrow keys.
    <div
      ref={ref}
      onMouseUp={captureSelection}
      onKeyUp={captureSelection}
      role="textbox"
      aria-readonly="true"
      aria-multiline="true"
      tabIndex={0}
      aria-label="Student answer. Select text to add a margin note."
      data-answer={question.question_id}
      className="whitespace-pre-wrap break-words text-base leading-7 text-stroke"
    >
      {segments.map((segment, index) =>
        segment.commentIds.length > 0 ? (
          <mark
            key={index}
            data-comment-ids={segment.commentIds.join(" ")}
            className="rounded-[4px] bg-[var(--world-soft,#ffd93d)] px-0.5 text-stroke"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </div>
  );
}

function QuestionReader({
  question,
  index,
  comments,
  draft,
  onSelect,
  onDraftBody,
  onSubmitDraft,
  onCancelDraft,
  draftBody,
  posting,
}: {
  question: GradingQuestion;
  index: number;
  comments: InlineComment[];
  draft: DraftComment | null;
  draftBody: string;
  posting: boolean;
  onSelect: (draft: DraftComment) => void;
  onDraftBody: (value: string) => void;
  onSubmitDraft: () => void;
  onCancelDraft: () => void;
}) {
  const own = comments.filter((c) => c.question_id === question.question_id);
  const activeDraft = draft?.questionId === question.question_id ? draft : null;
  const answer = question.student_answer ?? "";
  const noteField = useRef<HTMLTextAreaElement>(null);
  const hasDraft = activeDraft !== null;
  useEffect(() => {
    if (hasDraft) noteField.current?.focus();
  }, [hasDraft]);

  return (
    <article className={PANEL} aria-labelledby={`q-${question.question_id}`}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h2 id={`q-${question.question_id}`} className="font-display text-lg font-extrabold">
          {index + 1}. {question.prompt}
        </h2>
        <Chip size="sm">{formatPoints(question.max_points)} pts</Chip>
      </header>

      {question.is_writing ? (
        <>
          <AnswerText question={question} comments={own} onSelect={onSelect} />
          <p className="mt-2 text-sm text-muted">{countWords(answer)} words</p>
        </>
      ) : (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-bold text-muted">Student answer</dt>
            <dd className="font-semibold text-stroke">{answer || "No answer"}</dd>
          </div>
          <div>
            <dt className="font-bold text-muted">Correct answer</dt>
            <dd className="font-semibold text-stroke">{question.correct_answer ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="sr-only">Auto score</dt>
            <dd>
              <Chip size="sm" world="mint">
                Auto score {formatPoints(question.auto_score ?? 0)} /{" "}
                {formatPoints(question.max_points)}
              </Chip>
            </dd>
          </div>
        </dl>
      )}

      {own.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Margin notes">
          {own.map((c) => (
            <li
              key={c.id}
              className="rounded-[12px] border-2 border-stroke bg-surface-100 px-3 py-2 text-sm"
            >
              {c.quote && <q className="mb-1 block text-muted">{c.quote}</q>}
              <span className="font-semibold">{c.body}</span>
            </li>
          ))}
        </ul>
      )}

      {activeDraft && (
        <div className="mt-3 space-y-2 rounded-[12px] border-2 border-stroke bg-surface-100 p-3">
          <p className="text-sm text-muted">
            Note on <q>{activeDraft.quote}</q>
          </p>
          <Textarea
            aria-label="Margin note"
            value={draftBody}
            onChange={(e) => onDraftBody(e.target.value)}
            ref={noteField}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onSubmitDraft}
              loading={posting}
              disabled={draftBody.trim() === ""}
            >
              <MessageSquarePlus size={16} aria-hidden="true" /> Add note
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelDraft}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function RubricEvaluator({
  question,
  rubric,
  selection,
  score,
  onPick,
  onScore,
  onAcceptAi,
}: {
  question: GradingQuestion;
  rubric: Rubric | null;
  selection: RubricSelection;
  score: number | null;
  onPick: (criterionId: string, levelIndex: number) => void;
  onScore: (value: number | null) => void;
  onAcceptAi: () => void;
}) {
  const ai = question.ai;
  return (
    <section className={PANEL} aria-label={`Score: ${question.prompt}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display min-w-0 truncate font-extrabold">{question.prompt}</h3>
        <output
          aria-live="polite"
          data-testid={`score-${question.question_id}`}
          className="rounded-[10px] border-2 border-stroke bg-surface-0 px-2 py-1 text-sm font-extrabold shadow-retro-sm"
        >
          {score === null ? "—" : formatPoints(score)} / {formatPoints(question.max_points)}
        </output>
      </div>

      {ai && (
        <div className="mb-3 rounded-[12px] border-2 border-stroke bg-surface-100 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-bold">
            <Bot size={16} aria-hidden="true" /> AI suggests {formatPoints(ai.score)} /{" "}
            {formatPoints(question.max_points)}
            {ai.confidence != null && (
              <span className="font-semibold text-muted">
                {" "}
                · {Math.round(ai.confidence * 100)}% confident
              </span>
            )}
          </p>
          {ai.comment && <p className="mt-1 text-muted">{ai.comment}</p>}
          <Button size="sm" variant="outline" className="mt-2" onClick={onAcceptAi}>
            <Wand2 size={16} aria-hidden="true" /> Accept AI score
          </Button>
        </div>
      )}

      {rubric && rubric.criteria.length > 0 ? (
        <div className="space-y-3">
          {rubric.criteria.map((criterion) => (
            <fieldset key={criterion.id} className="min-w-0">
              <legend className="mb-1 text-sm font-extrabold">{criterion.name}</legend>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={criterion.name}>
                {criterion.levels.map((level, levelIndex) => {
                  const selected = selection[criterion.id] === levelIndex;
                  return (
                    <button
                      key={`${criterion.id}-${levelIndex}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      title={level.description ?? undefined}
                      onClick={() => onPick(criterion.id, levelIndex)}
                      className={cn(
                        "rounded-[10px] border-2 border-stroke px-2.5 py-1 text-sm font-bold",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                        selected
                          ? "bg-[var(--world-main,#ffb84d)] shadow-retro-sm"
                          : "bg-surface-0 hover:bg-surface-100",
                      )}
                    >
                      {level.label} · {formatPoints(level.points)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      ) : (
        <p className="mb-2 text-sm text-muted">No rubric is attached. Enter the score directly.</p>
      )}

      <label className="mt-3 flex items-center gap-2 text-sm font-bold">
        Score
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={question.max_points}
          step="0.5"
          value={score ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") return onScore(null);
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) onScore(clamp(parsed, 0, question.max_points));
          }}
          className="w-24 rounded-[10px] border-2 border-stroke bg-surface-0 px-2 py-1 font-semibold"
        />
      </label>
    </section>
  );
}

function GradingWorkspace({
  submissionId,
  data,
}: {
  submissionId: string;
  data: SubmissionForGrading;
}) {
  const navigate = useNavigate();
  const toast = useToast();

  const rubric: Rubric | null = data.rubric ?? null;
  const [scores, setScores] = useState<Scores>(() => initialScores(data));
  const [selections, setSelections] = useState<Selections>({});
  const [overall, setOverall] = useState(data.submission.overall_comment ?? "");
  const [voiceAssetId, setVoiceAssetId] = useState<string | null>(null);
  const [comments, setComments] = useState<InlineComment[]>(data.comments);
  const [draft, setDraft] = useState<DraftComment | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [dirty, setDirty] = useState(false);
  const [lockedBy, setLockedBy] = useState<string | null>(null);

  const touch = () => setDirty(true);

  // Hold the grading lock while the page is open and refresh it before the 10 minutes run out.
  useEffect(() => {
    let cancelled = false;
    const acquire = () =>
      lockSubmission(submissionId)
        .then(() => {
          if (!cancelled) setLockedBy(null);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          if (error instanceof GradingApiError && error.code === LOCKED_CODE) {
            setLockedBy(error.message);
          } else {
            toast.show({
              type: "error",
              title: "Could not lock this submission",
              description: error instanceof Error ? error.message : "Try again in a moment.",
            });
          }
        });
    void acquire();
    const timer = window.setInterval(() => void acquire(), LOCK_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // The toast handle is stable for the life of the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  useEffect(() => {
    if (!dirty) return undefined;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  const scoreInputs = useMemo(
    () =>
      data.questions.map((q) => ({
        questionId: q.question_id,
        isWriting: q.is_writing,
        maxPoints: q.max_points,
        autoScore: q.auto_score ?? null,
        teacherScore: q.is_writing ? (scores[q.question_id] ?? null) : null,
      })),
    [data.questions, scores],
  );
  const totals = useMemo(() => computeTotals(scoreInputs), [scoreInputs]);
  const writing = data.questions.filter((q) => q.is_writing);

  const setScore = (questionId: string, value: number | null) => {
    setScores((prev) => ({ ...prev, [questionId]: value }));
    touch();
  };

  const pickLevel = (question: GradingQuestion, criterionId: string, levelIndex: number) => {
    if (!rubric) return;
    const next: RubricSelection = {
      ...(selections[question.question_id] ?? {}),
      [criterionId]: levelIndex,
    };
    setSelections((prev) => ({ ...prev, [question.question_id]: next }));
    // Recalculate straight away; the total only counts once the teacher has chosen a level.
    setScore(question.question_id, scoreFromRubric(rubric, next, question.max_points));
  };

  const acceptAi = (question: GradingQuestion) => {
    const ai = question.ai;
    if (!ai) return;
    // Show the AI's level choices for reference, but the score applied is the one the card shows.
    if (rubric && ai.criteria) {
      const next = selectionFromPoints(rubric, ai.criteria);
      setSelections((prev) => ({ ...prev, [question.question_id]: next }));
    }
    setScore(question.question_id, clamp(ai.score, 0, question.max_points));
  };

  const commentMutation = useMutation({
    mutationFn: (current: DraftComment) =>
      addInlineComment({
        submissionId,
        questionId: current.questionId,
        body: draftBody.trim(),
        quote: current.quote,
        startOffset: current.start,
        endOffset: current.end,
      }),
    onSuccess: (result, current) => {
      setComments((prev) => [
        ...prev,
        {
          id: result.id,
          question_id: current.questionId,
          body: draftBody.trim(),
          quote: current.quote,
          start_offset: current.start,
          end_offset: current.end,
        },
      ]);
      setDraft(null);
      setDraftBody("");
    },
    onError: (error: unknown) =>
      toast.show({
        type: "error",
        title: "Margin note was not saved",
        description: error instanceof Error ? error.message : "Try again.",
      }),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const built = buildSavePayload(submissionId, scoreInputs, overall, voiceAssetId);
      if (!built.ok) throw new Error(built.reason);
      return saveGrade(built.payload);
    },
    onSuccess: () => {
      setDirty(false);
      const next = data.neighbors.next;
      toast.show({ type: "success", title: "Grade saved" });
      navigate(next ? `/teacher/grading/${encodeURIComponent(next)}` : "/teacher/grading");
    },
    onError: (error: unknown) =>
      toast.show({
        type: "error",
        title: "Grade was not saved",
        description: error instanceof Error ? error.message : "Try again.",
      }),
  });

  const saveAndNext = useCallback(() => {
    if (lockedBy || saveMutation.isPending) return;
    saveMutation.mutate();
  }, [lockedBy, saveMutation]);

  // Cmd/Ctrl + Enter works from anywhere on the page, including the text fields.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        saveAndNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveAndNext]);

  return (
    <div className="flex min-h-0 flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          to="/teacher/grading"
          className="inline-flex items-center gap-1 rounded-[10px] border-2 border-stroke bg-surface-0 px-2.5 py-1.5 text-sm font-bold shadow-retro-sm"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Queue
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-xl font-extrabold">
            {data.submission.student.full_name}
          </h1>
          <p className="truncate text-sm text-muted">
            {data.submission.assignment_title} · {data.submission.class.name}
          </p>
        </div>
        <output
          aria-live="polite"
          data-testid="total-score"
          className="rounded-[12px] border-2 border-stroke bg-surface-0 px-3 py-1.5 text-sm font-extrabold shadow-retro-sm"
        >
          Total {formatPoints(totals.final)} / {formatPoints(totals.max)}
          <span className="ml-2 font-semibold text-muted">
            (auto {formatPoints(totals.auto)} + writing {formatPoints(totals.writing)})
          </span>
        </output>
        <Button onClick={saveAndNext} loading={saveMutation.isPending} disabled={lockedBy !== null}>
          Save &amp; Next
          <kbd className="ml-2 hidden rounded border border-stroke px-1 text-xs sm:inline">
            Ctrl/⌘ ↵
          </kbd>
        </Button>
      </header>

      {lockedBy && (
        <p
          role="alert"
          className="rounded-[12px] border-2 border-stroke bg-[var(--world-soft,#ffd93d)] p-3 text-sm font-bold"
        >
          {lockedBy}
        </p>
      )}

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4" aria-label="Student work">
          {data.questions.map((q, index) => (
            <QuestionReader
              key={q.question_id}
              question={q}
              index={index}
              comments={comments}
              draft={draft}
              draftBody={draftBody}
              posting={commentMutation.isPending}
              onSelect={(next) => {
                setDraft(next);
                setDraftBody("");
              }}
              onDraftBody={setDraftBody}
              onSubmitDraft={() => draft && commentMutation.mutate(draft)}
              onCancelDraft={() => {
                setDraft(null);
                setDraftBody("");
              }}
            />
          ))}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start" aria-label="Grading panel">
          {writing.length === 0 && (
            <p className={cn(PANEL, "text-sm text-muted")}>
              This submission has no writing answers. Every question was scored automatically.
            </p>
          )}
          {writing.map((q) => (
            <RubricEvaluator
              key={q.question_id}
              question={q}
              rubric={rubric}
              selection={selections[q.question_id] ?? {}}
              score={scores[q.question_id] ?? null}
              onPick={(criterionId, levelIndex) => pickLevel(q, criterionId, levelIndex)}
              onScore={(value) => setScore(q.question_id, value)}
              onAcceptAi={() => acceptAi(q)}
            />
          ))}

          <section className={PANEL} aria-label="Overall comment">
            <Textarea
              label="Overall comment"
              value={overall}
              onChange={(e) => {
                setOverall(e.target.value);
                touch();
              }}
              helperText="Shown to the student with the grade."
            />
          </section>

          <AudioFeedbackRecorder
            onSaved={({ assetId }) => {
              // The asset id is stored in the feedback; students get a fresh signed URL from it.
              setVoiceAssetId(assetId);
              touch();
            }}
            onRemoved={() => {
              setVoiceAssetId(null);
              touch();
            }}
            onError={(message) =>
              toast.show({ type: "error", title: "Audio feedback", description: message })
            }
          />
        </aside>
      </div>
    </div>
  );
}

export default function GradingScreenPage() {
  const { submissionId = "" } = useParams<{ submissionId: string }>();
  const query = useQuery({
    queryKey: ["teacher", "grading", "submission", submissionId],
    queryFn: () => fetchSubmission(submissionId),
    enabled: submissionId !== "",
    // The workspace owns edits once loaded; refetching would not be merged back in.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  if (query.isPending) {
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        <Skeleton className="h-10 w-full" label="Loading submission…" />
        <Skeleton className="h-64 w-full" label={null} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Could not open this submission"
        description={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }
  // `key` resets the workspace state when the route moves to the next student.
  return <GradingWorkspace key={submissionId} submissionId={submissionId} data={query.data} />;
}

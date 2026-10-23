import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Sparkles, Trash2 } from "lucide-react";
import { ActionCardDisplay, type ActionCardData } from "@/shared/components/ai/ActionCardDisplay";
import { Button } from "@/shared/components/ui/Button";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Input } from "@/shared/components/ui/Input";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Textarea } from "@/shared/components/ui/Textarea";
import { useToast } from "@/shared/hooks/useToast";
import {
  LOW_SCORE_PCT,
  applyCard,
  discardCard,
  fetchEvidence,
  generatePlan,
  savePlan,
  type DraftGoal,
} from "./api";

/* AI support plan (TC-32): evidence from the student's recent low scores, an AI-drafted diagnosis,
   up to three goals, strategies and action cards. The teacher edits everything, approves each
   card one by one and finalizes the plan with a follow-up check-in date. Students never see the
   plan itself, only the assignments, quests and announcements the approved cards create. */

const MAX_GOALS = 3;
const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

export default function SupportPlanPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [search] = useSearchParams();
  const classHint = search.get("class");
  const toast = useToast();

  const [issue, setIssue] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [goals, setGoals] = useState<DraftGoal[]>([]);
  const [strategies, setStrategies] = useState<string[]>([]);
  const [cards, setCards] = useState<ActionCardData[]>([]);
  const [reviewDate, setReviewDate] = useState("");
  const [saved, setSaved] = useState(false);

  const evidence = useQuery({
    queryKey: ["teacher-support-plan", "evidence", studentId, classHint],
    queryFn: () => fetchEvidence(studentId!, classHint),
    enabled: studentId !== undefined,
  });

  const generate = useMutation({
    mutationFn: () => generatePlan(studentId!, evidence.data?.classId ?? null, issue),
    onSuccess: (draft) => {
      setDiagnosis(draft.diagnosis);
      setGoals(draft.goals);
      setStrategies(draft.strategies);
      setCards(draft.cards);
      setSaved(false);
    },
    onError: (error: Error) =>
      toast.show({
        title: "The plan was not generated",
        description: error.message,
        type: "error",
      }),
  });

  const setStatus = (id: string, status: ActionCardData["status"]) =>
    setCards((current) => current.map((card) => (card.id === id ? { ...card, status } : card)));

  const apply = useMutation({
    mutationFn: applyCard,
    onSuccess: (_result, id) => {
      setStatus(id, "approved");
      toast.show({ title: "Approved and assigned", type: "success" });
    },
    onError: (error: Error, id) => {
      setStatus(id, /changed since/i.test(error.message) ? "stale" : "failed");
      toast.show({ title: "Could not apply this step", description: error.message, type: "error" });
    },
  });
  const discard = useMutation({
    mutationFn: discardCard,
    onSuccess: (_result, id) => setStatus(id, "discarded"),
    onError: (error: Error) =>
      toast.show({
        title: "Could not discard this step",
        description: error.message,
        type: "error",
      }),
  });

  const finalize = useMutation({
    mutationFn: () =>
      savePlan({
        studentId: studentId!,
        classId: evidence.data?.classId ?? null,
        diagnosis,
        goals: goals.filter((goal) => goal.title.trim() !== ""),
        strategies: strategies.filter((item) => item.trim() !== ""),
        reviewDate,
      }),
    onSuccess: () => {
      setSaved(true);
      toast.show({ title: "Support plan saved", type: "success" });
    },
    onError: (error: Error) =>
      toast.show({ title: "The plan was not saved", description: error.message, type: "error" }),
  });

  useEffect(() => {
    setSaved(false);
  }, [diagnosis, goals, strategies, reviewDate]);

  const patchGoal = (id: string, change: Partial<DraftGoal>) =>
    setGoals((current) => current.map((goal) => (goal.id === id ? { ...goal, ...change } : goal)));

  const data = evidence.data;
  const name = data?.studentName ?? "this student";
  const hasPlan = diagnosis !== "" || goals.length > 0 || strategies.length > 0 || cards.length > 0;
  const canFinalize = goals.some((goal) => goal.title.trim() !== "");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-2">
        <Link
          to="/teacher/students"
          className="flex items-center gap-1 text-sm font-bold underline"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to students
        </Link>
        <h1 className="font-heading text-[28px] font-bold leading-tight text-stroke">
          Support plan{data?.studentName ? ` for ${data.studentName}` : ""}
        </h1>
        <p className="text-sm text-muted">
          Only you and other teachers of this class see this plan.{" "}
          {name === "this student" ? "The student" : name} only receives the normal assignments,
          quests and messages you approve.
        </p>
      </header>

      {evidence.isError ? (
        <ErrorState
          description="The student's results could not load. Check your connection and try again."
          onRetry={() => void evidence.refetch()}
        />
      ) : !data ? (
        <Skeleton shape="rect" className="h-40 w-full" label="Loading results" />
      ) : (
        <section
          aria-labelledby="evidence-heading"
          className="flex flex-col gap-3 rounded-2xl border-2 border-stroke bg-surface-0 p-4 shadow-sm"
        >
          <h2 id="evidence-heading" className="font-heading text-xl font-bold">
            What the data shows
          </h2>
          {data.lowAttempts.length === 0 ? (
            <p className="text-sm text-muted">
              No graded work under {LOW_SCORE_PCT}% yet. You can still write a plan by hand or
              describe the issue below.
            </p>
          ) : (
            <>
              <p className="text-sm">
                {data.lowAttempts.length} recent{" "}
                {data.lowAttempts.length === 1 ? "result" : "results"} under {LOW_SCORE_PCT}%, with{" "}
                {data.wrongAnswers} wrong {data.wrongAnswers === 1 ? "answer" : "answers"}.
              </p>
              {data.weakTopics.length > 0 && (
                <ul aria-label="Weak topics" className="flex flex-wrap gap-2">
                  {data.weakTopics.map((item) => (
                    <li
                      key={item.topic}
                      className="rounded-full border-2 border-stroke bg-world-amber-300 px-3 py-1 text-sm font-bold"
                    >
                      {item.topic} · {item.wrong} wrong
                    </li>
                  ))}
                </ul>
              )}
              <ul className="flex flex-col gap-1 text-sm">
                {data.lowAttempts.map((attempt) => (
                  <li
                    key={attempt.id}
                    className="flex justify-between gap-3 rounded-xl bg-surface-100 px-3 py-2"
                  >
                    <span className="truncate font-semibold">{attempt.title}</span>
                    <span className="shrink-0">
                      {Math.round(attempt.pct)}%
                      {attempt.submittedAt
                        ? ` · ${dateFormat.format(new Date(attempt.submittedAt))}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <Input
            label="Focus (optional)"
            helperText="For example: conditionals, writing structure."
            value={issue}
            maxLength={200}
            onChange={(event) => setIssue(event.target.value)}
          />
          <div>
            <Button loading={generate.isPending} onClick={() => generate.mutate()}>
              <Sparkles size={16} aria-hidden="true" />
              {hasPlan ? "Regenerate plan" : "Generate support plan"}
            </Button>
          </div>
        </section>
      )}

      {generate.isPending && (
        <Skeleton shape="rect" className="h-48 w-full" label="Preparing the plan" />
      )}

      {hasPlan && !generate.isPending && (
        <>
          <section aria-labelledby="diagnosis-heading" className="flex flex-col gap-2">
            <h2 id="diagnosis-heading" className="font-heading text-xl font-bold">
              Diagnosis
            </h2>
            <Textarea
              aria-labelledby="diagnosis-heading"
              rows={4}
              value={diagnosis}
              onChange={(event) => setDiagnosis(event.target.value)}
            />
            <p className="text-xs text-muted">
              AI draft. Preliminary. Edit anything that looks wrong.
            </p>
          </section>

          <section aria-labelledby="goals-heading" className="flex flex-col gap-3">
            <h2 id="goals-heading" className="font-heading text-xl font-bold">
              Goals
            </h2>
            <ul className="flex flex-col gap-3">
              {goals.map((goal, index) => (
                <li
                  key={goal.id}
                  className="flex flex-col gap-2 rounded-2xl border-2 border-stroke bg-surface-0 p-3"
                >
                  <Input
                    label={`Goal ${index + 1}`}
                    value={goal.title}
                    onChange={(event) => patchGoal(goal.id, { title: event.target.value })}
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input
                      label="Target"
                      value={goal.target}
                      onChange={(event) => patchGoal(goal.id, { target: event.target.value })}
                    />
                    <Input
                      label="Date"
                      type="date"
                      value={goal.dueDate}
                      onChange={(event) => patchGoal(goal.id, { dueDate: event.target.value })}
                    />
                  </div>
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setGoals((current) => current.filter((item) => item.id !== goal.id))
                      }
                    >
                      <Trash2 size={14} aria-hidden="true" /> Remove goal
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {goals.length < MAX_GOALS && (
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setGoals((current) => [
                      ...current,
                      { id: `goal-${Date.now()}`, title: "", target: "", dueDate: "" },
                    ])
                  }
                >
                  <Plus size={14} aria-hidden="true" /> Add goal
                </Button>
              </div>
            )}
          </section>

          <section aria-labelledby="strategies-heading" className="flex flex-col gap-2">
            <h2 id="strategies-heading" className="font-heading text-xl font-bold">
              Intervention strategies
            </h2>
            {strategies.map((strategy, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Textarea
                    aria-label={`Strategy ${index + 1}`}
                    rows={2}
                    value={strategy}
                    onChange={(event) =>
                      setStrategies((current) =>
                        current.map((item, at) => (at === index ? event.target.value : item)),
                      )
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove strategy ${index + 1}`}
                  onClick={() =>
                    setStrategies((current) => current.filter((_, at) => at !== index))
                  }
                >
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              </div>
            ))}
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStrategies((current) => [...current, ""])}
              >
                <Plus size={14} aria-hidden="true" /> Add strategy
              </Button>
            </div>
          </section>

          {cards.length > 0 && (
            <section aria-labelledby="steps-heading" className="flex flex-col gap-3">
              <h2 id="steps-heading" className="font-heading text-xl font-bold">
                Practice and actions
              </h2>
              <p className="text-sm text-muted">
                Each step shows the exact change. Nothing reaches the student until you approve it.
              </p>
              {cards.map((card) => (
                <ActionCardDisplay
                  key={card.id}
                  card={card}
                  applying={apply.isPending && apply.variables === card.id}
                  discarding={discard.isPending && discard.variables === card.id}
                  onApply={() => apply.mutate(card.id)}
                  onDiscard={() => discard.mutate(card.id)}
                  onRegenerate={() => generate.mutate()}
                />
              ))}
            </section>
          )}

          <section
            aria-labelledby="followup-heading"
            className="flex flex-col gap-3 rounded-2xl border-2 border-stroke bg-surface-0 p-4 shadow-sm"
          >
            <h2 id="followup-heading" className="font-heading text-xl font-bold">
              Follow-up check-in
            </h2>
            <Input
              label="Review date"
              type="date"
              value={reviewDate}
              onChange={(event) => setReviewDate(event.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={!canFinalize}
                loading={finalize.isPending}
                onClick={() => finalize.mutate()}
              >
                Finalize plan
              </Button>
              {saved && (
                <span role="status" className="text-sm font-bold">
                  Plan saved
                </span>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

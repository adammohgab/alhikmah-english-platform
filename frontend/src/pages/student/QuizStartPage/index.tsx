import { useId, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock, Lock, Repeat, Target, ListChecks } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Checkbox } from "@/shared/components/ui/Checkbox";
import { Chip } from "@/shared/components/ui/Chip";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { useAuth } from "@/app/providers/auth-context";
import { useToast } from "@/shared/hooks/useToast";
import { attemptsText, typeLabel } from "./rules";
import {
  QUIZ_BRIEF_KEY,
  StartQuizError,
  fetchQuizBrief,
  startQuizAttempt,
  type QuizBrief,
} from "./api";

/* ========================================
   Quiz start (STUDENT-SPEC ST-08, task STU-CORE-09)

   A calm briefing before a timed quiz: title, course and unit, a facts row (questions, time
   limit, pass mark, attempts left), the rules, the question types, and one checkbox that is both
   "I am ready" and the honor pledge. "Start quiz" calls `start_quiz_attempt` and opens the runner
   at /student/quizzes/:quizId/attempt/:attemptId. Three other states replace the form: locked
   (reason and a way back to the lessons), attempts used up (best score, "Ask your teacher"), and
   a failed load. The server is the judge of every lock and limit; a refusal at start is shown
   in place, never swallowed.
   ======================================== */

const DEFAULT_RULES: readonly string[] = [
  "Do the whole quiz in one sitting.",
  "The timer cannot be paused once you start.",
  "No hints or power-ups are allowed.",
  "You cannot go back after you submit.",
];

const SHUFFLE_NOTICE = "Questions appear in a random order, so yours may differ from a friend's.";
const PLEDGE = "I am ready, and I promise to answer on my own, with no help.";
const QUIZZES_PATH = "/student/quizzes";

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-[12px] border-2 border-stroke bg-surface-0 px-3 py-3 text-center">
      <span aria-hidden="true">{icon}</span>
      <span className="text-lg font-extrabold tabular-nums text-stroke">{value}</span>
      <span className="text-xs font-semibold text-muted">{label}</span>
    </div>
  );
}

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[720px] flex-col justify-center gap-5 px-4 py-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-stroke">{title}</h1>
        {subtitle && <p className="text-muted">{subtitle}</p>}
      </header>
      {children}
    </main>
  );
}

function BackLink({ label = "Back" }: { label?: string }) {
  const navigate = useNavigate();
  return (
    <Button
      variant="secondary"
      onClick={() => {
        void navigate(QUIZZES_PATH);
      }}
    >
      {label}
    </Button>
  );
}

function subtitleOf(brief: QuizBrief): string | undefined {
  const parts = [brief.course, brief.unit].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export default function QuizStartPage() {
  const { quizId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const readyId = useId();
  const [ready, setReady] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const query = useQuery({
    queryKey: [QUIZ_BRIEF_KEY, quizId, user?.id],
    queryFn: () => fetchQuizBrief(quizId!),
    enabled: Boolean(quizId) && Boolean(user?.id),
    refetchOnWindowFocus: true,
  });

  const start = useMutation({
    mutationFn: () => startQuizAttempt(quizId!),
    onSuccess: (attempt) => {
      void navigate(`${QUIZZES_PATH}/${quizId}/attempt/${attempt.attemptId}`);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "We could not start the quiz.";
      if (error instanceof StartQuizError && error.kind !== "network" && error.kind !== "failed") {
        // The state changed since the page loaded (last attempt used, quiz closed): show it in place.
        setRefusal(message);
        void query.refetch();
      } else {
        toast.show({ type: "error", title: message });
      }
    },
  });

  if (!quizId) {
    return (
      <Shell title="Quiz not found">
        <ErrorState
          title="We could not find this quiz"
          action={<BackLink label="Back to quizzes" />}
        />
      </Shell>
    );
  }

  if (query.isPending) {
    return (
      <Shell title="Loading quiz">
        <div aria-busy="true" aria-label="Loading quiz" className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Shell>
    );
  }

  if (query.isError) {
    return (
      <Shell title="Quiz">
        <ErrorState
          title="We could not open this quiz"
          description={query.error.message}
          onRetry={() => void query.refetch()}
        />
        <div>
          <BackLink />
        </div>
      </Shell>
    );
  }

  const brief = query.data;
  const exhausted = brief.attemptsLeft !== null && brief.attemptsLeft <= 0 && !brief.resuming;

  if (brief.locked) {
    const lessons = brief.lessonsRemaining;
    return (
      <Shell title={brief.title} subtitle={subtitleOf(brief)}>
        <Card padding="lg" shadow="sm" aria-live="polite">
          <div className="flex items-start gap-3">
            <Lock aria-hidden="true" size={22} />
            <div className="flex flex-col gap-3">
              <p className="font-semibold text-stroke">
                {brief.lockReason ??
                  (lessons !== null && lessons > 0
                    ? `Finish ${lessons} more ${lessons === 1 ? "lesson" : "lessons"} in this unit.`
                    : "This quiz is locked for now.")}
              </p>
              <div className="flex flex-wrap gap-3">
                {lessons !== null && lessons > 0 && (
                  <Button
                    onClick={() => {
                      void navigate("/student/courses");
                    }}
                  >
                    Go to the lessons
                  </Button>
                )}
                <BackLink />
              </div>
            </div>
          </div>
        </Card>
      </Shell>
    );
  }

  if (exhausted) {
    return (
      <Shell title={brief.title} subtitle={subtitleOf(brief)}>
        <Card padding="lg" shadow="sm" aria-live="polite">
          <div className="flex flex-col gap-3">
            {brief.bestScorePct !== null && (
              <p className="text-lg font-bold text-stroke">
                Your best score: {Math.round(brief.bestScorePct)}%
              </p>
            )}
            <p className="font-semibold text-stroke">No attempts left. Ask your teacher.</p>
            <div>
              <BackLink />
            </div>
          </div>
        </Card>
      </Shell>
    );
  }

  const rules = brief.rules.length > 0 ? brief.rules : DEFAULT_RULES;
  const busy = start.isPending;

  return (
    <Shell title={brief.title} subtitle={subtitleOf(brief)}>
      <Card padding="lg" shadow="sm">
        <section aria-label="Quiz facts" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact
            icon={<ListChecks size={20} />}
            label="Questions"
            value={brief.questionCount === null ? "–" : String(brief.questionCount)}
          />
          <Fact
            icon={<Clock size={20} />}
            label="Time limit"
            value={brief.timeLimitMin === null ? "No limit" : `${brief.timeLimitMin} min`}
          />
          <Fact
            icon={<Target size={20} />}
            label="Pass mark"
            value={brief.passMark === null ? "–" : `${Math.round(brief.passMark)}%`}
          />
          <Fact icon={<Repeat size={20} />} label="Attempts left" value={attemptsText(brief)} />
        </section>

        <section aria-labelledby={`${readyId}-rules`} className="mt-6">
          <h2 id={`${readyId}-rules`} className="font-display text-xl font-bold text-stroke">
            Before you start
          </h2>
          <ul className="mt-2 flex list-disc flex-col gap-1 ps-5 text-stroke">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
            {brief.shuffleQuestions && <li>{SHUFFLE_NOTICE}</li>}
            {brief.timeLimitMin !== null && (
              <li>{`You have ${brief.timeLimitMin} minutes. The quiz submits by itself when time runs out.`}</li>
            )}
          </ul>
        </section>

        {brief.questionTypes.length > 0 && (
          <section aria-label="Question types" className="mt-6">
            <h2 className="font-display text-xl font-bold text-stroke">Question types</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {brief.questionTypes.map((type) => (
                <li key={type}>
                  <Chip size="sm">{typeLabel(type)}</Chip>
                </li>
              ))}
            </ul>
          </section>
        )}

        {brief.resuming && (
          <p className="mt-6 font-semibold text-stroke" role="status">
            You already have an attempt running. Continue where you left off.
          </p>
        )}

        {refusal !== null && (
          <p role="alert" className="mt-6 font-semibold text-[#B3263A]">
            {refusal}
          </p>
        )}

        <div className="mt-6">
          <Checkbox
            id={readyId}
            checked={ready}
            disabled={busy}
            onCheckedChange={(value) => {
              setReady(value === true);
            }}
            label={PLEDGE}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            disabled={!ready}
            loading={busy}
            onClick={() => {
              setRefusal(null);
              start.mutate();
            }}
          >
            {brief.resuming ? "Resume quiz" : "Start quiz"}
          </Button>
          <BackLink />
        </div>
      </Card>
    </Shell>
  );
}

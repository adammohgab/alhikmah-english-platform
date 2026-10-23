import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import {
  RESULT_KEY,
  criterionMarks,
  fetchAssignmentResult,
  type AssignmentResult,
  type Criterion,
  type QuestionResult,
} from "./api";
import { MarkedText } from "./MarkedText";

/* Assignment result and feedback (ST-14): grade, rubric marks per criterion, the student's text
   with inline teacher comments, and the overall teacher feedback with an optional audio note.
   AI parts are labeled "AI review" and stay "Preliminary" until the teacher confirms. */

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const formatDate = (iso: string | null | undefined) =>
  iso ? dateFormat.format(new Date(iso)) : null;

/** Letter shown when the backend sent none; the percent itself always comes from the backend. */
function letterFor(pct: number): string {
  return pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F";
}

function answerText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "answer", "value"]) {
      if (typeof record[key] === "string") return record[key];
    }
  }
  return null;
}

function AudioNote({ src }: { src: string }) {
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- teacher voice note, no transcript is stored
    <audio controls src={src} className="w-full">
      Your browser cannot play this audio note.
    </audio>
  );
}

function RubricTable({ title, items }: { title: string; items: readonly Criterion[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-bold">{title}</h4>
      <ul className="mt-1 flex flex-col gap-2">
        {items.map((item, index) => {
          const { name, awarded, max } = criterionMarks(item);
          return (
            <li key={item.id ?? `${name}-${index}`} className="rounded-xl bg-surface-100 p-2">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold">{name}</span>
                <span className="font-bold">
                  {awarded ?? "–"}
                  {max !== null ? ` / ${max}` : ""}
                </span>
              </div>
              {awarded !== null && max !== null && max > 0 && (
                <ProgressBar value={awarded} max={max} label={name} />
              )}
              {item.comment && <p className="mt-1 text-sm text-muted">{item.comment}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function QuestionCard({ item, index }: { item: QuestionResult; index: number }) {
  const text = answerText(item.student_answer);
  const correct = answerText(item.correct_answer);
  const score = item.teacher?.score ?? item.score ?? null;
  const max = item.max_points ?? item.points ?? null;
  return (
    <li className="flex flex-col gap-3 rounded-2xl border-2 border-stroke bg-surface-0 p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-heading text-lg font-bold">
          {index + 1}. {item.prompt ?? "Question"}
        </h3>
        {score !== null && (
          <span className="shrink-0 font-bold">
            {score}
            {max !== null ? ` / ${max}` : ""}
          </span>
        )}
      </div>

      {text !== null && <MarkedText text={text} comments={item.comments} />}
      {correct !== null && (
        <p className="text-sm">
          <span className="font-bold">Correct answer: </span>
          {correct}
        </p>
      )}

      {item.teacher && (
        <section aria-label="Teacher feedback" className="flex flex-col gap-2">
          <h4 className="text-sm font-bold">Teacher feedback</h4>
          {item.teacher.comment && <p className="text-sm">{item.teacher.comment}</p>}
          <RubricTable title="Rubric marks" items={item.teacher.rubric ?? []} />
          {item.teacher.audio_url && <AudioNote src={item.teacher.audio_url} />}
        </section>
      )}

      {item.ai && (
        <section
          aria-label="AI review"
          className="flex flex-col gap-2 rounded-xl bg-surface-100 p-3"
        >
          <h4 className="text-sm font-bold">
            AI review{item.ai.preliminary ? " · Preliminary" : ""}
          </h4>
          {item.ai.summary && <p className="text-sm">{item.ai.summary}</p>}
          <RubricTable title="Rubric" items={item.ai.rubric ?? []} />
        </section>
      )}
    </li>
  );
}

function Summary({ result }: { result: AssignmentResult }) {
  const grade = result.grade;
  const pct = grade?.pct ?? null;
  return (
    <section
      aria-label="Grade"
      className="flex flex-col gap-3 rounded-3xl border-2 border-stroke bg-surface-0 p-5 shadow-md"
    >
      {grade && pct !== null ? (
        <div className="flex flex-wrap items-center gap-4">
          <span
            data-testid="letter-grade"
            className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-stroke bg-world-amber-300 font-heading text-4xl font-bold"
          >
            {grade.letter ?? letterFor(pct)}
          </span>
          <div>
            <p className="font-heading text-3xl font-bold" data-testid="grade-percent">
              {Math.round(pct)}%
            </p>
            {grade.points != null && (
              <p className="text-sm text-muted">
                {grade.points}
                {grade.max_points != null ? ` of ${grade.max_points}` : ""} points
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="font-bold">Waiting for your teacher to confirm</p>
      )}

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">Status</dt>
          <dd className="font-semibold capitalize">{result.status.replace(/_/g, " ")}</dd>
        </div>
        {formatDate(result.submitted_at) && (
          <div>
            <dt className="text-muted">Submitted</dt>
            <dd className="font-semibold">{formatDate(result.submitted_at)}</dd>
          </div>
        )}
        {formatDate(grade?.graded_at) && (
          <div>
            <dt className="text-muted">Graded</dt>
            <dd className="font-semibold">{formatDate(grade?.graded_at)}</dd>
          </div>
        )}
        {grade?.teacher_name && (
          <div>
            <dt className="text-muted">Teacher</dt>
            <dd className="font-semibold">{grade.teacher_name}</dd>
          </div>
        )}
      </dl>

      {(grade?.comment ?? grade?.audio_url) && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface-100 p-3">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <MessageCircle size={16} aria-hidden="true" /> Teacher feedback
          </h2>
          {grade.comment && <p className="text-sm">{grade.comment}</p>}
          {grade.audio_url && <AudioNote src={grade.audio_url} />}
        </div>
      )}
    </section>
  );
}

export default function AssignmentResultPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: [RESULT_KEY, assignmentId],
    queryFn: () => fetchAssignmentResult(assignmentId!),
    enabled: assignmentId !== undefined,
  });
  const result = query.data;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-2">
        <Link
          to="/student/assignments"
          className="flex items-center gap-1 text-sm font-bold underline"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to assignments
        </Link>
        <h1 className="font-heading text-[28px] font-bold leading-tight text-stroke">
          {result?.title ?? "Assignment result"}
        </h1>
      </header>

      {query.isError ? (
        <ErrorState
          description="Your result could not load. Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
      ) : !result ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <Skeleton shape="rect" className="h-40 w-full" label="Loading result" />
          <Skeleton shape="rect" className="h-32 w-full" label={null} />
        </div>
      ) : result.released === false ? (
        <p className="rounded-2xl border-2 border-dashed border-stroke p-4 text-sm">
          Your result is not released yet. Check back after your teacher confirms it.
        </p>
      ) : (
        <>
          <Summary result={result} />
          {result.per_question.length > 0 && (
            <ol aria-label="Question review" className="flex flex-col gap-3">
              {result.per_question.map((item, index) => (
                <QuestionCard
                  key={item.question_id ?? item.id ?? index}
                  item={item}
                  index={index}
                />
              ))}
            </ol>
          )}
          <div>
            <Button variant="secondary" onClick={() => navigate("/student/ai-tutor")}>
              Ask AI Tutor about my feedback
            </Button>
          </div>
        </>
      )}
    </main>
  );
}

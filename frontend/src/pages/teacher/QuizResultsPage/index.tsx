import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { useToast } from "@/shared/hooks/useToast";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { fetchQuizResults, grantExtraAttempt } from "./api";
import type { ItemResult, StudentResult } from "./api";
import { ScoreHistogram } from "./ScoreHistogram";
import {
  FLAG_LABEL,
  LOW_SUCCESS_PCT,
  formatDuration,
  hardestFirst,
  histogramBins,
  itemFlag,
} from "./rules";

/* ========================================
   Quiz results and item analysis (TEACHER-SPEC TC-18, task TCH-CORE-12)

   Class score distribution, the hardest questions with the wrong answer students pick most, and
   a per-student table with "Grant extra attempt". Route: /teacher/quizzes/:quizId/results.
   ======================================== */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm";

const STATUS_LABEL: Record<StudentResult["status"], string> = {
  passed: "Passed",
  not_passed: "Not passed",
  not_attempted: "Not attempted",
};

function pct(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border-2 border-stroke bg-surface-0 p-3 shadow-retro-sm">
      <dt className="text-sm font-bold text-muted">{label}</dt>
      <dd className="font-display text-xl font-extrabold">{value}</dd>
    </div>
  );
}

function ItemRow({ item }: { item: ItemResult }) {
  const flag = itemFlag(item.percent_correct);
  const low = item.percent_correct < LOW_SUCCESS_PCT;
  return (
    <li
      data-low-success={low || undefined}
      className={cn(
        "rounded-[14px] border-2 border-stroke p-3",
        low ? "bg-danger-100" : "bg-surface-0",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 font-bold">
          {item.question.position}. {item.question.prompt}
        </p>
        <span className="rounded-full border-2 border-stroke bg-surface-0 px-2.5 py-0.5 text-sm font-extrabold">
          {pct(item.percent_correct)} correct
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
        {item.common_wrong ? (
          <span>
            Most common wrong answer:{" "}
            <strong className="text-stroke">{item.common_wrong.answer}</strong> (
            {item.common_wrong.count})
          </span>
        ) : (
          <span>No common wrong answer</span>
        )}
        {item.avg_time_s != null && <span>· Avg time {formatDuration(item.avg_time_s)}</span>}
        {flag && (
          <Chip size="sm" world="amber" icon={<AlertTriangle size={13} />}>
            {FLAG_LABEL[flag]}
          </Chip>
        )}
      </div>
    </li>
  );
}

export default function QuizResultsPage() {
  const { quizId = "" } = useParams<{ quizId: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["teacher", "quiz-results", quizId], [quizId]);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchQuizResults(quizId),
    enabled: quizId !== "",
  });

  const grant = useMutation({
    mutationFn: (student: StudentResult["student"]) => grantExtraAttempt(quizId, student.id),
    onSuccess: async (_result, student) => {
      toast.show({ type: "success", title: `Extra attempt granted to ${student.full_name}` });
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown, student) =>
      toast.show({
        type: "error",
        title: `Could not grant an extra attempt to ${student.full_name}`,
        description: error instanceof Error ? error.message : "Try again.",
      }),
  });

  const data = query.data;
  const bins = useMemo(
    () =>
      histogramBins(
        (data?.students ?? []).flatMap((s) => (s.score_pct === null ? [] : [s.score_pct])),
      ),
    [data?.students],
  );
  const itemsHardest = useMemo(
    () =>
      hardestFirst(
        (data?.items ?? []).map((i) => ({
          ...i,
          id: i.question.id,
          position: i.question.position,
          percentCorrect: i.percent_correct,
        })),
      ),
    [data?.items],
  );

  if (query.isPending) {
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        <Skeleton className="h-12 w-2/3" label="Loading results…" />
        <Skeleton className="h-60 w-full" label={null} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load the quiz results"
        description={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { summary, students } = query.data;
  const lowCount = itemsHardest.filter((i) => i.percentCorrect < LOW_SUCCESS_PCT).length;

  return (
    <div className="space-y-5 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          to="/teacher/quizzes"
          className="inline-flex items-center gap-1 rounded-[10px] border-2 border-stroke bg-surface-0 px-2.5 py-1.5 text-sm font-bold shadow-retro-sm"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Quizzes
        </Link>
        <h1 className="font-display min-w-0 flex-1 truncate text-2xl font-extrabold">
          {summary.title}
        </h1>
        {summary.status && <Chip>{summary.status}</Chip>}
      </header>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" aria-label="Summary">
        <SummaryTile label="Attempts" value={String(summary.attempts)} />
        <SummaryTile label="Completion" value={pct(summary.completion_rate)} />
        <SummaryTile label="Average" value={pct(summary.average_score)} />
        <SummaryTile label="Highest" value={pct(summary.highest)} />
        <SummaryTile label="Lowest" value={pct(summary.lowest)} />
        <SummaryTile label="Avg time" value={formatDuration(summary.avg_time_s)} />
      </dl>

      <section className={PANEL} aria-labelledby="distribution-title">
        <h2 id="distribution-title" className="font-display mb-2 text-lg font-extrabold">
          Score distribution
        </h2>
        {students.every((s) => s.score_pct === null) ? (
          <EmptyState
            size="sm"
            title="No scores yet"
            description="The chart fills in once students submit."
          />
        ) : (
          <ScoreHistogram bins={bins} passMark={summary.pass_mark} />
        )}
      </section>

      <section className={PANEL} aria-labelledby="items-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="items-title" className="font-display text-lg font-extrabold">
            Item analysis
          </h2>
          {lowCount > 0 && (
            <Chip size="sm" world="amber" icon={<AlertTriangle size={13} />}>
              {lowCount} question{lowCount === 1 ? "" : "s"} under {LOW_SUCCESS_PCT}%
            </Chip>
          )}
        </div>
        {itemsHardest.length === 0 ? (
          <EmptyState size="sm" title="No question data yet" />
        ) : (
          <ol className="space-y-2" aria-label="Questions, hardest first">
            {itemsHardest.map((i) => (
              <ItemRow key={i.id} item={i} />
            ))}
          </ol>
        )}
      </section>

      <section className={PANEL} aria-labelledby="students-title">
        <h2 id="students-title" className="font-display mb-3 text-lg font-extrabold">
          Students
        </h2>
        {students.length === 0 ? (
          <EmptyState size="sm" title="No students are assigned this quiz" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b-2 border-stroke">
                  <th scope="col" className="py-2 pr-3">
                    Student
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Attempts
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Score
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Time
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Status
                  </th>
                  <th scope="col" className="py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((row) => (
                  <tr key={row.student.id} className="border-b border-stroke/20">
                    <th scope="row" className="py-2 pr-3 font-bold">
                      {row.student.full_name}
                    </th>
                    <td className="py-2 pr-3">
                      {row.attempts_used}
                      {row.attempts_allowed != null ? ` / ${row.attempts_allowed}` : ""}
                    </td>
                    <td className="py-2 pr-3 font-bold">{pct(row.score_pct)}</td>
                    <td className="py-2 pr-3">{formatDuration(row.time_spent_s)}</td>
                    <td className="py-2 pr-3">
                      <Chip size="sm" world={row.status === "passed" ? "mint" : undefined}>
                        {STATUS_LABEL[row.status]}
                      </Chip>
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={grant.isPending && grant.variables?.id === row.student.id}
                        onClick={() => grant.mutate(row.student)}
                        aria-label={`Grant extra attempt to ${row.student.full_name}`}
                      >
                        <RotateCcw size={14} aria-hidden="true" /> Grant extra attempt
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

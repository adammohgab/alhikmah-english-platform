import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Send } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { Dialog } from "@/shared/components/ui/Dialog";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { useToast } from "@/shared/hooks/useToast";
import { fetchResults, releaseGrades, resultsKey } from "./api";
import type { AssignmentResults } from "./api";
import {
  buildResultsCsv,
  csvFilename,
  formatScore,
  formatSubmittedAt,
  statusLabel,
  summarize,
} from "./rules";

/* ========================================
   Assignment results (TEACHER-SPEC TC-15, task TCH-CORE-10)

   `/teacher/assignments/:assignmentId/results`: every student in the class with a status,
   score, submission time and a red "Late" pill, summary tiles, CSV export and "Release all
   grades", which publishes graded work to students through the `release_grades` RPC (it also
   notifies each student).
   ======================================== */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm";

function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ResultsView({ assignmentId, data }: { assignmentId: string; data: AssignmentResults }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { assignment, submissions } = data;
  const summary = useMemo(() => summarize(submissions), [submissions]);
  const max = assignment.max_points ?? null;

  const release = useMutation({
    mutationFn: () => releaseGrades(assignmentId),
    onSuccess: (result) => {
      setConfirmOpen(false);
      toast.show({
        type: "success",
        title: "Grades released",
        description: `${result.released} student${result.released === 1 ? "" : "s"} notified.`,
      });
      void queryClient.invalidateQueries({ queryKey: resultsKey(assignmentId) });
    },
    onError: (error: unknown) =>
      toast.show({
        type: "error",
        title: "Grades were not released",
        description: error instanceof Error ? error.message : "Try again.",
      }),
  });

  const tiles: Array<[string, number]> = [
    ["Students", summary.total],
    ["Not started", summary.notStarted],
    ["Submitted", summary.submitted],
    ["Graded", summary.graded],
    ["Late", summary.late],
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          to="/teacher/assignments"
          className="inline-flex items-center gap-1 rounded-[10px] border-2 border-stroke bg-surface-0 px-2.5 py-1.5 text-sm font-bold shadow-retro-sm"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Assignments
        </Link>
        <h1 className="font-display min-w-0 flex-1 truncate text-xl font-extrabold">
          {assignment.title}
        </h1>
        <Button
          variant="outline"
          onClick={() =>
            downloadCsv(csvFilename(assignment.title), buildResultsCsv(submissions, max))
          }
          disabled={submissions.length === 0}
        >
          <Download size={16} aria-hidden="true" /> Export CSV
        </Button>
        <Button onClick={() => setConfirmOpen(true)} disabled={summary.unreleased === 0}>
          <Send size={16} aria-hidden="true" /> Release All Grades
        </Button>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Submission summary">
        {tiles.map(([label, value]) => (
          <div key={label} className={`${PANEL} !p-3`}>
            <dt className="text-sm font-bold text-muted">{label}</dt>
            <dd className="font-display text-2xl font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>

      {submissions.length === 0 ? (
        <EmptyState
          title="No students yet"
          description="Students in the class appear here once enrolled."
        />
      ) : (
        <div className={`${PANEL} overflow-x-auto`}>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Student submissions for {assignment.title}</caption>
            <thead>
              <tr className="border-b-2 border-stroke">
                <th scope="col" className="py-2 pr-3">
                  Student
                </th>
                <th scope="col" className="py-2 pr-3">
                  Status
                </th>
                <th scope="col" className="py-2 pr-3">
                  Score
                </th>
                <th scope="col" className="py-2">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((row) => (
                <tr key={row.student.id} className="border-b border-stroke/30">
                  <th scope="row" className="py-2 pr-3 font-bold">
                    {row.id && row.status !== "not_started" ? (
                      <Link to={`/teacher/grading/${encodeURIComponent(row.id)}`}>
                        {row.student.full_name}
                      </Link>
                    ) : (
                      row.student.full_name
                    )}
                  </th>
                  <td className="py-2 pr-3">
                    <Chip size="sm">{statusLabel(row.status)}</Chip>
                  </td>
                  <td className="py-2 pr-3">{formatScore(row.final, max)}</td>
                  <td className="py-2">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {formatSubmittedAt(row.submitted_at)}
                      {row.is_late === true && (
                        <span
                          data-testid="late-pill"
                          className="rounded-full border-2 border-stroke bg-red-600 px-2 py-0.5 text-xs font-extrabold text-white"
                        >
                          Late
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Release all grades?"
        description={`${summary.unreleased} graded submission${summary.unreleased === 1 ? "" : "s"} will become visible to students, and each student is notified.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => release.mutate()} loading={release.isPending}>
              Release grades
            </Button>
          </>
        }
      />
    </div>
  );
}

export default function AssignmentResultsPage() {
  const { assignmentId = "" } = useParams<{ assignmentId: string }>();
  const query = useQuery({
    queryKey: resultsKey(assignmentId),
    queryFn: () => fetchResults(assignmentId),
    enabled: assignmentId !== "",
  });

  if (query.isPending) {
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        <Skeleton className="h-10 w-full" label="Loading results…" />
        <Skeleton className="h-64 w-full" label={null} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load results"
        description={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return <ResultsView assignmentId={assignmentId} data={query.data} />;
}

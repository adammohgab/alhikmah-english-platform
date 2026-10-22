import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Select } from "@/shared/components/ui/Select";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/Tabs";
import { cn } from "@/shared/lib/utils/cn";
import { ASSIGNMENTS_KEY, fetchAssignments, type AssignmentRow, type AssignmentTab } from "./api";

/* Assignments list / homework hub (STUDENT-SPEC ST-11, task STU-CORE-12).
   Tabs To do, Submitted (waiting for review) and Graded, a course filter, and one card per
   assignment: title, class, due date with relative text, status, progress, points, rubric summary
   and an action. Overdue work carries a warning; graded work shows the teacher's final mark. */

const TABS: ReadonlyArray<{ id: AssignmentTab; label: string; empty: string }> = [
  { id: "todo", label: "To do", empty: "Nothing to do. Nice." },
  { id: "submitted", label: "Submitted (pending review)", empty: "Nothing is waiting for review." },
  { id: "graded", label: "Graded", empty: "No graded assignments yet." },
];

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  awaiting_teacher: "Awaiting teacher",
  graded: "Graded",
};
const statusText = (status: string): string => STATUS_LABEL[status] ?? status.replace(/_/g, " ");

function dueText(dueAt: string | null | undefined, now: number): string | null {
  if (!dueAt) return null;
  const due = Date.parse(dueAt);
  if (Number.isNaN(due)) return null;
  const date = new Date(due).toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const ms = due - now;
  const days = Math.floor(Math.abs(ms) / 86_400_000);
  const hours = Math.floor(Math.abs(ms) / 3_600_000);
  const span = days >= 1 ? `${days} day${days === 1 ? "" : "s"}` : `${Math.max(1, hours)} h`;
  return `${date} (${ms < 0 ? `${span} ago` : `in ${span}`})`;
}

function action(row: AssignmentRow): { label: string; to: string } {
  const id = encodeURIComponent(row.id);
  if (row.status === "graded")
    return { label: "View result", to: `/student/assignments/${id}/result` };
  if (row.status === "submitted" || row.status === "awaiting_teacher") {
    return { label: "View submission", to: `/student/assignments/${id}/result` };
  }
  if (row.status === "in_progress")
    return { label: "Continue", to: `/student/assignments/${id}/solve` };
  return { label: "Start", to: `/student/assignments/${id}` };
}

function Card({ row, now }: { row: AssignmentRow; now: number }) {
  const overdue = row.overdue === true && row.status !== "graded";
  const due = dueText(row.due_at, now);
  const go = action(row);
  const grade = row.status === "graded" ? row.grade : null;
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-[20px] border-2 bg-surface-0 p-4 shadow-[2px_2px_0px_#000]",
        overdue ? "border-danger-600" : "border-stroke",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display min-w-0 text-[18px] leading-tight text-stroke [overflow-wrap:anywhere]">
          {row.title}
        </h3>
        <span className="shrink-0 rounded-full border-2 border-stroke px-2 text-[12px] font-bold text-stroke">
          {statusText(row.status)}
        </span>
      </div>

      <p className="text-[14px] text-muted">
        {[row.class_name, row.course, row.kind].filter(Boolean).join(" | ")}
      </p>

      {due && (
        <p
          className={cn(
            "w-fit rounded-full border-2 px-2 text-[13px] font-bold",
            overdue
              ? "border-danger-600 bg-danger-100 text-danger-600"
              : "border-stroke text-stroke",
          )}
        >
          Due {due}
        </p>
      )}

      {overdue && (
        <p role="status" className="flex items-center gap-1 text-[14px] font-bold text-danger-600">
          <AlertTriangle size={16} aria-hidden="true" />
          {row.late_until
            ? `Overdue. Late work allowed until ${new Date(row.late_until).toLocaleDateString("en", { dateStyle: "medium" })}.`
            : "Overdue. Ask your teacher if you can still hand it in."}
        </p>
      )}

      <p className="flex flex-wrap gap-x-4 text-[14px] text-stroke">
        {row.progress && row.status !== "graded" && (
          <span>
            {row.progress.answered} of {row.progress.total} answered
          </span>
        )}
        {row.points != null && <span>{row.points} points</span>}
      </p>

      {row.rubric_summary && (
        <p className="text-[14px] text-stroke">
          <strong>Rubric:</strong> {row.rubric_summary}
        </p>
      )}

      {grade && (
        <p className="rounded-[12px] border-2 border-stroke bg-[var(--world-soft,#ffd93d)] px-3 py-1 text-[16px] font-bold text-stroke">
          Final mark:{" "}
          {grade.points != null && row.points != null
            ? `${grade.points} / ${row.points}`
            : grade.points != null
              ? String(grade.points)
              : "Not released"}
          {grade.pct != null ? ` (${Math.round(grade.pct)}%)` : ""}
          {grade.teacher_name ? ` by ${grade.teacher_name}` : ""}
        </p>
      )}

      <Link
        to={go.to}
        className="mt-1 inline-flex min-h-11 w-fit items-center rounded-full border-2 border-stroke bg-[var(--world-main,#ffb84d)] px-4 font-bold text-stroke shadow-[2px_2px_0px_#000]"
      >
        {go.label}
      </Link>
    </li>
  );
}

function List({ tab, empty }: { tab: AssignmentTab; empty: string }) {
  const [course, setCourse] = useState("all");
  const now = useMemo(() => Date.now(), []);
  const query = useInfiniteQuery({
    queryKey: [ASSIGNMENTS_KEY, tab],
    queryFn: ({ pageParam }) => fetchAssignments(tab, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const all = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const courses = useMemo(
    () =>
      Array.from(new Set(all.map((row) => row.course).filter((name): name is string => !!name))),
    [all],
  );
  const rows = course === "all" ? all : all.filter((row) => row.course === course);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2].map((n) => (
          <Skeleton key={n} shape="rect" className="h-40 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        description="Your assignments could not load. Check your connection and try again."
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {courses.length > 1 && (
        <div className="flex flex-col gap-1 text-[14px] text-stroke">
          <span id={`course-filter-${tab}`}>Course</span>
          <Select
            aria-labelledby={`course-filter-${tab}`}
            value={course}
            onValueChange={setCourse}
            options={[
              { value: "all", label: "All courses" },
              ...courses.map((name) => ({ value: name, label: name })),
            ]}
          />
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState size="sm" title={empty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <Card key={row.id} row={row} now={now} />
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            loading={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AssignmentsListPage() {
  const [tab, setTab] = useState<AssignmentTab>("todo");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <header>
        <h1 className="font-display text-[28px] leading-tight text-stroke">Assignments</h1>
        <p className="text-[14px] text-muted">Everything you need to hand in, soonest first.</p>
      </header>
      <Tabs value={tab} onValueChange={(value) => setTab(value as AssignmentTab)}>
        <TabsList aria-label="Assignment status">
          {TABS.map((entry) => (
            <TabsTrigger key={entry.id} value={entry.id}>
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((entry) => (
          <TabsContent key={entry.id} value={entry.id} className="mt-4">
            {tab === entry.id && <List tab={entry.id} empty={entry.empty} />}
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}

import { useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, ChevronDown, ChevronRight, Lock, PlayCircle } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { useToast } from "@/shared/hooks/useToast";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { Dialog } from "@/shared/components/ui/Dialog";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Select } from "@/shared/components/ui/Select";
import { SegmentedControl } from "@/shared/components/ui/SegmentedControl";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { approveAllAiGrades, fetchClassOptions, fetchQueuePage, fetchQueueTotals } from "./api";
import type { QueueRow } from "./api";
import {
  bulkApprovable,
  filterRows,
  groupByAssignment,
  isPending,
  kindLabel,
  nextToGrade,
  sortRows,
} from "./queue";
import type { AssignmentGroup, DueFilter, KindFilter, SortMode } from "./queue";

/* ========================================
   Grading queue (TEACHER-SPEC TC-20, task TCH-CORE-13)

   One queue for every pending submission across the teacher's classes. Oldest submissions come
   first by default. "Start Grading Next" opens the first pending submission in the current
   order; the grading screen (TC-21) lives at /teacher/grading/:submissionId.
   Filters for kind and due date apply to the loaded pages; the class filter is applied by the
   server. Arrow keys move between rows and Enter opens one.
   ======================================== */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm";
const REFRESH_MS = 30_000;

type ViewMode = "grouped" | "flat";

const KIND_OPTIONS = [
  { value: "all", label: "All kinds" },
  { value: "essay", label: "Essay" },
  { value: "quiz_review", label: "Quiz review" },
  { value: "speaking", label: "Speaking" },
] as const;

const DUE_OPTIONS = [
  { value: "all", label: "Any due date" },
  { value: "overdue", label: "Overdue" },
  { value: "week", label: "Due this week" },
  { value: "later", label: "Due later" },
] as const;

const SORT_OPTIONS = [
  { value: "oldest", label: "Oldest first" },
  { value: "due", label: "Due date" },
] as const;

const gradeHref = (row: QueueRow) => `/teacher/grading/${encodeURIComponent(row.submission_id)}`;

function formatSubmitted(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AiBadge({ row }: { row: QueueRow }) {
  if (row.ai_status === "off") return null;
  const confidence = row.ai_confidence == null ? "" : ` · ${Math.round(row.ai_confidence * 100)}%`;
  const label =
    row.ai_status === "pending"
      ? "AI grading…"
      : row.ai_status === "flagged"
        ? `AI flagged${confidence}`
        : `AI pre-graded${confidence}`;
  return (
    <Chip size="sm" world={row.ai_status === "flagged" ? "amber" : "mint"} icon={<Bot size={13} />}>
      {label}
    </Chip>
  );
}

function QueueRowItem({ row }: { row: QueueRow }) {
  return (
    <li>
      <Link
        to={gradeHref(row)}
        data-queue-row
        className="flex flex-wrap items-center gap-3 rounded-[12px] border-2 border-transparent px-3 py-2.5 hover:border-stroke hover:bg-surface-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-stroke">{row.student.full_name}</span>
          <span className="block truncate text-sm text-muted">{row.assignment_title}</span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <Chip size="sm">{row.class.name}</Chip>
          <Chip size="sm">{kindLabel(row.assessment_kind)}</Chip>
          <AiBadge row={row} />
          {row.locked_by && (
            <Chip size="sm" world="amber" icon={<Lock size={13} />}>
              Being graded by {row.locked_by.name}
            </Chip>
          )}
        </span>
        <time dateTime={row.submitted_at} className="w-32 text-sm text-muted">
          {formatSubmitted(row.submitted_at)}
        </time>
        <span className="rounded-[10px] border-2 border-stroke bg-surface-0 px-3 py-1 text-sm font-extrabold shadow-retro-sm">
          Grade
        </span>
      </Link>
    </li>
  );
}

function Group({
  group,
  onApprove,
}: {
  group: AssignmentGroup;
  onApprove: (group: AssignmentGroup) => void;
}) {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const pending = group.rows.filter(isPending);
  const approvable = bulkApprovable(group.rows).length;
  const next = nextToGrade(group.rows);
  const bodyId = `group-${group.assignmentId}`;

  return (
    <li className="rounded-[16px] border-2 border-stroke bg-surface-0 p-3 shadow-retro-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2 text-start font-heading text-lg font-bold text-stroke focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {open ? (
            <ChevronDown size={18} aria-hidden="true" />
          ) : (
            <ChevronRight size={18} aria-hidden="true" />
          )}
          <span className="truncate">{group.title}</span>
        </button>
        <Chip size="sm">{group.className}</Chip>
        <Chip size="sm">{kindLabel(group.kind)}</Chip>
        {group.gradingMode && <Chip size="sm">{group.gradingMode.replace(/_/g, " ")}</Chip>}
        <span className="text-sm font-semibold text-muted">{pending.length} waiting</span>
        {group.gradingMode === "bulk_approve" && approvable > 0 && (
          <Button size="sm" variant="secondary" onClick={() => onApprove(group)}>
            Approve all AI grades ({approvable})
          </Button>
        )}
        <Button size="sm" disabled={!next} onClick={() => next && navigate(gradeHref(next))}>
          Start grading
        </Button>
      </div>
      {open && (
        <ul id={bodyId} className="mt-2 space-y-1">
          {group.rows.map((row) => (
            <QueueRowItem key={row.submission_id} row={row} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Tile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[16px] border-2 border-stroke bg-surface-0 px-4 py-3 shadow-retro-sm">
      <p className="text-sm font-bold text-muted">{label}</p>
      <p className="font-heading text-3xl font-bold text-stroke">{value}</p>
    </div>
  );
}

export interface GradingQueuePageProps {
  /** Class chosen in the shell's class switcher; undefined means all classes. */
  classId?: string | undefined;
}

export default function GradingQueuePage({ classId: shellClassId }: GradingQueuePageProps) {
  const [classId, setClassId] = useState(shellClassId ?? "all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [due, setDue] = useState<DueFilter>("all");
  const [sort, setSort] = useState<SortMode>("oldest");
  const [view, setView] = useState<ViewMode>("grouped");
  const [approving, setApproving] = useState<AssignmentGroup | null>(null);

  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const serverClass = classId === "all" ? undefined : classId;

  const classes = useQuery({ queryKey: ["grading-queue", "classes"], queryFn: fetchClassOptions });
  const totals = useQuery({
    queryKey: ["grading-queue", "totals", serverClass ?? "all"],
    queryFn: () => fetchQueueTotals(serverClass),
    refetchInterval: REFRESH_MS,
  });
  const queue = useInfiniteQuery({
    queryKey: ["grading-queue", "rows", serverClass ?? "all"],
    queryFn: ({ pageParam }) => fetchQueuePage(serverClass, "flat", pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchInterval: REFRESH_MS,
  });

  const rows = useMemo(() => {
    const all = queue.data?.pages.flatMap((page) => page.items) ?? [];
    return sortRows(filterRows(all.filter(isPending), kind, due, Date.now()), sort);
  }, [queue.data, kind, due, sort]);

  const groups = useMemo(() => groupByAssignment(rows), [rows]);
  const next = nextToGrade(rows);

  const approve = useMutation({
    mutationFn: approveAllAiGrades,
    onSuccess: (result) => {
      toast.show({
        type: "success",
        title: `${result.approved} AI grades approved`,
        ...(result.skipped.length > 0
          ? { description: `${result.skipped.length} skipped for your review.` }
          : {}),
      });
      setApproving(null);
      void queryClient.invalidateQueries({ queryKey: ["grading-queue"] });
    },
    onError: (error: Error) => {
      toast.show({
        type: "error",
        title: "Could not approve AI grades",
        description: error.message,
      });
    },
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-queue-row]"));
    const index = items.findIndex((item) => item === document.activeElement);
    const target =
      items[index + (event.key === "ArrowDown" ? 1 : -1)] ?? (index === -1 ? items[0] : undefined);
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };

  const classOptions = [
    { value: "all", label: "All classes" },
    ...(classes.data ?? []).map((item) => ({ value: item.id, label: item.name })),
  ];
  const approvableForDialog = approving ? bulkApprovable(approving.rows).length : 0;
  const exceptions = approving ? approving.rows.filter((row) => row.ai_status === "flagged") : [];

  return (
    <main data-world="coral" className="mx-auto w-full max-w-[1440px] space-y-6 text-stroke">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold sm:text-4xl">Grading queue</h1>
          <p className="font-medium text-muted">Every submission waiting for you, oldest first.</p>
        </div>
        <Button size="lg" disabled={!next} onClick={() => next && navigate(gradeHref(next))}>
          <PlayCircle size={20} aria-hidden="true" /> Start Grading Next
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
        <Tile label="Waiting" value={totals.data?.waiting ?? "—"} />
        <Tile label="AI-ready to confirm" value={totals.data?.aiReady ?? "—"} />
      </div>

      <section
        aria-label="Filters"
        className={cn(PANEL, "grid gap-3 sm:grid-cols-2 lg:grid-cols-5")}
      >
        <Select
          aria-label="Class"
          value={classId}
          onValueChange={setClassId}
          options={classOptions}
        />
        <Select
          aria-label="Assessment kind"
          value={kind}
          onValueChange={(value) => setKind(value as KindFilter)}
          options={KIND_OPTIONS}
        />
        <Select
          aria-label="Due date"
          value={due}
          onValueChange={(value) => setDue(value as DueFilter)}
          options={DUE_OPTIONS}
        />
        <Select
          aria-label="Sort by"
          value={sort}
          onValueChange={(value) => setSort(value as SortMode)}
          options={SORT_OPTIONS}
        />
        <SegmentedControl
          aria-label="View"
          size="md"
          value={view}
          onValueChange={(value) => setView(value as ViewMode)}
          options={[
            { value: "grouped", label: "By assignment" },
            { value: "flat", label: "Flat list" },
          ]}
        />
      </section>

      <section aria-label="Submissions" className={PANEL}>
        {queue.isPending ? (
          <div role="status" aria-label="Loading" className="space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} label={null} className="h-14 w-full" />
            ))}
          </div>
        ) : queue.isError ? (
          <ErrorState
            size="sm"
            title="The grading queue could not be loaded"
            description="Check your connection and try again."
            onRetry={() => void queue.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            size="sm"
            title="Nothing to grade"
            description="You are all caught up."
            action={
              <p className="flex items-center gap-2 font-semibold text-muted">
                <CheckCircle2 size={18} aria-hidden="true" /> No pending submissions match these
                filters.
              </p>
            }
          />
        ) : (
          <div role="presentation" onKeyDown={onKeyDown}>
            {view === "grouped" ? (
              <ul className="space-y-3">
                {groups.map((group) => (
                  <Group key={group.assignmentId} group={group} onApprove={setApproving} />
                ))}
              </ul>
            ) : (
              <ul className="space-y-1">
                {rows.map((row) => (
                  <QueueRowItem key={row.submission_id} row={row} />
                ))}
              </ul>
            )}
            {queue.hasNextPage && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  loading={queue.isFetchingNextPage}
                  onClick={() => void queue.fetchNextPage()}
                >
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      <Dialog
        open={approving !== null}
        onOpenChange={(open) => !open && setApproving(null)}
        title={`Approve ${approvableForDialog} AI grades?`}
        description={approving ? `${approving.title} · ${approving.className}` : undefined}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={() => setApproving(null)}>
              Cancel
            </Button>
            <Button
              loading={approve.isPending}
              onClick={() => approving && approve.mutate(approving.assignmentId)}
            >
              Approve all
            </Button>
          </div>
        }
      >
        <p>Grades with high AI confidence are approved and released. Flagged ones are skipped.</p>
        {exceptions.length > 0 && (
          <div className="mt-3">
            <p className="font-bold">Skipped for your review ({exceptions.length}):</p>
            <ul className="mt-1 list-inside list-disc text-sm">
              {exceptions.map((row) => (
                <li key={row.submission_id}>{row.student.full_name}</li>
              ))}
            </ul>
          </div>
        )}
      </Dialog>
    </main>
  );
}

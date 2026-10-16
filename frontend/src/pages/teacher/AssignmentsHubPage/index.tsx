import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CalendarClock, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { Dialog } from "@/shared/components/ui/Dialog";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { SearchField } from "@/shared/components/ui/SearchField";
import { Select } from "@/shared/components/ui/Select";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { useToast } from "@/shared/hooks/useToast";
import { cn } from "@/shared/lib/utils/cn";
import {
  closeAssignmentEarly,
  duplicateAssignment,
  fetchAssignmentsPage,
  fetchClassOptions,
} from "./api";
import type { AssignmentRow, AssignmentStatus, StatusFilter } from "./api";
import {
  FILTER_LABELS,
  STATUS_LABELS,
  assignmentLinks,
  availableActions,
  dueLabel,
  isOverdue,
  submissionLabel,
  submissionShare,
} from "./rules";

/* ========================================
   Assignments hub (TEACHER-SPEC TC-13, task TCH-CORE-09)

   Every assignment with its classes, due-date countdown, submission counter (22/28 submitted)
   and an "ungraded" pill. "Grade submissions" opens the grading queue filtered to the
   assignment. Filter by class, status (Draft, Scheduled, Open, Closed, Needs grading) and search.
   ======================================== */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm";
const LINK =
  "inline-flex min-h-10 items-center rounded-[12px] border-2 border-stroke px-3.5 text-sm font-extrabold text-stroke shadow-retro-sm transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

const FILTERS: readonly StatusFilter[] = [
  "all",
  "draft",
  "scheduled",
  "open",
  "closed",
  "needs_grading",
];

const STATUS_WORLD: Record<AssignmentStatus, "sky" | "amber" | "mint" | "coral"> = {
  draft: "sky",
  scheduled: "amber",
  open: "mint",
  closed: "coral",
};

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface CardProps {
  row: AssignmentRow;
  onDuplicate: (row: AssignmentRow) => void;
  onClose: (row: AssignmentRow) => void;
}

function AssignmentCard({ row, onDuplicate, onClose }: CardProps) {
  const links = assignmentLinks(row.id);
  const actions = availableActions(row);
  const overdue = isOverdue(row);
  return (
    <li className="flex flex-col gap-3 rounded-[16px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 font-heading text-lg font-bold text-stroke">{row.title}</h3>
        <Chip size="sm" world={STATUS_WORLD[row.status]}>
          {STATUS_LABELS[row.status]}
        </Chip>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {row.classes.map((item) => (
          <Chip key={item.id} size="sm">
            {item.name}
          </Chip>
        ))}
        {row.unit && <Chip size="sm">{row.unit.title}</Chip>}
      </div>

      <p
        className={cn(
          "flex items-center gap-1.5 text-sm font-semibold",
          overdue ? "text-danger-600" : "text-muted",
        )}
      >
        <CalendarClock size={15} aria-hidden="true" /> {dueLabel(row.due_at)}
      </p>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold">{submissionLabel(row)}</span>
          {row.waiting_to_grade > 0 && (
            <span
              data-testid={`ungraded-${row.id}`}
              className="rounded-full border-2 border-stroke bg-world-amber-300 px-2.5 py-0.5 text-sm font-extrabold"
            >
              {row.waiting_to_grade} ungraded
            </span>
          )}
        </div>
        <ProgressBar
          value={submissionShare(row)}
          label={`${row.title} submissions`}
          valueText={submissionLabel(row)}
        />
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        {actions.grade && (
          <Link to={links.grade} className={cn(LINK, "bg-world-coral-300")}>
            Grade Submissions
          </Link>
        )}
        <Link to={links.edit} className={cn(LINK, "bg-surface-0")}>
          Edit
        </Link>
        {row.status !== "draft" && (
          <Link to={links.results} className={cn(LINK, "bg-surface-0")}>
            View results
          </Link>
        )}
        <Button size="sm" variant="ghost" onClick={() => onDuplicate(row)}>
          Duplicate
        </Button>
        {actions.closeEarly && (
          <Button size="sm" variant="ghost" onClick={() => onClose(row)}>
            Close early
          </Button>
        )}
      </div>
    </li>
  );
}

export interface AssignmentsHubPageProps {
  /** Class chosen in the shell's class switcher; undefined means all classes. */
  classId?: string | undefined;
}

export default function AssignmentsHubPage({ classId: shellClassId }: AssignmentsHubPageProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState(shellClassId ?? "all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [searchText, setSearchText] = useState("");
  const search = useDebounced(searchText.trim(), 250);
  const [closing, setClosing] = useState<AssignmentRow | null>(null);

  useEffect(() => {
    setClassId(shellClassId ?? "all");
  }, [shellClassId]);

  const query = { classId: classId === "all" ? undefined : classId, status, search };

  const classes = useQuery({
    queryKey: ["assignments-hub", "classes"],
    queryFn: fetchClassOptions,
  });
  const assignments = useInfiniteQuery({
    queryKey: ["assignments-hub", "rows", query],
    queryFn: ({ pageParam }) => fetchAssignmentsPage(query, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
  });
  const rows = useMemo(
    () => assignments.data?.pages.flatMap((page) => page.items) ?? [],
    [assignments.data],
  );

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["assignments-hub"] });
  const duplicate = useMutation({
    mutationFn: (row: AssignmentRow) => duplicateAssignment(row.id),
    onSuccess: (_result, row) => {
      toast.show({ type: "success", title: `“${row.title}” was duplicated` });
      refresh();
    },
    onError: (error: Error) =>
      toast.show({
        type: "error",
        title: "The assignment was not duplicated",
        description: error.message,
      }),
  });
  const close = useMutation({
    mutationFn: (row: AssignmentRow) => closeAssignmentEarly(row.id),
    onSuccess: (_result, row) => {
      toast.show({ type: "success", title: `“${row.title}” is closed` });
      setClosing(null);
      refresh();
    },
    onError: (error: Error) =>
      toast.show({
        type: "error",
        title: "The assignment was not closed",
        description: error.message,
      }),
  });

  const classOptions = [
    { value: "all", label: "All classes" },
    ...(classes.data ?? []).map((item) => ({ value: item.id, label: item.name })),
  ];
  const filtered = status !== "all" || search !== "" || classId !== "all";

  return (
    <main data-world="coral" className="mx-auto w-full max-w-[1440px] space-y-6 text-stroke">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold sm:text-4xl">Assignments</h1>
          <p className="font-medium text-muted">
            Homework for your classes and who has handed it in.
          </p>
        </div>
        <Link
          to="/teacher/assignments/new"
          className={cn(LINK, "min-h-11 gap-2 bg-world-coral-300")}
        >
          <Plus size={17} aria-hidden="true" /> New assignment
        </Link>
      </header>

      <section aria-label="Filters" className={cn(PANEL, "space-y-4")}>
        <div className="grid gap-3 md:grid-cols-2">
          <SearchField
            aria-label="Search assignments"
            placeholder="Search assignments"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <Select
            aria-label="Class"
            value={classId}
            onValueChange={setClassId}
            options={classOptions}
          />
        </div>
        <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <Chip key={item} selected={status === item} onClick={() => setStatus(item)}>
              {FILTER_LABELS[item]}
            </Chip>
          ))}
        </div>
      </section>

      <section aria-label="Assignment list" aria-busy={assignments.isFetching}>
        {assignments.isPending ? (
          <div
            role="status"
            aria-label="Loading"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} label={null} className="h-60 w-full" />
            ))}
          </div>
        ) : assignments.isError ? (
          <div className={PANEL}>
            <ErrorState
              size="sm"
              title="Assignments could not be loaded"
              description="Check your connection and try again."
              onRetry={() => void assignments.refetch()}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className={PANEL}>
            <EmptyState
              size="sm"
              title={filtered ? "No assignments match these filters" : "No assignments yet"}
              description="Create an assignment to give your class work."
              action={
                <Link to="/teacher/assignments/new" className={cn(LINK, "bg-world-coral-300")}>
                  New assignment
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <AssignmentCard
                  key={row.id}
                  row={row}
                  onDuplicate={(item) => duplicate.mutate(item)}
                  onClose={setClosing}
                />
              ))}
            </ul>
            {assignments.hasNextPage && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  loading={assignments.isFetchingNextPage}
                  onClick={() => void assignments.fetchNextPage()}
                >
                  Load more assignments
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <Dialog
        open={closing !== null}
        onOpenChange={(open) => !open && setClosing(null)}
        size="sm"
        title="Close this assignment early?"
        description={closing?.title}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setClosing(null)}>
              Cancel
            </Button>
            <Button loading={close.isPending} onClick={() => closing && close.mutate(closing)}>
              Close assignment
            </Button>
          </div>
        }
      >
        <p>
          Students will no longer be able to hand it in. Work already submitted stays in the grading
          queue.
        </p>
      </Dialog>
    </main>
  );
}

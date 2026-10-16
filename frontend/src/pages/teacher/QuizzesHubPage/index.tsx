import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Clock, Plus, Radio, Users } from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { Dialog } from "@/shared/components/ui/Dialog";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { SearchField } from "@/shared/components/ui/SearchField";
import { Select } from "@/shared/components/ui/Select";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { useToast } from "@/shared/hooks/useToast";
import { cn } from "@/shared/lib/utils/cn";
import {
  closeQuizEarly,
  fetchClassOptions,
  fetchLiveCounts,
  fetchQuizzesPage,
  openQuizNow,
} from "./api";
import type { QuizRow, QuizStatus } from "./api";
import {
  STATUS_LABELS,
  availableActions,
  passTone,
  percent,
  questionLabel,
  timeLimitLabel,
  totalLive,
} from "./rules";
import type { StatusFilter } from "./rules";

/* ========================================
   Quizzes hub (TEACHER-SPEC TC-16, task TCH-CORE-11)

   Every quiz with its status, question count, time limit, classes, average score and pass rate.
   A live badge shows how many students are inside an attempt right now (counted from in-progress
   attempts, refreshed on every attempt change and every 15 s). Cards link to the builder
   (TC-17) and the results page (TC-18).
   ======================================== */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm";
const LINK =
  "inline-flex min-h-10 items-center rounded-[12px] border-2 border-stroke px-3.5 text-sm font-extrabold text-stroke shadow-retro-sm transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
const LIVE_REFRESH_MS = 15_000;

const STATUS_CHIPS: ReadonlyArray<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "draft", label: STATUS_LABELS.draft },
  { id: "scheduled", label: STATUS_LABELS.scheduled },
  { id: "open", label: STATUS_LABELS.open },
  { id: "closed", label: STATUS_LABELS.closed },
];

const STATUS_WORLD: Record<QuizStatus, "sky" | "amber" | "mint" | "coral"> = {
  draft: "sky",
  scheduled: "amber",
  open: "mint",
  closed: "coral",
};

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function windowText(row: QuizRow): string | null {
  const opens = formatWhen(row.opens_at);
  const closes = formatWhen(row.closes_at);
  if (opens && closes) return `${opens} → ${closes}`;
  if (opens) return `Opens ${opens}`;
  if (closes) return `Closes ${closes}`;
  return null;
}

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface CardProps {
  row: QuizRow;
  live: number | undefined;
  onOpenEarly: (row: QuizRow) => void;
  onClose: (row: QuizRow) => void;
}

function QuizCard({ row, live, onOpenEarly, onClose }: CardProps) {
  const actions = availableActions(row);
  const when = windowText(row);
  const id = encodeURIComponent(row.id);
  return (
    <li className="flex flex-col gap-3 rounded-[16px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 font-heading text-lg font-bold text-stroke">{row.title}</h3>
        <Chip size="sm" world={STATUS_WORLD[row.status]}>
          {STATUS_LABELS[row.status]}
        </Chip>
      </div>

      {live !== undefined && live > 0 && (
        <p
          data-testid={`live-${row.id}`}
          className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-stroke bg-world-rose-100 px-3 py-1 text-sm font-extrabold"
        >
          <Radio size={15} aria-hidden="true" /> {live} {live === 1 ? "student" : "students"} in
          quiz now
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {row.classes.map((item) => (
          <Chip key={item.id} size="sm">
            {item.name}
          </Chip>
        ))}
        {row.unit && <Chip size="sm">{row.unit.title}</Chip>}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="font-bold text-muted">Questions</dt>
          <dd className="font-semibold">{questionLabel(row.question_count)}</dd>
        </div>
        <div>
          <dt className="font-bold text-muted">Time limit</dt>
          <dd className="flex items-center gap-1 font-semibold">
            <Clock size={14} aria-hidden="true" /> {timeLimitLabel(row.time_limit_min)}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-muted">Attempts taken</dt>
          <dd className="flex items-center gap-1 font-semibold">
            <Users size={14} aria-hidden="true" /> {row.attempts_taken}
            {row.attempts_allowed ? ` (up to ${row.attempts_allowed} each)` : ""}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-muted">Average score</dt>
          <dd className="font-heading text-xl font-bold">{percent(row.avg_score)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        {row.pass_rate != null && (
          <Chip size="sm" world={passTone(row.pass_rate) === "good" ? "mint" : "amber"}>
            {Math.round(row.pass_rate)}% pass rate
          </Chip>
        )}
        {when && <span className="text-xs font-semibold text-muted">{when}</span>}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Link to={`/teacher/quizzes/${id}/edit`} className={cn(LINK, "bg-surface-0")}>
          Edit
        </Link>
        <Link to={`/teacher/quizzes/${id}`} className={cn(LINK, "bg-world-coral-300")}>
          View results
        </Link>
        {actions.openEarly && (
          <Button size="sm" variant="secondary" onClick={() => onOpenEarly(row)}>
            Open early
          </Button>
        )}
        {actions.close && (
          <Button size="sm" variant="outline" onClick={() => onClose(row)}>
            Close
          </Button>
        )}
      </div>
    </li>
  );
}

export default function QuizzesHubPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [searchText, setSearchText] = useState("");
  const search = useDebounced(searchText.trim(), 250);
  const [pending, setPending] = useState<{ row: QuizRow; action: "open" | "close" } | null>(null);

  const query = {
    classId: classId === "all" ? undefined : classId,
    status: status === "all" ? undefined : status,
    search,
  };

  const classes = useQuery({ queryKey: ["quizzes-hub", "classes"], queryFn: fetchClassOptions });
  const quizzes = useInfiniteQuery({
    queryKey: ["quizzes-hub", "rows", query],
    queryFn: ({ pageParam }) => fetchQuizzesPage(query, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
  });
  const live = useQuery({
    queryKey: ["quizzes-hub", "live"],
    queryFn: fetchLiveCounts,
    refetchInterval: LIVE_REFRESH_MS,
  });

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["quizzes-hub", "live"] });
    const channel = supabase
      .channel("quizzes-hub-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assessment_attempts" },
        refresh,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const rows = useMemo(
    () => quizzes.data?.pages.flatMap((page) => page.items) ?? [],
    [quizzes.data],
  );
  const liveNow = live.data ? totalLive(rows, live.data) : null;

  const change = useMutation({
    mutationFn: ({ row, action }: { row: QuizRow; action: "open" | "close" }) =>
      action === "open" ? openQuizNow(row.id) : closeQuizEarly(row.id),
    onSuccess: (_result, { row, action }) => {
      toast.show({
        type: "success",
        title: action === "open" ? `“${row.title}” is open` : `“${row.title}” is closed`,
      });
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["quizzes-hub"] });
    },
    onError: (error: Error) => {
      toast.show({ type: "error", title: "The quiz was not changed", description: error.message });
    },
  });

  const classOptions = [
    { value: "all", label: "All classes" },
    ...(classes.data ?? []).map((item) => ({ value: item.id, label: item.name })),
  ];

  return (
    <main data-world="coral" className="mx-auto w-full max-w-[1440px] space-y-6 text-stroke">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold sm:text-4xl">Quizzes</h1>
          <p className="font-medium text-muted">Timed, auto-graded quizzes for your classes.</p>
        </div>
        <Link to="/teacher/quizzes/new" className={cn(LINK, "min-h-11 gap-2 bg-world-coral-300")}>
          <Plus size={17} aria-hidden="true" /> New quiz
        </Link>
      </header>

      {liveNow !== null && liveNow > 0 && (
        <p
          role="status"
          data-testid="live-summary"
          className="flex w-fit items-center gap-2 rounded-[16px] border-2 border-stroke bg-world-rose-100 px-4 py-2 font-extrabold shadow-retro-sm"
        >
          <Radio size={18} aria-hidden="true" /> {liveNow}{" "}
          {liveNow === 1 ? "student is" : "students are"} taking a quiz right now
        </p>
      )}
      {live.isError && (
        <p role="status" className="text-sm font-semibold text-muted">
          Live attempt counts are unavailable right now.
        </p>
      )}

      <section aria-label="Filters" className={cn(PANEL, "space-y-4")}>
        <div className="grid gap-3 md:grid-cols-2">
          <SearchField
            aria-label="Search quizzes"
            placeholder="Search quizzes"
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
          {STATUS_CHIPS.map((chip) => (
            <Chip key={chip.id} selected={status === chip.id} onClick={() => setStatus(chip.id)}>
              {chip.label}
            </Chip>
          ))}
        </div>
      </section>

      <section aria-label="Quiz list" aria-busy={quizzes.isFetching}>
        {quizzes.isPending ? (
          <div
            role="status"
            aria-label="Loading"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} label={null} className="h-64 w-full" />
            ))}
          </div>
        ) : quizzes.isError ? (
          <div className={PANEL}>
            <ErrorState
              size="sm"
              title="Quizzes could not be loaded"
              description="Check your connection and try again."
              onRetry={() => void quizzes.refetch()}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className={PANEL}>
            <EmptyState
              size="sm"
              title={
                status === "all" && !search && classId === "all"
                  ? "No quizzes yet"
                  : "No quizzes match these filters"
              }
              description="Create a quiz to test your class."
              action={
                <Link to="/teacher/quizzes/new" className={cn(LINK, "bg-world-coral-300")}>
                  New quiz
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <QuizCard
                  key={row.id}
                  row={row}
                  live={live.data?.[row.id]}
                  onOpenEarly={(item) => setPending({ row: item, action: "open" })}
                  onClose={(item) => setPending({ row: item, action: "close" })}
                />
              ))}
            </ul>
            {quizzes.hasNextPage && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  loading={quizzes.isFetchingNextPage}
                  onClick={() => void quizzes.fetchNextPage()}
                >
                  Load more quizzes
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        size="sm"
        title={pending?.action === "open" ? "Open this quiz now?" : "Close this quiz?"}
        description={pending?.row.title}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button loading={change.isPending} onClick={() => pending && change.mutate(pending)}>
              {pending?.action === "open" ? "Open quiz" : "Close quiz"}
            </Button>
          </div>
        }
      >
        <p>
          {pending?.action === "open"
            ? "Students in the assigned classes can start it immediately."
            : "No new attempts can start. Students already taking the quiz are counted live on this page."}
        </p>
      </Dialog>
    </main>
  );
}

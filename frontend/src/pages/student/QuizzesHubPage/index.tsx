import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Clock, Lock } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Select } from "@/shared/components/ui/Select";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/Tabs";
import { cn } from "@/shared/lib/utils/cn";
import { QUIZZES_KEY, fetchQuizzes, type QuizRow, type QuizSource } from "./api";

/* Quizzes hub (STUDENT-SPEC ST-07, task STU-CORE-08).
   Three tabs: Available now, Upcoming (locked or not open yet) and Completed (past attempts with
   the earned percentage). Search by title and filter by status. A quiz closing within 24 hours is
   marked as urgent and listed first. Available and Upcoming share one list from `my_quizzes`;
   Completed reads the history list. */

type Tab = "now" | "upcoming" | "completed";

const TABS: ReadonlyArray<{ id: Tab; label: string; source: QuizSource; empty: string }> = [
  {
    id: "now",
    label: "Available now",
    source: "available",
    empty: "No quizzes are open right now.",
  },
  { id: "upcoming", label: "Upcoming", source: "available", empty: "No upcoming quizzes." },
  { id: "completed", label: "Completed", source: "history", empty: "No quizzes taken yet." },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const isClosed = (row: QuizRow) => row.status === "closed";
const isUpcoming = (row: QuizRow) =>
  row.status === "locked" || row.status === "upcoming" || row.lock?.locked === true;

const STATUS_LABEL: Record<string, string> = {
  ready: "Ready",
  locked: "Locked",
  upcoming: "Upcoming",
  closed: "Closed",
  passed: "Passed",
  failed: "Failed",
};

/** The status a row is filtered and labelled by in its tab. */
function rowStatus(row: QuizRow, tab: Tab): string {
  if (tab === "completed") return row.passed == null ? "done" : row.passed ? "passed" : "failed";
  if (row.lock?.locked === true) return "locked";
  return row.status ?? "ready";
}
const labelFor = (status: string) => STATUS_LABEL[status] ?? (status === "done" ? "Done" : status);

const closingTime = (row: QuizRow) => row.closes_at ?? row.due_at;

const urgent = (row: QuizRow, now: number): boolean => {
  const closesAt = closingTime(row);
  return (
    !!closesAt &&
    !isUpcoming(row) &&
    Date.parse(closesAt) - now <= DAY_MS &&
    Date.parse(closesAt) > now
  );
};

function whenText(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time)
    ? null
    : new Date(time).toLocaleString("en", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function Card({ row, tab, now }: { row: QuizRow; tab: Tab; now: number }) {
  const hot = tab === "now" && urgent(row, now);
  const quizId = encodeURIComponent(row.id);
  const attempts =
    row.attempts_used == null
      ? null
      : `${row.attempts_used} of ${row.attempts_allowed ?? "unlimited"} attempts`;
  const score = tab === "completed" ? row.score_pct : row.best_score_pct;
  const opens = whenText(row.lock?.opens_at ?? row.opens_at);
  const closes = whenText(closingTime(row));

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-[20px] border-2 bg-surface-0 p-4 shadow-[2px_2px_0px_#000]",
        hot ? "border-danger-600" : "border-stroke",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display min-w-0 text-[18px] leading-tight text-stroke [overflow-wrap:anywhere]">
          {row.title}
        </h3>
        <span className="shrink-0 rounded-full border-2 border-stroke px-2 text-[12px] font-bold text-stroke">
          {labelFor(rowStatus(row, tab))}
        </span>
      </div>

      <p className="text-[14px] text-muted">
        {[row.class_name, row.course, row.unit].filter(Boolean).join(" | ")}
      </p>

      <p className="flex flex-wrap gap-x-4 text-[14px] text-stroke">
        {row.question_count != null && <span>{row.question_count} questions</span>}
        {row.time_limit_min != null && <span>{row.time_limit_min} min</span>}
        {attempts && tab !== "completed" && <span>{attempts}</span>}
        {tab === "completed" && row.attempt_no != null && <span>Attempt {row.attempt_no}</span>}
        {tab === "completed" && whenText(row.submitted_at) && (
          <span>{whenText(row.submitted_at)}</span>
        )}
      </p>

      {hot && (
        <p className="flex w-fit items-center gap-1 rounded-full border-2 border-danger-600 bg-danger-100 px-2 text-[13px] font-bold text-danger-600">
          <Clock size={14} aria-hidden="true" className="motion-safe:animate-pulse" />
          Closing soon{closes ? `: ${closes}` : ""}
        </p>
      )}
      {!hot && tab === "now" && closes && <p className="text-[13px] text-muted">Closes {closes}</p>}

      {tab === "upcoming" && (
        <p className="flex items-center gap-1 text-[14px] font-bold text-stroke">
          <Lock size={14} aria-hidden="true" />
          {row.lock?.reason ?? (opens ? `Opens ${opens}` : "Not open yet")}
          {row.lock?.reason && opens ? ` (opens ${opens})` : ""}
        </p>
      )}

      {score != null && (
        <div>
          <p className="text-[16px] font-bold text-stroke">
            {tab === "completed" ? "Score" : "Best score"}: {Math.round(score)}%
          </p>
          <div className="h-3 w-full rounded-full border-2 border-stroke" aria-hidden="true">
            <div
              className="h-full rounded-full bg-[var(--world-main,#ffb84d)]"
              style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
            />
          </div>
        </div>
      )}

      {tab === "now" && (
        <Link
          to={`/student/quizzes/${quizId}`}
          className="mt-1 inline-flex min-h-11 w-fit items-center rounded-full border-2 border-stroke bg-[var(--world-main,#ffb84d)] px-4 font-bold text-stroke shadow-[2px_2px_0px_#000]"
        >
          {row.attempts_used ? "Try again" : "Start quiz"}
        </Link>
      )}
      {tab === "completed" && row.attempt_id && (
        <Link
          to={`/student/quizzes/${quizId}/result/${encodeURIComponent(row.attempt_id)}`}
          className="mt-1 inline-flex min-h-11 w-fit items-center rounded-full border-2 border-stroke px-4 font-bold text-stroke shadow-[2px_2px_0px_#000]"
        >
          View result
        </Link>
      )}
    </li>
  );
}

function List({ tab, source, empty }: { tab: Tab; source: QuizSource; empty: string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const now = useMemo(() => Date.now(), []);
  const query = useInfiniteQuery({
    queryKey: [QUIZZES_KEY, source],
    queryFn: ({ pageParam }) => fetchQuizzes(source, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const inTab = useMemo(() => {
    const all = query.data?.pages.flatMap((page) => page.items) ?? [];
    if (tab === "completed") return all;
    const open = all.filter((row) => !isClosed(row));
    const rows =
      tab === "upcoming" ? open.filter(isUpcoming) : open.filter((row) => !isUpcoming(row));
    // Quizzes closing soonest come first, so the urgent ones lead the list.
    return [...rows].sort((a, b) => {
      const aCloses = closingTime(a);
      const bCloses = closingTime(b);
      const aTime = aCloses ? Date.parse(aCloses) : Number.POSITIVE_INFINITY;
      const bTime = bCloses ? Date.parse(bCloses) : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });
  }, [query.data, tab]);

  const statuses = useMemo(
    () => Array.from(new Set(inTab.map((row) => rowStatus(row, tab)))),
    [inTab, tab],
  );
  const needle = search.trim().toLowerCase();
  const rows = inTab.filter(
    (row) =>
      (status === "all" || rowStatus(row, tab) === status) &&
      (needle === "" || row.title.toLowerCase().includes(needle)),
  );

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
        description="Your quizzes could not load. Check your connection and try again."
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[14px] text-stroke">
          Search by title
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Quiz title"
            className="min-h-11 rounded-[12px] border-2 border-stroke bg-surface-0 px-3"
          />
        </label>
        {statuses.length > 1 && (
          <div className="flex flex-col gap-1 text-[14px] text-stroke">
            <span id={`status-filter-${tab}`}>Status</span>
            <Select
              aria-labelledby={`status-filter-${tab}`}
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "all", label: "All" },
                ...statuses.map((value) => ({ value, label: labelFor(value) })),
              ]}
            />
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState size="sm" title={needle || status !== "all" ? "No quizzes match." : empty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <Card key={`${row.id}-${row.attempt_id ?? ""}`} row={row} tab={tab} now={now} />
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

export default function QuizzesHubPage() {
  const [tab, setTab] = useState<Tab>("now");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <header>
        <h1 className="font-display text-[28px] leading-tight text-stroke">Quizzes</h1>
        <p className="text-[14px] text-muted">Take a quiz or look back at your results.</p>
      </header>
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList aria-label="Quiz status">
          {TABS.map((entry) => (
            <TabsTrigger key={entry.id} value={entry.id}>
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((entry) => (
          <TabsContent key={entry.id} value={entry.id} className="mt-4">
            {tab === entry.id && <List tab={entry.id} source={entry.source} empty={entry.empty} />}
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/shared/components/ui/Button";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { SearchField } from "@/shared/components/ui/SearchField";
import { Select } from "@/shared/components/ui/Select";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/Tabs";
import { HistoryRow } from "./HistoryRow";
import { QuizCard } from "./QuizCard";
import { useAvailableQuizzes, useQuizHistory } from "./hooks";
import {
  courseOptions,
  filterAvailable,
  filterHistory,
  splitQuizzes,
  type HistoryStatus,
} from "./rules";

/* Quizzes hub (STUDENT-SPEC ST-07, STU-CORE-08).
   Three tabs: Available now, Upcoming, Completed. Search by title and filter by course on every
   tab, and by result on Completed. Quizzes closing within 24 hours are highlighted, and past
   quizzes show the grade the student earned. */

type HubTab = "available" | "upcoming" | "completed";

const ALL_COURSES = "__all__";

const STATUS_OPTIONS: ReadonlyArray<{ value: HistoryStatus; label: string }> = [
  { value: "all", label: "All results" },
  { value: "passed", label: "Passed" },
  { value: "not_passed", label: "Not passed" },
  { value: "pending", label: "Awaiting score" },
];

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton shape="rect" className="h-28 w-full" label="Loading quizzes…" />
      <Skeleton shape="rect" className="h-28 w-full" label={null} />
      <Skeleton shape="rect" className="h-28 w-full" label={null} />
    </div>
  );
}

function countLabel(text: string, count: number | undefined): string {
  return count === undefined ? text : `${text} (${count})`;
}

function LoadMore({
  visible,
  loading,
  onLoad,
}: {
  visible: boolean;
  loading: boolean;
  onLoad: () => void;
}) {
  if (!visible) return null;
  return (
    <div className="flex justify-center pt-2">
      <Button variant="secondary" onClick={onLoad} disabled={loading}>
        {loading ? "Loading…" : "Load more"}
      </Button>
    </div>
  );
}

export default function QuizzesHubPage() {
  const [tab, setTab] = useState<HubTab>("available");
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState<string | null>(null);
  const [status, setStatus] = useState<HistoryStatus>("all");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const available = useAvailableQuizzes();
  const history = useQuizHistory();

  const availableItems = useMemo(
    () => available.data?.pages.flatMap((page) => page.items) ?? [],
    [available.data],
  );
  const historyItems = useMemo(
    () => history.data?.pages.flatMap((page) => page.items) ?? [],
    [history.data],
  );

  const filters = useMemo(() => ({ search, course }), [search, course]);
  const tabs = useMemo(
    () => splitQuizzes(filterAvailable(availableItems, filters), now),
    [availableItems, filters, now],
  );
  const completed = useMemo(
    () => filterHistory(historyItems, filters, status),
    [historyItems, filters, status],
  );

  const unfiltered = useMemo(() => splitQuizzes(availableItems, now), [availableItems, now]);

  const courses = useMemo(
    () => courseOptions([...availableItems, ...historyItems]),
    [availableItems, historyItems],
  );
  const hasFilter =
    search.trim() !== "" || course !== null || (tab === "completed" && status !== "all");

  function renderAvailableList(
    query: typeof available,
    items: typeof tabs.available,
    emptyTitle: string,
    emptyText: string,
  ): ReactNode {
    if (query.isPending) return <ListSkeleton />;
    if (query.isError) {
      return (
        <ErrorState
          size="sm"
          description="Your quizzes could not load. Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
      );
    }
    return (
      <>
        {items.length === 0 ? (
          <EmptyState
            size="sm"
            title={hasFilter ? "No quizzes match" : emptyTitle}
            description={hasFilter ? "Try a different search or course." : emptyText}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} now={now} />
            ))}
          </ul>
        )}
        <LoadMore
          visible={query.hasNextPage}
          loading={query.isFetchingNextPage}
          onLoad={() => void query.fetchNextPage()}
        />
      </>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-[28px] font-bold leading-tight text-stroke md:text-[34px]">
          Quizzes
        </h1>
        <p className="text-[16px] font-medium text-stroke/80">
          Find a quiz to take, see what opens next, and review your results.
        </p>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="md:flex-1">
          <SearchField
            aria-label="Search quizzes by title"
            placeholder="Search by quiz title"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
          />
        </div>
        <div className="md:w-56">
          <Select
            aria-label="Filter by course"
            value={course ?? ALL_COURSES}
            onValueChange={(value) => setCourse(value === ALL_COURSES ? null : value)}
            options={[
              { value: ALL_COURSES, label: "All courses" },
              ...courses.map((title) => ({ value: title, label: title })),
            ]}
          />
        </div>
        {tab === "completed" && (
          <div className="md:w-48">
            <Select
              aria-label="Filter by result"
              value={status}
              onValueChange={(value) => setStatus(value as HistoryStatus)}
              options={STATUS_OPTIONS.map((option) => ({ ...option }))}
            />
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as HubTab)}>
        <TabsList aria-label="Quiz status">
          <TabsTrigger value="available">
            {countLabel("Available now", available.data ? unfiltered.available.length : undefined)}
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            {countLabel("Upcoming", available.data ? unfiltered.upcoming.length : undefined)}
          </TabsTrigger>
          <TabsTrigger value="completed">
            {countLabel("Completed", history.data ? historyItems.length : undefined)}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="mt-4">
          {renderAvailableList(
            available,
            tabs.available,
            "No quizzes to take right now",
            "When your teacher opens a quiz, it will show up here.",
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          {renderAvailableList(
            available,
            tabs.upcoming,
            "Nothing coming up",
            "Quizzes that open later or are still locked will appear here.",
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {history.isPending ? (
            <ListSkeleton />
          ) : history.isError ? (
            <ErrorState
              size="sm"
              description="Your past quizzes could not load. Check your connection and try again."
              onRetry={() => void history.refetch()}
            />
          ) : (
            <>
              {completed.length === 0 ? (
                <EmptyState
                  size="sm"
                  title={hasFilter ? "No quizzes match" : "No quizzes taken yet."}
                  description={
                    hasFilter
                      ? "Try a different search, course or result."
                      : "Once you finish a quiz, your grade will show up here."
                  }
                />
              ) : (
                <ul className="flex flex-col gap-4">
                  {completed.map((attempt) => (
                    <HistoryRow key={attempt.attemptId} attempt={attempt} />
                  ))}
                </ul>
              )}
              <LoadMore
                visible={history.hasNextPage}
                loading={history.isFetchingNextPage}
                onLoad={() => void history.fetchNextPage()}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}

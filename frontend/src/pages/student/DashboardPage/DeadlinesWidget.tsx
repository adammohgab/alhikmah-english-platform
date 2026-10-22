import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, ClipboardList, Clock, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/app/providers/auth-context";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import { supabase } from "@/shared/api/supabase";
import { Card } from "@/shared/components/ui/Card";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { cn } from "@/shared/lib/utils/cn";
import {
  DEADLINE_LIMIT,
  overdueAssignments,
  toDeadlines,
  type Deadline,
  type RawDeadline,
} from "./deadlines";

/* Upcoming deadlines widget (STUDENT-SPEC ST-01, STU-CORE-02).
   Assignments and quizzes the student still has to do, overdue ones first and then by due date.
   Overdue items use the danger color with a warning icon and the word "Overdue" (never color
   alone). Items due within 24 hours carry a pulsing clock tag. A row opens the assessment start
   page directly: the quiz brief (ST-08) or the assignment details (ST-12). */

const HEADING_ID = "deadlines-heading";

/* ---------- my_deadlines ---------- */

const courseName = z.union([
  z.string(),
  z.object({ title: z.string() }).transform((value) => value.title),
]);

const deadlineRow = z.object({
  kind: z.enum(["assignment", "quiz"]),
  id: z.string(),
  title: z.string(),
  course: courseName.nullish(),
  due_at: z.string().nullish(),
  status: z.string().nullish(),
  action: z.string().nullish(),
  overdue: z.boolean().nullish(),
});

interface RpcClient {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
}

/* `my_deadlines({ limit })` returns rows of `{ kind, id, title, course, due_at, status, action,
   overdue }` (API-CONTRACT section 3.1) and an empty list until assessments exist. */
async function fetchMyDeadlines(): Promise<RawDeadline[]> {
  const result = await (supabase as unknown as RpcClient).rpc("my_deadlines", {
    limit: DEADLINE_LIMIT,
  });
  if (result.error) throw new Error(normalizeApiError(result.error).message);
  return z
    .array(deadlineRow)
    .parse(result.data ?? [])
    .map((row) => ({
      kind: row.kind,
      id: row.id,
      title: row.title,
      course: row.course ?? null,
      dueAt: row.due_at ?? null,
      status: row.status ?? null,
      action: row.action ?? null,
      overdue: row.overdue ?? null,
    }));
}

function useMyDeadlines() {
  const userId = useAuth().user?.id ?? null;
  return useQuery({
    queryKey: ["student-dashboard", "deadlines", userId],
    queryFn: fetchMyDeadlines,
    enabled: userId !== null,
    refetchOnWindowFocus: true,
  });
}

/* ---------- Row ---------- */

function DeadlineRow({ item }: { item: Deadline }) {
  const Icon = item.kind === "quiz" ? ListChecks : ClipboardList;
  const kindLabel = item.kind === "quiz" ? "Quiz" : "Assignment";

  return (
    <li>
      <Link
        to={item.path}
        data-overdue={item.overdue ? "true" : undefined}
        data-due-soon={item.dueSoon ? "true" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-[16px] border-2 p-3 transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke",
          item.overdue
            ? "border-danger-600 bg-danger-100"
            : "border-stroke bg-white hover:bg-[var(--world-soft,#ffd93d)]/30",
        )}
      >
        <Icon
          aria-hidden="true"
          size={22}
          strokeWidth={2.5}
          className={cn("shrink-0", item.overdue ? "text-danger-600" : "text-stroke")}
        />

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-heading text-[16px] font-semibold leading-snug [overflow-wrap:anywhere]",
              item.overdue ? "text-danger-600" : "text-stroke",
            )}
          >
            {item.title}
          </p>
          <p className="text-[13px] text-muted [overflow-wrap:anywhere]">
            {[kindLabel, item.course, item.statusLabel]
              .filter((part) => part !== null)
              .join(" · ")}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] font-bold">
            {item.overdue && (
              <AlertTriangle
                aria-hidden="true"
                size={14}
                strokeWidth={2.5}
                className="text-danger-600"
              />
            )}
            {item.dueSoon && (
              <span className="inline-flex items-center gap-1 rounded-full border-2 border-stroke bg-[#FFB020] px-2 py-0.5 text-[12px] text-stroke motion-safe:animate-pulse [[data-effects-tier=low]_&]:animate-none">
                <Clock aria-hidden="true" size={12} strokeWidth={2.5} />
                Due soon
              </span>
            )}
            <span className={item.overdue ? "text-danger-600" : "text-stroke"}>
              {item.dueText}
            </span>
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-stroke bg-[var(--world-main,#ffb84d)] px-3 py-1 text-[13px] font-bold text-stroke">
          {item.actionLabel}
          <ChevronRight aria-hidden="true" size={14} strokeWidth={2.5} />
        </span>
      </Link>
    </li>
  );
}

/* ---------- Widget ---------- */

export function DeadlinesWidget() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const query = useMyDeadlines();
  const items = useMemo(
    () => (query.data === undefined ? [] : toDeadlines(query.data, now)),
    [query.data, now],
  );
  const late = overdueAssignments(items);

  return (
    <Card as="section" aria-labelledby={HEADING_ID}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={HEADING_ID} className="font-heading text-[22px] font-bold text-stroke">
          Upcoming deadlines
        </h2>
        <Link
          to="/student/assignments"
          className="text-[14px] font-bold text-stroke underline underline-offset-2"
        >
          All assignments
        </Link>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {query.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton shape="rect" className="h-16 w-full" label="Loading deadlines…" />
            <Skeleton shape="rect" className="h-16 w-full" label={null} />
          </div>
        ) : query.isError ? (
          <ErrorState
            size="sm"
            description="Your deadlines could not load. Check your connection and try again."
            onRetry={() => void query.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            size="sm"
            title="Nothing due. Nice."
            description="New work will show up here."
          />
        ) : (
          <>
            {late > 0 && (
              <p className="flex items-center gap-2 text-[14px] font-bold text-danger-600">
                <AlertTriangle aria-hidden="true" size={16} strokeWidth={2.5} />
                {late === 1
                  ? "1 assignment is overdue and not submitted."
                  : `${late} assignments are overdue and not submitted.`}
              </p>
            )}
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <DeadlineRow key={item.key} item={item} />
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

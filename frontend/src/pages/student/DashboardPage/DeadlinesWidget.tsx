import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, ArrowRight, Clock } from "lucide-react";
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
import { SCHOOL_TIME_ZONE } from "./rules";

/* ========================================
   Upcoming deadlines (STUDENT-SPEC ST-01 section 4, STU-CORE-02)

   Up to 5 open assignments and quizzes, soonest first, from the `my_deadlines` RPC.
     overdue            danger color (danger-600) and listed first, because the due date is earliest
     due within 24 h    a pulsing clock tag with the time left
     click              opens the assessment start page (quiz: ST-08, assignment: ST-12)
   The list ticks every minute so "Due in 2h" and the 24 hour highlight stay true without a
   reload. The data hook lives here because this file owns the widget end to end.

   Note on color: the ticket says "coral-600", but in this design system `world-coral-600` is
   the lime accent. Overdue means danger, so the semantic `danger-600` is used (the spec says
   "danger color").
   ======================================== */

const DEADLINE_LIMIT = 5;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const HEADING_ID = "deadlines-heading";

const deadlineRow = z.object({
  kind: z.enum(["assignment", "quiz"]),
  id: z.string(),
  title: z.string(),
  course: z.string().nullish(),
  due_at: z.string(),
  status: z.string().nullish(),
  action: z.string().nullish(),
  overdue: z.boolean().nullish(),
});

export interface Deadline {
  kind: "assignment" | "quiz";
  id: string;
  title: string;
  course: string | null;
  dueAt: number;
  inProgress: boolean;
  /** The server's flag. The widget also compares `dueAt` with the clock, so it stays current. */
  overdue: boolean;
}

interface RpcClient {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
}

async function fetchDeadlines(): Promise<Deadline[]> {
  const result = await (supabase as unknown as RpcClient).rpc("my_deadlines", {
    limit: DEADLINE_LIMIT,
  });
  if (result.error) throw new Error(normalizeApiError(result.error).message);

  const rows = z.array(deadlineRow).parse(result.data ?? []);
  return rows
    .map((row) => ({
      kind: row.kind,
      id: row.id,
      title: row.title,
      course: row.course ?? null,
      dueAt: Date.parse(row.due_at),
      inProgress: row.status === "in_progress" || row.action === "continue",
      overdue: row.overdue === true,
    }))
    .filter((row) => Number.isFinite(row.dueAt))
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, DEADLINE_LIMIT);
}

function useMyDeadlines() {
  const userId = useAuth().user?.id ?? null;
  return useQuery({
    queryKey: ["student-dashboard", "deadlines", userId],
    queryFn: fetchDeadlines,
    enabled: userId !== null,
    refetchOnWindowFocus: true,
  });
}

/** The current time, refreshed every minute. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/* ---------- Rules ---------- */

type Urgency = "overdue" | "soon" | "later";

function urgencyOf(deadline: Deadline, now: number): Urgency {
  if (deadline.overdue || deadline.dueAt <= now) return "overdue";
  return deadline.dueAt - now <= DAY_MS ? "soon" : "later";
}

function span(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE_MS));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
  }
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** Calendar day (YYYY-MM-DD) in the school's time zone, so "tomorrow" matches the school day. */
function schoolDay(ms: number): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: SCHOOL_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(ms);
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

function dayDifference(from: number, to: number): number {
  return Math.round((Date.parse(schoolDay(to)) - Date.parse(schoolDay(from))) / DAY_MS);
}

function dateLabel(ms: number): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: SCHOOL_TIME_ZONE,
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(ms);
  } catch {
    return new Date(ms).toDateString();
  }
}

function relativeDue(deadline: Deadline, now: number, urgency: Urgency): string {
  if (urgency === "overdue") return `Overdue by ${span(Math.max(0, now - deadline.dueAt))}`;
  if (urgency === "soon") return `Due in ${span(deadline.dueAt - now)}`;
  const days = dayDifference(now, deadline.dueAt);
  return days <= 1 ? "Due tomorrow" : `Due ${dateLabel(deadline.dueAt)}`;
}

/** The assessment start page: quiz start (ST-08) or assignment details (ST-12). */
function startPath(deadline: Pick<Deadline, "kind" | "id">): string {
  const id = encodeURIComponent(deadline.id);
  return deadline.kind === "quiz" ? `/student/quizzes/${id}` : `/student/assignments/${id}`;
}

/* ---------- View ---------- */

const KIND_LABEL = { assignment: "Assignment", quiz: "Quiz" } as const;

function DueTag({ urgency, text }: { urgency: Urgency; text: string }) {
  if (urgency === "soon") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-stroke bg-warning-100 px-2 py-0.5 text-[12px] font-bold text-warning-600">
        <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning-600 opacity-40 motion-reduce:animate-none" />
          <Clock className="relative" size={14} strokeWidth={2.5} />
        </span>
        {text}
      </span>
    );
  }
  if (urgency === "overdue") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-danger-600 bg-danger-100 px-2 py-0.5 text-[12px] font-bold text-danger-600">
        <AlarmClock aria-hidden="true" size={14} strokeWidth={2.5} />
        {text}
      </span>
    );
  }
  return <span className="text-[14px] font-bold text-muted">{text}</span>;
}

function DeadlineRow({ deadline, now }: { deadline: Deadline; now: number }) {
  const urgency = urgencyOf(deadline, now);
  const overdue = urgency === "overdue";
  return (
    <li>
      <Link
        to={startPath(deadline)}
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[16px] border-2 bg-surface-0 p-3 transition-transform hover:-translate-y-0.5",
          overdue ? "border-danger-600 bg-danger-100" : "border-stroke",
        )}
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span
            className={cn(
              "font-heading text-[16px] font-bold leading-tight [overflow-wrap:anywhere]",
              overdue ? "text-danger-600" : "text-stroke",
            )}
          >
            {deadline.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-muted">
            <span>{KIND_LABEL[deadline.kind]}</span>
            {deadline.course !== null && (
              <span className="rounded-full border-2 border-stroke bg-surface-0 px-2 text-[12px] text-stroke">
                {deadline.course}
              </span>
            )}
            <span>{deadline.inProgress ? "In progress" : "Not started"}</span>
          </span>
        </span>
        <span className="flex items-center gap-3">
          <DueTag urgency={urgency} text={relativeDue(deadline, now, urgency)} />
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[14px] font-bold",
              overdue ? "text-danger-600" : "text-stroke",
            )}
          >
            {deadline.inProgress ? "Continue" : "Start"}
            <ArrowRight aria-hidden="true" size={16} strokeWidth={2.5} />
          </span>
        </span>
      </Link>
    </li>
  );
}

export function DeadlinesWidget() {
  const deadlines = useMyDeadlines();
  const now = useNow();

  const loading = deadlines.isPending && !deadlines.isError;
  const items = deadlines.data ?? [];
  const overdueCount = items.filter((item) => urgencyOf(item, now) === "overdue").length;

  return (
    <Card as="section" aria-labelledby={HEADING_ID}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={HEADING_ID} className="font-heading text-[22px] font-bold text-stroke">
          Upcoming deadlines
        </h2>
        <Link
          to="/student/assignments"
          className="inline-flex items-center gap-1 text-[14px] font-bold text-stroke underline-offset-2 hover:underline"
        >
          See all
          <ArrowRight aria-hidden="true" size={14} strokeWidth={2.5} />
        </Link>
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton shape="rect" className="h-16 w-full" label="Loading your deadlines…" />
            <Skeleton shape="rect" className="h-16 w-full" label={null} />
          </div>
        ) : deadlines.isError ? (
          <ErrorState
            size="sm"
            description="Your deadlines could not load. Check your connection and try again."
            onRetry={() => void deadlines.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState size="sm" title="Nothing due" description="You are all caught up." />
        ) : (
          <div className="flex flex-col gap-3">
            {overdueCount > 0 && (
              <p role="status" className="text-[14px] font-bold text-danger-600">
                {overdueCount === 1
                  ? "1 item is overdue. Hand it in as soon as you can."
                  : `${overdueCount} items are overdue. Hand them in as soon as you can.`}
              </p>
            )}
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <DeadlineRow key={`${item.kind}-${item.id}`} deadline={item} now={now} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

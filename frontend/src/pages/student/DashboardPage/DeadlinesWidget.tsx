import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { cn } from "@/shared/lib/utils/cn";

/* Upcoming deadlines widget (STUDENT-SPEC ST-01 section 4, task STU-CORE-02).
   Up to five assignments and quizzes from `my_deadlines`, soonest first, overdue ones on top in
   the danger color with an alert line for work not yet handed in. Items due within 24 hours get
   a pulsing clock tag. Each row opens the assessment's start page. */

const LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const deadline = z.object({
  kind: z.enum(["assignment", "quiz"]),
  id: z.string(),
  title: z.string(),
  course: z
    .union([z.string(), z.object({ title: z.string().nullish() })])
    .nullish()
    .transform((value) => {
      if (typeof value === "string") return value;
      return value?.title ?? null;
    }),
  due_at: z.string(),
  status: z.string().nullish(),
  action: z.string().nullish(),
  overdue: z.boolean().nullish(),
});
export type Deadline = z.infer<typeof deadline>;

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

const DEADLINES_KEY = ["student", "deadlines"] as const;

async function fetchDeadlines(): Promise<Deadline[]> {
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc("my_deadlines", { limit: LIMIT });
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = z.array(deadline).safeParse(data);
  if (!parsed.success) throw new Error("Your deadlines came back in an unexpected shape.");
  return parsed.data;
}

/** Overdue first (oldest first), then upcoming, soonest first. */
function chronological(items: Deadline[]): Deadline[] {
  return [...items].sort((a, b) => {
    const aOver = a.overdue === true ? 0 : 1;
    const bOver = b.overdue === true ? 0 : 1;
    return aOver - bOver || Date.parse(a.due_at) - Date.parse(b.due_at);
  });
}

const startPage = (item: Deadline): string =>
  item.kind === "quiz"
    ? `/student/quizzes/${encodeURIComponent(item.id)}`
    : `/student/assignments/${encodeURIComponent(item.id)}`;

function relative(dueAt: string, now: number): string {
  const ms = Date.parse(dueAt) - now;
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / 3_600_000);
  const days = Math.floor(abs / DAY_MS);
  const span =
    abs < 3_600_000
      ? `${Math.max(1, Math.floor(abs / 60_000))} min`
      : days >= 1
        ? `${days} day${days === 1 ? "" : "s"}`
        : `${hours} h`;
  return ms < 0 ? `Overdue by ${span}` : `Due in ${span}`;
}

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
};
const statusText = (status: string | null | undefined): string | null =>
  status ? (STATUS_LABEL[status] ?? status.replace(/_/g, " ")) : null;

export function DeadlinesWidget({ className }: { className?: string | undefined }) {
  const query = useQuery({ queryKey: DEADLINES_KEY, queryFn: fetchDeadlines });
  const [now, setNow] = useState(() => Date.now());

  // Keeps "due in 3 h" and the 24-hour tag honest while the dashboard stays open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const items = query.data ? chronological(query.data).slice(0, LIMIT) : [];
  const overdue = items.filter((item) => item.overdue === true).length;

  return (
    <section
      aria-labelledby="deadlines-heading"
      className={cn(
        "rounded-[20px] border-2 border-stroke bg-surface-0 p-4 shadow-[2px_2px_0px_#000]",
        className,
      )}
    >
      <h2 id="deadlines-heading" className="font-display mb-2 text-[20px] text-stroke">
        Upcoming deadlines
      </h2>

      {query.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} shape="rect" className="h-14 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState
          size="sm"
          description="Your deadlines could not load. Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState size="sm" title="Nothing due soon. Nice work!" />
      ) : (
        <>
          {overdue > 0 && (
            <p
              role="status"
              className="mb-2 flex items-center gap-2 rounded-[12px] border-2 border-danger-600 bg-danger-100 px-3 py-1 text-[14px] font-bold text-danger-600"
            >
              <AlertTriangle size={16} aria-hidden="true" />
              {overdue} {overdue === 1 ? "item is" : "items are"} overdue and not handed in
            </p>
          )}
          <ul className="flex flex-col">
            {items.map((item) => {
              const late = item.overdue === true;
              const soon = !late && Date.parse(item.due_at) - now <= DAY_MS;
              const status = statusText(item.status);
              return (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    to={startPage(item)}
                    className="flex items-center justify-between gap-3 rounded-[12px] p-2 hover:bg-[var(--world-soft,#ffd93d)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-stroke"
                  >
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block font-bold [overflow-wrap:anywhere]",
                          late ? "text-danger-600" : "text-stroke",
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="block text-[13px] text-muted">
                        {item.kind === "quiz" ? "Quiz" : "Assignment"}
                        {item.course ? ` | ${item.course}` : ""}
                        {status ? ` | ${status}` : ""}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1 rounded-full border-2 px-2 text-[12px] font-bold",
                        late
                          ? "border-danger-600 bg-danger-100 text-danger-600"
                          : soon
                            ? "border-stroke bg-[var(--world-main,#ffb84d)] text-stroke"
                            : "border-stroke text-stroke",
                      )}
                    >
                      {(late || soon) && (
                        <Clock
                          size={14}
                          aria-hidden="true"
                          className={soon ? "motion-safe:animate-pulse" : undefined}
                        />
                      )}
                      {relative(item.due_at, now)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

export default DeadlinesWidget;

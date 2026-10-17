import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Radio, Send } from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import { cn } from "@/shared/lib/utils/cn";
import { useToast } from "@/shared/hooks/useToast";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { Dialog } from "@/shared/components/ui/Dialog";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { extendQuizTime, fetchLiveState, forceSubmitAttempt } from "./api";
import type { LiveStudent } from "./api";
import {
  EXTEND_MINUTES,
  clockOffsetMs,
  connectionStatus,
  countStatuses,
  elapsedSeconds,
  formatClock,
  remainingSeconds,
  sortForGrid,
} from "./rules";
import type { ConnectionStatus } from "./rules";

/* ========================================
   Live quiz monitor (task TCH-CORE-20)

   A grid of every student in the quiz: question number, time spent, time left and connection
   status (green = active, yellow = idle, grey = offline). Changes to the quiz's attempts arrive
   over Realtime and refresh the snapshot; a 10-second poll covers a dropped connection.
   Teacher controls: extend time for the class, force-submit one student's attempt.
   Route: /teacher/quizzes/:quizId/monitor.
   ======================================== */

const POLL_MS = 10_000;
const TICK_MS = 1_000;

const DOT: Record<ConnectionStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success-600" },
  idle: { label: "Idle", className: "bg-warning-600" },
  offline: { label: "Offline", className: "bg-ink-300" },
};

type Realtime = "connecting" | "live" | "lost";

function StudentCard({
  row,
  questionCount,
  nowMs,
  onForce,
}: {
  row: LiveStudent;
  questionCount: number;
  nowMs: number;
  onForce: (row: LiveStudent) => void;
}) {
  const connection = connectionStatus(row.last_seen_at, nowMs);
  const dot = DOT[connection];
  const taking = row.status === "in_progress";
  const left = taking ? remainingSeconds(row.deadline_at, nowMs) : null;

  return (
    <li
      data-status={row.status}
      className="rounded-[16px] border-2 border-stroke bg-surface-0 p-3 shadow-retro-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate font-bold">{row.student.full_name}</h3>
        {taking && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold">
            <span
              aria-hidden="true"
              className={cn("h-3 w-3 rounded-full border-2 border-stroke", dot.className)}
            />
            {dot.label}
          </span>
        )}
      </div>

      {row.status === "not_started" && <p className="mt-2 text-sm text-muted">Not started</p>}
      {row.status === "submitted" && (
        <p className="mt-2 text-sm font-semibold">
          Submitted · {formatClock(elapsedSeconds(row.started_at, row.submitted_at, nowMs))}
        </p>
      )}
      {taking && (
        <>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-muted">Question</dt>
              <dd className="font-extrabold">
                {row.current_question ?? "—"}
                {questionCount > 0 ? ` / ${questionCount}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Elapsed</dt>
              <dd className="font-extrabold">
                {formatClock(elapsedSeconds(row.started_at, null, nowMs))}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Left</dt>
              <dd className="font-extrabold">{formatClock(left)}</dd>
            </div>
          </dl>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => onForce(row)}
            aria-label={`Force submit ${row.student.full_name}`}
          >
            <Send size={14} aria-hidden="true" /> Force submit
          </Button>
        </>
      )}
    </li>
  );
}

export default function QuizMonitorPage() {
  const { quizId = "" } = useParams<{ quizId: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["teacher", "quiz-monitor", quizId], [quizId]);

  const [realtime, setRealtime] = useState<Realtime>("connecting");
  const [tick, setTick] = useState(() => Date.now());
  const [confirmExtend, setConfirmExtend] = useState(false);
  const [forcing, setForcing] = useState<LiveStudent | null>(null);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchLiveState(quizId),
    enabled: quizId !== "",
    refetchInterval: POLL_MS,
  });

  // Realtime: any change to this quiz's attempts refreshes the snapshot straight away.
  useEffect(() => {
    if (quizId === "") return undefined;
    const refresh = () => void queryClient.invalidateQueries({ queryKey });
    const channel = supabase
      .channel(`quiz-monitor:${quizId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assessment_attempts",
          filter: `assessment_id=eq.${quizId}`,
        },
        refresh,
      )
      .subscribe((status) => {
        const state = String(status);
        if (state === "SUBSCRIBED") {
          setRealtime("live");
          refresh();
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          setRealtime("lost");
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [quizId, queryClient, queryKey]);

  // One shared ticker drives every elapsed and countdown clock.
  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const offset = useMemo(
    () => (query.data ? clockOffsetMs(query.data.server_time, query.dataUpdatedAt) : 0),
    [query.data, query.dataUpdatedAt],
  );
  const nowMs = tick + offset;

  const rows = useMemo(
    () =>
      sortForGrid((query.data?.students ?? []).map((s) => ({ ...s, name: s.student.full_name }))),
    [query.data?.students],
  );
  const counts = countStatuses(
    rows.map((r) => ({ status: r.status, lastSeenAt: r.last_seen_at })),
    nowMs,
  );

  const extend = useMutation({
    mutationFn: () => extendQuizTime(quizId, EXTEND_MINUTES),
    onSuccess: async () => {
      setConfirmExtend(false);
      toast.show({ type: "success", title: `Added ${EXTEND_MINUTES} minutes for the class` });
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) =>
      toast.show({
        type: "error",
        title: "Time was not extended",
        description: error instanceof Error ? error.message : "Try again.",
      }),
  });

  const force = useMutation({
    mutationFn: (row: LiveStudent) => {
      if (!row.attempt_id) throw new Error("This student has no attempt in progress.");
      return forceSubmitAttempt(row.attempt_id);
    },
    onSuccess: async (_result, row) => {
      setForcing(null);
      toast.show({ type: "success", title: `${row.student.full_name}'s attempt was submitted` });
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) =>
      toast.show({
        type: "error",
        title: "The attempt was not submitted",
        description: error instanceof Error ? error.message : "Try again.",
      }),
  });

  if (query.isPending) {
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        <Skeleton className="h-12 w-2/3" label="Loading live quiz…" />
        <Skeleton className="h-48 w-full" label={null} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Could not open the live monitor"
        description={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { quiz } = query.data;

  return (
    <div className="space-y-5 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          to="/teacher/quizzes"
          className="inline-flex items-center gap-1 rounded-[10px] border-2 border-stroke bg-surface-0 px-2.5 py-1.5 text-sm font-bold shadow-retro-sm"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Quizzes
        </Link>
        <h1 className="font-display min-w-0 flex-1 truncate text-2xl font-extrabold">
          {quiz.title}
        </h1>
        <Chip size="sm" world={realtime === "live" ? "mint" : "amber"} icon={<Radio size={13} />}>
          <span role="status">
            {realtime === "live" ? "Live" : realtime === "lost" ? "Reconnecting…" : "Connecting…"}
          </span>
        </Chip>
        <Button onClick={() => setConfirmExtend(true)} disabled={counts.inProgress === 0}>
          <Clock size={16} aria-hidden="true" /> Extend time for class (+{EXTEND_MINUTES} min)
        </Button>
      </header>

      <ul className="flex flex-wrap gap-2" aria-label="Status counts">
        <li>
          <Chip>{counts.inProgress} in progress</Chip>
        </li>
        <li>
          <Chip>{counts.submitted} submitted</Chip>
        </li>
        <li>
          <Chip>{counts.notStarted} not started</Chip>
        </li>
        {counts.idleOrOffline > 0 && (
          <li>
            <Chip world="amber">{counts.idleOrOffline} idle or offline</Chip>
          </li>
        )}
      </ul>

      {rows.length === 0 ? (
        <EmptyState title="No students are assigned this quiz" />
      ) : (
        <ul
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          aria-label="Students"
        >
          {rows.map((row) => (
            <StudentCard
              key={row.student.id}
              row={row}
              questionCount={quiz.question_count}
              nowMs={nowMs}
              onForce={setForcing}
            />
          ))}
        </ul>
      )}

      <Dialog
        open={confirmExtend}
        onOpenChange={setConfirmExtend}
        title={`Extend time by ${EXTEND_MINUTES} minutes?`}
        description={`Every student still taking “${quiz.title}” gets ${EXTEND_MINUTES} more minutes.`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmExtend(false)}>
              Cancel
            </Button>
            <Button onClick={() => extend.mutate()} loading={extend.isPending}>
              Add {EXTEND_MINUTES} minutes
            </Button>
          </>
        }
      />

      <Dialog
        open={forcing !== null}
        onOpenChange={(open) => {
          if (!open) setForcing(null);
        }}
        title={`Submit ${forcing?.student.full_name ?? "this student"}'s attempt now?`}
        description="The attempt ends immediately and is scored from the answers saved so far. This cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setForcing(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => forcing && force.mutate(forcing)}
              loading={force.isPending}
            >
              Submit now
            </Button>
          </>
        }
      />
    </div>
  );
}

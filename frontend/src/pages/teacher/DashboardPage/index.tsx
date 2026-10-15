import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Megaphone,
  MessageSquare,
  Rocket,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/app/providers/auth-context";
import { cn } from "@/shared/lib/utils/cn";
import { Avatar } from "@/shared/components/ui/Avatar";
import { Chip } from "@/shared/components/ui/Chip";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import {
  fetchActivityFeed,
  fetchAttentionStudents,
  fetchClassesSummary,
  fetchDeadlines,
  fetchGradingQueue,
  type ClassSummary,
  type FeedFilter,
} from "./api";
import { formatRelative, greetingFor, plural } from "./format";

/* ========================================
   Teacher Dashboard (TEACHER-SPEC TC-01, task TCH-CORE-01)

   Tells the teacher what needs attention today. The page renders inside TeacherAppShell, whose
   class switcher filters every widget: the route owner passes the selection as `classId`.
   Each widget owns its query, so one failing RPC shows its own retry state and never blanks
   the rest of the page. Counts refresh every 30 s and when the window regains focus.
   ======================================== */

const REFRESH_MS = 30_000;

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm";
const LINK_BASE =
  "inline-flex min-h-10 items-center gap-1.5 rounded-[12px] border-2 border-stroke px-3.5 font-body text-sm font-extrabold text-stroke shadow-retro-sm transition-transform duration-[120ms] hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export interface TeacherDashboardPageProps {
  /** Class chosen in the shell's class switcher; undefined means all classes. */
  classId?: string | undefined;
}

interface PanelProps {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

function Panel({ id, title, action, children, className }: PanelProps) {
  return (
    <section aria-labelledby={id} className={cn(PANEL, className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="font-heading text-xl font-bold text-stroke">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} label={null} className="h-14 w-full" />
      ))}
    </div>
  );
}

function PanelError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <ErrorState
      size="sm"
      title={`${what} could not be loaded`}
      description="Check your connection and try again."
      onRetry={onRetry}
    />
  );
}

/* ---------- Grading queue (urgent banner + panel) ---------- */

function GradingSection({ classId }: { classId: string | undefined }) {
  const query = useQuery({
    queryKey: ["teacher-dashboard", "grading", classId ?? "all"],
    queryFn: () => fetchGradingQueue(classId),
    refetchInterval: REFRESH_MS,
  });

  const rows = query.data ?? [];
  const waiting = rows.reduce((sum, row) => sum + row.waiting, 0);
  const aiReady = rows.reduce((sum, row) => sum + row.ai_ready, 0);

  return (
    <>
      {query.data && waiting > 0 && (
        <Link
          to="/teacher/grading"
          data-testid="urgent-grading-banner"
          className="flex flex-wrap items-center gap-3 rounded-[20px] border-2 border-stroke bg-world-amber-300 p-4 shadow-retro-md transition-transform duration-[120ms] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-stroke bg-surface-0">
            <AlertTriangle size={22} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 font-heading text-lg font-bold text-stroke">
            {plural(waiting, "submission")} awaiting grading
            {aiReady > 0 && (
              <span className="block font-body text-sm font-semibold">
                {aiReady} already graded by AI and ready to confirm
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border-2 border-stroke bg-surface-0 px-3 py-1 text-sm font-extrabold">
            Open grading queue <ArrowRight size={16} aria-hidden="true" />
          </span>
        </Link>
      )}

      <Panel
        id="grading-queue-title"
        title="Grading queue"
        action={
          <Link to="/teacher/grading" className={cn(LINK_BASE, "bg-world-coral-300")}>
            Open grading queue
          </Link>
        }
      >
        {query.isPending ? (
          <ListSkeleton rows={3} />
        ) : query.isError ? (
          <PanelError what="The grading queue" onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <p className="flex items-center gap-2 font-semibold text-muted">
            <CheckCircle2 size={18} aria-hidden="true" /> Nothing is waiting. You are all caught up.
          </p>
        ) : (
          <ul className="divide-y-2 divide-stroke/10">
            {rows.map((row) => (
              <li key={row.assignment_id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-stroke">{row.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                    <Chip size="sm">{row.class.name}</Chip>
                    <span>{row.waiting} waiting</span>
                    {row.ai_ready > 0 && <span>· {row.ai_ready} AI-graded</span>}
                    <span>· oldest {formatRelative(row.oldest_at)}</span>
                  </p>
                </div>
                <Link
                  to={`/teacher/grading?assignment=${encodeURIComponent(row.assignment_id)}`}
                  aria-label={`Grade ${row.title}`}
                  className={cn(LINK_BASE, "bg-surface-0")}
                >
                  Grade
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

/* ---------- Students needing attention ---------- */

function AttentionSection({ classId }: { classId: string | undefined }) {
  const query = useQuery({
    queryKey: ["teacher-dashboard", "attention", classId ?? "all"],
    queryFn: () => fetchAttentionStudents(classId),
    refetchInterval: REFRESH_MS * 2,
  });

  return (
    <Panel
      id="attention-title"
      title="Students needing attention"
      action={
        <Link to="/teacher/students?flagged=1" className={cn(LINK_BASE, "bg-surface-0")}>
          See all
        </Link>
      }
    >
      {query.isPending ? (
        <ListSkeleton rows={3} />
      ) : query.isError ? (
        <PanelError what="Students needing attention" onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <p className="font-semibold text-muted">No students are flagged right now.</p>
      ) : (
        <ul className="divide-y-2 divide-stroke/10">
          {query.data.map((row) => (
            <li
              key={`${row.class.id}-${row.student.id}`}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              <Avatar size="sm" name={row.student.full_name} src={row.student.avatar_url ?? null} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-stroke">{row.student.full_name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                  <Chip size="sm">{row.class.name}</Chip>
                  {row.reasons.map((reason) => (
                    <Chip key={reason.code} size="sm" world="amber">
                      {reason.label}
                    </Chip>
                  ))}
                </p>
              </div>
              <span className="text-sm text-muted">
                Active {formatRelative(row.last_active_at)}
              </span>
              <Link
                to={`/teacher/students/${encodeURIComponent(row.student.id)}`}
                aria-label={`View ${row.student.full_name}`}
                className={cn(LINK_BASE, "bg-surface-0")}
              >
                View student
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ---------- Recent activity ---------- */

const FEED_FILTERS: ReadonlyArray<{ id: FeedFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "submissions", label: "Submissions" },
  { id: "quizzes", label: "Quizzes" },
  { id: "students", label: "Students" },
];

function feedIcon(kind: string): LucideIcon {
  if (kind.includes("quiz")) return ClipboardCheck;
  if (kind.includes("submi") || kind.includes("assignment")) return ClipboardList;
  if (kind.includes("join")) return UserPlus;
  if (kind.includes("badge")) return Award;
  if (kind.includes("streak")) return Zap;
  return MessageSquare;
}

function ActivitySection({ classId }: { classId: string | undefined }) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const query = useQuery({
    queryKey: ["teacher-dashboard", "feed", classId ?? "all", filter],
    queryFn: () => fetchActivityFeed(classId, filter),
    refetchInterval: REFRESH_MS,
  });

  return (
    <Panel id="activity-title" title="Recent activity">
      <div role="group" aria-label="Filter activity" className="mb-4 flex flex-wrap gap-2">
        {FEED_FILTERS.map((item) => (
          <Chip key={item.id} selected={filter === item.id} onClick={() => setFilter(item.id)}>
            {item.label}
          </Chip>
        ))}
      </div>
      {query.isPending ? (
        <ListSkeleton rows={4} />
      ) : query.isError ? (
        <PanelError what="Recent activity" onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <p className="font-semibold text-muted">No activity to show yet.</p>
      ) : (
        <ol className="space-y-3">
          {query.data.map((event) => {
            const Icon = feedIcon(event.kind);
            const body = (
              <>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-stroke bg-world-sky-100">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-stroke">{event.text}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                    {event.class && <Chip size="sm">{event.class.name}</Chip>}
                    <time dateTime={event.occurred_at}>{formatRelative(event.occurred_at)}</time>
                  </span>
                </span>
              </>
            );
            return (
              <li key={event.id}>
                {event.link ? (
                  <Link
                    to={event.link}
                    className="flex items-start gap-3 rounded-[12px] hover:bg-surface-100"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

/* ---------- Side column ---------- */

const QUICK_ACTIONS: ReadonlyArray<{ label: string; to: string; icon: LucideIcon; tone: string }> =
  [
    {
      label: "Create Assignment",
      to: "/teacher/assignments/new",
      icon: ClipboardList,
      tone: "bg-world-coral-300",
    },
    { label: "Launch Quiz", to: "/teacher/quizzes/new", icon: Rocket, tone: "bg-world-sky-200" },
    {
      label: "Post Announcement",
      to: "/teacher/announcements/new",
      icon: Megaphone,
      tone: "bg-world-amber-200",
    },
  ];

function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="flex flex-wrap gap-3">
      {QUICK_ACTIONS.map(({ label, to, icon: Icon, tone }) => (
        <Link key={to} to={to} className={cn(LINK_BASE, tone, "min-h-11")}>
          <Icon size={17} aria-hidden="true" /> {label}
        </Link>
      ))}
    </nav>
  );
}

function ClassCard({ summary }: { summary: ClassSummary }) {
  const progress = summary.avg_progress;
  return (
    <li className="rounded-[16px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-heading text-lg font-bold text-stroke">
            {summary.class.name}
          </p>
          {summary.class.grade_level && (
            <p className="text-sm text-muted">Grade {summary.class.grade_level}</p>
          )}
        </div>
        <Link
          to={`/teacher/classes/${encodeURIComponent(summary.class.id)}`}
          aria-label={`Open ${summary.class.name}`}
          className={cn(LINK_BASE, "min-h-9 bg-surface-0 px-3")}
        >
          Open
        </Link>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-xs font-bold text-muted">Students</dt>
          <dd className="flex items-center justify-center gap-1 font-heading text-xl font-bold">
            <Users size={14} aria-hidden="true" />
            {summary.students}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-muted">Active today</dt>
          <dd className="font-heading text-xl font-bold">
            {summary.active_today == null ? "—" : `${Math.round(summary.active_today)}%`}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-muted">Pending work</dt>
          <dd
            className={cn(
              "mx-auto w-fit rounded-full px-2 font-heading text-xl font-bold",
              summary.awaiting_grading > 0 && "border-2 border-stroke bg-world-amber-300",
            )}
          >
            {summary.awaiting_grading}
          </dd>
        </div>
      </dl>
      {progress != null && (
        <ProgressBar
          className="mt-3"
          value={progress}
          label={`${summary.class.name} average progress`}
          valueText={`${Math.round(progress)}% average progress`}
        />
      )}
    </li>
  );
}

function ClassesSection({ query }: { query: ReturnType<typeof useClassesQuery> }) {
  return (
    <Panel
      id="classes-title"
      title="My classes"
      action={
        <Link to="/teacher/classes" className={cn(LINK_BASE, "bg-surface-0")}>
          All classes
        </Link>
      }
    >
      {query.isPending ? (
        <ListSkeleton rows={2} />
      ) : query.isError ? (
        <PanelError what="Your classes" onRetry={() => void query.refetch()} />
      ) : (
        <ul className="space-y-3">
          {query.data.map((summary) => (
            <ClassCard key={summary.class.id} summary={summary} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function DeadlinesSection({ classId }: { classId: string | undefined }) {
  const query = useQuery({
    queryKey: ["teacher-dashboard", "deadlines", classId ?? "all"],
    queryFn: () => fetchDeadlines(classId),
    refetchInterval: REFRESH_MS * 2,
  });

  return (
    <Panel id="deadlines-title" title="Upcoming deadlines">
      {query.isPending ? (
        <ListSkeleton rows={3} />
      ) : query.isError ? (
        <PanelError what="Upcoming deadlines" onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <p className="font-semibold text-muted">No deadlines coming up.</p>
      ) : (
        <ul className="divide-y-2 divide-stroke/10">
          {query.data.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="py-3">
              <Link
                to={
                  item.kind === "quiz"
                    ? `/teacher/quizzes/${encodeURIComponent(item.id)}`
                    : `/teacher/assignments/${encodeURIComponent(item.id)}`
                }
                className="block rounded-[10px] hover:bg-surface-100"
              >
                <span className="flex items-center gap-2 font-bold text-stroke">
                  <CalendarClock size={16} aria-hidden="true" />
                  <span className="truncate">{item.title}</span>
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <Chip size="sm">{item.class.name}</Chip>
                  <span>due {formatRelative(item.due_at)}</span>
                  <span>
                    · {item.submitted} of {item.total} submitted
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function useClassesQuery() {
  return useQuery({
    queryKey: ["teacher-dashboard", "classes"],
    queryFn: fetchClassesSummary,
    refetchInterval: REFRESH_MS,
  });
}

/* ---------- Page ---------- */

export default function DashboardPage({ classId }: TeacherDashboardPageProps) {
  const { user } = useAuth();
  const classes = useClassesQuery();
  const grading = useQuery({
    queryKey: ["teacher-dashboard", "grading", classId ?? "all"],
    queryFn: () => fetchGradingQueue(classId),
    refetchInterval: REFRESH_MS,
  });

  const firstName = user?.fullName.split(" ")[0] ?? "";
  const waiting = grading.data?.reduce((sum, row) => sum + row.waiting, 0);

  const noClasses = classes.isSuccess && classes.data.length === 0;

  return (
    <main data-world="coral" className="mx-auto w-full max-w-[1440px] space-y-6 text-stroke">
      <header className="space-y-1">
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">
          {greetingFor()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="font-medium text-muted" aria-live="polite">
          {waiting === undefined
            ? "Checking what needs your attention today."
            : waiting === 0
              ? "Nothing is waiting for grading."
              : `${plural(waiting, "submission")} ${waiting === 1 ? "is" : "are"} waiting.`}
        </p>
      </header>

      {noClasses ? (
        <div className={PANEL}>
          <EmptyState
            title="Welcome! Let’s set up your first class"
            description="Create a class to add students, or build a course to teach."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Link to="/teacher/classes" className={cn(LINK_BASE, "bg-world-coral-300")}>
                  Create a class
                </Link>
                <Link to="/teacher/courses" className={cn(LINK_BASE, "bg-surface-0")}>
                  Build a course
                </Link>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <QuickActions />
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <GradingSection classId={classId} />
              <AttentionSection classId={classId} />
              <ActivitySection classId={classId} />
            </div>
            <div className="space-y-6 lg:col-span-4">
              <ClassesSection query={classes} />
              <DeadlinesSection classId={classId} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookCheck,
  BriefcaseBusiness,
  Check,
  Database,
  FileClock,
  FileWarning,
  GraduationCap,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { env } from "@/shared/config/env";
import { supabase } from "@/shared/api/supabase";

interface EnrollmentRow {
  student_id: string;
}
type CountValue = number | null;

interface DashboardMetrics {
  enrolledStudents: CountValue;
  activeTeachers: CountValue;
  completedLessonsToday: CountValue;
  moderationReports: CountValue;
  failedJobs: CountValue;
  pendingPasswordResets: CountValue;
  errors: string[];
  refreshedAt: string;
}

const apiBase = `${env.VITE_SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;

async function requestHeaders(range?: string): Promise<Headers> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Could not read the current session: ${error.message}`);

  const headers = new Headers({
    apikey: env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${data.session?.access_token ?? env.VITE_SUPABASE_ANON_KEY}`,
    Prefer: "count=exact",
  });
  if (range) headers.set("Range", range);
  return headers;
}

async function fetchCount(resource: string): Promise<number> {
  const response = await fetch(`${apiBase}/${resource}`, {
    headers: await requestHeaders("0-0"),
  });
  if (!response.ok) {
    throw new Error(`${resource.split("?")[0]} returned ${response.status}: ${await response.text()}`);
  }

  const contentRange = response.headers.get("content-range");
  const total = contentRange?.split("/")[1];
  if (!total || total === "*") {
    throw new Error(`The server did not return a count for ${resource.split("?")[0]}.`);
  }
  return Number(total);
}

async function fetchAllRows<T>(resource: string): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(`${apiBase}/${resource}`, {
      headers: await requestHeaders(`${offset}-${offset + pageSize - 1}`),
    });
    if (!response.ok) {
      throw new Error(`${resource.split("?")[0]} returned ${response.status}: ${await response.text()}`);
    }
    const page = (await response.json()) as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function capture<T>(
  label: string,
  request: Promise<T>,
  errors: string[],
): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    errors.push(`${label}: ${error instanceof Error ? error.message : "Request failed."}`);
    return null;
  }
}

async function loadDashboardMetrics(): Promise<DashboardMetrics> {
  const errors: string[] = [];
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [enrollments, teachers, lessons, moderation, jobs, resets] = await Promise.all([
    capture(
      "Enrolled students",
      fetchAllRows<EnrollmentRow>("class_enrollments?select=student_id&status=eq.active"),
      errors,
    ),
    capture(
      "Active teachers",
      fetchCount("profiles?select=id&role=eq.teacher&status=eq.active"),
      errors,
    ),
    capture(
      "Completed lessons today",
      fetchCount(
        `lesson_progress?select=id&is_completed=eq.true&completed_at=gte.${encodeURIComponent(dayStart.toISOString())}`,
      ),
      errors,
    ),
    capture(
      "Moderation reports",
      fetchCount("moderation_queue?select=id&status=in.(pending,new,in_review)"),
      errors,
    ),
    capture(
      "Failed background jobs",
      fetchCount("jobs?select=id&status=eq.failed"),
      errors,
    ),
    capture(
      "Pending password resets",
      fetchCount("password_reset_requests?select=id&status=in.(pending,new)"),
      errors,
    ),
  ]);

  return {
    enrolledStudents: enrollments
      ? new Set(enrollments.map((row) => row.student_id)).size
      : null,
    activeTeachers: teachers,
    completedLessonsToday: lessons,
    moderationReports: moderation,
    failedJobs: jobs,
    pendingPasswordResets: resets,
    errors,
    refreshedAt: new Date().toISOString(),
  };
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  color,
}: {
  label: string;
  value: CountValue | string;
  detail: string;
  icon: typeof Users;
  color: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm transition-transform hover:-translate-y-1">
      <span
        className={`absolute -right-5 -top-7 h-24 w-24 rotate-12 rounded-[28px] border-2 border-stroke ${color}`}
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-muted">{label}</p>
          <p className="mt-3 font-heading text-4xl font-bold tracking-tight text-stroke">
            {value ?? "—"}
          </p>
          <p className="mt-1 text-sm text-muted">{detail}</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-stroke bg-surface-0 shadow-retro-sm">
          <Icon size={21} aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

function AlertRow({
  title,
  description,
  count,
  href,
  icon: Icon,
  tone,
}: {
  title: string;
  description: string;
  count: CountValue;
  href: string;
  icon: typeof AlertTriangle;
  tone: "warning" | "danger" | "neutral";
}) {
  const toneClass = {
    warning: "bg-world-amber-100",
    danger: "bg-world-rose-100",
    neutral: "bg-world-sky-100",
  }[tone];

  return (
    <div className="flex flex-wrap items-center gap-3 border-b-2 border-stroke/10 py-4 last:border-0">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-stroke ${toneClass}`}>
        <Icon size={19} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-stroke">{title}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <span className="min-w-10 rounded-lg border-2 border-stroke bg-surface-0 px-2 py-1 text-center text-sm font-extrabold">
        {count ?? "—"}
      </span>
      <Link
        to={href}
        aria-label={`Open ${title}`}
        className="inline-flex min-h-10 items-center gap-1 rounded-lg border-2 border-stroke bg-surface-0 px-3 text-sm font-bold shadow-retro-sm transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Open <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const dashboard = useQuery({
    queryKey: ["admin-dashboard-metrics"],
    queryFn: loadDashboardMetrics,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-metrics"] });
    };
    const channel = supabase
      .channel("admin-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "class_enrollments" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "lesson_progress" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "moderation_queue" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, refresh)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const metrics = dashboard.data;
  const issues = [
    metrics?.moderationReports,
    metrics?.failedJobs,
    metrics?.pendingPasswordResets,
  ].reduce<number>((total, count) => total + (count ?? 0), 0);
  const unavailableIssues = [
    metrics?.moderationReports,
    metrics?.failedJobs,
    metrics?.pendingPasswordResets,
  ].some((count) => count === null);
  const databaseAvailable = Boolean(metrics?.errors.length === 0);
  const systemHealth = dashboard.isLoading
    ? "Checking…"
    : databaseAvailable && metrics?.failedJobs === 0
      ? "All Systems Nominal"
      : databaseAvailable
        ? "Needs Attention"
        : "Partially Available";

  return (
    <main data-world="coral" className="min-h-screen bg-world-coral-50 px-4 py-8 text-stroke sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="relative overflow-hidden rounded-[28px] border-2 border-stroke bg-world-coral-200 p-6 shadow-retro-md sm:p-8">
          <div
            className="absolute -right-7 -top-9 h-36 w-36 rotate-12 rounded-[34px] border-2 border-stroke bg-world-amber-300"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-3 right-28 hidden h-10 w-10 rounded-full border-2 border-stroke bg-world-sky-300 sm:block"
            aria-hidden="true"
          />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border-2 border-stroke bg-surface-0 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.12em]">
                <ShieldCheck size={15} aria-hidden="true" /> Admin control room
              </p>
              <h1 className="mt-4 font-heading text-4xl font-bold sm:text-5xl">Dashboard</h1>
              <p className="mt-2 max-w-xl text-base font-medium text-muted">
                {dashboard.isLoading
                  ? "Checking today’s school activity and platform status."
                  : unavailableIssues
                    ? `${issues} recorded issues need attention. Some dashboard data is unavailable.`
                    : issues === 0
                      ? "No open alerts. Your school platform is up to date."
                      : `${issues} items need attention across moderation, jobs, and password resets.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void dashboard.refetch()}
              disabled={dashboard.isFetching}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-stroke bg-surface-0 px-4 font-bold shadow-retro-sm transition-transform hover:-translate-y-0.5 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <RefreshCw
                size={17}
                className={dashboard.isFetching ? "animate-spin" : ""}
                aria-hidden="true"
              />
              Refresh
            </button>
          </div>
        </header>

        {dashboard.isError && (
          <div role="alert" className="rounded-2xl border-2 border-stroke bg-world-rose-100 p-4 shadow-retro-sm">
            <p className="font-bold">Dashboard data could not be loaded.</p>
            <p className="mt-1 text-sm">{dashboard.error.message}</p>
          </div>
        )}

        {!!metrics?.errors.length && (
          <section role="status" className="rounded-2xl border-2 border-stroke bg-world-amber-100 p-4 shadow-retro-sm">
            <p className="font-bold">Some counts are unavailable.</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
              {metrics.errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </section>
        )}

        <section aria-label="School overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Enrolled Students"
            value={metrics?.enrolledStudents ?? null}
            detail="With an active class enrollment"
            icon={GraduationCap}
            color="bg-world-amber-200"
          />
          <MetricCard
            label="Active Teachers"
            value={metrics?.activeTeachers ?? null}
            detail="Active teacher accounts"
            icon={Users}
            color="bg-world-sky-200"
          />
          <MetricCard
            label="Completed Lessons Today"
            value={metrics?.completedLessonsToday ?? null}
            detail="Completions since local midnight"
            icon={BookCheck}
            color="bg-world-mint-200"
          />
          <MetricCard
            label="System Health"
            value={systemHealth}
            detail={
              metrics?.failedJobs && metrics.failedJobs > 0
                ? `${metrics.failedJobs} failed background jobs`
                : "Database and job queue status"
            }
            icon={databaseAvailable && metrics?.failedJobs === 0 ? Check : Activity}
            color={databaseAvailable && metrics?.failedJobs === 0 ? "bg-world-mint-200" : "bg-world-rose-200"}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
          <section
            className="rounded-[24px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm sm:p-6"
            aria-labelledby="alerts-title"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">
                  Action center
                </p>
                <h2 id="alerts-title" className="mt-1 font-heading text-2xl font-bold">
                  Needs attention
                </h2>
              </div>
              <span className="rounded-full border-2 border-stroke bg-world-amber-200 px-3 py-1 text-sm font-extrabold">
                {unavailableIssues ? `${issues}+` : issues} open
              </span>
            </div>
            <div className="mt-3">
              <AlertRow
                title="Unreviewed Moderation Reports"
                description="Reports waiting for admin review"
                count={metrics?.moderationReports ?? null}
                href="/admin/moderation"
                icon={FileWarning}
                tone="warning"
              />
              <AlertRow
                title="Failed Background Jobs"
                description="Imports and platform work that failed"
                count={metrics?.failedJobs ?? null}
                href="/admin/operations/jobs"
                icon={AlertTriangle}
                tone="danger"
              />
              <AlertRow
                title="Pending Password Resets"
                description="Requests needing account support"
                count={metrics?.pendingPasswordResets ?? null}
                href="/admin/users?filter=password-resets"
                icon={FileClock}
                tone="neutral"
              />
            </div>
            {metrics?.moderationReports === 0 && metrics?.failedJobs === 0 && (
              <p className="mt-4 flex items-center gap-2 rounded-xl border-2 border-stroke bg-world-mint-100 p-3 text-sm font-semibold">
                <Check size={18} aria-hidden="true" /> No open moderation reports or failed jobs.
              </p>
            )}
          </section>

          <section
            className="rounded-[24px] border-2 border-stroke bg-world-sky-100 p-5 shadow-retro-sm sm:p-6"
            aria-labelledby="shortcuts-title"
          >
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">
              Go directly to
            </p>
            <h2 id="shortcuts-title" className="mt-1 font-heading text-2xl font-bold">
              Quick management
            </h2>
            <div className="mt-5 space-y-3">
              <Link
                to="/admin/users/import"
                className="flex min-h-[58px] items-center gap-3 rounded-2xl border-2 border-stroke bg-surface-0 px-4 font-bold shadow-retro-sm transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl border-2 border-stroke bg-world-amber-200">
                  <Upload size={18} aria-hidden="true" />
                </span>
                <span className="flex-1">Import Users</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                to="/admin/users/rollover"
                className="flex min-h-[58px] items-center gap-3 rounded-2xl border-2 border-stroke bg-surface-0 px-4 font-bold shadow-retro-sm transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl border-2 border-stroke bg-world-mint-200">
                  <BriefcaseBusiness size={18} aria-hidden="true" />
                </span>
                <span className="flex-1">Year Rollover</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                to="/admin/settings"
                className="flex min-h-[58px] items-center gap-3 rounded-2xl border-2 border-stroke bg-surface-0 px-4 font-bold shadow-retro-sm transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl border-2 border-stroke bg-world-rose-200">
                  <Settings2 size={18} aria-hidden="true" />
                </span>
                <span className="flex-1">Edit Settings</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-muted">
              <Database size={15} aria-hidden="true" />
              {metrics?.refreshedAt
                ? `Updated ${new Date(metrics.refreshedAt).toLocaleTimeString()}`
                : "Connecting to platform data…"}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

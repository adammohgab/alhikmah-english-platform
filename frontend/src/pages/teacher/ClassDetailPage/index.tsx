import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Avatar } from "@/shared/components/ui/Avatar";
import { Chip } from "@/shared/components/ui/Chip";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/Tabs";
import {
  classDetailKey,
  fetchAnnouncements,
  fetchOverview,
  fetchRoster,
  fetchRules,
  fetchWork,
} from "./api";
import type { ClassOverview } from "./api";
import { ClassHeader } from "./ClassHeader";
import { CLASS_TABS, formatDate, isClassTab, percent } from "./rules";

/* ========================================
   Class detail (TEACHER-SPEC TC-03, task TCH-CORE-03)

   `/teacher/classes/:classId`: a header with the join code and quick invite, then five tabs:
   Overview, Roster & Students, Assigned Work, Class Rules and Announcements. The active tab
   lives in the `?tab=` query parameter, so it survives a refresh and can be linked to. Each tab
   loads its own data only when it is opened.
   ======================================== */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm";
const LINK =
  "inline-flex min-h-9 items-center rounded-[10px] border-2 border-stroke bg-surface-0 px-3 text-sm font-extrabold shadow-retro-sm";

function Loaded<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <Skeleton className="h-40 w-full" label="Loading…" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load this tab"
        description={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return <>{children(query.data)}</>;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm">
      <dt className="text-sm font-bold text-muted">{label}</dt>
      <dd className="font-display text-2xl font-extrabold">{value}</dd>
    </div>
  );
}

function OverviewTab({ data, classId }: { data: ClassOverview; classId: string }) {
  const { stats, courses } = data;
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Class metrics">
        <Tile label="Students" value={String(stats.students)} />
        <Tile label="Average score" value={percent(stats.avg_score)} />
        <Tile label="Completion rate" value={percent(stats.completion_rate)} />
        <Tile label="Awaiting grading" value={String(stats.awaiting_grading)} />
      </dl>
      <section className={PANEL} aria-label="Assigned courses">
        <h2 className="mb-2 font-display text-lg font-extrabold">Courses</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-muted">No course is assigned to this class yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {courses.map((course) => (
              <li key={course.id}>
                <Chip>{course.title}</Chip>
              </li>
            ))}
          </ul>
        )}
      </section>
      {stats.awaiting_grading > 0 && (
        <Link to={`/teacher/grading?class=${encodeURIComponent(classId)}`} className={LINK}>
          Grade {stats.awaiting_grading} waiting submission{stats.awaiting_grading === 1 ? "" : "s"}
        </Link>
      )}
    </div>
  );
}

function RosterTab({ classId }: { classId: string }) {
  const query = useQuery({ queryKey: classDetailKey(classId, "roster"), queryFn: () => fetchRoster(classId) });
  return (
    <Loaded query={query}>
      {({ rows }) =>
        rows.length === 0 ? (
          <EmptyState title="No students yet" description="Share the join code to add students." />
        ) : (
          <div className={`${PANEL} overflow-x-auto`}>
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Students in this class</caption>
              <thead>
                <tr className="border-b-2 border-stroke">
                  <th scope="col" className="py-2 pr-3">Student</th>
                  <th scope="col" className="py-2 pr-3">Status</th>
                  <th scope="col" className="py-2 pr-3">Progress</th>
                  <th scope="col" className="py-2 pr-3">Average</th>
                  <th scope="col" className="py-2">Last active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.student.id} className="border-b border-stroke/30">
                    <th scope="row" className="py-2 pr-3 font-bold">
                      <Link
                        to={`/teacher/students/${encodeURIComponent(row.student.id)}`}
                        className="inline-flex items-center gap-2"
                      >
                        <Avatar size="xs" name={row.student.full_name} src={row.student.avatar_url} />
                        {row.student.full_name}
                      </Link>
                    </th>
                    <td className="py-2 pr-3 capitalize">{row.status}</td>
                    <td className="w-40 py-2 pr-3">
                      <ProgressBar
                        value={Math.round((row.progress ?? 0) <= 1 ? (row.progress ?? 0) * 100 : (row.progress ?? 0))}
                        aria-label={`${row.student.full_name} progress`}
                      />
                    </td>
                    <td className="py-2 pr-3">{percent(row.avg_score)}</td>
                    <td className="py-2">{formatDate(row.last_active_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </Loaded>
  );
}

function WorkTab({ classId }: { classId: string }) {
  const query = useQuery({ queryKey: classDetailKey(classId, "work"), queryFn: () => fetchWork(classId) });
  return (
    <Loaded query={query}>
      {({ items }) =>
        items.length === 0 ? (
          <EmptyState title="No work assigned" description="Assignments and quizzes for this class appear here." />
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`} className={`${PANEL} flex flex-wrap items-center gap-3 !p-4`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{item.title}</p>
                  <p className="text-sm text-muted">
                    {item.kind === "quiz" ? "Quiz" : "Assignment"} · due {formatDate(item.due_at)} ·{" "}
                    {item.submitted} of {item.total} submitted · avg {percent(item.avg_score)}
                  </p>
                </div>
                <Chip size="sm">{item.status}</Chip>
                <Link
                  className={LINK}
                  to={
                    item.kind === "assignment"
                      ? `/teacher/assignments/${encodeURIComponent(item.id)}/results`
                      : `/teacher/quizzes/${encodeURIComponent(item.id)}`
                  }
                >
                  Results
                </Link>
              </li>
            ))}
          </ul>
        )
      }
    </Loaded>
  );
}

function RulesTab({ classId }: { classId: string }) {
  const query = useQuery({ queryKey: classDetailKey(classId, "rules"), queryFn: () => fetchRules(classId) });
  return (
    <Loaded query={query}>
      {(rules) =>
        rules === null ? (
          <EmptyState title="No rules set" description="Default rules apply to this class." />
        ) : (
          <dl className={`${PANEL} grid gap-3 sm:grid-cols-2`}>
            {[
              ["Games", rules.games_enabled ? "On" : "Off"],
              ["AI tutor", rules.ai_tutor_enabled ? "On" : "Off"],
              [
                "Late submissions",
                rules.late_submission_allowed ? `Allowed, ${rules.late_penalty_percent}% penalty` : "Not allowed",
              ],
              ["Bonus multiplier", `×${rules.bonus_multiplier}`],
            ].map(([term, value]) => (
              <div key={term}>
                <dt className="text-sm font-bold text-muted">{term}</dt>
                <dd className="font-extrabold">{value}</dd>
              </div>
            ))}
          </dl>
        )
      }
    </Loaded>
  );
}

function AnnouncementsTab({ classId }: { classId: string }) {
  const query = useQuery({
    queryKey: classDetailKey(classId, "announcements"),
    queryFn: () => fetchAnnouncements(classId),
  });
  return (
    <Loaded query={query}>
      {(items) =>
        items.length === 0 ? (
          <EmptyState title="No announcements" description="Announcements sent to this class appear here." />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className={PANEL}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="font-display font-extrabold">{item.title}</h3>
                  <span className="text-sm text-muted">{formatDate(item.publish_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{item.body}</p>
              </li>
            ))}
          </ul>
        )
      }
    </Loaded>
  );
}

export default function ClassDetailPage() {
  const { classId = "" } = useParams<{ classId: string }>();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = isClassTab(requested) ? requested : "overview";

  const overview = useQuery({
    queryKey: classDetailKey(classId, "overview"),
    queryFn: () => fetchOverview(classId),
    enabled: classId !== "",
  });

  if (overview.isPending) {
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        <Skeleton className="h-28 w-full" label="Loading class…" />
        <Skeleton className="h-64 w-full" label={null} />
      </div>
    );
  }
  if (overview.isError) {
    return (
      <ErrorState
        title="Could not open this class"
        description={overview.error instanceof Error ? overview.error.message : undefined}
        onRetry={() => void overview.refetch()}
      />
    );
  }

  const data = overview.data;
  return (
    <div className="flex flex-col gap-4 p-4">
      <ClassHeader data={data} />
      <Tabs
        value={tab}
        onValueChange={(next) =>
          setParams(
            (prev) => {
              const copy = new URLSearchParams(prev);
              if (next === "overview") copy.delete("tab");
              else copy.set("tab", next);
              return copy;
            },
            { replace: true },
          )
        }
      >
        <TabsList aria-label="Class sections" className="max-w-full overflow-x-auto">
          {CLASS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="mt-4">
          <TabsContent value="overview">
            <OverviewTab data={data} classId={classId} />
          </TabsContent>
          <TabsContent value="roster">
            <RosterTab classId={classId} />
          </TabsContent>
          <TabsContent value="work">
            <WorkTab classId={classId} />
          </TabsContent>
          <TabsContent value="rules">
            <RulesTab classId={classId} />
          </TabsContent>
          <TabsContent value="announcements">
            <AnnouncementsTab classId={classId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

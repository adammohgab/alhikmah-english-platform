import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, ClipboardList, Flame, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { Chip } from "@/shared/components/ui/Chip";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import {
  fetchAssignmentResults,
  fetchOverview,
  fetchQuizResults,
  fetchSkills,
} from "./api";
import { NotesPanel } from "./NotesPanel";
import { ScoreTrendChart } from "./ScoreTrendChart";
import { buildTimeline, formatPct, gradeLetter, pillTone, trendDelta, trendPoints } from "./rules";
import type { PillTone } from "./rules";

/* ========================================
   Student progress dossier (TEACHER-SPEC TC-08, task TCH-CORE-08)

   One student in depth: level, overall grade and streak, the score trajectory, every completed
   quiz and assignment on one timeline with score pills, vocabulary and skill mastery, and the
   teacher's private notes. Route: /teacher/students/:studentId.
   ======================================== */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm";

const PILL_TONE: Record<PillTone, string> = {
  good: "bg-success-100",
  ok: "bg-warning-100",
  low: "bg-danger-100",
  none: "bg-surface-100",
};

function ScorePill({ pct }: { pct: number | null }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[3.5rem] justify-center rounded-full border-2 border-stroke px-2.5 py-0.5 text-sm font-extrabold",
        PILL_TONE[pillTone(pct)],
      )}
    >
      {formatPct(pct)}
    </span>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[16px] border-2 border-stroke bg-surface-0 p-3 shadow-retro-sm">
      <dt className="text-sm font-bold text-muted">{label}</dt>
      <dd className="font-display text-2xl font-extrabold">{value}</dd>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export default function StudentProgressPage() {
  const { studentId = "" } = useParams<{ studentId: string }>();
  const enabled = studentId !== "";

  const overview = useQuery({
    queryKey: ["teacher", "student", studentId, "overview"],
    queryFn: () => fetchOverview(studentId),
    enabled,
  });
  const quizzes = useQuery({
    queryKey: ["teacher", "student", studentId, "quizzes"],
    queryFn: () => fetchQuizResults(studentId),
    enabled,
  });
  const assignments = useQuery({
    queryKey: ["teacher", "student", studentId, "assignments"],
    queryFn: () => fetchAssignmentResults(studentId),
    enabled,
  });
  const skills = useQuery({
    queryKey: ["teacher", "student", studentId, "skills"],
    queryFn: () => fetchSkills(studentId),
    enabled,
  });

  const timeline = useMemo(
    () => buildTimeline(quizzes.data ?? [], assignments.data ?? []),
    [quizzes.data, assignments.data],
  );
  const points = useMemo(() => trendPoints(timeline), [timeline]);
  const delta = trendDelta(points);

  if (overview.isPending) {
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        <Skeleton className="h-12 w-2/3" label="Loading student…" />
        <Skeleton className="h-32 w-full" label={null} />
        <Skeleton className="h-56 w-full" label={null} />
      </div>
    );
  }
  if (overview.isError) {
    return (
      <ErrorState
        title="Could not open this student"
        description={overview.error instanceof Error ? overview.error.message : undefined}
        onRetry={() => void overview.refetch()}
      />
    );
  }

  const { student, tiles, attention } = overview.data;
  const average = tiles.average_score;

  return (
    <div className="space-y-5 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          to="/teacher/students"
          className="inline-flex items-center gap-1 rounded-[10px] border-2 border-stroke bg-surface-0 px-2.5 py-1.5 text-sm font-bold shadow-retro-sm"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Students
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-extrabold">{student.full_name}</h1>
          <p className="text-sm text-muted">
            {student.class.name}
            {student.class.grade_level ? ` · Grade ${student.class.grade_level}` : ""}
            {student.last_active_at ? ` · Last active ${formatDate(student.last_active_at)}` : ""}
          </p>
        </div>
        {student.level != null && <Chip>Level {student.level}</Chip>}
        <Chip icon={<Flame size={14} />} world="amber">
          {student.streak ?? 0}-day streak
        </Chip>
      </header>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Overview">
        <Tile
          label="Overall grade"
          value={formatPct(average)}
          hint={average === null ? "No graded work yet" : `Grade ${gradeLetter(average)}`}
        />
        <Tile label="Attendance streak" value={`${student.streak ?? 0} days`} />
        <Tile label="Lessons completed" value={String(tiles.lessons_completed)} />
        <Tile label="Words learned" value={String(tiles.words_learned)} />
      </dl>

      {attention.length > 0 && (
        <ul className={cn(PANEL, "space-y-1 bg-warning-100")} aria-label="Needs attention">
          {attention.map((reason) => (
            <li key={reason.code} className="text-sm font-bold">
              {reason.text}
            </li>
          ))}
        </ul>
      )}

      <section className={PANEL} aria-labelledby="trajectory-title">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="trajectory-title" className="font-display text-lg font-extrabold">
            Score trajectory
          </h2>
          {delta !== null && (
            <Chip
              size="sm"
              icon={delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              world={delta >= 0 ? "mint" : "amber"}
            >
              {delta >= 0 ? "+" : ""}
              {delta} points since first
            </Chip>
          )}
        </div>
        {quizzes.isPending || assignments.isPending ? (
          <Skeleton className="h-48 w-full" label="Loading scores…" />
        ) : points.length === 0 ? (
          <EmptyState size="sm" title="No scored work yet" description="Scores will chart here once the student completes an assessment." />
        ) : (
          <ScoreTrendChart points={points} />
        )}
      </section>

      <section className={PANEL} aria-labelledby="timeline-title">
        <h2 id="timeline-title" className="mb-3 font-display text-lg font-extrabold">
          Assessment history
        </h2>
        {quizzes.isError || assignments.isError ? (
          <ErrorState
            size="sm"
            title="History could not be loaded"
            onRetry={() => {
              void quizzes.refetch();
              void assignments.refetch();
            }}
          />
        ) : timeline.length === 0 ? (
          <EmptyState size="sm" title="Nothing completed yet" />
        ) : (
          <ol className="space-y-2">
            {timeline.map((entry) => (
              <li
                key={entry.key}
                className="flex flex-wrap items-center gap-3 rounded-[12px] border-2 border-stroke px-3 py-2"
              >
                {entry.kind === "quiz" ? (
                  <BookOpen size={18} aria-label="Quiz" />
                ) : (
                  <ClipboardList size={18} aria-label="Assignment" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{entry.title}</span>
                  <span className="block text-sm text-muted">
                    {formatDate(entry.date)}
                    {entry.detail ? ` · ${entry.detail}` : ""}
                  </span>
                </span>
                <ScorePill pct={entry.scorePct} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={PANEL} aria-labelledby="mastery-title">
        <h2 id="mastery-title" className="mb-3 font-display text-lg font-extrabold">
          Vocabulary and skill mastery
        </h2>
        {skills.isPending ? (
          <Skeleton className="h-24 w-full" label="Loading mastery…" />
        ) : skills.isError ? (
          <ErrorState size="sm" title="Mastery could not be loaded" onRetry={() => void skills.refetch()} />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <ul className="space-y-3" aria-label="Skills">
              {skills.data.skills.map((s) => (
                <li key={s.skill}>
                  <div className="mb-1 flex justify-between text-sm font-bold">
                    <span className="capitalize">{s.skill}</span>
                    <span>{Math.round(s.accuracy)}%</span>
                  </div>
                  <ProgressBar value={s.accuracy} label={`${s.skill} accuracy`} />
                </li>
              ))}
            </ul>
            <div>
              <h3 className="mb-2 text-sm font-extrabold">Words most missed</h3>
              {skills.data.mistakes.words.length === 0 ? (
                <p className="text-sm text-muted">No missed words recorded.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {skills.data.mistakes.words.map((w) => (
                    <li key={w.word}>
                      <Chip size="sm">
                        {w.word} × {w.count}
                      </Chip>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <NotesPanel studentId={studentId} />
    </div>
  );
}

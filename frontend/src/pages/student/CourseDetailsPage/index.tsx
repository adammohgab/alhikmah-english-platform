import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  GraduationCap,
  LockKeyhole,
  Play,
  Sparkles,
  Target,
  Trophy,
  UserRound,
} from "lucide-react";
import { StudentAppShell } from "@/shared/components/layout/StudentAppShell";
import type { StudentShellStats } from "@/shared/components/layout/StudentTopBar";
import { Chip } from "@/shared/components/ui/Chip";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { cn } from "@/shared/lib/utils/cn";
import {
  COURSE_DETAILS_KEY,
  courseProgress,
  estimateMinutes,
  fetchCourseDetails,
  isQuizLocked,
  type CourseUnit,
} from "./api";

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 shadow-retro-sm";

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function unitStatus(unit: CourseUnit): "completed" | "in-progress" | "not-started" {
  const total = unit.progress?.total ?? unit.lessons.length;
  const done = unit.progress?.done ?? unit.lessons.filter((lesson) => lesson.done).length;
  if (total > 0 && done >= total) return "completed";
  if (done > 0 || unit.status === "in_progress" || unit.status === "in-progress")
    return "in-progress";
  return "not-started";
}

function UnitRoadmap({
  unit,
  index,
  courseId,
  expanded,
  onToggle,
}: {
  unit: CourseUnit;
  index: number;
  courseId: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const status = unitStatus(unit);
  const done = unit.progress?.done ?? unit.lessons.filter((lesson) => lesson.done).length;
  const total = unit.progress?.total ?? unit.lessons.length;
  const quizLocked = isQuizLocked(unit.quiz);
  return (
    <article
      className={cn(
        PANEL,
        "overflow-hidden",
        status === "in-progress" && "border-world-amber-400 ring-2 ring-world-amber-200",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-4 text-left sm:items-center sm:p-5"
      >
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border-2 border-stroke",
            status === "completed"
              ? "bg-world-mint-300"
              : status === "in-progress"
                ? "bg-world-amber-300"
                : "bg-surface-200",
          )}
        >
          {status === "completed" ? (
            <CheckCircle2 size={22} aria-label="Completed" />
          ) : status === "in-progress" ? (
            <Play size={21} aria-label="In progress" />
          ) : (
            <span className="font-heading text-lg font-bold">{index + 1}</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-lg font-bold text-stroke">{unit.title}</span>
            {status === "in-progress" && <Chip size="sm">Current unit</Chip>}
            {status === "completed" && <Chip size="sm">Completed</Chip>}
          </span>
          {unit.description && (
            <span className="mt-1 block text-sm text-muted">{unit.description}</span>
          )}
          <span className="mt-3 flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <ProgressBar
                value={done}
                max={Math.max(total, 1)}
                label={`${unit.title} lesson progress`}
                valueText={`${done} of ${total} lessons completed`}
              />
            </span>
            <span className="whitespace-nowrap text-xs font-semibold text-muted">
              {done}/{total} lessons
            </span>
          </span>
        </span>
        <ChevronDown
          size={20}
          className={cn("mt-1 shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded && (
        <div className="border-t-2 border-stroke/10 px-4 pb-4 sm:px-5">
          {unit.objectives.length > 0 && (
            <section className="py-4" aria-label="Learning objectives">
              <h3 className="mb-2 flex items-center gap-2 font-heading font-bold">
                <Target size={17} /> Learning objectives
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {unit.objectives.map((objective) => (
                  <li key={objective} className="flex gap-2 text-sm text-muted">
                    <Check size={16} className="mt-0.5 shrink-0 text-world-mint-600" />
                    {objective}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {unit.skills.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-3">
              {unit.skills.map((skill) => (
                <Chip key={skill} size="sm">
                  {skill}
                </Chip>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {unit.lessons.map((lesson, lessonIndex) => (
              <Link
                key={lesson.id}
                to={`/student/lessons/${lesson.id}?courseId=${encodeURIComponent(courseId)}&unitId=${encodeURIComponent(unit.id)}`}
                className="group flex items-center gap-3 rounded-xl border border-stroke/15 p-3 transition-colors hover:bg-surface-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    lesson.done ? "bg-world-mint-200 text-stroke" : "bg-surface-200 text-muted",
                  )}
                >
                  {lesson.done ? <Check size={18} /> : <BookOpen size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-stroke">
                    {lessonIndex + 1}. {lesson.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {durationLabel(lesson.minutes ?? 10)}
                    {lesson.done ? " · Completed" : " · Lesson"}
                  </span>
                </span>
                <ArrowRight
                  size={17}
                  className="shrink-0 text-muted transition-transform group-hover:translate-x-1"
                />
              </Link>
            ))}
            {unit.activities.map((activity) => (
              <Link
                key={activity.id}
                to={`/student/activities/${activity.id}?courseId=${encodeURIComponent(courseId)}`}
                className="flex items-center gap-3 rounded-xl border border-dashed border-stroke/20 p-3 hover:bg-surface-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-world-violet-100">
                  <Sparkles size={17} />
                </span>
                <span className="min-w-0 flex-1 font-semibold">{activity.title}</span>
                <span className="text-xs text-muted">
                  {activity.done ? "Completed" : (activity.kind ?? "Practice")}
                </span>
              </Link>
            ))}
            {unit.quiz && (
              <div
                className={cn(
                  "flex items-center gap-3 rounded-xl border-2 p-3",
                  quizLocked
                    ? "border-dashed border-stroke/20 bg-surface-100"
                    : "border-world-amber-400 bg-world-amber-100",
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-world-amber-200">
                  {quizLocked ? <LockKeyhole size={17} /> : <GraduationCap size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {unit.quiz.title ?? "Unit assessment"}
                  </span>
                  <span className="block text-xs text-muted">
                    {quizLocked
                      ? "Finish all lessons to unlock"
                      : `${unit.quiz.question_count ?? ""} ${unit.quiz.question_count ? "questions" : "Assessment"}${unit.quiz.time_limit_min ? ` · ${unit.quiz.time_limit_min} min` : ""}`}
                  </span>
                </span>
                {quizLocked ? (
                  <span className="text-xs font-semibold text-muted">Locked</span>
                ) : (
                  <Link
                    className="text-sm font-bold underline"
                    to={`/student/quizzes/${unit.quiz.id}?courseId=${encodeURIComponent(courseId)}`}
                  >
                    Open
                  </Link>
                )}
              </div>
            )}
            {unit.lessons.length === 0 && unit.activities.length === 0 && !unit.quiz && (
              <p className="py-4 text-sm text-muted">Content for this unit is being prepared.</p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export default function CourseDetailsPage() {
  const { courseId = "" } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [expandedUnits, setExpandedUnits] = useState<string[]>([]);
  const query = useQuery({
    queryKey: [...COURSE_DETAILS_KEY, courseId],
    queryFn: () => fetchCourseDetails(courseId),
    enabled: Boolean(courseId),
    staleTime: 30_000,
  });
  const course = query.data?.course;
  const units = query.data?.units ?? [];
  const progress = useMemo(() => courseProgress(units), [units]);
  const minutesRemaining = useMemo(
    () =>
      units.reduce(
        (sum, unit) =>
          sum +
          unit.lessons
            .filter((lesson) => !lesson.done)
            .reduce((sub, lesson) => sub + (lesson.minutes ?? 10), 0),
        0,
      ),
    [units],
  );
  const completedLessons = units.reduce(
    (sum, unit) => sum + unit.lessons.filter((lesson) => lesson.done).length,
    0,
  );
  const totalLessons = units.reduce((sum, unit) => sum + unit.lessons.length, 0);
  const currentUnitId =
    units.find((unit) => unitStatus(unit) === "in-progress")?.id ??
    units.find((unit) => unitStatus(unit) === "not-started")?.id;
  const stats: StudentShellStats = {
    xpTotal: 0,
    level: 1,
    xpInLevel: 0,
    xpToNext: 100,
    coins: 0,
    streakDays: 0,
    rankTitle: "Learner",
  };

  return (
    <StudentAppShell stats={stats} fallbackTitle="Course details">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
        <Link
          to="/student/courses"
          className="inline-flex w-fit items-center gap-2 text-sm font-bold text-muted hover:text-stroke"
        >
          <ArrowLeft size={17} /> All courses
        </Link>
        {query.isPending ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div className="space-y-4">
              <Skeleton shape="rect" className="h-56 w-full" />
              <Skeleton shape="rect" className="h-24 w-full" />
              <Skeleton shape="rect" className="h-24 w-full" />
            </div>
            <Skeleton shape="rect" className="h-80 w-full" />
          </div>
        ) : query.isError ? (
          <ErrorState
            description={
              query.error.message ||
              "We couldn't load this course. Check your connection and try again."
            }
            onRetry={() => void query.refetch()}
          />
        ) : !course ? (
          <EmptyState
            title="Course not found"
            description="This course may have been removed or you may not have access to it."
          />
        ) : (
          <>
            <header className="relative overflow-hidden rounded-[24px] border-2 border-stroke bg-world-sky-200 p-5 shadow-retro-sm sm:p-8">
              <div className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full border-[22px] border-white/25" />
              <div className="relative max-w-3xl">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Chip>{course.category ?? "Course"}</Chip>
                  {(course.grade_level ?? course.grade) && (
                    <Chip>Grade {course.grade_level ?? course.grade}</Chip>
                  )}
                </div>
                <h1 className="font-display text-3xl leading-tight text-stroke sm:text-4xl">
                  {course.title ?? course.name}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stroke/80 sm:text-base">
                  {course.description ??
                    query.data.side?.about ??
                    "Follow the roadmap to build your skills one lesson at a time."}
                </p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stroke/80">
                  {course.teacher_name && (
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound size={16} />
                      {course.teacher_name}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen size={16} />
                    {totalLessons} lessons
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 size={16} />
                    {durationLabel(minutesRemaining)} remaining
                  </span>
                </div>
                <div className="mt-6 rounded-2xl border-2 border-stroke/15 bg-white/70 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-heading font-bold">Your course progress</span>
                    <span className="font-heading text-xl font-bold">{progress}%</span>
                  </div>
                  <ProgressBar
                    value={progress}
                    label="Overall course progress"
                    valueText={`${progress}% complete`}
                  />
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                    <span>
                      {completedLessons} of {totalLessons} lessons completed
                    </span>
                    <span>{units.length} units</span>
                  </div>
                </div>
                {units.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = units
                        .flatMap((unit) => unit.lessons)
                        .find((lesson) => !lesson.done);
                      if (next)
                        navigate(
                          `/student/lessons/${next.id}?courseId=${encodeURIComponent(courseId)}`,
                        );
                    }}
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-stroke bg-world-amber-300 px-5 font-heading font-bold text-stroke shadow-retro-sm transition-transform hover:-translate-y-0.5"
                  >
                    {progress === 100 ? "Review lessons" : "Continue learning"}
                    <ArrowRight size={17} />
                  </button>
                )}
              </div>
            </header>
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <section className="flex min-w-0 flex-col gap-4" aria-labelledby="roadmap-heading">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 id="roadmap-heading" className="font-display text-2xl text-stroke">
                      Course roadmap
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      Work through each unit and track your progress.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-bold underline"
                    onClick={() =>
                      setExpandedUnits(
                        expandedUnits.length === units.length ? [] : units.map((unit) => unit.id),
                      )
                    }
                  >
                    {expandedUnits.length === units.length ? "Collapse all" : "Expand all"}
                  </button>
                </div>
                {units.length === 0 ? (
                  <EmptyState
                    title="No units yet"
                    description="Your teacher has not added units to this course yet."
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    {units.map((unit, index) => (
                      <UnitRoadmap
                        key={unit.id}
                        unit={unit}
                        index={index}
                        courseId={courseId}
                        expanded={
                          expandedUnits.includes(unit.id) ||
                          (expandedUnits.length === 0 && unit.id === currentUnitId)
                        }
                        onToggle={() =>
                          setExpandedUnits((current) =>
                            current.includes(unit.id)
                              ? current.filter((id) => id !== unit.id)
                              : [...current, unit.id],
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
              <aside className="flex flex-col gap-4 lg:sticky lg:top-5">
                <section className={cn(PANEL, "p-5")}>
                  <h2 className="font-heading text-lg font-bold">About this course</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {query.data.side?.about ??
                      course.about ??
                      course.description ??
                      "A guided learning path designed to help you practise and make steady progress."}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-surface-100 p-3">
                      <BookOpen size={18} className="mb-2" />
                      <p className="text-xs text-muted">Lessons</p>
                      <p className="font-heading text-xl font-bold">
                        {query.data.side?.lessons ?? totalLessons}
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface-100 p-3">
                      <Clock3 size={18} className="mb-2" />
                      <p className="text-xs text-muted">Total time</p>
                      <p className="font-heading text-xl font-bold">
                        {durationLabel(
                          query.data.side?.hours
                            ? Math.round(query.data.side.hours * 60)
                            : estimateMinutes(units),
                        )}
                      </p>
                    </div>
                  </div>
                  {(course.term ?? course.semester ?? query.data.side?.term) && (
                    <p className="mt-4 text-sm text-muted">
                      Term:{" "}
                      <span className="font-semibold text-stroke">
                        {course.term ?? course.semester ?? query.data.side?.term}
                      </span>
                    </p>
                  )}
                </section>
                <section className={cn(PANEL, "p-5")}>
                  <h2 className="font-heading text-lg font-bold">Learning objectives</h2>
                  {course.objectives.length ? (
                    <ul className="mt-3 flex flex-col gap-3">
                      {course.objectives.map((objective) => (
                        <li key={objective} className="flex gap-2 text-sm text-muted">
                          <Target size={17} className="mt-0.5 shrink-0 text-world-violet-500" />
                          {objective}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      Explore each unit to see its learning objectives.
                    </p>
                  )}
                </section>
                <section className={cn(PANEL, "p-5")}>
                  <div className="flex items-center gap-2">
                    <Trophy size={20} />
                    <h2 className="font-heading text-lg font-bold">Course certificate</h2>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {query.data.side?.certificate?.earned
                      ? "Congratulations! Your course certificate is ready."
                      : "Complete all course lessons to unlock your certificate."}
                  </p>
                  <div className="mt-3 flex items-center gap-3 rounded-xl border-2 border-dashed border-stroke/20 bg-surface-100 p-3">
                    <GraduationCap size={28} className="shrink-0 text-muted" />
                    <div>
                      <p className="font-semibold">
                        {query.data.side?.certificate?.earned
                          ? "Certificate earned"
                          : "Certificate locked"}
                      </p>
                      <p className="text-xs text-muted">{progress}% course completion</p>
                    </div>
                    {!query.data.side?.certificate?.earned && (
                      <LockKeyhole className="ml-auto shrink-0 text-muted" size={18} />
                    )}
                  </div>
                </section>
                {query.data.side?.upcoming && query.data.side.upcoming.length > 0 && (
                  <section className={cn(PANEL, "p-5")}>
                    <h2 className="font-heading text-lg font-bold">Coming up</h2>
                    <div className="mt-3 flex flex-col gap-3">
                      {query.data.side.upcoming.map((item, index) => (
                        <div
                          key={item.id ?? `${item.title}-${index}`}
                          className="flex items-start gap-3"
                        >
                          <span className="rounded-lg bg-world-amber-200 p-2">
                            <Clock3 size={16} />
                          </span>
                          <div>
                            <p className="font-semibold">{item.title}</p>
                            <p className="text-xs capitalize text-muted">
                              {item.kind ?? "Course item"}
                              {item.due_at
                                ? ` · Due ${new Date(item.due_at).toLocaleDateString()}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </aside>
            </div>
          </>
        )}
      </main>
    </StudentAppShell>
  );
}

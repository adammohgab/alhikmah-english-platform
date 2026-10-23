import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Clock3, Flag,
  GraduationCap, LockKeyhole, Play, Sparkles, Star, Target, Trophy,
} from "lucide-react";
import { StudentAppShell } from "@/shared/components/layout/StudentAppShell";
import { supabase } from "@/shared/api/supabase";
import { useToast } from "@/shared/hooks/useToast";
import type { StudentShellStats } from "@/shared/components/layout/StudentTopBar";
import { Chip } from "@/shared/components/ui/Chip";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { cn } from "@/shared/lib/utils/cn";
import { COURSE_DETAILS_KEY, fetchCourseDetails, isQuizLocked, type CourseUnit } from "@/pages/student/CourseDetailsPage/api";

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 shadow-retro-sm";
const STATS: StudentShellStats = { xpTotal: 0, level: 1, xpInLevel: 0, xpToNext: 100, coins: 0, streakDays: 0, rankTitle: "Learner" };
const SKILL_LABELS: Record<string, string> = { vocabulary: "Vocabulary", grammar: "Grammar", reading: "Reading", writing: "Writing", listening: "Listening", speaking: "Speaking" };

type LessonStatus = "completed" | "current" | "locked";
type LooseWord = string | { word?: string; term?: string; meaning?: string; definition?: string; translation?: string };

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function getWords(unit: CourseUnit): { word: string; meaning: string }[] {
  const raw = (unit as CourseUnit & { vocabulary?: LooseWord[]; key_words?: LooseWord[]; words?: LooseWord[] }).vocabulary
    ?? (unit as CourseUnit & { key_words?: LooseWord[] }).key_words
    ?? (unit as CourseUnit & { words?: LooseWord[] }).words
    ?? [];
  return raw.map((entry) => typeof entry === "string"
    ? { word: entry, meaning: "" }
    : { word: entry.word ?? entry.term ?? "", meaning: entry.meaning ?? entry.definition ?? entry.translation ?? "" })
    .filter((entry) => entry.word.trim().length > 0);
}

function lessonStatus(index: number, lessons: CourseUnit["lessons"]): LessonStatus {
  if (lessons[index]?.done) return "completed";
  const firstIncomplete = lessons.findIndex((lesson) => !lesson.done);
  return index === (firstIncomplete < 0 ? -1 : firstIncomplete) ? "current" : "locked";
}

function WindingMap({
  lessons, courseId, unitId,
}: { lessons: CourseUnit["lessons"]; courseId: string; unitId: string }) {
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const points = useMemo(() => lessons.map((lesson, index) => ({
    lesson,
    index,
    x: [22, 50, 78, 50][index % 4],
    y: 74 + index * 166,
    status: lessonStatus(index, lessons),
  })), [lessons]);
  const mapHeight = Math.max(390, 364 + Math.max(0, lessons.length - 1) * 166);
  const lessonPath = points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    const midY = (point.y + next.y) / 2;
    return `${index === 0 ? "M" : "L"} ${point.x * 10} ${point.y} C ${point.x * 10} ${midY}, ${next.x * 10} ${midY}, ${next.x * 10} ${next.y}`;
  }).join(" ");
  const lastPoint = points[points.length - 1];
  const path = lastPoint
    ? `${lessonPath ? `${lessonPath} L` : "M"} ${lastPoint.x * 10} ${lastPoint.y} C ${lastPoint.x * 10} ${lastPoint.y + 48}, 500 ${mapHeight - 118}, 500 ${mapHeight - 80}`
    : lessonPath;

  if (lessons.length === 0) return <EmptyState title="Lessons are on the way" description="Your teacher has not added lessons to this unit yet." />;

  return <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[24px] border-2 border-stroke/10 bg-[radial-gradient(circle_at_15%_10%,rgba(125,211,252,.20),transparent_28%),radial-gradient(circle_at_85%_80%,rgba(196,181,253,.20),transparent_30%),linear-gradient(180deg,#fbfdff,#f3f7ff)] px-2 py-5 sm:px-5" aria-label="Interactive lesson progression map">
    <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white bg-white/85 px-3 py-1.5 text-xs font-bold text-stroke shadow-sm"><Sparkles size={14} /> LESSON QUEST</div>
    <div className="relative mt-10" style={{ height: mapHeight }}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 1000 ${mapHeight}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={path} fill="none" stroke="#d7deed" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
        <path d={path} fill="none" stroke="#ffffff" strokeWidth="23" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 15" />
      </svg>
      {points.map(({ lesson, index, x, y, status }) => {
        const active = status === "current";
        const completed = status === "completed";
        const xp = Number((lesson as typeof lesson & { xp_reward?: number; xp?: number }).xp_reward ?? (lesson as typeof lesson & { xp?: number }).xp ?? 20);
        const tooltip = `${lesson.title} · ${lesson.minutes ?? 10} min · ${xp} XP · ${status}`;
        const content = <>
          <span className={cn(
            "relative flex h-[66px] w-[66px] items-center justify-center rounded-[24px] border-[4px] border-stroke shadow-[0_6px_0_rgba(28,39,60,.16)] transition duration-200 group-hover:-translate-y-1 group-hover:scale-105 group-focus-visible:scale-105 sm:h-[76px] sm:w-[76px] sm:rounded-[27px]",
            completed ? "bg-world-mint-300" : active ? "bg-world-amber-300" : "bg-surface-200",
            active && "ring-4 ring-world-amber-300/60 ring-offset-2 ring-offset-white animate-pulse",
          )}>
            {completed ? <><Star size={28} fill="currentColor" strokeWidth={2.5} /><CheckCircle2 className="absolute -right-2 -top-2 rounded-full border-2 border-stroke bg-white p-0.5" size={23} /></> : active ? <Play size={28} fill="currentColor" /> : <LockKeyhole size={25} />}
          </span>
          <span className="mt-3 block max-w-[140px] text-center text-sm font-extrabold leading-tight text-stroke">{index + 1}. {lesson.title}</span>
          <span className="mt-1 block text-center text-xs font-semibold text-muted">{lesson.minutes ?? 10} min · {xp} XP</span>
          <span className={cn("mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide", completed ? "bg-world-mint-200 text-stroke" : active ? "bg-world-amber-200 text-stroke" : "bg-surface-200 text-muted")}>
            {completed ? <><Check size={11} /> Done</> : active ? "Current" : <><LockKeyhole size={10} /> Locked</>}
          </span>
        </>;
        const style = { left: `${x}%`, top: y, transform: "translateX(-50%)" };
        return <div key={lesson.id} className="group absolute z-10 flex w-[145px] flex-col items-center outline-none" style={style} title={tooltip}>
          {status === "locked" ? <button type="button" disabled aria-label={`${lesson.title}, locked. Complete the previous lesson first.`} className="cursor-not-allowed opacity-75">{content}</button> : <Link to={`/student/lessons/${lesson.id}?courseId=${encodeURIComponent(courseId)}&unitId=${encodeURIComponent(unitId)}`} aria-label={`${completed ? "Review" : "Start"} lesson ${index + 1}: ${lesson.title}`} onFocus={() => setSelectedLesson(lesson.id)} onMouseEnter={() => setSelectedLesson(lesson.id)} onMouseLeave={() => setSelectedLesson(null)} className="flex flex-col items-center rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stroke">{content}</Link>}
          {selectedLesson === lesson.id && status !== "locked" && <div role="tooltip" className="absolute top-full z-20 mt-2 w-44 rounded-xl border-2 border-stroke bg-white p-3 text-left text-xs shadow-retro-sm"><p className="font-bold">{lesson.title}</p><p className="mt-1 text-muted">Estimated time: {lesson.minutes ?? 10} minutes</p><p className="font-bold text-world-violet-700">Reward: {xp} XP</p></div>}
        </div>;
      })}
      {lessons.length > 0 && <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ top: mapHeight - 112 }}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-[4px] border-stroke bg-world-violet-300 shadow-[0_6px_0_rgba(28,39,60,.16)]"><Flag size={26} /></div>
        <span className="mt-2 rounded-full border-2 border-stroke bg-white px-3 py-1 text-center text-xs font-extrabold text-stroke">Unit checkpoint</span>
      </div>}
    </div>
  </div>;
}

export default function UnitPage() {
  const toast = useToast();
  const [savingWords, setSavingWords] = useState(false);
  const { courseId = "", unitId = "" } = useParams<{ courseId: string; unitId: string }>();
  const query = useQuery({ queryKey: [...COURSE_DETAILS_KEY, courseId], queryFn: () => fetchCourseDetails(courseId), enabled: Boolean(courseId), staleTime: 30_000 });
  const course = query.data?.course;
  const unit = query.data?.units.find((item) => item.id === unitId);
  const lessons = unit?.lessons ?? [];
  const completed = lessons.filter((lesson) => lesson.done).length;
  const progress = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
  const words = unit ? getWords(unit) : [];
  const quizLocked = isQuizLocked(unit?.quiz);
  const addAllWords = async () => {
    if (!words.length || savingWords) return;
    setSavingWords(true);
    try {
      const { error } = await supabase.rpc("add_words_to_library", {
        items: words.map((word) => ({ word: word.word, meaning: word.meaning || null, arabic_meaning: word.meaning || null, part_of_speech: null, example: null, vocab_item_id: null })),
        from: "unit",
      });
      if (error) throw error;
      toast.show({ title: "Vocabulary added", description: `${words.length} words were added to your library.`, type: "success" });
    } catch (error) {
      toast.show({ title: "Could not add vocabulary", description: error instanceof Error ? error.message : "Please try again.", type: "error" });
    } finally {
      setSavingWords(false);
    }
  };

  return <StudentAppShell stats={STATS} fallbackTitle="Unit learning map">
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <Link to={`/student/courses/${encodeURIComponent(courseId)}`} className="inline-flex w-fit items-center gap-2 text-sm font-bold text-muted hover:text-stroke"><ArrowLeft size={17} /> Back to course</Link>
      {query.isPending ? <div className="space-y-4"><Skeleton shape="rect" className="h-48 w-full" /><Skeleton shape="rect" className="h-[600px] w-full" /></div>
        : query.isError ? <ErrorState description={query.error.message || "We couldn't load this unit."} onRetry={() => void query.refetch()} />
          : !course || !unit ? <EmptyState title="Unit not found" description="This unit may have been removed, or you may not have access to it." />
            : <>
              <header className="relative overflow-hidden rounded-[26px] border-2 border-stroke bg-world-sky-200 p-5 shadow-retro-sm sm:p-8">
                <div className="pointer-events-none absolute -right-7 -top-12 h-44 w-44 rounded-full border-[22px] border-white/30" />
                <nav aria-label="Breadcrumb" className="relative mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-stroke/70"><Link className="hover:underline" to={`/student/courses/${encodeURIComponent(courseId)}`}>{course.title ?? course.name ?? "Course"}</Link><span>/</span><span className="text-stroke">{unit.title}</span></nav>
                <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                  <div className="max-w-3xl"><div className="mb-3 flex flex-wrap gap-2"><Chip>Unit {((query.data?.units.findIndex((item) => item.id === unitId) ?? 0) + 1)}</Chip><Chip>{completed === lessons.length && lessons.length > 0 ? "Completed" : completed > 0 ? "In progress" : "Ready to start"}</Chip></div><h1 className="font-display text-3xl leading-tight text-stroke sm:text-4xl">{unit.title}</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-stroke/80 sm:text-base">{unit.description ?? "Follow the winding learning path, complete each lesson, and unlock your unit checkpoint."}</p></div>
                  <div className="w-full rounded-2xl border-2 border-stroke/15 bg-white/75 p-4 md:max-w-[260px]"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-bold">Unit progress</span><span className="font-heading text-xl font-extrabold">{progress}%</span></div><ProgressBar value={completed} max={Math.max(lessons.length, 1)} label="Unit lesson progress" valueText={`${completed} of ${lessons.length} lessons completed`} /><p className="mt-2 text-xs text-muted">{completed} of {lessons.length} lessons complete</p></div>
                </div>
              </header>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.7fr)]">
                <div className="min-w-0 space-y-5">
                  <section className={cn(PANEL, "p-4 sm:p-5")}><div className="mb-4 flex items-center gap-2"><Target size={20} /><h2 className="font-heading text-xl font-extrabold">Learning objectives</h2></div>{unit.objectives.length ? <ul className="grid gap-3 sm:grid-cols-2">{unit.objectives.map((objective) => <li key={objective} className="flex gap-2 text-sm leading-relaxed text-muted"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-world-mint-600" />{objective}</li>)}</ul> : <p className="text-sm text-muted">By the end of this unit, you’ll build confidence through the lessons and activities below.</p>}</section>
                  <section className={cn(PANEL, "p-4 sm:p-5")}><div className="mb-3 flex items-center gap-2"><Sparkles size={20} /><h2 className="font-heading text-xl font-extrabold">Skills covered</h2></div><div className="flex flex-wrap gap-2">{(unit.skills.length ? unit.skills : ["vocabulary", "grammar", "reading"]).map((skill) => <Chip key={skill}>{SKILL_LABELS[skill.toLowerCase()] ?? skill}</Chip>)}</div></section>
                  <section className="space-y-3" aria-labelledby="lesson-map-heading"><div className="flex items-end justify-between gap-3"><div><h2 id="lesson-map-heading" className="font-display text-2xl text-stroke">Your lesson path</h2><p className="mt-1 text-sm text-muted">Finish each stepping stone to reach the checkpoint.</p></div><span className="shrink-0 rounded-full bg-world-mint-100 px-3 py-1 text-xs font-extrabold text-stroke">{completed}/{lessons.length} done</span></div><WindingMap lessons={lessons} courseId={courseId} unitId={unitId} /></section>
                  <section className={cn(PANEL, "p-4 sm:p-5")}><div className="mb-4 flex items-center gap-2"><BookOpen size={20} /><h2 className="font-heading text-xl font-extrabold">Lesson list</h2></div><div className="space-y-2">{lessons.map((lesson, index) => { const status = lessonStatus(index, lessons); const href = `/student/lessons/${lesson.id}?courseId=${encodeURIComponent(courseId)}&unitId=${encodeURIComponent(unitId)}`; return <div key={lesson.id} className="flex items-center gap-3 rounded-xl border border-stroke/15 p-3"><span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", status === "completed" ? "bg-world-mint-200" : status === "current" ? "bg-world-amber-200" : "bg-surface-200")}>{status === "completed" ? <Check size={19} /> : status === "current" ? <Play size={18} /> : <LockKeyhole size={18} />}</span><div className="min-w-0 flex-1"><p className="font-bold">{index + 1}. {lesson.title}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-muted"><Clock3 size={12} />{durationLabel(lesson.minutes ?? 10)} · {Number((lesson as typeof lesson & { xp_reward?: number }).xp_reward ?? 20)} XP</p></div>{status === "locked" ? <span className="text-xs font-bold text-muted">Locked</span> : <Link className="rounded-lg border border-stroke/20 px-3 py-2 text-sm font-bold hover:bg-surface-100" to={href}>{status === "completed" ? "Review" : "Start"}</Link>}</div>; })}</div></section>
                </div>

                <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-5">
                  <section className={cn(PANEL, "p-5")}><div className="flex items-center gap-2"><Sparkles size={20} /><h2 className="font-heading text-xl font-extrabold">Activities</h2></div>{unit.activities.length ? <div className="mt-4 space-y-2">{unit.activities.map((activity) => <Link key={activity.id} to={`/student/activities/${activity.id}?courseId=${encodeURIComponent(courseId)}&unitId=${encodeURIComponent(unitId)}`} className="flex items-center gap-3 rounded-xl border border-stroke/15 p-3 transition-colors hover:bg-surface-100"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-world-violet-100"><Sparkles size={17} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{activity.title}</span><span className="text-xs text-muted">{activity.kind ?? "Practice"} · {activity.done ? "Completed" : "Ready to play"}</span></span>{activity.done ? <CheckCircle2 size={18} className="text-world-mint-600" /> : <ArrowRight size={17} />}</Link>)}</div> : <p className="mt-3 text-sm text-muted">No extra activities have been added to this unit yet.</p>}</section>
                  <section className={cn(PANEL, "overflow-hidden")}><div className="bg-world-violet-200 p-5"><div className="flex items-center gap-2"><Trophy size={21} /><h2 className="font-heading text-xl font-extrabold">Unit checkpoint</h2></div><p className="mt-2 text-sm text-stroke/75">Complete every lesson to challenge the quiz boss and finish this unit.</p></div><div className="p-5">{unit.quiz ? <><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-stroke bg-world-amber-200">{quizLocked ? <LockKeyhole size={22} /> : <GraduationCap size={24} />}</span><div className="min-w-0 flex-1"><p className="font-bold">{unit.quiz.title ?? "Unit quiz"}</p><p className="mt-1 text-xs text-muted">{unit.quiz.question_count ?? "Quiz"} {unit.quiz.question_count ? "questions" : ""}{unit.quiz.time_limit_min ? ` · ${unit.quiz.time_limit_min} min` : ""}</p></div></div>{quizLocked ? <p className="mt-4 rounded-xl bg-surface-100 p-3 text-sm text-muted">Finish all lessons to unlock this checkpoint.</p> : <Link to={`/student/quizzes/${unit.quiz.id}?courseId=${encodeURIComponent(courseId)}&unitId=${encodeURIComponent(unitId)}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-stroke bg-world-amber-300 px-4 font-heading font-extrabold text-stroke shadow-retro-sm transition-transform hover:-translate-y-0.5">Enter checkpoint <ArrowRight size={17} /></Link>}</> : <p className="text-sm text-muted">Your teacher has not added a unit assessment yet.</p>}</div></section>
                  <section className={cn(PANEL, "p-5")}><div className="flex items-center gap-2"><BookOpen size={20} /><h2 className="font-heading text-xl font-extrabold">Unit vocabulary</h2></div>{words.length ? <div className="mt-3 flex flex-wrap gap-2">{words.map((word) => <span key={word.word} title={word.meaning} className="rounded-full border border-stroke/15 bg-surface-100 px-3 py-1.5 text-sm font-semibold">{word.word}</span>)}</div> : <p className="mt-3 text-sm text-muted">Key words will appear here when your teacher adds unit vocabulary.</p>}{words.length > 0 && <button type="button" disabled={savingWords} onClick={() => void addAllWords()} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border-2 border-stroke bg-world-amber-300 px-3 text-sm font-extrabold text-stroke shadow-retro-sm transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"><BookOpen size={16} />{savingWords ? "Adding words…" : "Add all to my library"}</button>}<p className="mt-3 text-xs text-muted">Hover or focus a word to see its meaning when available.</p></section>
                  <div className="rounded-[20px] border-2 border-dashed border-stroke/20 bg-surface-100 p-4 text-sm text-muted"><div className="flex items-start gap-2"><Star size={17} className="mt-0.5 shrink-0 text-world-amber-500" /><p>Every lesson is a stepping stone. Keep going to earn XP and reach the checkpoint!</p></div></div>
                </aside>
              </section>
            </>}
    </main>
  </StudentAppShell>;
}

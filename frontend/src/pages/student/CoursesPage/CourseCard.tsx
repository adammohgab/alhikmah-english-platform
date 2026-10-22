import { ArrowRight, Award, BookOpen, Check, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Chip } from "@/shared/components/ui/Chip";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { CourseCover } from "./CourseCover";
import { categoryLabel, coursePath, lessonsLabel, type Course } from "./rules";

/* One course on the list (ST-02 CourseCard): generated cover, category, grade, title, teacher,
   progress bar with percent and lesson count, the next step, and a Continue cue. The title is
   the one link of the card and stretches over all of it, so the whole card opens the course
   page (ST-03) with a single, clearly named tab stop. A finished course shows "Completed" and
   a certificate link that sits above that stretched layer. */

export interface CourseCardProps {
  course: Course;
}

/** The server may already word the label "Next: ..."; show the prefix only once. */
function nextText(label: string): string {
  return `Next: ${label.replace(/^next\s*:?\s*/i, "")}`;
}

const CUE =
  "inline-flex h-10 items-center gap-2 rounded-full border-2 border-stroke bg-[var(--world-main,#ffb84d)] px-4 font-heading text-[15px] font-semibold text-stroke shadow-retro-sm";

export function CourseCard({ course }: CourseCardProps) {
  const lessons = lessonsLabel(course);
  const started = course.progressPct > 0;
  const valueText = lessons ? `${course.progressPct}%, ${lessons}` : `${course.progressPct}%`;

  return (
    <li className="relative flex min-w-0 flex-col overflow-hidden rounded-[20px] border-2 border-stroke bg-surface-0 shadow-[2px_2px_0px_#000] transition-[transform,box-shadow] duration-150 focus-within:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#000] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <CourseCover seed={course.coverSeed} className="h-28 w-full border-b-2 border-stroke" />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{categoryLabel(course)}</Chip>
          {course.grade && (
            <span className="text-[13px] font-bold text-muted">Grade {course.grade}</span>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="font-display text-[20px] leading-tight text-stroke [overflow-wrap:anywhere]">
            <Link
              to={coursePath(course.id)}
              className="rounded-md after:absolute after:inset-0 after:z-0 after:rounded-[18px] after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-[3px] focus-visible:after:outline-offset-2 focus-visible:after:outline-stroke"
            >
              {course.title}
            </Link>
          </h3>
          {course.teacherName && (
            <p className="mt-1 flex items-center gap-1.5 text-[14px] text-muted">
              <UserRound size={16} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{course.teacherName}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <ProgressBar
            value={course.progressPct}
            label={`${course.title} progress`}
            valueText={valueText}
          />
          <p className="flex flex-wrap items-center justify-between gap-x-3 text-[13px] font-bold text-stroke">
            <span>{course.progressPct}%</span>
            <span className="flex items-center gap-1 text-muted">
              <BookOpen size={14} aria-hidden="true" />
              {lessons ?? `${course.unitsCount} ${course.unitsCount === 1 ? "unit" : "units"}`}
            </span>
          </p>
        </div>

        {course.completed ? null : course.nextLabel ? (
          <p className="text-[14px] text-muted [overflow-wrap:anywhere]">
            {nextText(course.nextLabel)}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          {course.completed ? (
            <>
              <span className="inline-flex items-center gap-1.5 font-heading text-[15px] font-bold text-stroke">
                <Check size={18} strokeWidth={3} aria-hidden="true" />
                Completed
              </span>
              <Link
                to="/student/certificates"
                className="relative z-10 inline-flex items-center gap-1.5 rounded-md text-[14px] font-bold text-stroke underline underline-offset-2"
              >
                <Award size={16} aria-hidden="true" />
                Certificate
              </Link>
            </>
          ) : (
            <span className={CUE} aria-hidden="true">
              {started ? "Continue" : "Start"}
              <ArrowRight size={16} strokeWidth={2.5} />
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

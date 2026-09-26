import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, PenLine, ClipboardCheck } from "lucide-react";

interface CourseSlideProps {
  active: boolean;
}

/** Slide 04 — New Course / Lesson: Unit 04 Stories and Ideas. */
export function CourseSlide({ active }: CourseSlideProps) {
  return (
    <div className="grid h-full w-full grid-cols-1 items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-12">
      <div className="max-w-xl">
        <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.18em] text-gold-500">
          New this week
        </p>
        <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1.1] text-white sm:text-5xl lg:text-6xl">
          Unit 04<br />
          Stories and Ideas.
        </h2>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-sans text-[13px] font-semibold uppercase tracking-[0.08em] text-white/70">
          <div>12 lessons</div>
          <div>4 practice activities</div>
          <div>1 assessment</div>
        </dl>
        <Link
          to="/courses"
          tabIndex={active ? 0 : -1}
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-md bg-gold-500 px-5 font-sans text-[15px] font-semibold text-navy-900 transition-colors duration-100 hover:bg-gold-600"
        >
          Start lesson
          <ArrowRight size={20} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </div>

      <div className="flex items-center justify-center" aria-hidden={!active}>
        <div className="w-full max-w-[440px] rounded-lg border border-white/12 bg-white p-5 text-ink-900 shadow-elevation-3">
          <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            Course — Unit 04
          </p>
          <p className="mt-2 font-serif text-[22px] font-semibold">Stories and Ideas</p>
          <ul className="mt-4 space-y-3">
            <li className="flex items-center gap-3">
              <BookOpen size={20} strokeWidth={1.5} className="shrink-0 text-navy-500" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-sans text-[14px] font-medium">Lesson 01 — Reading: Short stories</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-100">
                  <div className="h-full w-full rounded-full bg-navy-900" />
                </div>
              </div>
              <span className="font-sans text-[12px] font-semibold text-ink-500">Done</span>
            </li>
            <li className="flex items-center gap-3">
              <PenLine size={20} strokeWidth={1.5} className="shrink-0 text-navy-500" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-sans text-[14px] font-medium">Lesson 02 — Writing: Your own ending</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-100">
                  <div className="h-full w-1/2 rounded-full bg-gold-500" />
                </div>
              </div>
              <span className="font-sans text-[12px] font-semibold text-ink-500">50%</span>
            </li>
            <li className="flex items-center gap-3">
              <ClipboardCheck size={20} strokeWidth={1.5} className="shrink-0 text-navy-500" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-sans text-[14px] font-medium">Assessment — Unit 04 review</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-100">
                  <div className="h-full w-0 rounded-full bg-surface-100" />
                </div>
              </div>
              <span className="font-sans text-[12px] font-semibold text-ink-500">Locked</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

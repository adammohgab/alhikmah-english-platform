import { BookOpen, ClipboardCheck, PenLine } from "lucide-react";
import { HeroSlideCopy } from "@/pages/hero/components/HeroSlideCopy";

interface CourseSlideProps {
  active: boolean;
}

const UNIT_STATS = [
  { icon: BookOpen, label: "Lessons", value: "12" },
  { icon: PenLine, label: "Practice activities", value: "4" },
  { icon: ClipboardCheck, label: "Assessment", value: "1" },
];

/** Slide 04 — New Course / Lesson. Copy on the left; lesson list and unit
 * stats on the right. */
export function CourseSlide({ active }: CourseSlideProps) {
  return (
    <div className="grid h-full w-full grid-cols-1 items-center gap-6 px-4 pt-16 sm:px-6 lg:grid-cols-10 lg:gap-6 lg:px-8 lg:pt-12">
      <div className="lg:col-span-5">
        <HeroSlideCopy
          active={active}
          eyebrow="New this week"
          heading={
            <>
              Unit 04
              <br />
              Stories and Ideas.
            </>
          }
          body="12 lessons · 4 practice activities · 1 assessment."
          ctaLabel="Start lesson"
          ctaHref="/courses"
        />
      </div>

      <div
        className="grid grid-cols-1 items-stretch gap-5 lg:col-span-5 lg:grid-cols-2"
        aria-hidden={!active}
      >
        <div className="w-full rounded-lg bg-surface-0 p-6 text-ink-900 shadow-elevation-3">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Course — Unit 04
          </p>
          <p className="mt-2 font-serif text-[22px] font-semibold">Stories and Ideas</p>
          <ul className="mt-5 space-y-4">
            <li className="flex items-center gap-3">
              <BookOpen size={18} strokeWidth={1.5} className="shrink-0 text-navy-500" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-sans text-[14px] font-medium">Lesson 01 — Reading: Short stories</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-100">
                  <div className="h-full w-full rounded-full bg-navy-900" />
                </div>
              </div>
              <span className="font-sans text-[12px] font-semibold text-ink-500">Done</span>
            </li>
            <li className="flex items-center gap-3">
              <PenLine size={18} strokeWidth={1.5} className="shrink-0 text-navy-500" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-sans text-[14px] font-medium">Lesson 02 — Writing: Your own ending</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-100">
                  <div className="h-full w-1/2 rounded-full bg-gold-500" />
                </div>
              </div>
              <span className="font-sans text-[12px] font-semibold text-ink-500">50%</span>
            </li>
            <li className="flex items-center gap-3">
              <ClipboardCheck size={18} strokeWidth={1.5} className="shrink-0 text-navy-500" aria-hidden="true" />
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

        <div className="hidden w-full flex-col justify-center rounded-lg bg-navy-700 p-6 text-white shadow-elevation-3 lg:flex">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
            Unit 04 at a glance
          </p>
          <ul className="mt-4 space-y-3.5">
            {UNIT_STATS.map(({ icon: Icon, label, value }) => (
              <li key={label} className="flex items-center gap-3 font-sans text-[14px]">
                <Icon size={18} strokeWidth={1.5} className="shrink-0 text-white/55" aria-hidden="true" />
                <span className="text-white/80">{label}</span>
                <span className="ms-auto font-semibold tabular-nums">{value}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex items-baseline justify-between font-sans text-[13px]">
              <span className="text-white/60">Overall progress</span>
              <span className="font-semibold tabular-nums text-gold-500">Getting started</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-1/4 rounded-full bg-gold-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

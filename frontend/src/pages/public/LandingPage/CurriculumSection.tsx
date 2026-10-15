import { Lock } from "lucide-react";
import { Badge } from "@/shared/components/ui/Badge";
import { Card } from "@/shared/components/ui/Card";
import type { WorldId } from "@/shared/hooks/useWorld";

/* ========================================
   CurriculumSection (PUB-02, SHARED-SPEC SH-01 section 6)

   Left: a timeline for grades 7 to 12 with the three course tracks (Main Course, Reading Club,
   Exam Prep) as stripes. It stacks into a single column on mobile.
   Right: the course structure as a true sequence, Course, Unit, Lesson, Activity, Quiz, as a
   numbered ordered list with a connecting rail. Numbers are right here because the order is the
   point. A caption states the hybrid rule from STUDENT-SPEC: units are always open, and the quiz
   of a unit unlocks after the lessons of that unit.

   Which tracks a grade offers is a school setting (ADMIN-SPEC, Packages), so the stripes claim
   only what holds for every grade: the school can offer each track from grade 7 to 12.

   World mapping (one place, fixed): each skill chip always uses its own skill world.
     Vocabulary rose, Grammar violet, Reading sky, Writing amber, Listening mint, Translation coral.
   Tracks use neutral paper fills with different tints, so no track color competes with a skill.

   There is no animation in this file and no data is loaded: the page states the structure only.
   Class strings live in constants so the Tailwind class sorter treats them as plain data.
   ======================================== */

interface Track {
  id: string;
  label: string;
  summary: string;
  fillClass: string;
}

const TRACKS: readonly Track[] = [
  {
    id: "main",
    label: "Main Course",
    summary: "The core course for your grade",
    fillClass: "bg-surface-0",
  },
  {
    id: "reading-club",
    label: "Reading Club",
    summary: "Extra reading practice",
    fillClass: "bg-surface-100",
  },
  {
    id: "exam-prep",
    label: "Exam Prep",
    summary: "Revision for exams",
    fillClass: "bg-surface-200",
  },
];

const GRADES: readonly number[] = [7, 8, 9, 10, 11, 12];

interface Step {
  id: string;
  title: string;
  summary: string;
}

const STEPS: readonly Step[] = [
  {
    id: "course",
    title: "Course",
    summary: "A course is one track for your grade, such as Main Course.",
  },
  {
    id: "unit",
    title: "Unit",
    summary: "Units are always open, so you can start with any unit.",
  },
  {
    id: "lesson",
    title: "Lesson",
    summary: "Each lesson teaches one idea and earns XP when you finish it.",
  },
  {
    id: "activity",
    title: "Activity",
    summary: "Activities give you questions to practice with, and feedback.",
  },
  {
    id: "quiz",
    title: "Quiz",
    summary: "A quiz closes each unit and checks what you learned.",
  },
];

interface Skill {
  id: string;
  label: string;
  world: WorldId;
}

const SKILLS: readonly Skill[] = [
  { id: "vocabulary", label: "Vocabulary", world: "rose" },
  { id: "grammar", label: "Grammar", world: "violet" },
  { id: "reading", label: "Reading", world: "sky" },
  { id: "writing", label: "Writing", world: "amber" },
  { id: "listening", label: "Listening", world: "mint" },
  { id: "translation", label: "Translation", world: "coral" },
];

const SECTION_CLASS = "w-full bg-surface-0 px-4 py-16 sm:px-6 md:py-24";
const CONTAINER_CLASS = "mx-auto flex w-full max-w-[1200px] flex-col gap-12";
const INTRO_CLASS = "flex max-w-2xl flex-col gap-3";
const EYEBROW_CLASS = "font-accent text-2xl text-stroke";
const HEADING_CLASS = "font-heading text-3xl font-bold leading-tight text-stroke md:text-5xl";
const LEAD_CLASS = "font-body text-base font-medium text-muted md:text-lg";
const LAYOUT_CLASS = "grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12";
const CARD_TITLE_CLASS = "font-heading text-[18px] font-semibold leading-tight text-stroke";
const CARD_BODY_CLASS = "flex flex-col gap-6";
const GRADE_LIST_CLASS = "grid grid-cols-3 gap-2 sm:grid-cols-6";
const GRADE_ITEM_CLASS =
  "flex h-12 items-center justify-center rounded-[12px] border-2 border-stroke bg-[var(--world-soft,#ffd93d)] font-heading text-[15px] font-semibold text-stroke shadow-retro-sm";
const STRIPE_LIST_CLASS = "flex flex-col gap-3";
const STRIPE_CLASS =
  "flex flex-col gap-1 rounded-[12px] border-2 border-stroke px-4 py-3 shadow-retro-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4";
const STRIPE_LABEL_CLASS = "font-heading text-[16px] font-semibold text-stroke";
const STRIPE_TEXT_CLASS = "font-body text-[15px] font-medium text-muted";
const TRACK_NOTE_CLASS = "font-body text-[15px] font-medium text-muted";
const SKILL_BLOCK_CLASS = "flex flex-col gap-3";
const SKILL_TITLE_CLASS = "font-heading text-[16px] font-semibold text-stroke";
const SKILL_LIST_CLASS = "flex flex-wrap gap-2";
const STEP_LIST_CLASS = "flex flex-col";
const STEP_ITEM_CLASS = "relative flex items-start gap-4 pb-6 last:pb-0";
const STEP_RAIL_CLASS =
  "absolute left-3 top-8 -ml-[1px] h-[calc(100%-2rem)] w-0.5 bg-stroke group-last:hidden";
const STEP_BODY_CLASS = "flex min-w-0 flex-col gap-1";
const STEP_TITLE_CLASS = "font-heading text-[18px] font-semibold leading-tight text-stroke";
const STEP_TEXT_CLASS = "font-body text-base font-medium text-muted";
const CAPTION_CLASS =
  "flex items-start gap-2 rounded-[12px] border-2 border-stroke bg-[var(--world-tint,#fff1e3)] p-3 font-body text-[15px] font-semibold text-stroke";
const CAPTION_ICON_CLASS = "mt-0.5 h-4 w-4 shrink-0 text-stroke [stroke-width:2.5]";

export interface CurriculumSectionProps {
  /** Anchor id of the section, the target of the "Curriculum" header link. Default `curriculum`. */
  id?: string | undefined;
}

function GradeTimeline({ idPrefix }: { idPrefix: string }) {
  const titleId = `${idPrefix}-timeline-title`;

  return (
    <Card
      as="section"
      world="amber"
      aria-labelledby={titleId}
      header={
        <h3 id={titleId} className={CARD_TITLE_CLASS}>
          Grades 7 to 12
        </h3>
      }
    >
      <div className={CARD_BODY_CLASS}>
        <ol aria-label="Grades" className={GRADE_LIST_CLASS}>
          {GRADES.map((grade) => (
            <li key={grade} className={GRADE_ITEM_CLASS}>
              Grade {grade}
            </li>
          ))}
        </ol>
        <ul aria-label="Course tracks" className={STRIPE_LIST_CLASS}>
          {TRACKS.map((track) => (
            <li key={track.id} className={`${STRIPE_CLASS} ${track.fillClass}`}>
              <span className={STRIPE_LABEL_CLASS}>{track.label}</span>
              <span className={STRIPE_TEXT_CLASS}>{track.summary}</span>
            </li>
          ))}
        </ul>
        <p className={TRACK_NOTE_CLASS}>
          Each track runs across the grades. Your school chooses which tracks every grade follows.
        </p>
        <div className={SKILL_BLOCK_CLASS}>
          <h4 className={SKILL_TITLE_CLASS}>Skills you practice in every course</h4>
          <ul aria-label="Skills" className={SKILL_LIST_CLASS}>
            {SKILLS.map((skill) => (
              <li key={skill.id}>
                <Badge world={skill.world}>{skill.label}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function CourseStructure({ idPrefix }: { idPrefix: string }) {
  const titleId = `${idPrefix}-structure-title`;

  return (
    <Card
      as="section"
      world="sky"
      aria-labelledby={titleId}
      header={
        <h3 id={titleId} className={CARD_TITLE_CLASS}>
          How a course is built
        </h3>
      }
    >
      <div className={CARD_BODY_CLASS}>
        <ol aria-label="Course structure, in order" className={STEP_LIST_CLASS}>
          {STEPS.map((step, index) => (
            <li key={step.id} className={`group ${STEP_ITEM_CLASS}`}>
              <span aria-hidden="true" className={STEP_RAIL_CLASS} />
              <Badge count={index + 1} aria-hidden="true" />
              <div className={STEP_BODY_CLASS}>
                <h4 className={STEP_TITLE_CLASS}>{step.title}</h4>
                <p className={STEP_TEXT_CLASS}>{step.summary}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className={CAPTION_CLASS}>
          <Lock aria-hidden="true" focusable="false" className={CAPTION_ICON_CLASS} />
          Quizzes unlock after you finish the lessons of the unit.
        </p>
      </div>
    </Card>
  );
}

/** Landing page curriculum overview: grade timeline with tracks and the course structure. */
export function CurriculumSection({ id = "curriculum" }: CurriculumSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section id={id} aria-labelledby={headingId} className={SECTION_CLASS}>
      <div className={CONTAINER_CLASS}>
        <div className={INTRO_CLASS}>
          <p className={EYEBROW_CLASS}>The English curriculum</p>
          <h2 id={headingId} className={HEADING_CLASS}>
            A clear path from grade 7 to grade 12
          </h2>
          <p className={LEAD_CLASS}>
            Every course follows the same structure, so you always know what comes next.
          </p>
        </div>
        <div className={LAYOUT_CLASS}>
          <GradeTimeline idPrefix={id} />
          <CourseStructure idPrefix={id} />
        </div>
      </div>
    </section>
  );
}

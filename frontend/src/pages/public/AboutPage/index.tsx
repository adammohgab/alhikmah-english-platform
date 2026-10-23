import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Headphones, Mic, PenLine } from "lucide-react";
import { SCHOOL_LOGO_SRC } from "@/shared/config/branding";
import { PublicFooter } from "@/shared/components/layout/PublicFooter";
import { PublicHeader } from "@/shared/components/layout/PublicHeader";
import { Avatar } from "@/shared/components/ui/Avatar";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   AboutPage: SH-09 "/about" (SHARED-SPEC §5, PUB-11)

   Plain-language explanation of the platform: mission, who it is for, the four language
   skills and CEFR, how learning is structured, how AI is used, what rewards are for, who Pip
   and Nova are, privacy in brief, contact, and the school (logo unchanged, on a light plate).
   Static copy in v1. Public pages always use the Daylight theme (spec §2); the mission band
   is the one expressive moment, the rest is a calm reading layout.
   ======================================================== */

const PAGE_TITLE = "About the platform | Wordland";
const SCHOOL_NAME = "Al Hikmah Private School";

function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

const READING = "mx-auto w-full max-w-[720px] px-6";

function Section({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <section aria-labelledby={id} className={cn("py-10 md:py-12", className)}>
      <h2
        id={id}
        className="font-heading text-[28px] font-bold leading-tight text-stroke md:text-[34px]"
      >
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[17px] leading-[1.7] text-stroke">{children}</div>
    </section>
  );
}

/* Abstract hero art from the token colors: letterforms and a speech bubble. Decorative. */
function HeroArt() {
  return (
    <svg
      viewBox="0 0 360 300"
      aria-hidden="true"
      focusable="false"
      className="h-auto w-full max-w-[420px] overflow-visible"
    >
      <rect
        x="30"
        y="40"
        width="170"
        height="200"
        rx="18"
        fill="#FFF1E3"
        stroke="#1A1530"
        strokeWidth="3"
        transform="rotate(-6 115 140)"
      />
      <path
        d="M60 90 H170 M60 120 H170 M60 150 H140"
        stroke="#1A1530"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.35"
        transform="rotate(-6 115 140)"
      />
      <text
        x="62"
        y="214"
        fontFamily="Fredoka, sans-serif"
        fontSize="92"
        fontWeight="700"
        fill="#FF6FA5"
        stroke="#1A1530"
        strokeWidth="3"
        paintOrder="stroke"
        transform="rotate(-6 115 140)"
      >
        Aa
      </text>
      <path
        d="M190 70 H320 a16 16 0 0 1 16 16 V150 a16 16 0 0 1 -16 16 H260 L232 196 V166 H190 a16 16 0 0 1 -16 -16 V86 a16 16 0 0 1 16 -16 Z"
        fill="#4DB8FF"
        stroke="#1A1530"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M198 100 H312 M198 122 H290"
        stroke="#1A1530"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="300" cy="230" r="34" fill="#FFD93D" stroke="#1A1530" strokeWidth="3" />
      <path
        d="M300 214 V246 M286 230 H314"
        stroke="#1A1530"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="60" cy="262" r="12" fill="#35DCA8" stroke="#1A1530" strokeWidth="3" />
    </svg>
  );
}

interface SkillCard {
  id: string;
  name: string;
  icon: ReactNode;
  tone: string;
  text: string;
  pending?: boolean;
}

const ICON = { size: 28, strokeWidth: 2.5, "aria-hidden": true } as const;

const SKILLS: readonly SkillCard[] = [
  {
    id: "reading",
    name: "Reading",
    icon: <BookOpen {...ICON} />,
    tone: "bg-world-sky-100",
    text: "Read short texts, find the main idea and meet new words in context.",
  },
  {
    id: "writing",
    name: "Writing",
    icon: <PenLine {...ICON} />,
    tone: "bg-world-amber-100",
    text: "Write sentences and paragraphs. The AI Tutor checks your writing and your teacher confirms the grade.",
  },
  {
    id: "listening",
    name: "Listening",
    icon: <Headphones {...ICON} />,
    tone: "bg-world-mint-100",
    text: "Listen to audio, answer questions, and practice spelling the words you hear.",
  },
  {
    id: "speaking",
    name: "Speaking",
    icon: <Mic {...ICON} />,
    tone: "bg-surface-0",
    text: "Not practiced on the platform yet. Pip can describe in text how a word sounds, and your class keeps speaking practice.",
    pending: true,
  },
];

const STEPS = [
  { name: "Course", text: "A subject for your grade, such as the Main Course." },
  { name: "Unit", text: "A topic inside the course. You can open any unit." },
  { name: "Lesson", text: "A short explanation with examples." },
  { name: "Activity", text: "Practice that goes with the lesson." },
  { name: "Quiz", text: "Checks the unit. It unlocks after the lessons." },
] as const;

export default function AboutPage() {
  useDocumentTitle(PAGE_TITLE);

  return (
    <>
      <PublicHeader mainId="main-content" />
      <main id="main-content" className="bg-surface-100">
        {/* Mission band */}
        <div className="border-b-2 border-stroke bg-world-sky-100">
          <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 px-6 py-14 md:grid-cols-[1.1fr_0.9fr] md:py-20">
            <div>
              <p className="font-accent text-[28px] leading-none text-world-rose-600">
                Our mission
              </p>
              <h1 className="mt-3 font-heading text-[40px] font-bold leading-[1.05] text-stroke md:text-[60px]">
                Help every student grow in English.
              </h1>
              <p className="mt-5 max-w-xl text-[18px] leading-relaxed text-stroke">
                The platform gives students in grades 7 to 12 short lessons, practice, games and a
                patient AI tutor, so they can build confidence a little every day. Teachers stay in
                charge of what students learn and how they are graded.
              </p>
            </div>
            <div className="flex justify-center md:justify-end">
              <HeroArt />
            </div>
          </div>
        </div>

        <div className={READING}>
          <Section id="what-this-is" title="What this is">
            <p>
              This is the English learning platform of {SCHOOL_NAME}. It brings the school's English
              courses, quizzes, assignments, games and an AI tutor together in one place, and it
              works on computers, tablets and phones.
            </p>
            <p>
              Students sign in with the username their school gave them. There is no self-sign-up:
              the school creates every account.
            </p>
          </Section>

          <Section id="who-for" title="Who it is for">
            <ul className="space-y-3">
              <li>
                <strong className="font-heading">Students</strong> learn, practice and earn rewards
                at their own pace.
              </li>
              <li>
                <strong className="font-heading">Teachers</strong> build courses and quizzes with AI
                help, give feedback, and follow how each class is doing.
              </li>
              <li>
                <strong className="font-heading">The school</strong> manages accounts, decides which
                features are on, and keeps the platform safe.
              </li>
            </ul>
          </Section>
        </div>

        {/* Skills grid */}
        <section
          aria-labelledby="skills"
          className="border-y-2 border-stroke bg-surface-0 py-12 md:py-16"
        >
          <div className="mx-auto w-full max-w-[1100px] px-6">
            <h2
              id="skills"
              className="font-heading text-[28px] font-bold leading-tight text-stroke md:text-[34px]"
            >
              The language skills
            </h2>
            <p className="mt-3 max-w-[720px] text-[17px] leading-[1.7] text-stroke">
              Lessons are built around the skills that make a confident English speaker. The AI
              Tutor adapts its language to the CEFR level for each grade, from A2 to B1 in grade 7
              up to B2 to C1 in grade 12.
            </p>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SKILLS.map((skill, index) => (
                <li
                  key={skill.id}
                  className={cn(
                    "flex flex-col rounded-[18px] border-2 p-5",
                    skill.tone,
                    skill.pending ? "border-dashed border-muted" : "border-stroke shadow-retro-md",
                    index % 2 === 1 && "lg:translate-y-4",
                  )}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-stroke bg-surface-0 text-stroke">
                    {skill.icon}
                  </span>
                  <h3 className="mt-4 font-heading text-[22px] font-bold text-stroke">
                    {skill.name}
                  </h3>
                  <p className="mt-2 text-[15px] leading-snug text-stroke">{skill.text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-10 max-w-[720px] text-[15px] text-muted">
              Along the way you also build <strong>vocabulary</strong> and <strong>grammar</strong>,
              and you can use the <strong>translation</strong> tool when a word is new.
            </p>
          </div>
        </section>

        <div className={READING}>
          <Section id="how-learning-works" title="How learning works">
            <p>Every course follows the same path, so you always know where you are.</p>
            <ol className="space-y-3">
              {STEPS.map((step, index) => (
                <li
                  key={step.name}
                  className="flex items-start gap-4 rounded-[14px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-stroke bg-[var(--world-main,#ffb84d)] font-heading text-[16px] font-bold"
                  >
                    {index + 1}
                  </span>
                  <p>
                    <strong className="font-heading">{step.name}.</strong> {step.text}
                  </p>
                </li>
              ))}
            </ol>
            <p>Quizzes unlock after you finish the lessons in their unit.</p>
          </Section>

          <Section id="how-ai-is-used" title="How AI is used">
            <ul className="list-disc space-y-2 pl-6">
              <li>The AI Tutor helps students learn: it explains, checks writing and quizzes.</li>
              <li>Teachers use AI to prepare lessons and draft quizzes and feedback.</li>
              <li>
                Teachers approve what students receive, and teachers confirm grades. The AI does not
                decide a grade.
              </li>
              <li>
                The school controls which AI features are on and how much each person can use.
              </li>
            </ul>
          </Section>

          <Section id="rewards" title="Rewards">
            <p>
              XP, levels, streaks, badges, coins and themes are there for motivation. They reward
              effort and regular practice, and they never change your grades. Coins have no
              real-money value, and the games are played solo against the clock or your own best
              score.
            </p>
          </Section>
        </div>

        {/* Mascots */}
        <section aria-labelledby="mascots" className="bg-world-amber-100 py-12 md:py-16">
          <div className={READING}>
            <h2
              id="mascots"
              className="font-heading text-[28px] font-bold leading-tight text-stroke md:text-[34px]"
            >
              Meet Pip and Nova
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <article className="rounded-[18px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-md">
                <Avatar mascot="pip" size="xl" />
                <h3 className="mt-4 font-heading text-[22px] font-bold text-stroke">
                  Pip, the curious owl
                </h3>
                <p className="mt-2 text-[15px] leading-snug text-stroke">
                  Pip is your AI Tutor. Pip is friendly and a little playful, gives one idea at a
                  time, and would rather give you a hint than the answer, because you learn more
                  that way.
                </p>
              </article>
              <article className="rounded-[18px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-md">
                <Avatar mascot="nova" size="xl" />
                <h3 className="mt-4 font-heading text-[22px] font-bold text-stroke">
                  Nova, the helper star
                </h3>
                <p className="mt-2 text-[15px] leading-snug text-stroke">
                  Nova shows up at the special moments: when a page is empty, when something needs
                  fixing, and when you reach a big goal. Nova cheers you on and points you to what
                  to do next.
                </p>
              </article>
            </div>
          </div>
        </section>

        <div className={READING}>
          <Section id="privacy-in-brief" title="Privacy in brief">
            <p>
              No ads, no selling of student data, and no tracking scripts. Students see only their
              own work, and other students see just a display name, avatar, level and XP on
              leaderboards.{" "}
              <Link to="/terms" className="font-semibold underline underline-offset-2">
                Read the Terms and Privacy notice
              </Link>
              .
            </p>
          </Section>

          <Section id="contact" title="Contact">
            <p>
              Questions about your account or the platform go to your school.{" "}
              <Link to="/help" className="font-semibold underline underline-offset-2">
                Help and contact
              </Link>
              .
            </p>
          </Section>

          <section aria-labelledby="school" className="pb-16 pt-6">
            <h2 id="school" className="sr-only">
              The school
            </h2>
            {SCHOOL_LOGO_SRC !== null && (
              <div className="inline-block rounded-[16px] border-2 border-stroke bg-surface-0 p-6 shadow-retro-sm">
                <img
                  src={SCHOOL_LOGO_SRC}
                  alt={SCHOOL_NAME}
                  width={221}
                  height={48}
                  className="h-12 w-auto"
                />
              </div>
            )}
            <p className="mt-4 text-[16px] text-muted">
              The Al Hikmah English Platform is part of {SCHOOL_NAME}.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}

export { AboutPage };

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  PenLine,
  Headphones,
  Mic,
  Sparkles,
  Gamepad2,
  ClipboardCheck,
  FileText,
  Bot,
  Newspaper,
  Bell,
  TrendingUp,
  ArrowRight,
  Send,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { useInView } from "@/pages/landing/hooks/useInView";
import { MAGAZINE_PAGES } from "@/pages/landing/data";

/* ------------------------------------------------------------------ */
/* Shared scroll-reveal wrapper                                        */
/* ------------------------------------------------------------------ */

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out will-change-transform",
        inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        className,
      )}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "white" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-sans text-[12px] font-bold uppercase tracking-[0.18em]",
        tone === "gold" ? "text-gold-600" : "text-gold-500",
      )}
    >
      <span className={cn("h-[2px] w-6 rounded-full", tone === "gold" ? "bg-gold-500" : "bg-gold-500")} />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 02 — Platform introduction                                          */
/* ------------------------------------------------------------------ */

const PLATFORM_PILLARS = [
  { label: "Courses", icon: BookOpen, tone: "sky" as const },
  { label: "Skills practice", icon: Headphones, tone: "spark" as const },
  { label: "Tests & quizzes", icon: ClipboardCheck, tone: "coral" as const },
  { label: "Assignments", icon: FileText, tone: "violet" as const },
  { label: "AI Tutor", icon: Bot, tone: "gold" as const },
  { label: "Games", icon: Gamepad2, tone: "sky" as const },
  { label: "Progress", icon: TrendingUp, tone: "spark" as const },
  { label: "Magazine", icon: Newspaper, tone: "coral" as const },
];

const TONE_CLASSES = {
  sky: "bg-sky-100 text-sky-600",
  spark: "bg-spark-100 text-spark-600",
  coral: "bg-coral-100 text-coral-600",
  violet: "bg-violet-100 text-violet-600",
  gold: "bg-gold-500/15 text-gold-600",
};

function PlatformIntro() {
  return (
    <section className="relative overflow-hidden bg-surface-0 py-24 sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-gold-500/10 blur-3xl"
      />
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <Reveal>
          <Eyebrow>The whole platform</Eyebrow>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-4 max-w-3xl font-serif text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.05] text-navy-900">
            Everything you need
            <br />
            to master English.
          </h2>
        </Reveal>
        <Reveal delay={140}>
          <p className="mt-6 max-w-xl font-sans text-[17px] leading-relaxed text-ink-700">
            One platform, built for Grades 9–12 — courses, practice, tests, assignments,
            an AI tutor, and games, all tied to the same curriculum, all in one place.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {PLATFORM_PILLARS.map((pillar, i) => (
            <Reveal key={pillar.label} delay={180 + i * 60}>
              <div className="group flex flex-col items-start gap-4 rounded-lg border border-line-200 bg-surface-0 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-gold-500/40 hover:shadow-elevation-2">
                <span
                  className={cn(
                    "inline-flex h-11 w-11 items-center justify-center rounded-md transition-transform duration-300 group-hover:scale-110",
                    TONE_CLASSES[pillar.tone],
                  )}
                >
                  <pillar.icon size={20} strokeWidth={1.75} />
                </span>
                <span className="font-sans text-[15px] font-semibold text-navy-900">{pillar.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 03 — Courses & lessons                                              */
/* ------------------------------------------------------------------ */

const UNITS = [
  { n: "UNIT 03", title: "Grammar in Context", lessons: 10, practice: 3, done: true },
  { n: "UNIT 04", title: "Stories & Ideas", lessons: 12, practice: 4, done: false, current: true },
  { n: "UNIT 05", title: "Persuasive Writing", lessons: 9, practice: 3, done: false },
  { n: "UNIT 06", title: "The Media Today", lessons: 11, practice: 4, done: false },
];

function CoursesSection() {
  return (
    <section className="bg-surface-50 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Reveal>
              <Eyebrow>Grade 10 — English</Eyebrow>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mt-4 font-serif text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.05] text-navy-900">
                Learn
                <br />
                with purpose.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={120}>
            <Link
              to="/courses"
              className="group inline-flex items-center gap-2 font-sans text-[15px] font-semibold text-navy-900 hover:text-gold-600"
            >
              View all courses
              <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>

        <div className="mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 [scrollbar-width:thin]">
          {UNITS.map((unit, i) => (
            <Reveal key={unit.n} delay={i * 90} className="w-[300px] shrink-0 snap-start sm:w-[340px]">
              <div
                className={cn(
                  "group h-full rounded-lg border p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-elevation-2",
                  unit.current
                    ? "border-gold-500 bg-navy-900 text-white"
                    : "border-line-200 bg-surface-0 text-navy-900",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "font-sans text-[12px] font-bold uppercase tracking-[0.14em]",
                      unit.current ? "text-gold-500" : "text-ink-500",
                    )}
                  >
                    {unit.n}
                  </span>
                  {unit.done && <CheckCircle2 size={18} className="text-success-600" strokeWidth={1.75} />}
                  {unit.current && (
                    <span className="rounded-sm bg-gold-500 px-2 py-0.5 font-sans text-[11px] font-bold uppercase tracking-wide text-navy-900">
                      Now
                    </span>
                  )}
                </div>
                <h3 className={cn("mt-4 font-serif text-2xl font-semibold", unit.current ? "text-white" : "text-navy-900")}>
                  {unit.title}
                </h3>
                <dl className={cn("mt-6 space-y-2 font-sans text-[13px]", unit.current ? "text-white/70" : "text-ink-500")}>
                  <div className="flex justify-between border-b border-current/10 pb-2">
                    <dt>Lessons</dt>
                    <dd className="font-semibold tabular-nums">{unit.lessons}</dd>
                  </div>
                  <div className="flex justify-between border-b border-current/10 pb-2">
                    <dt>Practice sets</dt>
                    <dd className="font-semibold tabular-nums">{unit.practice}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Assessment</dt>
                    <dd className="font-semibold tabular-nums">01</dd>
                  </div>
                </dl>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 04 — Skills practice                                                */
/* ------------------------------------------------------------------ */

const SKILLS = [
  {
    key: "reading",
    label: "Reading",
    icon: BookOpen,
    tone: "sky" as const,
    blurb: "Passages, comprehension checks, and vocabulary in context.",
  },
  {
    key: "writing",
    label: "Writing",
    icon: PenLine,
    tone: "coral" as const,
    blurb: "Guided drafts with structure, grammar, and style feedback.",
  },
  {
    key: "listening",
    label: "Listening",
    icon: Headphones,
    tone: "spark" as const,
    blurb: "Real audio, native pace, with question sets that follow.",
  },
  {
    key: "speaking",
    label: "Speaking",
    icon: Mic,
    tone: "violet" as const,
    blurb: "Pronunciation, fluency, and short spoken responses.",
  },
];

const SKILL_ACCENT: Record<string, string> = {
  sky: "border-sky-500 bg-sky-100 text-sky-600",
  coral: "border-coral-500 bg-coral-100 text-coral-600",
  spark: "border-spark-500 bg-spark-100 text-spark-600",
  violet: "border-violet-500 bg-violet-100 text-violet-600",
};

function SkillsSection() {
  const [active, setActive] = useState("reading");
  const skill = SKILLS.find((s) => s.key === active)!;

  return (
    <section className="bg-surface-0 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <Reveal>
          <Eyebrow>Four skills, one system</Eyebrow>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-4 font-serif text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.05] text-navy-900">
            Practice
            <br />
            until it clicks.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-[1fr_1.15fr] lg:gap-8">
          <Reveal className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            {SKILLS.map((s) => (
              <button
                key={s.key}
                type="button"
                onMouseEnter={() => setActive(s.key)}
                onFocus={() => setActive(s.key)}
                onClick={() => setActive(s.key)}
                className={cn(
                  "flex items-center gap-4 rounded-lg border-2 p-5 text-left transition-all duration-300 ease-out",
                  active === s.key
                    ? SKILL_ACCENT[s.tone]
                    : "border-line-200 bg-surface-0 text-navy-900 hover:border-line-200 hover:bg-surface-50",
                )}
              >
                <s.icon size={22} strokeWidth={1.75} className="shrink-0" />
                <div>
                  <div className="font-sans text-[16px] font-bold">{s.label}</div>
                  <div className={cn("mt-0.5 hidden font-sans text-[13px] sm:block", active === s.key ? "opacity-80" : "text-ink-500")}>
                    {s.blurb}
                  </div>
                </div>
              </button>
            ))}
          </Reveal>

          <Reveal delay={100}>
            <div className="relative h-full min-h-[320px] overflow-hidden rounded-lg border border-line-200 bg-navy-900 p-8">
              <SkillVisual skillKey={skill.key} />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function SkillVisual({ skillKey }: { skillKey: string }) {
  if (skillKey === "reading") {
    return (
      <div className="flex h-full flex-col justify-center gap-3">
        {[92, 100, 78, 88, 60].map((w, i) => (
          <div
            key={i}
            className="h-3 rounded-full bg-white/15 transition-all duration-700"
            style={{ width: `${w}%`, transitionDelay: `${i * 60}ms` }}
          />
        ))}
        <span className="mt-2 inline-flex w-fit items-center rounded-sm bg-sky-500/20 px-3 py-1 font-sans text-[12px] font-semibold text-sky-500">
          Comprehension · Unit 04
        </span>
      </div>
    );
  }
  if (skillKey === "writing") {
    return (
      <div className="flex h-full flex-col justify-center gap-3">
        <p className="font-serif text-lg leading-relaxed text-white/90">
          The article opened with a <span className="rounded-sm bg-coral-500/30 px-1 text-coral-500">striking</span>{" "}
          image, drawing readers into the story before a single fact was given.
        </p>
        <div className="mt-2 flex h-1.5 w-24 animate-pulse rounded-full bg-coral-500/60" />
      </div>
    );
  }
  if (skillKey === "listening") {
    return (
      <div className="flex h-full items-center justify-center gap-1.5">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="w-1.5 rounded-full bg-spark-500/70"
            style={{
              height: `${18 + Math.abs(Math.sin(i * 0.7)) * 60}%`,
              animation: `pulse 1.6s ease-in-out ${i * 0.05}s infinite`,
            }}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-violet-500 text-violet-500">
        <Mic size={26} strokeWidth={1.75} />
      </span>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-violet-500"
            style={{ animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
      </div>
      <span className="font-sans text-[13px] text-white/60">Listening for your response…</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 — Tests & quizzes                                                */
/* ------------------------------------------------------------------ */

const SCORES = [
  { label: "Reading", value: 82, tone: "sky" as const },
  { label: "Writing", value: 74, tone: "coral" as const },
  { label: "Listening", value: 89, tone: "spark" as const },
  { label: "Speaking", value: 71, tone: "violet" as const },
];

const BAR_TONE: Record<string, string> = {
  sky: "bg-sky-500",
  coral: "bg-coral-500",
  spark: "bg-spark-500",
  violet: "bg-violet-500",
};

function TestsSection() {
  const { ref, inView } = useInView<HTMLDivElement>(0.4);
  return (
    <section className="bg-navy-900 py-24 text-white sm:py-32">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-xl">
          <Eyebrow tone="white">Assessment</Eyebrow>
          <h2 className="mt-4 font-serif text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.05]">
            Know where
            <br />
            you stand.
          </h2>
          <p className="mt-6 font-sans text-[17px] leading-relaxed text-white/70">
            Every quiz and test grades instantly and rolls up into a skill breakdown —
            so it's always clear what to practice next.
          </p>
        </Reveal>

        <div ref={ref} className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {SCORES.map((s, i) => (
            <div key={s.label} className="border-t border-white/15 pt-5">
              <div className="flex items-baseline justify-between font-sans">
                <span className="text-[14px] font-semibold uppercase tracking-wide text-white/70">{s.label}</span>
                <span className="font-serif text-3xl font-semibold tabular-nums">
                  <Counter to={s.value} start={inView} delayMs={i * 120} />%
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-[1400ms] ease-out", BAR_TONE[s.tone])}
                  style={{ width: inView ? `${s.value}%` : "0%", transitionDelay: `${i * 120}ms` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Counter({ to, start, delayMs }: { to: number; start: boolean; delayMs: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    const timeout = setTimeout(() => {
      const duration = 1200;
      const startTime = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delayMs);
    return () => clearTimeout(timeout);
  }, [start, to, delayMs]);
  return <>{n}</>;
}

/* ------------------------------------------------------------------ */
/* 06 — Assignments                                                    */
/* ------------------------------------------------------------------ */

function AssignmentsSection() {
  return (
    <section className="bg-surface-50 py-24 sm:py-32">
      <div className="mx-auto grid w-full max-w-[1440px] gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <Reveal>
            <Eyebrow>Assignments</Eyebrow>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-4 font-serif text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.05] text-navy-900">
              Put English
              <br />
              to work.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-6 max-w-md font-sans text-[17px] leading-relaxed text-ink-700">
              Real writing, real deadlines. Every assignment ties back to what's
              being taught in class, with feedback that shows up alongside the grade.
            </p>
          </Reveal>
        </div>

        <Reveal delay={100}>
          <div className="group rounded-lg border border-line-200 bg-surface-0 p-8 shadow-elevation-1 transition-all duration-300 hover:shadow-elevation-2">
            <div className="flex items-center justify-between">
              <span className="font-sans text-[12px] font-bold uppercase tracking-[0.14em] text-ink-500">
                Assignment 04
              </span>
              <span className="rounded-sm bg-warning-100 px-2 py-1 font-sans text-[11px] font-bold uppercase tracking-wide text-warning-600">
                Due Thursday
              </span>
            </div>
            <h3 className="mt-4 font-serif text-2xl font-semibold text-navy-900">Write a News Article</h3>
            <p className="mt-2 font-sans text-[14px] text-ink-500">
              300–400 words · Unit 04 · Reading &amp; Writing
            </p>

            <div className="mt-6">
              <div className="flex justify-between font-sans text-[13px] font-semibold text-ink-700">
                <span>Progress</span>
                <span>82%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-100">
                <div className="h-full w-[82%] rounded-full bg-gold-500 transition-all duration-700 group-hover:w-[100%]" />
              </div>
            </div>

            <Link
              to="/assignments"
              className="mt-7 inline-flex items-center gap-2 font-sans text-[15px] font-semibold text-navy-900 hover:text-gold-600"
            >
              Open assignment
              <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 07 — AI Tutor                                                       */
/* ------------------------------------------------------------------ */

const CHAT_STEPS = [
  { role: "student" as const, text: "Why do we use \u201chad been\u201d here?" },
  { role: "thinking" as const, text: "" },
  {
    role: "tutor" as const,
    text: "We use the past perfect continuous to show an action that was ongoing before another past moment.",
  },
];

function AiTutorSection() {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (step >= CHAT_STEPS.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 700 : 1400);
    return () => clearTimeout(t);
  }, [inView, step]);

  return (
    <section className="relative overflow-hidden bg-navy-900 py-24 text-white sm:py-36">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gold-500/10 blur-3xl"
      />
      <div className="relative mx-auto grid w-full max-w-[1440px] gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <Reveal>
            <Eyebrow tone="white">Available anytime</Eyebrow>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-4 font-serif text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.02]">
              Your
              <br />
              AI Tutor.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-6 max-w-md font-sans text-[18px] leading-relaxed text-white/70">
              Ask questions. Practice. Get guidance. Keep learning — grade-aware,
              always ready, and built for the same curriculum you're already in.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <Link
              to="/ai-tutor"
              className="mt-8 inline-flex min-h-[48px] items-center gap-2 rounded-md bg-gold-500 px-6 font-sans text-[15px] font-bold text-navy-900 transition-all duration-200 hover:bg-gold-600 hover:shadow-lg hover:shadow-gold-500/25"
            >
              Try the AI Tutor
              <ArrowRight size={17} />
            </Link>
          </Reveal>
        </div>

        <div ref={ref} className="rounded-lg border border-white/10 bg-white/[0.04] p-6 backdrop-blur-[2px] sm:p-8">
          <div className="flex items-center gap-2 border-b border-white/10 pb-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-500 text-navy-900">
              <Bot size={16} strokeWidth={2} />
            </span>
            <span className="font-sans text-[14px] font-semibold text-white/80">AI Tutor</span>
          </div>

          <div className="mt-5 flex min-h-[180px] flex-col gap-4">
            <div
              className={cn(
                "ml-auto max-w-[80%] rounded-lg rounded-tr-sm bg-white/10 px-4 py-2.5 font-sans text-[14px] transition-all duration-500",
                step >= 0 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
              )}
            >
              {CHAT_STEPS[0].text}
            </div>

            {step === 1 && (
              <div className="flex items-center gap-1.5 rounded-lg rounded-tl-sm bg-gold-500/15 px-4 py-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-gold-500"
                    style={{ animation: `pulse 1s ease-in-out ${i * 0.15}s infinite` }}
                  />
                ))}
              </div>
            )}

            {step >= 2 && (
              <div className="max-w-[85%] rounded-lg rounded-tl-sm bg-gold-500/15 px-4 py-3 font-sans text-[14px] leading-relaxed text-white/90 transition-all duration-500 animate-[fadein_0.5s_ease-out]">
                We use the <span className="font-semibold text-gold-500">past perfect continuous</span> to show an
                action that was ongoing before another past moment.
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 py-3">
            <span className="font-sans text-[13px] text-white/40">Ask the AI Tutor anything…</span>
            <Send size={15} className="ms-auto text-white/40" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 08 — Educational games                                              */
/* ------------------------------------------------------------------ */

const GAMES = [
  { name: "Grammar Challenge", tone: "gold" as const, tag: "Timed" },
  { name: "Word Hunt", tone: "spark" as const, tag: "New" },
  { name: "Vocabulary Rush", tone: "coral" as const, tag: "Popular" },
  { name: "Listening Quest", tone: "sky" as const, tag: "Audio" },
  { name: "Sentence Builder", tone: "violet" as const, tag: "" },
];

const GAME_TONE: Record<string, string> = {
  gold: "bg-gold-500 text-navy-900",
  spark: "bg-spark-500 text-navy-900",
  coral: "bg-coral-500 text-navy-900",
  sky: "bg-sky-500 text-navy-900",
  violet: "bg-violet-500 text-white",
};

function GamesSection() {
  return (
    <section className="overflow-hidden bg-surface-0 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <Reveal>
          <Eyebrow>Educational games</Eyebrow>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-4 font-serif text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.05] text-navy-900">
            Learn. Play. Repeat.
          </h2>
        </Reveal>
      </div>

      <div className="mt-14 flex gap-5 overflow-x-auto px-4 pb-4 sm:px-6 lg:px-8 [scrollbar-width:thin]">
        {GAMES.map((g, i) => (
          <Reveal key={g.name} delay={i * 80} className="w-[240px] shrink-0">
            <Link
              to="/games"
              className="group relative flex h-[280px] flex-col justify-between overflow-hidden rounded-lg border border-line-200 bg-navy-900 p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-elevation-3"
            >
              {g.tag && (
                <span
                  className={cn(
                    "absolute right-4 top-4 rounded-sm px-2 py-0.5 font-sans text-[11px] font-bold uppercase tracking-wide",
                    GAME_TONE[g.tone],
                  )}
                >
                  {g.tag}
                </span>
              )}
              <span
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
                  GAME_TONE[g.tone],
                )}
              >
                <Gamepad2 size={22} strokeWidth={1.75} />
              </span>
              <div>
                <h3 className="font-serif text-xl font-semibold text-white">{g.name}</h3>
                <span className="mt-2 inline-flex items-center gap-1.5 font-sans text-[13px] font-semibold text-gold-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  Play now <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 09 — Weekly magazine                                                */
/* ------------------------------------------------------------------ */

function MagazineSection() {
  return (
    <section className="bg-surface-50 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Reveal>
              <Eyebrow>Issue 024</Eyebrow>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mt-4 font-serif text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.05] text-navy-900">
                The English
                <br />
                Weekly.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={120}>
            <Link
              to="/magazine"
              className="group inline-flex items-center gap-2 font-sans text-[15px] font-semibold text-navy-900 hover:text-gold-600"
            >
              Read the full issue
              <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>

        <Reveal delay={160}>
          <div className="group mt-14 flex justify-center gap-1 [perspective:2000px] sm:gap-2">
            <img
              src={MAGAZINE_PAGES.page1}
              alt={MAGAZINE_PAGES.alt1}
              className="w-1/2 max-w-[420px] rounded-l-md shadow-elevation-2 transition-transform duration-500 ease-out group-hover:[transform:rotateY(4deg)]"
              draggable={false}
            />
            <img
              src={MAGAZINE_PAGES.page2}
              alt={MAGAZINE_PAGES.alt2}
              className="w-1/2 max-w-[420px] rounded-r-md shadow-elevation-2 transition-transform duration-500 ease-out group-hover:[transform:rotateY(-4deg)]"
              draggable={false}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 10 — Announcements                                                  */
/* ------------------------------------------------------------------ */

const ANNOUNCEMENTS = [
  { tag: "New game", tagTone: "spark" as const, title: "Grammar Challenge is now available.", icon: Gamepad2 },
  { tag: "Magazine", tagTone: "coral" as const, title: "Issue 24 is now live.", icon: Newspaper },
  { tag: "AI Tutor", tagTone: "gold" as const, title: "New speaking practice has been added.", icon: Bot },
  { tag: "Course", tagTone: "sky" as const, title: "Unit 04 is now available.", icon: BookOpen },
];

function AnnouncementsSection() {
  return (
    <section className="bg-surface-0 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <Reveal>
          <Eyebrow>Stay in the loop</Eyebrow>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-4 font-serif text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.05] text-navy-900">
            What's happening.
          </h2>
        </Reveal>

        <div className="mt-14 divide-y divide-line-200 border-y border-line-200">
          {ANNOUNCEMENTS.map((a, i) => (
            <Reveal key={a.title} delay={i * 90}>
              <div
                className={cn(
                  "flex items-center gap-5 py-5 transition-colors duration-200 hover:bg-surface-50",
                  i === 0 && "py-6",
                )}
              >
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", TONE_CLASSES[a.tagTone])}>
                  <a.icon size={18} strokeWidth={1.75} />
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-ink-500">
                    {a.tag}
                  </span>
                  <span className={cn("font-sans text-navy-900", i === 0 ? "text-[17px] font-semibold" : "text-[15px]")}>
                    {a.title}
                  </span>
                </div>
                {i === 0 && <Bell size={16} className="shrink-0 text-gold-500" strokeWidth={1.75} />}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 11 — Student progress / journey                                     */
/* ------------------------------------------------------------------ */

const JOURNEY = [
  { label: "Unit 01", state: "done" as const },
  { label: "Unit 02", state: "done" as const },
  { label: "Unit 03", state: "done" as const },
  { label: "Unit 04", state: "current" as const },
  { label: "Unit 05", state: "upcoming" as const },
];

function ProgressSection() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <section className="bg-navy-900 py-24 text-white sm:py-32">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <Reveal>
          <Eyebrow tone="white">Signed in as Student</Eyebrow>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-4 font-serif text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.05]">
            Your journey.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-12 lg:grid-cols-[280px_1fr] lg:items-center">
          <Reveal delay={120} className="flex items-center gap-8 lg:flex-col lg:items-start">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="#D4A02B"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 44}
                  strokeDashoffset={inView ? 2 * Math.PI * 44 * (1 - 0.72) : 2 * Math.PI * 44}
                  style={{ transition: "stroke-dashoffset 1.4s ease-out" }}
                />
              </svg>
              <span className="absolute font-serif text-3xl font-semibold">72%</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 font-sans text-[14px] lg:grid-cols-1">
              <div>
                <dt className="text-white/50">Lessons completed</dt>
                <dd className="mt-0.5 font-serif text-2xl font-semibold">7</dd>
              </div>
              <div>
                <dt className="text-white/50">Assignments</dt>
                <dd className="mt-0.5 font-serif text-2xl font-semibold">3</dd>
              </div>
              <div>
                <dt className="text-white/50">Tests taken</dt>
                <dd className="mt-0.5 font-serif text-2xl font-semibold">2</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-white/50">Streak</dt>
                <dd className="mt-0.5 flex items-center gap-1 font-serif text-2xl font-semibold text-gold-500">
                  4 <Flame size={18} className="mb-1" />
                </dd>
              </div>
            </dl>
          </Reveal>

          <Reveal delay={180}>
            <div ref={ref} className="relative flex items-center justify-between">
              <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-white/15" />
              <div
                className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 bg-gold-500 transition-[width] duration-[1400ms] ease-out"
                style={{ width: inView ? "68%" : "0%" }}
              />
              {JOURNEY.map((step) => (
                <div key={step.label} className="relative z-10 flex flex-col items-center gap-3">
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors duration-500",
                      step.state === "upcoming"
                        ? "border-white/25 bg-navy-900"
                        : "border-gold-500 bg-gold-500",
                    )}
                  >
                    {step.state === "current" && <span className="h-2 w-2 rounded-full bg-navy-900" />}
                  </span>
                  <span
                    className={cn(
                      "whitespace-nowrap font-sans text-[13px]",
                      step.state === "current" ? "font-bold text-gold-500" : "text-white/60",
                    )}
                  >
                    {step.label}
                    {step.state === "current" && (
                      <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
                        You are here
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 12 — Final CTA                                                      */
/* ------------------------------------------------------------------ */

function FinalCta() {
  return (
    <section className="bg-surface-0 py-28 sm:py-36">
      <div className="mx-auto w-full max-w-[1440px] px-4 text-center sm:px-6 lg:px-8">
        <Reveal className="mx-auto flex flex-col items-center">
          <Sparkles size={22} className="text-gold-500" strokeWidth={1.5} />
          <h2 className="mt-6 font-serif text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.05] text-navy-900">
            Where will
            <br />
            English take you?
          </h2>
          <Link
            to="/courses"
            className="group mt-10 inline-flex min-h-[52px] items-center gap-2 rounded-md bg-gold-500 px-8 font-sans text-[16px] font-bold text-navy-900 transition-all duration-200 hover:bg-gold-600 hover:shadow-lg hover:shadow-gold-500/25"
          >
            Continue learning
            <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Composer                                                             */
/* ------------------------------------------------------------------ */

export function LandingSections() {
  return (
    <>
      <PlatformIntro />
      <CoursesSection />
      <SkillsSection />
      <TestsSection />
      <AssignmentsSection />
      <AiTutorSection />
      <GamesSection />
      <MagazineSection />
      <AnnouncementsSection />
      <ProgressSection />
      <FinalCta />
    </>
  );
}

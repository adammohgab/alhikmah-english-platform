import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Lightbulb,
  Printer,
  Sparkles,
  X,
} from "lucide-react";

type AgendaItem = { title: string; minutes: number; detail: string };
type Lesson = {
  day: string;
  dateLabel: string;
  title: string;
  objective: string;
  bellRinger: string;
  agenda: AgendaItem[];
  homework: string;
  materials: string;
  approved: boolean;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const AGENDA = [
  {
    title: "Warm-up",
    minutes: 5,
    detail: "Bell-ringer: retrieve prior learning and share one answer with a partner.",
  },
  {
    title: "Direct instruction",
    minutes: 15,
    detail: "Model the key concept with a worked example and think aloud.",
  },
  {
    title: "Guided practice",
    minutes: 15,
    detail: "Complete a scaffolded task together, then compare answers.",
  },
  {
    title: "Exit ticket",
    minutes: 10,
    detail: "Answer one short question to show today's learning.",
  },
];
const ACTIVITIES = [
  {
    title: "Build background knowledge",
    objective: "Connect prior knowledge to the unit's essential question.",
    bell: "Write three things you already know about the topic.",
    homework: "Create a five-word glossary for the unit.",
  },
  {
    title: "Explore key vocabulary",
    objective: "Use the unit's key vocabulary accurately in context.",
    bell: "Match today's vocabulary words to their meanings.",
    homework: "Write three original sentences using the new vocabulary.",
  },
  {
    title: "Notice patterns and examples",
    objective: "Identify the target concept and explain how it works.",
    bell: "Study the example and predict what happens next.",
    homework: "Find or create two examples of today's concept.",
  },
  {
    title: "Practice and apply",
    objective: "Apply the target skill independently with growing accuracy.",
    bell: "Correct the sample answer and explain the change.",
    homework: "Complete a short practice set and mark one question to revisit.",
  },
  {
    title: "Review and reflect",
    objective: "Demonstrate understanding and reflect on progress across the unit.",
    bell: "Recall one important idea from each previous lesson.",
    homework: "Write a short reflection: one thing learned and one question remaining.",
  },
];

function makePlan(unit: string): Lesson[] {
  return DAYS.map((day, index) => {
    const activity = ACTIVITIES[index]!;
    return {
      day,
      dateLabel: `Day ${index + 1}`,
      title: `${unit}: ${activity.title}`,
      objective: activity.objective,
      bellRinger: activity.bell,
      agenda: AGENDA.map((item) => ({
        ...item,
        detail:
          item.title === "Warm-up"
            ? activity.bell
            : item.title === "Direct instruction"
              ? `Teach one clear idea from ${unit}; model it with an example.`
              : item.title === "Guided practice"
                ? `Pairs practise ${unit} with prompts, then explain their reasoning.`
                : `Respond to a short question about ${unit} independently.`,
      })),
      homework: activity.homework,
      materials: "Board or slides, learner notebooks, unit text, exit-ticket slips",
      approved: false,
    };
  });
}

const panel = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function LessonPlannerPage() {
  const [unit, setUnit] = useState("Unit 1: Getting started");
  const [className, setClassName] = useState("English · Class 8B");
  const [showGenerate, setShowGenerate] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState("");
  const selected = lessons[selectedDay];
  const approvedCount = useMemo(
    () => lessons.filter((lesson) => lesson.approved).length,
    [lessons],
  );

  function generate() {
    if (!unit.trim()) return;
    setLessons(makePlan(unit.trim()));
    setSelectedDay(0);
    setShowGenerate(false);
    setNotice(`A five-day draft for “${unit.trim()}” is ready to review.`);
  }

  function toggleApproval(index: number) {
    setLessons((current) =>
      current.map((lesson, i) =>
        i === index ? { ...lesson, approved: !lesson.approved } : lesson,
      ),
    );
    setNotice(
      lessons[index]?.approved
        ? "Lesson moved back to draft."
        : "Lesson approved for your weekly plan.",
    );
  }

  function approveAll() {
    setLessons((current) => current.map((lesson) => ({ ...lesson, approved: true })));
    setNotice("All five lesson plans have been approved in this workspace.");
  }

  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <style>{`@media print { body * { visibility: hidden !important; } #lesson-print-area, #lesson-print-area * { visibility: visible !important; } #lesson-print-area { position: absolute; inset: 0; width: 100%; padding: 24px; color: #111827; } .no-print { display: none !important; } .print-break { break-inside: avoid; } }`}</style>
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="mb-1 text-sm font-semibold text-indigo-600">Teacher workspace / Planning</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Weekly lesson planner
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Build a practical five-day plan with timed agendas, warm-ups, exit tickets, and homework
            ideas.
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button
            type="button"
            className={`${button} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}
            onClick={() => window.print()}
            disabled={!lessons.length}
          >
            <Printer size={17} /> Print / Save PDF
          </button>
          <button
            type="button"
            className={`${button} bg-indigo-600 text-white hover:bg-indigo-700`}
            onClick={() => setShowGenerate(true)}
          >
            <Sparkles size={17} /> Generate Weekly Plan
          </button>
        </div>
      </header>

      {notice && (
        <div
          role="status"
          className="no-print flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <span>{notice}</span>
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <div className={panel}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <CalendarDays size={19} /> Monday – Friday
              </h2>
              <p className="mt-1 text-sm text-slate-500">{className}</p>
            </div>
            {lessons.length > 0 && (
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                {approvedCount}/5 approved
              </span>
            )}
          </div>
          {lessons.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-6 text-center">
              <div className="mb-3 rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                <CalendarDays size={26} />
              </div>
              <h3 className="font-bold text-slate-900">Plan your first week with AI</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                Choose a target unit to draft five daily lesson agendas. You can review and edit
                each day before printing.
              </p>
              <button
                type="button"
                className={`${button} mt-4 bg-indigo-600 text-white hover:bg-indigo-700`}
                onClick={() => setShowGenerate(true)}
              >
                <Sparkles size={16} /> Generate a plan
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {lessons.map((lesson, index) => (
                <button
                  key={lesson.day}
                  type="button"
                  onClick={() => setSelectedDay(index)}
                  aria-pressed={selectedDay === index}
                  className={`min-h-40 rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${selectedDay === index ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 bg-white"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-slate-900">{lesson.day}</span>
                    {lesson.approved && <CheckCircle2 size={17} className="text-emerald-600" />}
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-500">{lesson.dateLabel}</p>
                  <p className="mt-1 line-clamp-3 text-sm font-medium text-slate-800">
                    {lesson.title}
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 size={13} /> 45 minutes
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <aside className={`${panel} no-print`}>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <BookOpen size={19} /> Plan overview
          </h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Class / group
              <input
                className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 px-3 font-normal"
                value={className}
                onChange={(event) => setClassName(event.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Target unit
              <input
                className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 px-3 font-normal"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Teacher notes
              <textarea
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                placeholder="Learning needs, days off, materials…"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Daily timing
              </p>
              {AGENDA.map((item) => (
                <div
                  key={item.title}
                  className="mt-2 flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-slate-700">{item.title}</span>
                  <span className="font-bold tabular-nums text-slate-900">{item.minutes}m</span>
                </div>
              ))}
              <div className="mt-3 border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-900">
                Total <span className="float-right">45 minutes</span>
              </div>
            </div>
            {lessons.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`${button} flex-1 bg-emerald-600 text-white hover:bg-emerald-700`}
                  onClick={approveAll}
                >
                  <CheckCircle2 size={16} /> Approve all
                </button>
                <button
                  type="button"
                  className={`${button} border border-slate-300 bg-white text-slate-800`}
                  onClick={() => window.print()}
                >
                  <Download size={16} /> Export
                </button>
              </div>
            )}
          </div>
        </aside>
      </section>

      {selected && (
        <section id="lesson-print-area" className="space-y-4">
          <div className={`${panel} print-break`}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  {selected.day} · {selected.dateLabel}
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-900">{selected.title}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  <strong>Class:</strong> {className} <span className="mx-2">·</span>{" "}
                  <strong>Duration:</strong> 45 minutes
                </p>
              </div>
              <div className="no-print flex gap-2">
                <button
                  type="button"
                  className={`${button} border border-slate-300 bg-white text-slate-800`}
                  onClick={() => toggleApproval(selectedDay)}
                >
                  {selected.approved ? (
                    <>
                      <CheckCircle2 size={16} /> Approved
                    </>
                  ) : (
                    "Approve lesson"
                  )}
                </button>
                <button
                  type="button"
                  className={`${button} border border-slate-300 bg-white text-slate-800`}
                  onClick={() => window.print()}
                >
                  <Printer size={16} /> Print
                </button>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <h3 className="font-bold text-slate-900">Learning objective</h3>
                <p className="mt-1 text-sm leading-6 text-slate-700">{selected.objective}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <h3 className="flex items-center gap-2 font-bold text-amber-950">
                  <Lightbulb size={17} /> Bell-ringer / warm-up
                </h3>
                <p className="mt-1 text-sm leading-6 text-amber-900">{selected.bellRinger}</p>
              </div>
            </div>
            <h3 className="mt-6 font-bold text-slate-900">Timed lesson agenda</h3>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[minmax(120px,0.7fr)_64px_minmax(0,2fr)] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                <span>Stage</span>
                <span>Time</span>
                <span>Activity</span>
              </div>
              {selected.agenda.map((item) => (
                <div
                  key={item.title}
                  className="grid grid-cols-[minmax(120px,0.7fr)_64px_minmax(0,2fr)] gap-2 border-t border-slate-100 px-4 py-3 text-sm"
                >
                  <span className="font-bold text-slate-800">{item.title}</span>
                  <span className="font-semibold tabular-nums text-indigo-700">
                    {item.minutes}m
                  </span>
                  <span className="leading-6 text-slate-600">{item.detail}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-900">Homework idea</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{selected.homework}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-900">Materials</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{selected.materials}</p>
              </div>
            </div>
            {notes.trim() && (
              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-900">Teacher notes</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{notes}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {showGenerate && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowGenerate(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="generate-heading"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-3 inline-flex rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <Sparkles size={22} />
                </div>
                <h2 id="generate-heading" className="text-xl font-black text-slate-900">
                  Generate Weekly Plan
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Create a five-day draft with a consistent 45-minute agenda.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                onClick={() => setShowGenerate(false)}
              >
                <X size={18} />
              </button>
            </div>
            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Target unit or syllabus topic
              <input
                autoFocus
                className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="e.g. Unit 4: Past tense"
                onKeyDown={(event) => {
                  if (event.key === "Enter") generate();
                }}
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Class / group
              <input
                className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal"
                value={className}
                onChange={(event) => setClassName(event.target.value)}
              />
            </label>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              Each day includes a 5-minute warm-up, 15-minute direct instruction, 15-minute guided
              practice, and 10-minute exit ticket. Review the draft before printing.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className={`${button} border border-slate-300 bg-white text-slate-700`}
                onClick={() => setShowGenerate(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${button} bg-indigo-600 text-white hover:bg-indigo-700`}
                disabled={!unit.trim()}
                onClick={generate}
              >
                <Sparkles size={16} /> Generate 5 days
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
